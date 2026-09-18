---
layout: post
title: "DSC가 노이즈를 '품질 양호'로 읽었다: 데이터 품질 점수의 사각지대와 signal_integrity"
date: 2026-06-03 09:00:00 +0900
categories: [postmortem]
tags: [capstone-dsc, ml, experiment-design, data-quality]
---

capstone-dsc는 팀 캡스톤 프로젝트이고, 데이터 품질 점수(DSC) 엔진과 실험 파이프라인은 내가 단독 담당했다. 질문은 하나였다. 데이터 품질 점수가 그 데이터로 학습한 모델의 성능을 예측하는가. 정형 분류 셀에서는 3개 데이터셋에 5종 오염을 5단계로 주입하고 5개 모델을 학습시켜 435건의 실험으로 r=0.598을 얻었다. 이 글은 그 다음 셀인 이미지 회귀에서, 점수 엔진이 노이즈로 망가진 데이터를 "품질 양호"로 읽고 있었다는 걸 알게 된 날의 기록이다.

**한 번 보고도 넘어갔던 신호**

이미지 회귀 셀은 UTKFace(나이)와 SCUT-FBP5500(미모 점수) 두 데이터셋에 오염 5종을 5단계로 넣어 데이터셋당 26개 설정을 만든다. 6월 2일 오염 sweep에서 각 오염이 표적 지표를 떨어뜨리는지 확인했는데, 네 종은 단조 하락했고 `noise_injection` 하나만 반응이 없었다. `sample_quality_image`가 UTKFace에서 0.97에서 0.98로 오히려 올랐다.

그날 기록에는 이렇게 적었다. "noise_injection 무반응(의도된 한계). 가우시안 노이즈가 Laplacian 분산(선명도)을 오히려 높여 sample_quality를 안 떨어뜨림. 5종 중 1종이라 hold-out과 상관에 지장 없음." 원인까지 알고 있었다. 다만 다섯 중 하나라서 괜찮다고 판단했고, 그 판단은 하루 만에 깨졌다.

**probe로 바꾸자 상관이 무너졌다**

원래 성능 측정은 설정마다 ResNet18을 full finetune하는 방식이었다. 이미지 회귀 한 셀에 GPU 2.5시간이 들었고 Colab 무료 한도에서 중단이 반복됐다. 6월 2일에 ADR-019로 측정을 바꿨다. frozen ResNet18 임베딩을 한 번만 뽑고 그 위에 Ridge, RandomForest, MLP, kNN 네 개의 경량 모델을 fit해서 clean test로 R²를 잰다. 정형 셀은 이미 고정 특징 위 sklearn 모델로 재고 있었으니 같은 프로토콜로 통일하는 셈이었고, 셀당 시간은 한 시간 안쪽으로 내려왔다.

6월 3일 새벽에 그 결과가 나왔다([bbd88c7](https://github.com/gary5876/capstone-dsc/commit/bbd88c7)).

| | 전체 5 polluter | noise_injection 제외 4종 |
|---|---|---|
| UTKFace | r = −0.16 (FAIL) | r = +0.94 |
| SCUT-FBP5500 | r = +0.16 (FAIL) | r = +0.65 |

네 종만 보면 점수와 성능이 강하게 같이 움직였다. `noise_injection` 하나가 전체를 합격선 0.40 아래로 끌어내렸다. 그 설정들에서 DSC는 85에서 87 사이로 평평한데(UTKFace 85.9에서 85.1), Ridge probe의 R²는 0.43에서 0.00으로 무너졌다. 점수는 "멀쩡하다"고 하고 모델은 아무것도 못 배우고 있었다. 정반대였다.

**점수가 보는 것과 노이즈가 망가뜨리는 것**

DSC의 이미지 지표 열 개는 전부 신호를 빼거나 흐리거나 중복시키는 열화를 잡도록 설계돼 있었다. 누락은 completeness, blur는 선명도, 중복은 uniqueness. 정형 데이터의 품질 차원(DQ4AI)을 물려받은 결과다. 가우시안 노이즈는 반대로 가짜 고주파를 더한다. 선명도 담당인 `sample_quality_image`는 Laplacian 분산을 쓰는데, 노이즈가 그 분산을 폭증시켜서 "더 선명하다"로 읽는다. 합성 이미지로 재보니 σ=0일 때 369였던 Laplacian 분산이 σ=60에서 18,324가 됐고 점수는 셋 다 1.000이었다. 노이즈가 심할수록 최대 점수에 박혔다.

왜 finetune 시절엔 안 보였나. finetune은 노이즈에 적응한다. 노이즈 설정에서도 R²가 0.7에서 0.8 사이를 유지했으니 DSC도 평평하고 성능도 평평했다. 둘 다 안 움직여서 우연히 일치했고 gap은 숨었다. frozen 임베딩 위의 probe는 적응하지 못하니 노이즈에 무너졌고, 그제야 점수가 틀렸다는 게 드러났다. 측정을 싸게 하려고 바꾼 설계가 점수 엔진의 한계를 자가진단한 셈이다.

**signal_integrity**

노이즈 강도를 직접 재는 지표를 하나 추가했다([c0c429b](https://github.com/gary5876/capstone-dsc/commit/c0c429b)). Immerkær(1996)의 빠른 노이즈 σ 추정을 쓴다. 3×3 마스크가 엣지 같은 구조를 상쇄하고 노이즈만 남기기 때문에 blur나 디테일에는 반응하지 않고 노이즈 강도에만 반응한다.

```python
# dsc_framework/image_cell.py:469-478
def _immerkaer_sigma(gray_uint8):
    """Immerkær(1996) 빠른 Gaussian 노이즈 sigma 추정. 3x3 마스크가 구조(엣지)를
    상쇄해 노이즈만 추정 → blur/디테일엔 오발 안 하고, 노이즈 강도엔 σ를 복원."""
    from scipy import ndimage
    g = gray_uint8.astype(np.float64)
    N = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], dtype=np.float64)
    conv = ndimage.convolve(g, N, mode='reflect')
    H, W = g.shape
    denom = 6.0 * max(1, W - 2) * max(1, H - 2)
    return float(np.sqrt(np.pi / 2.0) * np.abs(conv).sum() / denom)
```

점수는 `1 − clip(σ̂ / noise_norm, 0, 1)`의 평균이고 `noise_norm=25`는 사전등록했다. 합성 검증에서 clean은 0.99, blur는 0.99로 오발이 없었고, σ=10은 0.76, σ=30은 0.31, σ=60은 0.00으로 강도를 따라 내려갔다. 추정된 σ̂도 10.2, 30.3, 53.7로 실제 값을 거의 복원했다. 후보로 같이 본 MAD-Laplacian은 blur에 오발했고 디노이징 잔차는 clean에 오발해서 버렸다. 가중치는 `sample_quality_image`를 0.15에서 0.10으로 내리고 `signal_integrity`에 0.05를 줘서 합을 1.00으로 유지했다.

Colab을 다시 돌리기 전에 로컬에서 먼저 확인했다. 실제 probe 결과에 노이즈 레벨로 추정한 `signal_integrity` 값을 붙여 가중치 최적화를 돌리니 held-out r이 0.42에서 0.94로 올라왔다. 추정값이라 예측일 뿐이었고, 실측은 재실행에서 확정하기로 했다.

**다시 잰 결과**

같은 날 오후 재실행([888d6ff](https://github.com/gary5876/capstone-dsc/commit/888d6ff))에서 지표가 실데이터의 노이즈를 잡았다. UTKFace 노이즈 설정에서 `signal_integrity`가 0.87에서 0.04로 떨어졌고, 전에는 평평하던 DSC가 86.3에서 80.4로 내려갔다.

| 가중치 | 튜닝(UTKFace) | held-out(SCUT) |
|---|---|---|
| 수정 전 | −0.16 | +0.16 (FAIL) |
| default | +0.49 | +0.67 (PASS) |
| 제약 최적화 | +0.85 | +0.95 (PASS) |

로컬 시뮬레이션이 0.94를 예측했고 실측은 0.951이었다. 최적화된 가중치에서 `signal_integrity`는 0.152로 열 개 지표 중 세 번째로 컸다. 이미지 회귀 셀은 합격선을 통과했다.

**지금 다시 본다면**

같은 종류의 사고가 두 달 전에 한 번 있었다. 4월 12일에는 정형 데이터에 75%까지 오염을 넣어도 점수가 2점도 안 움직이는 걸 발견했고(ADR-008), completeness가 placeholder를 null로 안 세는 식의 구현 문제를 고쳤다. 그때는 지표 구현의 버그였고 이번은 지표 셋의 커버리지 편향이었다. 차감형 열화만 재는 지표 셋은 추가형 열화를 구조적으로 못 본다. 지표 하나를 더한 것으로 이 사각지대는 막았지만, 막은 건 노이즈 하나다. 텍스트 셀의 문자 노이즈에 같은 구멍이 있을 가능성은 보고서에 후속으로만 적혀 있고 확인하지 않았다. 다음 사각지대가 어디인지는 다음 측정 방식이 바뀔 때 또 드러날 것이다.

그리고 6월 2일의 "5종 중 1종이라 지장 없음"은 틀린 판단이었다. 반응이 없다는 신호를 보고 원인까지 적어 놓고도 넘어갔다. 하나가 전체 상관을 깨는 데는 다섯 중 하나면 충분했다.

---

*AI가 한 것: 원인 진단 정리와 후보 지표(Immerkær, MAD-Laplacian, 디노이징 잔차) 비교 실험, `calc_signal_integrity` 구현 초안, 보고서와 커밋 메시지 작성(커밋에 `Co-Authored-By: Claude Opus 4.8` 명시). 내가 한 것: probe 재설계 결정(ADR-019), noise_injection을 한계로 남길지 지표를 보강할지의 선택, Immerkær 채택과 noise_norm 사전등록, 가중치 재배분, Colab 재실행과 합격 판정.*
