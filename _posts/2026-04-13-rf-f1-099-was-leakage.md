---
layout: post
title: "RandomForest F1 0.99는 학습이 아니라 누수였다: split-first로 바꾼 기록"
date: 2026-04-13 09:00:00 +0900
categories: [troubleshooting]
tags: [capstone-dsc, ml, experiment-design]
description: "오염된 파일을 나누던 파이프라인이 test에 train 복제본을 흘리고 있어서, 먼저 나누고 train만 오염시키는 구조로 바꾼 기록"
---

안녕하세요, 고준서입니다. 캡스톤 팀에서 데이터 품질 점수 엔진과 실험 파이프라인을 맡았습니다. 4월 13일 아침에 고친 문제인데, 중복 오염을 넣은 데이터에서 RandomForest 성능이 오히려 0.99까지 올라간 원인이 학습이 아니라 test에 새어 들어간 train 복제본이었습니다. 그 상태로는 실험 결과 전체를 믿을 수 없었어요. 오염된 전체를 나누는 대신 깨끗한 데이터를 먼저 나누고 train에만 오염을 넣는 방식(split-first)으로 고쳤고, 이 글은 그 원인과 고친 순서, 12일 뒤 검증을 다시 조인 것까지 커밋 번호와 함께 적습니다. 다만 고치기 전의 오염 학습 결과는 저장해 두지 않아서, 0.99가 어느 데이터셋의 값이었는지와 같은 설정의 전후 숫자는 남아 있지 않습니다.

## 중복 오염에서 성능이 올라갔습니다

실험은 오염된 데이터로 모델을 학습시키고 깨끗한 test에서 F1을 재는 구조입니다. 그런데 중복(uniqueness) 오염을 넣은 데이터에서 RandomForest의 F1이 0.99까지 나왔습니다. 데이터를 나쁘게 만들었는데 성능이 좋아진 거죠.

첫 파이프라인은 노트북 02가 데이터셋 전체에 오염을 넣어 파일로 저장하고, 노트북 03이 그 파일을 읽어 그 자리에서 8:2로 나눴습니다.

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=1, stratify=y
)
```

UniquenessPolluter는 행을 복제해서 중복을 만듭니다. 복제된 행이 있는 파일을 나누면 원본은 train에, 복제본은 test에 가는 행이 생깁니다. 모델은 train에서 본 행을 test에서 그대로 다시 만나니 외운 답을 적는 셈이고, 트리 모델일수록 잘 외웁니다. 0.99는 그 결과였습니다.

커밋된 첫 버전이 위 코드였고, 수정 커밋 메시지에 남긴 대로 그 뒤에 오염된 전체를 읽은 뒤 test와 겹치는 행을 걸러내는 사후 필터링으로 막아 보려 했습니다. 그런데 CSV로 저장하면서 부동소수점 정밀도가 달라지거나 오염 종류에 따라 행 수가 바뀌어서 같은 행인지 판정이 흔들렸고, uniqueness와 class_balance에서 누수가 계속 남았습니다. 수정 커밋 메시지는 이 상태를 "누수 지속(RF F1 0.99 등)"이라고 적어서, 0.99는 필터링을 넣은 뒤에도 남아 있던 값입니다. 필터링 전의 순수 분할에서 얼마였는지는 기록이 없어요.

## 먼저 나누고, train만 오염시킵니다

순서를 바꿨습니다([c187972](https://github.com/gary5876/capstone-dsc/commit/c187972)). 깨끗한 데이터를 먼저 나누고, train에만 오염을 넣고, test는 `test_clean/`에 따로 저장합니다. test는 오염 도구를 아예 거치지 않습니다.

```python
# 원칙: clean 데이터를 먼저 split -> train에만 polluter 적용 -> 저장
# test는 절대 오염되지 않음 -> leakage 원천 차단
train_idx, test_idx = train_test_split(
    np.arange(len(df_clean)), test_size=ML_TEST_SIZE,
    random_state=ML_SPLIT_SEED, stratify=y_encoded
)
df_train_clean = df_clean.iloc[train_idx].reset_index(drop=True)
df_test_clean = df_clean.iloc[test_idx].reset_index(drop=True)
```

노트북 03은 split과 필터링 로직을 다 걷어내고 `train_data.csv`와 test 파일을 그냥 읽는 구조로 다시 썼습니다. 그리고 학습 루프 바로 앞에 누수 검증 셀을 넣었습니다. 사람이 다시 실수해도 코드가 잡게요. 데이터셋 3개 × 59건을 실제 파일로 전수 확인했고 새 누수는 0건이었습니다.

고친 뒤 결과 파일(같은 커밋의 `results/model_performance.csv`)에서 강도 10%부터 75%까지 중복 오염을 넣은 RandomForest의 f1_macro는 TelcoCustomerChurn 0.69에서 0.71, SouthGermanCredit 0.68에서 0.73, letter 0.961에서 0.964였습니다. 오염 없는 기준선은 각각 0.698, 0.699, 0.958이니 중복을 넣어도 기준선 근처에 머물고, 0.99 같은 값은 없습니다.

## 4월 25일에 검증을 한 번 더 조였습니다

첫 검증 셀은 기준선에서 자연히 겹치는 행(원본 데이터에 원래 있던 중복)을 화이트리스트로 두고 그 외만 누수로 보는 방식이었습니다. 진단 보고서에서 이걸 S3로 지적했어요. uniqueness 오염이면 train에 같은 행이 더 많이 생겨서 이 방식이 위양성이나 위음성을 낼 여지가 있다고요.

그래서 노트북 02가 split 인덱스를 `data/split_meta/`에 npy로 저장하고, 노트북 03이 두 단계로 검사하게 바꿨습니다([191ca65](https://github.com/gary5876/capstone-dsc/commit/191ca65)). 1차는 train 인덱스와 test 인덱스가 겹치지 않는지, 2차는 행을 md5로 해시해 비교하되 기준선의 자연 중복은 빼는 방식입니다. 둘 중 하나라도 실패하면 RuntimeError로 학습을 멈춥니다.

```python
train_idx = set(np.load(train_idx_p).tolist())
test_idx = set(np.load(test_idx_p).tolist())
idx_overlap = train_idx & test_idx
if idx_overlap:
    print(f'  {ds_name}: ❌ split 인덱스 겹침 {len(idx_overlap)}건 — 02 노트북 split 검증 실패!')
    leakage_found = True
    continue
```

split-first가 만든 부작용도 하나 있었습니다. 점수는 데이터셋 전체에 오염을 넣고 재고, 학습은 train 80%에만 오염을 넣어서 하니 두 트랙이 서로 다른 데이터를 보고 있었어요(진단 보고서 P6). 샘플링이 들어가는 오염에서는 점수가 잰 불균형과 모델이 본 불균형이 달라질 수 있습니다. 4월 25일에 노트북 02의 두 셀을 합쳐 오염은 한 번만 넣고 그 train으로 점수와 학습을 둘 다 하도록 통합했습니다.

이 이후로 정형 데이터 실험 435건은 전부 이 구조 위에서 나왔습니다.

비용은 이렇게만 남아 있습니다. 4월 25일 발표 자료(`documents/reports/20260425-03-발표자료-DSC검증v3.2.md`)에 "ML 파이프라인 수정 시 split-first, 사후 필터링 금지, 실제 데이터 검증 필수"라는 원칙이 "이전 9시간 낭비 사고 후 수립"됐다고 적혀 있습니다. 이 글의 사고를 가리키는 것으로 보이지만, 그 9시간이 어디에 얼마씩 쓰였는지는 적혀 있지 않아요.

이 사고에서 기록으로 남은 사실은 이렇습니다.

1. 오염 도구를 거친 뒤에 나누면 복제된 행이 train과 test로 갈라져 성능이 부풀 수 있고, 사후 필터링은 CSV 저장 때의 정밀도 차이와 오염별 행 수 변화 때문에 같은 행 판정이 흔들려 막지 못했습니다.
2. 고친 구조에서는 test가 오염 도구를 아예 거치지 않고, 학습 직전에 검사 셀이 겹침을 확인합니다. 그 검사는 4월 25일에 인덱스 겹침과 행 해시 두 단계로 조여졌습니다.
3. 고치기 전 오염 학습 결과는 저장돼 있지 않아서, 이 글은 전후 숫자 쌍이 아니라 고친 뒤의 값만 보여 줍니다.
