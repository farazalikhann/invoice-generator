/* ==========================================================
   Shared static includes.
   Plain vanilla JS, no build step. Each page calls
   document.writeInclude("/partials/header.html") etc. at the
   exact spot the markup should appear. The request is
   synchronous (like an old-school server-side include) so the
   partial is fully in the DOM before any deferred script
   (script.js, template-config.js) runs — no race conditions,
   no flash of missing header/footer.

   This only works over http(s), which is how every static host
   (and the local dev server used to preview this site) serves
   pages — it will not work opened directly via file://.
   ========================================================== */

(function () {
  "use strict";

  function writeInclude(path) {
    var xhr = new XMLHttpRequest();
    // Synchronous by design — see file header comment.
    xhr.open("GET", path, false);
    try {
      xhr.send(null);
    } catch (e) {
      document.write('<!-- include failed: ' + path + ' -->');
      return;
    }
    if (xhr.status === 200 || xhr.status === 0) {
      document.write(xhr.responseText);
    } else {
      document.write('<!-- include failed (' + xhr.status + '): ' + path + ' -->');
    }
  }

  function highlightActiveNav() {
    var path = window.location.pathname;
    var section = "home";
    if (path.indexOf("/templates/") === 0) section = "templates";
    else if (path.indexOf("/blog/") === 0) section = "blog";

    var links = document.querySelectorAll(".site-nav__links a[data-nav]");
    for (var i = 0; i < links.length; i++) {
      var isActive = links[i].getAttribute("data-nav") === section;
      links[i].classList.toggle("is-active", isActive);
      if (isActive) {
        links[i].setAttribute("aria-current", "page");
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
  }

  function wireNavToggle() {
    var toggle = document.getElementById("site-nav-toggle");
    var inner = document.querySelector(".site-nav__inner");
    if (!toggle || !inner) return;
    toggle.addEventListener("click", function () {
      var isOpen = inner.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  window.writeIncludeHeader = function () {
    writeInclude("/partials/header.html");
    highlightActiveNav();
    wireNavToggle();
  };
  window.writeIncludeFooter = function () {
    writeInclude("/partials/footer.html");
  };
  window.writeIncludeTool = function () {
    writeInclude("/partials/tool.html");
  };
})();
