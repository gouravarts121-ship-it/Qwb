/* ==========================================================================
   SAKSHAM — interactions
   Preloader · custom cursor · menu · hero slides · scroll reveals ·
   sticky story sync · draggable product rail · journey tabs · ambient sound
   ========================================================================== */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* 1. Preloader                                                        */
  /* ------------------------------------------------------------------ */
  function runPreloader() {
    const pre = $("#preloader");
    const count = $("#loadCount");
    const bar = $("#loadBar");
    if (!pre) return;

    let n = 0;
    const step = () => {
      n += Math.random() * 9 + 3;
      if (n >= 100) n = 100;
      count.textContent = String(Math.floor(n)).padStart(2, "0");
      bar.style.width = n + "%";
      if (n < 100) {
        setTimeout(step, 90 + Math.random() * 120);
      } else {
        setTimeout(() => {
          pre.classList.add("is-done");
          document.body.classList.remove("is-locked");
          setTimeout(() => pre.classList.add("is-hidden"), 950);
        }, 320);
      }
    };

    document.body.classList.add("is-locked");
    if (reduce) {
      pre.classList.add("is-hidden");
      document.body.classList.remove("is-locked");
      return;
    }
    setTimeout(step, 300);
  }

  /* ------------------------------------------------------------------ */
  /* 2. Custom cursor + magnetic buttons                                 */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    if (window.matchMedia("(hover:none)").matches) return;
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    if (!dot || !ring) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });

    (function loop() {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    const hoverables = "a, button, [data-cursor], .card, .camera__item, .post";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverables)) ring.classList.add("is-hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverables)) ring.classList.remove("is-hover");
    });

    if (reduce) return;

    // magnetic pull on pills / buttons
    $$(".pill, .rail-btn, .menu-toggle").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Header behaviour                                                 */
  /* ------------------------------------------------------------------ */
  function initHeader() {
    const header = $("#header");
    if (!header) return;
    const menu = $("#menu");
    let last = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("is-solid", y > window.innerHeight * 0.6);
      if (y > last && y > 240 && !(menu && menu.classList.contains("is-open"))) {
        header.classList.add("is-hidden");
      } else {
        header.classList.remove("is-hidden");
      }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------ */
  /* 4. Menu                                                             */
  /* ------------------------------------------------------------------ */
  function initMenu() {
    const menu = $("#menu");
    const open = $("#menuOpen");
    const close = $("#menuClose");
    if (!menu || !open) return;

    const setOpen = (state) => {
      menu.classList.toggle("is-open", state);
      menu.setAttribute("aria-hidden", String(!state));
      open.setAttribute("aria-expanded", String(state));
      document.body.classList.toggle("is-locked", state);
    };

    open.addEventListener("click", () => setOpen(true));
    close.addEventListener("click", () => setOpen(false));
    menu.querySelector(".menu__bg").addEventListener("click", () => setOpen(false));
    $$(".menu__link", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5. Hero slides                                                      */
  /* ------------------------------------------------------------------ */
  function initHero() {
    const slides = $$(".hero__slide");
    const titles = $$(".hero__title");
    const chapters = $$(".hero__chapter");
    if (!titles.length) return;

    let i = 0;
    let timer = null;

    const show = (n) => {
      i = (n + titles.length) % titles.length;
      slides.forEach((s, k) => s.classList.toggle("is-active", k === i));
      titles.forEach((t, k) => t.classList.toggle("is-active", k === i));
      chapters.forEach((c, k) => c.classList.toggle("is-active", k === i));
    };

    const start = () => {
      if (reduce) return;
      stop();
      timer = setInterval(() => show(i + 1), 6200);
    };
    const stop = () => { if (timer) clearInterval(timer); };

    chapters.forEach((c, k) =>
      c.addEventListener("click", () => { show(k); start(); })
    );

    show(0);
    start();
    document.addEventListener("visibilitychange", () => {
      document.hidden ? stop() : start();
    });
  }

  /* ------------------------------------------------------------------ */
  /* 6. Scroll reveals                                                   */
  /* ------------------------------------------------------------------ */
  function initReveals() {
    const els = $$("[data-reveal]");
    if (!els.length) return;

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
  }

  /* ------------------------------------------------------------------ */
  /* 7. Sticky story — media follows the article in view                 */
  /* ------------------------------------------------------------------ */
  function initStory() {
    const articles = $$(".story__article");
    const frames = $$(".story__frame");
    const now = $("#storyNow");
    if (!articles.length || !frames.length) return;

    const setActive = (n) => {
      frames.forEach((f, k) => f.classList.toggle("is-active", k === n));
      if (now) now.textContent = String(n + 1).padStart(2, "0");
    };

    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setActive(Number(en.target.dataset.article || 0));
          }
        });
      },
      { threshold: 0.55 }
    );
    articles.forEach((a) => io.observe(a));
  }

  /* ------------------------------------------------------------------ */
  /* 8. Product rail — buttons + drag                                    */
  /* ------------------------------------------------------------------ */
  function initRail() {
    const rail = $("#rail");
    if (!rail) return;
    const prev = $("#railPrev");
    const next = $("#railNext");

    const card = rail.querySelector(".card");
    const step = () => (card ? card.getBoundingClientRect().width + 24 : 320);

    if (prev) prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
    if (next) next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));

    let down = false, startX = 0, startLeft = 0, moved = false;

    rail.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      down = true; moved = false;
      startX = e.clientX; startLeft = rail.scrollLeft;
      rail.classList.add("is-drag");
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      rail.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      rail.classList.remove("is-drag");
    });
    // prevent click-through after a drag
    rail.addEventListener("click", (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  /* ------------------------------------------------------------------ */
  /* 9. Camera captions                                                  */
  /* ------------------------------------------------------------------ */
  function initCamera() {
    const cap = $("#cameraCaption");
    const items = $$(".camera__item");
    if (!cap || !items.length) return;
    items.forEach((it) => {
      it.addEventListener("mouseenter", () => { cap.textContent = it.dataset.caption || ""; });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 10. Journey tabs                                                    */
  /* ------------------------------------------------------------------ */
  function initTabs() {
    const tabs = $$(".journey__tab");
    const panels = $$(".journey__panel");
    if (!tabs.length) return;

    const show = (n) => {
      tabs.forEach((t, k) => {
        t.classList.toggle("is-active", k === n);
        t.setAttribute("aria-selected", String(k === n));
      });
      panels.forEach((p, k) => p.classList.toggle("is-active", k === n));
    };

    tabs.forEach((t, k) => t.addEventListener("click", () => show(k)));
  }

  /* ------------------------------------------------------------------ */
  /* 11. Marquee — duplicate for a seamless loop                         */
  /* ------------------------------------------------------------------ */
  function initMarquee() {
    const track = $("#marqueeTrack");
    if (!track) return;
    track.innerHTML += track.innerHTML;
  }

  /* ------------------------------------------------------------------ */
  /* 12. Ambient sound (generated, no external file)                     */
  /* ------------------------------------------------------------------ */
  function initSound() {
    const btn = $("#soundBtn");
    const state = $("#soundState");
    if (!btn) return;

    let ctx = null, master = null, on = false;

    const build = () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 620;
      filter.Q.value = 0.6;
      filter.connect(master);

      // soft drone: two detuned oscillators
      [110, 164.81, 220].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 2 ? "triangle" : "sine";
        o.frequency.value = f;
        o.detune.value = i * 4;
        const g = ctx.createGain();
        g.gain.value = i === 2 ? 0.06 : 0.14;
        o.connect(g); g.connect(filter);
        o.start();
      });

      // slow tremolo
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(master.gain);
      lfo.start();

      return true;
    };

    const setUI = (v) => {
      on = v;
      btn.classList.toggle("is-on", v);
      btn.setAttribute("aria-pressed", String(v));
      if (state) state.textContent = v ? "On" : "Off";
    };

    btn.addEventListener("click", async () => {
      if (!ctx && !build()) return;
      if (ctx.state === "suspended") await ctx.resume();
      const target = on ? 0 : 0.22;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
      setUI(!on);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 13. Back to top                                                     */
  /* ------------------------------------------------------------------ */
  function initTop() {
    const b = $("#toTop");
    if (!b) return;
    b.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ------------------------------------------------------------------ */
  /* 14. Subtle parallax                                                 */
  /* ------------------------------------------------------------------ */
  function initParallax() {
    if (reduce) return;
    const heroMedia = $(".hero__media");
    const frames = $$(".story__frame");
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      if (heroMedia && y < window.innerHeight * 1.2) {
        heroMedia.style.transform = `translateY(${y * 0.18}px) scale(1.02)`;
      }
      frames.forEach((f) => {
        if (!f.classList.contains("is-active")) return;
        const tex = f.querySelector(".tex");
        if (tex) tex.style.transform = `translateY(${clamp((y - 400) * 0.02, -20, 20)}px) scale(1.04)`;
      });
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* 15. Account label                                                   */
  /* ------------------------------------------------------------------ */
  function initAccount() {
    const labels = $$("[data-account-label]");
    if (!labels.length) return;
    let name = "";
    try {
      const raw = localStorage.getItem("saksham:session") || sessionStorage.getItem("saksham:session");
      const s = raw ? JSON.parse(raw) : null;
      if (s && s.name) name = s.name.split(" ")[0];
    } catch (e) {}
    labels.forEach((el) => { el.textContent = name || "Account"; });
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    runPreloader();
    initCursor();
    initHeader();
    initMenu();
    initHero();
    initReveals();
    initStory();
    initRail();
    initCamera();
    initTabs();
    initMarquee();
    initSound();
    initTop();
    initParallax();
    initAccount();
  });
})();
