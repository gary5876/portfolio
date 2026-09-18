---
layout: post
title: "meta-aware 전략 전부가 빈 meta로 벤치되고 있었다: set_meta를 한 번도 부르지 않은 하네스"
date: 2026-05-22 09:00:00 +0900
categories: [postmortem]
tags: [vgc-ai, benchmarking, eval-gates]
---

vgc-ai는 개인 프로젝트다. GCP VM 위에서 코딩 에이전트가 전략을 제안하고 구현하면, 벤치 루프가 돌리고 리뷰어 루프가 게이트로 판정한다. 이 글은 그 벤치 루프가 이틀 동안 meta를 읽는 전략들을 전부 빈 meta로 재고 있었다는 걸 알게 된 날의 기록이다. 정책이 아니라 측정 도구가 틀려 있었다.

**결과가 이상하게 평평했다**

Championship 트랙은 상대 메타의 사용률을 읽어 팀을 짜고 선출을 정하는 트랙이다. 5월 20일과 21일에 에이전트가 메타를 읽는 컴파운드를 연달아 올렸다. 사용률로 공격 점수를 가중하는 `minimax+meta_weighted_selection`([PR #31](https://github.com/gary5876/vgc-ai/pull/31)), 거기에 최악의 위협 방어를 합친 `minimax+meta_threat_aware_selection`([PR #34](https://github.com/gary5876/vgc-ai/pull/34)), 그리고 페어 커버리지와 스피드 티어 변형이 뒤따랐다. 전부 "메타가 없으면 부모 정책으로 폴백한다"는 설계라 최악이 동률이었고, 메타가 있으면 나아야 했다.

그런데 이틀 동안 기본값을 바꾸자는 PR이 하나도 열리지 않았다. 리뷰어 루프는 `championship.csv`에서 후보 대 기본값 행을 풀링해 `ci95_low > 0.5`면 승격 PR을 여는데, 그 조건을 넘는 후보가 없었다. 기본값은 여전히 메타를 읽지 않는 `minimax+matchup_aware`였다.

**하네스를 열어보니**

원인은 벤치 드라이버였다. `bench/run_strategy_tournament.py`의 `championship` 서브커맨드는 두 경쟁자를 `Match`로 붙이면서 팀 생성기를 넘긴다.

```python
# bench/run_strategy_tournament.py:262-268
match = Match(
    cm,
    n_active=2,
    n_battles=max(1, n_battles // 2),
    gen=gen_team,
    params=BattleRuleParam(),
)
```

vgc2 프레임워크에서 `gen`을 넘기면 `Match._run_random`으로 간다. 이 경로는 매 판 새 팀을 뽑아 배틀만 돌린다. 반면 `Championship` 생태계가 쓰는 `_run_non_random`은 배틀 전에 메타를 주입한다.

```python
# vgc2/competition/match.py:114-118
if self.meta is not None:
    selector[0].set_meta(self.meta)
    agent[0].set_meta(self.meta)
    selector[1].set_meta(self.meta)
    agent[1].set_meta(self.meta)
```

`_run_random`에는 이 다섯 줄이 없다. `set_meta`가 한 번도 불리지 않으니 모든 메타 컴파운드의 `meta`는 `None`이었고, 설계대로 부모 정책으로 폴백했다. 선출 정책의 가중치 함수가 그 폴백을 정확히 문서화하고 있었다.

```python
# src/vgc_ai/policies/selection.py:166-175
if meta is None or not opp_team.members:
    return None
try:
    raw = [meta.usage_rate_pokemon(opp.species) for opp in opp_team.members]
except ZeroDivisionError:
    return None
```

`None`이 돌아오면 호출자는 균등 점수로 돌아간다. 즉 `meta_threat_aware`는 벤치 안에서 `matchup_aware`와 같은 정책이었다. 기본값과 같은 정책이 기본값을 못 이기는 건 당연했다. 결과가 평평했던 게 아니라, 측정이 차이를 만들 수 없는 구조였다.

**왜 아무도 몰랐나**

폴백 설계가 버그를 가렸다. "메타가 없으면 부모로 폴백"은 에포크 0에서 `usage_rate_pokemon`이 `ZeroDivisionError`를 내는 프레임워크 특성 때문에 넣은 방어였고, 방어가 잘 동작한 덕에 아무 예외도 로그도 없었다. 벤치는 매 사이클 정상 종료했고 CSV는 채워졌다. 숫자가 나오니 게이트도 정상 판정을 내렸다. 잘못된 입력으로 올바르게 계산한 결과였다.

발견은 정책 쪽 작업에서 나왔다. 배틀 정책 `HeuristicDet`에 `set_meta`를 붙이는 작업(Phase 1b)을 준비하면서 Championship 기반의 임시 드라이버로 재벤치를 돌렸고, 그 결과가 기존 벤치와 달랐다. 그 차이를 추적하다 `_run_random` 경로가 드러났다. [PR #41](https://github.com/gary5876/vgc-ai/pull/41) 본문의 "Why now" 절과 커밋 메시지의 Methodology note가 그 시점의 기록이다. 이 PR은 에이전트가 작성했고 내가 검토해 머지했다. 누가 먼저 알아챘는지는 기록으로 구분되지 않아서 여기서도 구분하지 않는다.

**championship_real**

같은 날 세 개의 PR로 정리했다. [PR #41](https://github.com/gary5876/vgc-ai/pull/41)은 `HeuristicDet`에 `set_meta`를 붙이고, 임시 드라이버의 2시드 결과로 기본값을 `meta_threat_aware`로 올렸다. [PR #42](https://github.com/gary5876/vgc-ai/pull/42)는 구조적 수정으로, `championship_real` 서브커맨드를 추가했다. 1단계에서 모든 경쟁자를 `Championship`에 등록해 `BasicMeta`를 채우며 에포크를 돌리고, 2단계에서 데워진 메타로 기본값 대 도전자 쌍을 붙인다. 출력 스키마는 그대로 둬서 리뷰어와 프로포저가 손대지 않고 읽는다. 기존 `championship` 서브커맨드는 "메타 없는 기준선"으로 남겼다. [PR #43](https://github.com/gary5876/vgc-ai/pull/43)은 VM 루프 스크립트를 바꿨고, 스크립트 머리에 이유를 적어뒀다.

```sh
# ops/run_bench.sh:14-17
#                            championship_real (not championship) is used
#                            because the latter routes to Match._run_random
#                            and never calls set_meta — every meta-aware
#                            compound would be tested with empty meta.
```

VM 루프는 매 사이클 `git pull`로 시작하므로 다음 사이클부터 새 드라이버가 돌았다.

**다시 잰 결과**

메타를 채우고 다시 재자 전략 사이에 차이가 생겼다. 50 에포크, 12 경쟁자, 시드 두 개로 돌린 결과에서 `minimax+meta_threat_aware_selection`은 이전 기본값보다 시드 2026에서 +101 ELO, 시드 2027에서 +246 ELO 앞섰다. 반면 `principled_coverage+matchup_aware`는 시드 2026에서 1위였다가 시드 2027에서 7위로 떨어졌다. 763 ELO 차이였다. 시드 하나만 봤으면 이걸 승격시켰을 것이다. 두 시드에서 모두 상위였고 분산이 낮은 후보만 올리기로 하고 `meta_threat_aware`를 기본값으로 정했다. 이 후보가 상위권 중 유일하게 실제로 `set_meta`를 통해 메타를 읽는 컴파운드였다는 점도 판단에 들어갔다.

**지금 다시 본다면**

교훈은 정책이 아니라 순서에 있다. 후보 여러 개가 연속으로 기본값을 못 넘으면 후보를 더 만들기 전에 측정기가 차이를 만들 수 있는 구조인지부터 봐야 했다. 이틀 동안 에이전트는 새 컴파운드를 계속 제안했고 나는 그걸 승인했다. 같은 벤치를 같은 방식으로 더 돌린다고 답이 나올 상황이 아니었는데, 둘 다 측정을 의심하지 않았다.

폴백 설계 자체도 다시 보게 된다. "메타가 없으면 조용히 부모로"는 운영 안전에는 맞지만 벤치에서는 위험하다. 메타가 비어 있는 채로 벤치가 끝났다는 사실을 경고 한 줄로라도 남겼다면 이틀은 하루가 됐을 것이다. 그리고 이 글의 재벤치는 2시드였다. 며칠 뒤 자동 승격 루프가 15판에서 30판짜리 풀링으로 기본값을 일곱 번 바꾸는 일이 생기는데, 그건 측정기를 고친 뒤에도 표본이 작으면 같은 일이 반복된다는 이야기라 따로 적는다.

---

*AI가 한 것: 메타 컴파운드 제안과 구현, 임시 드라이버 재벤치, `championship_real` 구현과 VM 루프 변경, PR 본문 작성(커밋에 `Co-Authored-By: Claude Opus 4.7` 명시). 내가 한 것: 후보 승인과 PR 검토 및 머지, 2시드 결과에서 분산이 낮은 후보만 승격한다는 판단 승인, 기존 `championship`을 기준선으로 남기는 결정.*
