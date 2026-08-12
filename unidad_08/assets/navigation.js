(function () {
  "use strict";
  const root = document.getElementById("contenido");
  if (!root || typeof window.impress !== "function") return;

  const deck = window.impress("contenido");
  deck.init();
  const steps = deck.steps ? deck.steps() : [];
  const home = document.getElementById("home");
  const previous = document.getElementById("previous");
  const next = document.getElementById("next");
  const mapToggle = document.getElementById("map-toggle");
  const slideIndex = document.getElementById("slide-index");
  const indexClose = document.getElementById("index-close");
  const status = document.getElementById("live-status");
  const progressText = document.getElementById("progress-text");
  const progressFill = document.getElementById("progress-fill");
  const touchLayout = window.matchMedia("(max-width: 1023px), (hover: none) and (pointer: coarse)");
  let mapVisible = false;
  let pointerStart = null;
  let movementLocked = false;
  let pendingMove = 0;
  let movementFallback = 0;
  let fitFrame = 0;

  function resetSlideFit(step) {
    if (!step) return;
    const content = step.querySelector(".slide-content");
    if (!content) return;
    content.style.removeProperty("width");
    content.style.removeProperty("transform");
    step.setAttribute("data-fit-scale", "1.000");
    step.removeAttribute("data-fit-overflow");
  }

  function fitActiveSlide(step) {
    if (!step) return;
    resetSlideFit(step);
    if (!touchLayout.matches) return;
    const content = step.querySelector(".slide-content");
    if (!content) return;
    const availableHeight = content.clientHeight;
    const availableWidth = content.clientWidth;
    if (availableHeight <= 0 || availableWidth <= 0) return;

    let scale = 1;
    for (let pass = 0; pass < 4; pass += 1) {
      content.style.width = (100 / scale).toFixed(3) + "%";
      const naturalHeight = content.scrollHeight;
      const naturalWidth = content.scrollWidth;
      const nextScale = Math.min(
        1,
        availableHeight / Math.max(naturalHeight, 1),
        availableWidth / Math.max(naturalWidth, 1)
      );
      if (Math.abs(nextScale - scale) < 0.004) {
        scale = nextScale;
        break;
      }
      scale = nextScale;
    }
    scale = Math.max(0.68, Math.min(1, scale));
    content.style.width = (100 / scale).toFixed(3) + "%";
    content.style.transform = "scale(" + scale.toFixed(4) + ")";
    step.setAttribute("data-fit-scale", scale.toFixed(3));
    const overflow = content.scrollHeight * scale > availableHeight + 2
      || content.scrollWidth * scale > availableWidth + 2;
    step.setAttribute("data-fit-overflow", String(overflow));
  }

  function scheduleFit(step) {
    window.cancelAnimationFrame(fitFrame);
    fitFrame = window.requestAnimationFrame(function () { fitActiveSlide(step); });
  }

  function updateHash(step) {
    if (!step) return;
    history.replaceState(null, "", "#" + step.id);
  }

  function announce(step) {
    if (!step) return;
    const heading = step.querySelector("h1, h2");
    const position = deck.index() + 1;
    progressText.textContent = position + " / " + steps.length;
    progressFill.style.width = ((position / steps.length) * 100) + "%";
    status.textContent = "Diapositiva " + position + " de " + steps.length + ": " + (heading ? heading.textContent : step.id);
  }

  function go(target, moveFocus) {
    mapVisible = false;
    document.body.classList.remove("map-view");
    mapToggle.setAttribute("aria-pressed", "false");
    const previousIndex = deck.index();
    const step = deck.goto(target);
    if (!step) return;
    if (!touchLayout.matches && deck.index() !== previousIndex) {
      movementLocked = true;
      root.classList.add("is-moving");
      window.clearTimeout(movementFallback);
      movementFallback = window.setTimeout(finishMovement, 660);
    }
    scheduleFit(step);
    if (touchLayout.matches) window.scrollTo(0, 0);
    updateHash(step);
    announce(step);
    if (moveFocus) step.focus({preventScroll: true});
  }

  function move(delta) {
    if (!touchLayout.matches && movementLocked) {
      pendingMove += delta;
      return;
    }
    go(Math.max(0, Math.min(steps.length - 1, deck.index() + delta)), true);
  }

  function finishMovement() {
    if (!movementLocked) return;
    movementLocked = false;
    root.classList.remove("is-moving");
    window.clearTimeout(movementFallback);
    movementFallback = 0;
    if (pendingMove !== 0) {
      const delta = Math.sign(pendingMove);
      pendingMove -= delta;
      move(delta);
    }
  }

  function closeIndex() {
    if (!slideIndex || !slideIndex.open) return;
    slideIndex.close();
    mapToggle.setAttribute("aria-pressed", "false");
    status.textContent = "Índice cerrado";
  }

  function openIndex() {
    if (!slideIndex || slideIndex.open) return;
    if (typeof slideIndex.showModal === "function") slideIndex.showModal();
    else slideIndex.setAttribute("open", "");
    mapToggle.setAttribute("aria-pressed", "true");
    status.textContent = "Índice de diapositivas abierto";
  }

  function toggleMap(force) {
    if (touchLayout.matches) {
      const shouldOpen = typeof force === "boolean" ? force : !(slideIndex && slideIndex.open);
      if (shouldOpen) openIndex();
      else closeIndex();
      return;
    }
    mapVisible = typeof force === "boolean" ? force : !mapVisible;
    document.body.classList.toggle("map-view", mapVisible);
    mapToggle.setAttribute("aria-pressed", String(mapVisible));
    status.textContent = mapVisible ? "Vista general activada" : "Vista general cerrada";
    if (!mapVisible) go(deck.index(), true);
  }

  home.addEventListener("click", function () { go(0, true); });
  previous.addEventListener("click", function () { move(-1); });
  next.addEventListener("click", function () { move(1); });
  mapToggle.addEventListener("click", function () { toggleMap(); });
  root.addEventListener("click", function (event) {
    if (!mapVisible || touchLayout.matches) return;
    const selectedStep = event.target.closest(".step");
    if (!selectedStep || !root.contains(selectedStep)) return;
    event.preventDefault();
    go(selectedStep, true);
  });
  root.addEventListener("transitionend", function (event) {
    if (event.target !== root || event.propertyName !== "transform") return;
    finishMovement();
  });
  if (indexClose) indexClose.addEventListener("click", closeIndex);
  if (slideIndex) {
    slideIndex.addEventListener("click", function (event) {
      if (event.target === slideIndex) closeIndex();
    });
  }

  document.addEventListener("click", function (event) {
    const indexButton = event.target.closest("[data-slide-target]");
    if (indexButton) {
      const target = document.getElementById(indexButton.getAttribute("data-slide-target"));
      if (target) go(target, true);
      closeIndex();
      return;
    }
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (target && target.classList.contains("step")) {
      event.preventDefault();
      go(target, true);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const forward = ["ArrowRight", "ArrowDown", "PageDown"];
    const backward = ["ArrowLeft", "ArrowUp", "PageUp"];
    if (forward.includes(event.key)) { event.preventDefault(); move(1); }
    else if (backward.includes(event.key)) { event.preventDefault(); move(-1); }
    else if (event.key === "Home") { event.preventDefault(); go(0, true); }
    else if (event.key === "End") { event.preventDefault(); go(steps.length - 1, true); }
    else if (event.key === "Escape") {
      event.preventDefault();
      if (slideIndex && slideIndex.open) closeIndex();
      else toggleMap(false);
    }
    else if (event.key.toLowerCase() === "m") { event.preventDefault(); toggleMap(); }
  });

  root.addEventListener("pointerdown", function (event) {
    if (!touchLayout.matches || event.isPrimary === false) return;
    if (event.target.closest("a, button, input, textarea, select, dialog")) return;
    pointerStart = {id: event.pointerId, x: event.clientX, y: event.clientY};
    if (typeof root.setPointerCapture === "function") root.setPointerCapture(event.pointerId);
  }, {passive: true});

  root.addEventListener("pointerup", function (event) {
    if (!touchLayout.matches || !pointerStart || event.pointerId !== pointerStart.id) return;
    const horizontal = event.clientX - pointerStart.x;
    const vertical = event.clientY - pointerStart.y;
    if (typeof root.releasePointerCapture === "function" && root.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }
    pointerStart = null;
    if (Math.abs(horizontal) < 48 || Math.abs(horizontal) < Math.abs(vertical) * 1.25) return;
    move(horizontal < 0 ? 1 : -1);
  }, {passive: true});

  root.addEventListener("pointercancel", function () { pointerStart = null; }, {passive: true});

  touchLayout.addEventListener("change", function () {
    pointerStart = null;
    movementLocked = false;
    pendingMove = 0;
    window.clearTimeout(movementFallback);
    root.classList.remove("is-moving");
    closeIndex();
    document.body.classList.remove("map-view");
    mapVisible = false;
    mapToggle.setAttribute("aria-pressed", "false");
    go(deck.index(), false);
  });

  window.addEventListener("resize", function () {
    scheduleFit(steps[deck.index()]);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { scheduleFit(steps[deck.index()]); });
  }

  const initial = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
  go(initial && initial.classList.contains("step") ? initial : 0, false);
  window.scrollTo(0, 0);
})();
