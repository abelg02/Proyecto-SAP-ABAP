/* Comportamiento común: menú móvil y la sección "de legacy a ABAP Cloud" de la portada */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Sección con scroll: cada paso de texto cambia el código de la ventana fija
  const steps = document.querySelectorAll('.evolution-steps .step');
  const pre = document.getElementById('evo-code');
  if (!steps.length || !pre || !window.AbapHighlight) return;

  const file = document.getElementById('evo-file');
  const badge = document.getElementById('evo-badge');
  const foot = document.getElementById('evo-foot');
  let current = -1;

  function show(i) {
    if (i === current) return;
    current = i;
    const step = steps[i];
    const tpl = document.getElementById(step.dataset.code);
    steps.forEach((s, j) => s.classList.toggle('active', j === i));
    pre.classList.add('fading');
    setTimeout(() => {
      pre.innerHTML = window.AbapHighlight.highlight(tpl.textContent.replace(/^\n/, '').replace(/\n\s*$/, ''));
      file.textContent = step.dataset.file;
      badge.textContent = step.dataset.badge;
      badge.className = 'badge badge-' + step.dataset.color;
      foot.innerHTML = step.dataset.foot;
      pre.classList.remove('fading');
    }, 160);
  }

  show(0);
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) show([...steps].indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => io.observe(s));
})();
