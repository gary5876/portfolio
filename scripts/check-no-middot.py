#!/usr/bin/env python3
"""가운뎃점(·)과 변종이 콘텐츠에 있으면 실패. 글은 무슨 일이 있어도 이 검사를 통과해야 한다."""
import glob, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BANNED = {"·": "·", "ㆍ": "ㆍ", "•": "•", "∙": "∙", "・": "・"}
targets = []
for pat in ("_posts/*.md", "_projects/*.md", "*.md", "_config.yml", "_includes/*.html", "_layouts/*.html", "assets/*.scss"):
    targets += glob.glob(pat)
def content_lines(path):
    """펜스 코드 블록(```) 안은 원문 인용이므로 검사에서 제외한다."""
    in_fence = False
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
                continue
            if not in_fence:
                yield i, line

hits = []
for path in sorted(targets):
    if True:
        for i, line in content_lines(path):
            for ch, label in BANNED.items():
                if ch in line:
                    hits.append(f"{path}:{i}: {label} U+{ord(ch):04X}  {line.rstrip()[:80]}")
# 줄표(— U+2014)도 전면 금지.
dash_fail, dash_warn = [], []
for path in sorted(targets):
    if True:
        for i, line in content_lines(path):
            if "\u2014" in line:
                dash_fail.append(f"{path}:{i}: {line.rstrip()[:80]}")
if hits or dash_fail:
    if hits:
        print("가운뎃점 발견. 제거 필요:"); print("\n".join(hits))
    if dash_fail:
        print("글에 줄표(—) 발견. 제거 필요:"); print("\n".join(dash_fail))
    sys.exit(1)
if dash_warn:
    print(f"경고: 글 외 파일에 줄표(—) {len(dash_warn)}곳 (4단계 교차검증 때 정리)")
print("OK: 가운뎃점 없음, 글에 줄표 없음")
