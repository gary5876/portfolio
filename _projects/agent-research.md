---
layout: project
title: "agent-research"
summary: "분야 전문성이 있는 AI 에이전트를 어떻게 만드나, 그 과정에서 AI의 산출물을 어떻게 검증하나"
stack: [Claude Code, MCP, LLM, OpenWiki, "DeepEval (LLM 평가)", "Presidio (개인정보 검출)", Python, GitHub Actions]
tag: agent-research
kind: "개인 프로젝트"
role: "조사 위임과 재검증 요구, 검증 규칙과 훅 도입 결정, 평가 지표 설계 방향 결정"
github: https://github.com/gary5876/agent-research
order: 5
importance: 5
description: "분야 전문성이 있는 AI 에이전트를 어떻게 만드나, 그 과정에서 AI의 산출물을 어떻게 검증하나"
display_name: "agent-research (분야 전문성이 있는 AI 에이전트 연구)"
period: "2026.08 ~ 2026.09"
result: "AI에게 나눠 맡긴 조사 6건 중 3건의 오류를 재검증으로 잡아 규칙으로 남김. 위키 사실 주장 30개를 소스로 추적하는 결정론적 지표와 비밀 값 필터 비교 하네스 구현"
featured: ["/blog/2026/09/02/grounding-metric-claims/", "/blog/2026/09/05/hooks-are-deterministic-until-they-break/"]
---

"내 분야에 전문성이 있는 AI 에이전트는 어디서 오는가"를 정리하는 개인 연구 레포입니다. 2026년 8월 31일 첫 커밋, 9월 6일까지 커밋 6개. 설계보다 검증에 무게가 있습니다. AI에게 조사를 맡기면 얼마나 틀리는지, 틀린 걸 어떻게 잡는지, 규칙을 어떻게 강제하는지.

### 기술적 의사결정

**조사는 AI에게, 확인은 독립 도구로**
Claude Code가 조사를 하위 AI 여러 개에 나눠 맡기는 구조. 돌아온 보고 6건 중 3건이 틀렸고 셋 다 따져 묻고 나서야 드러남. 이후 확인만 맡는 역할을 따로 정의하고 "없다"는 결론엔 반증 검색, 순위엔 합병이나 지원 종료 여부 검색을 규칙으로.

**규칙은 프롬프트가 아니라 훅으로**
"생성된 위키는 손으로 고치지 않는다"를 편집 직전에 경로를 검사해 거부하는 훅으로 전환. 그 훅이 상대경로 때문에 깨진 것도 같은 날 잡아 고침.

**LLM 없는 채점**
위키의 사실 주장 30개가 소스 파일과 줄 번호로 지금도 추적되는지를 파일 시스템만 보고 채점. 같은 입력엔 항상 같은 점수.

**필터는 갈아 끼우며 비교**
비밀 값 필터를 인터페이스 하나에 백엔드로 꽂는 하네스. 정규식 필터 재현율 0.75 대 Presidio 1.00.

### 결과
위임 조사 오류 3/6 발견과 규칙화, 훅 1개, 결정론적 grounding 지표(Claim 30개 통과), 필터 비교 하네스(백엔드 2개). 설계 문서의 루프 여섯 단계 중 구현된 건 두 조각.

### 참고
- [07 문서, 훅 도입과 훅이 깨진 기록](https://github.com/gary5876/agent-research/blob/main/agent-expertise-framework/03-orchestration-and-enforcement/07-harness-and-hook-enforcement.md)
- [eval/README, 실행 결과](https://github.com/gary5876/agent-research/blob/main/agent-expertise-framework/02-self-improvement-loop/eval/README.md)
