/**
 * deploy.js — catalincocos.ro FTP deploy
 *
 * Uploads the site to the hosting account over FTP (explicit FTPS by default),
 * using `curl`. Only files that changed since the last deploy are sent — a local
 * SHA-1 manifest (.deploy-manifest.json, git-ignored) tracks what is on the server.
 *
 * Setup:
 *   1. Copy .ftp.sample.json → .ftp.json and fill in the credentials
 *      (the FTP account you created in cPanel, scoped to public_html).
 *   2. node deploy.js
 *
 * Usage:
 *   node deploy.js              upload changed files only
 *   node deploy.js --all        re-upload every file (ignore the manifest)
 *   node deploy.js --dry-run    show what would be sent, upload nothing
 *
 * Config keys (.ftp.json, or the same names as env vars in UPPER_CASE):
 *   host        ftp host, e.g. "ftp.catalincocos.ro"
 *   user        full ftp username, e.g. "deploy@catalincocos.ro"
 *   password    the ftp account password
 *   remoteDir   sub-path under the ftp root (default ""). Leave empty when the
 *               ftp account's home IS public_html.
 *   secure      true → explicit FTPS (AUTH TLS). Default true.
 *   insecure    true → accept an unverified TLS cert (curl -k). Default false.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, ".deploy-manifest.json");
const CONFIG_FILE = path.join(ROOT, ".ftp.json");

/* ── flags ── */
const args = process.argv.slice(2);
const UPLOAD_ALL = args.includes("--all");
const DRY_RUN = args.includes("--dry-run");

/* ── files never uploaded (dev-only / server-managed) ── */
const DENY = [
  ".gitignore",
  ".ftp.json",
  ".ftp.sample.json",
  ".deploy-manifest.json",
  "deploy.js",
  "build.js",
  "compress.js",
  "archive-urls.js",
  "package.json",
  "package-lock.json",
  "Todo.json",
  "Lumina.jpg",
  "admin/config.php",       // lives only on the server, holds real secrets
  "admin/config.sample.php",
  "admin/TEMPLATE-articol.md", // working template for drafts, not part of the site
];
const DENY_PREFIX = [".claude/", ".vscode/", "node_modules/", "articole/", "tools/"]; // articole/ = drafts, published via admin import; tools/ = local scripts

/* ── config ── */
function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  }
  const env = process.env;
  const get = (k, d) =>
    env[k.toUpperCase()] !== undefined ? env[k.toUpperCase()] : cfg[k] !== undefined ? cfg[k] : d;

  const c = {
    host: get("host", ""),
    user: get("user", ""),
    password: get("password", ""),
    remoteDir: String(get("remoteDir", "")).replace(/^\/+|\/+$/g, ""),
    secure: String(get("secure", "true")) !== "false",
    insecure: String(get("insecure", "false")) === "true",
  };
  if (!c.host || !c.user || !c.password) {
    console.error(
      "Missing FTP credentials. Create .ftp.json (see .ftp.sample.json) " +
        "or set HOST / USER / PASSWORD env vars."
    );
    process.exit(1);
  }
  return c;
}

/* ── file list: git-tracked files minus the denylist ── */
function fileList() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT }).toString("utf8");
  return out
    .split("\0")
    .filter(Boolean)
    .filter((f) => !DENY.includes(f))
    .filter((f) => !DENY_PREFIX.some((p) => f.startsWith(p)))
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .sort();
}

function sha1(file) {
  return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

function loadManifest() {
  if (UPLOAD_ALL || !fs.existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

function remoteUrl(cfg, rel) {
  const scheme = "ftp://"; // explicit FTPS is negotiated via --ssl-reqd, scheme stays ftp://
  const dir = cfg.remoteDir ? cfg.remoteDir + "/" : "";
  return scheme + cfg.host + "/" + dir + rel;
}

function upload(cfg, rel) {
  const local = path.join(ROOT, rel);
  const curlArgs = [
    "-sS",
    "--fail",
    "--ftp-create-dirs",
    "-T",
    local,
    remoteUrl(cfg, rel.split(path.sep).join("/")),
    "--user",
    cfg.user + ":" + cfg.password,
  ];
  if (cfg.secure) curlArgs.push("--ssl-reqd");
  if (cfg.insecure) curlArgs.push("-k");
  execFileSync("curl", curlArgs, { stdio: ["ignore", "ignore", "pipe"] });
}

/* ── run ── */
const cfg = loadConfig();
const files = fileList();
const manifest = loadManifest();

const changed = [];
for (const f of files) {
  const hash = sha1(path.join(ROOT, f));
  if (manifest[f] !== hash) changed.push({ f, hash });
}

const stale = Object.keys(manifest).filter((f) => !files.includes(f));

console.log(
  `${files.length} files tracked · ${changed.length} to upload · ${files.length - changed.length} unchanged`
);
if (DRY_RUN) {
  changed.forEach((c) => console.log("  send  " + c.f));
  if (stale.length) {
    console.log("\nOn server but no longer in the site (delete by hand in File Manager):");
    stale.forEach((f) => console.log("  stale " + f));
  }
  process.exit(0);
}
if (changed.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

console.log(`Deploying to ${cfg.host}${cfg.remoteDir ? "/" + cfg.remoteDir : ""} ...`);
let done = 0;
for (const { f, hash } of changed) {
  try {
    upload(cfg, f);
    manifest[f] = hash;
    done++;
    process.stdout.write(`\r  ${done}/${changed.length}  ${f}${" ".repeat(20)}`);
  } catch (e) {
    process.stdout.write("\n");
    console.error(`FAILED  ${f}\n${(e.stderr || e.message || "").toString().trim()}`);
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    process.exit(1);
  }
}
process.stdout.write("\n");
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`Done — ${done} file(s) uploaded.`);
if (stale.length) {
  console.log("\nOn server but no longer in the site (delete by hand if you want):");
  stale.forEach((f) => console.log("  " + f));
}
