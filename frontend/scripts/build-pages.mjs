import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "dist-pages");
const env = loadEnv("pages", root, "VITE_");
const live = Boolean(env.VITE_API_ORIGIN);
const rawOrigin = env.VITE_SITE_URL || process.env.CF_PAGES_URL || "";
let origin = "";
if (rawOrigin) {
  const url = new URL(rawOrigin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("VITE_SITE_URL must be the site's HTTPS origin.");
  }
  origin = url.origin;
}
const preview = Boolean(
  process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "main",
);
const catalog = JSON.parse(
  await readFile(resolve(root, "src/features/samples/catalog.json"), "utf8"),
);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
async function save(path, contents) {
  const target = resolve(out, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}
const status = live
  ? "Build a graph, import a CSV, and simulate your scenario."
  : "Graph editing, CSV imports, and sample exploration are available. Live simulations are not connected yet.";
const nav = `<header><a class="brand" href="/" aria-label="RiskFlow home"><span aria-hidden="true">rf</span>RiskFlow</a><nav aria-label="Main navigation"><a href="/guide/">Guide</a><a href="/sample-results/">Sample results</a><a class="button small" href="/workspace/">Open workspace <span aria-hidden="true">↗</span></a></nav></header>`;
const footer = `<footer><p>RiskFlow · A transaction investigation project.</p><div><a href="/guide/#data">Data &amp; limitations</a><a href="https://github.com/Vortex-VK/RiskFlow">Source on GitHub</a></div></footer>`;
function page(title, description, path, body) {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(title)} | RiskFlow</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)} | RiskFlow"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">${preview || path === "/404" ? '<meta name="robots" content="noindex">' : ""}${origin ? `<link rel="canonical" href="${escape(origin + path)}">` : ""}<link rel="stylesheet" href="/site.css"></head><body><a class="skip" href="#main">Skip to content</a><div class="shell">${nav}<main id="main">${body}</main>${footer}</div></body></html>`;
}

const workspace = await readFile(resolve(out, "index.html"), "utf8");
await save(
  "workspace/index.html",
  workspace.replace("</head>", '<meta name="robots" content="noindex"></head>'),
);
await copyFile(resolve(root, "site/site.css"), resolve(out, "site.css"));

const graph = `<svg class="network" viewBox="0 0 520 400" role="img" aria-labelledby="network-title"><title id="network-title">Illustration of accounts linked to a merchant through payments and shared context</title><g fill="none" stroke="#4b776c" stroke-width="2"><path d="M110 112L350 190L120 296L110 112M110 112L240 54M120 296L240 350M350 190L440 82"/><path class="accent" d="M110 112Q255 80 350 190" stroke="#e7a64d" stroke-width="3"/></g><g font-family="system-ui" text-anchor="middle"><circle cx="110" cy="112" r="38" fill="#263e48" stroke="#87a9bc"/><text x="110" y="120" fill="#dcecf4" font-size="24">A</text><text x="110" y="172" fill="#b1c8d4">Account</text><circle cx="120" cy="296" r="31" fill="#263e48" stroke="#87a9bc"/><text x="120" y="304" fill="#dcecf4" font-size="22">A</text><circle cx="350" cy="190" r="43" fill="#4a412b" stroke="#c9b77b"/><path d="M328 185h44l-9-13h-26zM332 187v24h36v-24M345 211v-15h10v15" fill="none" stroke="#e6d59b" stroke-width="2"/><text x="350" y="256" fill="#d5c58e">Merchant</text><rect x="219" y="33" width="42" height="42" rx="12" fill="#393448" stroke="#ac9abe"/><text x="240" y="104" fill="#bfaed3">Device</text><circle cx="240" cy="350" r="17" fill="#3a5042" stroke="#aac7ae"/><circle cx="440" cy="82" r="12" fill="#3a5042" stroke="#aac7ae"/><rect x="191" y="120" width="110" height="30" rx="15" fill="#372b19" stroke="#e7a64d"/><text x="246" y="140" fill="#ffd59b" font-size="12">Payment to review</text></g></svg>`;
await save(
  "index.html",
  page(
    "Explore the connections behind payments",
    "Explore transaction CSVs as interactive graphs. Connect accounts and merchants, inspect payment histories, and investigate suspicious activity with RiskFlow.",
    "/",
    `
<section class="hero"><div><p class="eyebrow">TRANSACTION INVESTIGATION</p><h1>Every payment<br>has a <em>context.</em></h1><p class="lead">Explore the accounts, merchants, and shared connections behind your transactions.</p><div class="actions"><a class="button" href="/workspace/">Open workspace <span aria-hidden="true">↗</span></a><a class="text-link" href="/guide/">How it works <span aria-hidden="true">→</span></a></div><p class="availability">${status}</p></div><div class="illustration">${graph}<p>Connections reveal the bigger picture.</p></div></section>
<section class="features" aria-label="What you can do"><article><span class="number">01</span><h2>Bring your transactions</h2><p>Import a CSV or choose a sample. Explore purchases as a network of accounts and merchants.</p></article><article><span class="number">02</span><h2>Follow the connections</h2><p>Zoom into groups, inspect payments, and build context with devices and locations.</p></article><article><span class="number">03</span><h2>Investigate the signals</h2><p>Live simulations highlight payments for review. Read the recorded sample results to see how the analysis behaves.</p></article></section>
<section class="closing"><div><p class="eyebrow">A PLACE TO START</p><h2>From five payments to ten thousand.</h2><p>Six curated samples let you explore different patterns and scales.</p></div><a class="text-link" href="/sample-results/">Explore the examples <span aria-hidden="true">→</span></a></section>`,
  ),
);

await save(
  "guide/index.html",
  page(
    "How to use RiskFlow",
    "A guide to importing transaction CSVs, creating starter context, connecting objects, and understanding RiskFlow results.",
    "/guide/",
    `
<div class="page-intro"><p class="eyebrow">THE GUIDE</p><h1>Start with a payment.<br>Build the context.</h1><p class="lead">${status}</p></div><div class="guide-list">
<section><span class="number">01</span><div><h2>Choose a starting point</h2><p>Open Samples for a ready-made graph, or select Import CSV. Review the preview, then choose Build graph. Graph-only import lets you explore incomplete data without running a simulation.</p></div></section>
<section><span class="number">02</span><div><h2>Create and connect objects</h2><p>Open Objects and drag an account or merchant onto the canvas. Select an account and choose Create starter context to add its device and location. Right-drag from an account to another object to make a connection, then complete its details. For keyboard access, focus an object, press C, and select the target.</p></div></section>
<section><span class="number">03</span><div><h2>Explore the graph</h2><p>Zoom into groups to inspect individual accounts and payments. Select an object to edit it, and choose Apply to save. Use Undo, Redo, and Clear board to revise the workspace. The ? button opens an interactive tutorial.</p></div></section>
<section><span class="number">04</span><div><h2>Understand the results</h2><p>When live simulations are available, select Simulate to analyse the scenario. Results show payment totals, review workload, and estimated fraud probabilities. Labels, when present, let you compare the predictions with known outcomes. A review alert is a lead to investigate, not proof of fraud.</p><p><a href="/sample-results/">View recorded sample results</a> while exploring the examples.</p></div></section></div>
<section class="closing" id="data"><div><h2>Data and limitations</h2><p>Graph exploration happens in your browser. A live simulation sends the scenario to the analysis service. Public-demo simulations do not save server-side datasets. Your workspace lasts for the current session; refreshing starts over.</p><p>Samples use synthetic transactions. Their recorded results describe these specific, curated files and do not establish accuracy on other uploads. Source labels are used for comparison, never as prediction inputs.</p><p><a href="/samples/ibm/ATTRIBUTION.txt">Sample attribution</a> · <a href="/samples/ibm/LICENSE.txt">Sample license</a></p></div></section>`,
  ),
);

const cards = catalog.samples
  .map((s) => {
    const percent = (s.alertCount / s.rows) * 100;
    return `<article class="sample"><div class="sample-heading"><span class="eyebrow">${s.rows.toLocaleString("en-US")} PAYMENTS</span><h2>${escape(s.title)}</h2><p>${escape(s.description)}</p></div><div class="fraud-bar" role="meter" aria-label="Payments flagged for review" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><dl><div><dt>Fraud detected</dt><dd>${s.metrics.truePositive} / ${s.fraudCount}</dd></div><div><dt>False alerts</dt><dd>${s.metrics.falsePositive}</dd></div><div><dt>Flagged for review</dt><dd>${Number(percent.toFixed(2))}%</dd></div></dl><a href="/samples/ibm/${escape(s.file)}" download>Download CSV <span aria-hidden="true">↓</span></a></article>`;
  })
  .join("");
await save(
  "sample-results/index.html",
  page(
    "Recorded sample results",
    "Explore six curated transaction samples and their recorded fraud-detection results, from five to ten thousand payments.",
    "/sample-results/",
    `<div class="page-intro"><p class="eyebrow">SAMPLE RESULTS</p><h1>Six ways to<br>explore the network.</h1><p class="lead">Recorded results for our curated synthetic examples. Open Samples in the workspace to explore their graphs.</p><p class="legend"><span></span> No alert <span></span> Flagged for review</p></div><section class="sample-grid" aria-label="Recorded results">${cards}</section><p class="note">These examples include selected demonstrations of strong detection. They also include more difficult cases. Results apply to these files, not to arbitrary uploads. <a href="/guide/#data">Read about the data</a>.</p>`,
  ),
);
await save(
  "404.html",
  page(
    "Page not found",
    "Return to RiskFlow.",
    "/404",
    '<div class="page-intro"><p class="eyebrow">404</p><h1>This page isn’t here.</h1><p><a class="button" href="/">Return to RiskFlow</a></p></div>',
  ),
);

const templateIds = [
  "shared-device-cluster",
  "everyday-purchases",
  "stolen-card-burst",
  "account-takeover",
];
const templates = [];
for (const id of templateIds) {
  const text = await readFile(
    resolve(root, `../fixtures/scenarios/${id}.json`),
    "utf8",
  );
  const { scenario } = JSON.parse(text);
  templates.push({
    id,
    version: scenario.sourceTemplateVersion,
    title: scenario.name,
    narrative: "Synthetic scenario for graph exploration.",
    nodeCount: scenario.nodes.length,
    paymentCount: scenario.payments.length,
  });
  await save(`presets/templates/${id}.json`, text);
}
await save("presets/templates.json", JSON.stringify(templates));
await save(
  "robots.txt",
  preview
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ""}`,
);
if (origin)
  await save(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", "/guide/", "/sample-results/"].map((path) => `<url><loc>${escape(origin + path)}</loc></url>`).join("")}</urlset>`,
  );
await save(
  "_headers",
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${preview ? "  X-Robots-Tag: noindex\n" : ""}/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/workspace/*\n  X-Robots-Tag: noindex\n`,
);
console.log(
  `Cloudflare Pages build ready. Live simulations: ${live ? "configured" : "not connected"}. Sitemap: ${origin || "set VITE_SITE_URL at deployment"}.`,
);
