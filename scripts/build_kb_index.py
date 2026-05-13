#!/usr/bin/env python3
"""
勺子Claw v5.1 — 知识库向量索引构建工具

将 ~/.workbuddy/knowledge-base/catering/ 下的 SKILL.md 和参考 Markdown 文件
分块 → 向量化（硅基流动 BAAI/bge-m3）→ 存入 LanceDB → 导出 .lance 索引

Usage:
    python3 build_kb_index.py [--api-key YOUR_KEY] [--output-dir ./knowledge-base-index]
"""

import os
import sys
import json
import re
import hashlib
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

import requests

# ============================================================================
# Configuration
# ============================================================================

SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/embeddings"
EMBEDDING_MODEL = "BAAI/bge-m3"
VECTOR_DIM = 1024
CHUNK_SIZE = 512       # approximate tokens per chunk
CHUNK_OVERLAP = 64     # overlap tokens between chunks
BATCH_SIZE = 20        # max texts per API call
TOP_K = 5             # default retrieval count
MIN_CHUNK_CHARS = 50   # skip chunks shorter than this

# Default API key (free tier Silicon Flow)
DEFAULT_API_KEY = os.environ.get("SILICONFLOW_API_KEY", "sk-xxxxxxxxxxxxxxxxxxxxxxxx")

# Source directories
KB_ROOT = Path.home() / ".workbuddy" / "knowledge-base" / "catering"


# ============================================================================
# File Discovery
# ============================================================================

def discover_skill_files() -> List[Dict[str, str]]:
    """Discover all SKILL.md files with metadata."""
    files = []
    for category_dir in sorted(KB_ROOT.iterdir()):
        if not category_dir.is_dir() or category_dir.name.startswith("_"):
            continue
        category = category_dir.name  # e.g. "L1部门基础"

        for skill_dir in sorted(category_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                files.append({
                    "path": str(skill_md),
                    "skill_name": skill_dir.name,
                    "category": category,
                    "source_type": "skill",
                })

                # Also check for reference markdown files
                ref_md_dir = skill_dir / "references" / "md"
                if ref_md_dir.exists():
                    for ref_file in sorted(ref_md_dir.iterdir()):
                        if ref_file.suffix == ".md" and ref_file.name != "README.md":
                            files.append({
                                "path": str(ref_file),
                                "skill_name": skill_dir.name,
                                "category": category,
                                "source_type": "reference",
                            })
    return files


# ============================================================================
# Text Chunking
# ============================================================================

def read_file_content(filepath: str) -> str:
    """Read file with UTF-8 encoding."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"  ⚠️  Failed to read {filepath}: {e}")
        return ""


def extract_frontmatter(content: str) -> tuple:
    """Extract YAML-like frontmatter from SKILL.md, return (frontmatter_dict, body)."""
    # Match the section between first "---" markers
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            fm_text = content[3:end].strip()
            body = content[end+3:].strip()
            # Parse simple key-value pairs
            fm = {}
            for line in fm_text.split("\n"):
                if ":" in line:
                    key, _, value = line.partition(":")
                    fm[key.strip()] = value.strip().strip("*")
            return fm, body
    return {}, content


def chunk_markdown(content: str, source_name: str) -> List[Dict[str, Any]]:
    """
    Split markdown into chunks respecting heading boundaries.
    Each chunk preserves its heading context.
    """
    chunks = []

    # Split by ## or ### headings
    sections = re.split(r'\n(?=#{1,3}\s)', content)

    current_heading = source_name
    buffer = ""

    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Check if this section starts with a heading
        heading_match = re.match(r'^(#{1,3})\s+(.+)', section)
        if heading_match:
            current_heading = heading_match.group(2).strip()

        buffer += "\n" + section

        # Estimate token count (rough: Chinese chars = 1 token, English words = 1 token)
        estimated_tokens = estimate_tokens(buffer)

        if estimated_tokens >= CHUNK_SIZE:
            # Split buffer into chunks
            sub_chunks = split_text_to_chunks(buffer, CHUNK_SIZE, CHUNK_OVERLAP)

            for i, chunk_text in enumerate(sub_chunks):
                if len(chunk_text.strip()) < MIN_CHUNK_CHARS:
                    continue

                chunks.append({
                    "text": chunk_text.strip(),
                    "heading": current_heading,
                    "chunk_index": len(chunks),
                })

            # Keep overlap for next iteration
            if sub_chunks:
                buffer = sub_chunks[-1][-CHUNK_OVERLAP * 2:]  # rough char overlap
            else:
                buffer = ""

    # Don't forget remaining buffer
    if len(buffer.strip()) >= MIN_CHUNK_CHARS:
        chunks.append({
            "text": buffer.strip(),
            "heading": current_heading,
            "chunk_index": len(chunks),
        })

    return chunks


def estimate_tokens(text: str) -> int:
    """Rough token estimation for mixed Chinese/English text."""
    # Chinese characters: ~1 token each
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    # English words: ~1 token each
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    return chinese_chars + english_words


def split_text_to_chunks(text: str, max_tokens: int, overlap_tokens: int) -> List[str]:
    """Split text into chunks of approximately max_tokens."""
    # Simple character-based splitting (rough approximation)
    # Average Chinese char ~1 token, English word ~1.3 tokens
    avg_chars_per_token = 1.5
    max_chars = int(max_tokens * avg_chars_per_token)
    overlap_chars = int(overlap_tokens * avg_chars_per_token)

    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))

        # Try to break at a paragraph or sentence boundary
        if end < len(text):
            # Look for paragraph break
            para_break = text.rfind("\n\n", start, end)
            if para_break > start + max_chars // 2:
                end = para_break + 2
            else:
                # Look for sentence break
                sentence_break = text.rfind("。", start, end)
                if sentence_break > start + max_chars // 2:
                    end = sentence_break + 1

        chunks.append(text[start:end])
        start = end - overlap_chars
        if start >= len(text):
            break

    return chunks


# ============================================================================
# Embedding
# ============================================================================

def embed_texts(texts: List[str], api_key: str) -> List[List[float]]:
    """Call Silicon Flow embedding API for a batch of texts."""
    if not texts:
        return []

    payload = {
        "model": EMBEDDING_MODEL,
        "input": texts,
        "encoding_format": "float",
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            SILICONFLOW_API_URL,
            json=payload,
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        # Sort by index to ensure correct order
        embeddings = sorted(data["data"], key=lambda x: x["index"])
        return [e["embedding"] for e in embeddings]

    except requests.exceptions.Timeout:
        print(f"  ⚠️  Embedding API timeout (batch of {len(texts)})")
        return [[] for _ in texts]
    except requests.exceptions.HTTPError as e:
        print(f"  ⚠️  Embedding API error: {e.response.status_code} {e.response.text[:200]}")
        return [[] for _ in texts]
    except Exception as e:
        print(f"  ⚠️  Embedding API failed: {e}")
        return [[] for _ in texts]


def embed_all_chunks(all_chunks: List[Dict], api_key: str) -> List[Dict]:
    """Embed all chunks in batches, adding vectors to chunk dicts."""
    print(f"\n🧮 Embedding {len(all_chunks)} chunks with {EMBEDDING_MODEL}...")

    # Collect all texts
    texts = [c["text"] for c in all_chunks]
    all_embeddings = []

    # Process in batches
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i+BATCH_SIZE]
        batch_embeddings = embed_texts(batch, api_key)
        all_embeddings.extend(batch_embeddings)

        # Progress
        done = min(i + BATCH_SIZE, len(texts))
        if done % 50 == 0 or done == len(texts):
            print(f"  Progress: {done}/{len(texts)} chunks embedded")

    # Add vectors to chunks, filter out failed embeddings
    embedded_chunks = []
    failed = 0
    for chunk, embedding in zip(all_chunks, all_embeddings):
        if embedding and len(embedding) == VECTOR_DIM:
            chunk["vector"] = embedding
            embedded_chunks.append(chunk)
        else:
            failed += 1

    if failed > 0:
        print(f"  ⚠️  {failed} chunks failed to embed, skipping")

    print(f"  ✅ Successfully embedded {len(embedded_chunks)} chunks")
    return embedded_chunks


# ============================================================================
# LanceDB Index Build
# ============================================================================

def build_lance_table(chunks: List[Dict], output_dir: Path):
    """Build LanceDB table from embedded chunks and save to disk."""
    import pyarrow as pa
    import lancedb

    print(f"\n💾 Building LanceDB index with {len(chunks)} chunks...")

    # Prepare data for Arrow table
    vectors = []
    texts = []
    skill_names = []
    categories = []
    subcategories = []
    source_files = []
    chunk_indices = []
    headings = []
    source_types = []

    for chunk in chunks:
        vectors.append(chunk["vector"])
        texts.append(chunk["text"])
        skill_names.append(chunk["skill_name"])
        categories.append(chunk["category"])
        subcategories.append(chunk.get("subcategory", ""))
        source_files.append(chunk["source_file_short"])
        chunk_indices.append(chunk["chunk_index"])
        headings.append(chunk["heading"])
        source_types.append(chunk["source_type"])

    # Create Arrow schema
    schema = pa.schema([
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
        pa.field("text", pa.string()),
        pa.field("skill_name", pa.string()),
        pa.field("category", pa.string()),
        pa.field("subcategory", pa.string()),
        pa.field("source_file", pa.string()),
        pa.field("chunk_index", pa.int32()),
        pa.field("heading", pa.string()),
        pa.field("source_type", pa.string()),
    ])

    # Create Arrow table
    table = pa.table({
        "vector": vectors,
        "text": texts,
        "skill_name": skill_names,
        "category": categories,
        "subcategory": subcategories,
        "source_file": source_files,
        "chunk_index": chunk_indices,
        "heading": headings,
        "source_type": source_types,
    }, schema=schema)

    # Connect to LanceDB and create table
    lance_dir = output_dir / "kb_vectors.lance"
    os.makedirs(lance_dir, exist_ok=True)

    db = lancedb.connect(str(lance_dir))
    # Drop existing table if any
    existing_tables = db.table_names()
    if "knowledge" in existing_tables:
        db.drop_table("knowledge")

    db.create_table("knowledge", table)
    row_count = db.open_table("knowledge").count_rows()
    print(f"  ✅ LanceDB table created: {row_count} rows")

    return row_count


def generate_metadata(output_dir: Path, total_chunks: int, total_skills: int,
                      total_references: int, file_hashes: Dict[str, str], api_key_used: str):
    """Generate metadata.json for the index."""
    metadata = {
        "version": "1.0.0",
        "embedding_model": EMBEDDING_MODEL,
        "vector_dim": VECTOR_DIM,
        "total_chunks": total_chunks,
        "total_skills": total_skills,
        "total_references": total_references,
        "build_date": datetime.now().isoformat(),
        "build_platform": sys.platform,
        "chunk_size": CHUNK_SIZE,
        "chunk_overlap": CHUNK_OVERLAP,
        "file_hashes": file_hashes,
        "api_key_prefix": api_key_used[:8] + "...",
    }

    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"  ✅ Metadata saved: {metadata_path}")
    return metadata


# ============================================================================
# Main Pipeline
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Build knowledge base vector index for ShaoziClaw")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Silicon Flow API key")
    parser.add_argument("--output-dir", default="./knowledge-base-index", help="Output directory")
    parser.add_argument("--skip-embed", action="store_true", help="Skip embedding (for testing chunking)")
    parser.add_argument("--dry-run", action="store_true", help="Only discover files and chunk, don't embed")
    args = parser.parse_args()

    api_key = args.api_key
    output_dir = Path(args.output_dir).resolve()
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("勺子Claw v5.1 — 知识库向量索引构建工具")
    print("=" * 60)
    print(f"  Embedding: {EMBEDDING_MODEL} ({VECTOR_DIM}d)")
    print(f"  KB Root:   {KB_ROOT}")
    print(f"  Output:    {output_dir}")
    print(f"  API Key:   {api_key[:8]}...")
    print()

    # Step 1: Discover files
    print("📂 Step 1: Discovering knowledge base files...")
    files = discover_skill_files()
    skill_files = [f for f in files if f["source_type"] == "skill"]
    ref_files = [f for f in files if f["source_type"] == "reference"]
    print(f"  Found: {len(skill_files)} SKILL.md + {len(ref_files)} reference .md = {len(files)} total")

    if not files:
        print("❌ No files found! Check KB_ROOT path.")
        sys.exit(1)

    # Step 2: Read and chunk
    print(f"\n✂️  Step 2: Chunking {len(files)} files...")
    all_chunks = []
    file_hashes = {}

    for i, file_info in enumerate(files):
        filepath = file_info["path"]
        content = read_file_content(filepath)
        if not content:
            continue

        # Calculate file hash for incremental updates
        file_hashes[filepath] = hashlib.md5(content.encode()).hexdigest()

        # Extract frontmatter for skills
        if file_info["source_type"] == "skill":
            fm, body = extract_frontmatter(content)
            chunk_content = body if body else content
        else:
            fm = {}
            chunk_content = content

        # Parse category/subcategory from directory path
        parts = Path(filepath).parts
        category = file_info["category"]
        subcategory = file_info["skill_name"]

        # Chunk the content
        chunks = chunk_markdown(chunk_content, subcategory)

        for chunk in chunks:
            chunk["skill_name"] = subcategory
            chunk["category"] = category
            chunk["subcategory"] = fm.get("分类", "")
            chunk["source_file_short"] = Path(filepath).name
            chunk["source_file"] = filepath
            chunk["source_type"] = file_info["source_type"]
            all_chunks.append(chunk)

        if (i + 1) % 20 == 0 or (i + 1) == len(files):
            print(f"  Processed: {i+1}/{len(files)} files → {len(all_chunks)} chunks")

    print(f"  ✅ Total: {len(all_chunks)} chunks from {len(files)} files")

    if args.dry_run:
        print("\n🔍 Dry run complete. Sample chunks:")
        for chunk in all_chunks[:3]:
            print(f"\n  [{chunk['skill_name']}] {chunk['heading']}")
            print(f"  {chunk['text'][:100]}...")
        return

    # Step 3: Embed
    if args.skip_embed:
        print("\n⏭️  Skipping embedding (--skip-embed)")
        # Create dummy vectors for testing
        for chunk in all_chunks:
            chunk["vector"] = [0.0] * VECTOR_DIM
    else:
        embedded_chunks = embed_all_chunks(all_chunks, api_key)
        if not embedded_chunks:
            print("❌ No chunks were embedded successfully!")
            sys.exit(1)
        all_chunks = embedded_chunks

    # Step 4: Build LanceDB
    total_chunks = build_lance_table(all_chunks, output_dir)

    # Step 5: Generate metadata
    metadata = generate_metadata(
        output_dir,
        total_chunks=total_chunks,
        total_skills=len(skill_files),
        total_references=len(ref_files),
        file_hashes=file_hashes,
        api_key_used=api_key,
    )

    # Summary
    print("\n" + "=" * 60)
    print("✅ Build complete!")
    print(f"  Index:    {output_dir / 'kb_vectors.lance'}")
    print(f"  Metadata: {output_dir / 'metadata.json'}")
    print(f"  Chunks:   {total_chunks}")
    print(f"  Version:  {metadata['version']}")
    print("=" * 60)

    # Quick retrieval test
    if not args.skip_embed:
        print("\n🧪 Quick retrieval test...")
        import lancedb
        db = lancedb.connect(str(output_dir / "kb_vectors.lance"))
        table = db.open_table("knowledge")
        print(f"  Table rows: {table.count_rows()}")
        print("  ✅ Index is ready for queries")


if __name__ == "__main__":
    main()
