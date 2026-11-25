#!/usr/bin/env python3
"""가운뎃점(·)과 변종, 줄표(—)가 콘텐츠에 있으면 실패. 글은 무슨 일이 있어도 이 검사를 통과해야 한다.

`--site` 를 주면 빌드 결과(_site)의 HTML도 검사한다(테마 gem이 넣는 문구까지 잡기 위해). 코드 블록(<pre>)은 제외.
"""
import glob, os, re, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BANNED = {"·": "·", "ㆍ": "ㆍ", "•": "•", "∙": "∙", "・": "・"}
targets = []
for pat in ("_posts/*.md", "_projects/*.md", "_pages/*.md", "*.md", "_config.yml", "_data/*.yml",
            "_includes/*.html", "_includes/*.liquid", "_layouts/*.html", "_layouts/*.liquid",
            "_sass/*.scss", "assets/*.scss", "assets/css/*.scss"):
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

hits, dash_fail = [], []
for path in sorted(targets):
    for i, line in content_lines(path):
        for ch, label in BANNED.items():
            if ch in line:
                hits.append(f"{path}:{i}: {label} U+{ord(ch):04X}  {line.rstrip()[:80]}")
        if "—" in line:
            dash_fail.append(f"{path}:{i}: {line.rstrip()[:80]}")

if "--site" in sys.argv and os.path.isdir("_site"):
    pre = re.compile(r"<pre\b.*?</pre>", re.S)
    for path in sorted(glob.glob("_site/**/*.html", recursive=True)):
        with open(path, encoding="utf-8", errors="ignore") as f:
            html = pre.sub("", f.read())
        for ch, label in BANNED.items():
            if ch in html:
                idx = html.index(ch)
                hits.append(f"{path}: {label} U+{ord(ch):04X}  …{html[max(0, idx-40):idx+40]!r}")
        if "&middot;" in html or "&#183;" in html:
            hits.append(f"{path}: &middot; 엔티티")

if hits or dash_fail:
    if hits:
        print("가운뎃점 발견. 제거 필요:"); print("\n".join(hits))
    if dash_fail:
        print("글에 줄표(—) 발견. 제거 필요:"); print("\n".join(dash_fail))
    sys.exit(1)
print("OK: 가운뎃점 없음, 글에 줄표 없음")
