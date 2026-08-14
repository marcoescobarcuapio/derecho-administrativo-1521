(() => {
  const body = document.body;
  const deck = document.querySelector('.deck');
  if (!body || !deck) return;

  let hint = document.querySelector('.orientation-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'orientation-hint';
    hint.textContent = 'Gira el dispositivo para presentar en formato 16:9.';
    const header = document.querySelector('.institutional-header');
    (header || body).insertAdjacentElement(header ? 'afterend' : 'afterbegin', hint);
  }

  const update = () => {
    const portrait = window.innerWidth <= 820 && window.innerHeight >= window.innerWidth;
    body.dataset.viewMode = portrait ? 'reading' : 'presentation';
    body.classList.toggle('reading-mode', portrait);
    body.classList.toggle('presentation-mode', !portrait);

    if (portrait) {
      document.documentElement.style.setProperty('--deck-scale', '1');
    } else {
      const compactLandscape = window.innerHeight <= 500;
      const availableWidth = window.innerWidth - (compactLandscape ? 12 : 0);
      const reservedHeight = compactLandscape ? 58 : 126;
      const availableHeight = window.innerHeight - reservedHeight;
      const scale = Math.min(availableWidth / 1280, availableHeight / 720, 1);
      document.documentElement.style.setProperty('--deck-scale', String(Math.max(scale, 0.1)));
    }
  };

  addEventListener('resize', update, { passive: true });
  addEventListener('orientationchange', update, { passive: true });

  const setFragment = (slide, index) => {
    const fragments = [...slide.querySelectorAll('.source-fragment')];
    if (!fragments.length) return;
    const next = Math.max(0, Math.min(index, fragments.length - 1));
    slide.dataset.fragmentIndex = String(next);
    fragments.forEach((fragment, position) => {
      fragment.classList.toggle('is-visible', position === next);
      fragment.setAttribute('aria-hidden', String(position !== next && body.dataset.viewMode === 'presentation'));
    });
    const live = document.querySelector('#live-status');
    if (live && fragments.length > 1) {
      live.textContent = `Concepto ${next + 1} de ${fragments.length} en esta diapositiva`;
    }
  };

  const stepFragment = direction => {
    if (body.dataset.viewMode !== 'presentation') return false;
    const slide = document.querySelector('.slide.active[data-progressive="true"]');
    if (!slide) return false;
    const fragments = [...slide.querySelectorAll('.source-fragment')];
    const current = Number(slide.dataset.fragmentIndex || 0);
    const next = current + direction;
    if (next < 0 || next >= fragments.length) return false;
    setFragment(slide, next);
    return true;
  };

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    const direction = action === 'next' ? 1 : (action === 'prev' || action === 'previous' ? -1 : 0);
    if (direction && stepFragment(direction)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  addEventListener('keydown', event => {
    const direction = event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' '
      ? 1
      : (event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 0);
    if (direction && stepFragment(direction)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.querySelectorAll('.slide[data-progressive="true"]').forEach(slide => setFragment(slide, 0));
  new MutationObserver(records => {
    records.forEach(record => {
      const slide = record.target;
      if (slide.classList.contains('slide') && !slide.classList.contains('active')) {
        setFragment(slide, 0);
      }
    });
  }).observe(document.querySelector('.deck'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  update();
})();
