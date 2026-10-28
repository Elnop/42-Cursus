// Builds the GitHub Pages site into _site/ from readme.md (the single source of truth).
// Project pages render each project's README.md, fetched from GitHub at the commit the submodule points to.
// Usage: npm ci --prefix site && node site/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { listPage, projectPage } from "./pages.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(root, "_site");
const readme = readFileSync(join(root, "readme.md"), "utf8");
const { ranks } = JSON.parse(readFileSync(join(here, "graph.json"), "utf8"));

// Split the readme into "## section" / "### subsection" blocks and parse the tables they hold.
function sections(md, level) {
  const re = new RegExp(`^${"#".repeat(level)} (.+)$`, "gm");
  const heads = [...md.matchAll(re)];
  return Object.fromEntries(heads.map((h, i) => [h[1].trim(), md.slice(h.index + h[0].length, heads[i + 1]?.index ?? md.length)]));
}
function table(block) {
  const rows = block.split("\n").filter(l => l.trim().startsWith("|"));
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const head = cells(rows[0]);
  return rows.slice(2).map(r => Object.fromEntries(cells(r).map((c, i) => [head[i], c])));
}
const link = s => { const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(s ?? ""); return m ? { text: m[1].replace(/\*/g, ""), url: m[2] } : null; };
const none = s => !s || s === "—" || s === "-";
const score = s => /^\d+$/.test(s) ? Number(s) : s === "validée" ? "✓" : null;
const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

const top = sections(readme, 2);
const need = name => { if (!top[name]) throw new Error(`readme.md: section "## ${name}" not found`); return top[name]; };

const project = r => ({
  name: r["Projet"], stack: r["Stack"], score: score(r["Score"]), desc: r["Description"],
  date: none(r["Validé"]) ? null : r["Validé"], repo: link(r["Repo"])?.url ?? null
});
const common = table(need("Tronc commun")).map(project);
const branches = Object.fromEntries(Object.entries(sections(need("Branches spécialisées"), 3)).map(([b, t]) => [b, table(t).map(project)]));
const xp = table(need("Expérience professionnelle")).map(r => ({
  track: r["Parcours"], company: link(r["Entreprise"])?.text ?? r["Entreprise"], url: link(r["Entreprise"])?.url ?? null,
  duration: r["Durée"], result: r["Résultat"], date: none(r["Validé"]) ? null : r["Validé"]
}));
const todoRows = table(need("Projets à faire en alternance"));
const todo = todoRows.filter(r => !r["Projet"].startsWith("**")).map(r => ({
  name: r["Projet"], branch: r["Branche"], hours: parseInt(r["Heures estimées"], 10), team: r["Équipe"]
}));

const missing = common.filter(p => p.stack !== "Examen" && !(p.name in ranks)).map(p => p.name);
if (missing.length) throw new Error(`site/graph.json: no rank for ${missing.join(", ")}`);

let sha = process.env.GITHUB_SHA;
try { sha ??= execSync("git rev-parse HEAD", { cwd: root }).toString().trim(); } catch {}
const now = new Date();
const data = {
  login: link(readme.match(/^Login : (.+)$/m)?.[1])?.text ?? "lperroti",
  common, branches, xp, todo, ranks,
  build: { sha: sha ? sha.slice(0, 7) : null, date: `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]}. ${now.getUTCFullYear()}` }
};

// ---------- project pages ----------
const slug = s => s.toLowerCase().replace(/\+/g, "p").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const submodules = Object.fromEntries([...readFileSync(join(root, ".gitmodules"), "utf8")
  .matchAll(/path = (\S+)\s+url = \S*\/([^/\s]+?)(?:\.git)?(?=\s|$)/g)].map(m => [m[2], m[1]]));

async function fetchReadme(repoUrl) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+?))?\/?$/.exec(repoUrl ?? "");
  if (!m) return null;
  const [, owner, repo, dir = ""] = m;
  let ref = "HEAD";
  if (submodules[repo]) ref = execSync(`git ls-tree HEAD -- ${JSON.stringify(submodules[repo])}`, { cwd: root }).toString().split(/\s+/)[2] || ref;
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${dir ? dir + "/" : ""}${name}`;
    const res = await fetch(url);
    if (res.ok) return { md: await res.text(), owner, repo, ref, dir };
    if (res.status !== 404) throw new Error(`${url}: HTTP ${res.status}`);
  }
  return null;
}

const bare = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function renderReadme({ md, owner, repo, ref, dir }, name) {
  // relative links point into the repo: images to the raw file, everything else to the GitHub view
  const resolve = (href, raw) => {
    if (!href || /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) return href;
    const path = posix.normalize(href.startsWith("/") ? href.slice(1) : posix.join(dir, href));
    return raw ? `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}` : `https://github.com/${owner}/${repo}/blob/${ref}/${path}`;
  };
  // headings get GitHub-style ids so a README's table of contents (#…) keeps working
  const ids = new Map();
  const headingId = text => {
    const base = text.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-");
    const n = ids.get(base) ?? 0; ids.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
  const marked = new Marked({
    gfm: true,
    walkTokens(t) { if (t.type === "link" || t.type === "image") t.href = resolve(t.href, t.type === "image"); },
    renderer: { heading({ tokens, depth, text }) { return `<h${depth} id="${headingId(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`; } }
  });
  // a README usually opens with the project name, which the page header already shows
  md = md.replace(/^\s*#\s+(.+)\n/, (all, h) => bare(h) === bare(name) ? "" : all);
  return marked.parse(md)
    .replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)/gi, (_, a, src) => a + resolve(src, true))
    // links leave the page in a new tab; in-page anchors (#…) stay put
    .replace(/<a\b(?![^>]*\btarget=)(?=[^>]*\bhref=["'](?!#))([^>]*)>/gi, '<a$1 target="_blank" rel="noopener">');
}

const groups = [
  ...Object.entries(branches).map(([b, ps]) => ({ id: slug(b), title: `branche ${b.toLowerCase()}`, projects: ps.map(p => ({ ...p, group: `branche ${b.toLowerCase()}` })) })),
  { id: "tronc-commun", title: "tronc commun", projects: common.filter(p => p.stack !== "Examen").map(p => ({ ...p, group: `tronc commun · rank ${String(ranks[p.name]).padStart(2, "0")}` })) }
];
const pages = groups.flatMap(g => g.projects);
await Promise.all(pages.map(async p => {
  p.slug = slug(p.name);
  const src = await fetchReadme(p.repo);
  p.readme = src ? renderReadme(src, p.name) : null;
}));
// app.js links the graph, timeline and branch cards to these pages
const pageSlugs = new Set(pages.map(p => p.slug));
[...common, ...Object.values(branches).flat()].forEach(p => { if (pageSlugs.has(slug(p.name))) p.page = `projects/${slug(p.name)}/`; });

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "style.css", "app.js"]) copyFileSync(join(here, f), join(out, f));
writeFileSync(join(out, "data.js"), `window.CURSUS = ${JSON.stringify(data, null, 1)};\n`);
writeFileSync(join(out, ".nojekyll"), "");
mkdirSync(join(out, "projects"));
writeFileSync(join(out, "projects", "index.html"), listPage({ login: data.login, build: data.build, groups }));
pages.forEach((p, i) => {
  mkdirSync(join(out, "projects", p.slug));
  writeFileSync(join(out, "projects", p.slug, "index.html"), projectPage({ login: data.login, build: data.build, p, prev: pages[i - 1], next: pages[i + 1] }));
});
console.log(`built _site/: ${common.length} common-core entries, ${Object.keys(branches).length} branches, ${xp.length} work experiences, ${todo.length} planned projects`);
console.log(`  ${pages.length} project pages, README for: ${pages.filter(p => p.readme).map(p => p.name).join(", ")}`);
