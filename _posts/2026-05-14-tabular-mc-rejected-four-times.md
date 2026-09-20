---
layout: post
title: "Tabular MC가 네 번 기각된 진짜 이유: 학습이 아니라 추론 코드 한 줄이었다"
date: 2026-05-14 09:00:00 +0900
categories: [troubleshooting]
tags: [vgc-ai, reinforcement-learning, eval-gates]
description: "이틀 동안 네 번 학습시킨 몬테카를로 정책이 전부 게이트에 걸렸는데, 원인은 학습이 아니라 표에 없는 상황에서 random을 두던 한 줄이었다"
---

안녕하세요, 고준서입니다. vgc-ai는 포켓몬 VGC 대회용 AI를 혼자 만들어 본 개인 프로젝트예요. 이 프로젝트는 처음부터 딥러닝 기반 강화학습을 쓰지 않기로 하고 시작했습니다. 근거는 2024년 대회 3위 팀(AurelianTactics)의 후기였습니다. 그 팀은 딥 RL이 게임의 무작위성 때문에 실패했다고 명시했고, 대신 관측 공간을 11차원으로 줄인 표 기반 first-visit 몬테카를로를 약 3천만 판 돌려서 입상했습니다. 그래서 저장소의 `CLAUDE.md`에도 "Don't reach for deep RL by default"라고 못 박아 두고, 같은 계열인 표 기반 몬테카를로(Tabular MC)를 먼저 해 보기로 했습니다. 정책을 짜고 학습을 돌리는 건 코딩 에이전트인 Claude가 하고, 결과를 받아들일지는 [앞 글]({{ "/blog/2026/05/12/wilson-gate-16-verdicts/" | relative_url }})에서 설명한 통계 게이트가 정합니다.

그 게이트가 5월 12일부터 14일 사이에 Tabular MC를 네 번 연속 기각했습니다. 네 번 다 승률이 0.03에서 0.075 사이였고, 그건 아무 학습도 안 한 random이 내는 숫자와 구별이 안 됩니다. 이틀 동안 원인으로 지목된 건 학습 쪽이었어요. 보상 신호, 상태 키의 거칠기, 위치 번호로 된 행동 키. 닷새 뒤에 드러난 진짜 원인은 그중 어느 것도 아니었습니다. 정책이 표에 없는 상황을 만나면 합법 행동 중 하나를 균등 무작위로 고르는 추론 코드 한 줄이었고, 만 판짜리 표는 성겨서 벤치의 상당수 상황이 그 한 줄로 떨어지고 있었습니다.

이 글은 그 네 번의 기각을 순서대로 놓고, 매번 무엇을 의심했고 그 의심이 왜 승률로 확인될 수 없었는지를 `TASKS.md`의 진단 원문과 커밋 순서로 적습니다. 네 번의 벤치 승률에 random의 몫이 얼마나 섞였는지는 지금도 셀 수 없습니다. 그때 표 밖으로 떨어진 상황의 비율을 기록하지 않았거든요.

## 표 하나에 상황과 행동을 적어 두는 방식

몬테카를로 학습은 한 판을 끝까지 두고 나서 그 판의 결과(이겼으면 +1)를 그 판에서 거친 모든 "상황과 행동" 칸에 돌려주는 방식입니다. 상황은 `encode_state`가 양쪽 포켓몬의 HP 구간, 상태 이상, 남은 수, 날씨를 정수 열 한 개로 줄인 키이고, 행동은 그 상황에서 고를 수 있는 합동 행동(내 포켓몬 두 마리가 각각 뭘 할지) 목록 중 몇 번째냐 하는 번호입니다. 이 번호가 `action_idx`이고, 상황 키마다 번호별 평균 보상을 적어 둔 표가 Q-table입니다. 실전에서는 현재 상황 키를 찾아서 평균이 제일 높은 번호의 행동을 고릅니다.

문제는 그 번호가 위치라는 점입니다. 고를 수 있는 행동 목록은 `get_actions`가 매 턴 새로 만드는데, PP가 떨어진 기술이나 교체 불가 상황에 따라 목록 길이와 순서가 턴마다 달라집니다. 같은 상황 키의 3번 칸이 어떤 판에서는 "서프를 상대 1번 칸에"이고 다른 판에서는 "교체"일 수 있습니다.

## 네 번의 판정

게이트는 학습된 정책이 `greedy`(vgc2 엔진에 들어 있는 기본 정책으로, 한 턴만 내다보고 KO와 데미지를 우선하며 교체는 하지 않습니다)와 200판 붙어서 승률 0.5를 넘고, Wilson 신뢰구간 하한도 0.5를 넘어야 통과입니다. 네 번의 결과는 이랬습니다.

| 날짜 | 바꾼 것 | 승률 | 신뢰구간 하한 | Q-table 키 수 | 학습 시간 |
|---|---|---|---|---|---|
| 05-12 16:21 | 이긴 판만 +1 (첫 시도) | 0.055 | 0.031 | 43,844 | 88초 |
| 05-12 17:11 | 진 판에도 -1 | 0.035 | 0.0171 | 86,805 | 101초 |
| 05-12 17:29 | greedy 상대로 워밍업 | 0.075 | 0.046 | 57,289 | 140초 |
| 05-14 06:49 | action_idx 정규화 | 0.030 | 0.0138 | 42,761 | 148초 |

*표 1. 네 번의 학습과 벤치 결과. 승률은 전부 random이 greedy에게 얻는 0.04 안팎과 구별되지 않습니다.*

네 번 모두 만 판씩 학습했고, 네 번 모두 `random`이 `greedy`에게 얻는 승률(리더보드의 greedy 대 random 95.80%에서 역산하면 0.04쯤)과 구별이 안 되는 숫자입니다. 각 시도의 진단은 에이전트가 `TASKS.md`에 적어 두었고, 저는 그 브랜치들을 머지하지 않고 기각으로 남겼습니다.

## 처음 의심한 곳은 전부 학습 쪽이었습니다

첫 시도의 진단은 세 갈래였습니다. 이긴 판만 보상을 주니 Q값이 올라가기만 하고 내려올 수 없다는 것, 상태 키가 너무 거칠고 `action_idx`가 위치라서 "the same `action_idx` denotes different commands across visits to the same `state_key`"라는 것, 그리고 학습 초반의 자기 대국이 사실상 random 대 random이라는 것이었습니다. 에이전트는 첫 번째를 가장 작은 수정으로 보고 진 판에 -1을 주는 두 번째 시도를 했는데, 승률이 0.055에서 0.035로 오히려 떨어졌습니다. `TASKS.md`에는 "Hypothesis 'loss signal is the smallest principled fix' is falsified"라고 적혀 있습니다. 진단은 +1과 -1이 같은 칸에서 평균되면서 0 근처로 뭉개진다는 것이었고, 그 원인으로 다시 위치 기반 `action_idx`가 지목됐습니다.

세 번째는 처음 5,000판을 `greedy` 상대로 두고 나서 자기 대국으로 넘어가는 워밍업이었습니다. 0.075로 셋 중 제일 높았지만 여전히 0.5와 멀었고, 워밍업 구간에서 greedy를 이긴 판이 5,000판 중 185판(3.7%)뿐이라 학습 신호 자체가 거의 없었습니다.

네 번째가 위치 번호를 없애는 시도였습니다. 행동의 정체로 키를 만들자는 것으로, 각 슬롯의 명령을 "기술이면 그 기술의 시그니처, 교체면 교체 대상 포켓몬의 시그니처"로 바꿔 튜플로 묶었습니다.

```python
# src/vgc_ai/policies/tabular_mc.py:159-174 (브랜치 auto/policy-tabular-mc-canonicalize-action-idx-20260514)
    for slot, cmd in enumerate(joint):
        move_idx, target_idx = cmd
        if move_idx == -1:
            if 0 <= target_idx < len(reserve):
                canon.append((_KIND_SWITCH, _pkm_signature(reserve[target_idx])))
            else:
                canon.append((_KIND_SWITCH, ()))
        else:
            if slot < len(attackers):
                moves = attackers[slot].battling_moves
                if 0 <= move_idx < len(moves):
                    canon.append((_KIND_MOVE, _move_signature(moves[move_idx])))
                else:
                    canon.append((_KIND_MOVE, ()))
            else:
                canon.append((_KIND_MOVE, ()))
```

`cmd`에서 `move_idx`와 `target_idx`를 둘 다 꺼내 놓고, 기술인 경우에는 `_move_signature(moves[move_idx])`만 씁니다. `target_idx`, 즉 그 기술을 상대의 어느 칸에 쓰는지가 키에서 빠졌습니다. 더블 배틀에서 "서프를 상대 0번에"와 "서프를 상대 1번에"는 다른 행동인데 같은 키가 됩니다. 결과는 0.030으로 네 번 중 최저였고, 상태 키 42,761개에 셀이 93,670개였습니다. 에이전트가 표를 뜯어 본 진단은 이렇습니다.

> Root cause: canonical key over-conflates: 64.3% of joint actions collapse to the same key (...) omits the move's target_idx (...) on a tie picks the first matching joint_action, biased toward "always hit opp slot 0" (...) target_idx was lost in transcription.

합동 행동의 64.3%가 다른 행동과 같은 키로 뭉치고, 실전에서는 같은 키 안에서 목록 앞쪽 행동을 고르니 늘 상대 0번 칸만 때리는 정책이 나온 겁니다. 위치 번호를 없애려다 목표 정보를 같이 없앤 셈이고, `TASKS.md`에는 `target_idx`를 키에 넣는 다음 시도(`policy-tabular-mc-canonicalize-action-idx-with-target`)가 제안된 채로 남아 있습니다. 그 시도는 실행되지 않았습니다. 여기까지가 이틀 동안 의심한 곳이고, 전부 학습 쪽이었어요.

## 닷새 뒤에 드러난 것

이 네 번을 다시 보게 만든 건 5월 19일의 다른 작업이었습니다. 정책들끼리 쌍마다 200판씩 붙이는 라운드 로빈 벤치를 만들다가 `tabular_mc` 대 `random`이 정확히 0.500으로 나왔습니다. 학습 안 된 빈 표로 돌린 거라 random과 같은 숫자가 나오는 게 당연했는데, 그 당연함이 문제였습니다. 그때까지 `TabularMCBattlePolicy.decision`은 상황 키가 표에 없으면 합법 행동 중 하나를 균등 무작위로 골랐습니다. 커밋 메시지는 이걸 "empty/sparse-Q-table case"라고 불렀는데, 만 판으로 채운 표도 성긴 상태라 벤치에서 마주치는 상황 상당수가 표 밖으로 떨어졌고, 그때마다 random이 대신 뒀다는 뜻입니다. 네 번의 벤치 승률에는 그 random의 몫이 얼마나 섞여 있었는지 알 수 없습니다.

수정은 PR #22(커밋 `04197cc`, Claude Opus 4.7 공동 작성, 제가 열고 머지)로 들어갔습니다. 빈 칸일 때 random 대신 `GreedyBattlePolicy`에 위임하고, 최소 방문 수 100 미만인 칸은 없는 것으로 치는 게이트를 넣었습니다. 지금 코드는 이렇습니다.

```python
# src/vgc_ai/policies/tabular_mc.py:134-158
    def decision(
        self,
        state: State,
        opp_view: TeamView | None = None,
    ) -> list[BattleCommand]:
        team_pair = (state.sides[0].team, state.sides[1].team)
        joint_actions = get_actions(team_pair)
        if not joint_actions:
            return [(0, 0)] * len(state.sides[0].team.active)

        key = encode_state(state)
        q_row = self._q.get(key)
        n_row = self._n.get(key)
        best_idx = -1
        best_val = float("-inf")
        if q_row is not None and n_row is not None:
            limit = min(len(joint_actions), len(q_row))
            for idx in range(limit):
                if n_row[idx] >= self._min_visits and q_row[idx] > best_val:
                    best_val = q_row[idx]
                    best_idx = idx
        if best_idx < 0:
            fallback: list[BattleCommand] = self._baseline.decision(state, opp_view)
            return fallback
        return list(joint_actions[best_idx])
```

빈 표 기준으로 `greedy` 상대 승률이 0.035에서 0.485로, `random` 상대가 0.500에서 0.980으로 올라갔습니다. 커밋 메시지는 앞선 학습 시도를 다섯 번으로 세면서(`TASKS.md`의 blocked 항목으로 세면 네 번입니다) "all chased downstream symptoms"라고 적었고, `bench/round_robin_battle.md`에는 "a single-line inference bug masquerading as a training problem across five prior iterations"라고 남아 있습니다.

## 진단이 틀린 건 아니었습니다

64.3%는 틀린 숫자가 아닙니다. `target_idx`를 빠뜨린 건 표를 직접 세어서 나온 사실이고, 위치 번호가 행동을 섞는다는 진단도 표의 구조상 맞습니다. 다만 그 진단들이 승률로 확인될 수 있으려면 먼저 "표에 없는 상황에서 뭘 하느냐"가 정해져 있어야 했는데, 그게 random인 채로 네 번을 돌렸습니다. 게이트는 네 번 다 제 역할을 했습니다. 게이트가 재는 숫자가 학습이 아니라 추론 코드 한 줄에 묶여 있었다는 걸 아무도 닷새 동안 확인하지 않았을 뿐이에요.

남은 것도 있습니다. 폴백을 greedy로 바꾼 뒤의 0.485는 "표가 비어 있으면 greedy만큼 둔다"는 뜻이지 학습이 효과를 냈다는 뜻이 아닙니다. 학습된 표가 greedy보다 나은 결정을 얼마나 내는지는, 표 안 상황과 표 밖 상황을 나눠 재야 알 수 있는데 그 벤치는 만들지 않았습니다. `target_idx`를 키에 넣는 다섯 번째 시도도 그대로 제안 상태입니다.

이 네 번에서 제가 다음에 먼저 볼 것은 이렇습니다.

1. 학습 정책의 승률이 random과 구별이 안 되면, 학습을 고치기 전에 "표에 없을 때 뭘 하나"부터 확인해야 합니다. 그 답이 random이면 승률은 학습을 재는 숫자가 아닙니다.
2. 기각된 시도의 진단이 매번 같은 곳(action_idx)을 가리키는데 고쳐도 숫자가 안 움직이면, 진단이 틀린 게 아니라 측정이 그 진단을 볼 수 없는 상태일 수 있습니다.
3. 이 글의 `decision` 코드는 그 확인이 끝난 뒤의 모습입니다. 네 번을 돌리는 동안의 코드에는 `fallback`이 random이었습니다.
