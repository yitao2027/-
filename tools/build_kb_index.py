#!/usr/bin/env python3
"""
勺子Claw 知识库索引构建器
=========================
读取 D:\勺子claw资料知识库\ 下所有 PDF/DOCX，
分块 → 脱敏 → 调硅基流动 bge-m3 向量化 → 写入 LanceDB。

产出：
  output_dir/kb_vectors.lance/  (LanceDB 表)
  output_dir/metadata.json

与 rag_engine.rs 的 schema 完全对齐：
  text, skill_name, category, subcategory, source_file, chunk_index, vector(1024)

v3.0 变更：
  - 新增中度脱敏层（方案 A）
  - source_file 改存 hash 代号（如 KB-a1b2c3d4），不再暴露原始文件名/路径
  - chunk text 中剔除专家姓名、书名、章节号等敏感信息
  - 缓存分两层：chunks_raw.pkl（原始）、chunks_sanitized.pkl（脱敏后）
"""

import os
import sys
import json
import re
import time
import math
import pickle
import hashlib
import threading

# === Windows GBK 控制台兼容：强制 stdout/stderr UTF-8（emoji/中文不再炸） ===
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from pathlib import Path
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pyarrow as pa
import lancedb
import fitz  # PyMuPDF

# === 配置 ===
KB_SOURCE_DIR = Path(r"D:\勺子claw资料知识库")
OUTPUT_DIR = Path(r"C:\Users\Administrator\WorkBuddy\20260513150254\shaoziclaw-app\frontend\src-tauri\resources\knowledge-base")
CACHE_DIR = Path(r"C:\Users\Administrator\WorkBuddy\20260513150254\shaoziclaw-app\tools\.kb_cache")
CHUNKS_CACHE = CACHE_DIR / "chunks_raw.pkl"              # 解析阶段结果缓存（原始）
SANITIZED_CACHE = CACHE_DIR / "chunks_sanitized.pkl"     # 脱敏后缓存
VECTORS_CACHE = CACHE_DIR / "vectors_partial.pkl"         # 向量化阶段断点缓存（每 50 批刷盘）
SOURCE_MAP_FILE = CACHE_DIR / "source_id_map.json"        # source_id → 原始文件名映射（仅供内部查证，不进安装包）

SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/embeddings"
SILICONFLOW_API_KEY = "sk-acutyiuetcukysdmtvevlufuhyetpedsxekukdywdgjymoru"
EMBEDDING_MODEL = "BAAI/bge-m3"
VECTOR_DIM = 1024

CHUNK_SIZE = 800       # 字符
CHUNK_OVERLAP = 100    # 重叠字符
BATCH_SIZE = 32        # 每批向量化数量
MAX_RETRIES = 3
RETRY_DELAY = 2        # 秒
CONCURRENCY = 8        # 并发请求数（关键：从 1 → 8，预计加速 6-7 倍）
SAVE_EVERY_BATCHES = 50  # 每 N 批落盘一次断点

# ============================================================================
# 脱敏配置（方案 A：中度脱敏）
# ============================================================================

# 需要替换的专家/作者姓名（调研结论中出现的真实人名）
EXPERT_NAMES = [
    "华杉", "咖门", "冯仑", "彭志强", "陈彦彤", "黎群", "刘飞",
    "李卓澄", "荣宾", "厦九九", "小宽", "马静", "吕丽辉", "宋宣",
    # 常见餐饮行业专家（预防性补充）
    "西贝贾国龙", "贾国龙", "张勇", "舒从华", "宋向前", "王慧文",
    "巴奴杜中兵", "杜中兵", "费大厨", "陈鹏鹏", "喜家德高德福", "高德福",
]

# 需要清理的敏感模式（正则）
SENSITIVE_PATTERNS = [
    # 1. 书名号内的专有书名（保留法律法规名 — 不清理）
    # 注意：不清理《民法典》《食品安全法》等公开法律
    (r"《(一本万利|定位|蓝海战略|基业长青|从优秀到卓越|餐饮.*?秘籍|.*?私房.*?|.*?内训.*?)》", "《行业参考文献》"),
    # 2. "第X章"、"第X节" 章节标注
    (r"第[一二三四五六七八九十\d]+[章节篇][\s：:]*[^\n]{0,20}", ""),
    # 3. "作者：XXX"、"编著：XXX"、"主编：XXX"
    (r"[（(]?\s*(?:作者|编著|主编|著者|编者|撰稿|文/)[\s：:]*[^\n)）]{1,20}[)）]?", ""),
    # 4. 版权声明
    (r"(?:版权所有|copyright|©|未经授权|禁止转载|侵权必究)[^\n]{0,50}", ""),
    # 5. ISBN / 出版信息
    (r"ISBN[\s：:]*[\d\-Xx]+", ""),
    (r"(?:出版社|出版时间|出版日期)[\s：:]*[^\n]{1,30}", ""),
    # 6. 页码/页眉页脚
    (r"第?\s*\d+\s*页\s*(?:/\s*共?\s*\d+\s*页)?", ""),
]

# 编译正则（性能优化）
_SENSITIVE_RE = [(re.compile(p, re.IGNORECASE), r) for p, r in SENSITIVE_PATTERNS]
_EXPERT_RE = re.compile("|".join(re.escape(n) for n in EXPERT_NAMES))


def hash_source_id(filename: str) -> str:
    """将文件名转为不可逆的 hash 代号，格式 KB-xxxxxxxx"""
    h = hashlib.sha256(filename.encode("utf-8")).hexdigest()[:8]
    return f"KB-{h}"


def desensitize_text(text: str) -> str:
    """对 chunk 文本执行中度脱敏：
    - 替换专家姓名 → "行业专家"
    - 清理敏感模式（书名、章节号、作者行、版权声明等）
    - 不改变知识内容本身
    """
    # 替换专家姓名
    text = _EXPERT_RE.sub("行业专家", text)
    # 应用敏感模式
    for pattern, replacement in _SENSITIVE_RE:
        text = pattern.sub(replacement, text)
    # 清理多余空行
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# === 工具函数 ===

def extract_text_from_pdf(filepath: Path) -> str:
    """用 PyMuPDF 提取 PDF 全文"""
    try:
        doc = fitz.open(str(filepath))
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        print(f"  ⚠️ PDF解析失败 {filepath.name}: {e}")
        return ""


def extract_text_from_docx(filepath: Path) -> str:
    """用 python-docx 提取 DOCX 全文"""
    try:
        from docx import Document
        doc = Document(str(filepath))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        print(f"  ⚠️ DOCX解析失败 {filepath.name}: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """按字符数分块，带重叠"""
    if not text or len(text) < 50:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        # 清理：去掉纯空白块
        if chunk.strip() and len(chunk.strip()) > 30:
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


def categorize_file(filename: str) -> tuple:
    """根据文件名推断 category 和 subcategory（顺序敏感：先匹配更具体的）"""
    name_lower = filename.lower()
    # 优先级 1：商业模式关键词
    if "加盟" in name_lower or "连锁" in name_lower:
        return ("商业模式", "加盟连锁")
    if "出海" in name_lower:
        return ("商业模式", "餐饮出海")
    # 优先级 2：品类研究
    if "火锅" in name_lower:
        return ("品类研究", "火锅")
    if "茶饮" in name_lower or "咖啡" in name_lower:
        return ("品类研究", "茶饮咖啡")
    if "面点" in name_lower or "烘焙" in name_lower:
        return ("产品研发", "菜品研发")
    # 优先级 3：平台 / 渠道
    if "外卖" in name_lower:
        return ("外卖运营", "平台规则")
    if "美团" in name_lower:
        return ("平台运营", "美团")
    if "点评" in name_lower or "大众点评" in name_lower:
        return ("平台运营", "大众点评")
    if "京东" in name_lower or "淘宝" in name_lower:
        return ("平台运营", "电商平台")
    # 优先级 4：经营要素
    if "供应链" in name_lower or "食材" in name_lower:
        return ("供应链", "食材管理")
    if "营销" in name_lower or "私域" in name_lower or "流量" in name_lower:
        return ("营销获客", "流量运营")
    if "人力" in name_lower or "招聘" in name_lower or "培训" in name_lower:
        return ("人力资源", "招聘培训")
    if "选址" in name_lower or "商圈" in name_lower:
        return ("选址开店", "商圈分析")
    if "成本" in name_lower or "财务" in name_lower or "利润" in name_lower:
        return ("财务管理", "成本控制")
    if "品牌" in name_lower:
        return ("品牌建设", "品牌策略")
    return ("餐饮综合", "行业报告")


def embed_batch(texts: List[str]) -> List[List[float]]:
    """调硅基流动 bge-m3 批量向量化"""
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                SILICONFLOW_API_URL,
                headers={
                    "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": EMBEDDING_MODEL,
                    "input": texts,
                    "encoding_format": "float",
                },
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                embeddings = [item["embedding"] for item in data["data"]]
                return embeddings
            elif resp.status_code == 429:
                wait = RETRY_DELAY * (attempt + 1)
                print(f"  ⏳ 限流，等待 {wait}s...")
                time.sleep(wait)
            else:
                print(f"  ❌ API错误 {resp.status_code}: {resp.text[:200]}")
                time.sleep(RETRY_DELAY)
        except Exception as e:
            print(f"  ❌ 请求异常: {e}")
            time.sleep(RETRY_DELAY)
    # 全部重试失败，返回零向量
    print(f"  ⚠️ {len(texts)} 条文本向量化失败，填零向量")
    return [[0.0] * VECTOR_DIM for _ in texts]


def sanitize_chunks(raw_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """阶段 1.5：对原始 chunks 执行中度脱敏

    - source_file → hash 代号（KB-xxxxxxxx）
    - text → 执行 desensitize_text
    - 生成 source_id_map.json（仅存本地，不进安装包）
    """
    if SANITIZED_CACHE.exists():
        print(f"📦 命中脱敏缓存: {SANITIZED_CACHE}")
        with open(SANITIZED_CACHE, "rb") as f:
            return pickle.load(f)

    print(f"\n🔒 开始脱敏处理 {len(raw_chunks)} 块...")
    source_map = {}  # hash_id → original_filename
    sanitized = []
    name_hits = 0
    pattern_hits = 0

    for chunk in raw_chunks:
        orig_file = chunk["source_file"]

        # source_file → hash 代号
        sid = hash_source_id(orig_file)
        if sid not in source_map:
            source_map[sid] = orig_file

        # text 脱敏
        orig_text = chunk["text"]
        clean_text = desensitize_text(orig_text)

        # 统计脱敏命中
        if orig_text != clean_text:
            if _EXPERT_RE.search(orig_text):
                name_hits += 1
            pattern_hits += 1

        sanitized.append({
            "text": clean_text,
            "skill_name": chunk["skill_name"],
            "category": chunk["category"],
            "subcategory": chunk["subcategory"],
            "source_file": sid,           # ← 核心变化：hash 代号替代原始文件名
            "chunk_index": chunk["chunk_index"],
        })

    # 保存映射表（仅供内部查证）
    with open(SOURCE_MAP_FILE, "w", encoding="utf-8") as f:
        json.dump(source_map, f, ensure_ascii=False, indent=2)
    print(f"  📋 source_id 映射表: {len(source_map)} 个文件 → {SOURCE_MAP_FILE}")

    # 落盘脱敏后缓存
    with open(SANITIZED_CACHE, "wb") as f:
        pickle.dump(sanitized, f)

    print(f"  🔒 脱敏完成: {pattern_hits} 块有变更, {name_hits} 块命中人名替换")
    print(f"  💾 脱敏缓存已保存: {SANITIZED_CACHE}")
    return sanitized


def build_index():
    """主构建流程（v3: 并发向量化 + 断点续传 + 中度脱敏）"""
    print("=" * 60)
    print("勺子Claw 知识库索引构建器 v3.0（脱敏+并发+断点续传）")
    print("=" * 60)
    print(f"源目录: {KB_SOURCE_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"缓存目录: {CACHE_DIR}")
    print()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # === 阶段1：解析（带磁盘缓存） ===
    if CHUNKS_CACHE.exists():
        print(f"📦 命中解析缓存: {CHUNKS_CACHE}")
        with open(CHUNKS_CACHE, "rb") as f:
            raw_chunks = pickle.load(f)
        files_count = len(set(c["source_file"] for c in raw_chunks))
        print(f"✅ 加载缓存: {len(raw_chunks)} 块，{files_count} 文件")
    else:
        raw_chunks = parse_all_files()
        # 落盘
        with open(CHUNKS_CACHE, "wb") as f:
            pickle.dump(raw_chunks, f)
        print(f"💾 解析结果已缓存到 {CHUNKS_CACHE}")
        files_count = len(set(c["source_file"] for c in raw_chunks))

    if not raw_chunks:
        print("❌ 无有效文本块，退出")
        return

    # === 阶段1.5：脱敏 ===
    all_chunks = sanitize_chunks(raw_chunks)

    # === 阶段2：向量化（并发+断点续传） ===
    print(f"\n🔢 开始向量化（batch_size={BATCH_SIZE}, 并发={CONCURRENCY}, 模型={EMBEDDING_MODEL}）")
    embed_all_concurrent(all_chunks)

    # === 阶段3：写入 LanceDB ===
    print(f"\n💾 写入 LanceDB: {OUTPUT_DIR}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    schema = pa.schema([
        pa.field("text", pa.string()),
        pa.field("skill_name", pa.string()),
        pa.field("category", pa.string()),
        pa.field("subcategory", pa.string()),
        pa.field("source_file", pa.string()),
        pa.field("chunk_index", pa.int32()),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
    ])

    db = lancedb.connect(str(OUTPUT_DIR))
    try:
        db.drop_table("kb_vectors")
    except Exception:
        pass

    table = db.create_table("kb_vectors", schema=schema)
    arrays = {
        "text": pa.array([c["text"] for c in all_chunks], type=pa.string()),
        "skill_name": pa.array([c["skill_name"] for c in all_chunks], type=pa.string()),
        "category": pa.array([c["category"] for c in all_chunks], type=pa.string()),
        "subcategory": pa.array([c["subcategory"] for c in all_chunks], type=pa.string()),
        "source_file": pa.array([c["source_file"] for c in all_chunks], type=pa.string()),
        "chunk_index": pa.array([c["chunk_index"] for c in all_chunks], type=pa.int32()),
        "vector": pa.array([c["vector"] for c in all_chunks],
                           type=pa.list_(pa.float32(), VECTOR_DIM)),
    }
    pa_table = pa.Table.from_pydict(arrays, schema=schema)
    table.add(pa_table)
    print(f"✅ LanceDB 写入完成: {len(all_chunks)} 条记录")

    # 写 metadata.json
    metadata = {
        "version": "1.1.0",
        "build_time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_chunks": len(all_chunks),
        "total_files": files_count,
        "embedding_model": EMBEDDING_MODEL,
        "vector_dim": VECTOR_DIM,
        "chunk_size": CHUNK_SIZE,
        "chunk_overlap": CHUNK_OVERLAP,
        "sanitized": True,
        "sanitize_level": "medium",
        "source_label": "勺子Claw整合的餐饮行业经验",
    }
    metadata_path = OUTPUT_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2),
                              encoding="utf-8")
    print(f"✅ metadata.json 写入: {metadata_path}")

    total_size = sum(f.stat().st_size for f in OUTPUT_DIR.rglob("*") if f.is_file())
    print(f"\n📦 索引产物总体积: {total_size/1024/1024:.1f} MB")
    print("=" * 60)
    print("🎉 知识库索引构建完成！")
    print("=" * 60)


def parse_all_files() -> List[Dict[str, Any]]:
    """阶段1：解析所有文件并分块"""
    files = []
    for ext in ("*.pdf", "*.PDF", "*.docx", "*.DOCX"):
        files.extend(KB_SOURCE_DIR.rglob(ext))
    files = [f for f in files
             if not f.name.startswith("._")
             and not f.name.startswith(".DS_Store")
             and not f.name.startswith("~$")]
    files = sorted(set(files))
    print(f"📁 发现 {len(files)} 个文档（已过滤元数据/锁文件）")

    all_chunks = []
    for i, filepath in enumerate(files):
        suffix = filepath.suffix.lower()
        if suffix == ".pdf":
            text = extract_text_from_pdf(filepath)
        elif suffix == ".docx":
            text = extract_text_from_docx(filepath)
        else:
            continue
        if not text or len(text) < 50:
            continue
        chunks = chunk_text(text)
        category, subcategory = categorize_file(filepath.name)
        for idx, chunk in enumerate(chunks):
            all_chunks.append({
                "text": chunk,
                "skill_name": "knowledge-base",
                "category": category,
                "subcategory": subcategory,
                "source_file": filepath.name,
                "chunk_index": idx,
            })
        if (i + 1) % 50 == 0:
            print(f"  📄 已解析 {i+1}/{len(files)} 文件, 累计 {len(all_chunks)} 块")

    print(f"\n✅ 解析完成: {len(all_chunks)} 个文本块")
    return all_chunks


def embed_all_concurrent(all_chunks: List[Dict[str, Any]]):
    """阶段2：并发向量化 + 断点续传

    将每个 batch 的 vectors 直接写入 chunk["vector"]。支持中断后从缓存恢复。
    """
    total = len(all_chunks)
    total_batches = math.ceil(total / BATCH_SIZE)

    # 加载断点
    completed_batches = set()
    if VECTORS_CACHE.exists():
        try:
            with open(VECTORS_CACHE, "rb") as f:
                cache = pickle.load(f)
            for batch_idx, vectors in cache.items():
                batch_start = batch_idx * BATCH_SIZE
                for i, vec in enumerate(vectors):
                    if batch_start + i < total:
                        all_chunks[batch_start + i]["vector"] = vec
                completed_batches.add(batch_idx)
            print(f"📦 命中向量化断点: 已恢复 {len(completed_batches)} 批，{len(completed_batches)*BATCH_SIZE} 块")
        except Exception as e:
            print(f"⚠️ 断点缓存损坏，重新开始: {e}")
            completed_batches = set()

    pending = [b for b in range(total_batches) if b not in completed_batches]
    if not pending:
        print("✅ 所有批次已完成（命中完整缓存）")
        return

    print(f"📋 待处理 {len(pending)}/{total_batches} 批")

    start_time = time.time()
    done_counter = {"n": len(completed_batches) * BATCH_SIZE}
    save_lock = threading.Lock()
    cache = {b: [v["vector"] for v in all_chunks[b*BATCH_SIZE:(b+1)*BATCH_SIZE]]
             for b in completed_batches}

    def process_batch(batch_idx: int):
        batch_start = batch_idx * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, total)
        texts = [all_chunks[i]["text"] for i in range(batch_start, batch_end)]
        vectors = embed_batch(texts)
        for i, vec in enumerate(vectors):
            all_chunks[batch_start + i]["vector"] = vec
        return batch_idx, vectors

    last_save_count = len(completed_batches)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {executor.submit(process_batch, b): b for b in pending}
        for future in as_completed(futures):
            try:
                batch_idx, vectors = future.result()
            except Exception as e:
                print(f"  ❌ 批次异常: {e}")
                continue

            with save_lock:
                cache[batch_idx] = vectors
                done_counter["n"] += len(vectors)
                done = done_counter["n"]

                # 进度报告
                if (done // BATCH_SIZE) % 10 == 0 or done >= total:
                    elapsed = time.time() - start_time
                    new_done = done - len(completed_batches) * BATCH_SIZE
                    rate = new_done / elapsed if elapsed > 0 else 0
                    eta = (total - done) / rate if rate > 0 else 0
                    print(f"  ⏱️  {done}/{total} | 速度 {rate:.1f} chunk/s | 剩余 {eta/60:.1f} 分钟")

                # 定期落盘断点
                if len(cache) - last_save_count >= SAVE_EVERY_BATCHES:
                    try:
                        with open(VECTORS_CACHE, "wb") as f:
                            pickle.dump(cache, f)
                        last_save_count = len(cache)
                    except Exception as e:
                        print(f"  ⚠️ 断点落盘失败: {e}")

    # 最后落盘
    try:
        with open(VECTORS_CACHE, "wb") as f:
            pickle.dump(cache, f)
    except Exception as e:
        print(f"⚠️ 最终断点落盘失败: {e}")

    print(f"\n✅ 向量化完成，总耗时 {(time.time()-start_time)/60:.1f} 分钟")


if __name__ == "__main__":
    build_index()
