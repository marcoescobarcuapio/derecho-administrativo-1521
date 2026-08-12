(() => {
  "use strict";

  const body = document.body;
  if (!body.classList.contains("print-mode")) return;

  const MIN_SCALE = 0.25;
  const TITLE_FONT_FLOOR = 24.02;
  const KICKER_FONT_FLOOR = 8.02;
  const NUMBER_FONT_FLOOR = 10.02;
  const BODY_FONT_FLOOR = 12.02;
  const SOURCE_FONT_FLOOR = 8.02;
  const TOLERANCE = 0.75;
  const fitSection = (section) => {
    const canvas = section.querySelector(".slide-canvas");
    const frame = section.querySelector(".slide-frame");
    if (!canvas || !frame) return { id: section.id, scale: 1, overflow: true };

    let scale = 1;
    const overflowAt = (candidate) => {
      canvas.style.setProperty("--fit-scale", candidate.toFixed(4));
      canvas.style.setProperty(
        "--fit-title-font-floor",
        `${(TITLE_FONT_FLOOR / candidate).toFixed(4)}px`
      );
      canvas.style.setProperty(
        "--fit-kicker-font-floor",
        `${(KICKER_FONT_FLOOR / candidate).toFixed(4)}px`
      );
      canvas.style.setProperty(
        "--fit-number-font-floor",
        `${(NUMBER_FONT_FLOOR / candidate).toFixed(4)}px`
      );
      canvas.style.setProperty(
        "--fit-body-font-floor",
        `${(BODY_FONT_FLOOR / candidate).toFixed(4)}px`
      );
      canvas.style.setProperty(
        "--fit-source-font-floor",
        `${(SOURCE_FONT_FLOOR / candidate).toFixed(4)}px`
      );
      const canvasRect = canvas.getBoundingClientRect();
      const visibleNodes = Array.from(
        frame.querySelectorAll(
          ".slide-heading, .slide-content, .theme-anchor, .content-block, " +
          ".accessible-visual, .slide-sources, .bibliography-body, .bibliography-footer"
        )
      ).filter((node) => getComputedStyle(node).display !== "none");
      return visibleNodes.some((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.left < canvasRect.left - TOLERANCE ||
          rect.top < canvasRect.top - TOLERANCE ||
          rect.right > canvasRect.right + TOLERANCE ||
          rect.bottom > canvasRect.bottom + TOLERANCE
        );
      });
    };
    if (overflowAt(1)) {
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 10; iteration += 1) {
        const candidate = (low + high) / 2;
        if (overflowAt(candidate)) high = candidate;
        else low = candidate;
      }
      scale = Math.max(MIN_SCALE, low);
      overflowAt(scale);
    }

    canvas.style.setProperty("--fit-scale", scale.toFixed(4));
    section.dataset.printScale = scale.toFixed(4);
    const canvasRect = canvas.getBoundingClientRect();
    const visibleNodes = Array.from(
      frame.querySelectorAll(
        ".slide-heading, .slide-content, .theme-anchor, .content-block, " +
        ".accessible-visual, .slide-sources, .bibliography-body, .bibliography-footer"
      )
    ).filter((node) => getComputedStyle(node).display !== "none");
    const overflow = visibleNodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left < canvasRect.left - TOLERANCE ||
        rect.top < canvasRect.top - TOLERANCE ||
        rect.right > canvasRect.right + TOLERANCE ||
        rect.bottom > canvasRect.bottom + TOLERANCE
      );
    });
    return { id: section.id, scale, overflow };
  };

  const ready = async () => {
    await document.fonts?.ready;
    const audits = [];
    for (const section of document.querySelectorAll("main > section")) {
      audits.push(fitSection(section));
    }
    const errors = audits.filter((audit) => audit.overflow);
    if (errors.length) {
      body.dataset.printError = errors.map((audit) => audit.id).join(",");
      console.error(`Print fit failed for ${errors.length} sections.`);
    } else {
      delete body.dataset.printError;
    }
    body.dataset.printMinScale = Math.min(...audits.map((audit) => audit.scale)).toFixed(4);
    body.dataset.printReady = "true";
  };

  ready();
})();
