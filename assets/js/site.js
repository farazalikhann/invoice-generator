/* ==========================================================
   Site-wide behavior only.

   Header, footer, and (on tool pages) the invoice form/preview
   are written directly as static HTML in every page — not
   generated or injected by JavaScript — so the content is fully
   visible to search engines and to users with JavaScript
   disabled. This file only adds interactivity on top of markup
   that already exists in the page: the mobile nav toggle.
   ========================================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("site-nav-toggle");
    var inner = document.querySelector(".site-nav__inner");
    if (!toggle || !inner) return;

    toggle.addEventListener("click", function () {
      var isOpen = inner.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });
})();
