---
layout: post
title: "배포 환경을 Railway에서 AWS EC2로, 다시 GCP Cloud Run으로 옮긴 이유"
date: 2026-06-23 09:00:00 +0900
categories: [decisions]
tags: [study-helper, deploy, gcp, aws, github-actions]
summary: "석 달 사이 배포처를 세 번 바꾸면서 워크플로우 파일에 남은 결정과 그 근거"
---

안녕하세요, 고준서입니다. study-helper는 PDF를 올리면 LLM으로 학습 노트와 문제를 만들어 주는 서비스를 혼자 만든 개인 프로젝트입니다. 이 프로젝트의 백엔드는 2026년 3월부터 6월 사이에 배포처가 세 번 바뀌었습니다. Railway에서 시작해 AWS EC2로 갔다가 GCP Cloud Run으로 끝났어요. 왜 그렇게 됐는지를 저장소에 남은 커밋 메시지, 워크플로우 파일, 설계 문서만으로 다시 정리해 봤습니다. 기억에 의존한 부분은 넣지 않았습니다.

## Railway는 처음부터 임시였습니다

저장소에 처음 있던 배포 워크플로우는 AWS ECS를 향해 있었습니다. `ECS_CLUSTER: fundamentals-prod`, `ECR_REPOSITORY: fundamentals-backend`처럼 이 프로젝트 이름이 아닌 값이 환경 변수에 박혀 있었습니다. 그런데 3월 21일 커밋 `e2df0f5`에서 그 AWS 작업들을 전부 껐습니다. 커밋 제목이 "Disable AWS jobs in CI workflow (Railway 임시 사용 중)"이고, 워크플로우 안에는 이런 주석을 남겼습니다.

```yaml
# .github/workflows/deploy.yml (커밋 e2df0f5 시점)
  # ── AWS 이전 시 if: false 제거 ─────────
    if: false  # Railway 사용 중 — AWS 이전 시 제거하고 아래 조건으로 교체
```

"임시"라는 말이 제목과 주석에 두 번 들어가 있습니다. 나중에 AWS로 돌아갈 생각으로 잠깐 Railway를 쓴 겁니다. 다음 날 커밋 `aed6f87` "Suppress pdfminer DEBUG logs to prevent Railway log rate limit"이 Railway에서 실제로 겪은 문제 하나를 보여 줍니다. PDF 파서가 DEBUG 로그를 너무 많이 찍어서 Railway의 로그 한도에 걸렸고, 로그 레벨을 낮춰서 넘겼습니다. Railway를 왜 골랐는지에 대한 다른 이유는 저장소에 적혀 있지 않아서 여기서도 쓰지 않겠습니다.

4월 13일에 Claude와 같이 정리한 설계 문서(`study-helper-documents/architecture/2026-04-13-01-배포-환경-전략.md`, 상태 "설계 (미구현)")에는 그 다음 그림이 있습니다. 테스트 환경은 Railway, 프로덕션은 AWS EC2에 Docker로 올리고, DB도 RDS가 아니라 EC2 안의 Postgres 컨테이너로 두자는 내용입니다. RDS를 안 쓰기로 한 근거는 비용이었습니다. 문서에 적힌 비교는 RDS Free Tier가 12개월 뒤 월 $15~20, Aurora Serverless v2가 월 $5~10, `db.t4g.micro`가 월 $12~15 정도였고, 대신 EBS 스냅샷 하루 한 번과 `pg_dump`를 S3로 주 1회 올리는 걸로 백업을 대신하기로 했습니다. 웹 프론트는 `@supabase/ssr`이 쿠키 기반 세션 갱신을 서버에서 하기 때문에 정적 export가 안 되고, 그래서 S3와 CloudFront 대신 Vercel로 갔습니다. 같은 날 브랜치 전략 문서(`2026-04-13-04-브랜치-전략.md`)는 `main`은 Railway, `production` 브랜치는 EC2로 나누고 "main → production: 별도 승격 PR을 생성한다"고 적었습니다.

## EC2로 옮긴 날, 브랜치 정책부터 어겼습니다

실제 EC2 이전은 5월 4일에 만든 PR #6(커밋 `834dfb6`, Claude Opus 4.7 공동 작성)으로 들어갔습니다. 바뀐 파일은 7개, 373줄 추가인데 전부 `deploy/` 폴더와 워크플로우, README, `.gitignore`이고 앱 코드는 없습니다. `deploy/docker-compose.prod.yml`에 api, redis, postgres, nginx 네 컨테이너를 두고, `deploy.sh`가 SSM Parameter Store(AWS의 설정값 저장소)에서 시크릿을 받아 `.env.prod`를 만든 다음 ECR(AWS의 도커 이미지 저장소)에서 이미지를 받아 `compose up`을 합니다. 워크플로우는 `test → security → docker-build (PR) → build-and-push → sync-secrets → deploy` 여섯 작업으로 재편했고, AWS 인증은 액세스 키 대신 OIDC(GitHub Actions가 발급한 토큰으로 AWS 역할을 잠깐 빌려 쓰는 방식)를 썼습니다. PR 본문의 테스트 계획은 `curl http://54.116.95.144/health` 한 줄이었습니다.

4월 문서와 다른 점이 하나 있습니다. 문서는 `production` 브랜치를 따로 두자고 했는데, 실제로는 `main`에 바로 AWS 배포를 걸었습니다. README에도 "main 브랜치 AWS 배포 인프라 도입"이라고 적혀 있습니다. `production` 브랜치는 만들어지지 않았고, 대신 `develop`에서 `main`으로 올리는 릴리스 PR 방식이 됐습니다.

그리고 PR #6이 머지되기도 전에 그 방식을 제가 먼저 어겼습니다. 5월 5일, `develop`에만 들어가 있던 테스트와 lint 수정 8개 커밋을 `main`에도 넣겠다고 이슈 #7을 열고, PR #8을 `develop`이 아니라 `main`을 base로 열어서 머지했습니다. 11분 뒤 이슈 #9를 "PR #8 (직접 main 머지) revert, 일회성 정책 예외"라는 뜻의 제목으로 열었고, PR #10으로 `git revert -m 1`을 해서 `main`을 `7464ef1`로 되돌렸습니다. 그 뒤에야 PR #6이 `develop`에 머지됐고, 이슈 #11과 #13을 거쳐 PR #14로 `git merge -s ours origin/main`을 해서 `develop`이 `main`의 revert 이력을 코드 변경 0건으로 흡수하게 한 다음, PR #12 release(`develop → main`)를 머지했습니다. 그 PR 본문에 "머지 시 첫 자동배포 트리거"라고 적혀 있습니다. PR #8 머지부터 PR #12 머지까지 한 시간 반 남짓 사이에 PR 네 개와 이슈 네 개가 생겼는데, 전부 `main`에 직접 머지한 것을 되돌리고 브랜치를 다시 맞추는 데 쓴 것들입니다.

## AWS를 내린 이유는 한 단어로 남아 있습니다

6월 23일 커밋 `8dfbfa1`(Claude Opus 4.8 공동 작성)이 배포를 GCP Cloud Run으로 옮겼습니다. 바뀐 파일은 워크플로우 두 개뿐입니다. `deploy-gcp.yml` 70줄이 새로 생겼고, 기존 `deploy.yml`은 8줄이 바뀌어 `main` push 트리거가 빠지고 수동 실행만 남았습니다. 앱 코드나 compose 파일은 건드리지 않았습니다.

AWS를 접은 이유는 커밋 메시지에 괄호 안의 "paid" 한 단어로만 적혀 있습니다. 얼마가 나왔는지, 언제부터 과금됐는지는 저장소 어디에도 없어서 여기서도 숫자를 쓰지 않겠습니다. 워크플로우 파일 머리에는 이렇게 남겼습니다.

```yaml
# .github/workflows/deploy.yml:1-4
name: Backend Deploy (AWS — DISABLED)

# DISABLED 2026-06-23: AWS is no longer used (paid). Production deploys now go
# to GCP Cloud Run via deploy-gcp.yml. This file is kept (manual-dispatch only)
```

새 워크플로우에서 EC2 때와 달라진 건 세 가지입니다. 배포 대상이 서버가 아니라 컨테이너 하나라서 compose와 nginx, 서버 안의 `deploy.sh`가 없어졌습니다. 인증은 Workload Identity Federation(WIF, GitHub Actions 토큰을 GCP 서비스 계정으로 바꿔 주는 방식으로, 서비스 계정 키 파일을 어디에도 두지 않습니다)을 씁니다. 시크릿은 SSM에서 `.env.prod` 파일로 만들어 쓰던 걸 Secret Manager(GCP의 시크릿 저장소)에서 컨테이너 환경 변수로 바로 붙이는 걸로 바꿨습니다.

```yaml
# .github/workflows/deploy-gcp.yml:14-25
permissions:
  id-token: write   # required for Workload Identity Federation
  contents: read

env:
  PROJECT_ID: study-helper-492805
  REGION: asia-northeast3
  SERVICE: study-helper-backend
  AR_REPO: study-helper
  # Workload Identity Federation provider + deploy service account
  WIF_PROVIDER: projects/469469589402/locations/global/workloadIdentityPools/github-pool/providers/github-provider
  DEPLOY_SA: gh-deploy@study-helper-492805.iam.gserviceaccount.com
```

```yaml
# .github/workflows/deploy-gcp.yml:55-63
          gcloud run deploy "${SERVICE}" \
            --image "${IMAGE}" \
            --region "${REGION}" \
            --platform managed \
            --allow-unauthenticated \
            --port 8080 \
            --set-env-vars "ENVIRONMENT=production" \
            --update-secrets "DATABASE_URL=DATABASE_URL:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,SUPABASE_JWT_SECRET=SUPABASE_JWT_SECRET:latest,SUPABASE_DB_URL=SUPABASE_DB_URL:latest" \
            --quiet
```

다만 위 파일은 첫 커밋 그대로가 아닙니다. 첫 커밋의 메시지에는 GCP 자원을 `vgc-ai-2026-gary` 프로젝트에 만들었고 수동 배포로 `/health`가 살아 있는 걸 확인했다고 적혀 있는데, 그건 다른 개인 프로젝트용 GCP 프로젝트였습니다. 한 시간 남짓 뒤 커밋 `dafcbeb` "point Cloud Run deploy at study-helper-492805 project"가 `PROJECT_ID`, `WIF_PROVIDER`, `DEPLOY_SA` 세 값을 바꾸고, 첫 커밋에서 `DATABASE_URL` 하나만 붙였던 시크릿을 다섯 개 전부로 늘렸습니다. 커밋 메시지에 "was provisioned in the wrong default project"라고 적었습니다. `gcloud` 기본 프로젝트가 vgc-ai 쪽으로 잡혀 있는 채로 작업한 결과입니다.

## 남은 것

세 번 옮기는 동안 앱 코드에서 배포 때문에 바뀐 건 Railway 로그 한도에 걸려 pdfminer 로그 레벨을 낮춘 것 정도이고, 나머지는 전부 `.github/workflows` 아래 파일과 `deploy/` 폴더입니다. 4월 문서가 EC2를 고른 근거는 RDS 비용이었는데, 두 달 뒤 EC2도 비용 때문에 내렸고, 그 사이의 숫자는 남기지 않았습니다. 지금 저장소에는 껐다가 다시 켤 수 있게 남겨 둔 AWS 워크플로우와, 실제로 돌아가는 GCP 워크플로우가 나란히 있습니다.
