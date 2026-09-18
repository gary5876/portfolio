---
layout: post
title: "공개 통계의 재식별 방지: 버킷별 마스킹을 버리고 총합 기준으로"
date: 2026-08-10 09:00:00 +0900
categories: [study]
tags: [team18-be, privacy, statistics, spring-boot]
---

동아리움(Team18_BE, 팀 프로젝트, 백엔드 3인)에서 통계 도메인은 내가 전담했다. 지원폼별로 성별, 학부, 학번, 일자별 지원 추이를 집계해 지원자에게 공개하는 API인데, 설계 이슈([#335](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/335))를 쓸 때는 개인정보 문제를 가볍게 봤다. 구현하면서 원안을 세 군데 뒤집었고, 그중 재식별 방지를 어떻게 바꿨는지 적는다.

**공개 통계가 왜 개인정보 문제가 되나**

통계는 비로그인 상태에서도 볼 수 있다. 원안에서는 "단일 대규모 학교이므로 조합이 개인이 아닌 코호트 수준까지만 좁혀지고, 동아리 지원 사실 자체가 민감 정보에 해당하지 않아 위험도는 낮다"고 썼다. 대신 소수 버킷은 가리기로 했다. 특정 dimension에서 `0 < count < k`인 버킷을 마스킹하고 나머지는 '기타'로 병합하는 per-bucket 방식이었다.

**버킷별 마스킹의 구멍: 빼기 한 번이면 복원된다**

구현 단계에서 이 방식이 동작하지 않는다는 걸 알았다. 한 dimension에서 소수 버킷이 하나만 가려지면, 응답에 그대로 나가는 `totalApplicants`에서 공개된 버킷의 합을 빼면 가려진 값이 나온다. 학부 분포에서 1명짜리 버킷 하나를 가려봐야, 총원 20명에서 공개된 19명을 빼면 끝이다. 버킷을 더 많이 가리는 방향으로 갈 수도 있었지만, 어느 버킷을 몇 개까지 가려야 역산이 막히는지가 dimension 조합마다 달라진다.

그래서 기준을 개별 버킷이 아니라 전체 지원자 수에만 걸었다. 지원자가 3명 미만이면 분포 자체를 내보내지 않는다([PR #351](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/351)). 특정 버킷만 가려지는 상황이 없으니 역산할 대상이 없다. 기준값은 설정으로 뺐다.

```java
// domain/statistics/config/StatisticsProperties.java:16-20
@ConfigurationProperties(prefix = "statistics")
public record StatisticsProperties(
        @DefaultValue("3") int minTotalApplicants,
        @DefaultValue("1800") long cacheTtlSeconds
) {
}
```

**총합 기준으로 바꾸고, 세 가지 '없음'을 구분하다**

비공개 처리를 넣자 응답에서 세 상태가 뭉개졌다. 지원자가 적어서 가린 것, 실제로 그날 지원이 0건인 것, 학부를 입력하지 않은 것이 전부 "값이 없음"으로 보일 수 있었다. 처음 떠올린 건 `count`를 null로 바꾸는 방식이었는데, 그러면 세 경우를 클라이언트가 구분할 수 없다. 대신 응답 최상위에 `masked` 불리언을 두고, 비공개일 때는 `masked=true`에 `results=[]`를 돌려준다. 실제 0명은 버킷의 `count: 0`으로, 미입력은 `UNKNOWN` 버킷으로 남긴다.

```java
// domain/statistics/service/StatisticsServiceImpl.java:63-70
// 재식별 방지: 전체 지원자 수가 최소 공개 기준 미만이면 분포를 비공개(masked)한다.
// 기준은 전체 지원자 수에만 걸리고 개별 버킷에는 걸지 않는다(그래야 버킷 간 뺄셈 역산 문제가 없다).
if (full.totalApplicants() < properties.minTotalApplicants()) {
    return maskedResponse(clubApplyFormId, full.totalApplicants(), full.calculatedAt());
}
```

`totalApplicants`는 분포가 아니라서 비공개 상태에서도 그대로 내보낸다. "아직 지원자가 적다"는 신호 자체는 지원자에게 유용하다고 판단했다. 지원자를 직접 관리하는 운영진용 API(`getStatisticsForAdmin`)는 이 기준을 타지 않고 원본을 본다.

**판정과 집계를 같은 스냅샷에서**

머지 직전 CodeRabbit 리뷰가 트랜잭션 경계를 짚었다. 지원자 수를 기준 판정에서 한 번 읽고 집계에서 또 읽으면, 그 사이에 지원서가 삭제돼 기준 아래로 떨어진 분포가 그대로 공개될 수 있다. `getStatistics`가 지원자 수를 한 번만 읽어 `calculate`에 넘기도록 바꾸고, 클래스 단위로 격리 수준을 명시했다([4be04011](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/4be04011)).

```java
// domain/statistics/service/StatisticsServiceImpl.java:31-33
// 최소 공개 기준 판정(지원자 수)과 dimension 집계가 같은 스냅샷을 보도록 반복 읽기로 고정한다.
// 운영 MySQL(InnoDB)은 기본이 REPEATABLE_READ지만, DB 기본값에 의존하지 않고 요구사항을 명시한다.
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
```

운영 DB가 InnoDB라 기본 격리가 이미 REPEATABLE_READ여서 실제로 이 레이스는 나지 않는다. 그래도 "같은 스냅샷이어야 한다"는 요구사항이 DB 기본값에 숨어 있는 상태를 두고 싶지 않았다. 중복 count 쿼리도 이때 사라졌다.

**학과를 enum으로 잠근 이유**

원안은 학과를 자유 입력으로 두고 공백만 제거하는 쪽을 택했다. 전체 학과 목록을 확보해야 하는 부담이 컸고, 목록에서 빠진 학과 지원자가 지원을 못 하는 상황이 더 나쁘다고 봤다. 그 대가로 "컴퓨터공학과, 컴퓨터공학부, 컴공이 각각 집계되므로 학과 통계의 순위와 비율은 실제 분포와 다르다"는 걸 감수하기로 적어뒀다.

구현하면서 이 감수가 통계의 존재 이유를 갉아먹는다고 판단해 단위를 학과에서 학부로 올렸다. 학부는 목록이 15개로 한정적이라 enum으로 고정할 수 있고, 목록 밖은 `ETC`로 받는다([PR #339](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/339)). 프론트가 아직 값을 보내지 않는 상태라 처음부터 `@NotNull`로 조이면 구 프론트의 제출이 전부 400이 되기 때문에, 선택 입력으로 먼저 배포하고 필수화는 별도 PR로 미뤘다. 집계에서는 null만 '미입력'으로 모으고 `ETC`는 정상 버킷으로 낸다([PR #345](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/345)).

```java
// domain/user/entity/Faculty.java:12-13
 * <strong>반드시 {@code @Enumerated(EnumType.STRING)}으로 저장한다.</strong> 순서값으로 저장하면 상수를 추가하거나
 * 순서를 바꾸는 순간 기존 데이터의 의미가 바뀐다.
```

기존 `department` 필드는 지원서 상세와 이메일이 쓰고 있어서 그대로 뒀다.

**하지 않기로 한 것: 마감 직전 blackout**

원안에는 마감 5분 전부터 통계를 감추는 항목이 확정으로 들어가 있었다. 실시간 경쟁률이 보이면 막판에 눈치 지원이 생긴다는 우려였다. 구현하면서 뺐다. 공개하는 dimension이 성별, 학부, 학번, 일자별 추이인데 전부 지원자가 바꿀 수 없는 속성이다. 분포를 보고 지원 여부를 바꿀 수는 있어도 자기 속성을 바꿔 통계를 유리하게 만들 수는 없으니, 감춰서 얻는 게 없다. 위험한 극소수 케이스는 이미 총합 기준으로 막힌다. 단계 전환 시점의 스냅샷 저장도 같은 이유로 빠졌다. 이런 원안 대비 변경점은 이슈 코멘트에 항목별로 사유를 남겼다.

**지금 다시 본다면**

총합 기준 3은 작은 숫자다. 지원자가 4명이면 분포가 그대로 공개되는데, 4명 중 1명뿐인 학부 버킷은 사실상 개인이다. 원안이 "위험도 낮음"으로 판단한 근거는 지금도 유효하다고 보지만, 기준값을 설정으로 뺀 이유가 바로 이 불확실성이다.

더 근본적인 구멍은 원안 5절에서 스스로 적어둔 것이다. 통계를 반복 조회하면 특정 지원 전후의 차이로 개별 지원자의 속성 조합을 추정할 수 있다. 이건 총합 기준으로도 막히지 않는다. 지금은 30분 TTL 캐시가 갱신 단위를 뭉개주는 부수 효과로 완화되고 있을 뿐, 의도한 방어는 아니다. 차분 공격을 막으려면 갱신 단위를 1이 아니라 k로 두는 식의 설계가 따로 필요하다. 그 캐시를 원안의 스케줄러 대신 왜 cache-aside로 갔는지는 [다음 글]({{ "/2026/08/18/statistics-cache-aside/" | relative_url }})에 적었다.

*이 작업에서 AI가 한 것: 커밋 메시지와 테스트 골격 초안, 리뷰 코멘트 정리(커밋에 Claude Opus 4.8 Co-Authored-By 표기). 내가 한 것: 버킷별 마스킹의 역산 문제 판단과 총합 기준으로의 전환, 세 상태 구분 설계, 격리 수준 명시 결정, 학부 enum 전환과 롤아웃 순서.*
