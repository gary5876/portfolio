---
layout: post
title: "AI가 쓴 문장마다 근거가 살아 있는지 기계로 세기"
date: 2026-09-02 09:00:00 +0900
categories: [decisions]
tags: [agent-research, ax, evaluation, grounding]
description: "위키의 사실 주장 30개가 소스 파일과 줄 번호로 지금도 추적되는지를 LLM 없이 채점하는 지표와, 비밀 값 필터 두 개를 같은 하네스에서 비교한 기록"
---

안녕하세요, 고준서입니다. agent-research는 "내 분야에 전문성이 있는 AI 에이전트"를 만들어 보려고 9월 초에 파고 있던 개인 연구 레포예요. 9월 2일 오전, 설계를 시작하기 전에 레퍼런스부터 모으라고 시키고 있었습니다.

> 레퍼런스확보부터 마치고 테스트환경 만들어

> 전체 파이프라인 어떻게 할지 4가지 정도 확보하고, 레퍼런스 갈아끼워가면서 테스트 할 수 있게 환경마련 후 계획세우기

그날 오후에 나온 것이 `eval/` 디렉터리입니다. 설계 문서에는 성공 기준이 글로만 적혀 있었는데, 그중 두 조각을 실제로 돌아가는 코드로 옮긴 거예요. 이 글은 그 두 조각이 뭘 재고 뭘 못 재는지의 기록입니다.

## 첫 번째 조각: 사실 주장이 소스로 추적되는가

설계 문서의 성공 기준 중 하나는 "응답의 사실 주장 각각이 특정 소스로 추적 가능한 비율이 100%에 가까워야 한다"였습니다. 이 레포의 위키는 OpenWiki라는 도구가 만드는데, 위키의 문장마다 어느 소스 파일 몇 번째 줄에서 왔는지가 `repo://경로#L시작-L끝` 형태로 붙어 있어요. 이걸 Claim이라고 부릅니다.

그 기준을 그대로 채점 코드로 옮긴 것이 `grounding_metric.py`예요. 평가 프레임워크(DeepEval)의 커스텀 지표 하나인데, 하는 일은 단순합니다. 가리키는 파일이 아직 있는지, 줄 범위가 파일 안에 있는지, 그 줄들이 비어 있지 않은지.

```python
# agent-expertise-framework/02-self-improvement-loop/eval/grounding_metric.py:43-54
        if not os.path.isfile(full_path):
            return self._fail(f"source file no longer exists: {path}")

        with open(full_path, encoding="utf-8") as f:
            lines = f.readlines()

        if start < 1 or end > len(lines) or start > end:
            return self._fail(f"L{start}-L{end} out of bounds (file has {len(lines)} lines)")

        selected = "".join(lines[start - 1 : end]).strip()
        if not selected:
            return self._fail(f"L{start}-L{end} of {path} is empty")
```

LLM에게 "이 문장이 근거가 있나요"라고 묻는 채점이 아니에요. 파일 시스템만 봅니다. 그래서 API 키가 필요 없고, 같은 입력에는 항상 같은 점수가 나옵니다.

대상은 합성 데이터가 아니라 이 레포의 실제 위키가 가진 Claim 30개 전부였고, 30개 모두 통과했습니다. 반대로 존재하지 않는 줄 번호나 파일을 일부러 넣으면 정확히 0.0으로 떨어지는 것도 따로 확인했다고 README에 적혀 있어요. 통과만 확인하면 "항상 1.0을 주는 지표"와 구분이 안 되니까요.

## 두 번째 조각: 비밀 값 필터를 갈아 끼우며 비교하기

같은 날 실제로 비밀 값이 대화에 노출된 일이 있었습니다. 경위는 여기 적지 않겠습니다. 그 일 때문에 "응답에 비밀 값이 섞이면 걸러내는 필터"가 필요해졌고, 제가 시킨 대로 후보를 갈아 끼우며 비교할 수 있는 구조로 만들었어요. `ResponseFilter`라는 인터페이스 하나에 백엔드를 꽂고, 라벨이 붙은 합성 케이스 5개로 재현율과 오탐을 비교하는 방식입니다. 테스트에 쓴 키는 전부 가짜예요.

꽂은 백엔드는 둘이었습니다. 하나는 의존성 없는 정규식 필터인데, 일부러 얕게 만들었어요. 파일 주석에 이렇게 적혀 있습니다.

```python
# agent-expertise-framework/02-self-improvement-loop/eval/filters/baseline_filter.py:1-6
"""Dependency-free regex-only filter — the "naive first thing someone writes
after one incident" baseline (ADR-3's original "커스텀 regex" alternative that
was rejected in favor of Presidio+NeMo Guardrails+PurpleLlama+portkey-ai/gateway).
Deliberately only covers what the session's one real incident (PEM private key
exposure) and a textbook email regex would catch — no AWS-key pattern, no NER.
The comparison harness (compare_filters.py) is what makes that gap visible."""
```

다른 하나는 Microsoft의 개인정보 탐지 라이브러리 Presidio예요. 결과는 정규식 필터가 재현율 0.75(4건 중 3건, AWS 키 케이스를 놓침), Presidio가 1.00(4건 중 4건)이었고, 무해한 영문과 한글 텍스트에서 오탐은 둘 다 0이었습니다.

| 백엔드 | 재현율 | 오탐 |
|---|---|---|
| 정규식만 (PEM 키, 이메일) | 0.75 (3/4), AWS 키 놓침 | 0 |
| Presidio | 1.00 (4/4) | 0 |

*표 1. 2026-09-02 실행 결과. 합성 케이스 5개.*

케이스 5개는 이랬습니다. 가짜 서비스 계정 JSON(PEM 키와 이메일이 같이 있는 것), 가짜 AWS 액세스 키 한 줄, 이메일만 있는 문장, 비밀 값이 없는 영문 문장, 비밀 값이 없는 한글 문장. 오탐 0은 뒤의 두 무해 케이스에서 아무것도 안 잡혔다는 뜻이에요.

정규식 필터가 AWS 키를 놓친 건 우연이 아니라 설계예요. 사건 하나를 겪은 사람이 그 사건만 막으려고 짜는 필터가 딱 그 모양이고, 비교 하네스가 있어야 그 구멍이 숫자로 보입니다.

## 못 재는 것

README의 "아직 안 한 것" 절이 이 글의 나머지 반입니다.

첫 번째 지표는 "파일과 줄이 지금 존재하는가"만 봅니다. OpenWiki는 줄 내용의 해시까지 기록해서 내용이 바뀌었는지도 잡는데, 이 지표는 그걸 재구현하지 않았어요. 줄 번호는 그대로인데 내용이 바뀐 경우를 못 잡습니다.

필터 비교도 후보 둘뿐이에요. 문서에 적어 둔 다른 후보들(NeMo Guardrails, PurpleLlama, Guardrails AI, 게이트웨이)은 GPU나 API 키가 필요해서 아직 안 꽂았습니다. 인터페이스만 구현하면 목록에 추가하는 것으로 끝나게 만들어 두긴 했지만, 만들어 둔 것과 돌려 본 것은 다르죠.

그리고 설계 문서의 루프는 여섯 단계인데 지금 있는 건 그중 재료 두 조각입니다. README는 그걸 "루프의 ②부터 ⑥, 배포 전 게이트, 배포 후 모니터링, 원인 라우팅, 재검증은 전혀 연결 안 됐다, 지금 있는 건 루프의 재료 중 두 조각뿐이다"라고 적어 뒀어요. 두 지표 다 위키를 실제로 다시 쓰는 자리에 물려 있지 않다는 뜻이라, 지금까지 잡은 건 일부러 망가뜨려 넣은 테스트 케이스뿐입니다. 실제 위키 생성 과정에서 이 지표가 뭔가를 실제로 걸러낸 사례는 아직 없어요.

이틀 뒤에 제가 다시 물은 건 이거였어요.

> 참고할 자료도 없고, 테스트해본 데이터도 없고 이말이이지?

코드와 README는 Claude가 쓰고 제가 검토해 9월 5일 커밋([a15f7b9](https://github.com/gary5876/agent-research/commit/a15f7b9))에 함께 올렸습니다. 실행 결과 숫자는 그날 README에 적힌 그대로예요.
