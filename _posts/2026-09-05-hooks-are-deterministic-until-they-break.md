---
layout: post
title: "훅은 확정이고 프롬프트는 확률이라는데, 훅도 깨집니다"
date: 2026-09-05 09:00:00 +0900
categories: [decisions]
tags: [agent-research, ax, coding-agents, hooks]
description: "AI에게 지키라고 적어둔 규칙 하나를 프롬프트 대신 훅으로 강제하기로 한 결정, 그리고 그 훅이 상대경로 때문에 깨진 일"
---

안녕하세요, 고준서입니다. agent-research는 "내 분야에 전문성이 있는 AI 에이전트를 어떻게 만드나"를 정리하는 개인 연구 레포예요. 9월 5일 아침에 카카오페이 기술 블로그의 AI 에이전트 글을 Claude Code에게 읽히고, 거기 나온 틀로 우리 시스템을 정돈할 수 있는지 보자고 했습니다.

> https://tech.kakaopay.com/post/ai-agent-1/ 이 내용을 자료에 넣어둬. 그리고 이거에 기반해서 시스템을 정돈할 수 있는지 확인해보자

첫 요약이 너무 얇아서 다시 시켰어요.

> 거기에 주의점 문제점 해결방법 고도화방법 기본틀 등 다양한 내용이 있었어. 긴 글이라 너가 대충 읽은 것 같아. 잘 나눠서 읽어봐

그 글의 원칙 중 하나가 "훅 실행은 보장되고 프롬프트는 확률"이었습니다. 훅이라는 건 AI가 어떤 도구를 쓰기 직전이나 직후에 무조건 실행되는 작은 프로그램이에요. 프롬프트에 "이건 하지 마"라고 적어 두면 AI가 그 지시를 지킬지는 매번 확률의 문제지만, 훅은 조건에 걸리면 예외 없이 막습니다. 이 글은 그 원칙을 우리 레포에 하나 적용한 것과, 적용한 훅이 같은 날 깨진 일의 기록입니다.

## 약속 하나를 차단으로 바꾸기

이 레포에는 OpenWiki라는 도구가 소스 문서를 읽어 자동으로 만든 위키가 있습니다. 그 위키를 손으로 고치면 다음 생성 때 덮어써지니까, "생성된 위키는 손으로 고치지 않는다"는 규칙을 문서에 적어 두고 있었어요. 적어만 둔 규칙이었죠.

Claude가 이 규칙을 `PreToolUse` 훅으로 옮겼습니다. 파일을 편집하는 도구가 호출되기 직전에 스크립트가 경로를 보고, 생성물 경로면 거부하는 구조예요.

```python
# .claude/hooks/block-openwiki-generated-edits.py
GENERATED_PATTERNS = [
    r"(^|/)openwiki/\.claims/",
    r"(^|/)openwiki/.*\.md$",
]
```

```python
    if any(re.search(p, file_path) for p in GENERATED_PATTERNS):
        reason = (
            f"Blocked: '{file_path}' is OpenWiki-generated content. "
            "Never hand-edit openwiki/*.md or openwiki/.claims/*.json "
            "(agent-expertise-framework/04-purpose-and-self-improvement-loop.md §5). "
            "Edit the source doc in agent-expertise-framework/ instead and let OpenWiki regenerate."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }))
```

문서 07의 실행 기록에 따르면 확인은 세 단계로 했습니다. 가짜 입력을 파이프로 넣어 차단 응답이 나오는지, 실제 편집 도구로 위키 파일을 고치려 했을 때 막히는지(막힌 뒤 파일이 안 바뀐 것을 grep으로 재확인), 그리고 소스 문서 편집은 정상 통과하는지. 처음엔 개인 설정 파일(`settings.local.json`, 커밋되지 않음)에 넣었다가 "이 레포에서 작업하는 누구에게나 적용돼야 하는 규칙"이라는 이유로 팀 공유 설정(`settings.json`)으로 옮겼다는 것도 거기 적혀 있어요.

같은 세션 초반에 다른 일로 제가 이런 말을 한 적이 있습니다. AI가 비슷한 계정 이름 둘을 같은 계정으로 넘겨짚었을 때였어요.

> 문자열이 다르다는걸 잘 인지했으면 문제 업었을 것 같은데, 그 부분을 툴로 만들어

"조심하겠다"가 아니라 도구로 막으라는 요구였고, 훅은 그 방향의 첫 구현이었습니다.

## 그 훅이 같은 날 깨졌습니다

훅을 넣고 몇 시간 뒤, 같은 문서(07)에 공급망 검증 결과를 적으려고 편집 도구를 쓰자 이런 오류가 났습니다.

```
python3: can't open file '.../.claude/skills/openwiki/.claude/hooks/block-openwiki-generated-edits.py'
```

설정 파일의 명령이 `python3 .claude/hooks/...`처럼 상대경로였는데, 직전에 실행한 셸 명령에서 다른 디렉터리로 `cd`한 상태가 이어져서 훅이 저장소 루트가 아닌 엉뚱한 곳에서 스크립트를 찾은 거예요. 훅은 "무조건 실행"되긴 했습니다. 실행돼서 실패했을 뿐이죠.

고친 건 명령 앞에 저장소 루트로 이동하는 한 줄이었습니다.

```json
"command": "cd \"$(git rev-parse --show-toplevel)\" && python3 .claude/hooks/block-openwiki-generated-edits.py"
```

일부러 저장소 밖 디렉터리에 서서 다시 편집을 시도해 차단되는 것까지 확인했다고 07에 적혀 있습니다.

문서에는 이 사건의 의미를 이렇게 정리해 뒀어요. "'구조적으로 불가능'을 다시 '프롬프트 수준의 우연'으로 되돌릴 수 있다는 걸 실제로 보여준 사례." 이번엔 훅이 시끄럽게 실패해서(오류 메시지가 남아서) 바로 잡혔지만, 조용히 통과시키는 방향으로 깨졌다면 규칙은 다시 약속으로 돌아가 있었을 겁니다.

## 그 뒤

이 훅과 문서는 Claude가 쓰고 제가 검토해 9월 5일 커밋([a15f7b9](https://github.com/gary5876/agent-research/commit/a15f7b9))으로 올렸습니다. 같은 날 제가 시킨 건 두 가지였어요. 쓰고 있는 OpenWiki 스킬이 믿을 만한 출처인지 확인할 것, 그리고 바뀐 흐름을 기록으로 남길 것.

> openwiki skill이 신뢰할 만한 출처인지 확인해줘. 충분히 신뢰할만한게 맞지만, 확인했다는 인증이 있어야 나중에 오류 안생길 것 같아서

> 그래. 일단 우리 개선된 에이전트 흐름부터 기록을 위해 수정해두자

문서에 적어 둔 규칙은 다섯 개인데 훅으로 바뀐 건 하나뿐이고, 나머지 넷이 훅으로 바꿀 수 있는 종류인지 아직 분류하지 않았습니다. 그건 07의 열린 질문 목록에 그대로 남아 있어요.
