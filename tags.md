---
layout: page
title: 태그
permalink: /tags/
---

태그를 누르면 그 기술을 쓴 프로젝트와 관련 글이 모입니다.

<div class="tag-list tag-index">
{%- for t in site.data.tag_index -%}
  <a class="tag-chip" href="{{ "/tags/" | append: t.slug | append: "/" | relative_url }}">{{ t.name }} <span class="tag-count">{{ t.count }}</span></a>
{%- endfor -%}
</div>
