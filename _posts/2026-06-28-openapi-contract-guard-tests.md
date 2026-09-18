---
layout: post
title: "문서만 읽고 만들면 같은 앱이 나오는가"
date: 2026-06-28 19:32:00 +0900
categories: [decisions]
tags: [diet-setlog, openapi, express, vitest, ci]
summary: "설계 문서끼리 어긋난 8군데를 한 파일에 잠그고, 코드와 API 문서가 벌어지면 CI가 막게 한 이틀"
---

안녕하세요, 고준서입니다. diet-setlog는 6월 말에 GDG on Campus 전남대에서 디자이너 두 분, 개발자 두 명이 열하루 동안 만든 식단 기록 앱입니다. 저는 개발 둘 중 한 명으로 설계 문서와 이슈를 쓰고 Claude Code로 구현을 돌린 뒤 PR을 읽고 머지했어요. 6월 24일에 시작해서 26일까지는 코드 없이 문서만 썼습니다. 와이어프레임 계획, 화면 좌표, 디자인 토큰, API/DB 설계, 친구 추천 결정 기록까지.

문서가 다섯 개쯤 쌓였을 때 이런 질문을 이슈([#9](https://github.com/GDG-jnu-DietSetlog/diet-setlog/issues/9))에 적었습니다.

> "누구나 `docs/plans`를 읽고 만들면 완벽히 똑같은 앱이 나오는가?"

답은 아니었어요.

## 문서끼리 어긋난 8군데

디자인 토큰, API 계약, DB 스키마 뼈대는 단단했는데, 문서와 문서 사이에 구멍이 세 층으로 있었습니다. 제일 위층이 문서 간 모순이었고, 이슈와 PR([#10](https://github.com/GDG-jnu-DietSetlog/diet-setlog/pull/10)) 본문에 8건을 적었어요.

1. 나이(`birthYear`)는 API에서 필수인데 입력받는 온보딩 화면이 없음
2. STEP1에서 이름을 받는데 저장하는 API 경로가 없음
3. 디렉터리 이름이 한 문서는 `app/server`, 다른 문서는 `mobile/api`
4. 메모 필드가 화면엔 있고 계약엔 없음
5. 끼니가 기록 화면엔 3종(간식 없음), enum과 캘린더엔 4종
6. 피드의 좋아요와 댓글은 디자인이 다 있는데 API도 DB 모델도 없음
7. 캘린더의 친구 추가 아이콘이 디자인엔 있고 보드엔 "제거"
8. 하단 탭이 4개인데 프로필 탭의 화면 스펙이 없음

그 아래층은 "덜 박힌 계약"이었어요. 중첩 응답 객체의 필드가 안 정해져 있고, Gemini에 보낼 프롬프트 원문이 없고, 매직넘버가 전부 "예:"로 적혀 있었습니다. 맨 아래층은 툴링 부재. 패키지 버전, Flutter 반응형 전략, 폰트, OpenAPI 산출물이 없었죠.

같은 날 저녁 7시 21분에 머지한 PR #10([4641a05](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/4641a05))이 이걸 다 닫았습니다. 문서 초안은 Claude가 썼고 커밋 트레일러에 그렇게 남아 있어요. 핵심은 파일 두 개였습니다.

`spec-lock.md`는 모든 결정을 잠그는 문서예요. 8건은 표로 확정했고(출생연도는 STEP2에 필드 추가, 이름은 `PUT /v1/me/profile`로 저장, 디렉터리는 `app/`과 `server/`, 끼니는 4종에 간식 칩 추가, 피드는 v1 포함, 캘린더 친구 추가는 제거, 프로필 탭은 렌더하되 눌러도 아무 일 없음), 그 위에 §0으로 "어느 문서가 이기는가" 표를 두었습니다. API 계약은 `openapi.yaml`, DB 스키마는 설계 문서 §2.2와 spec-lock §4, 상수와 버전은 spec-lock §7과 §10. 산문과 YAML이 충돌하면 YAML이 이깁니다.

`openapi.yaml`은 그 API 계약을 기계가 읽을 수 있게 적은 파일이에요. OpenAPI 3.1 형식이고 그날 기준 13개 경로, 17개 동작이었습니다. 이걸 유일한 기준으로 두기로 했죠.

여담인데, spec-lock의 §2 제목은 지금도 "7개 확정"이고 표는 8줄입니다. 8번째 항목을 나중에 넣으면서 제목을 안 고친 흔적이에요.

## 이틀 뒤, 그 기준을 사람이 지키고 있었다

6월 26일 저녁부터 27일까지 서버 엔드포인트를 전부 구현했습니다. 세션, 프로필, 홈, 기록, 캘린더, 친구, 피드, 분석. 28일 새벽에는 디자이너 2차 시안에 새로 들어온 카카오 로그인이 추가돼서 `POST /sessions/kakao`가 늘었고요. 그러다 이슈([#71](https://github.com/GDG-jnu-DietSetlog/diet-setlog/issues/71))에 이렇게 적었습니다.

> 지금까지 라우트와 `docs/plans/openapi.yaml` 동기화는 **수동**이었다(스펙 미반영/유령 스펙을 잡는 장치 없음).

"유일한 기준"이라고 정해 놓고, 코드가 그 기준을 따르는지는 제가 눈으로 보고 있었던 거예요. 새 엔드포인트를 만들면서 YAML에 안 적어도, 반대로 YAML에만 있고 구현이 없어도 아무것도 안 울렸습니다.

28일 저녁 7시 32분에 머지한 PR([#72](https://github.com/GDG-jnu-DietSetlog/diet-setlog/pull/72), [40039f4](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/40039f4))이 그 장치입니다. 두 부분이에요.

먼저 마운트 목록을 한 곳으로 모았습니다. 전에는 `index.ts`가 라우터를 하나씩 `app.use`로 붙였는데, 이제 `routes.ts`의 배열 하나가 기준이고 `index.ts`는 그걸 순회합니다.

```ts
// server/src/routes.ts:12-26
// 마운트 경로 ↔ 라우터 단일 진실원.
// index.ts(실제 마운트)와 계약 가드 테스트(routes.contract.test.ts)가 공유한다.
// 새 라우터를 추가하면 여기에만 등록 → index.ts 가 순회 마운트하고, 가드가 openapi.yaml 동기화를 강제한다.
export const routeGroups: ReadonlyArray<readonly [string, Router]> = [
  ['/v1/sessions', sessionRouter],
  ['/v1/me', profileRouter],
  ['/v1/home', homeRouter],
  ['/v1/food-records', recordsRouter],
  ['/v1/calendar', calendarRouter],
  ['/v1/friends', friendsRouter],
  ['/v1/feed', feedRouter],
  ['/v1/posts', postsRouter],
  ['/v1/food-analyses', analysesRouter],
  ['/v1/images', imagesRouter],
];
```

그다음이 테스트예요. Express 라우터는 내부에 `stack`이라는 배열로 자기가 아는 경로와 메서드를 들고 있는데, 그걸 훑어서 "실제로 응답하는 엔드포인트" 집합을 만듭니다. YAML 쪽은 `paths`를 읽어 같은 모양의 집합을 만들고요. 두 집합을 양방향으로 뺍니다.

```ts
// server/src/routes.contract.test.ts:38-43
function normalizePath(p: string): string {
  let s = p.replace(/^\/v1/, ''); // openapi 의 paths 는 /v1 미포함(servers url 에 있음)
  s = s.replace(/:([A-Za-z0-9_]+)/g, '{$1}'); // :id → {id}
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1); // 끝 슬래시 제거
  return s;
}
```

```ts
// server/src/routes.contract.test.ts:78-89
  it('스펙에 없는 라우트가 없어야 한다(문서 누락 차단)', () => {
    const undocumented = [...code].filter((e) => !spec.has(e)).sort();
    expect(
      undocumented,
      `openapi.yaml 에 누락된 엔드포인트(코드엔 있음):\n${undocumented.join('\n')}`,
    ).toEqual([]);
  });

  it('라우트 없는 스펙 항목이 없어야 한다(유령 스펙 차단)', () => {
    const phantom = [...spec].filter((e) => !code.has(e)).sort();
    expect(phantom, `구현 없는 openapi.yaml 항목(스펙엔 있음):\n${phantom.join('\n')}`).toEqual([]);
  });
```

`:recordId`와 `{recordId}`처럼 표기가 다른 건 정규화로 맞췄고, 추출기가 헛도는 걸 막으려고 양쪽 집합이 10개 이상이고 `post /sessions/guest` 같은 대표 엔드포인트가 양쪽에 다 있는지 먼저 확인하는 테스트를 앞에 두었습니다. 이 테스트는 같은 날 넣은 CI의 서버 잡(`npm run test:coverage`)에 포함돼서, 문서에 없는 라우트가 PR에 올라오면 그 자리에서 빨간불이 납니다. 머지 시점에 코드와 YAML은 이미 맞아 있어서 가드는 바로 통과했어요.

## 못 잡는 것

이 가드가 보는 건 경로와 메서드뿐입니다. 요청 본문 안의 필드는 안 봐요. 9월 16일에 코드와 스펙을 다시 대조했을 때 `POST /v1/food-records`가 YAML에 없는 `imageUrl` 필드를 받고 있었는데, 가드는 조용했습니다. 경로는 같으니까요. 응답 스키마도 마찬가지로 대조하지 않습니다. 본문까지 잡으려면 YAML에서 zod 스키마를 생성해 요청 검증에 쓰거나 응답을 스키마로 검증하는 미들웨어가 필요한데, spec-lock에 "OpenAPI/zod 산출물 부재"라고 적어 놓고 그건 하지 않았어요.

지금 YAML은 16개 경로, 20개 동작입니다. 7월에 팀원이 피드에 날짜와 범위 파라미터를 붙일 때도 경로가 바뀌지 않았으니 가드는 관여할 일이 없었고요. 두 달 동안 가드가 실제로 뭔가를 막은 기록은 없습니다. 그게 코드와 문서가 안 벌어졌다는 뜻인지, 벌어질 만큼 개발이 이어지지 않았다는 뜻인지는 열하루짜리 프로젝트로는 알 수 없습니다.
