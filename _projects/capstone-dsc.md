---
layout: project
title: "capstone-dsc"
summary: "데이터 품질 점수가 모델 성능을 예측하는지 오염 실험으로 검증"
stack: [Python, pandas, scikit-learn, XGBoost, DQ4AI, Google Colab]
tag: capstone-dsc
kind: "팀 프로젝트(캡스톤), 점수 엔진과 실험은 단독 담당"
role: "내 담당: DSC 점수 엔진, 오염 실험 파이프라인, 통계 검증, 이미지와 텍스트 셀 확장"
github: https://github.com/gary5876/capstone-dsc
order: 4
display_name: "capstone-dsc (데이터 품질 점수가 모델 성능을 예측하는가)"
period: "2026.04 ~ 2026.06"
result: "정형 데이터 435건에서 점수와 F1의 상관 r 0.598 (p 1.6e-43), hold-out 5/5 통과"
featured: ["/2026/06/03/dsc-blind-spot-signal-integrity/", "/2026/04/27/dropping-a-weighted-metric-adr-009/"]
---

4학년 캡스톤. 데이터에 품질 점수(DSC)를 매기는 도구가 있을 때, 그 점수가 실제로 그 데이터로 학습한 모델의 성능을 예측하는지를
실험으로 확인한 프로젝트입니다. 팀 캡스톤이고, 점수 엔진과 실험 파이프라인, 통계 검증은 제가 맡았습니다.

공개 데이터셋 3개(Telco 고객 이탈, 남독일 신용, letter)에 DQ4AI로 오염 5종(결측, 중복, 값 오류, 표현 불일치, 클래스 불균형)을
단계별로 넣고, 설정마다 DSC 점수와 모델 5개(LR, RF, XGB, SVC, MLP)의 F1을 짝지어 상관을 봤습니다. 이후 이미지와 텍스트 셀로 확장했습니다.

### 기술적 의사결정

**점수 엔진을 세 번 뜯어고침 (v1 → v2 → v3.2 → v4)**
첫 엔진은 오염을 75% 넣어도 점수가 2점도 안 움직였고, 고친 뒤에는 이상치 지표가 노이즈에 거꾸로 반응했습니다.
매번 오염 종류별로 상관을 쪼개 어느 지표가 문제인지 찾고 그 지표만 고쳤습니다. 전체 r은 0.08 → 0.42 → 0.60.

**원본 의존 지표 제거 (ADR-009)**
상관을 올려 준 `value_accuracy`가 원본 없이는 계산이 안 되는 drift 지표라서, "데이터 품질 점수"라는 정의를 지키기 위해 뺐습니다.
대신 kNN 라벨 일관성과 상호정보량 지표를 넣었고, 검증 조건 4개를 결과 보기 전에 먼저 적었습니다.

**split-first와 누수 자동 검증**
오염된 파일을 나누던 구조가 test에 train 복제본을 흘려 RF F1 0.99가 나왔습니다. 먼저 나누고 train만 오염시키는 구조로 바꾸고,
학습 전에 split 인덱스와 행 해시로 누수를 검사해 실패하면 학습을 멈추게 했습니다.

**한계를 지표로 남김**
Telco의 약한 상관(onehot 13,615차원)과 uniqueness 오염의 무반응은 고치지 않고 원인과 함께 README에 명시했습니다.

### 결과

정형 데이터: 오염 설정 87개 × 모델 5개 = 435건, Pearson r 0.598, Spearman 0.628, 등급별 F1 평균 A 0.88 / B 0.78 / C 0.60 / D 0.52,
오염 종류 hold-out 5/5 통과. 이미지 회귀 셀은 노이즈 지표 추가 후 held-out 데이터셋에서 r 0.95.

### 참고
- [결과 로그 (results/04_execution_log.md)](https://github.com/gary5876/capstone-dsc/blob/main/results/04_execution_log.md)
- [의사결정 기록 ADR (documents/decisions)](https://github.com/gary5876/capstone-dsc/tree/main/documents/decisions)
- [dsc_framework 패키지](https://github.com/gary5876/capstone-dsc/tree/main/dsc_framework)
