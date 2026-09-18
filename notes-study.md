---
layout: page
title: 공부 노트
permalink: /notes/study/
---

<ul class="post-list">
  {% for post in site.categories.study %}
  <li>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
  </li>
  {% endfor %}
</ul>
