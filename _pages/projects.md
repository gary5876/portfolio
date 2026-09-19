---
layout: page
title: 프로젝트
permalink: /projects/
description: 팀 프로젝트 3개, 개인 프로젝트 3개. 카드를 누르면 기간, 구성, 역할, 결과와 관련 글이 나옵니다. 태그를 누르면 같은 기술을 쓴 프로젝트가 모입니다.
nav: true
nav_order: 1
---

<!-- pages/projects.md -->
<div class="projects">
  {% assign sorted_projects = site.projects | sort: "importance" %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
</div>

<p class="mt-6"><a href="{{ "/tags/" | relative_url }}">태그 전체 보기</a></p>
