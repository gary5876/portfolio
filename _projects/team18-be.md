---
layout: project
title: "Team18_BE"
summary: "대학 동아리 지원서 도메인, 이벤트로 쪼갠 이유"
stack: [Java, Spring Boot, MySQL, Redis]
tag: team18-be
kind: "팀 프로젝트, 백엔드 3인 + 프론트엔드 3인"
role: "내 담당: 지원서 도메인 API, DB 모델링, 통계, 공지, 이메일 알림 전담"
github: https://github.com/kakao-tech-campus-3rd-step3/Team18_BE
live_demo: https://www.dongarium.co.kr/
order: 1
display_name: "동아리움 (대학 동아리 지원 서비스)"
period: "2025.08 ~ 2026.09 (개발 3개월, 실서비스 10개월)"
result: "GA 기준 이용자 2026년 1학기 약 3,100명, 2학기 866명(9월 기준)"
featured: ["/2026/08/18/statistics-cache-aside/", "/2025/10/16/async-listener-lazy-init/"]
---

대학 동아리 모집과 지원자 관리 서비스. 카카오테크캠퍼스 팀 프로젝트로 시작해 3개월 개발 후 10개월간 실서비스로 운영했습니다.
지원서 도메인의 API 설계, DB 모델링을 맡았고 통계, 공지, 이메일 알림은 처음부터 끝까지 구현했습니다.

### 기술적 의사결정

**도메인 API 설계, DB 모델링**
지원서 제출 도메인을 맡아 API 계약과 스키마를 먼저 고정. 3인 팀이 병렬로 움직일 기준선.

**이벤트 기반 비동기 이메일**
발송 지연이 사용자 응답을 막지 않도록 이벤트로 분리. 실패는 재시도 가능/불가로 분류해 대응.

**join fetch, 프로젝션**
지원서 목록 조회의 N+1과 불필요한 컬럼 로딩을 제거해 쿼리 수를 감축.

**Prometheus, Grafana, Loki**
스택 구축은 팀 공동 작업. 그 위에 비즈니스 지표를 등록하고 Discord 알림까지 연결해 장애를 지표, 로그로 추적.

**계층별 테스트 290개**
10개월 운영 중 기능 추가, 리팩터링의 회귀를 막는 안전망. 계층 분리로 실패 지점을 즉시 특정.

### 결과
10개월 실서비스 운영, 팀 프로젝트(백엔드 3 + 프론트엔드 3), 카카오테크캠퍼스, GA 기준 이용자 2026년 1학기 약 3,100명, 2학기 866명(9월 기준)

### 참고
- [CI 워크플로](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/blob/develop/.github/workflows/ci-on-pr.yml)
- [모니터링 구성](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/tree/develop/monitoring)
- [docker-compose.monitoring.yml](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/blob/develop/docker-compose.monitoring.yml)
