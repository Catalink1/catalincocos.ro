/**
 * statistici-lunare.js — export lunar din Search Console + Google Analytics 4
 *
 * Citește datele cu un cont de robot (service account) care are DOAR drept de
 * citire: „Restricționat" în GSC, „Vizualizator" în GA4. Nu modifică nimic.
 *
 * Salvează CSV-uri în notite/date-AAAA-LL/ (folderul notite/ e în .gitignore).
 *
 * Folosire:  node tools/statistici-lunare.js
 * Programat: Windows Task Scheduler, pe 1 ale fiecărei luni (vezi README din tools/).
 *
 * Cheia robotului: C:\Users\Catalink\.secrets\google-statistici.json
 * (în afara proiectului — nu ajunge niciodată în git sau pe site).
 */

const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

/* ── config ── */
const KEY_FILE = process.env.GOOGLE_STATISTICI_KEY ||
  path.join(process.env.USERPROFILE || "", ".secrets", "google-statistici.json");
const GSC_SITE = "sc-domain:catalincocos.ro";
const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID || "553165453"; // ID numeric al proprietății (nu G-BHKM4XF83R)
const ROOT = path.join(__dirname, "..");

/* ── perioade ── */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const end = new Date(today); end.setDate(end.getDate() - 1);            // ieri
const start3m = new Date(end); start3m.setMonth(start3m.getMonth() - 3); // ultimele 3 luni (ca exportul manual)
const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
const OUT = path.join(ROOT, "notite", `date-${today.getFullYear()}-${pad(today.getMonth() + 1)}`);

/* ── utilitare ── */
function toCsv(header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
function save(name, header, rows) {
  fs.writeFileSync(path.join(OUT, name), "\uFEFF" + toCsv(header, rows)); // BOM: Excel citește diacriticele
  console.log(`  ✓ ${name} (${rows.length} rânduri)`);
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`Lipsește cheia robotului: ${KEY_FILE}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`\nExport statistici → ${OUT}\n`);

  const auth = new GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
  });
  const client = await auth.getClient();
  const post = async (url, data) => (await client.request({ url, method: "POST", data })).data;

  /* ── Search Console ── */
  const gscUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  const gsc = async (dimension, type = "web") =>
    (await post(gscUrl, {
      startDate: iso(start3m), endDate: iso(end), dimensions: [dimension], type, rowLimit: 1000,
    })).rows || [];
  const gscRows = (rows) => rows.map((r) => [r.keys[0], r.clicks, r.impressions,
    (r.ctr * 100).toFixed(2) + "%", r.position.toFixed(2)]);
  const H = ["Clicuri", "Afișări", "CTR", "Poziție"];

  console.log(`Search Console (${iso(start3m)} → ${iso(end)}):`);
  for (const [dim, label] of [["query", "Interogări"], ["page", "Pagini"], ["country", "Țări"], ["device", "Dispozitive"], ["date", "Zile"]]) {
    save(`gsc-web-${label.toLowerCase()}.csv`, [label, ...H], gscRows(await gsc(dim)));
  }
  save("gsc-imagini-pagini.csv", ["Pagini", ...H], gscRows(await gsc("page", "image")));
  save("gsc-imagini-interogari.csv", ["Interogări", ...H], gscRows(await gsc("query", "image")));

  /* ── Google Analytics 4 ── */
  if (!/^\d+$/.test(GA_PROPERTY_ID)) {
    console.log("\nGA4 sărit: completează GA_PROPERTY_ID (ID-ul numeric al proprietății).");
  } else {
    const gaUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`;
    const ga = async (dimension, metrics, range) =>
      (await post(gaUrl, {
        dateRanges: [range],
        dimensions: [{ name: dimension }],
        metrics: metrics.map((name) => ({ name })),
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 1000,
      })).rows || [];
    // Timpul activ mediu = userEngagementDuration / sessions — aceeași cifră ca în interfața GA
    // („Durata medie a interacțiunii per sesiune"), nu durata brută a sesiunii.
    const gaRows = (rows) => rows.map((r) => {
      const [sessions, engaged, engagementSec, keyEvents] = r.metricValues.map((m) => Number(m.value));
      return [r.dimensionValues[0].value, sessions, engaged,
        sessions ? (engagementSec / sessions).toFixed(1) : "0", keyEvents];
    });
    const M = ["sessions", "engagedSessions", "userEngagementDuration", "keyEvents"];
    const MH = ["Sesiuni", "Sesiuni cu interacțiune", "Timp activ mediu (s)", "Evenimente importante"];

    for (const [range, tag] of [
      [{ startDate: iso(prevMonthStart), endDate: iso(prevMonthEnd) }, "luna-trecuta"],
      [{ startDate: iso(start3m), endDate: iso(end) }, "3-luni"],
    ]) {
      console.log(`\nGoogle Analytics (${tag}: ${range.startDate} → ${range.endDate}):`);
      save(`ga-${tag}-canale.csv`, ["Canal", ...MH], gaRows(await ga("sessionDefaultChannelGroup", M, range)));
      save(`ga-${tag}-surse.csv`, ["Sursă / mediu", ...MH], gaRows(await ga("sessionSourceMedium", M, range)));
      save(`ga-${tag}-pagini-intrare.csv`, ["Pagina de intrare", ...MH], gaRows(await ga("landingPage", M, range)));
    }
  }

  fs.writeFileSync(path.join(OUT, "_generat.txt"), `Generat: ${new Date().toISOString()}\n`);
  console.log("\nGata.\n");
}

main().catch((err) => {
  const msg = err.response?.data?.error?.message || err.message;
  console.error(`\nEROARE: ${msg}\n`);
  process.exit(1);
});
