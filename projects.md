---
layout: page
title: 프로젝트
permalink: /projects/
---

<p>태그를 누르면 같은 기술을 쓴 프로젝트를 모아 볼 수 있습니다. <a href="{{ "/tags/" | relative_url }}">태그 전체 보기</a></p>

{% assign sorted_projects = site.projects | sort: "order" %}
<ul class="post-list">
  {%- for proj in sorted_projects -%}
  <li class="post-card project-card">
    <a class="card-cover" href="{{ proj.url | relative_url }}" aria-label="{{ proj.display_name | default: proj.title | escape }}"></a>
    {%- include project-tags.html project=proj stack=true -%}
    <h3><a class="post-link" href="{{ proj.url | relative_url }}">{{ proj.display_name | default: proj.title | escape }}</a></h3>
    {%- if proj.period -%}<p class="post-meta">{{ proj.period }}</p>{%- endif -%}
    {%- if proj.role -%}<p class="project-summary">{{ proj.role }}</p>{%- endif -%}
    {%- if proj.result -%}<p class="project-result">{{ proj.result }}</p>{%- endif -%}
  </li>
  {%- endfor -%}
</ul>
