---
layout: post
title: "실서비스로 넘어가기 직전 일주일에 고친 것들"
date: 2025-11-03 09:00:00 +0900
categories: [troubleshooting]
tags: [team18-be, spring-boot, jpa, s3]
description: "지원자 처리가 모집 중인 동아리에서만 실패하고, 대기 지원자 수가 안 맞고, 첨부파일 링크가 깨지던 문제를 운영 전환 직전에 고친 기록"
---

안녕하세요, 고준서입니다. 동아리움이라는 대학 동아리 지원 서비스의 백엔드를 팀에서 맡고 있고(백엔드 3인, 프론트엔드 3인), 지원서 도메인과 공지사항 첨부파일은 제가 담당했습니다. 2025년 10월 말에서 11월 초는 이 서비스가 실서비스로 넘어가기 직전이었고, 그 일주일 동안 제가 낸 버그 이슈가 네 개였어요. 하나는 지원자 합불 처리가 특정 조건에서만 실패하는 것, 하나는 대시보드 숫자가 안 맞는 것, 나머지 둘은 첨부파일 링크가 깨지는 것이었는데 이 둘은 원인이 같았습니다. 그 일주일을 순서대로 적습니다.

## 지원자 처리가 모집 중인 동아리에서만 실패했습니다

10월 30일에 올린 [이슈 #180](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/180)의 재현 방법은 이렇게 적혀 있습니다.

> 대시보드 화면에서 지원서처리 누름
> if 모집중 : 500에러
> if 모집종료: 정상처리

동아리 운영진이 대시보드에서 "지원서 처리"를 누르면 단계별로 합격자와 불합격자를 정리하는데, 모집이 끝난 동아리는 잘 되고 모집 중인 동아리에서는 서버 오류가 났어요. 원인은 불합격자를 지우는 방식이었습니다. [PR #183](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/183) 본문에 이렇게 적었습니다.

> deleteAllInBatch가 엔티티들의 관계를 고려하지 못해 삭제시 문제를 일으키고있었음
> clubMember가 참조하고있던 application을 지우려고 하자 오류가 났던 것으로 확인됨.
> 따라서 개별 삭제로 수정, 엔티티 참조 수정함

`deleteAllInBatch`는 JPA에서 여러 행을 SQL 한 번으로 지우는 메서드인데, 지우려는 지원서를 다른 테이블(동아리 회원)이 아직 가리키고 있으면 그 참조를 정리하지 않고 바로 삭제를 시도합니다. 그래서 먼저 회원 쪽 참조를 비우고 한 건씩 지우는 방식으로 바꿨어요.

```java
// domain/application/service/ApplicationServiceImpl.java (PR #183, f8c11eb8)
             for(Application a : rejected) {
                 ApplicationInfoDto applicationInfoDto = buildApplicationInfo(a,president);
                 publisher.publishEvent(new InterviewRejectedEvent(applicationInfoDto));
+                clubMemberRepository.clearApplicationByApplicationId(a.getId());
+                applicationRepository.delete(a);
             }
-            applicationRepository.deleteAllInBatch(rejected);
```

```java
// domain/clubMember/repository/ClubMemberRepository.java (PR #183)
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ClubMember cm set cm.application = null where cm.application.id = :applicationId")
    int clearApplicationByApplicationId(Long applicationId);
```

같은 PR에서 지원서에 달린 답변과 댓글은 지원서를 지울 때 같이 지워지도록 엔티티에 `cascade = CascadeType.REMOVE`를 붙였고, 동아리 회원의 지원서 참조는 비어 있을 수 있게 `optional = false`를 뺐습니다. 테스트용 시드 데이터에는 대기 중인 지원서가 하나도 없는 동아리를 하나 추가했어요. 팀원이 리뷰에서 "data.sql에 데이터는 왜 추가된걸까요?"라고 물어서 이렇게 답했습니다.

> pending인 지원서가 있으면 400error를 반환해서, 에러를 반환하지 않는 club3을 만들기위해 추가했습니다!

11월 3일에 머지됐습니다.

## 대기 지원자 수가 아래 목록과 안 맞았습니다

다음 날인 10월 31일에 [이슈 #184](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/184)를 올렸습니다. 대시보드 위에 나오는 "대기 지원서 수"가 아래에 나열된 대기 지원서를 세어 보면 안 맞았어요. [PR #185](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/185)에 원인을 이렇게 적었습니다.

> 해당 동아리의 status=PENDING인 지원서 수를 세는 문제였습니다.
> role이 APPLICANT인 사람들의 지원서 중에서 status=PENDING인 지원서 수만 세도록 수정했습니다.

지원서 테이블에서 "대기" 상태를 세면, 이미 회원이 된 사람의 지원서까지 들어갑니다. 대시보드의 대기 지원자는 "아직 지원자 역할인 사람 중 지원서가 대기 상태인 사람"이라, 세는 기준을 동아리 회원 테이블 쪽으로 옮겼습니다.

```java
// domain/club/service/ClubServiceImpl.java (PR #185)
-        List<Application> pendingApplication = applicationRepository.findByClubApplyFormIdAndStatus(clubApplyForm.getId(), Status.PENDING);
+        List<ClubMember> pendingApplications = clubMemberRepository.findByClubIdAndRoleAndApplicationStatus(clubId, Role.APPLICANT, Status.PENDING);
```

팀원이 남긴 승인 코멘트는 "이 문제였군요 ㅠㅠㅠ 수정해주셔서 감사합니다 준서님!!"이었습니다.

그런데 그 옆의 숫자가 하나 더 있었어요. 전체 지원자 수는 지원자 역할인 회원을 전부 세고 있었는데, 앞의 PR #183에서 불합격자의 회원 행에 있는 지원서 참조를 비우게 했으니 지원서가 없는 지원자 회원이 생길 수 있는 상태였습니다. 11월 7일 커밋 [0e00fe80](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/0e00fe80)("fixed wrong total applicant problem")에서 지원서가 있는 회원만 세도록 조건을 추가했습니다.

```java
// domain/clubMember/repository/ClubMemberRepository.java (0e00fe80)
    @Query("""
            select cm
            from ClubMember cm
            join fetch cm.club
            where cm.club.id = :clubId and cm.role = :role and cm.application IS NOT NULL
            """)
    List<ClubMember> findByClubIdAndRoleAndApplicationIsNotNull(Long clubId, Role role);
```

## 첨부파일 링크가 깨졌고, 환경변수 이름을 세 번 고쳤습니다

공지사항 첨부파일은 10월 30일에 올린 [PR #178](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/178)에서 방식을 바꾼 참이었습니다. 처음엔 다운로드 API를 따로 만들려고 했는데, 파일 저장소(S3)가 만들어 주는 기간 한정 다운로드 링크(presignedUrl)를 공지 상세 응답에 실어 보내면 프론트가 백엔드를 거치지 않고 바로 받을 수 있어서 그쪽으로 갔어요. PR 본문에는 "프론트와 백의 통신횟수를 줄이기 위해 presignedUrl을 만들어서 넘기는 방식으로 수정했습니다"라고 적었습니다. 이 PR도 11월 3일에 머지됐습니다.

같은 날 저녁, 그 링크가 잘못 만들어지고 있었습니다([이슈 #192](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/192)). 첨부파일용 버킷이 따로 있는데 코드가 기본 버킷 이름을 쓰고 있었어요. [PR #193](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/193)에서 설정 키를 나누고 배포 파이프라인에 새 변수를 추가했습니다. PR에 적은 소요 시간은 10분입니다.

```java
// domain/notices/service/NoticeServiceImpl.java (PR #193)
-            @Value("${cloud.aws.s3.bucket}") String bucketName
+            @Value("${cloud.aws.s3.bucket-attachments}") String bucketName
```

그런데 다음 날 [이슈 #200](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/200)을 또 올렸습니다. 본문은 한 줄이에요.

> docker compose 파일 오타로 정상적으로 주입이 안되었음

PR #193에서 docker-compose에 넣은 변수 이름이 `CLOUD_AWS_S3_BUCKET-ATTACHMENTS`였는데, 환경변수 이름에 하이픈이 들어가 있어서 값이 주입되지 않았습니다. [PR #201](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/201)에서 고쳤는데, 고친 이름이 `CLOUD_AWS_S3_BUCKET_TTACHMENTS`였어요. A가 하나 빠진 채로요. 다음 날 [PR #205](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/205)에서 `CLOUD_AWS_S3_BUCKET_ATTACHMENTS`로 다시 고쳤고, PR에 적은 소요 시간은 1분입니다.

```yaml
# docker-compose.yml, 세 번의 변경
-      CLOUD_AWS_S3_BUCKET-ATTACHMENTS: ${CLOUD_AWS_S3_BUCKET-ATTACHMENTS}   # PR #193
+      CLOUD_AWS_S3_BUCKET_TTACHMENTS: ${CLOUD_AWS_S3_BUCKET_ATTACHMENTS}     # PR #201
+      CLOUD_AWS_S3_BUCKET_ATTACHMENTS: ${CLOUD_AWS_S3_BUCKET_ATTACHMENTS}    # PR #205
```

리뷰 봇(CodeRabbit)의 검사 경로는 `.coderabbit.yaml`에서 `**/src/**`와 빌드 파일로 한정되어 있어서 docker-compose.yml은 보지 않습니다. 세 번 다 사람 눈으로만 봤고, 두 번 놓쳤습니다.

## 돌아보면

넷 다 코드보다 데이터가 먼저 드러낸 문제였습니다. 모집 중인 동아리에서만 실패한 건 그 동아리에만 지원서를 가리키는 회원 행이 있었기 때문이고, 대기 지원자 수가 안 맞은 건 회원이 된 사람의 지원서가 아직 테이블에 있었기 때문이고, 링크가 깨진 건 버킷이 둘로 나뉘어 있었기 때문이에요. 로컬에서 만든 시드 데이터로는 안 보이던 것들이 실제 동아리 데이터를 넣고 화면을 눌러 보니 나왔습니다. 그리고 환경변수 이름 하나를 세 번 고친 건, 설정 파일에는 테스트도 리뷰 봇도 없다는 걸 그때 알았기 때문입니다. 지금도 그 파일에는 둘 다 없어요. 읽어주셔서 감사합니다.
