# 프로젝트의 kind(팀/개인)와 stack 항목마다 /tags/<slug>/ 페이지를 만든다.
# "AWS (EC2, ECR)"처럼 괄호가 붙은 항목은 괄호 앞 이름("AWS")으로 묶는다.
module TagPages
  def self.base_name(value)
    value.to_s.split(" (").first.strip
  end

  def self.kind_name(project)
    project.data["kind"].to_s.include?("팀") ? "팀 프로젝트" : "개인 프로젝트"
  end

  # 한글 태그는 URL이 %ED%8C%80... 로 보이므로 짧은 영문 slug를 쓴다.
  KIND_SLUGS = { "팀 프로젝트" => "team", "개인 프로젝트" => "solo" }.freeze

  def self.slug(name)
    KIND_SLUGS[name] || Jekyll::Utils.slugify(name)
  end

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      tags = Hash.new { |h, k| h[k] = [] }
      site.collections["projects"].docs.each do |project|
        tags[TagPages.kind_name(project)] << project
        Array(project.data["stack"]).each do |s|
          name = TagPages.base_name(s)
          tags[name] << project unless tags[name].include?(project)
        end
      end

      index = []
      tags.each do |name, projects|
        slug = TagPages.slug(name)
        page = Jekyll::PageWithoutAFile.new(site, site.source, File.join("tags", slug), "index.html")
        page.data.merge!(
          "layout" => "tag",
          "title" => name,
          "tag_name" => name,
          "project_tags" => projects.map { |p| p.data["tag"] }
        )
        page.content = ""
        site.pages << page
        index << { "name" => name, "slug" => slug, "count" => projects.size }
      end

      site.data["tag_index"] = index.sort_by { |t| [-t["count"], t["name"].downcase] }
    end
  end
end
