---
layout: project
title: "vgc-ai"
summary: "코딩 에이전트의 제안, 신뢰구간으로 걸러내기"
stack: [Python, numpy, scipy, pytest, GCP (Compute Engine), Claude Code]
tag: vgc-ai
kind: "개인 프로젝트"
role: "실험 파이프라인, 통계 게이트, 자율 루프 설계 단독"
github: https://github.com/gary5876/vgc-ai
order: 3
importance: 3
description: "코딩 에이전트의 제안, 신뢰구간으로 걸러내기"
display_name: "vgc-ai (포켓몬 배틀 게임 AI)"
period: "2026.05 ~ 2026.06"
result: "교내 리그전 25팀 중 1위. 코딩 에이전트의 제안을 통계 게이트로 걸러 채택하는 구조"
featured: ["/blog/2026/05/12/wilson-gate-16-verdicts/", "/blog/2026/05/22/empty-meta-bench-harness/"]
---

IEEE CoG 2026 포켓몬 VGC AI 대회를 목표로 시작한 게임 AI(대회 제출은 하지 않음). 에이전트 자체보다 "개선을 어떻게 검증하는가"를
보여주는 프로젝트입니다. 코딩 에이전트를 개발에 투입하되, 통계 게이트를 통과한 것만 받습니다.

### 기술적 의사결정

**휴리스틱 탐색 (deep RL 기각)**
이 엔진은 분산이 커서 deep RL이 깨진다는 선행 대회 분석. 고전 탐색과 평가 함수 조합이 실제로 더 강함.

**LP-minimax 팀빌딩**
상대 메타가 무엇이든 최악의 매치업을 수학적으로 보장하는 팀 선택.

**코딩 에이전트 전략 제안**
GCP VM에서 에이전트가 전략을 제안. 사람이 못 도는 탐색 폭을 확장하되, 채택은 게이트가 결정.

**n=2000 자가대전, 95% CI 게이트**
신뢰구간 하한을 통과해야만 채택. 우연한 연승을 개선으로 착각하지 않기 위해. 기각된 실험도 원인 분석과 함께 보존.

### 결과
교내 리그전 1위 / 25명 (2026-05-17, 25팀 라운드로빈), IEEE CoG 2026은 목표였으나 제출하지 않음

### 참고
- [selection.py, 기각 실험 기록](https://github.com/gary5876/vgc-ai/blob/main/src/vgc_ai/policies/selection.py)
- [리그전 결과 (README)](https://github.com/gary5876/vgc-ai#results)
