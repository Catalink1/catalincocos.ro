/* cookie-consent.js — banner de consimțământ pentru paginile din afara SPA-ului
   (articol.html, blog.html, texte.html). index.html îl gestionează prin main.js.
   Alegerea (accepted / declined) e reținută în localStorage per domeniu, deci
   dacă ai ales deja pe orice pagină, banner-ul nu mai apare. */
(function () {
  "use strict";

  /* An curent în footer — © <span class="js-year"> */
  var y = String(new Date().getFullYear());
  var yEls = document.querySelectorAll(".js-year");
  for (var i = 0; i < yEls.length; i++) yEls[i].textContent = y;

  /* Curăță parametrii de tracking (fbclid, gclid, utm_*) din bara de adrese */
  var trackingKeys = ["fbclid", "gclid", "gclsrc", "igshid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var params = new URLSearchParams(location.search);
  var paramsChanged = false;
  trackingKeys.forEach(function (k) {
    if (params.has(k)) {
      params.delete(k);
      paramsChanged = true;
    }
  });
  if (paramsChanged) {
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  var KEY = "cookieConsent";

  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (e) {}
  if (stored === "accepted" || stored === "declined") return; // deja a ales

  function persist(val) {
    try {
      localStorage.setItem(KEY, val);
    } catch (e) {}
  }

  function dismiss(banner) {
    banner.classList.add("hidden");
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  }

  function build() {
    if (document.getElementById("cookieBanner")) return;
    var b = document.createElement("div");
    b.className = "cookie-banner";
    b.id = "cookieBanner";
    b.innerHTML =
      '<p>Acest site folosește cookies pentru analiză și o experiență mai bună. ' +
      '<a href="index.html#contact">Detalii</a></p>' +
      '<div class="cookie-btns">' +
      '<button class="cookie-accept" type="button">Accept</button>' +
      '<button class="cookie-decline" type="button">Refuz</button>' +
      "</div>";
    b.querySelector(".cookie-accept").addEventListener("click", function () {
      persist("accepted");
      if (typeof loadGA === "function") loadGA();
      dismiss(b);
    });
    b.querySelector(".cookie-decline").addEventListener("click", function () {
      persist("declined");
      dismiss(b);
    });
    document.body.appendChild(b);
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
