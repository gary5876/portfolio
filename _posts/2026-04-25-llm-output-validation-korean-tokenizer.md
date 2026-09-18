---
layout: post
title: "LLM 출력은 그대로 믿지 않는다: 검증 파이프라인과 그 한계, 한글 토큰화 버그"
date: 2026-04-25 09:00:00 +0900
categories: [study]
tags: [study-helper, llm, validation, fastapi]
---

study-helper는 PDF를 올리면 LLM으로 학습 노트와 객관식 문제를 만들어 주는 개인 프로젝트다. 처음부터 LLM 응답을 그대로 저장하지 않고 검증기를 통과한 문제만 남기도록 만들었는데, 서비스를 한 달 넘게 운영한 뒤에야 그 검증기의 절반이 한글에서는 아무 일도 하지 않고 있었다는 걸 알았다. 무엇을 검사하고 있었고, 무엇이 검사되지 않았고, 고친 코드가 왜 지금도 운영에 없는지를 적는다.

**세 프로바이더, 검증기는 하나**

생성 파이프라인은 사용자가 고른 플랜에 따라 Claude, GPT, TimelyGPT 중 하나를 부르지만, 응답은 전부 같은 검증기로 들어간다. `app/routers/generate.py`는 플랜별로 클라이언트만 바꾸고 결과는 `validate_notes`, `validate_mcq`, `validate_fill`에 넘긴다(149, 190, 191행). 어느 모델이 만들었든 저장 여부는 이 함수들이 정한다. 검증기 자체는 3월 19일 첫 커밋부터 있었고, 토큰화 부분은 4월 25일까지 한 번도 바뀌지 않았다.

**객관식 한 문제가 통과해야 하는 다섯 가지**

`validate_mcq`는 문제 하나를 버릴지 남길지를 순서대로 판단한다. 첫째, A부터 D까지 네 보기가 전부 비어 있지 않아야 한다. 둘째, 네 보기가 서로 달라야 한다. 셋째, 정답은 A, B, C, D 중 하나여야 한다. 여기까지 하나라도 걸리면 경고 로그를 남기고 그 문제를 건너뛴다. 넷째는 해설 검사다. 해설이 20자 미만이면 "The correct answer is X."로 대체하고, 30어절이 넘는 해설은 원문과 키워드가 얼마나 겹치는지 본다.

```python
# app/services/response_validator.py:198-204
        # Hallucination check on explanation
        overlap = _keyword_overlap(explanation, source_text)
        if len(explanation.split()) > 30 and overlap < 0.15:
            logger.warning(
                "MCQ %s: explanation keyword overlap=%.2f (possible hallucination).", q["id"], overlap
            )
            # Don't skip — just log. Partial result is better than empty.
```

겹침이 15% 미만이면 환각 가능성으로 경고만 남기고 문제는 살린다. 빈 결과보다 부분 결과가 낫다는 판단이었고, 주석에 그렇게 적어 뒀다. 다섯째는 근사 중복이다. 앞서 통과한 문제들과 토큰 집합의 Jaccard 유사도가 0.70을 넘으면 같은 문제로 보고 버린다. 네 번째와 다섯 번째가 이 글의 주제다. 둘 다 `_tokenize`에 기대고 있었다.

```python
# app/services/response_validator.py:28-39
def _tokenize(text: str) -> set[str]:
    """Simple word tokenizer for keyword overlap checks."""
    return set(re.findall(r"\b[a-zA-Z]{4,}\b", text.lower()))


def _keyword_overlap(text_a: str, text_b: str) -> float:
    """Return fraction of text_a's keywords present in text_b."""
    a = _tokenize(text_a)
    b = _tokenize(text_b)
    if not a:
        return 1.0
    return len(a & b) / len(a)
```

**한글 문장에서 토큰은 0개다**

정규식은 영문 알파벳 네 글자 이상만 단어로 본다. 한글로 된 해설이나 문제 문장을 넣으면 반환값은 빈 집합이다. 그 다음 줄이 결과를 정한다. 해설 토큰이 비어 있으면 `_keyword_overlap`은 1.0을 돌려주고, 15% 미만이라는 조건은 절대 성립하지 않는다. 환각 경고는 한글에서 한 번도 뜨지 않았다. 중복 검사도 마찬가지다. 두 문제의 토큰 합집합이 비어 있으면 `if union and ...` 조건이 거짓이 되어 유사도 계산 자체를 건너뛴다. 어떤 한글 문제도 중복으로 잡히지 않았다.

방향이 중요하다. 두 검사 모두 "전부 통과"로 무력화됐다. 전부 실패하는 쪽이었다면 첫날 알았을 것이다. 그리고 이 서비스의 기본 언어는 한국어다. 요청 스키마의 `lang` 기본값이 `"ko"`이고(`schemas.py:152`) 실제 사용자 대부분이 한글 PDF를 올렸으니, 검증기의 다섯 항목 중 둘은 대부분의 트래픽에서 장식이었다.

**어떻게 알았나**

버그 리포트가 아니라 비교에서 나왔다. 4월 25일에 다른 프로젝트에서 손으로 큐레이션한 문제 은행과 study-helper가 런타임에 만든 문제를 나란히 놓고 봤더니 품질과 다양성 차이가 컸다. 그 원인을 코드에서 찾는 계획 문서를 쓰다가 2.5절에서 이 함수를 만났다. 문서에는 위치를 `response_validator.py:31`로 적고, 한글 토큰은 전혀 잡히지 않는다는 것과 그 결과 해설의 환각 검사와 중복 검사가 사실상 무력화 상태라는 것을 적었다. 우선순위는 높음, 이유는 "기존 사용자에게도 이미 영향"이었다. 착수 순서에서도 이 항목이 1번이었고 예상 시간은 20분이었다.

**고친 코드**

같은 날 브랜치 `feat/question-quality-phase-a`에 커밋 [a923b21](https://github.com/gary5876/study-helper-backend/commit/a923b21b69921e1118c81bfac93df1bd1847feaa)로 고쳤다. 정규식에 한글 두 글자 이상을 추가하고 영문 기준도 세 글자로 낮췄다. 중복 임계는 0.70에서 0.60으로 내렸는데, 그 이유를 상수 옆에 적어 뒀다.

```python
_TOKEN_RE = re.compile(r"[a-zA-Z]{3,}|[가-힣]{2,}")

# Korean inflectional endings make token sets diverge more than English even
# when two questions ask the same thing ("무엇입니까" vs "무엇인가요"). Empirically
# 0.70 is too strict — a near-duplicate Korean pair lands around 0.65–0.70.
_DUP_JACCARD_THRESHOLD = 0.60
```

어절 단위로 자르면 "무엇입니까"와 "무엇인가요"는 다른 토큰이라, 같은 질문인데도 유사도가 0.65에서 0.70 사이로 떨어진다. 그래서 0.60이다. 형태소 분석기를 붙이는 대신 임계값을 내린 건 의존성을 늘리지 않으려는 선택이었고, 그만큼 거친 근사다. 테스트는 한글 토큰화 네 개와 한글 중복 한 개를 새로 넣었다. 중복 테스트는 정확히 그 어미 쌍, "코틀린에서 val과 var의 차이점은 무엇입니까?"와 "무엇인가요?"를 넣어 두 번째가 버려지는지 본다. 검증기 테스트 39개가 통과했다.

**그런데 운영 코드는 그대로다**

이 커밋은 지금도 그 브랜치에만 있다. `git log origin/develop..origin/feat/question-quality-phase-a`에 a923b21 하나가 남아 있고, develop의 `_tokenize`는 여전히 `[a-zA-Z]{4,}`, 임계는 0.70이다. develop의 검증기 테스트 파일에는 한글이 한 줄도 없다. 4월 25일 이후 develop에 들어간 건 5월 5일 CI 워크플로 분리와 6월 23일 GCP Cloud Run 이전뿐이다.

더 어긋난 곳이 있다. 4월 30일에 CodeRabbit을 붙이면서 쓴 `.coderabbit.yaml`은 서비스 코드를 리뷰할 때 한글 토큰화 정규식 `[a-zA-Z]{3,}|[가-힣]{2,}`와 중복 임계 0.60을 기준으로 보라고 적어 뒀고, 테스트 경로에는 "한글 케이스 누락"을 잡으라고 적어 뒀다. 리뷰 기준은 브랜치의 코드이고, 리뷰 대상은 develop의 코드다. 그 기록의 후속 항목에는 "Phase A 잔여 작업 머지 시 CodeRabbit 리뷰가 1차 검증으로 작동하는지 확인"이라고 돼 있다. 머지는 계획에 있었다. 왜 하지 않았는지는 어느 문서에도, 어느 커밋에도 없다. 5월 이후 이 프로젝트의 확장을 멈춘 시점과 겹치지만 그건 정황이지 기록이 아니다.

**지금 다시 본다면**

검증기는 LLM을 의심하라고 만든 코드인데, 검증기 자체를 의심하는 코드는 없었다. 한 달 넘게 한글 트래픽을 받으면서 환각 경고가 단 한 번도 안 떴다면 그건 모델이 완벽해서가 아니라 검사가 안 도는 것인데, 경고 횟수를 세는 지표가 없었으니 "0건"이 이상하다는 걸 알 방법이 없었다. `_keyword_overlap`이 토큰 없음을 1.0으로 돌려주는 설계도 다시 보인다. 판단할 수 없음을 통과로 해석하는 기본값은, 판단할 수 없는 경우가 대부분일 때 검사를 없애는 것과 같다.

그리고 고친 코드가 브랜치에 남은 채로 서비스가 멈췄다. 이 글을 쓰는 시점에 공개 레포의 develop을 열면 버그가 있는 버전이 보이고, 설정 파일은 고친 버전을 기준으로 리뷰하라고 말한다. 둘 중 하나를 맞추는 커밋 하나면 되는 일을 5개월째 하지 않았다.

---

*AI가 한 것: 검증기의 첫 구현과 이후 수정 커밋 작성(커밋에 Claude Sonnet 4.6, Claude Opus 4.7 Co-Authored-By 표기), 4월 25일 개선 계획 문서와 Phase A 코드 및 테스트 초안. 내가 한 것: 손으로 만든 문제 은행과 생성 결과를 비교해 품질 차이를 문제로 정의한 것, 한글 버그를 1순위로 올린 결정, 형태소 분석기 대신 임계값 조정으로 가기로 한 선택, 그리고 브랜치를 머지하지 않은 채 둔 것.*
