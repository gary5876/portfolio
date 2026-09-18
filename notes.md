---
layout: page
title: 기록
permalink: /notes/
---

공부한 것과 프로젝트에서 겪은 문제를 기록합니다. [공부 노트]({{ "/notes/study/" | relative_url }})는 읽고 배운 것, [문제 해결 기록]({{ "/notes/troubleshooting/" | relative_url }})은 실제로 겪은 장애와 버그를 어떻게 찾고 고쳤는지입니다.

<ul class="post-list">
  {% assign notes = site.categories.study | concat: site.categories.troubleshooting %}
  {% for post in notes %}
  <li>
    <span class="cat-badge cat-{{ post.categories | first }}">{%- assign cat = post.categories | first -%}{{ site.category_labels[cat] | default: cat }}</span>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
  </li>
  {% endfor %}
</ul>
