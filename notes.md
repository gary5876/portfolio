---
layout: page
title: Notes
permalink: /notes/
---

공부한 것과 관련 고민을 기록합니다. [Study]({{ "/notes/study/" | relative_url }})는 학습 노트, [Postmortem]({{ "/notes/postmortem/" | relative_url }})은 프로젝트에서 겪은 구체적인 문제와 해결 과정입니다.

<ul class="post-list">
  {% assign notes = site.categories.study | concat: site.categories.postmortem %}
  {% for post in notes %}
  <li>
    <span class="cat-badge cat-{{ post.categories | first }}">{{ post.categories | first }}</span>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
  </li>
  {% endfor %}
</ul>
