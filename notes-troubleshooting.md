---
layout: page
title: 문제 해결 기록
permalink: /notes/troubleshooting/
---

<ul class="post-list">
  {% for post in site.categories.troubleshooting %}
  <li>
    <span class="post-meta">{{ post.date | date: "%Y년 %-m월 %-d일" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
  </li>
  {% endfor %}
</ul>
