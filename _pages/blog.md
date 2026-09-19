---
layout: default
permalink: /blog/
title: 글
nav: false
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 15
  sort_field: date
  sort_reverse: true
  trail:
    before: 1
    after: 3
---

<div class="post">

  <div class="header-bar">
    <h1>{{ site.blog_name }}</h1>
    <h2>{{ site.blog_description }}</h2>
  </div>

  <div class="tag-category-list">
    <ul class="p-0 m-0">
      {% for category in site.display_categories %}
        <li>
          <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ site.category_labels[category] | default: category }}</a>
        </li>
        {% unless forloop.last %}
          <p>|</p>
        {% endunless %}
      {% endfor %}
    </ul>
  </div>

  <ul class="post-list">
    {% if page.pagination.enabled %}
      {% assign postlist = paginator.posts %}
    {% else %}
      {% assign postlist = site.posts %}
    {% endif %}

    {% for post in postlist %}
      {% include post_item.liquid post=post %}
    {% endfor %}
  </ul>

  {% if page.pagination.enabled %}
    {% include pagination.liquid %}
  {% endif %}

</div>
