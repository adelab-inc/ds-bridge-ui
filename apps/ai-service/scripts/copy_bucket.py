"""
Supabase Storage 버킷 간 파일 복사 스크립트

Usage:
    # exports/default → dev-exports/default 복사
    uv run python scripts/copy_bucket.py exports dev-exports default

    # exports 전체 → dev-exports 전체 복사
    uv run python scripts/copy_bucket.py exports dev-exports

    # user-uploads → dev-user-uploads 복사
    uv run python scripts/copy_bucket.py user-uploads dev-user-uploads
"""

import asyncio
import sys

from dotenv import load_dotenv
from supabase import acreate_client

load_dotenv()

import os

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


async def list_files_recursive(client, bucket: str, folder: str = "") -> list[str]:
    """버킷 내 모든 파일 경로를 재귀적으로 수집"""
    paths: list[str] = []
    items = await client.storage.from_(bucket).list(folder)

    for item in items:
        name = item.get("name", "")
        item_id = item.get("id")
        current_path = f"{folder}/{name}" if folder else name

        if item_id is None:
            # 폴더 → 재귀
            sub_paths = await list_files_recursive(client, bucket, current_path)
            paths.extend(sub_paths)
        else:
            # 파일
            paths.append(current_path)

    return paths


async def copy_bucket(
    src_bucket: str,
    dst_bucket: str,
    prefix: str = "",
) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요")
        sys.exit(1)

    client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"\n📦 {src_bucket}/{prefix or '*'} → {dst_bucket}/{prefix or '*'}\n")

    # 파일 목록 수집
    files = await list_files_recursive(client, src_bucket, prefix)
    if not files:
        print("파일이 없습니다.")
        return

    print(f"총 {len(files)}개 파일 발견\n")

    success = 0
    failed = 0

    for path in files:
        try:
            # 다운로드
            content = await client.storage.from_(src_bucket).download(path)

            # 업로드 (upsert)
            await client.storage.from_(dst_bucket).upload(
                path, content, {"x-upsert": "true"}
            )

            print(f"  ✅ {path}")
            success += 1
        except Exception as e:
            print(f"  ❌ {path} — {e}")
            failed += 1

    print(f"\n완료: {success}개 성공, {failed}개 실패")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/copy_bucket.py <src_bucket> <dst_bucket> [prefix]")
        print("  예: python scripts/copy_bucket.py exports dev-exports default")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]
    pfx = sys.argv[3] if len(sys.argv) > 3 else ""

    asyncio.run(copy_bucket(src, dst, pfx))
