// Generic accordion behavior for optional left navigation blocks.
(function () {
  "use strict";

  function normalizeUrl(href) {
    const url = new URL(href, window.location.href);
    let path = url.pathname;
    if (path.endsWith("/") && path.length > 1) {
      path = path.slice(0, -1);
    }
    return path + url.search;
  }

  function markCurrentLinks() {
    const current = normalizeUrl(window.location.href);
    document.querySelectorAll(".facet-nav-inner a[href]").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      if (normalizeUrl(link.href) !== current) {
        return;
      }
      link.setAttribute("aria-current", "page");
      if (link.classList.contains("facet-sublink")) {
        link.classList.add("facet-sublink--current");
      }
      if (link.classList.contains("facet-leaf-link")) {
        link.classList.add("facet-leaf-link--current");
      }
      const block = link.closest(".facet-block");
      if (block instanceof HTMLElement && link.classList.contains("facet-block-heading-link")) {
        block.classList.add("facet-block--expanded");
      }
    });
  }

  function toggleFacetBlock(block) {
    const panel = Array.from(block.children).find(
      (child) =>
        child instanceof HTMLElement &&
        child.classList.contains("facet-block-panel"),
    );
    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const willOpen = panel.hasAttribute("hidden");
    panel.toggleAttribute("hidden", !willOpen);
    block.classList.toggle("facet-block--expanded", willOpen);

    block.querySelectorAll("[data-facet-toggle]").forEach((el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      el.setAttribute("aria-expanded", willOpen ? "true" : "false");
      const icon = el.querySelector(".facet-toggle-icon");
      if (icon) {
        icon.textContent = willOpen ? "−" : "+";
      }
    });
  }

  document.querySelectorAll("[data-facet-toggle]").forEach((trigger) => {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const block = trigger.closest(".facet-block");
      if (!(block instanceof HTMLElement)) {
        return;
      }
      toggleFacetBlock(block);
    });
  });

  markCurrentLinks();
})();
