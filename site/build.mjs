// Builds the GitHub Pages site into _site/ from readme.md (the single source of truth).
// Usage: node site/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "style.css", "app.js"]) copyFileSync(join(here, f), join(out, f));
writeFileSync(join(out, "data.js"), `window.CURSUS = ${JSON.stringify(data, null, 1)};\n`);
writeFileSync(join(out, ".nojekyll"), "");
console.log(`built _site/: ${common.length} common-core entries, ${Object.keys(branches).length} branches, ${xp.length} work experiences, ${todo.length} planned projects`);
