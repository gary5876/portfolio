---
layout: post
title: "오염을 넣어도 점수가 안 떨어졌다: DSC 엔진 첫 버전이 결측을 못 센 이유"
date: 2026-04-12 09:00:00 +0900
categories: [troubleshooting]
tags: [capstone-dsc, ml, data-quality]
summary: "데이터를 75%까지 오염시켜도 품질 점수가 2점도 안 움직이던 첫 엔진의 원인 세 가지와 같은 날 고친 기록"
---

안녕하세요, 고준서입니다. 4학년 캡스톤은 팀으로 했고, 데이터 품질 점수 엔진(DSC)과 실험 파이프라인은 제가 맡았습니다. 캡스톤의 질문은 "데이터에 매긴 품질 점수가 그 데이터로 학습한 모델의 성능을 예측하는가"였는데, 그 질문에 답하려면 먼저 점수가 오염에 반응은 하는지부터 확인해야 했습니다. 첫 실행에서 그게 안 됐습니다.

## 4월 12일 새벽, 60건을 돌렸습니다

실험 구조는 이렇습니다. 공개 데이터셋 3개(Telco 고객 이탈 7,043행, 남독일 신용 1,000행, letter 20,000행)에 DQ4AI라는 오염 도구로 오염 5종(결측, 중복, 값 오류, 표현 불일치, 클래스 불균형)을 10, 25, 50, 75% 네 단계로 넣고, 넣을 때마다 DSC 점수를 잽니다. 3 × 5 × 4 = 60건인데 letter는 범주형 열이 없어 표현 불일치를 건너뛰니 실제로는 56건이었고, 52건이 성공, 4건이 에러였습니다.

에러 4건은 전부 Telco에 값 오류 오염을 넣는 경우였어요. Telco의 `TotalCharges` 열에 공백 문자열이 11건 섞여 있어서 pandas가 열 전체를 문자열로 읽었고, 오염 도구가 수치형이 아니라고 판단해 가우시안 노이즈 대신 문자열 연결을 해 버린 겁니다. `Could not convert string '29.851889.5108.15...' to numeric`이 그 흔적입니다. 이건 `pd.to_numeric(errors='coerce').fillna(0)` 한 줄로 막았습니다(ADR-007).

문제는 성공한 52건이었습니다. Telco 기준으로 점수가 이렇게 나왔어요.

| 오염 유형 | 0% | 10% | 25% | 50% | 75% | 변화폭 |
|---|---|---|---|---|---|---|
| completeness | 99.17 | 99.16 | 99.03 | 98.65 | 97.20 | −1.97 |
| uniqueness | 99.17 | 92.51 | 89.17 | 85.84 | 84.17 | −15.00 |
| feature_accuracy | 99.17 | ERROR | ERROR | ERROR | ERROR | |
| consistent_repr | 99.17 | 92.14 | 92.14 | 92.14 | 92.14 | 고정 |
| class_balance | 99.17 | 99.94 | 99.77 | 99.06 | 97.72 | −1.45 |

*표 1. 첫 엔진의 Telco 점수(ADR-008). 결측을 75% 넣었는데 2점이 안 떨어졌습니다.*

중복(uniqueness)만 15점이 내려갔고 나머지는 거의 그대로였습니다. 표현 불일치는 강도를 어떻게 바꿔도 92.14로 똑같았고요. 점수가 84에서 99 사이에 다 몰려 있으니 C, D 등급이 하나도 없었고, 등급이 없으면 "등급이 낮을수록 모델 성능이 떨어진다"는 주장을 할 데이터 자체가 없는 상황이었습니다.

## 원인은 지표 셋에 하나씩 있었습니다

그날 기록한 ADR-008에 원인이 정리돼 있습니다. 이 문서는 Claude Code와 같이 썼고 커밋에 공동 작성자로 남아 있습니다.

첫째, completeness입니다. 오염 도구의 CompletenessPolluter는 결측을 진짜 null로 만들지 않고 placeholder를 넣습니다. 수치형은 `-1`, 범주형은 `"empty"`요. 그런데 제 `calc_completeness()`는 `df.isnull().sum()`으로 셌습니다. placeholder는 null이 아니니까 하나도 안 잡힌 거죠.

둘째, consistency입니다. ConsistentRepresentationPolluter는 범주값 뒤에 `-1`, `-2` 같은 접미사를 붙여 `"Yes"`를 `"Yes-1"`로 만듭니다. 제 지표는 `re.sub(r'-\d+$', '', x)`로 접미사를 떼고 고유값 수를 비교했는데, 그러면 오염이 "있는지"만 보이지 "얼마나"는 안 보입니다. 10%든 75%든 새 표현이 하나라도 생기면 같은 값이 나오는 구조였습니다.

셋째, class_balance입니다. 엔트로피로 재고 있었는데, Telco처럼 이탈 26%, 비이탈 74%인 이진 분류에서는 엔트로피가 0.827에서 시작합니다. 비율을 꽤 왜곡해도 이 값이 크게 안 움직여요. ADR-008에는 "가중치 자체가 0.05로 작으므로 영향 제한적, 다른 지표 수정이 더 우선"이라고 적어 뒀습니다.

셋 다 공통점이 있습니다. 지표를 만들 때 오염 도구가 실제로 어떤 값을 만들어 내는지 안 보고 만들었다는 점이요. "결측은 null이겠지"라고 가정하고 짠 코드가, null을 안 만드는 도구를 만난 겁니다.

## 같은 날 v2로 고쳤습니다

| 지표 | v1 | v2 |
|---|---|---|
| completeness | `isnull()`만 카운트 | placeholder 값도 결측으로 카운트. `compute_dsc()`에 `placeholder_numerical`, `placeholder_categorical` 파라미터 추가 |
| consistency | 고유값 수 비교 | 접미사가 붙은 행의 비율을 직접 측정 |
| class_balance | 엔트로피 | 최소 클래스 비율을 이상적 균등 비율로 나눔. 2-class 90:10이면 0.2 |

*표 2. v2 수정 내용(진행 기록 20260412-02).*

completeness는 이렇게 바뀌었습니다. 지금 저장소의 노트북 01에 남아 있는 버전입니다.

```python
def calc_completeness(df, target_col, placeholder_numerical=-1, placeholder_categorical='empty'):
    """결측치 + placeholder 비율. 1=완전, 0=전부 결측."""
    feature_df = df.drop(columns=[target_col], errors='ignore')
    total_cells = feature_df.shape[0] * feature_df.shape[1]
    if total_cells == 0:
        return 1.0
    missing_count = feature_df.isnull().sum().sum()
    if placeholder_numerical is not None:
        for col in feature_df.select_dtypes(include=[np.number]).columns:
            missing_count += (feature_df[col] == placeholder_numerical).sum()
    ...
```

placeholder 값을 인자로 받게 한 건, 오염 도구가 쓰는 값이 설정에 따라 바뀔 수 있어서입니다. 기본값 `-1`과 `'empty'`는 DQ4AI의 기본값을 그대로 가져왔습니다.

letter 데이터셋은 v2 엔진으로 그날 바로 다시 쟀고(16건), 나머지 두 데이터셋은 다음 실행에서 v2로 넘어갔습니다. 이날의 커밋은 전부 Claude Opus 4.6과 함께한 작업으로 기록돼 있고, 노트북 수정과 실행 로그 자동 생성 셀이 그쪽 몫이었습니다.

## 이걸로 끝은 아니었습니다

진행 기록에는 "v2 수정 후 completeness 75% 오염이면 80점 이하, 전 등급 분포 생성"이라고 기대를 적어 놨는데, 실제로는 v2로 다시 돌린 뒤에도 점수와 모델 성능의 전체 상관계수가 0.08에 머물렀습니다. 결측과 표현 불일치는 이제 보였지만, 값 오류 오염에서 점수가 오히려 올라가는 다른 문제가 남아 있었어요. 그건 4월 25일 진단에서 잡혔고, 그 이야기는 [다음 글]({{ "/2026/04/25/outlier-metric-self-reference/" | relative_url }})에 적었습니다.
