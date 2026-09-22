---
layout: page
title: 프로젝트
permalink: /projects/
description: 팀 프로젝트 3개, 개인 프로젝트 3개. 카드를 누르면 기간, 구성, 역할, 결과와 관련 글이 나옵니다. 태그를 누르면 같은 기술을 쓴 프로젝트가 모입니다.
---

{% assign sorted_projects = site.projects | sort: "importance" %}
<div class="project-grid">
  {% for project in sorted_projects %}
    {% include project-card.html project=project %}
  {% endfor %}
</div>

<p><a href="{{ "/tags/" | relative_url }}">태그 전체 보기</a></p>
