/*
 * Speusis i18n engine  (loaded as a classic script BEFORE app.js)
 * ---------------------------------------------------------------
 * Lightweight, dependency-free string lookup + language switching.
 *
 * Exposes:
 *   window.t(key, fallbackText)      -> translated string (or English, or key)
 *   window.i18n.setLanguage(code)    -> load + apply a language, persist choice
 *   window.i18n.getLanguage()        -> active code
 *   window.i18n.applyTranslations(root)
 *   window.i18n.isRTL(code)
 *   window.i18n.SUPPORTED            -> { code: { rtl } }
 *   window.i18n.ready                -> Promise that resolves once English is loaded
 *
 * Phase 1 note: on load this only fetches the English table into memory so
 * t() works. It does NOT touch the DOM, so the app renders exactly as before
 * until Phase 2 wires elements up with data-i18n attributes.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "speusis_lang";
  var DEFAULT_LANG = "en";

  // The final supported set: English + 18 languages.
  // rtl:true drives right-to-left layout (Arabic).
  var SUPPORTED = {
    "en":    { rtl: false },
    "ar":    { rtl: true  },
    "zh-CN": { rtl: false },
    "da":    { rtl: false },
    "nl":    { rtl: false },
    "fr":    { rtl: false },
    "de":    { rtl: false },
    "id":    { rtl: false },
    "it":    { rtl: false },
    "ja":    { rtl: false },
    "ko":    { rtl: false },
    "pl":    { rtl: false },
    "pt-BR": { rtl: false },
    "pt-PT": { rtl: false },
    "ro":    { rtl: false },
    "ru":    { rtl: false },
    "es":    { rtl: false },
    "sv":    { rtl: false },
    "tr":    { rtl: false }
  };

  var fallbackDict = {};   // English — always available, used when a key is missing
  var activeDict = {};     // currently selected language's strings
  var current = DEFAULT_LANG;

  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function t(key, fallbackText) {
    if (key == null) return "";
    if (has(activeDict, key) && activeDict[key] !== "") return activeDict[key];
    if (has(fallbackDict, key) && fallbackDict[key] !== "") return fallbackDict[key];
    return (fallbackText !== undefined) ? fallbackText : key;
  }

  // Reverse index: English text -> key. Lets dynamically-built UI strings that
  // are hard-coded in English be translated by value via tt("Some text").
  var reverseExact = {}, reverseLoose = {};
  var squish = function (s) { return String(s).replace(/\s+/g, " ").trim(); };
  function buildReverse(dict) {
    reverseExact = {}; reverseLoose = {};
    for (var k in dict) {
      if (!has(dict, k) || typeof dict[k] !== "string") continue;
      var ex = dict[k].trim();
      if (!(ex in reverseExact)) reverseExact[ex] = k;
      var lo = squish(dict[k]);
      if (!(lo in reverseLoose)) reverseLoose[lo] = k;
    }
  }
  function tText(englishText, fallbackText) {
    if (englishText == null) return "";
    var ex = String(englishText).trim();
    var key = has(reverseExact, ex) ? reverseExact[ex]
            : (has(reverseLoose, squish(ex)) ? reverseLoose[squish(ex)] : null);
    if (key) { var r = t(key); if (r != null && r !== "") return r; }
    return (fallbackText !== undefined) ? fallbackText : englishText;
  }

  function isRTL(code) { return !!(SUPPORTED[code] && SUPPORTED[code].rtl); }

  function normalize(code) { return has(SUPPORTED, code) ? code : DEFAULT_LANG; }

  // Fetch a language table. Tries the on-disk/resource copy first (Phase 4),
  // then the embedded renderer copy, so a missing/edited disk file can never
  // leave the UI blank.
  function loadDict(code) {
    var urls = ["./languages/" + code + ".json"];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) return Promise.reject(new Error("no source for " + code));
      var url = urls[i++];
      return fetch(url, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
        return res.json();
      }).catch(function (err) {
        if (i < urls.length) return tryNext();
        throw err;
      });
    }
    return tryNext();
  }

  // Apply the active dictionary to the DOM. Safe to call anytime; only touches
  // elements that opt in via data-i18n* attributes (none exist until Phase 2).
  function applyTranslations(root) {
    root = root || document;
    if (!root.querySelectorAll) return;

    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v != null) el.textContent = v;
    });
    var attrMap = {
      "data-i18n-placeholder": "placeholder",
      "data-i18n-title": "title",
      "data-i18n-aria-label": "aria-label",
      "data-i18n-value": "value"
    };
    Object.keys(attrMap).forEach(function (dataAttr) {
      var target = attrMap[dataAttr];
      root.querySelectorAll("[" + dataAttr + "]").forEach(function (el) {
        var v = t(el.getAttribute(dataAttr));
        if (v != null) el.setAttribute(target, v);
      });
    });
  }

  function applyDirection(code) {
    var rtl = isRTL(code);
    var html = document.documentElement;
    if (html) {
      html.setAttribute("dir", rtl ? "rtl" : "ltr");
      html.setAttribute("lang", code);
    }
    if (document.body) document.body.classList.toggle("rtl", rtl);
  }

  function setLanguage(code) {
    code = normalize(code);
    var applyLoaded = function (dict) {
      activeDict = dict || {};
      current = code;
      try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
      applyDirection(code);
      applyTranslations(document);
      try {
        document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: code } }));
      } catch (e) {}
      return code;
    };
    if (code === DEFAULT_LANG) return Promise.resolve(applyLoaded(fallbackDict));
    return loadDict(code).then(applyLoaded).catch(function (err) {
      console.warn("[i18n] could not load '" + code + "', staying on English:", err);
      return applyLoaded(fallbackDict) && DEFAULT_LANG;
    });
  }

  function getLanguage() { return current; }

  function storedLanguage() {
    try { return normalize(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG); }
    catch (e) { return DEFAULT_LANG; }
  }

  // Preload English so t() works immediately. Does NOT apply to the DOM here
  // (Phase 1 keeps rendering untouched); Phase 2 will call setLanguage() once
  // the app has booted.
  var ready = loadDict(DEFAULT_LANG).then(function (dict) {
    fallbackDict = dict || {};
    activeDict = fallbackDict;
    buildReverse(fallbackDict);
    return true;
  }).catch(function (err) {
    console.warn("[i18n] English table failed to load:", err);
    fallbackDict = {};
    activeDict = {};
    buildReverse(fallbackDict);
    return false;
  });

  window.i18n = {
    t: t,
    tText: tText,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    storedLanguage: storedLanguage,
    applyTranslations: applyTranslations,
    isRTL: isRTL,
    SUPPORTED: SUPPORTED,
    DEFAULT_LANG: DEFAULT_LANG,
    ready: ready
  };
  window.t = t;
  window.tt = tText;
})();
