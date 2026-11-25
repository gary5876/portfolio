---
layout: post
title: "라우트와 OpenAPI가 어긋나면 CI가 막게 한 이유, 그리고 경로만 보는 가드의 한계"
date: 2026-06-28 19:32:00 +0900
categories: [decisions]
tags: [diet-setlog, openapi, express, vitest, ci]
description: "API 문서를 유일한 기준이라 정해 놓고 사람이 눈으로 지키던 걸, 경로와 메서드만 대조하는 테스트로 CI에 넘긴 결정과 두 달 뒤 확인한 구멍"
---

안녕하세요, 고준서입니다. diet-setlog는 6월 말에 GDG on Campus 전남대에서 디자이너 두 분, 개발자 두 명이 11일 동안 만든 식단 기록 앱입니다. 저는 개발 둘 중 한 명으로 설계 문서와 이슈를 쓰고 Claude Code로 구현을 돌린 뒤 PR을 읽고 머지했어요. 이 프로젝트는 API 계약을 `openapi.yaml` 한 파일로 정하고 "산문과 YAML이 충돌하면 YAML이 이긴다"고 잠가 둔 상태로 시작했는데, 서버 엔드포인트를 이틀 만에 다 만들고 보니 코드가 그 YAML을 따르는지는 제가 눈으로 보고 있었습니다. 그래서 6월 28일에 Express 라우터가 실제로 응답하는 경로와 메서드를 뽑아 YAML의 `paths`와 양방향으로 대조하는 테스트를 넣고 CI에 물렸어요. 문서에 없는 라우트도, 구현 없는 문서 항목도 빨간불이 납니다.

이 글에서 확인할 수 있는 건 왜 이 방식이었는지, 요청 본문까지 검증하는 다른 길은 왜 안 갔는지, 그리고 두 달 뒤 이 가드가 실제로 뭘 잡았고 뭘 놓쳤는지입니다. 이슈와 PR, 테스트 코드 줄 번호로 따라갑니다. 그날 기준 YAML은 13개 경로 17개 동작이었고 지금은 16개 경로 20개 동작이에요. 가드가 CI에서 실패한 횟수는 0번인데, 그게 좋은 뜻인지는 끝에 적습니다.

## "유일한 기준"을 사람이 지키고 있었다

배경을 한 문단만 적어 둘게요. 6월 24일부터 26일까지는 코드 없이 문서만 썼고, 문서가 다섯 개쯤 쌓였을 때 "누구나 `docs/plans`를 읽고 만들면 완벽히 똑같은 앱이 나오는가?"라고 이슈([#9](https://github.com/GDG-jnu-DietSetlog/diet-setlog/issues/9))에 물었습니다. 답은 아니었어요. 문서끼리 어긋나는 곳이 8건(끼니 3종 대 4종, 디렉터리 이름, 피드 포함 여부 같은 것)이었고, 같은 날 PR([#10](https://github.com/GDG-jnu-DietSetlog/diet-setlog/pull/10))에서 `spec-lock.md`에 8건을 표로 확정하고 API 계약은 `openapi.yaml`을 유일한 기준으로 두었습니다. OpenAPI 3.1 형식이고 그날 기준 13개 경로, 17개 동작이었어요.

6월 26일 저녁부터 27일까지 서버 엔드포인트를 전부 구현했습니다. 세션, 프로필, 홈, 기록, 캘린더, 친구, 피드, 분석. 28일 새벽에는 디자이너 2차 시안에 새로 들어온 카카오 로그인이 추가돼서 `POST /sessions/kakao`가 늘었고요. 그러다 이슈([#71](https://github.com/GDG-jnu-DietSetlog/diet-setlog/issues/71))에 이렇게 적었습니다.

> 지금까지 라우트와 `docs/plans/openapi.yaml` 동기화는 **수동**이었다(스펙 미반영/유령 스펙을 잡는 장치 없음).

새 엔드포인트를 만들면서 YAML에 안 적어도, 반대로 YAML에만 있고 구현이 없어도 아무것도 안 울렸습니다. 이틀 동안 그게 안 벌어진 건 제가 PR마다 YAML을 같이 열어 봤기 때문이지 구조 때문이 아니었어요.

## 마운트 목록 하나, 테스트 둘

28일 저녁 7시 32분에 머지한 PR([#72](https://github.com/GDG-jnu-DietSetlog/diet-setlog/pull/72), [40039f4](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/40039f4))이 그 장치입니다. 코드는 Claude Code가 썼고 PR 본문에 그렇게 남아 있어요.

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

## 왜 경로만 봤나

다른 길은 둘이 있었습니다. YAML에서 zod 스키마를 생성해 요청 검증에 쓰는 것, 그리고 응답을 스키마로 검증하는 미들웨어를 두는 것. 둘 다 하면 경로뿐 아니라 요청과 응답 본문까지 문서와 맞는지 잡힙니다. 그런데 이슈 #71과 PR #72, spec-lock 어디에도 이 둘과 라우터 대조를 비교한 기록은 없어요. spec-lock에는 "OpenAPI/zod 산출물 부재"라고 빈 자리만 적혀 있습니다. 그러니 그날 왜 이쪽을 골랐는지는 기록으로 말할 수 없고, 지금 말하면 이렇습니다. 11일짜리 일정에서 제가 실제로 놓치고 있던 건 "만들었는데 문서에 안 적은 엔드포인트"였고, 그건 경로 대조로 잡힙니다. 본문 검증은 zod 스키마를 YAML과 다시 맞춰야 하는 일이 하나 더 생기는 방식이라 그때 붙일 여유가 없었던 것 같아요. 그게 판단이었는지 그냥 못 본 건지는 구분이 안 됩니다.

## 못 잡는 것

이 가드가 보는 건 경로와 메서드뿐입니다. 요청 본문 안의 필드는 안 봐요. 9월 16일에 코드와 스펙을 다시 대조했을 때 `POST /v1/food-records`가 YAML에 없는 `imageUrl` 필드를 받고 있었는데, 가드는 조용했습니다. 경로는 같으니까요. 응답 스키마도 마찬가지로 대조하지 않습니다. 바로 위에서 안 간 길이 잡았을 구멍입니다.

지금 YAML은 16개 경로, 20개 동작입니다. 7월에 팀원이 피드에 날짜와 범위 파라미터를 붙일 때도 경로가 바뀌지 않았으니 가드는 관여할 일이 없었고요. 두 달 동안 가드가 실제로 뭔가를 막은 기록은 없습니다. 그게 코드와 문서가 안 벌어졌다는 뜻인지, 벌어질 만큼 개발이 이어지지 않았다는 뜻인지는 11일짜리 프로젝트로는 알 수 없습니다.

여담 하나. spec-lock의 §2 제목은 지금도 "7개 확정"이고 표는 8줄입니다. 8번째 항목을 나중에 넣으면서 제목을 안 고친 흔적이에요. 문서와 문서가 어긋나는 걸 잡자고 만든 문서에 남은 어긋남이라, 이 글을 쓰면서 발견해 그대로 적어 둡니다.
