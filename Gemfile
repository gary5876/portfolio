source "https://rubygems.org"

gem "jekyll", "~> 4.4"
gem "minima", "~> 2.5"

group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-seo-tag"
end

# GitHub Pages currently ships an older Jekyll (3.10 via the github-pages gem).
# Using a modern Jekyll locally means the local preview may render slightly
# newer than what GitHub Pages serves. Fine for structure review; if the
# real deploy drifts, switch this Gemfile to `gem "github-pages", group: :jekyll_plugins`.

platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]
