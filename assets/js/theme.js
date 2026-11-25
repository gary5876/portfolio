// 라이트/다크 토글 버튼 핸들러. MM엔 런타임 테마 전환 기능이 없어서 직접 구현했다.
// 실제 테마 결정(첫 페인트 전 적용)은 _includes/head.html의 블로킹 스크립트가 하고,
// 여기서는 클릭했을 때 전환과 저장만 담당한다.
(function () {
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var lightSheet = document.getElementById("theme-light-stylesheet");
  var darkSheet = document.getElementById("theme-dark-stylesheet");
  var icon = toggle.querySelector("i");

  function applyIcon(theme) {
    if (!icon) return;
    icon.classList.toggle("fa-moon", theme !== "dark");
    icon.classList.toggle("fa-sun", theme === "dark");
  }

  applyIcon(document.documentElement.getAttribute("data-theme"));

  toggle.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    darkSheet.disabled = next !== "dark";
    lightSheet.disabled = next === "dark";
    applyIcon(next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    if (window.mermaidSetTheme) {
      window.mermaidSetTheme(next);
    }
  });
})();
