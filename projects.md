---
layout: page
title: 프로젝트
permalink: /projects/
---

{%- assign sorted_projects = site.projects | sort: "order" -%}
<ul class="post-list">
  {%- for proj in sorted_projects -%}
  <li class="post-card project-card">
    {%- if proj.kind -%}<span class="kind-badge">{{ proj.kind }}</span>{%- endif -%}
    <h3><a class="post-link" href="{{ proj.url | relative_url }}">{{ proj.display_name | default: proj.title | escape }}</a></h3>
    {%- if proj.period -%}<p class="post-meta">{{ proj.period }}</p>{%- endif -%}
    {%- if proj.role -%}<p class="project-summary">{{ proj.role }}</p>{%- endif -%}
    {%- if proj.result -%}<p class="project-result">{{ proj.result }}</p>{%- endif -%}
    {%- if proj.stack -%}
    <div class="tag-list">
      {%- for s in proj.stack -%}<span class="tag-chip stack-chip">{{ s }}</span>{%- endfor -%}
    </div>
    {%- endif -%}
  </li>
  {%- endfor -%}
</ul>
