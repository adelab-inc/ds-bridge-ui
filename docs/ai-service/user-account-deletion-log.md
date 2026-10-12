# 회원 계정 삭제 기록 (운영 로그)

- 대상: Supabase `auth.users` (프로젝트 `mubfjdkrfpkbjlinwkny`)
- 종류: 운영 작업 기록 — 삭제할 때마다 아래 "처리 이력"에 행을 추가한다.
- 최초 작성: 2026-10-12

---

## TL;DR

회원 삭제는 `ai-service/.env`의 서비스롤 키로 `auth.admin.delete_user(uid)`를 호출해 처리한다. **`chat_rooms.user_id`는 `text` 컬럼이라 `auth.users`와 FK가 없어서**, 계정만 지우면 채팅방·메시지·디스크립션은 주인 없이 DB에 남는다. 옛 user_id만 알면 나중에 다른 계정으로 다시 연결할 수 있으므로 **삭제한 uid ↔ 이메일은 반드시 이 문서에 남긴다.**

---

## 1. 처리 이력

| 일자 | 이메일 | 삭제된 user_id | 가입 방식 | 채팅방 처리 | 남은 데이터 | 처리자 |
|---|---|---|---|---|---|---|
| 2026-10-12 | `sdspds@naver.com` | `2d396909-e7fc-4c1c-a59b-1394ca99930b` | email | 그대로 둠 | 방 39 / 메시지 165 / 디스크립션 25 | JAM-PARK (Claude Code) |
| 2026-10-12 | `dosalimit@gmail.com` | `941c1469-e449-4491-82c7-cd83282247d2` | google (SUNNY NA) | 그대로 둠 | 방 6 (빈 방) | JAM-PARK (Claude Code) |

### 2026-10-12 건 메모

- 요청: `sdspds@naver.com`(혹은 `sdspds@gmail.com`), `dosalimit@gmail.com` 삭제. `sdspds@gmail.com`은 가입 기록이 없어서 삭제 대상이 아니었다.
- 회원 수: 61명 → 59명.
- 삭제 전 계정 정보:

  | 이메일 | 가입일 (UTC) | 마지막 로그인 (UTC) |
  |---|---|---|
  | `sdspds@naver.com` | 2026-04-01 02:32 | 2026-04-01 02:32 |
  | `dosalimit@gmail.com` | 2026-05-27 01:37 | 2026-08-17 11:34 |

- `sdspds@naver.com`의 채팅방 39개 중 37개에 '시책지급기준 - 상세정보 Step3', '상품관리', '인사정보조회', '계약정보조회', '일일지급목록' 같은 제목이 붙어 있다. 실제 업무 화면 작업으로 보인다.
- 두 계정의 방이 다른 회원에게 복제 공유된 흔적은 없다. 메시지 `code_hash`가 같은 것이 다른 회원 방에 있는지 비교해서 확인했다.
- `user_display_names`에 등록된 이름은 두 계정 모두 없었다.

---

## 2. 삭제 시 영향 범위

| 데이터 | 계정 삭제 시 | 근거 |
|---|---|---|
| `user_display_names` | 같이 삭제 | `references auth.users (id) on delete cascade` (마이그레이션 005) |
| `chat_rooms` | **남음** (주인 없음) | `user_id`가 `text` → FK 없음 |
| `chat_messages`, `descriptions` | 남음 | `room_id`로 방에 묶여 있고, 방이 남으므로 같이 남음 |
| 다른 회원에게 복제된 방 | 영향 없음 | `copy_room_to_user`는 새 room_id로 행 전체를 복사함 |

계정만 지우고 방을 남겼을 때의 동작:

- **공유 링크(`crid=<room_id>`)로 계속 열린다.** `GET /rooms/{room_id}`는 API 키만 확인하고 주인인지는 확인하지 않는다(`useIsRoomOwner` 주석 참고).
- 채팅 API에도 주인 확인이 없다. 링크를 가진 사람은 그 방에서 대화를 이어갈 수 있다.
- 누구의 채팅방 목록에도 나오지 않는다. 목록 조회가 `eq("user_id", uid)` 조건이기 때문이다.
- **화면에서는 누구도 지울 수 없다.** `DELETE /rooms/{room_id}`는 요청자 uid가 주인과 다르면 403을 반환한다. 지워야 하면 관리자가 `delete_chat_room(room_id)`를 직접 호출한다. 이 함수는 지우기 전에 `deleted_room_archive`에 백업한다.

---

## 3. 처리 절차

1. **dry-run (조회만)**: 이메일로 `auth.admin.list_users`에서 대상을 찾고 user_id, 가입 방식, 마지막 로그인, 소유 방·메시지·디스크립션 수를 확인한다.
2. **채팅방 처리 결정**: 아래 세 가지 중 하나를 요청자에게 확인받는다.
   - 같이 삭제: `delete_chat_room`. 지우기 전에 `deleted_room_archive`에 백업된다.
   - 그대로 둠: 계정만 삭제한다.
   - 다른 회원에게 이전: `move_room_to_user`.
3. **삭제**: 이메일이 아니라 dry-run에서 확인한 **user_id로** 한 명씩 처리한다.
   - `get_user_by_id(uid)`로 이메일이 dry-run 결과와 같은지 다시 확인한다.
   - `auth.admin.delete_user(uid)`를 호출한다(기본값 hard delete).
   - `get_user_by_id(uid)`를 다시 호출해서 조회가 실패하는지 확인한다.
4. **사후 확인**: 전체 회원 수가 줄었는지, 남기기로 한 방 수가 그대로인지 확인한다.
5. **기록**: 이 문서의 "처리 이력"에 행을 추가한다.

> `Database error deleting user` 오류가 나면 다른 FK가 삭제를 막고 있는 것이다(예: `storage.objects` 소유자). 해당 행을 임의로 지우지 말고 먼저 원인을 확인한다.
>
> 참고: 로컬 Postgres MCP(`how_much_dev`)는 이 Supabase DB가 아니므로 이 작업에 쓰지 않는다.

---

## 4. 남은 채팅방 다시 연결하기

삭제한 회원이 다시 가입하면 **새 user_id**가 생기므로 예전 방이 보이지 않는다. 새 계정으로 옮기려면 이렇게 한다.

```python
# apps/ai-service 에서 실행 (PYTHONPATH=. uv run python ...)
OLD_UID = "2d396909-e7fc-4c1c-a59b-1394ca99930b"   # 처리 이력의 옛 user_id
NEW_UID = "<새 계정 user_id>"

client = await get_supabase_client()
rooms = (await client.table("chat_rooms").select("id").eq("user_id", OLD_UID).execute()).data
for r in rooms:
    await move_room_to_user(r["id"], NEW_UID)   # chat_rooms.user_id 만 변경, 메시지·디스크립션은 room_id로 따라감
```
