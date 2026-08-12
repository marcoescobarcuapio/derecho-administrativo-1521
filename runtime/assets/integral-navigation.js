(() => {
  "use strict";

  const body = document.body;
  if (!body.classList.contains("presentation-mode")) return;

  const slides = Array.from(document.querySelectorAll("main > .integral-slide"));
  if (!slides.length) return;

  const progress = document.getElementById("presentation-progress");
  const map = document.getElementById("slide-map");
  const mapButton = document.querySelector('[data-action="map"]');
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrowQuery = window.matchMedia("(max-width: 820px)");
  const coarseQuery = window.matchMedia("(pointer: coarse)");
  const lecturaParameter = new URL(location.href).searchParams.get("lectura");
  const MOTION_MS = 560;
  const fitGenerations = new WeakMap();
  let activeIndex = 0;
  let transitionLocked = false;
  let pendingIndex = null;
  let touchStartX = null;
  let touchStartY = null;
  let touchStartedInScroller = false;
  let lastTrigger = null;
  let readingMode = false;
  const controls = document.querySelector(".presentation-controls");
  const readingButton = document.createElement("button");
  readingButton.type = "button";
  readingButton.className = "reading-toggle";
  readingButton.setAttribute("data-action", "toggle-reading");
  readingButton.setAttribute("aria-pressed", "false");
  controls?.insertBefore(readingButton, controls.querySelector(".print-link"));
  const modalBackground = [
    document.querySelector(".skip-link"),
    document.querySelector(".institutional-header"),
    document.querySelector("main"),
    document.querySelector(".presentation-controls"),
    document.querySelector(".public-author"),
    document.querySelector("noscript"),
  ].filter(Boolean);
  const backgroundState = new Map();

  const clamp = (value) => Math.max(0, Math.min(slides.length - 1, value));
  const indexForHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const found = slides.findIndex((slide) => slide.id === id);
    return found >= 0 ? found : 0;
  };

  const readerRecommended = () => narrowQuery.matches || coarseQuery.matches;

  const updateReaderControl = () => {
    const activeScale = Number(
      slides[activeIndex]?.querySelector(".slide-canvas")?.dataset.fitScale || 1
    );
    const available =
      readerRecommended() || lecturaParameter !== null || readingMode || activeScale < 0.8;
    readingButton.hidden = !available;
    readingButton.textContent = readingMode ? "Volver a presentación" : "Leer lámina";
    readingButton.setAttribute("aria-label", readingButton.textContent);
    readingButton.setAttribute("aria-pressed", readingMode ? "true" : "false");
  };

  const enhanceReadingScrollers = () => {
    document.querySelectorAll(".table-wrap").forEach((wrapper) => {
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "Tabla de la lámina; deslice horizontalmente si es necesario");
      wrapper.setAttribute("tabindex", "0");
    });
  };

  const setReadingMode = (enabled, focusHeading = true) => {
    readingMode = Boolean(enabled);
    body.classList.toggle("reading-mode", readingMode);
    if (readingMode) enhanceReadingScrollers();
    updateReaderControl();
    fitSlide(slides[activeIndex]);
    if (focusHeading) {
      const current = slides[activeIndex];
      const heading = current.querySelector("h2");
      current.scrollIntoView({ block: "start", behavior: "auto" });
      heading?.focus({ preventScroll: true });
    }
  };

  const fitSlide = (slide) => {
    const canvas = slide.querySelector(".slide-canvas");
    const frame = slide.querySelector(".slide-frame");
    if (!canvas || !frame) return;
    const generation = (fitGenerations.get(canvas) || 0) + 1;
    fitGenerations.set(canvas, generation);
    const currentPreview = () => fitGenerations.get(canvas) === generation && !readingMode;
    canvas.dataset.fitReady = "false";
    canvas.dataset.fitDiagnostic = "pending";
    canvas.style.setProperty("--fit-scale", "1");
    if (readingMode) {
      canvas.dataset.fitScale = "1";
      canvas.dataset.fitOverflow = "false";
      canvas.dataset.fitDiagnostic = "reading-mode";
      canvas.dataset.fitReady = "true";
      return;
    }
    const regions = Array.from(
      frame.querySelectorAll(".slide-heading,.slide-content,.slide-sources")
    );
    const overflowState = () => {
      const canvasRect = canvas.getBoundingClientRect();
      return regions.some((region) => {
        const rect = region.getBoundingClientRect();
        return rect.right > canvasRect.right + 0.5 || rect.bottom > canvasRect.bottom + 0.5;
      });
    };
    const previewLayoutIsStable = () => {
      if (!currentPreview() || body.classList.contains("reading-mode")) return false;
      const slideStyle = getComputedStyle(slide);
      const frameStyle = getComputedStyle(frame);
      const canvasWidth = canvas.clientWidth;
      const frameWidth = frame.getBoundingClientRect().width;
      return (
        slideStyle.position === "absolute" &&
        frameStyle.position === "relative" &&
        canvasWidth > 0 &&
        Math.abs(frameWidth - canvasWidth) <= 3
      );
    };
    const measureResetLayout = (attempt = 0) => {
      if (!currentPreview()) return;
      if (!previewLayoutIsStable()) {
        if (attempt < 12) {
          canvas.style.setProperty("--fit-scale", "1");
          void frame.offsetWidth;
          requestAnimationFrame(() => measureResetLayout(attempt + 1));
          return;
        }
        canvas.dataset.fitOverflow = "true";
        canvas.dataset.fitReady = "false";
        canvas.dataset.fitDiagnostic = "layout-retry-exhausted";
        if (slide === slides[activeIndex]) updateReaderControl();
        return;
      }
      const heightRatio = canvas.clientHeight / Math.max(frame.scrollHeight, 1);
      const widthRatio = canvas.clientWidth / Math.max(frame.scrollWidth, 1);
      const scale = Math.max(0.60, Math.min(1, heightRatio, widthRatio));
      canvas.style.setProperty("--fit-scale", scale.toFixed(4));
      canvas.dataset.fitScale = scale.toFixed(4);
      window.setTimeout(() => {
        if (currentPreview()) recordSettledFit();
      }, 100);
    };
    const recordSettledFit = (attempt = 0) => {
      if (!currentPreview()) return;
      const overflow = overflowState();
      if (overflow && attempt < 8) {
        const canvasRect = canvas.getBoundingClientRect();
        const contentRight = Math.max(...regions.map((region) => region.getBoundingClientRect().right));
        const contentBottom = Math.max(...regions.map((region) => region.getBoundingClientRect().bottom));
        const correction = Math.min(
          1,
          (canvasRect.width - 2) / Math.max(contentRight - canvasRect.left, 1),
          (canvasRect.height - 2) / Math.max(contentBottom - canvasRect.top, 1)
        );
        const currentScale = Number(canvas.dataset.fitScale || 1);
        const correctedScale = Math.max(0.60, currentScale * correction * 0.998);
        if (correctedScale < currentScale - 0.0001) {
          canvas.style.setProperty("--fit-scale", correctedScale.toFixed(4));
          canvas.dataset.fitScale = correctedScale.toFixed(4);
        }
        requestAnimationFrame(() => recordSettledFit(attempt + 1));
        return;
      }
      if (overflow) {
        canvas.dataset.fitOverflow = "true";
        canvas.dataset.fitReady = "false";
        canvas.dataset.fitDiagnostic = "overflow-after-retries";
        if (slide === slides[activeIndex]) updateReaderControl();
        return;
      }
      canvas.dataset.fitOverflow = "false";
      canvas.dataset.fitDiagnostic = "ok";
      canvas.dataset.fitReady = "true";
      if (slide === slides[activeIndex]) updateReaderControl();
    };
    /* Resetting scale changes the reciprocal frame dimensions. Measure only
       after the browser has committed that layout; otherwise repeated fits
       compound a stale scale and make dense slides microscopic. */
    requestAnimationFrame(() => requestAnimationFrame(measureResetLayout));
  };

  const update = (index, focusHeading) => {
    activeIndex = clamp(index);
    slides.forEach((slide, position) => {
      const active = position === activeIndex;
      slide.dataset.active = active ? "true" : "false";
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });
    const current = slides[activeIndex];
    const url = `${location.pathname}${location.search}#${encodeURIComponent(current.id)}`;
    history.replaceState(null, "", url);
    if (progress) {
      progress.style.width = `${((activeIndex + 1) / slides.length) * 100}%`;
      progress.setAttribute("aria-valuemax", String(slides.length));
      progress.setAttribute("aria-valuenow", String(activeIndex + 1));
      progress.setAttribute("aria-valuetext", `Lámina ${activeIndex + 1} de ${slides.length}`);
    }
    fitSlide(current);
    if (focusHeading) {
      const heading = current.querySelector("h2");
      if (readingMode) current.scrollIntoView({ block: "start", behavior: "auto" });
      if (heading) heading.focus({ preventScroll: true });
    }
  };

  const flushQueue = () => {
    transitionLocked = false;
    if (pendingIndex !== null && pendingIndex !== activeIndex) {
      const next = pendingIndex;
      pendingIndex = null;
      goTo(next, true);
    } else {
      pendingIndex = null;
    }
  };

  const goTo = (index, focusHeading = false) => {
    const target = clamp(index);
    if (transitionLocked) {
      pendingIndex = target;
      return;
    }
    if (target === activeIndex) {
      update(target, focusHeading);
      return;
    }
    transitionLocked = true;
    update(target, focusHeading);
    window.setTimeout(flushQueue, motionQuery.matches || readingMode ? 0 : MOTION_MS);
  };

  const closeMap = (restoreFocus = true) => {
    if (!map || map.hidden) return;
    map.hidden = true;
    modalBackground.forEach((element) => {
      const state = backgroundState.get(element);
      element.inert = state?.inert ?? false;
      if (state?.ariaHidden === null || state?.ariaHidden === undefined) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", state.ariaHidden);
      }
    });
    backgroundState.clear();
    if (mapButton) mapButton.setAttribute("aria-expanded", "false");
    if (restoreFocus && lastTrigger) lastTrigger.focus();
  };

  const openMap = (trigger) => {
    if (!map) return;
    lastTrigger = trigger;
    modalBackground.forEach((element) => {
      backgroundState.set(element, {
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      });
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    map.hidden = false;
    if (mapButton) mapButton.setAttribute("aria-expanded", "true");
    const activeLink = map.querySelector(`[data-slide-target="${slides[activeIndex].id}"]`);
    (activeLink || map.querySelector("a,button"))?.focus();
  };

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (control) {
      const action = control.dataset.action;
      if (action === "home") goTo(0, true);
      if (action === "previous") goTo(activeIndex - 1, true);
      if (action === "next") goTo(activeIndex + 1, true);
      if (action === "map") openMap(control);
      if (action === "close-map") closeMap();
      if (action === "toggle-reading") setReadingMode(!readingMode, true);
      return;
    }
    const target = event.target.closest("[data-slide-target]");
    if (target) {
      event.preventDefault();
      const index = slides.findIndex((slide) => slide.id === target.dataset.slideTarget);
      closeMap(false);
      if (index >= 0) goTo(index, true);
    }
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || event.target?.isContentEditable) return;
    if (!map?.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMap();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          map.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')
        ).filter((element) => !element.hidden && element.getClientRects().length);
        if (!focusable.length) {
          event.preventDefault();
          map.focus();
        } else {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      return;
    }
    const actions = {
      ArrowLeft: activeIndex - 1,
      ArrowRight: activeIndex + 1,
      PageUp: activeIndex - 1,
      PageDown: activeIndex + 1,
      Home: 0,
      End: slides.length - 1,
    };
    if (Object.hasOwn(actions, event.key)) {
      event.preventDefault();
      goTo(actions[event.key], true);
    }
  });

  document.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
    touchStartY = event.changedTouches[0]?.clientY ?? null;
    touchStartedInScroller = Boolean(event.target.closest(".table-wrap,a,button,[role='button']"));
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    const startX = touchStartX;
    const startY = touchStartY;
    const startedInScroller = touchStartedInScroller;
    touchStartX = null;
    touchStartY = null;
    touchStartedInScroller = false;
    if (startX === null || !map?.hidden) return;
    const distanceX = (event.changedTouches[0]?.clientX ?? startX) - startX;
    const distanceY = (event.changedTouches[0]?.clientY ?? startY) - (startY ?? 0);
    if (startedInScroller || window.getSelection()?.toString() || Math.abs(distanceX) < 48 || Math.abs(distanceX) < Math.abs(distanceY) * 1.25) return;
    goTo(activeIndex + (distanceX < 0 ? 1 : -1), true);
  }, { passive: true });

  window.addEventListener("hashchange", () => goTo(indexForHash(), true));
  window.addEventListener("resize", () => {
    updateReaderControl();
    fitSlide(slides[activeIndex]);
  });
  motionQuery.addEventListener?.("change", () => fitSlide(slides[activeIndex]));

  activeIndex = indexForHash();
  body.classList.add("js-ready");
  readingMode = lecturaParameter === "1" || (lecturaParameter !== "0" && readerRecommended());
  body.classList.toggle("reading-mode", readingMode);
  if (readingMode) enhanceReadingScrollers();
  updateReaderControl();
  update(activeIndex, false);
  document.fonts?.ready.then(() => fitSlide(slides[activeIndex]));
})();
