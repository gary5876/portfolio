---
layout: project
title: "study-helper-backend"
summary: "혼자 만든 풀스택 3레포, LLM 3사 연동 API"
stack: [Python, FastAPI, PostgreSQL, Redis]
tag: study-helper
kind: "개인 프로젝트"
role: "설계 → 구현 → CI → 배포 전 과정 단독"
github: https://github.com/gary5876/study-helper-backend
order: 2
display_name: "study-helper (PDF로 학습 노트와 퀴즈를 만드는 서비스)"
period: "2026.03 ~ 2026.06"
result: "백엔드, 웹, 모바일 3개 저장소를 혼자 만들고 GCP Cloud Run에 배포. 지금은 운영 중단"
featured: ["/2026/04/15/session-pending-bug/", "/2026/03/31/three-providers-three-circuit-breakers/"]
---

PDF를 올리면 LLM으로 학습 노트와 퀴즈를 만들어주는 API. 외부 LLM API 3사(Claude, GPT, TimelyGPT)를 연동했고,
설계부터 CI, 클라우드 배포까지 혼자 구성했습니다.

### 기술적 의사결정

**서킷 브레이커 (직접 구현)**
한 LLM사의 장애가 서비스 전체로 번지지 않게 격리. 사용자 키 오류(401)는 장애로 세지 않아 오작동 차단 방지.

**SHA-256 해시 캐싱**
같은 PDF가 다시 오면 LLM을 아예 호출하지 않음. API 비용과 대기 시간을 동시에 제거.

**응답 검증 파이프라인**
LLM 출력을 그대로 믿지 않음. 중복 제거, 환각 탐지, 필드 보정을 통과한 것만 저장.

**GitHub Actions OIDC 키리스 배포**
장기 클라우드 자격증명을 저장소에 두지 않음. 유출돼도 훔칠 시크릿이 없는 구조.

**테스트 280개, 레이트리밋, 메트릭**
혼자 운영하는 서비스. 비용 폭주와 이상 징후는 사람이 아니라 기계가 잡아야 함.

### 결과
GCP Cloud Run 키리스 배포, LLM 3사 연동, 솔로 풀사이클 (FastAPI 백엔드 + study-helper-web(Next.js/Supabase) +
study-helper-mobile(React Native/Expo) 3레포 전부 단독 100%. 과거엔 배포돼 있었으나 지금은 비공개/중단.)

### 참고
- [배포 워크플로 (OIDC)](https://github.com/gary5876/study-helper-backend/blob/develop/.github/workflows/deploy.yml)
- [deploy/ 구성](https://github.com/gary5876/study-helper-backend/tree/develop/deploy)
- [테스트 스위트](https://github.com/gary5876/study-helper-backend/tree/develop/tests)
