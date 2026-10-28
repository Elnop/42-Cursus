/* Renders the page from window.CURSUS, generated from readme.md by build.mjs. */
const D = window.CURSUS;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = s => s.toLowerCase().replace(/\+/g, "p").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const dateKey = d => { const m = /^(\S+?)\.? (\d{4})$/.exec(d ?? ""); return m ? Number(m[2]) * 12 + MONTHS.indexOf(m[1]) : Infinity; };
const isExam = p => p.stack === "Examen";
const branchProjects = Object.values(D.branches).flat();

/* ---------- stats ---------- */
const projects = D.common.filter(p => !isExam(p));
const scores = D.common.map(p => p.score).filter(Number.isFinite);
const s125 = [...D.common, ...branchProjects].filter(p => p.score === 125).length;
$("stats").innerHTML = [
  [projects.length, "projets du tronc commun"],
  [Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), "score moyen"],
  [s125, "projets à 125"],
  [Object.keys(D.branches).length, "branches ouvertes"]
].map(([v, l]) => `<div class="stat"><b data-count="${v}">${v}</b><span>${l}</span></div>`).join("");

/* ---------- terminal ---------- */
const doneCommon = projects.filter(p => p.date).length;
const wipNames = branchProjects.filter(p => !p.date).map(p => p.name);
const TL = [
  ["cmd", "make cursus"],
  ["ok", `tronc commun   [${doneCommon}/${projects.length}] ${doneCommon === projects.length ? "validé" : "en cours"}`],
  ["ok", `branches       ${Object.keys(D.branches).map(b => b.toLowerCase()).join(" · ")}`],
  ...(wipNames.length ? [["wip", `en cours       ${wipNames.join(", ")}`]] : [])
];
const term = $("term");
const fmtT = L => L[0] === "cmd" ? `<span class="p">${esc(D.login)}@42:~$ </span>${L[1]}` : `<span class="${L[0]}">${L[0] === "ok" ? "✓" : "…"}</span> ${esc(L[1])}`;
(function runT() {
  if (reduce) { term.innerHTML = TL.map(fmtT).join("<br>") + '<br><span class="p">$ </span><span class="cur"></span>'; return; }
  let li = 0, ci = 0;
  (function tick() {
    if (li >= TL.length) { term.innerHTML += '<br><span class="p">$ </span><span class="cur"></span>'; return; }
    if (li === 0) {
      ci++; term.innerHTML = `<span class="p">${esc(D.login)}@42:~$ </span>${TL[0][1].slice(0, ci)}<span class="cur"></span>`;
      if (ci >= TL[0][1].length) { li++; term.innerHTML = fmtT(TL[0]); setTimeout(tick, 420); } else setTimeout(tick, 75);
    } else { term.innerHTML += "<br>" + fmtT(TL[li++]); setTimeout(tick, 260); }
  })();
})();

/* ---------- holy graph ----------
   Half rings around Libft: common-core projects sit on the ring of their rank (site/graph.json),
   spread evenly in validation order; exams are markers on the left of the baseline;
   branches and work experience share the outer ring. */
const node = (p, extra) => ({
  id: slug(p.name), n: p.name, s: p.date ? "done" : "wip", sc: p.score ?? (p.date ? "✓" : null),
  d: p.date ?? "en cours", st: p.stack, ds: p.desc, repo: p.repo, ...extra
});
const chrono = list => [...list].reverse().sort((a, b) => dateKey(a.date) - dateKey(b.date));
const GN = [
  ...chrono(D.common).map(p => isExam(p) ? node(p, { exam: parseInt(p.name.slice(-2), 10) }) : node(p, { rank: D.ranks[p.name] })),
  ...chrono(D.xp.map(x => ({ ...x, name: x.track }))).map(x => node(x, {
    label: x.track.replace("Work Experience", "Work Exp.").replace(/ RNCP \d+$/, ""), zone: "Expérience",
    sc: x.date ? "✓" : null, d: x.date ?? x.result, st: `${x.company} · ${x.duration}`,
    ds: `${x.track} chez ${x.company} : ${x.date ? "validée" : x.result}`, repo: null, url: x.url
  })),
  ...Object.entries(D.branches).flatMap(([b, ps]) => chrono(ps).map(p => node(p, { zone: b })))
];
// left to right on the outer ring; short labels at both ends so nothing runs off the stage
const ZONE_ORDER = ["Expérience", "Web", "IA", "Kernel"].filter(z => z === "Expérience" || z in D.branches)
  .concat(Object.keys(D.branches).filter(b => !["Web", "IA", "Kernel"].includes(b)));
const R0 = 36, STEP = 54, R_OUT = R0 + 7 * STEP + 10;
const ringR = k => R0 + k * STEP;
const polar = (r, deg) => [Math.cos(deg * Math.PI / 180) * r, -Math.sin(deg * Math.PI / 180) * r];
// spread n items evenly over the half circle, left (180°) to right (0°)
const spread = (n, i) => 180 - 180 * (i + .5) / n;
const byId = {};
GN.forEach((g, i) => { g.i = i; byId[g.id] = g; });
GN.filter(g => g.rank === 0).forEach(g => { g.x = 0; g.y = 0; g.a = 90; });
for (let k = 1; k <= 6; k++) {
  const ring = GN.filter(g => g.rank === k);
  ring.forEach((g, j) => { g.a = spread(ring.length, j); [g.x, g.y] = polar(ringR(k), g.a); });
}
const outer = ZONE_ORDER.flatMap(z => GN.filter(g => g.zone === z));
outer.forEach((g, j) => { g.a = spread(outer.length, j); [g.x, g.y] = polar(R_OUT, g.a); });
GN.filter(g => g.exam).forEach(g => { g.x = -ringR(g.exam) + STEP / 2; g.y = 22; });

const SVGNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
const groot = $("groot"), gsvg = $("gsvg");
if (!reduce) groot.classList.add("g-in");
const arc = r => `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`;

// half rings: teal once every project of that rank is validated
for (let k = 1; k <= 6; k++) {
  const done = GN.filter(g => g.rank === k || g.exam === k).every(g => g.s === "done");
  el("path", { class: "ring" + (done ? " done" : ""), d: arc(ringR(k) + STEP / 2), pathLength: 1, style: `--d:${k * .08}s` }, groot);
  el("text", { class: "rk", x: ringR(k) - 6, y: 26, "text-anchor": "middle" }, groot).textContent = "R" + k;
}
el("path", { class: "ring outer", d: arc(R_OUT + 48) }, groot);
el("line", { class: "base", x1: -R_OUT - 60, y1: 0, x2: R_OUT + 60, y2: 0 }, groot);
ZONE_ORDER.forEach(z => {
  const items = outer.filter(g => g.zone === z);
  if (!items.length) return;
  const a = items.reduce((s, g) => s + g.a, 0) / items.length;
  const [x, y] = polar(R_OUT + 70, a);
  el("text", { class: "zone", x, y: y + 4 }, groot).textContent = z.toUpperCase();
});

const nodeEls = {};
GN.forEach(g => {
  const n = el("g", { class: `node ${g.s}${g.exam ? " exam" : ""}`, tabindex: 0, role: "button", "aria-label": `${g.n}, ${g.sc ?? g.d}, ${g.st}`, style: `--d:${.45 + g.i * .05}s` }, groot);
  n.dataset.id = g.id;
  if (g.exam) {
    el("rect", { class: "body", x: g.x - 19, y: g.y - 10, width: 38, height: 20, rx: 10 }, n);
    el("text", { x: g.x, y: g.y + 4, "text-anchor": "middle" }, n).textContent = "E" + String(g.exam).padStart(2, "0");
  } else {
    const r = g.rank === 0 ? 15 : 10;
    if (g.s === "wip") el("circle", { class: "halo", cx: g.x, cy: g.y, r }, n);
    el("circle", { class: "body", cx: g.x, cy: g.y, r }, n);
    // labels sit on the outer side: left of nodes near the left baseline, right of nodes near the right one, above otherwise
    const side = g.rank === 0 ? "below" : g.a > 128 ? "left" : g.a < 52 ? "right" : "above";
    const lt = side === "left" ? { x: g.x - r - 7, y: g.y + 4, "text-anchor": "end" }
      : side === "right" ? { x: g.x + r + 7, y: g.y + 4, "text-anchor": "start" }
      : side === "below" ? { x: g.x, y: g.y + r + 18, "text-anchor": "middle" } : { x: g.x, y: g.y - r - 8, "text-anchor": "middle" };
    el("text", lt, n).textContent = g.label ?? g.n;
  }
  nodeEls[g.id] = n;
});

// pan / zoom: drag and pinch move freely; the mouse wheel zooms only with Ctrl/⌘ so the page still scrolls
const gsel = d3.select(gsvg), hint = $("ghint");
const W_ALL = 2 * (R_OUT + 120), H_ALL = R_OUT + 100;
let hintT;
const zoom = d3.zoom().scaleExtent([.4, 4])
  .filter(e => e.type === "wheel" ? (e.ctrlKey || e.metaKey) : !e.button)
  .on("zoom", e => { groot.setAttribute("transform", e.transform); gsvg.classList.toggle("far", e.transform.k < .7); });
gsel.call(zoom).on("dblclick.zoom", null);
gsvg.addEventListener("wheel", e => {
  if (e.ctrlKey || e.metaKey) return;
  hint.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove("on"), 1100);
}, { passive: true });
function view() {
  const b = gsvg.getBoundingClientRect(), top = 56;
  return { w: b.width, h: b.height - top, top };
}
function fit(ms = 0) {
  const v = view(), k = Math.min(v.w / W_ALL, v.h / H_ALL, 1.4);
  gsel.transition().duration(reduce ? 0 : ms).call(zoom.transform, d3.zoomIdentity.translate(v.w / 2, v.top + v.h / 2 + (H_ALL / 2 - 40) * k).scale(k));
}
function focusNode(g) {
  const v = view(), k = Math.max(d3.zoomTransform(gsvg).k, 1.3);
  gsel.transition().duration(reduce ? 0 : 600).call(zoom.transform, d3.zoomIdentity.translate(v.w / 2 - g.x * k, v.top + v.h / 2 - g.y * k).scale(k));
}
$("zin").onclick = () => gsel.transition().duration(250).call(zoom.scaleBy, 1.4);
$("zout").onclick = () => gsel.transition().duration(250).call(zoom.scaleBy, 1 / 1.4);
$("zfit").onclick = () => fit(500);
let userMoved = false;
gsvg.addEventListener("pointerdown", () => { userMoved = true; });
addEventListener("resize", () => { if (!userMoved) fit(); });

// selection + detail panel
const panel = $("panel");
let selId = null;
function select(id, { zoomTo = false, hash = true } = {}) {
  const g = byId[id]; if (!g) return;
  if (selId) nodeEls[selId].classList.remove("sel");
  selId = id; nodeEls[id].classList.add("sel");
  const pad = k => String(k).padStart(2, "0");
  const where = g.zone ? (g.zone === "Expérience" ? "expérience" : `branche ${g.zone.toLowerCase()}`) : `rank ${pad(g.exam ?? g.rank)}`;
  const kind = g.exam ? "examen" : g.zone === "Expérience" ? "stage" : "projet";
  const href = g.repo ?? g.url;
  panel.innerHTML = `<span class="label">${where} · ${kind}</span>
    <span class="sc ${g.s}">${esc(g.sc ?? "…")}</span>
    <h3>${esc(g.n)}</h3>
    <span class="m">${esc(g.st)} · ${esc(g.d)}</span>
    <p>${esc(g.ds)}</p>
    ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${g.repo ? "voir le repo" : "site de l'entreprise"} ↗</a>` : ""}`;
  if (hash) try { history.replaceState(null, "", "#" + id); } catch {}
  if (zoomTo) focusNode(g);
}
groot.addEventListener("click", e => { const n = e.target.closest(".node"); if (n) select(n.dataset.id); });
groot.addEventListener("keydown", e => {
  const n = e.target.closest(".node");
  if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(n.dataset.id); }
});

// search
$("glist").innerHTML = GN.map(g => `<option value="${esc(g.n)}"></option>`).join("");
$("gsearch").addEventListener("change", e => {
  const q = e.target.value.trim().toLowerCase(); if (!q) return;
  const g = GN.find(g => g.n.toLowerCase() === q) || GN.find(g => g.n.toLowerCase().includes(q));
  if (g) { select(g.id, { zoomTo: true }); nodeEls[g.id].focus({ preventScroll: true }); }
});

fit();
const startId = location.hash.slice(1);
const latest = GN.filter(g => g.s === "done" && !g.exam && g.zone !== "Expérience").sort((a, b) => dateKey(b.d) - dateKey(a.d))[0];
if (byId[startId]) select(startId, { zoomTo: true, hash: false });
else if (latest) select(latest.id, { hash: false });
addEventListener("hashchange", () => { const id = location.hash.slice(1); if (byId[id]) select(id, { zoomTo: true, hash: false }); });

/* ---------- timeline (readme order: newest first) ---------- */
const dated = D.common.filter(p => p.date);
if (dated.length) $("frise-range").textContent = `// ${dated[0].date} → ${dated[dated.length - 1].date}, du plus récent au plus ancien`;
let html = "", yr = "";
D.common.forEach(p => {
  const y = (p.date ?? "").slice(-4);
  if (y && y !== yr) { html += `<div class="year" aria-hidden="true">${y}</div>`; yr = y; }
  const exam = isExam(p);
  html += `<article class="cell${exam ? " exam" : ""}"><span class="d">${esc(p.date ?? "en cours")}</span><span class="s${p.score === 125 ? " max" : ""}"${Number.isFinite(p.score) ? ` data-count="${p.score}"` : ""}>${esc(p.score ?? "…")}</span><span class="n">${esc(p.name)}</span><span class="st">${esc(p.stack)}</span>${exam ? "" : `<span class="ds">${esc(p.desc)}</span>`}${p.repo ? `<a class="r" href="${esc(p.repo)}" target="_blank" rel="noopener">repo ↗</a>` : ""}</article>`;
});
$("track").innerHTML = html;
const rail = $("rail");
let dx = null, sl = 0;
rail.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.target.closest("a")) return; dx = e.clientX; sl = rail.scrollLeft; rail.classList.add("drag"); });
addEventListener("pointermove", e => { if (dx !== null) rail.scrollLeft = sl - (e.clientX - dx); });
addEventListener("pointerup", () => { dx = null; rail.classList.remove("drag"); });
rail.addEventListener("wheel", e => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  const max = rail.scrollWidth - rail.clientWidth;
  if ((e.deltaY > 0 && rail.scrollLeft < max) || (e.deltaY < 0 && rail.scrollLeft > 0)) { rail.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });

/* ---------- branches ---------- */
const ASCII = {
  Web: "  <html>\n    <body>\n      42\n    </body>\n  </html>",
  Kernel: "  mov  ax, 0x07C0\n  mov  ds, ax\n  int  0x10\n  hlt",
  IA: "  θ0 ← θ0 − α·∂J/∂θ0\n  θ1 ← θ1 − α·∂J/∂θ1\n  J(θ) = 1/2m Σ(h−y)²"
};
$("brs").innerHTML = Object.entries(D.branches).map(([b, ps]) => {
  const todo = D.todo.filter(t => t.branch === b && !ps.some(p => p.name === t.name));
  return `<article class="br">${ASCII[b] ? `<pre aria-hidden="true">${esc(ASCII[b])}</pre>` : ""}<h3>${esc(b)}</h3>${ps.map(p => `<div class="prow"><span class="n">${esc(p.name)}</span><span class="sc${p.score == null ? " wip" : ""}">${esc(p.score ?? "en cours")}</span><span class="m">${esc(p.stack)} · ${esc(p.date ?? "en cours")}</span><span class="ds">${esc(p.desc)}</span></div>`).join("")}${todo.length ? `<div class="todo"><span class="label" style="color:var(--mut-d)">à venir</span>${todo.map(t => `<div><span>${esc(t.name)}</span><span>${t.hours}h</span></div>`).join("")}</div>` : ""}</article>`;
}).join("");

/* ---------- experience ---------- */
$("xprows").innerHTML = D.xp.map(x => `<div class="xrow"><span class="k">${esc(x.track)}</span><span class="c">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.company)}</a>` : esc(x.company)}</span><span class="t${x.result === "en cours" ? " now" : ""}">${esc(x.duration)} · ${esc(x.date ?? x.result)}</span></div>`).join("");

/* ---------- roadmap ---------- */
const total = D.todo.reduce((s, t) => s + t.hours, 0);
const maxH = Math.max(...D.todo.map(t => t.hours));
const wip = new Set(wipNames);
const current = D.xp.find(x => x.result === "en cours");
$("hrs").textContent = total + "h";
$("hrs-p").textContent = `de projets prévus pendant l'alternance${current ? ` chez ${current.company}` : ""}, répartis entre ${[...new Set(D.todo.map(t => t.branch))].join(", ").replace(/, ([^,]*)$/, " et $1")}.`;
$("rlist").innerHTML = D.todo.map(t => `<div class="ritem"><span>${esc(t.name)}</span><span class="b">${esc(t.branch)}</span><span class="h">${t.hours}h</span><div class="bar"><i class="${wip.has(t.name) ? "wip" : ""}" style="width:${t.hours / maxH * 100}%;opacity:${wip.has(t.name) ? 1 : .35}"></i></div></div>`).join("");

/* ---------- footer ---------- */
$("build").textContent = `build ${D.build.sha ?? "local"} · ${D.build.date}`;

/* ---------- count-up (final values are already in the DOM at rest) ---------- */
if (!reduce && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const t = e.target, end = +t.dataset.count, t1 = performance.now();
    (function f(now) { const k = Math.min(1, (now - t1) / 900); t.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t1);
  }), { threshold: .6 });
  document.querySelectorAll("[data-count]").forEach(t => io.observe(t));
}
