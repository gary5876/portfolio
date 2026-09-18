---
layout: post
title: "이메일 발송을 이벤트로 떼어내고, 실패를 재시도 가능과 불가로 나누기"
date: 2025-10-08 09:00:00 +0900
categories: [study]
tags: [team18-be, spring-boot, email, async, retry]
---

동아리움(Team18_BE)은 팀 프로젝트(백엔드 3인, 프론트엔드 3인)이고, 지원서 제출과 합불 결과를 알리는 이메일은 내가 전담했다. 이메일 도메인 커밋 38개 중 35개가 내 것이다. 이 글은 2025년 10월 8일에 머지된 [PR #97](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/97)에서 발송을 요청 흐름에서 떼어내고, 실패를 재시도할 것과 하지 않을 것으로 나눈 결정을 적는다. 그 결정이 8일 뒤에 어떤 장애로 이어졌는지는 [다음 글]({{ "/2025/10/16/async-listener-lazy-init/" | relative_url }})에 있다.

**팀 코드에 넣기 3주 전, 따로 실험했다**

팀 레포에 이메일이 들어간 건 9월 22일이다. 그 전에 8월 30일부터 개인 레포 emailTest에서 Spring Mail로 Gmail SMTP 발송을 먼저 돌려봤다. 수신자용 폼을 만들고, 사용법을 문서로 적고, 9월 8일에는 복사본 레포에 테스트 코드와 Docker 설정을 붙였다. 팀 코드에 처음 넣은 버전은 그 실험의 결과였고, 그때부터 이미 `@TransactionalEventListener(AFTER_COMMIT)`를 달고 있었다. 지원서가 커밋되기 전에 "제출됐습니다" 메일이 나가면 안 되기 때문이다.

**접수 응답을 SMTP에 묶지 않는다**

9월 26일에 올린 [이슈 #80](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/80)의 개선 목록에 "@async 비동기처리 고려해보기"가 있었다. 지원서 제출 API가 응답을 돌려주기 전에 Gmail SMTP 왕복을 기다리면, SMTP가 느려질 때 사용자의 제출 버튼도 같이 느려진다. 10월 2일 커밋 [258c811b](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/258c811b)에서 리스너에 `@Async`를 붙였다. 지원서는 커밋되고 응답은 바로 나가고, 메일은 다른 스레드에서 보낸다.

```java
// domain/email/eventListener/ApplicationNotificationListener.java:26-28
@Async
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onSubmitted(ApplicationSubmittedEvent event) {
```

지원서 제출, 면접 합격, 면접 불합격, 최종 합격, 최종 불합격 다섯 이벤트가 같은 형태로 붙어 있다. `AsyncConfig`는 `@EnableAsync` 한 줄이 전부다.

**실패를 둘로 나눈다**

분리하고 나니 실패가 문제였다. 요청 스레드에서 보낼 때는 예외가 곧 500 응답이었는데, 비동기 스레드에서는 예외를 받아줄 호출자가 없다. 그래서 10월 6일 커밋 [5e68154e](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/5e68154e)에서 발송기에 재시도를 넣고, 어떤 실패를 재시도할지 정하는 분류기를 따로 뒀다.

```java
// domain/email/sender/SmtpEmailSender.java:26-30
@Retryable(
        include = { RetryableEmailException.class },
        maxAttempts = 5,
        backoff = @Backoff(delay = 2_000, multiplier = 2.0, maxDelay = 60_000)
)
```

재시도 대상은 `RetryableEmailException` 하나뿐이다. 발송기는 `mailSender.send`가 던진 예외를 `SmtpFailureClassifier.isTemporary`에 넘겨서, 임시 실패면 `RetryableEmailException`으로 감싸 던지고 아니면 `EmailSendFailedException`으로 끝낸다. 최대 5회, 2초에서 시작해 두 배씩 늘리고 60초를 넘지 않는다. 다섯 번 다 실패하면 `@Recover`가 error 로그를 남기고 `EmailSendFailedException`을 던진다.

분류기는 SMTP 응답 코드로 판단한다. 연결 실패와 소켓 타임아웃은 임시, 인증 실패는 영구다. 응답에 RFC 3463 확장 코드가 있으면 `4.x.x`는 임시, `5.x.x`는 영구로 보되 `5.2.2`(수신함 가득 참)만 임시로 예외를 뒀다. 확장 코드가 없으면 기본 코드 4xx는 임시, 552(용량 초과)는 임시, 나머지 5xx는 영구다. 그것도 없으면 메시지 문자열에서 "try again later", "temporarily", "timeout", "over quota"를 찾는다.

```java
// domain/email/sender/SmtpFailureClassifier.java:50-60
if (enhanced != null) {
    if (enhanced.startsWith("4.")) return true;      // 4.x.x = 임시
    if ("5.2.2".equals(enhanced)) return true;       // mailbox full
    return false;                                     // 그 외 5.x.x
}

if (basic != null) {
    if (basic >= 400 && basic < 500) return true;    // 4xx
    if (basic == 552) return true;                   // 용량/스토리지
    return false;                                    // 나머지 5xx
}
```

`RetryableEmailException`에는 에러 코드가 없다. 소스 주석에 "이 에러는 @Retry 에서 사용하는거라 에러코드가 없습니다. 프론트에 넘겨주지 않아요"라고 적어뒀다. 재시도는 서버 안에서 끝나는 일이고 사용자에게 보여줄 상태가 아니다. 반대로 `EmailSendFailedException`은 같은 분류기의 `toErrorCode`로 수신자 오류, 정책 거부, 인증 실패, 타임아웃 같은 `ErrorCode`를 받는다.

**리뷰에서 나온 것**

팀원이 예외 클래스를 보고 "지금 gmail만 이메일로 등록 가능한 상황인가요?"라고 물었다. 분류기가 Gmail 응답 메시지를 기준으로 만들어진 게 보였기 때문이다. RFC 5321과 RFC 1893 링크를 달고, `550 5.7.1`까지는 서버가 달라도 같고 뒤에 붙는 문장만 다르다고 답했다. 그래서 문자열보다 코드를 먼저 보게 짜긴 했지만, 마지막 폴백의 문자열 매칭은 Gmail에서 본 문장들이라는 걸 그 자리에서 인정했다.

CodeRabbit은 두 가지를 짚었다. 하나는 `catch (Throwable e)`가 `OutOfMemoryError`까지 이메일 실패로 감싼다는 것이었고, 지금 코드는 `Exception`을 잡는다. 다른 하나는 `@Async` 메서드에서 던진 예외가 호출자에게 전파되지 않으니 리스너 안에서 잡아야 한다는 것이었다. 이건 반영하지 않았고, 8일 뒤에 정확히 그 경로로 장애를 겪었다.

**테스트는 실제로 보낸다**

PR 본문의 "고민했던 내용"에 이렇게 적었다.

> 적절한 테스트 방법에 대해 고민하다가, 실제로 이메일을 보내는 것이 작동을 확신할 수 있는 방법이라 생각해서 그렇게 만들어봤습니다.

`JavaMailSender`를 mock으로 바꾸면 통과하는 테스트는 SMTP 인증이 틀렸는지, 발신 주소가 거부되는지, HTML이 깨지는지 아무것도 말해주지 않는다. 그래서 `EmailSendTest`는 실제 SMTP로 UUID가 박힌 제목의 메일을 보내고, `EmailServiceIntegrationTest`는 서비스부터 발송까지 한 번에 돌린다. 실행자가 `MAIL_TO`에 자기 주소를 넣고 메일함을 직접 확인하는 방식이라, CodeRabbit이 "assertDoesNotThrow만으로는 검증이 약하다"고 했을 때 "테스트 실행자가 본인 이메일을 넣어서 직접 메일함을 확인하기를 원해서 이렇게 만든 거"라고 답했다. 그 대가로 두 테스트 모두 `@Disabled("실제 외부 SMTP 메일을 보냅니다. 로컬에서 주석처리 후 수동 실행하세요.")`가 붙어 CI에서는 돌지 않는다. 확신을 주는 테스트와 매번 도는 테스트가 같은 테스트가 아니었다.

**지금 다시 본다면**

분류기는 `mailSender.send`가 던진 예외만 본다. 발송기에 도달하기 전에 서비스 안에서 나는 예외는 임시인지 영구인지 판단조차 받지 않는다. 다음 글의 장애가 정확히 그 자리에서 났다.

재시도 자체에도 구멍이 있다. 소켓 타임아웃을 임시로 분류했는데, 서버가 메일을 이미 받아들인 뒤 응답만 늦은 경우라면 재시도는 같은 메일을 두 번 보낸다. 재시도는 메모리 안에서 도는 백오프라서 60초 대기 중에 프로세스가 내려가면 그 메일은 사라진다. 아웃박스 테이블도 큐도 없고, 다섯 번 실패한 뒤 `@Recover`가 던지는 예외는 비동기 스레드 안이라 로그 한 줄로 끝난다. 그리고 이슈 #80에는 "@Transactional 추가"가 체크돼 있지만 PR에서 리스너의 `@Transactional` import는 지워졌다. 그 어노테이션을 넣었다 뺐다 한 이야기도 다음 글에 있다.
