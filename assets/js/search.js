// 가벼운 클라이언트사이드 검색. al-folio의 al_search(ninja-keys 커맨드 팔레트, 무겁고
// 의존성 많음) 대신 만들었다. 빌드 시 생성되는 /search.json을 fetch해서 제목/설명/카테고리를
// 부분 문자열로 필터링하는 정도로 단순하게 뒀다 — 글 33개, 프로젝트 6개짜리 사이트라
// 정교한 랭킹까지는 필요 없다고 판단.
(function () {
  var toggle = document.getElementById("search-toggle");
  var overlay = document.getElementById("search-overlay");
  if (!toggle || !overlay) return;

  var input = document.getElementById("search-input");
  var closeBtn = document.getElementById("search-close");
  var resultsEl = document.getElementById("search-results");
  var data = null;

  function open() {
    overlay.hidden = false;
    input.value = "";
    resultsEl.innerHTML = "";
    input.focus();
    if (!data) {
      fetch(overlay.dataset.searchUrl)
        .then(function (r) { return r.json(); })
        .then(function (json) { data = json; })
        .catch(function () { data = []; });
    }
  }

  function close() {
    overlay.hidden = true;
  }

  function render(query) {
    if (!data || query.trim() === "") {
      resultsEl.innerHTML = "";
      return;
    }
    var q = query.toLowerCase();
    var matches = data.filter(function (item) {
      return (
        item.title.toLowerCase().indexOf(q) !== -1 ||
        item.description.toLowerCase().indexOf(q) !== -1
      );
    }).slice(0, 20);

    resultsEl.innerHTML = matches.map(function (item) {
      return (
        '<li><a href="' + item.url + '">' +
        '<span class="search-result-title">' + escapeHtml(item.title) + "</span>" +
        '<span class="search-result-category">' + escapeHtml(item.category) + "</span>" +
        "<p>" + escapeHtml(item.description) + "</p>" +
        "</a></li>"
      );
    }).join("");

    if (matches.length === 0) {
      resultsEl.innerHTML = "<li class=\"search-no-results\">검색 결과가 없습니다.</li>";
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  toggle.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close();
  });
  input.addEventListener("input", function () {
    render(input.value);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      overlay.hidden ? open() : close();
    }
    if (e.key === "Escape" && !overlay.hidden) close();
  });
})();
