---
layout: default
permalink: /blog/
title: 글
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

<div id="main" role="main">
  <article class="page">
    <div class="page__inner-wrap">
      <header>
        <h1 class="page__title">{{ site.blog_name }}</h1>
        <p class="post-description">{{ site.blog_description }}</p>
      </header>

      <div class="tag-category-list">
        <ul>
          {% for category in site.display_categories %}
            <li>
              <i class="fas fa-tag fa-sm" aria-hidden="true"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ site.category_labels[category] | default: category }}</a>
            </li>
          {% endfor %}
        </ul>
      </div>

      <section class="page__content">
        <ul class="post-list">
          {% if page.pagination.enabled %}
            {% assign postlist = paginator.posts %}
          {% else %}
            {% assign postlist = site.posts %}
          {% endif %}

          {% for post in postlist %}
            {% include post-item.html post=post %}
          {% endfor %}
        </ul>

        {% if page.pagination.enabled %}
          {% include pagination.html %}
        {% endif %}
      </section>
    </div>
  </article>
</div>
