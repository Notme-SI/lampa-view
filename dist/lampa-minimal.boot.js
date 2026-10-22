function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a, u = !0; return { s: function s() { t = t.call(r); }, n: function n() { u = !0; var r = t.next(); return r.done ? { done: !0 } : { value: r.value, done: u = !1 }; }, e: function e(r) { o = !0, a = r; }, f: function f() { try { u || null == t.return || t.return(); } finally { if (o) throw a; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
(function () {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = function __commonJS(cb, mod) {
    return function __require() {
      try {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = {
          exports: {}
        }).exports, mod), mod.exports;
      } catch (e) {
        throw mod = 0, e;
      }
    };
  };
  var __copyProps = function __copyProps(to, from, except, desc) {
    if (from && _typeof(from) === "object" || typeof from === "function") {
      var _iterator = _createForOfIteratorHelper(__getOwnPropNames(from)),
        _step;
      try {
        var _loop = function _loop() {
          var key = _step.value;
          if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
            get: function get() {
              return from[key];
            },
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
        };
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          _loop();
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
    return to;
  };
  var __toESM = function __toESM(mod, isNodeMode, target) {
    return target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
      value: mod,
      enumerable: true
    }) : target, mod);
  };

  // src/favicon.cjs
  var require_favicon = __commonJS({
    "src/favicon.cjs": function src_faviconCjs(exports, module) {
      module.exports = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420"><circle cx="210" cy="210" r="210" fill="#000000"/><circle cx="210" cy="210" r="156" fill="none" stroke="#ffffff" stroke-width="16"/><g transform="translate(0.000000,420.000000) scale(0.100000,-0.100000)"\r\nfill="#ffffff" stroke="none">\r\n\r\n<path d="M1955 3079 c-103 -14 -130 -20 -224 -51 -416 -137 -723 -489 -804\r\n-921 -21 -113 -20 -312 3 -427 20 -100 53 -208 76 -250 l14 -25 -5 25 c-21\r\n101 -26 294 -10 370 3 14 8 41 11 60 51 295 268 592 549 750 98 55 259 109\r\n375 126 67 10 248 11 300 3 25 -4 63 -11 85 -14 51 -9 171 -49 242 -81 123\r\n-57 205 -116 319 -229 170 -169 279 -389 311 -626 13 -100 6 -311 -13 -364 -5\r\n-14 -4 -17 4 -10 6 6 24 51 41 100 97 292 76 633 -56 900 -135 271 -367 486\r\n-643 593 -60 24 -182 57 -245 68 -57 9 -271 12 -330 3z"/>\r\n<path d="M1981 2364 c-148 -40 -262 -128 -330 -255 -145 -268 -20 -605 264\r\n-717 62 -25 112 -33 190 -33 221 1 407 137 478 349 88 261 -49 544 -310 639\r\n-85 31 -214 38 -292 17z"/>\r\n<path d="M1429 2209 c-13 -17 -29 -36 -34 -42 -51 -59 -119 -200 -147 -306\r\n-16 -58 -21 -108 -22 -216 -1 -136 4 -170 39 -280 93 -288 335 -508 640 -582\r\n76 -18 251 -24 335 -11 178 27 349 115 479 248 77 77 86 88 127 155 88 145\r\n124 268 129 435 6 201 -37 353 -144 517 -68 103 -107 144 -74 78 56 -110 81\r\n-228 78 -357 -3 -93 -8 -131 -32 -203 -81 -252 -293 -443 -553 -499 -89 -20\r\n-265 -14 -350 12 -254 76 -442 267 -511 519 -47 171 -21 409 57 531 24 36 10\r\n37 -17 1z"/>\r\n</g></svg>';
    }
  });

  // src/boot.css
  var boot_default = ["html,body {background:#000!important}", ".welcome {background:#000!important;background-image:none!important}", ".welcome:before {content:'LAMPA';position:absolute;top:48%;left:0;right:0;text-align:center;color:#e9edef;font:500 28px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;letter-spacing:.3em;padding-left:.3em}", ".welcome:after {content:'';position:absolute;top:calc(48% + 60px);left:50%;width:100px;height:2px;background:#add9e5;border-radius:2px;transform:translateX(-50%) scaleX(.35);animation:minimal-boot-breathe 2s ease-in-out infinite}", ".lp-step {position:fixed!important;top:calc(48% + 88px)!important;left:20px;right:20px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif!important;letter-spacing:.04em;color:#858d94}", ".lp-status {display:none!important}", ".no-network {z-index:1100!important;background:#080808;color:#e9edef}", "@keyframes minimal-boot-breathe {0%,100%{opacity:.35;transform:translateX(-50%) scaleX(.35)}50%{opacity:1;transform:translateX(-50%) scaleX(1)}}", "@media(prefers-reduced-motion:reduce){.welcome:after{animation:none;opacity:.7;transform:translateX(-50%) scaleX(.65)}}", ""].join("\n");

  // src/branding.js
  var import_favicon = __toESM(require_favicon());
  function branding() {
    document.title = "L A M P A";
    document.documentElement.lang = "ru";
    var icons = Array.from(document.querySelectorAll('link[rel~="icon"]'));
    if (!icons.length) {
      var icon = document.createElement("link");
      icon.rel = "icon";
      (document.head || document.documentElement).appendChild(icon);
      icons.push(icon);
    }
    icons.forEach(function (icon) {
      icon.type = "image/svg+xml";
      icon.setAttribute("sizes", "any");
      icon.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(import_favicon.default);
    });
  }

  // src/boot.js
  branding();
  if (!document.getElementById("lampa-minimal-boot")) {
    var style = document.createElement("style");
    style.id = "lampa-minimal-boot";
    style.textContent = boot_default;
    (document.head || document.documentElement).appendChild(style);
  }
})();