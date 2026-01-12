# @ds-hub/shared-types

> Firebase 설정 및 타입을 TypeScript와 Python 간 공유하는 패키지

## 개요

이 패키지는 **Single Source of Truth** 원칙으로 Firebase 관련 설정을 관리합니다.

- ✅ JSON 파일이 유일한 소스
- ✅ TypeScript와 Python 코드는 자동 생성
- ✅ 불일치 방지 및 타입 안전성 보장

## 구조

```
packages/shared-types/
├── firebase/                    # 📝 Single Source of Truth
│   ├── collections.json         # Firestore 컬렉션명
│   └── storage.json             # Storage 경로
│
├── scripts/                     # 🔧 코드 생성 스크립트
│   ├── generate-typescript.js
│   └── generate-python.py
│
├── typescript/firebase/         # 🔷 자동 생성 (TypeScript)
│   ├── collections.ts
│   ├── storage.ts
│   └── index.ts
│
└── python/firebase/             # 🐍 자동 생성 (Python)
    ├── collections.py
    ├── storage.py
    └── __init__.py
```

## 사용 방법

### 1. 값 추가/수정

**firebase/collections.json 또는 storage.json 편집**

컬렉션 이름만 정의하거나, 선택적으로 `schema` 필드를 추가하여 문서 타입도 함께 정의할 수 있습니다.

```json
{
  "collections": {
    "users": {
      "name": "users",
      "description": "User profiles and authentication data",
      "schema": {
        "id": {
          "type": "string",
          "required": true,
          "description": "User unique identifier"
        },
        "email": {
          "type": "string",
          "required": true,
          "description": "User email address"
        },
        "role": {
          "type": "enum",
          "values": ["admin", "user", "guest"],
          "required": true,
          "description": "User role"
        },
        "created_at": {
          "type": "timestamp",
          "required": false,
          "description": "Account creation timestamp"
        }
      }
    }
  }
}
```

**지원하는 타입:**
- `string` → TypeScript: `string`, Python: `str`
- `boolean` → TypeScript: `boolean`, Python: `bool`
- `number` → TypeScript: `number`, Python: `float`
- `timestamp` → TypeScript: `Timestamp`, Python: `datetime`
- `enum` → TypeScript: Union type, Python: `Literal`

### 2. 코드 생성

```bash
# 모노레포 루트에서
cd packages/shared-types

# TypeScript + Python 모두 생성
pnpm gen:firebase-types

# 또는 개별 생성
pnpm gen:firebase-types:ts   # TypeScript만
pnpm gen:firebase-types:py   # Python만
```

### 3. TypeScript에서 사용 (apps/web)

```typescript
import { 
  COLLECTIONS, 
  STORAGE_PATHS,
  ChatRoomsDocument,
  ChatMessagesDocument 
} from '@ds-hub/shared-types/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Firestore 사용 - 타입 안전하게
const chatRoomsRef = collection(db, COLLECTIONS.CHAT_ROOMS);

const newRoom: ChatRoomsDocument = {
  id: 'room-123',
  storybook_url: 'https://storybook.example.com',
  user_id: 'user-456'
};

await addDoc(chatRoomsRef, newRoom);

// 타입 체크가 작동합니다
const invalidRoom: ChatRoomsDocument = {
  id: 'room-123',
  // ❌ 타입 에러: storybook_url이 없음
  user_id: 'user-456'
};

// Storage 사용
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const storageRef = ref(storage, `${STORAGE_PATHS.SCREENSHOTS}/image.png`);
```

### 4. Python에서 사용 (apps/ai-service)

**방법 A: PYTHONPATH 설정**

```python
# apps/ai-service/main.py
import sys
from pathlib import Path

# 모노레포 packages 추가
monorepo_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(monorepo_root / "packages" / "shared-types" / "python"))

# Import - 타입 포함
from firebase.collections import (
    Collections,
    ChatRoomsDocument,
    ChatMessagesDocument
)
from firebase.storage import StoragePaths

# Firestore 사용 - 타입 안전하게
from firebase_admin import firestore
db = firestore.client()

chat_rooms_ref = db.collection(Collections.CHAT_ROOMS)

new_room: ChatRoomsDocument = {
    "id": "room-123",
    "storybook_url": "https://storybook.example.com",
    "user_id": "user-456"
}

chat_rooms_ref.add(new_room)

# Storage 사용
from firebase_admin import storage
bucket = storage.bucket()
blob = bucket.blob(f"{StoragePaths.SCREENSHOTS}/image.png")
```

**방법 B: 로컬 패키지 설치 (권장)**

```bash
# apps/ai-service/requirements.txt
-e ../../packages/shared-types/python
```

```bash
cd apps/ai-service
pip install -r requirements.txt
```

그러면 import가 더 간단해집니다:

```python
from firebase.collections import Collections
from firebase.storage import StoragePaths
```

## 현재 정의된 값

### Collections (Firestore)

| 상수 | 값 | 설명 | Document Type |
|------|-----|------|---------------|
| `CHAT_ROOMS` | `chat_rooms` | Chat room metadata | `ChatRoomsDocument` ✅ |
| `CHAT_MESSAGES` | `chat_messages` | Individual messages within chat sessions | `ChatMessagesDocument` ✅ |

✅ = schema가 정의되어 TypeScript/Python 타입이 자동 생성됨

### Storage Paths

| 상수 | 값 | 설명 |
|------|-----|------|
| `SCREENSHOTS` | `screenshots` | Component screenshots from Storybook |
| `ASSETS` | `assets` | Design system assets (icons, images) |
| `USER_UPLOADS` | `user_uploads` | User uploaded files |
| `EXPORTS` | `exports` | Generated export files (code, specs) |

## 개발 워크플로우

### 새 컬렉션 추가 시

1. `firebase/collections.json` 편집
2. `pnpm gen:firebase-types` 실행
3. Git에 커밋 (JSON + 생성된 파일 모두)

### 생성된 파일은 Git에 포함

```gitignore
# ❌ .gitignore에 추가하지 마세요
# typescript/firebase/
# python/firebase/
```

생성된 파일도 Git에 포함시켜야 합니다:
- CI/CD에서 별도 생성 불필요
- 코드 리뷰 시 변경사항 확인 가능

## 주의사항

⚠️ **생성된 파일을 직접 수정하지 마세요**

```typescript
// ❌ 직접 수정 금지
// typescript/firebase/collections.ts
export const COLLECTIONS = {
  USERS: 'users-modified'  // 다음 generate 시 덮어씌워짐
}
```

✅ **JSON 파일만 수정**

```json
// ✅ 여기만 수정
// firebase/collections.json
{
  "collections": {
    "users": {
      "name": "users-modified"
    }
  }
}
```

## 타입 안전성

### TypeScript

```typescript
import { COLLECTIONS, CollectionName } from '@ds-hub/shared-types/firebase';

// 타입 체크됨
const collection: CollectionName = COLLECTIONS.USERS; // ✅
const invalid: CollectionName = 'invalid'; // ❌ 타입 에러
```

### Python

```python
from firebase.collections import Collections

# 자동완성 지원
Collections.USERS      # ✅
Collections.INVALID    # ❌ AttributeError
```

## 문제 해결

### 생성 실패 시

```bash
# JSON 문법 확인
cat firebase/collections.json | jq .

# 스크립트 권한 확인
chmod +x scripts/*.js scripts/*.py
```

### Import 실패 시 (Python)

```bash
# PYTHONPATH 확인
echo $PYTHONPATH

# 또는 패키지 재설치
cd apps/ai-service
pip install -e ../../packages/shared-types/python
```

## 참고

- 모든 생성 파일은 헤더에 `AUTO-GENERATED` 경고 포함
- JSON 스키마는 IDE 자동완성 지원
- 새 값 추가 시 반드시 `generate` 실행 필요
