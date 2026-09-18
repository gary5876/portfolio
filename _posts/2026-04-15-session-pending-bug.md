---
layout: post
title: "세션이 영원히 '생성 중'인 이유: 두 저장소, 삼켜진 예외, 8개 가설"
date: 2026-04-15 09:00:00 +0900
categories: [postmortem]
tags: [study-helper, fastapi, postgres, redis]
---

study-helper는 PDF를 올리면 LLM으로 학습 노트와 퀴즈를 만들어 주는 개인 프로젝트다. 2026년 4월 15일 아침, 로그인한 사용자가 문제를 다 생성했는데도 대시보드에는 계속 "생성 중"으로 남고 학습 페이지에 다시 들어갈 수 없는 버그를 잡았다. 원인은 전날 내가 만든 동기화 코드가 실패를 경고 로그 한 줄로 삼키고 있었다는 것이었다. 가설 8개를 세워 코드 라인 단위로 판정한 과정과 수정 다섯 가지를 적는다.

**증상: 2시간 TTL 안에서도 재현됐다**

업로드와 생성을 마친 직후에 대시보드로 가면 그 세션이 "생성 중"으로 표시되고, "학습하기" 링크가 뜨지 않는다. 대시보드는 3초마다 폴링하는데 `pending`이 남아 있으면 계속 기다린다. 메모리 세션 저장소의 TTL이 2시간이라 처음엔 만료 문제를 의심했지만, 방금 만든 세션에서도 똑같이 재현됐다.

한 가지 관찰이 판단을 흐렸다. 사용자 입장에서는 "문제를 끝까지 풀어야만 완료로 바뀐다"고 느낄 만큼 타이밍이 일관적이었다. 그런데 코드에는 풀이 완료가 세션 상태를 갱신하는 경로가 없다. 나중에 확인하니 대시보드를 다시 열 때 실행되는 자가 복구 로직이 어쩌다 맞아떨어진 것이었고, 체감은 우연의 상관관계였다.

**구조: 상태 저장소가 둘이고, 읽는 쪽이 다르다**

이 서비스는 세션 상태를 두 곳에 들고 있다.

| 저장소 | 상태값 | 누가 읽나 |
|---|---|---|
| `session_store` (Redis 또는 메모리) | uploaded, processing, complete, failed | `/status`, `/result` |
| `user_sessions` (Supabase Postgres) | pending, ready, failed | 대시보드 `/user/sessions` |

대시보드는 DB만 읽고, 생성 상태와 결과는 메모리만 읽는다. 생성이 끝나면 `_sync_user_session_status`가 메모리 쪽 완료를 DB 쪽 `ready`로 한 방향 동기화한다. 이 함수는 전날([d488f43](https://github.com/gary5876/study-helper-backend/commit/d488f43)) 두 저장소의 id를 하나로 맞추면서 처음 넣은 것이다. 그 전에는 두 저장소가 아예 다른 id를 써서 대시보드 링크가 404였고, 같은 날 `(user_id, pdf_hash)` UNIQUE 충돌로 재업로드 저장이 실패하던 것도 upsert로 고쳤다([821ab87](https://github.com/gary5876/study-helper-backend/commit/821ab87)). 이번 버그는 그 수정이 만든 동기화 경로가 조용히 실패하는 문제였다.

**가설 8개와 판정**

증상만 보고 고치지 않고 가능한 원인을 전부 적은 뒤 하나씩 코드로 확인했다.

| | 가설 | 판정 | 근거 |
|---|---|---|---|
| H1 | `_sync_user_session_status`가 예외를 삼킨다 | 주원인 | `generate.py:43-50` 모든 예외를 `logger.warning`만 찍고 무시. `update_session_status`가 0건 매치면 False를 돌려주는데 호출측이 반환값을 안 본다 |
| H2 | 재업로드 시 `upsert_session`이 ready를 pending으로 되돌린다 | 보조원인 | `user_store.py:176,193` `status = EXCLUDED.status`, `upload.py:98`은 항상 pending을 넘긴다 |
| H3 | RLS 정책이 UPDATE를 0건으로 만든다 | 아님 | `SUPABASE_DB_URL`이 postgres 역할이라 RLS를 우회한다. INSERT가 되는데 UPDATE만 막힐 수 없다 |
| H4 | session_id, user_id 타입 불일치 | 아님 | uuid4 문자열, RETURNING `id::text`, `$2::uuid` 캐스팅으로 양쪽이 같은 값 |
| H5 | BackgroundTasks 안에서 예외가 나 sync를 건너뛴다 | H1의 특수 케이스 | sync 호출 자체가 예외면 안에서 잡혀 warning만 남는다 |
| H6 | 메모리 레코드의 user_id가 유실된다 | 아님 | dataclass와 `asdict` 직렬화가 user_id를 보존한다 |
| H7 | DB 커넥션 풀 경합 | 거의 아님 | `max_size=5`, 실제 동시 요청은 폴링 1과 sync 1 |
| H8 | 두 테이블이 서로 다른 DB 풀에 있다 | 구조 문제 | `main.py:53-55` `DATABASE_URL`과 `SUPABASE_DB_URL`이 다른 DB일 수 있다. 기존 자가 복구가 한 SQL로 두 테이블을 조인해서 분리 환경에서는 예외가 삼켜지며 무력화된다 |

H1이 증상과 정확히 맞았다. 메모리는 `complete`, DB는 `pending`인 채로 굳고, 실패했다는 사실은 warning 로그 한 줄에만 있었다. H2는 같은 PDF를 다시 올릴 때만 생기는 별개 경로였고, H8은 직접 원인은 아니지만 이미 넣어둔 자가 복구를 무력화하고 있었다. 나머지 다섯은 코드를 읽는 것만으로 배제됐다.

**수정 다섯 가지**

커밋 하나([d2ee07b](https://github.com/gary5876/study-helper-backend/commit/d2ee07b), `generate.py` +105, `user_store.py` +61)로 묶었다.

첫째, 동기화 함수가 성공 여부를 돌려주게 했다. 예외도 0건 매치도 error 레벨로 session_id, user_id, status를 같이 남기고 False를 반환한다.

```python
# app/routers/generate.py:43-65 (수정 후)
async def _sync_user_session_status(user_id: str | None, session_id: str, status: str) -> bool:
    if not user_id:
        return True
    try:
        updated = await get_user_store().update_session_status(user_id, session_id, status)
    except Exception as exc:
        logger.error("user_sessions status sync 실패 (session=%s user=%s status=%s): %s",
                     session_id, user_id, status, exc)
        return False
    if not updated:
        logger.error("user_sessions status sync 0 row matched (session=%s user=%s status=%s)",
                     session_id, user_id, status)
        return False
    return True
```

둘째, 완료 처리를 `_finalize_ready` 하나로 모았다. 메모리를 `complete`로 올린 뒤 sync 결과를 보고, 실패하면 메모리를 `failed`로 되돌리고 "세션을 다시 생성해 달라"는 메시지를 남긴다. 사용자는 영원한 "생성 중" 대신 실패를 보고 다시 시도할 수 있다. 캐시 히트 경로와 정상 생성 경로가 각자 따로 완료 처리를 하고 있었는데 둘 다 이 헬퍼를 거치게 했다.

```python
# app/routers/generate.py:82-92 (수정 후)
async def _finalize_ready(result_json: str) -> None:
    await store.update_status(session_id, "complete", progress_pct=100, result_json=result_json)
    ok = await _sync_user_session_status(record.user_id, session_id, "ready")
    if not ok:
        await store.update_status(session_id, "failed",
                                  error_message="DB 상태 동기화 실패 — 세션을 다시 생성해주세요.",
                                  result_json=result_json)
```

셋째, upsert가 상태를 내려깎지 못하게 했다. `ON CONFLICT` 두 분기 모두에서 기존 상태가 ready나 failed면 그대로 두고, 아니면 새 값을 쓴다.

```sql
-- app/services/user_store.py:217-222 (수정 후)
status = CASE
  WHEN user_sessions.status IN ('ready','failed') THEN user_sessions.status
  ELSE EXCLUDED.status
END
```

넷째, `/result`에 DB 폴백을 넣었다. 메모리에 없으면 로그인 사용자 한정으로 `user_sessions`에서 `pdf_hash`를 찾고, 그 해시로 `question_bank`의 결과를 가져온다. 두 테이블이 다른 DB 풀이어도 각자 조회하니 상관없다. 메모리 TTL이 지나거나 서버가 재시작돼도 재진입이 된다.

다섯째, 대시보드의 자가 복구를 다시 짰다. 이전 버전은 `user_store` 풀 안에서 `question_bank`를 서브쿼리로 참조해서 DB가 분리돼 있으면 조용히 죽었다. 새 버전은 `user_store`에서 pending 행의 `(id, pdf_hash)`를 모으고, `question_bank` 풀에서 `pdf_hash = ANY($1)`로 히트를 찾고, 매치된 id만 `user_store`에서 `ready`로 올린다. 같은 응답의 rows에도 즉시 반영해서 한 번 조회로 "완료"가 보이게 했다.

**검증은 두 가지뿐이었다**

`py_compile`로 문법을 확인하고, 사용자 환경에서 업로드부터 대시보드까지 수동으로 돌려 "완료"가 즉시 뜨는 걸 봤다. 자동 회귀 테스트는 이 커밋에 없다. 조사 문서의 체크리스트에서 그 항목만 미체크로 남아 있고, 그건 지금도 그렇다.

**지금 다시 본다면**

수정은 증상을 막았지만 구조는 그대로다. 같은 세션의 상태가 두 저장소에 따로 있고, 그 둘이 서로 다른 DB 풀에 있을 수 있다는 H8은 이날 "별개 결정"으로 미뤄뒀다. 그리고 같은 날 저녁, 전날 만든 세션을 다른 기기에서 열면 `/result`가 404로 영구 실패하는 두 번째 사고가 터졌다. 원인을 따라가니 다시 H8이었다. 메모리가 primary고 DB가 폴백인 방향 자체가 거꾸로였다. 그날 DB를 primary로 올리는 리팩터를 구현했다가 같은 날 되돌렸는데([06d00bd](https://github.com/gary5876/study-helper-backend/commit/06d00bd), [7464ef1](https://github.com/gary5876/study-helper-backend/commit/7464ef1)), 그 이야기는 따로 쓴다.

이 버그에서 남은 교훈은 하나다. 실패를 warning으로 적는 코드는 실패를 숨기는 코드다. 호출측이 결과를 보지 않는 동기화는 없는 것과 같고, 그걸 알아채는 데 사용자 체감과 우연이 섞인 하루가 걸렸다.

---

*AI가 한 것: 8개 가설의 초안 작성과 코드 라인 대조, 수정 코드 초안, 조사 문서와 커밋 메시지 정리(커밋에 Claude Opus 4.6 Co-Authored-By 표기, 조사 문서는 Claude Code 세션 산출물). 내가 한 것: 증상 재현과 "풀이 후 완료" 체감이 우연이라는 판단, H1을 주원인으로 확정하고 H8을 별개 결정으로 미룬 결정, 다섯 가지 수정 방침 승인, 사용자 환경에서의 수동 회귀 확인.*
