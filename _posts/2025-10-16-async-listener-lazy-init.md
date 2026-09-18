---
layout: post
title: "@Async 리스너에서 터진 LazyInitializationException: 이메일이 조용히 안 나가던 이유"
date: 2025-10-16 09:00:00 +0900
categories: [postmortem]
tags: [team18-be, spring-boot, jpa, async, email]
---

동아리움(Team18_BE)은 팀 프로젝트(백엔드 3인, 프론트엔드 3인)이고, 지원서 제출 알림 이메일은 내가 전담했다. 2025년 10월 16일 저녁, 지원서를 제출하면 화면에는 "처리됨"이 뜨는데 메일은 오지 않는 상태가 운영 로그에서 발견됐다. 사용자에게는 아무 에러도 보이지 않았다. 이 글은 그 예외가 어디서 왔는지, 왜 아무도 모르게 실패했는지, 그리고 이틀 전에 내 손으로 그 조건을 만들어 놓았다는 사실까지 적는다.

**증상: 응답은 200, 메일은 없음, 에러는 로그에만**

[이슈 #144](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/144)에 붙여 둔 로그의 핵심은 이렇다.

```
2025-10-16T18:29:45.128+09:00 ERROR 1 --- [Team18_BE] [ task-2] .a.i.SimpleAsyncUncaughtExceptionHandler :
Unexpected exception occurred invoking async method:
public void ...ApplicationNotificationListener.onSubmitted(...ApplicationSubmittedEvent)
org.hibernate.LazyInitializationException: Could not initialize proxy [...ClubApplyForm#1] - no session
    at ...ClubApplyForm$HibernateProxy.getClub(Unknown Source)
    at ...EmailService.sendToApplicant(EmailService.java:43)
    at ...ApplicationNotificationListener.onSubmitted(ApplicationNotificationListener.java:34)
```

스레드 이름이 `task-2`다. 요청 스레드가 아니라 `@Async` 풀에서 도는 스레드에서, `ClubApplyForm` 프록시의 `getClub()`을 호출하는 순간 세션이 없다고 터졌다. 위치는 `EmailService.java:43`, 당시 코드로는 이 줄이다.

```java
// EmailService.sendToApplicant 첫 줄 (수정 전, cf304daf 직전 상태)
public void sendToApplicant(Application application, List<AnswerEmailLine> emailLines) {

    Long clubId = application.getClubApplyForm().getClub().getId();
```

**리스너가 엔티티를 다시 조회했는데도 왜 안 됐나**

수정 전 리스너는 이벤트에 담긴 `applicationId`로 `applicationRepository.findById`를 다시 호출했다. 비동기 스레드에서 새로 꺼내 왔으니 괜찮을 거라고 생각한 구조다. 그런데 리스너 메서드 자체에는 트랜잭션이 없었다. `findById`는 리포지토리 프록시가 여는 짧은 읽기 트랜잭션 안에서 실행되고, 반환되는 순간 그 트랜잭션과 세션은 닫힌다. 손에 든 `Application`은 살아 있지만 `clubApplyForm` 같은 지연로딩 연관은 프록시 껍데기다. 이걸 `EmailService`에 넘겨 `getClub()`을 부르면 프록시가 초기화를 시도하고, 붙을 세션이 없어 예외가 난다. [PR #142](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/142) 본문에 적은 원인 문장은 이것이다.

> 문제가 발생한 이유는 @async로 분리된 thread가 transaction이 종료된 이후에 엔티티의 지연로딩필드에 접근하고 있었기 때문이었습니다.

**이틀 전, 내가 그 조건을 만들었다**

이 리스너의 어노테이션은 사고 이틀 전에 두 번 바뀌었다. 10월 14일 12시 42분에 올린 [PR #136](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/136)의 제목은 "Listener오류 수정", 본문은 "이메일 발송이 안되는 문제 해결" 한 줄이다. 이 PR은 `@TransactionalEventListener(AFTER_COMMIT)`를 주석 처리하고 `@Transactional(readOnly = true)`를 붙였다. 리스너 안에 읽기 트랜잭션을 두면 `findById` 뒤에도 세션이 살아 있으니 지연로딩이 된다. 같은 PR에서 `EmailService.sendToApplicant`에 `REQUIRES_NEW`를 붙였다가 주석으로 남긴 흔적도 있다.

그리고 42분 뒤인 13시 24분, [PR #137](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/137)로 그걸 다시 뒤집었다. `@Transactional`을 주석 처리하고 `AFTER_COMMIT`을 되살렸다. 제목은 GitHub 웹 편집기가 붙여 준 "Update ApplicationNotificationListener.java", 본문은 빈 템플릿, 1분 만에 스스로 머지했다. 왜 되돌렸는지는 어디에도 적혀 있지 않다. 커밋이 아니라 트랜잭션 도중에 리스너가 돌면 안 된다는 판단이었을 거라고 지금은 추측하지만, 기록이 없으니 추측이다. 확실한 건 이 두 번째 변경으로 리스너에서 트랜잭션이 사라졌고, 그 상태로 이틀 뒤 운영에서 첫 지원서가 들어왔다는 것이다.

**왜 조용히 실패했나**

세 겹이 겹쳤다. 첫째, `@Async` 메서드에서 던진 예외는 호출자에게 돌아오지 않는다. `AsyncConfig`는 `@EnableAsync` 한 줄이라 기본 핸들러인 `SimpleAsyncUncaughtExceptionHandler`가 받아서 ERROR 로그를 남기는 것으로 끝난다. 둘째, `AFTER_COMMIT` 리스너는 이름 그대로 커밋이 끝난 뒤에 돈다. 지원서는 이미 저장됐고 응답도 나갔으니 사용자는 성공 화면을 본다. 셋째, 재시도는 [PR #97](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/97)에서 붙인 `SmtpEmailSender`의 `@Retryable`이 `RetryableEmailException`만 잡는 구조다. SMTP 4xx 같은 일시 장애용이고, 이 예외는 발송기에 도달하기도 전에 `EmailService` 안에서 터졌으니 재시도 대상조차 아니었다.

**수정: 엔티티 대신 값을 넘긴다**

같은 날 23시 9분 커밋 [cf304daf](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/cf304daf)에서 방향을 바꿨다. 비동기 스레드에서 엔티티를 만지지 않는다. 이벤트를 발행하는 시점, 즉 요청 트랜잭션 안에서 메일에 필요한 값을 전부 꺼내 불변 레코드에 담고 그것만 넘긴다.

```java
// domain/email/dto/ApplicationInfoDto.java:5-15
public record ApplicationInfoDto(
        String clubName,
        String userName,
        Long clubId,
        String presidentEmail,
        String studentId,
        String userDepartment,
        String userPhoneNumber,
        String userEmail,
        LocalDateTime lastModifiedAt
        ) {
}
```

값을 채우는 `buildApplicationInfo`는 `ApplicationServiceImpl`에 있고, 회장 이메일 조회(`ClubMemberRepository`)도 `EmailService`에서 이쪽으로 옮겼다. 리스너는 `event.info()`를 꺼내 넘기기만 한다.

```java
// domain/email/eventListener/ApplicationNotificationListener.java:26-33
@Async
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onSubmitted(ApplicationSubmittedEvent event) {
    ApplicationInfoDto info = event.info();

    emailService.sendToApplicant(info, event.emailLines());
    log.info("Email sent successfully: clubName={} userName={}", info.clubName(), info.userName());
}
```

지원서 제출, 면접 합격, 면접 불합격, 최종 합격, 최종 불합격 다섯 이벤트가 모두 같은 DTO를 싣도록 바꿨고, `EmailService`는 `Application`, `Club`, `User`를 받던 시그니처를 전부 DTO 기반으로 정리했다. 테스트 세 파일도 엔티티 픽스처 대신 DTO로 옮겼다. 리뷰에서 CodeRabbit이 잡은 실제 버그가 하나 있었는데, 면접 합격 처리에서 `updateStage(FINAL)`을 먼저 부르고 이벤트에 `a.getStage()`를 넣어 INTERVIEW가 아닌 FINAL이 담기던 것이다. 원래 stage를 지역 변수에 잡아 두는 것으로 고쳤다.

**고려하지 않은 대안들**

리스너에 `@Transactional`을 다는 방법은 이틀 전에 시도했다가 42분 만에 되돌린 것이고, 그 이유가 기록에 없다는 건 위에 적었다. open-in-view나 fetch join으로 연관을 미리 채우는 방법은 당시 고려했는지 기록이 없다. 지금 보면 fetch join은 이벤트마다 필요한 연관이 달라 리스너별로 쿼리를 따로 두게 되고, 결국 "비동기 스레드가 영속 객체를 쥐고 있어야 한다"는 전제를 유지하는 셈이라 DTO 쪽이 맞았다고 본다.

**발견과 정리 사이의 8일**

로그는 16일 18시 29분, 수정 커밋은 같은 날 23시 9분이다. 발견에서 수정까지는 다섯 시간이었다. 그런데 PR은 24일에 열었고 이슈는 그 다음 날인 25일에 썼다. 이슈 번호 #144가 PR 번호 #142보다 뒤인 이유다. 고치는 건 빨랐고, 팀이 볼 수 있게 기록으로 남기는 건 늦었다. 이슈에 스택트레이스를 붙이고 재현 절차를 적은 건 사후 문서화였다.

**지금 다시 본다면**

비동기 실패를 세는 지표가 없다. `SimpleAsyncUncaughtExceptionHandler`의 ERROR 로그 한 줄이 전부이고, 이 로그를 사람이 열어 봐야 알 수 있다. 이 사고를 겪고도 `AsyncConfigurer`로 핸들러를 바꾸거나 실패 카운터를 붙이지 않았다. 재시도 분류도 마찬가지다. `SmtpFailureClassifier`는 SMTP 응답 코드로 일시 장애와 영구 장애를 나누지만, 발송기 앞단에서 나는 예외는 분류 밖이라 "재시도 안 함"이 아니라 "재시도 여부를 판단조차 안 함"이다. 그리고 `ApplicationRepository`는 리스너에서 더 이상 쓰지 않는데 필드 주입이 지금도 남아 있다. 리뷰에서 지적받고도 정리하지 않은 것이다. 이메일 통합 테스트는 실제 SMTP로 보내는 방식이라 `@Disabled`로 꺼져 있고, 비동기 스레드에서 지연로딩이 터지는 경로를 재현하는 테스트는 없다. 같은 조건을 다시 만들면 같은 방식으로, 로그에서만 알게 될 것이다.
