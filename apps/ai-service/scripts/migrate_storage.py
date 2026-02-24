"""Firebase Storage → Supabase Storage 마이그레이션 스크립트"""

import os
import sys
import mimetypes

import firebase_admin
from firebase_admin import credentials, storage as fb_storage
from supabase import create_client

# ── Firebase 초기화 ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_KEY = os.path.join(SCRIPT_DIR, "..", "service-account-key.json")
FIREBASE_BUCKET = "ds-runtime-hub.firebasestorage.app"

cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
firebase_admin.initialize_app(cred, {"storageBucket": FIREBASE_BUCKET})
bucket = fb_storage.bucket()

# ── Supabase 초기화 ──────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 버킷 매핑 ───────────────────────────────────────────────────
BUCKET_MAP = {
    "exports/": "exports",
    "user_uploads/": "user-uploads",
}


def resolve_bucket(path: str) -> tuple[str, str]:
    for prefix, bucket_name in BUCKET_MAP.items():
        if path.startswith(prefix):
            return bucket_name, path[len(prefix) :]
    return "exports", path


def guess_content_type(path: str) -> str:
    ct, _ = mimetypes.guess_type(path)
    return ct or "application/octet-stream"


def main():
    # Firebase에서 전체 파일 목록
    blobs = list(bucket.list_blobs())
    print(f"Firebase에 {len(blobs)}개 객체 발견")

    skipped = 0
    uploaded = 0
    errors = []

    for i, blob in enumerate(blobs, 1):
        name = blob.name
        # 디렉터리 플레이스홀더 스킵
        if name.endswith("/") or blob.size == 0:
            skipped += 1
            continue

        bucket_name, path_in_bucket = resolve_bucket(name)
        content_type = guess_content_type(name)

        print(f"[{i}/{len(blobs)}] {name} → {bucket_name}/{path_in_bucket} ", end="")
        sys.stdout.flush()

        try:
            # Firebase에서 다운로드
            data = blob.download_as_bytes()

            # Supabase에 업로드
            supabase.storage.from_(bucket_name).upload(
                path_in_bucket,
                data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            uploaded += 1
            print(f"✓ ({len(data)} bytes)")
        except Exception as e:
            errors.append((name, str(e)))
            print(f"✗ {e}")

    print(f"\n{'='*60}")
    print(f"완료: {uploaded} 업로드 / {skipped} 스킵 / {len(errors)} 에러")
    if errors:
        print("\n에러 목록:")
        for name, err in errors:
            print(f"  - {name}: {err}")


if __name__ == "__main__":
    main()
