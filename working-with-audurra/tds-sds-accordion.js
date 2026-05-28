(function () {
  var root = document.querySelector('.wwa-doc-accordion');
  if (!root) return;

  root.querySelectorAll('.wwa-accordion-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var section = trigger.closest('.wwa-accordion-section');
      if (!section) return;
      var isOpen = section.classList.contains('active');
      section.classList.toggle('active', !isOpen);
      trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
  });
})();
