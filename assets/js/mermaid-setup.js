// 머메이드 다이어그램 렌더링. rouge/kramdown은 ```mermaid 코드펜스를
// <pre><code class="language-mermaid">로만 뱉고 mermaid.js가 인식하는 형태로 바꿔주지
// 않는다. al-folio가 실제로 쓰던 al_charts 젬의 mermaid-setup.js 방식(원본 코드는 감추고
// <pre class="mermaid">를 새로 만들어 옆에 붙이는 방식)을 그대로 옮겼다.
function mermaidCurrentTheme() {
  var t = document.documentElement.getAttribute("data-theme");
  return t === "dark" ? "dark" : "default";
}

window.mermaidSetTheme = function (theme) {
  if (typeof mermaid === "undefined") return;
  var mermaidTheme = theme === "dark" ? "dark" : "default";
  document.querySelectorAll(".mermaid").forEach(function (elem) {
    var backup = elem.previousElementSibling;
    if (backup && backup.classList.contains("unloaded")) {
      var code = backup.querySelector("code");
      if (code) {
        elem.removeAttribute("data-processed");
        elem.innerHTML = code.textContent;
      }
    }
  });
  mermaid.initialize({ theme: mermaidTheme });
  mermaid.init(undefined, document.querySelectorAll(".mermaid"));
};

document.addEventListener("readystatechange", function () {
  if (document.readyState !== "complete") return;
  if (typeof mermaid === "undefined") return;

  document.querySelectorAll("pre > code.language-mermaid").forEach(function (elem) {
    var code = elem.textContent;
    var backup = elem.parentElement;
    backup.classList.add("unloaded");

    var node = document.createElement("pre");
    node.classList.add("mermaid");
    node.appendChild(document.createTextNode(code));
    backup.after(node);
  });

  mermaid.initialize({ theme: mermaidCurrentTheme() });
});
