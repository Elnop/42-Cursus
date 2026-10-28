// HTML templates for the generated project pages (projects/ and projects/<slug>/).
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout({ title, description, base, body }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500;600&family=Jost:wght@300;400;500;700&display=swap">
<link rel="stylesheet" href="${base}style.css">
</head>
<body>
${body}
</body>
</html>
`;
}

const nav = (base, current) => `<div class="nav">
      <a class="logo" href="${base}">42<span>.</span>${esc(current.login)}</a>
      <nav aria-label="Navigation"><a href="${base}">cursus</a><a href="${base}projects/"${current.page === "list" ? ' aria-current="page"' : ""}>projets</a></nav>
    </div>`;

const footer = build => `<footer class="band void" style="padding-block:24px">
  <div class="in"><span>généré depuis readme.md · Elnop/42-Cursus</span><span>build ${esc(build.sha ?? "local")} · ${esc(build.date)}</span></div>
</footer>`;

const scoreText = p => p.score ?? (p.date ? "✓" : "…");
const state = p => p.date ? "done" : "wip";

export function listPage({ login, build, groups }) {
  const base = "../";
  const all = groups.flatMap(g => g.projects);
  const withReadme = all.filter(p => p.readme).length;
  const body = `<header class="band hero void phero">
  <div class="in">
    ${nav(base, { login, page: "list" })}
    <h1 class="ptitle">Projets</h1>
    <p class="plead mono">${all.length} projets · ${withReadme} avec README</p>
  </div>
</header>
<main class="band paper">
  <div class="in plist">
    ${groups.map(g => `<section aria-labelledby="g-${g.id}">
      <h2 class="label" id="g-${g.id}">${esc(g.title)}</h2>
      <ul>${g.projects.map(p => `<li><a class="prow-l" href="${p.slug}/">
        <span class="n">${esc(p.name)}</span>
        <span class="st">${esc(p.stack)}</span>
        <span class="d">${esc(p.date ?? "en cours")}</span>
        <span class="sc ${state(p)}${p.score === 125 ? " max" : ""}">${esc(scoreText(p))}</span>
        <span class="tag">${p.readme ? "readme" : ""}</span>
      </a></li>`).join("")}</ul>
    </section>`).join("")}
  </div>
</main>
${footer(build)}`;
  return layout({ title: `Projets · ${login} · 42 Cursus`, description: `Les ${all.length} projets du cursus 42 de ${login}.`, base, body });
}

export function projectPage({ login, build, p, prev, next }) {
  const base = "../../";
  const facts = [
    ["score", `<span class="sc ${state(p)}${p.score === 125 ? " max" : ""}">${esc(scoreText(p))}</span>`],
    ["stack", esc(p.stack)],
    [p.date ? "validé" : "statut", esc(p.date ?? "en cours")],
    ["repo", p.repo ? `<a href="${esc(p.repo)}" target="_blank" rel="noopener">${esc(p.repo.replace("https://github.com/", ""))} ↗</a>` : "non publié"]
  ];
  const content = p.readme
    ? `<article class="md">${p.readme}</article>`
    : `<div class="generic">
      <p class="label">${esc(p.stack)} · ${esc(p.date ?? "en cours")}</p>
      <p class="big">${p.repo ? "Ce projet n'a pas encore de README." : "Le code de ce projet n'est pas publié."}</p>
      ${p.repo ? `<p>Le code est sur <a href="${esc(p.repo)}" target="_blank" rel="noopener">GitHub ↗</a>.</p>` : ""}
    </div>`;
  const body = `<header class="band hero void phero">
  <div class="in">
    ${nav(base, { login })}
    <p class="crumb mono"><a href="../">projets</a> / ${esc(p.group)}</p>
    <h1 class="ptitle">${esc(p.name)}</h1>
    <p class="plead">${esc(p.desc)}</p>
    <dl class="facts">${facts.map(([k, v]) => `<div><dt class="label">${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  </div>
</header>
<main class="band paper">
  <div class="in">
    ${content}
  </div>
</main>
<nav class="band void pnav" aria-label="Projet précédent et suivant">
  <div class="in">
    ${prev ? `<a href="../${prev.slug}/"><span class="label">← précédent</span><span class="n">${esc(prev.name)}</span></a>` : "<span></span>"}
    ${next ? `<a class="r" href="../${next.slug}/"><span class="label">suivant →</span><span class="n">${esc(next.name)}</span></a>` : "<span></span>"}
  </div>
</nav>
${footer(build)}`;
  return layout({ title: `${p.name} · ${login} · 42 Cursus`, description: p.desc, base, body });
}
