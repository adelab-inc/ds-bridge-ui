"""Firestore → Supabase DB 마이그레이션 스크립트

chat_rooms, chat_messages 컬렉션을 Supabase Postgres로 복사.
"""

import os
import sys

import firebase_admin
from firebase_admin import credentials, firestore
from supabase import create_client

# ── Firebase 초기화 ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_KEY = os.path.join(SCRIPT_DIR, "..", "service-account-key.json")

cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Supabase 초기화 ──────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BATCH_SIZE = 500


def migrate_rooms():
    """chat_rooms 컬렉션 마이그레이션"""
    print("── chat_rooms 마이그레이션 ──")
    docs = list(db.collection("chat_rooms").stream())
    print(f"  Firestore에서 {len(docs)}개 문서 로드")

    rows = []
    for doc in docs:
        data = doc.to_dict()
        rows.append({
            "id": data.get("id", doc.id),
            "storybook_url": data.get("storybook_url", ""),
            "schema_key": data.get("schema_key", "exports/default/component-schema.json"),
            "user_id": data.get("user_id", "anonymous"),
            "created_at": data.get("created_at", 0),
        })

    # 배치 단위 upsert
    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        result = supabase.table("chat_rooms").upsert(batch, on_conflict="id").execute()
        inserted += len(batch)
        print(f"  [{inserted}/{len(rows)}] 업로드 완료")

    print(f"  ✓ chat_rooms {inserted}개 완료\n")
    return inserted


def migrate_messages():
    """chat_messages 컬렉션 마이그레이션"""
    print("── chat_messages 마이그레이션 ──")
    docs = list(db.collection("chat_messages").stream())
    print(f"  Firestore에서 {len(docs)}개 문서 로드")

    rows = []
    for doc in docs:
        data = doc.to_dict()
        # image_urls: Firestore에서는 list 또는 없음
        image_urls = data.get("image_urls", [])
        if image_urls is None:
            image_urls = []

        rows.append({
            "id": data.get("id", doc.id),
            "room_id": data["room_id"],
            "question": data.get("question", ""),
            "text": data.get("text", ""),
            "content": data.get("content", ""),
            "path": data.get("path", ""),
            "question_created_at": data.get("question_created_at", 0),
            "answer_created_at": data.get("answer_created_at", 0),
            "status": data.get("status", "DONE"),
            "image_urls": image_urls,
        })

    # 배치 단위 upsert
    inserted = 0
    errors = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        try:
            result = supabase.table("chat_messages").upsert(batch, on_conflict="id").execute()
            inserted += len(batch)
            print(f"  [{inserted}/{len(rows)}] 업로드 완료")
        except Exception as e:
            # FK 오류 등 개별 처리
            errors_in_batch = 0
            for row in batch:
                try:
                    supabase.table("chat_messages").upsert(row, on_conflict="id").execute()
                    inserted += 1
                except Exception as row_e:
                    errors += 1
                    print(f"  ✗ {row['id']}: {row_e}")
            print(f"  [{inserted}/{len(rows)}] (배치 에러 → 개별 처리)")

    print(f"  ✓ chat_messages {inserted}개 완료, {errors}개 에러\n")
    return inserted, errors


def main():
    print("Firestore → Supabase DB 마이그레이션 시작\n")

    rooms = migrate_rooms()
    msgs, msg_errors = migrate_messages()

    print("=" * 60)
    print(f"결과: chat_rooms {rooms}개, chat_messages {msgs}개 (에러 {msg_errors}개)")


if __name__ == "__main__":
    main()
