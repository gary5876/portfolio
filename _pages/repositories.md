---
layout: page
permalink: /repositories/
title: 저장소
description: GitHub 프로필과 프로젝트 저장소입니다. 카드는 GitHub 통계를 실시간으로 불러옵니다.
---

{% if site.data.repositories.github_users %}
<div class="repositories">
  {% for user in site.data.repositories.github_users %}
    {% include repo-user.html username=user %}
  {% endfor %}
</div>

---
{% endif %}

{% if site.data.repositories.github_repos %}
<div class="repositories">
  {% for repo in site.data.repositories.github_repos %}
    {% include repo-pin.html repository=repo %}
  {% endfor %}
</div>
{% endif %}
