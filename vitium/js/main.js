/* ==========================================================================
   VITIUM — interactions
   A single, dependency-free page. Nothing typed into the confessional leaves
   the browser. The only persistent thing here is the sound you choose to hear.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  let prefersReduced = motionQuery.matches;

  const sins = {
    pride: { roman: "I", en: "Pride", cn: "傲慢", latin: "Superbia", color: "#1f3fff" },
    greed: { roman: "II", en: "Greed", cn: "贪婪", latin: "Avaritia", color: "#c8a24a" },
    lust: { roman: "III", en: "Lust", cn: "色欲", latin: "Luxuria", color: "#e7978a" },
    envy: { roman: "IV", en: "Envy", cn: "嫉妒", latin: "Invidia", color: "#c8d936" },
    gluttony: { roman: "V", en: "Gluttony", cn: "暴食", latin: "Gula", color: "#d7472f" },
    wrath: { roman: "VI", en: "Wrath", cn: "暴怒", latin: "Ira", color: "#e84522" },
    sloth: { roman: "VII", en: "Sloth", cn: "怠惰", latin: "Acedia", color: "#8b9990" }
  };

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start"
    });
    if (history.replaceState) history.replaceState(null, "", `#${id}`);
  };

  /* ------------------------------------------------------------------------
     Chapter colours, rail progress, page chrome
     ------------------------------------------------------------------------ */
  const initChapters = () => {
    const sections = $$("[data-chapter]");
    const rail = $("#chapter-rail");
    const railLinks = $$(".rail-link");
    const metaTheme = $('meta[name="theme-color"]');
    let activeId = null;

    const applySection = (section) => {
      if (!section) return;
      const id = section.dataset.chapter;
      if (id === activeId) return;
      activeId = id;

      const bg = section.dataset.bg || "#e8e2d5";
      const fg = section.dataset.fg || "#12110e";
      document.documentElement.style.setProperty("--chrome-bg", bg);
      document.documentElement.style.setProperty("--chrome-fg", fg);
      if (metaTheme) metaTheme.setAttribute("content", bg);
      document.body.dataset.activeChapter = id;

      const isSin = Boolean(sins[id]);
      railLinks.forEach((link) => {
        const isActive = link.dataset.rail === id;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      if (rail) {
        const visible = isSin || id === "confession";
        rail.classList.toggle("is-visible", visible);
      }

      if (audioState.ctx && audioState.filter) {
        const frequencies = {
          hero: 460,
          prologue: 320,
          pride: 760,
          greed: 200,
          lust: 540,
          envy: 920,
          gluttony: 280,
          wrath: 1150,
          sloth: 190,
          confession: 340
        };
        audioState.filter.frequency.setTargetAtTime(
          frequencies[id] || 420,
          audioState.ctx.currentTime,
          1.4
        );
      }
    };

    let rafId = 0;
    const measure = () => {
      rafId = 0;
      const marker = window.innerHeight * 0.44;
      let current = sections[0];
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= marker) current = section;
      }
      applySection(current);
    };

    const requestMeasure = () => {
      if (!rafId) rafId = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure, { passive: true });
    measure();

    // Opening at a deep link should immediately adopt that room's colour.
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target && target.dataset.chapter) applySection(target);
    }
  };

  /* ------------------------------------------------------------------------
     Reveals
     ------------------------------------------------------------------------ */
  const initReveals = () => {
    const elements = $$(".reveal");
    if (!elements.length) return;

    if (prefersReduced || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-inview"));
      return;
    }

    const groups = new Map();
    elements.forEach((el) => {
      el.classList.add("will-reveal");
      const group = el.closest("section") || document.body;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(el);
    });

    groups.forEach((group) => {
      group.forEach((el, index) => {
        el.style.transitionDelay = `${Math.min(index, 5) * 75}ms`;
      });
    });

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-inview");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.04 }
    );

    elements.forEach((el) => observer.observe(el));

    motionQuery.addEventListener?.("change", (event) => {
      prefersReduced = event.matches;
      if (prefersReduced) {
        elements.forEach((el) => el.classList.add("is-inview"));
      }
    });
  };

  /* ------------------------------------------------------------------------
     Custom cursor
     ------------------------------------------------------------------------ */
  const initCursor = () => {
    if (!finePointerQuery.matches) return;
    const cursor = $(".cursor");
    if (!cursor) return;

    const ring = $(".cursor__ring", cursor);
    const dot = $(".cursor__dot", cursor);
    const label = $(".cursor__label", cursor);
    const html = document.documentElement;

    const state = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      ringX: window.innerWidth / 2,
      ringY: window.innerHeight / 2,
      visible: false,
      raf: 0
    };

    const cursorLabels = {
      "pride-blink": "BLINK",
      "greed-acquire": "ACQUIRE",
      "lust-hold": "HOLD",
      "envy-toggle": "LOOK AWAY",
      "feed-form": "FEED",
      "wrath-hold": "HOLD",
      "sloth-button": "DO NOTHING",
      "confession-submit": "BURN",
      "index-open": "INDEX",
      "sound-toggle": "SOUND",
      "wheel-stage": "SELECT",
      "envy-field": "MIRROR"
    };

    const labelFor = (target) => {
      if (!target) return "";
      if (target.closest(".wheel-seg")) return "SELECT";
      if (target.closest(".hero-index__item")) return "OPEN";
      if (target.closest(".index-row")) return "OPEN";
      if (target.closest(".enter-link")) return "ENTER";
      if (target.closest(".chapter-next")) return "NEXT";
      if (target.closest("#envy-field")) return "MIRROR";
      const labelled = target.closest("[data-cursor]");
      if (labelled) return labelled.getAttribute("data-cursor");
      for (const [id, text] of Object.entries(cursorLabels)) {
        if (target.closest(`#${id}`)) return text;
      }
      return "";
    };

    const interactiveFor = (target) =>
      target?.closest?.('a, button, [role="button"], input, textarea, select, .eye-hit, .wheel-seg');

    const render = () => {
      state.raf = 0;
      dot.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${state.ringX}px, ${state.ringY}px, 0) translate(-50%, -50%)`;
      label.style.left = `${state.x + 22}px`;
      label.style.top = `${state.y + 18}px`;
      if (!state.visible) {
        dot.style.opacity = "0";
        ring.style.opacity = "0";
      } else {
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };

    const animate = () => {
      if (prefersReduced) {
        state.ringX = state.x;
        state.ringY = state.y;
        render();
        return;
      }
      state.ringX += (state.x - state.ringX) * 0.18;
      state.ringY += (state.y - state.ringY) * 0.18;
      render();
      if (Math.abs(state.x - state.ringX) + Math.abs(state.y - state.ringY) > 0.1) {
        state.raf = requestAnimationFrame(animate);
      }
    };

    const kick = () => {
      if (!state.raf) state.raf = requestAnimationFrame(animate);
    };

    const setLabel = (text) => {
      if (text) {
        label.textContent = text;
        cursor.classList.add("has-label");
      } else {
        cursor.classList.remove("has-label");
      }
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        state.x = event.clientX;
        state.y = event.clientY;
        if (!state.visible) {
          state.visible = true;
          state.ringX = state.x;
          state.ringY = state.y;
        }
        kick();
      },
      { passive: true }
    );

    document.addEventListener("pointerover", (event) => {
      const target = event.target;
      const interactive = interactiveFor(target);
      const isField = target.closest?.(
        'input:not([type="radio"]):not([type="checkbox"]), textarea, select'
      );
      cursor.classList.toggle("is-hovering", Boolean(interactive));
      cursor.classList.toggle("is-hidden", Boolean(isField));
      setLabel(isField ? "" : labelFor(target));
    });

    document.addEventListener("pointerdown", () => cursor.classList.add("is-pressed"));
    document.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"));
    document.documentElement.addEventListener("mouseleave", () => {
      state.visible = false;
      cursor.classList.add("is-hidden");
      setLabel("");
    });
    document.documentElement.addEventListener("mouseenter", () => {
      cursor.classList.remove("is-hidden");
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        html.classList.add("has-cursor");
      });
    } else {
      html.classList.add("has-cursor");
    }

    motionQuery.addEventListener?.("change", (event) => {
      prefersReduced = event.matches;
      kick();
    });

    window.__vitiumCursor = { root: html, cursor };
  };

  /* ------------------------------------------------------------------------
     Hero wheel + gaze
     ------------------------------------------------------------------------ */
  const initHeroWheel = () => {
    const wheelSegments = $$(".wheel-seg");
    const wheelEye = $("#wheel-eye");
    const wheelStage = $("#wheel-stage");
    const wheelCurrent = $(".wheel-current");
    const wheelNum = $("#wheel-current-num");
    const wheelName = $("#wheel-current-name");
    const wheelCn = $("#wheel-current-cn");
    const heroIndex = $$("[data-hero-sin]");
    const currentDefault = {
      num: "VII",
      name: "THE SEVEN",
      cn: "七"
    };

    if (!wheelEye || !wheelSegments.length) return;

    const setCurrent = (sinId) => {
      const sin = sins[sinId];
      if (!sin) {
        wheelNum.textContent = currentDefault.num;
        wheelName.textContent = currentDefault.name;
        wheelCn.textContent = currentDefault.cn;
        wheelCurrent?.style.removeProperty("--wheel-accent");
        return;
      }
      wheelNum.textContent = sin.roman;
      wheelName.textContent = sin.en.toUpperCase();
      wheelCn.textContent = sin.cn;
      wheelCurrent?.style.setProperty("--wheel-accent", sin.color);
    };

    const highlight = (sinId) => {
      wheelSegments.forEach((seg) => {
        seg.classList.toggle("is-lit", seg.dataset.sin === sinId);
      });
      heroIndex.forEach((item) => {
        item.classList.toggle("is-lit", item.dataset.heroSin === sinId);
      });
      setCurrent(sinId);
    };

    wheelSegments.forEach((segment) => {
      const sinId = segment.dataset.sin;

      segment.addEventListener("pointerenter", () => highlight(sinId));
      segment.addEventListener("focus", () => highlight(sinId));
      segment.addEventListener("pointerleave", () => highlight(null));
      segment.addEventListener("blur", () => highlight(null));

      segment.addEventListener("click", () => scrollToSection(sinId));
      segment.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          scrollToSection(sinId);
        }
      });
    });

    heroIndex.forEach((item) => {
      const sinId = item.dataset.heroSin;
      item.addEventListener("pointerenter", () => highlight(sinId));
      item.addEventListener("focus", () => highlight(sinId));
      item.addEventListener("pointerleave", () => highlight(null));
      item.addEventListener("blur", () => highlight(null));
    });

    let eyeFrame = 0;
    const moveEye = (event) => {
      if (eyeFrame) return;
      eyeFrame = requestAnimationFrame(() => {
        eyeFrame = 0;
        const rect = wheelStage.getBoundingClientRect();
        const px = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const py = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        wheelEye.style.setProperty("--gaze-x", `${clamp(px * 24, -10, 10).toFixed(2)}px`);
        wheelEye.style.setProperty("--gaze-y", `${clamp(py * 24, -7, 7).toFixed(2)}px`);
      });
    };
    wheelStage.addEventListener("pointermove", moveEye, { passive: true });
    wheelStage.addEventListener("pointerleave", () => {
      wheelEye.style.setProperty("--gaze-x", "0px");
      wheelEye.style.setProperty("--gaze-y", "0px");
    });

    let blinkTimer = 0;
    const scheduleBlink = () => {
      window.clearTimeout(blinkTimer);
      if (prefersReduced) return;
      blinkTimer = window.setTimeout(() => {
        if (!document.hidden) {
          wheelEye.classList.add("is-blinking");
          window.setTimeout(() => wheelEye.classList.remove("is-blinking"), 135);
        }
        scheduleBlink();
      }, 6200 + Math.random() * 5200);
    };
    scheduleBlink();

    motionQuery.addEventListener?.("change", (event) => {
      prefersReduced = event.matches;
      if (prefersReduced) window.clearTimeout(blinkTimer);
      else scheduleBlink();
    });
  };

  /* ------------------------------------------------------------------------
     I — Pride: the mirror with a pupil
     ------------------------------------------------------------------------ */
  const initPride = () => {
    const apparatus = $("#pride-apparatus");
    const eye = $(".pride-eye");
    const blinkButton = $("#pride-blink");
    const status = $("#pride-status");
    if (!apparatus || !eye || !blinkButton) return;

    const defaultStatus = status?.textContent || "移动，被注视。点击眼睛，消失一瞬。";
    let statusTimer = 0;
    let blinkTimer = 0;
    let eyeFrame = 0;

    apparatus.addEventListener(
      "pointermove",
      (event) => {
        if (eyeFrame) return;
        eyeFrame = requestAnimationFrame(() => {
          eyeFrame = 0;
          const rect = eye.getBoundingClientRect();
          const nx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
          const ny = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
          eye.style.setProperty("--pride-gaze-x", `${clamp(nx * 34, -14, 14).toFixed(2)}px`);
          eye.style.setProperty("--pride-gaze-y", `${clamp(ny * 24, -8, 8).toFixed(2)}px`);
        });
      },
      { passive: true }
    );

    apparatus.addEventListener("pointerleave", () => {
      eye.style.setProperty("--pride-gaze-x", "0px");
      eye.style.setProperty("--pride-gaze-y", "0px");
    });

    const blink = () => {
      apparatus.classList.add("is-blinking");
      window.clearTimeout(blinkTimer);
      blinkTimer = window.setTimeout(() => apparatus.classList.remove("is-blinking"), 145);
    };

    blinkButton.addEventListener("click", () => {
      blink();
      if (status) {
        status.textContent = "FOR A MOMENT, NO ONE WAS WATCHING. / 有一瞬间，没有人在看。";
        window.clearTimeout(statusTimer);
        statusTimer = window.setTimeout(() => {
          status.textContent = defaultStatus;
        }, 3200);
      }
    });
  };

  /* ------------------------------------------------------------------------
     II — Greed: the acquisition engine
     ------------------------------------------------------------------------ */
  const initGreed = () => {
    const button = $("#greed-acquire");
    const field = $("#greed-field");
    const countOutput = $("#greed-count");
    const message = $("#greed-message");
    if (!button || !field || !countOutput) return;

    const totalCells = 49;
    const cells = [];
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < totalCells; index += 1) {
      const cell = document.createElement("span");
      cell.className = "asset";
      cell.setAttribute("aria-hidden", "true");
      cells.push(cell);
      fragment.appendChild(cell);
    }
    field.appendChild(fragment);

    let count = 0;
    let newCellTimer = 0;

    const messages = {
      1: "One is a start. Starts are expensive.",
      2: "Two is a pair. Now you need a third.",
      3: "The room is filling. The feeling is not.",
      5: "Five. You are getting good at this.",
      7: "Seven. A biblical number. Still not enough.",
      12: "Accumulation has begun to look like progress.",
      21: "The squares are not the point. The next square is.",
      33: "Somewhere, a receipt is being printed.",
      49: "Every square is full. The arithmetic has not stopped."
    };

    const updateMessage = () => {
      if (!message) return;
      if (count > 49) {
        message.textContent = "You have run out of squares. You have not run out of wanting. / 格子用完了，想要没有。";
        return;
      }
      message.textContent = messages[count] || "A modest beginning.";
    };

    const claim = () => {
      count += 1;
      if (countOutput) countOutput.textContent = String(count).padStart(7, "0");

      if (count <= totalCells) {
        const cell = cells[count - 1];
        if (cell) {
          cell.classList.add("is-claimed", "is-new");
          window.clearTimeout(newCellTimer);
          newCellTimer = window.setTimeout(() => cell.classList.remove("is-new"), 420);
        }
      } else {
        cells[cells.length - 1]?.classList.add("is-new");
        window.clearTimeout(newCellTimer);
        newCellTimer = window.setTimeout(() => {
          cells[cells.length - 1]?.classList.remove("is-new");
        }, 420);
      }
      updateMessage();
    };

    button.addEventListener("click", claim);
  };

  /* ------------------------------------------------------------------------
     III — Lust: hold to come closer
     ------------------------------------------------------------------------ */
  const initLust = () => {
    const apparatus = $("#lust-apparatus");
    const button = $("#lust-hold");
    const status = $("#lust-status");
    if (!apparatus || !button) return;

    const defaultStatus = status?.textContent || "欲望不是判决。它是温度。";
    let holding = false;
    let progress = 0;
    let raf = 0;
    let startedAt = 0;
    let resetTimer = 0;
    const duration = 2600;

    const setProgress = (value) => {
      progress = value;
      button.style.setProperty("--hold-progress", value.toFixed(3));
    };

    const defaultText = "HOLD / 靠近";
    const holdingText = "HOLDING / 靠近中";
    let keyStartedAt = 0;

    const start = (event) => {
      if (event) event.preventDefault();
      if (holding) return;
      holding = true;
      startedAt = performance.now();
      resetTimer && window.clearTimeout(resetTimer);
      apparatus.classList.add("is-close");
      button.classList.add("is-holding");
      button.querySelector(".hold-button__label").textContent = holdingText;
      if (status) status.textContent = "Stay a little longer. / 再停留一会儿。";
      const tick = (now) => {
        if (!holding) return;
        const next = clamp((now - startedAt) / duration, 0, 1);
        setProgress(next);
        if (next >= 1) {
          if (status) status.textContent = "You are allowed to want. / 你可以渴望。";
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    const end = () => {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(raf);
      const completed = progress >= 1;
      apparatus.classList.remove("is-close");
      button.classList.remove("is-holding");
      button.querySelector(".hold-button__label").textContent = defaultText;
      setProgress(0);
      if (status) {
        status.textContent = completed
          ? "Remember where you are. / 记得你在哪里。"
          : defaultStatus;
      }
      resetTimer = window.setTimeout(() => {
        if (status) status.textContent = defaultStatus;
      }, 2600);
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      try {
        button.setPointerCapture(event.pointerId);
      } catch (_) {
        /* pointer capture is a nicety, not a requirement */
      }
      start(event);
    });
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", end);
    button.addEventListener("contextmenu", (event) => event.preventDefault());

    // Assistive technology and Enter/Space activation may arrive as a click
    // without a press-and-hold gesture. Give those visitors the same moment.
    button.addEventListener("click", (event) => {
      if (event.detail !== 0 || holding) return;
      start();
      window.setTimeout(end, 3200);
    });

    button.addEventListener("keydown", (event) => {
      if ((event.key === " " || event.key === "Enter" || event.key === "Spacebar") && !event.repeat) {
        keyStartedAt = performance.now();
        start(event);
      }
    });
    button.addEventListener("keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter" && event.key !== "Spacebar") return;
      const tapped = performance.now() - keyStartedAt < 700;
      end();
      // Keyboard users can hold the key for the full gesture, or tap once
      // for an equivalent moment of closeness.
      if (tapped) {
        start();
        window.setTimeout(end, 3200);
      }
    });
    button.addEventListener("blur", end);
  };

  /* ------------------------------------------------------------------------
     IV — Envy: the relative mirror
     ------------------------------------------------------------------------ */
  const initEnvy = () => {
    const field = $("#envy-field");
    const selfDot = $("#envy-self");
    const otherDot = $("#envy-other");
    const toggle = $("#envy-toggle");
    const status = $("#envy-status");
    const blackout = $(".envy-blackout", field || document);
    if (!field || !toggle) return;

    const defaultStatus = status?.textContent || "移动。看自己如何变成一种比较。";
    const setDot = (dot, x, y) => {
      if (!dot) return;
      dot.style.setProperty("--dot-x", `${x.toFixed(2)}%`);
      dot.style.setProperty("--dot-y", `${y.toFixed(2)}%`);
    };

    const resetDots = () => {
      setDot(selfDot, 23, 26);
      setDot(otherDot, 77, 74);
    };
    resetDots();

    let frame = 0;
    field.addEventListener(
      "pointermove",
      (event) => {
        if (field.classList.contains("is-averted")) return;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = field.getBoundingClientRect();
          const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
          const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 6, 94);
          setDot(selfDot, x, y);
          setDot(otherDot, 100 - x, y);
        });
      },
      { passive: true }
    );
    field.addEventListener("pointerleave", resetDots);

    if (blackout) blackout.setAttribute("aria-hidden", "true");

    toggle.addEventListener("click", () => {
      const averted = field.classList.toggle("is-averted");
      toggle.setAttribute("aria-pressed", String(averted));
      if (toggle.firstChild) {
        toggle.firstChild.nodeValue = averted ? "LOOK AGAIN / 重新注视 " : "LOOK AWAY / 移开目光 ";
      }
      if (blackout) blackout.setAttribute("aria-hidden", String(!averted));
      if (status) {
        status.textContent = averted
          ? "You may look away. / 你可以移开目光。"
          : defaultStatus;
      }
      if (averted) {
        field.style.setProperty("--dot-x", "50%");
      } else {
        resetDots();
      }
    });
  };

  /* ------------------------------------------------------------------------
     V — Gluttony: the intake
     ------------------------------------------------------------------------ */
  const initGluttony = () => {
    const form = $("#feed-form");
    const input = $("#feed-input");
    const status = $("#feed-status");
    const countOutput = $("#mouth-count");
    const tokenLayer = $("#mouth-tokens");
    const stage = $(".mouth-stage");
    if (!form || !input || !status || !tokenLayer) return;

    let count = 0;
    let biteTimer = 0;

    const messages = {
      1: "Swallowed. Still hungry? / 吞下了。还饿吗？",
      3: "The mouth does not remember what it ate. / 嘴不记得自己吃过什么。",
      7: "There is always room for one more. / 总还有空间再吃一口。",
      12: "You are feeding a hole, not a hunger. / 你喂的是洞，不是饥饿。",
      20: "The mouth stays open. / 嘴还张着。"
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim().replace(/\s+/g, " ");

      if (!value) {
        status.textContent = "The mouth needs something. / 总得喂点什么。";
        status.classList.add("is-error");
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }

      input.removeAttribute("aria-invalid");
      status.classList.remove("is-error");
      count += 1;
      if (countOutput) countOutput.textContent = String(count).padStart(2, "0");

      const token = document.createElement("span");
      token.className = "bite-token";
      token.textContent = value;
      token.style.setProperty("--bite-x", `${18 + Math.random() * 64}%`);
      token.style.setProperty("--bite-rotate", `${(Math.random() * 9 - 4.5).toFixed(1)}deg`);
      token.style.setProperty("--bite-delay", `${Math.round(Math.random() * 100)}ms`);
      tokenLayer.appendChild(token);
      window.setTimeout(() => token.remove(), 1550);

      if (stage) {
        stage.classList.add("is-biting");
        window.clearTimeout(biteTimer);
        biteTimer = window.setTimeout(() => stage.classList.remove("is-biting"), 450);
      }

      status.textContent = messages[count] || "The mouth stays open. / 嘴还张着。";
      input.value = "";
      input.focus();
    });

    input.addEventListener("input", () => {
      if (!input.getAttribute("aria-invalid")) return;
      input.removeAttribute("aria-invalid");
      status.classList.remove("is-error");
    });
  };

  /* ------------------------------------------------------------------------
     VI — Wrath: the pressure valve
     ------------------------------------------------------------------------ */
  const initWrath = () => {
    const apparatus = $("#wrath-apparatus");
    const button = $("#wrath-hold");
    const reset = $("#wrath-reset");
    const status = $("#wrath-status");
    const hint = $("#wrath-hint");
    const meter = $("#pressure-meter");
    const buttonLabel = button?.querySelector(".hold-button__label");
    if (!apparatus || !button || !meter) return;

    const defaultStatus = "按住。试着撑住，直到撑不住。";
    const defaultHint = "Press and hold. Keep it together until you can't.";
    const defaultStart = "Keep it together. / 撑住。";
    let holding = false;
    let broken = false;
    let progress = 0;
    let startedAt = 0;
    let keyStartedAt = 0;
    let frame = 0;
    const duration = 2800;

    const setPressure = (value) => {
      progress = clamp(value, 0, 1);
      apparatus.style.setProperty("--pressure", progress.toFixed(3));
      button.style.setProperty("--hold-progress", progress.toFixed(3));
      meter.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    };

    const finish = () => {
      holding = false;
      broken = true;
      cancelAnimationFrame(frame);
      setPressure(1);
      apparatus.classList.remove("is-holding");
      apparatus.classList.add("is-broken");
      if (buttonLabel) buttonLabel.textContent = "RELEASED / 已松开";
      button.hidden = true;
      if (reset) {
        reset.hidden = false;
        reset.focus({ preventScroll: true });
      }
      if (hint) hint.textContent = "The valve is open. You can stop holding now.";
      if (status) status.textContent = "The pressure has somewhere to go now. / 压力终于有了去处。";
    };

    const tick = (now) => {
      if (!holding) return;
      const next = clamp((now - startedAt) / duration, 0, 1);
      setPressure(next);
      if (next >= 1) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = (event) => {
      if (event) event.preventDefault();
      if (holding || broken) return;
      holding = true;
      startedAt = performance.now();
      apparatus.classList.add("is-holding");
      setPressure(0);
      if (hint) hint.textContent = defaultHint;
      if (status) status.textContent = defaultStart;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(frame);
      apparatus.classList.remove("is-holding");
      setPressure(0);
      if (buttonLabel) buttonLabel.textContent = "HOLD / 撑住";
      if (status) status.textContent = "The pressure goes back inside. / 压力又回到了身体里。";
      window.setTimeout(() => {
        if (!broken && status) status.textContent = defaultStatus;
      }, 2200);
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      try {
        button.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
      start(event);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    button.addEventListener("contextmenu", (event) => event.preventDefault());

    // A non-pointer activation (keyboard, switch, screen reader) cannot hold.
    // Let a single activation complete the release instead.
    button.addEventListener("click", (event) => {
      if (event.detail !== 0 || broken || holding) return;
      setPressure(1);
      finish();
    });

    button.addEventListener("keydown", (event) => {
      if ((event.key === " " || event.key === "Enter" || event.key === "Spacebar") && !event.repeat) {
        keyStartedAt = performance.now();
        start(event);
      }
    });
    button.addEventListener("keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter" && event.key !== "Spacebar") return;
      const tapped = performance.now() - keyStartedAt < 700;
      stop();
      if (tapped && !broken) {
        setPressure(1);
        finish();
      }
    });
    button.addEventListener("blur", stop);

    const resetValve = () => {
      broken = false;
      holding = false;
      cancelAnimationFrame(frame);
      apparatus.classList.remove("is-broken", "is-holding");
      setPressure(0);
      if (buttonLabel) {
        buttonLabel.textContent = "HOLD / 撑住";
        button.disabled = false;
      }
      button.hidden = false;
      if (reset) reset.hidden = true;
      if (hint) hint.textContent = defaultHint;
      if (status) status.textContent = defaultStatus;
      button.focus({ preventScroll: true });
    };

    reset?.addEventListener("click", resetValve);
  };

  /* ------------------------------------------------------------------------
     VII — Sloth: the stillness clock
     ------------------------------------------------------------------------ */
  const initSloth = () => {
    const apparatus = $("#sloth-apparatus");
    const button = $("#sloth-button");
    const timeOutput = $("#sloth-time");
    const note = $("#sloth-note");
    if (!apparatus || !button || !timeOutput) return;

    const labelMain = button.children[0];
    const defaultNote = note?.textContent || "Nothing is being measured except time you are allowed to have.";
    let running = false;
    let elapsed = 0;
    let startedAt = 0;
    let ticker = 0;
    let lastThreshold = -1;

    const format = (totalSeconds) => {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const thresholdNote = (seconds) => {
      if (seconds >= 180) return "Three minutes. You are still allowed to exist. / 三分钟。你仍然被允许存在。";
      if (seconds >= 60) return "One minute unoptimized. / 一分钟，没有被优化。";
      if (seconds >= 30) return "Thirty seconds of nothing. Still nothing. / 三十秒的无用。仍然无事发生。";
      if (seconds >= 7) return "Seven seconds. The world has not ended. / 七秒。世界没有结束。";
      return defaultNote;
    };

    const render = () => {
      timeOutput.textContent = format(elapsed);
      const threshold = elapsed >= 180 ? 180 : elapsed >= 60 ? 60 : elapsed >= 30 ? 30 : elapsed >= 7 ? 7 : 0;
      if (threshold !== lastThreshold) {
        lastThreshold = threshold;
        if (note) note.textContent = thresholdNote(elapsed);
      }
    };

    const tick = () => {
      if (!running) return;
      elapsed = Math.floor((Date.now() - startedAt) / 1000);
      render();
      ticker = window.setTimeout(tick, 450);
    };

    button.addEventListener("click", () => {
      running = !running;
      if (running) {
        startedAt = Date.now() - elapsed * 1000;
        apparatus.classList.add("is-still");
        button.setAttribute("aria-pressed", "true");
        if (labelMain) labelMain.textContent = "STOP DOING NOTHING";
        if (note) note.textContent = defaultNote;
        lastThreshold = -1;
        tick();
      } else {
        running = false;
        window.clearTimeout(ticker);
        apparatus.classList.remove("is-still");
        button.setAttribute("aria-pressed", "false");
        if (labelMain) labelMain.textContent = "CONTINUE DOING NOTHING";
        if (note) note.textContent = "You stopped doing nothing. The clock has kept the time. / 你停止什么都不做了。时钟替你记住了时间。";
      }
    });
  };

  /* ------------------------------------------------------------------------
     VIII — The confessional
     ------------------------------------------------------------------------ */
  const initConfession = () => {
    const form = $("#confession-form");
    const wrap = $("#confession-form-wrap");
    const penance = $("#penance");
    const penanceSin = $("#penance-sin");
    const penanceText = $("#penance-text");
    const penanceCn = $("#penance-cn");
    const textarea = $("#confession-text");
    const countOutput = $("#confession-count");
    const error = $("#confession-error");
    const submit = $("#confession-submit");
    const again = $("#confession-again");
    const card = $("#confession-card");
    if (!form || !wrap || !penance || !textarea) return;

    const penances = {
      pride: [
        {
          text: "Ask a question you do not already know the answer to. Then listen.",
          cn: "问一个你并不知道答案的问题，然后认真听完。"
        },
        {
          text: "Let one person be right in front of you.",
          cn: "让一个人在你面前是对的，不必纠正。"
        }
      ],
      greed: [
        {
          text: "Leave one square of your day unclaimed.",
          cn: "留出一天中的一格，不去占有。"
        },
        {
          text: "Give away something you were saving for later.",
          cn: "把一件你留到以后的东西，送出去。"
        }
      ],
      lust: [
        {
          text: "Notice what you want without turning it into a possession.",
          cn: "看清你的渴望，而不必把它占为己有。"
        },
        {
          text: "Let one desire remain unanswered tonight.",
          cn: "今晚，允许一个渴望没有回应。"
        }
      ],
      envy: [
        {
          text: "Name one thing you have that you would miss.",
          cn: "说出一件你已经拥有、失去会心疼的东西。"
        },
        {
          text: "Close the window. Look at your own room.",
          cn: "关掉那个窗口，看看自己的房间。"
        }
      ],
      gluttony: [
        {
          text: "Leave one thing unfinished today.",
          cn: "今天留一件事，不做完。"
        },
        {
          text: "Eat one meal without a screen.",
          cn: "吃一顿没有屏幕的饭。"
        }
      ],
      wrath: [
        {
          text: "Before you answer, wait ten seconds. Then speak.",
          cn: "回答之前，等十秒。然后再说。"
        },
        {
          text: "Put the heat down somewhere it cannot burn anyone.",
          cn: "把那股热度放下，放在不会烫伤任何人的地方。"
        }
      ],
      sloth: [
        {
          text: "Do one small thing slowly, and tell no one.",
          cn: "慢慢做一件小事，不必告诉任何人。"
        },
        {
          text: "Stay here for one more minute. That is the whole task.",
          cn: "在这里再待一分钟。任务就是全部。"
        }
      ]
    };

    let submitting = false;
    let burnTimer = 0;

    // Do not let the browser restore an old private sentence after a reload.
    form.reset();
    textarea.value = "";
    if (countOutput) countOutput.textContent = "0";

    const setError = (message) => {
      if (error) error.textContent = message;
      if (message) textarea.setAttribute("aria-invalid", "true");
      else textarea.removeAttribute("aria-invalid");
    };

    const updateCount = () => {
      if (countOutput) countOutput.textContent = String(textarea.value.length);
    };

    textarea.addEventListener("input", () => {
      updateCount();
      if (error?.textContent) setError("");
    });
    $$('input[name="sin"]', form).forEach((radio) => {
      radio.addEventListener("change", () => {
        if (error?.textContent) setError("");
      });
    });

    const showPenance = (sinId, sourceText) => {
      const sin = sins[sinId];
      const options = penances[sinId];
      if (!sin || !options) return;
      const option = options[sourceText.length % options.length] || options[0];

      if (penanceSin) penanceSin.textContent = `${sin.roman} · ${sin.en.toUpperCase()} / ${sin.cn}`;
      if (penanceText) penanceText.textContent = option.text;
      if (penanceCn) penanceCn.textContent = option.cn;

      wrap.hidden = true;
      penance.hidden = false;
      penance.tabIndex = -1;
      penance.focus({ preventScroll: true });

      // The sentence is not echoed, saved or read back. It is simply gone.
      textarea.value = "";
      updateCount();

      submitting = false;
      if (submit) {
        submit.disabled = false;
        const label = submit.querySelector("span");
        if (label) label.textContent = "BURN IT / 烧掉它";
      }
      card?.classList.remove("is-burning");
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submitting) return;

      const checked = form.querySelector('input[name="sin"]:checked');
      const text = textarea.value.trim();

      if (!checked) {
        setError("Choose a hunger first. / 先选择一种饥饿。");
        $$('input[name="sin"]', form)[0]?.focus();
        return;
      }
      if (!text) {
        setError("One true sentence. / 写下一句真话。");
        textarea.focus();
        return;
      }

      setError("");
      submitting = true;
      if (submit) {
        submit.disabled = true;
        const label = submit.querySelector("span");
        if (label) label.textContent = "BURNING… / 烧掉中";
      }
      card?.classList.add("is-burning");

      window.clearTimeout(burnTimer);
      burnTimer = window.setTimeout(() => {
        showPenance(checked.value, text);
      }, prefersReduced ? 120 : 720);
    });

    again?.addEventListener("click", () => {
      penance.hidden = true;
      wrap.hidden = false;
      if (error) error.textContent = "";
      form.reset();
      textarea.value = "";
      updateCount();
      $$('input[name="sin"]', form).forEach((radio) => {
        radio.checked = false;
      });
      if (submit) {
        submit.disabled = false;
        const label = submit.querySelector("span");
        if (label) label.textContent = "BURN IT / 烧掉它";
      }
      card?.classList.remove("is-burning");
      submitting = false;
      $$('input[name="sin"]', form)[0]?.focus();
    });
  };

  /* ------------------------------------------------------------------------
     Index dialog
     ------------------------------------------------------------------------ */
  const initDialog = () => {
    const dialog = $("#index-dialog");
    const openButton = $("#index-open");
    const closeButton = $("#index-close");
    if (!dialog || !openButton) return;

    const restoreCursor = () => {
      if (finePointerQuery.matches) document.documentElement.classList.add("has-cursor");
    };
    const suppressCursor = () => document.documentElement.classList.remove("has-cursor");

    const open = () => {
      if (typeof dialog.showModal === "function") {
        suppressCursor();
        document.body.classList.add("no-scroll");
        dialog.showModal();
        closeButton?.focus({ preventScroll: true });
      } else {
        dialog.setAttribute("open", "");
      }
    };

    const close = () => {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
        document.body.classList.remove("no-scroll");
        openButton.focus({ preventScroll: true });
      }
    };

    openButton.addEventListener("click", open);
    closeButton?.addEventListener("click", close);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });

    dialog.addEventListener("close", () => {
      document.body.classList.remove("no-scroll");
      restoreCursor();
      openButton.focus({ preventScroll: true });
    });

    $$(".index-row", dialog).forEach((row) => {
      row.addEventListener("click", () => {
        // Let the browser follow the anchor; just restore the page frame.
        close();
      });
    });
  };

  /* ------------------------------------------------------------------------
     Synthesized room tone
     ------------------------------------------------------------------------ */
  const audioState = {
    ctx: null,
    master: null,
    filter: null,
    on: false,
    suspendTimer: 0
  };

  const initAudio = () => {
    const buttons = [$("#sound-toggle"), $("#sound-toggle-footer")].filter(Boolean);
    if (!buttons.length) return;

    const updateButtons = () => {
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(audioState.on));
        if (button.id === "sound-toggle") {
          const text = button.querySelector(".sound-toggle__text");
          if (text) text.textContent = audioState.on ? "SOUND ON" : "SOUND OFF";
        } else {
          button.textContent = audioState.on ? "SOUND ON / 关闭环境声" : "SOUND OFF / 环境声";
        }
      });
    };

    const ensureAudio = () => {
      if (audioState.ctx) return true;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 460;
      filter.Q.value = 0.55;
      filter.connect(master);

      const low = ctx.createOscillator();
      low.type = "sine";
      low.frequency.value = 55;
      const lowGain = ctx.createGain();
      lowGain.gain.value = 0.34;
      low.connect(lowGain);
      lowGain.connect(filter);

      const high = ctx.createOscillator();
      high.type = "triangle";
      high.frequency.value = 82.4;
      const highGain = ctx.createGain();
      highGain.gain.value = 0.08;
      high.connect(highGain);
      highGain.connect(filter);

      const breath = ctx.createOscillator();
      breath.type = "sine";
      breath.frequency.value = 0.075;
      const breathGain = ctx.createGain();
      breathGain.gain.value = 0.012;
      breath.connect(breathGain);
      breathGain.connect(master.gain);

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.18;
      }
      const air = ctx.createBufferSource();
      air.buffer = buffer;
      air.loop = true;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = "bandpass";
      airFilter.frequency.value = 680;
      airFilter.Q.value = 0.55;
      const airGain = ctx.createGain();
      airGain.gain.value = 0.035;
      air.connect(airFilter);
      airFilter.connect(airGain);
      airGain.connect(master);

      low.start();
      high.start();
      breath.start();
      air.start();

      audioState.ctx = ctx;
      audioState.master = master;
      audioState.filter = filter;
      return true;
    };

    const toggle = async () => {
      if (!ensureAudio()) return;
      const ctx = audioState.ctx;
      if (!ctx) return;
      window.clearTimeout(audioState.suspendTimer);

      if (!audioState.on) {
        try {
          await ctx.resume();
        } catch (_) {
          /* browser may still require a second gesture */
        }
        const now = ctx.currentTime;
        audioState.master.gain.cancelScheduledValues(now);
        audioState.master.gain.setValueAtTime(Math.max(0.0001, audioState.master.gain.value), now);
        audioState.master.gain.exponentialRampToValueAtTime(0.06, now + 1.1);
        audioState.on = true;
      } else {
        const now = ctx.currentTime;
        audioState.master.gain.cancelScheduledValues(now);
        audioState.master.gain.setValueAtTime(audioState.master.gain.value, now);
        audioState.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        audioState.on = false;
        audioState.suspendTimer = window.setTimeout(() => {
          if (!audioState.on && audioState.ctx?.state === "running") {
            audioState.ctx.suspend().catch(() => {});
          }
        }, 750);
      }
      updateButtons();
    };

    buttons.forEach((button) => button.addEventListener("click", toggle));
    updateButtons();

    document.addEventListener("visibilitychange", () => {
      if (!audioState.ctx) return;
      if (document.hidden && audioState.on) {
        audioState.ctx.suspend().catch(() => {});
      } else if (!document.hidden && audioState.on) {
        audioState.ctx.resume().catch(() => {});
      }
    });
  };

  /* ------------------------------------------------------------------------
     Small finishing touches
     ------------------------------------------------------------------------ */
  const initMisc = () => {
    // The wordmark gets the same cursor treatment as the index button.
    const brand = $(".brand");
    brand?.setAttribute("data-cursor", "HOME");

    // Hide the "saved / witnessing" language from assistive tech until it is
    // actually revealed by the envy toggle.
    const blackout = $(".envy-blackout");
    if (blackout && !blackout.hasAttribute("aria-hidden")) {
      blackout.setAttribute("aria-hidden", "true");
    }

    // If a user follows an in-page anchor, keep keyboard focus in the room.
    $$('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", () => {
        const id = anchor.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        window.setTimeout(() => target.focus({ preventScroll: true }), prefersReduced ? 20 : 500);
      });
    });
  };

  const init = () => {
    initChapters();
    initReveals();
    initCursor();
    initHeroWheel();
    initPride();
    initGreed();
    initLust();
    initEnvy();
    initGluttony();
    initWrath();
    initSloth();
    initConfession();
    initDialog();
    initAudio();
    initMisc();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
