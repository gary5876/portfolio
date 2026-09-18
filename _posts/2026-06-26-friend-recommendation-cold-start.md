---
layout: post
title: "친구가 0명인 첫날, 누구를 추천할 것인가"
date: 2026-06-26 15:00:00 +0900
categories: [decisions]
tags: [diet-setlog, recommendation, cold-start, postgresql, redis]
summary: "서비스 첫날엔 친구 관계가 하나도 없는데 친구 추천 목록을 무엇으로 채울지 정한 하루의 기록"
---

안녕하세요, 고준서입니다. 6월 말에 GDG on Campus 전남대에서 디자이너 두 분, 개발자 두 명이 모여 diet-setlog라는 앱을 만들었어요. 음식 사진을 찍으면 Gemini가 칼로리를 읽어 주고, 그 기록을 캘린더에 모으고, 친구들과 피드로 서로 인증하는 앱입니다. 저는 개발 둘 중 한 명이었고, 설계 문서와 이슈를 쓰고 Claude Code로 구현을 돌린 뒤 PR을 읽고 머지하는 쪽이었어요. 이 레포는 첫 커밋부터 그렇게 일하기로 세팅했습니다([8964a9c](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/8964a9c)).

이 글은 그중 "친구 추천"을 정하는 데 걸린 6월 26일 하루의 기록입니다. 코드는 아직 한 줄도 없던 날이에요.

## 초안은 "친구 많은 순, 글 많은 순"

친구 추천이라고 하면 친구 추가 화면에 검색어 없이 들어왔을 때 보여 주는 목록을 말합니다. 그날 오전 11시 46분에 올린 API/DB 설계 초안([b0d04bc](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/b0d04bc))의 §4.6에는 정렬이 이렇게 적혀 있었어요.

> 친구수(`friendCount`) 많은 순 → 활동수(`postCount`=피드에 올린 글 수) 많은 순

그리고 후보는 내 친구 수로 갈랐습니다. 친구가 0명이면 내 카카오톡 친구 중 앱 가입자, 1명 이상이면 친구의 친구. 그럴듯해 보였고, 같은 커밋에 넣은 리서치 다섯 편(Facebook, LinkedIn, Instagram, X, TikTok, Snapchat이 "알 수도 있는 사람"을 어떻게 뽑는지 공개 자료로 조사한 것)의 인덱스에도 "리서치가 이를 뒷받침한다"고 적혀 있었습니다.

## 리서치를 다 읽고 나니 두 군데가 틀렸다

세 시간쯤 뒤인 오후 3시 1분에 올린 결정 기록([ADR 0001](https://github.com/GDG-jnu-DietSetlog/diet-setlog/blob/develop/docs/decisions/friend-recommendation/0001-recommendation-algorithm.md), [22dc5a1](https://github.com/GDG-jnu-DietSetlog/diet-setlog/commit/22dc5a1))은 초안을 뒤집는 내용이었어요. 이 문서는 Claude가 초안을 쓰고 제가 읽고 커밋했고, 트레일러에 그렇게 남아 있습니다.

첫째, 어느 서비스나 1순위 신호로 쓰는 "공통 친구 수"가 초안 정렬에 없었습니다. 둘째, `friendCount`를 "내가 follow한 수"로 세고 있었어요. 그걸 1순위 정렬키로 쓰면 남을 많이 follow한 사람이 맨 위에 옵니다. 인기와는 반대 방향이죠.

그런데 공통 친구 수를 1순위로 올리는 것만으로는 안 됐습니다. 서비스 첫날엔 친구 관계가 통째로 비어 있어서 거의 모든 사용자가 친구 0명이고, 그러면 공통 친구도 친구의 친구도 전부 빈 결과예요. 초안이 믿었던 카카오톡 친구 매칭은 카카오 비즈앱 검수를 통과해야 켤 수 있어서 v1에서는 못 씁니다. 그러니까 런칭 직후 실제로 작동하는 신호는 활동량과 프로필밖에 없었습니다.

## 첫날부터 있는 데이터가 뭔지 세어 보기

그래서 ADR은 "이상적인 알고리즘"이 아니라 손에 쥔 데이터에서 거꾸로 짰습니다. Prisma 스키마 기준으로 즉시 쓸 수 있는 건 `postCount`, 기록의 `eatenAt`, 가입일, 그리고 `Profile`이었어요. 프로필은 앱을 쓰려면 반드시 채우는 단계라 모든 활성 사용자가 나이, 성별, 현재 체중과 목표 체중, 주당 감량 목표, 하루 칼로리 목표를 갖고 있습니다. 그래프가 비어 있어도 작동하는 유일한 개인화 신호였죠.

결정한 점수식은 이렇습니다.

```
// docs/decisions/friend-recommendation/0001-recommendation-algorithm.md §3
score(후보) =
    w1 · mutualFriendCount      // 그래프: P0엔 대부분 0, 그래프 자라면 지배
  + w2 · goalSimilarity         // Profile 기반: 런칭기 주력 (우리만의 도메인 신호)
  + w3 · activityRecency        // postCount + 최근 7일 활동 유무
  + w4 · followerCount          // 인기 (followingCount 아님)
  - w5 · alreadyShownPenalty    // 이미 본/거절 디스카운트 (impression discounting)
tie-break: id
```

`goalSimilarity`는 목표 방향(감량, 유지, 증량)이 같은지에 0.40, 주당 목표 강도가 가까운지에 0.25, 10년 단위 나이대가 같은지에 0.20, 하루 칼로리 목표가 가까운지에 0.15를 두는 0~1 사이 값이에요. 성별은 뺐습니다. 다이어트 동기의 유사성과는 관계가 약하고, 동성끼리만 추천되는 쪽으로 쏠릴 것 같아서요. 그리고 이 값은 정렬에만 쓰고 "왜 추천됐는지"에 상대의 체중이나 목표 수치를 보여 주지 않기로 했습니다.

가중치는 하나로 고정하지 않고 데이터 양에 따라 움직입니다.

| 단계 | 관계 그래프 | 주력 신호 |
|---|---|---|
| 런칭 직후 | 거의 빔 | 목표 유사도, 활동성 (공통 친구는 자동으로 0이라 뒤로 밀림) |
| 관계가 생기기 시작 | 일부 | 친구의 친구가 켜지고 목표 유사도와 섞임 |
| 카카오 검수 통과 | 외부 부트스트랩 추가 | 카카오 친구 매칭이 후보 소스로 합류 |
| 성숙 | 밀집 | 공통 친구 수가 지배, 목표 유사도는 보조 |

*표 1. 알고리즘은 하나이고 가중치만 이동합니다. 리서치 03 §7의 "하드 스위치가 아니라 블렌딩" 패턴을 그대로 가져왔습니다.*

후보도 초안의 "0명이면 카카오, 1명 이상이면 친구의 친구"라는 하드 스위치를 버리고, 친구의 친구, 카카오 친구, 목표/활동 폴백 세 소스를 합집합으로 채우되 부족한 만큼 뒤 소스로 메우게 했습니다. 빈 화면을 막는 게 목적이었으니까요.

카운터는 둘로 쪼갰습니다. `followingCount`는 내가 follow한 수로 친구의 친구를 찾을 때 쓰고, `followerCount`는 나를 follow한 수로 인기 정렬에 씁니다. follow가 일어나면 초안처럼 본인 카운터가 아니라 상대의 `followerCount`가 올라갑니다. 지금 서버 코드도 그렇게 돼 있어요.

```ts
// server/src/modules/friends/friends.routes.ts:267
await tx.user.update({ where: { id: target }, data: { followerCount: { increment: 1 } } });
```

## 페이징이 같이 바뀌었다

정렬키를 바꾸니 딸려 온 문제가 하나 있었습니다. 초안은 `(friendCount, postCount, id)`로 DB 커서 페이징을 하려 했는데, 새 1순위와 2순위인 공통 친구 수와 목표 유사도는 저장된 컬럼이 아니라 계산값이라 인덱스로 정렬할 수가 없어요. 그래서 구조를 "인덱스로 후보를 싸게 좁히고, 그 소수에만 점수를 계산하고, 정렬된 목록을 Redis에 몇 시간 캐시하고, 페이징은 그 캐시 목록 기준"으로 바꿨습니다. 후보를 좁히는 거친 키가 필요해서 `goalDirection`과 `ageBucket`을 `User`에 비정규화하고 인덱스를 걸었고, 친구의 친구 조회에는 `statement_timeout`과 슈퍼노드 컷(친구가 너무 많은 사람은 2단계 확장에서 제외, 기준은 이틀 뒤 spec-lock에서 1,000명으로 확정)을 두었습니다.

이틀 뒤 spec-lock 문서 §8에서 v1은 가중합 대신 정렬키 순서(`mutualFriendCount → goalSimilarity → activityRecency → followerCount → id`)로 단일화하고 상수(`NORM_w = 1.0`, `NORM_cal = 800`, 캐시 TTL 4시간, 시드 사용자 30명)를 박았습니다. 서버의 `friends.routes.ts`는 그 정렬키대로 구현돼 있고, 9월에 코드와 스펙을 대조했을 때 추천 상수는 전부 일치했어요.

다만 ADR 끝에 적어 둔 재검토 트리거(그래프가 자라면 가중치 재조정, 친구의 친구 조회가 느려지면 야간 배치로 이행, 추천 수락률이 낮으면 점수식 재검토)는 하나도 오지 않았습니다. 이 앱은 배포까지 가지 않았고, 시드 사용자 30명 위에서만 돌았거든요. 첫날의 빈 그래프를 어떻게 채울지는 정했지만, 그 첫날은 아직 없습니다.
