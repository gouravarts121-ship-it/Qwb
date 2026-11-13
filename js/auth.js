(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const AK = "saksham:accounts";
  const SK = "saksham:session";
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const tabs = $$(".auth__tab");
  const tabWrap = $(".auth__tabs");
  const paneWrap = $(".auth__panes");
  const success = $("#authSuccess");
  const signinForm = $("#signinForm");
  const signupForm = $("#signupForm");
  const signinError = $("#signinError");
  const signupError = $("#signupError");
  const forgot = $("#forgot");
  const signOut = $("#signOut");

  function readAccounts() {
    try { return JSON.parse(localStorage.getItem(AK) || "{}"); }
    catch (e) { return {}; }
  }
  function writeAccounts(a) {
    try { localStorage.setItem(AK, JSON.stringify(a)); } catch (e) {}
  }
  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SK) || sessionStorage.getItem(SK) || "null");
    } catch (e) { return null; }
  }
  function writeSession(obj, remember) {
    const raw = JSON.stringify(obj);
    try {
      localStorage.removeItem(SK);
      sessionStorage.removeItem(SK);
      (remember ? localStorage : sessionStorage).setItem(SK, raw);
    } catch (e) {}
  }
  function clearSession() {
    try {
      localStorage.removeItem(SK);
      sessionStorage.removeItem(SK);
    } catch (e) {}
  }

  async function hash(text) {
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "fnv:" + (h >>> 0).toString(16);
  }

  function setFieldError(form, name, msg) {
    const input = form.querySelector('[name="' + name + '"]');
    const field = input ? input.closest(".field") : null;
    const err = form.querySelector('[data-err-for="' + name + '"]');
    if (field) field.classList.toggle("is-invalid", !!msg);
    if (err) err.textContent = msg || "";
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function setFormError(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-ok", !!ok);
  }

  function clearForm(form) {
    $$(".field__err", form).forEach((e) => { e.textContent = ""; });
    $$(".field.is-invalid", form).forEach((f) => f.classList.remove("is-invalid"));
    $$("[aria-invalid]", form).forEach((i) => i.setAttribute("aria-invalid", "false"));
  }

  function activate(mode) {
    tabs.forEach((t) => {
      const on = t.dataset.authTab === mode;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    [["signin", $("#paneSignin")], ["signup", $("#paneSignup")]].forEach(([m, pane]) => {
      if (!pane) return;
      const on = m === mode;
      pane.classList.toggle("is-active", on);
      pane.hidden = !on;
    });
  }

  function syncLabel() {
    const s = readSession();
    const label = s && s.name ? s.name.split(" ")[0] : "Account";
    $$("[data-account-label]").forEach((el) => { el.textContent = label; });
  }

  function showSuccess(name) {
    const first = name ? name.trim().split(" ")[0] : "friend";
    $("#authName").textContent = first;
    if (tabWrap) tabWrap.hidden = true;
    if (paneWrap) paneWrap.hidden = true;
    if (success) success.hidden = false;
    syncLabel();
  }

  function showForms() {
    if (tabWrap) tabWrap.hidden = false;
    if (paneWrap) paneWrap.hidden = false;
    if (success) success.hidden = true;
  }

  function strengthScore(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (pw.length >= 12 && s >= 3) s = 4;
    return Math.min(s, 4);
  }

  const STRENGTH_TEXT = [
    "Use 8+ characters with a number and a symbol",
    "Weak — add a few more characters",
    "Fair — mix in capitals or numbers",
    "Good — nearly there",
    "Strong password"
  ];

  function updateStrength(pw) {
    const el = $("#strength");
    const txt = $("#strengthTxt");
    if (!el) return;
    const s = strengthScore(pw);
    el.dataset.level = String(pw ? s : 0);
    if (txt) txt.textContent = pw ? STRENGTH_TEXT[s] : STRENGTH_TEXT[0];
  }

  function busy(form, on, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle("is-busy", on);
    const t = btn.querySelector(".pill__txt");
    if (t && label) t.textContent = label;
  }

  $$("[data-eye]").forEach((eye) => {
    eye.addEventListener("click", () => {
      const wrap = eye.closest(".field__wrap");
      const input = wrap && wrap.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      eye.textContent = show ? "Hide" : "Show";
      eye.setAttribute("aria-pressed", String(show));
      eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      activate(t.dataset.authTab);
      setFormError(signinError, "");
      setFormError(signupError, "");
    });
  });

  $$("[data-auth-go]").forEach((b) => {
    b.addEventListener("click", () => {
      activate(b.dataset.authGo);
      setFormError(signinError, "");
      setFormError(signupError, "");
    });
  });

  const suPass = $("#su-pass");
  if (suPass) {
    suPass.addEventListener("input", () => updateStrength(suPass.value));
  }

  if (forgot) {
    forgot.addEventListener("click", () => {
      const email = ($("#si-email").value || "").trim();
      const msg = EMAIL.test(email)
        ? "If an account exists for " + email + ", a reset link is on its way."
        : "Enter your email above and we'll send you a reset link.";
      setFormError(signinError, msg, true);
    });
  }

  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearForm(signinForm);
      setFormError(signinError, "");

      const email = $("#si-email").value.trim();
      const pass = $("#si-pass").value;
      const remember = $("#si-remember").checked;
      let ok = true;

      if (!EMAIL.test(email)) {
        setFieldError(signinForm, "email", "Enter a valid email address.");
        ok = false;
      }
      if (!pass) {
        setFieldError(signinForm, "password", "Enter your password.");
        ok = false;
      }
      if (!ok) return;

      const accounts = readAccounts();
      const key = email.toLowerCase();
      const account = accounts[key];

      if (!account) {
        setFormError(signinError, "We couldn't find an account with that email. Create one below.");
        return;
      }

      busy(signinForm, true, "Signing in…");
      const h = await hash(pass);
      if (h !== account.hash) {
        busy(signinForm, false, "Sign in");
        setFieldError(signinForm, "password", "That password doesn't match. Try again.");
        return;
      }

      writeSession({ email: key, name: account.name }, remember);
      busy(signinForm, false, "Sign in");
      showSuccess(account.name);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearForm(signupForm);
      setFormError(signupError, "");

      const name = $("#su-name").value.trim();
      const email = $("#su-email").value.trim();
      const pass = $("#su-pass").value;
      const confirm = $("#su-confirm").value;
      const terms = $("#su-terms").checked;
      let ok = true;

      if (name.length < 2) {
        setFieldError(signupForm, "name", "Please tell us your name.");
        ok = false;
      }
      if (!EMAIL.test(email)) {
        setFieldError(signupForm, "email", "Enter a valid email address.");
        ok = false;
      }
      if (pass.length < 8) {
        setFieldError(signupForm, "password", "Use at least 8 characters.");
        ok = false;
      }
      if (confirm !== pass) {
        setFieldError(signupForm, "confirm", "The passwords don't match.");
        ok = false;
      }
      if (!terms) {
        setFieldError(signupForm, "terms", "Please accept the terms to continue.");
        ok = false;
      }
      if (!ok) return;

      const accounts = readAccounts();
      const key = email.toLowerCase();

      if (accounts[key]) {
        activate("signin");
        $("#si-email").value = email;
        setFormError(signinError, "An account with this email already exists. Sign in instead.");
        return;
      }

      busy(signupForm, true, "Creating…");
      const h = await hash(pass);
      accounts[key] = { name: name, hash: h, created: Date.now() };
      writeAccounts(accounts);
      writeSession({ email: key, name: name }, true);
      busy(signupForm, false, "Create account");
      showSuccess(name);
    });
  }

  if (signOut) {
    signOut.addEventListener("click", () => {
      clearSession();
      showForms();
      activate("signin");
      if (signinForm) signinForm.reset();
      if (signupForm) { signupForm.reset(); updateStrength(""); }
      setFormError(signinError, "You're signed out.", true);
      syncLabel();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const session = readSession();
    if (session && session.name) {
      showSuccess(session.name);
    } else {
      showForms();
      activate("signin");
    }
    updateStrength("");
    syncLabel();
  });
})();
