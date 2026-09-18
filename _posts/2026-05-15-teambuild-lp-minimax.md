---
layout: post
title: "팀빌딩을 LP로 푼 이유: 그리디 커버리지와 Nash 혼합전략, +111 ELO"
date: 2026-05-15 09:00:00 +0900
categories: [study]
tags: [vgc-ai, linear-programming, game-theory, scipy]
---

vgc-ai는 개인 프로젝트다. Championship 트랙에서는 배틀을 하기 전에 30종 로스터에서 팀에 데려갈 4종을 골라야 하는데, 상대가 무엇을 데려올지는 모른다. 2026년 5월 14일 하루 동안 이 팀빌딩 정책을 세 번 바꿨고, 마지막 버전은 선형계획법으로 zero-sum 게임의 Nash 혼합전략을 풀어 그 확률질량으로 종을 고른다. 왜 그리디로 시작해서 LP까지 갔는지, 그리고 +111 ELO라는 숫자가 실제로 어떤 모양이었는지 적는다.

**문제: 상대를 모르는 채로 4종을 고른다**

로스터는 매 챔피언십마다 무작위로 30종이 주어진다. 각 참가자는 그중 `max_team_size`(4)종을 골라 팀을 만들고, 배틀마다 그 팀에서 2종을 선출해 싸운다. 팀빌딩 시점에 쓸 수 있는 정보는 로스터 자체와, 에포크가 진행되면 쌓이는 상대들의 사용률(meta)뿐이다. 첫 에포크에는 meta도 비어 있다. 즉 "상대가 뭘 고를지 모르는 상태에서 잘 버티는 4종"을 뽑는 문제다.

**첫 시도: 사용률 상위, 그리고 타입 커버리지의 부정 결과**

첫 팀빌더([PR #12](https://github.com/gary5876/vgc-ai/pull/12))는 meta의 종별 사용률 상위 4종을 고르고, meta가 비어 있으면 종족값 합으로 대신했다. 무작위 팀빌더 상대로 5에포크 15전 전승, +177 ELO였다. 기준선이 무작위였으니 이기는 게 당연했고, 이 숫자는 이후 모든 후보의 "무작위는 이기는가" 검사 기준이 됐다.

두 번째 시도는 타입 차트였다. 후보 종을 넣었을 때 팀의 공격 커버리지에서 약점을 뺀 값이 얼마나 늘어나는지를 사용률 점수에 가중해 더하는 그리디였다([PR #15](https://github.com/gary5876/vgc-ai/pull/15)). 5시드 결과는 −30, +72, +98, −47, −111, 평균 −4 ELO였다. 가중치를 0.4로 두면 −32, 0.15로 낮추면 −4. PR 본문에 "Honest negative result"라고 적고 닫았다. 코드는 남겼지만 기본값은 바꾸지 않았다. 이 PR이 남긴 결론 한 줄이 다음 방향을 정했다. 타입 차트 휴리스틱을 더 만들 게 아니라, 실제 배틀 시뮬레이션으로 로스터 간 매치업 표를 만들고 그 위에서 LP나 GA를 돌리라는 것이었다.

**매치업 표: 종 대 종을 열 판씩 붙여 본다**

세 번째([PR #16](https://github.com/gary5876/vgc-ai/pull/16))는 로스터의 모든 순서쌍 (i, j)에 대해 1대1 배틀을 열 판씩 돌려 승률 행렬 M을 만든다. 양쪽 다 `GreedyBattlePolicy`로 싸우고, `M[i][j]`는 i가 j를 이긴 비율, 대각선은 0.5다. 대칭성을 써서 절반만 계산한다.

```python
# src/vgc_ai/eval/matchup_table.py:1-12
"""Roster x Roster 1v1 matchup table built from actual battle simulation.

For each ordered pair (i, j) of distinct species in the roster, run
``n_battles_per_pair`` singleton-vs-singleton battles (one-mon teams,
``n_active=1``) with both sides playing ``GreedyBattlePolicy``. Return an
``N x N`` matrix where ``M[i][j]`` is species i's win rate against j over
those battles. Diagonal is 0.5 by convention.

Singleton battles are an approximation of the doubles-actually-played
contest format — they ignore positioning and double-targeting — but they
isolate raw 1v1 typing + stat + move synergy, which is the only signal the
team-build pre-game has. The table is computed once per roster and cached.
"""
```

이 표 위에서 그리디로 골랐다. 첫 종은 행 평균이 가장 높은 종, 그다음은 팀이 각 상대에게 낼 수 있는 최고 승률 `max_t(M[t][j])`의 평균을 가장 많이 올리는 종이다. 사용률 상위 빌더와 10시드 대결에서 평균 +127 ELO, 7시드 양수였다. 표 하나 만드는 데 30종 기준 약 5초라 챔피언십당 한 번만 계산하고 캐시했다.

**LP: 최악의 상대를 가정하고 섞는다**

같은 날 저녁 네 번째 버전([PR #20](https://github.com/gary5876/vgc-ai/pull/20))이 기본값이 됐다. 그리디 커버리지는 "이길 수 있는 상대의 수"를 늘리지만, 로스터에 가위바위보 구조가 있으면 한 갈래에 몰아 넣는 경향이 있다. 대신 매치업 표를 zero-sum 게임의 보수 행렬로 보고, 행 플레이어의 max-min 전략을 LP로 풀었다. 변수는 최악의 보수 v와 각 종을 고를 확률 p이고, 모든 상대 열 j에 대해 v가 p로 가중한 승률 이하가 되도록 두고 v를 최대화한다. 정식화는 도크스트링에 그대로 있다.

```python
# src/vgc_ai/policies/teambuild.py:263-267
        variables x = [v, p_0, ..., p_{n-1}]
        minimize   -v             (i.e. maximize the worst-case payoff)
        subject to v - p^T M[:, j] <= 0   for each column j
                   sum(p) = 1
                   p_i >= 0,  v unbounded
```

풀이는 `scipy.optimize.linprog`에 맡겼다. 이 LP의 형태는 대회 주최자 Reis가 공개한 `vgc-agents/teambuilders.py:get_policy`와 같다. 30종이면 10ms 안에 풀린다. 나온 p는 "어떤 종을 어떤 확률로 섞어야 최악의 상대에게도 v를 보장하는가"인데, 여기서 한 가지를 의도적으로 버렸다. 확률대로 뽑지 않고 p가 큰 순서로 4종을 결정적으로 고른다.

```python
# src/vgc_ai/policies/teambuild.py:318-321
    p = _solve_minimax_policy(table)
    row_mean = table.mean(axis=1)
    order = sorted(range(n), key=lambda i: (-p[i], -row_mean[i], i))
    return order[:max_team_size]
```

도크스트링에 이유를 적어 뒀다. LP 가중치를 매번 굴리는 샘플링 분포가 아니라 "데려갈 종의 순위"로 취급한다는 것, 호출마다 무작위가 섞이면 캐시가 깨지고 4종 사전 선택 문제에서는 그럴 필요가 없다는 것이다.

**+111 ELO의 실제 모양**

이전 기본값(그리디 커버리지)과 10시드 대결 결과다. 표는 그리디 시점에서 본 ELO 차이라 음수가 minimax의 승리다.

| 시드 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 평균 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ELO 차이 | +344 | +11 | −271 | −423 | −354 | +255 | −423 | −26 | +11 | −238 | −111 |

minimax가 이긴 시드는 6개, 그중 2개는 전승(−423)이다. 그러나 시드 1과 6에서는 그리디가 +344, +255로 크게 이겼고, 시드 2와 9는 +11로 사실상 동률이다. 범위가 −423에서 +344까지 767 ELO 폭이다. 챔피언십 한 번이 만드는 종간 배틀이 30판 정도라 ELO 자체의 분산이 크다. 평균 +111과 6/10을 근거로 승격했지만, 4개 시드에서 졌다는 사실은 그대로다. PR 본문도 "championship-level variance"라고 적고 있다.

**그다음: Nash와 meta 사이**

일주일 뒤 2시드 재벤치([PR #41](https://github.com/gary5876/vgc-ai/pull/41))에서 순수 Nash 빌더는 중위권이었고, 관측된 meta에 최적 대응하는 빌더는 최하위였다. 상대는 완전히 적대적이지도(Nash가 너무 비관적) 완전히 예측 가능하지도(최적 대응이 너무 취약) 않았다. 그래서 [PR #48](https://github.com/gary5876/vgc-ai/pull/48)에서 목적함수를 (1 − blend) × v + blend × (meta 최적 대응 보수)로 섞은 `MinimaxMetaTeamBuildPolicy`를 추가했다. 기본 blend는 0.5이고, meta가 없으면 순수 Nash와 비트 단위로 같은 결과를 내도록 했다. 이 값이 실제로 낫다는 증거는 아직 없다. 도크스트링에도 "Worth A/B-ing if signal warrants"라고만 적혀 있다.

**지금 다시 본다면**

매치업 표 자체가 열 판짜리다. 한 쌍의 승률을 10판으로 추정하면 표의 각 칸이 ±0.15쯤 흔들리고, LP는 그 흔들리는 표를 정확한 값처럼 푼다. 표를 더 정확하게 만들려면 판 수를 늘려야 하는데, 그러면 5초짜리 사전 계산이 분 단위가 된다. 그리고 결정적 상위 N 선택은 혼합전략의 핵심인 "섞어서 읽히지 않는다"를 버린 것이다. 상대가 내 로스터를 알고 내 빌더가 결정적이라는 걸 알면, 내 4종은 예측 가능하다. 대회 환경에서는 그런 상대가 없었지만, 이론이 보장하는 것과 구현이 보장하는 것이 다르다는 건 알고 써야 했다. 마지막으로, 10시드 중 4시드에서 진 결과를 "분산"이라고 부르고 넘어갔는데, 그 시드들의 로스터에 무슨 구조가 있었는지는 보지 않았다.

---

*AI가 한 것: 네 팀빌더의 구현, 매치업 표 생성기, 벤치 실행과 PR 본문 작성(커밋에 `Co-Authored-By: Claude Opus 4.7` 명시). 내가 한 것: scipy 의존성 추가 승인, 각 PR의 검토와 머지, 부정 결과 PR #15를 닫되 코드는 남기기로 한 결정, 승격 판단.*
