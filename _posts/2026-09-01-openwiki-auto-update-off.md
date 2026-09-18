---
layout: post
title: "OpenWiki 자동 갱신을 18분 만에 끈 이유: LLM 없는 '뒤처진 커밋 수' 추적"
date: 2026-09-01 09:00:00 +0900
categories: [study]
tags: [team18-be, ax, documentation, github-actions, coding-agents]
---

동아리움(Team18_BE)은 팀 프로젝트(백엔드 3인, 프론트엔드 3인)다. 2026년 8월 31일 밤, 이 팀 레포에 OpenWiki로 저장소 위키 12페이지를 생성해 올리면서 "매일 LLM이 위키를 다시 쓰고 PR을 여는" 워크플로를 같이 붙였다. 그리고 18분 뒤, 같은 PR 안에서 그 워크플로에서 LLM 호출을 빼 버렸다. 남긴 것은 문서가 코드보다 몇 커밋 뒤처졌는지 세서 이슈에 적는 스크립트뿐이다. 왜 그랬는지, 그 뒤 실제로 어떻게 돌고 있는지 적는다.

**OpenWiki가 하는 일**

OpenWiki는 저장소 코드를 읽어 위키 페이지를 생성하는 도구다. 각 페이지의 문장은 실제 소스 파일과 라인을 근거(Claim)로 앵커링해서 `openwiki/.claims/*.json`에 남기고, `openwiki/.last-update.json`에 마지막으로 문서화한 커밋 해시(`gitHead`)를 기록한다. 이 레포에서는 아키텍처, 도메인 모델, 인증 세션, 지원과 전형 워크플로, 이메일 알림, 실시간 인기도 집계, 통계, 파일 저장, 배포와 모니터링, 테스트 전략을 다루는 12페이지가 나왔다([PR #371](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/pull/371), [이슈 #370](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/370)).

**처음 붙인 것: 매일 LLM이 위키를 다시 쓰고 PR을 연다**

초기화 커밋 5초 뒤에 올린 워크플로([b4382309](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/b4382309))는 OpenWiki 공식 템플릿에 가까웠다. 매일 08:00 UTC에 전체 히스토리를 받아 `openwiki code --update`를 돌리고, 바뀐 위키를 `peter-evans/create-pull-request`로 PR에 올린다. 그러려면 레포 시크릿에 `OPENAI_API_KEY`와 LangSmith 키 두 종이 있어야 하고, 워크플로 권한도 이만큼 필요했다.

```yaml
# .github/workflows/openwiki-update.yml (b4382309)
permissions:
  contents: write
  pull-requests: write
      - name: Run OpenWiki
        run: openwiki code --update --print
        env:
          OPENWIKI_PROVIDER: openai
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          OPENWIKI_MODEL_ID: "gpt-5.6-terra"
```

**18분 뒤, 같은 PR 안에서 되돌렸다**

00시 07분에 올린 워크플로를 00시 25분에 통째로 바꿨다([a446a5c0](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/commit/a446a5c0)). 커밋 메시지에 적은 이유는 이것이다.

> OpenAI/LangSmith 키 없이도 동작하도록, 코드를 재생성하는 대신 openwiki/.last-update.json의 gitHead 대비 뒤처진 커밋 수만 계산해 전용 이슈에 기록한다. 문서 갱신은 수동으로 계속 진행한다.

바뀐 것은 세 가지다. LLM 호출과 PR 생성 단계가 사라졌다. 권한은 `contents: write, pull-requests: write`에서 `contents: read, issues: write`로 내려갔다. 주기는 매일에서 매주 월요일로 바뀌었다. PR은 00시 29분에 머지됐고, GitHub에 등록된 워크플로는 처음부터 "OpenWiki Freshness Tracker" 하나뿐이다. LLM 자동 갱신 버전은 이 레포에서 한 번도 돌지 않았다.

**뒤처진 커밋 수만 센다**

남은 워크플로가 하는 일은 셸 두 줄로 요약된다.

```sh
# .github/workflows/openwiki-update.yml (a446a5c0)
last_head=$(jq -r '.gitHead' openwiki/.last-update.json)
commits_behind=$(git rev-list --count "${last_head}..HEAD")
```

그 숫자를 "OpenWiki 최신화 상태"라는 제목의 이슈 하나에 계속 덮어쓴다. 이슈가 없으면 만들고, 있으면 본문만 고친다. 본문에는 마지막 문서화 커밋, 뒤처진 커밋 수, compare 링크, 그리고 "쌓였다면 수동 갱신을 고려하라"는 한 줄이 들어간다. 문서를 고치는 주체는 사람이고, 자동화는 고칠 때가 됐는지를 알려주는 데서 멈춘다.

**팀 레포에서 실제로 어떻게 돌고 있나**

이 글을 쓰는 시점 기준으로 트래커는 9월 7일과 14일 두 번 돌았고 둘 다 성공했다. [이슈 #374](https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/issues/374)에는 마지막 문서화 커밋 `f8fc0e9`(8월 31일) 대비 뒤처진 커밋 7개가 적혀 있다. 즉 위키는 2주째 갱신되지 않았고, 그 사실이 이슈에 정직하게 남아 있다.

**같은 워크플로가 내 레포에서는 18번 실패했다**

대조군이 있다. 개인 레포 agent-research에는 처음 붙였던 LLM 자동 갱신 워크플로가 그대로 남아 있다. 8월 31일 첫 스케줄 실행부터 9월 17일까지 18번 돌았고 전부 실패다. 실패 지점은 매번 `Run OpenWiki` 단계, 소요 시간은 30초 안팎이다. 그 레포의 소스 문서에 9월 3일자로 이렇게 정정을 적어 뒀다.

> `gh run list --workflow=openwiki-update.yml`로 확인한 결과 최근 스케줄 실행 3건이 전부 30~37초 만에 failure로 끝났다. 이 레포에 `OPENAI_API_KEY`/`OPENWIKI_LANGSMITH_API_KEY` 시크릿이 설정돼 있지 않기 때문이다. 즉 이 레포의 OpenWiki는 "한 번 생성된 뒤 정지된 스냅샷"이지 "매일 자동 갱신되는 살아있는 시스템"이 아니다.

팀 레포에서는 18분 만에 뺀 의존성이 개인 레포에서는 2주 넘게 매일 빨간 실행 기록을 만들고 있었다. 정정 문서까지 써 놓고 워크플로는 안 고쳤다.

**지금 다시 본다면**

트래커로 바꾼 판단은 지금도 맞다고 본다. 팀 레포에 외부 LLM 키를 넣고 쓰기 권한을 준 워크플로가 매일 생성물을 PR로 올리는 구조는, 그 PR을 누가 어떤 기준으로 리뷰할지 정하지 않은 상태에서는 위험하다. 실제로 12페이지를 올린 PR #371 자체가 그 문제를 보여준다. CodeRabbit은 경로 필터 때문에 33개 파일을 전부 건너뛰었고, 사람 리뷰 코멘트 없이 30분 만에 머지됐다. 생성된 문서가 팀 레포에 들어가는 첫 관문부터 검토가 비어 있었다.

고쳐야 할 것도 남아 있다. `AGENTS.md`의 OpenWiki 블록에는 지금도 "The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki"라고 적혀 있고, README 기술 스택 표에는 "저장소 위키 자동 생성/갱신"이라고 적혀 있다. 둘 다 18분 뒤에 사라진 동작을 설명한다. 트래커가 "7개 뒤처짐"을 정확히 세고 있어도, 그 옆의 문서가 "자동으로 갱신된다"고 말하면 읽는 사람은 후자를 믿는다. 그리고 트래커 자체가 실패하면 그걸 누가 알아채는지도 정해져 있지 않다. 개인 레포의 18번 실패를 2주 동안 아무도 안 본 것이 그 답이다.

---

*AI가 한 것: 위키 12페이지 생성, 두 워크플로의 초안과 커밋 메시지 작성(PR #371의 커밋 4건 전부 `Co-Authored-By: Claude Sonnet 5`). 내가 한 것: LLM 자동 갱신을 빼고 추적만 남기기로 한 결정과 권한 축소, 주기를 주 1회로 바꾼 것, PR 머지.*
