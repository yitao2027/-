#!/usr/bin/env python3
"""冒烟测试：只跑前2个PDF + 1个DOCX，验证全链路正常"""
import sys
sys.path.insert(0, r"C:\Users\Administrator\WorkBuddy\20260513150254\shaoziclaw-app\tools")
import build_kb_index as M
from pathlib import Path

# 收集前2 PDF + 1 DOCX
files = sorted(M.KB_SOURCE_DIR.rglob("*.pdf"))[:2]
files += sorted(M.KB_SOURCE_DIR.rglob("*.docx"))[:1]
print(f"测试文件: {[f.name for f in files]}")

# 解析 + 分块
chunks = []
for fp in files:
    if fp.suffix.lower() == ".pdf":
        text = M.extract_text_from_pdf(fp)
    else:
        text = M.extract_text_from_docx(fp)
    print(f"\n文件: {fp.name}")
    print(f"  文本长度: {len(text)}")
    if text:
        cs = M.chunk_text(text)
        print(f"  分块数: {len(cs)}")
        if cs:
            print(f"  首块预览: {cs[0][:80]}...")
        cat, sub = M.categorize_file(fp.name)
        print(f"  分类: {cat}/{sub}")
        for idx, c in enumerate(cs[:3]):  # 取前3块测试
            chunks.append({
                "text": c, "skill_name": "knowledge-base",
                "category": cat, "subcategory": sub,
                "source_file": fp.name, "chunk_index": idx,
            })

print(f"\n总测试块数: {len(chunks)}")

# 调一次embed
if chunks:
    print("\n调用硅基流动 bge-m3 测试...")
    texts = [c["text"] for c in chunks[:5]]
    vecs = M.embed_batch(texts)
    print(f"返回 {len(vecs)} 个向量, 第一个维度: {len(vecs[0])}")
    print(f"前5维: {vecs[0][:5]}")
    if all(v == 0.0 for v in vecs[0]):
        print("⚠️ 警告：返回全零向量，API 可能失败")
    else:
        print("✅ 向量化成功")
