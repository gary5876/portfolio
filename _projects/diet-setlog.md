---
layout: project
title: "diet-setlog"
summary: "문서를 먼저 잠그고 코딩 에이전트로 11일 만에 만든 식단 기록 앱"
stack: [Flutter, Node.js, TypeScript, Express, Prisma, PostgreSQL, Redis, BullMQ, GCP (Cloud Storage), Gemini, OpenAPI, MCP (Figma), GitHub Actions]
tag: diet-setlog
kind: "팀 프로젝트, 디자인 2인 + 개발 2인 (GDG on Campus 전남대)"
role: "설계 문서와 이슈 작성, Claude Code로 구현(Figma MCP로 디자인 연결), PR 검토와 머지"
github: https://github.com/GDG-jnu-DietSetlog/diet-setlog
order: 6
display_name: "diet-setlog (음식 사진으로 칼로리를 기록하는 식단 앱)"
period: "2026.06 ~ 2026.07"
result: "11일 동안 비머지 커밋 39개 중 30개 담당, API 16개 경로 20개 동작, 서버 테스트 157개(커버리지 7.97%에서 81.5%). 배포는 하지 않음"
featured: ["/2026/06/26/friend-recommendation-cold-start/", "/2026/09/16/anonymous-first-but-kakao-required/"]
---

음식 사진을 찍으면 Gemini가 칼로리와 영양을 읽어 주고, 그 기록을 캘린더로 모아 보고, 친구들과 피드로 서로 인증하는 앱입니다.
GDG on Campus 전남대에서 디자이너 두 분과 개발자 두 명이 모였고, 2026년 6월 24일부터 7월 4일까지 만들었습니다.
디자이너는 Figma로만 작업했고, 개발 쪽은 Claude Code에 Figma MCP를 연결해(`.mcp.json`, 6월 24일 첫 커밋) 시안을 읽어 화면을 옮겼습니다.

제 몫은 순서대로 이랬습니다. 첫 사흘은 코드 없이 문서만 썼고(API/DB 설계, 친구 추천 리서치 5편과 결정 기록, spec-lock, OpenAPI), 그다음 이틀에 서버 엔드포인트 전부와 앱 골격을 Claude Code로 구현해 PR로 올리고 제가 읽고 머지했습니다.
6월 28일에는 CI, 커버리지 게이트, 계약 가드 테스트를 넣었고, 7월 초에는 팀원이 디자이너의 2차 시안을 앱에 반영했습니다(이슈 #73, PR #76).
비머지 커밋 39개 중 24개에 Claude 공동 작성 트레일러가 붙어 있고, 제 PR은 팀원 리뷰 없이 제가 머지했습니다.

### 기술적 의사결정

**문서 재현성부터 잠그기 (이슈 #9, PR #10)**
"누구나 docs/plans를 읽고 만들면 똑같은 앱이 나오는가"를 먼저 물었고, 답은 아니었습니다. 문서끼리 어긋나는 곳 8건(디렉터리 이름, 끼니 3종 대 4종, 피드 포함 여부 등)을 `spec-lock.md` 한 파일에 확정하고, API는 `openapi.yaml`을 유일한 기준으로 두었습니다. 산문과 충돌하면 YAML이 이깁니다.

**친구 추천은 첫날 데이터에서 역산 (ADR 0001)**
서비스 첫날엔 친구 관계가 하나도 없어서 "친구의 친구" 추천이 빈 화면이 됩니다. 프로필(목표 체중, 주당 감량 목표, 나이대)은 앱을 쓰려면 반드시 입력하는 값이라 첫날부터 있는 유일한 개인화 신호였고, 이걸 주력으로 두되 관계가 쌓이면 공통 친구 수로 무게가 옮겨가게 정렬키를 잡았습니다. 초안의 `friendCount`는 "내가 팔로우한 수"라 인기 신호로 쓰면 틀려서 `followerCount`와 `followingCount`로 쪼갰습니다.

**라우트와 OpenAPI가 어긋나면 CI가 막기 (이슈 #71, PR #72)**
Express 라우터를 내부에서 훑어 실제 엔드포인트를 뽑고 `openapi.yaml`의 paths와 양방향으로 대조하는 테스트를 두었습니다. 문서에 없는 라우트도, 구현이 없는 문서 항목도 실패합니다. 다만 경로와 메서드만 보기 때문에 요청 본문 필드가 스펙 밖으로 늘어나는 건 못 잡습니다(9월 검증에서 실제로 하나 발견).

**커버리지는 흐름 테스트로만 (이슈 #56, PR #57)**
pglite 인메모리 Postgres로 Docker 없이 라우트 통합 테스트를 돌려 서버 커버리지를 7.97%에서 81.5%로 올렸습니다. 외부 I/O 래퍼(Gemini, 카카오, 스토리지, Redis, 큐)는 일부러 제외했고, 게이트 기준은 78%입니다.

**저장소는 S3 대신 GCS (이슈 #20, PR #21)**
분석 모델이 Gemini라 구글 생태계로 통일했습니다.

### 두 달 뒤에 확인한 것

9월 16일에 레포를 다시 열어 문서대로 동작하는지 검증했습니다. 문서는 "익명 세션으로 전 기능 사용"이라고 하는데 앱은 카카오 로그인이 없으면 홈에 못 들어가고, 게스트 세션 API는 서버와 앱 클라이언트 양쪽에 완성된 채 어디서도 호출되지 않으며, 스펙에 적힌 레이트리밋은 구현되지 않았습니다. 자세한 건 [근데 이게 제대로 작동하는지 어케 보장함?]({{ "/2026/09/16/anonymous-first-but-kakao-required/" | relative_url }})에 적었습니다.

### 참고
- [spec-lock.md](https://github.com/GDG-jnu-DietSetlog/diet-setlog/blob/develop/docs/plans/spec-lock.md)
- [openapi.yaml](https://github.com/GDG-jnu-DietSetlog/diet-setlog/blob/develop/docs/plans/openapi.yaml)
- [친구 추천 ADR 0001](https://github.com/GDG-jnu-DietSetlog/diet-setlog/blob/develop/docs/decisions/friend-recommendation/0001-recommendation-algorithm.md)
- [routes.contract.test.ts](https://github.com/GDG-jnu-DietSetlog/diet-setlog/blob/develop/server/src/routes.contract.test.ts)
