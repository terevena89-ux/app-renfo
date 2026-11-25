// =========================================================
// Renfo — 3 exercices par jour. Tout est gardé sur l'appareil
// (localStorage, pas de synchro) ; Excel sert de sauvegarde.
// =========================================================
import { chargerExcelJS, ajouterFeuille, telechargerClasseur, lireClasseur, lireFeuille } from "./excel-style.js";
import { DESSINS, DESSIN_DEPART } from "./dessins.js";

const VERSION = "0.3.0";
const CLE_DONNEES = "renfo-donnees";
const CLE_FEELING = "renfo-feeling";
const DUREE_APPUI = 550; // ms d'appui long pour valider
const $ = id => document.getElementById(id);
const JOURS_COURTS = ["D", "L", "M", "M", "J", "V", "S"]; // index = getDay()

// ---------- 1. Données ----------
const DEPART = [
  ["Squat", "3 × 15", "Genoux"],
  ["Fentes avant", "3 × 10 par jambe", "Genoux"],
  ["Chaise contre le mur", "3 × 40 s", "Genoux"],
  ["Montée sur une marche", "3 × 12 par jambe", "Genoux"],
  ["Squat bulgare", "3 × 8 par jambe", "Genoux"],
  ["Montées sur pointes", "3 × 20", "Chevilles"],
  ["Descente lente sur une jambe (bord de marche)", "3 × 12 par jambe", "Chevilles"],
  ["Équilibre sur une jambe, yeux fermés", "3 × 30 s par jambe", "Chevilles"],
  ["Marche sur les talons", "2 × 30 pas", "Chevilles"],
  ["Petits sauts sur place", "3 × 30 s", "Chevilles"],
  ["Pont fessier", "3 × 15", "Hanches"],
  ["Écarté de jambe couché sur le côté", "3 × 15 par jambe", "Hanches"],
  ["Soulevé de terre sur une jambe", "3 × 10 par jambe", "Hanches"],
  ["Gainage planche", "3 × 30 s", "Gainage"],
  ["Gainage sur le côté", "3 × 20 s par côté", "Gainage"],
];

const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function lireJSON(cle) { try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; } }

// jours = { "AAAA-MM-JJ": { ids: [...], faits: [...] } } ; repos = numéros getDay()
let donnees = lireJSON(CLE_DONNEES) || {
  exercices: DEPART.map(([nom, qte, zone]) => ({ id: nouvelId(), nom, qte, zone })),
  jours: {}, repos: [], forces: [], idees: ""
};
donnees.forces ||= []; // days trained despite being rest days
// Exercices d'avant la 0.3 : dessin posé d'après le nom (une seule fois : "" = aucun).
for (const e of donnees.exercices) if (e.dessin === undefined) e.dessin = DESSIN_DEPART[e.nom] || "";

const NOM_DESSIN = Object.fromEntries(DESSINS);
// Drawing = CSS mask over currentColor: one colour that follows the theme.
const htmlDessin = (d, cl = "dessin") => d && NOM_DESSIN[d] ? `<i class="${cl}" style="--d:url(dessins/${d}.svg)"></i>` : "";

function sauver() {
  try { localStorage.setItem(CLE_DONNEES, JSON.stringify(donnees)); }
  catch (e) { message("Enregistrement impossible (mémoire pleine ?)"); }
}

const feeling = Object.assign({ theme: "auto", animations: "completes", son: "oui", vibration: "oui" }, lireJSON(CLE_FEELING));
function changerReglage(cle, val) { feeling[cle] = val; try { localStorage.setItem(CLE_FEELING, JSON.stringify(feeling)); } catch (e) {} }

const moinsAnimTel = matchMedia("(prefers-reduced-motion: reduce)");
const animSimples = () => feeling.animations === "simples" || moinsAnimTel.matches;
function appliquerAnimations() { document.documentElement.classList.toggle("simple", animSimples()); }

// ---------- 2. Dates ----------
// Local date key (not toISOString: that one is UTC and shifts days around midnight).
const cleDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const decaler = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const estRepos = d => donnees.repos.includes(d.getDay()) && !donnees.forces.includes(cleDate(d));
const exo = id => donnees.exercices.find(e => e.id === id);
const jourFait = j => j && j.ids.length > 0 && j.ids.every(id => j.faits.includes(id));

// ---------- 3. Tirage ----------
function melanger(t) {
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
// Ids du dernier programme avant aujourd'hui (« hier » = dernière séance prévue, même si un repos est passé entre).
function idsVeille(auj) {
  const avant = Object.keys(donnees.jours).filter(k => k < auj).sort().pop();
  return avant ? donnees.jours[avant].ids : [];
}
// Exercices d'une liste de zones (null = toutes : vieux programmes d'avant les zones).
const dansZones = zs => donnees.exercices.filter(e => !zs || zs.includes(e.zone));

// Choisit un exercice hors de « exclus » : même zone d'abord, puis les autres zones
// de la séance (jamais hors séance), en évitant d'abord ceux de la veille.
function piocher(exclus, zone, zonesSeance) {
  const veille = idsVeille(cleDate(new Date()));
  const libres = dansZones(zonesSeance).filter(e => !exclus.includes(e.id));
  const essais = [
    libres.filter(e => !veille.includes(e.id) && (!zone || e.zone === zone)),
    libres.filter(e => !zone || e.zone === zone),
    libres.filter(e => !veille.includes(e.id)),
    libres,
  ];
  for (const t of essais) if (t.length) return t[Math.floor(Math.random() * t.length)].id;
  return null;
}

// Séance : n exercices partagés moitié-moitié entre les zones (la 1re touchée en a plus).
function tirer(zs, n) {
  const ids = [];
  zs.forEach((z, i) => {
    const part = i === 0 ? Math.ceil(n / zs.length) : n - ids.length;
    for (let k = 0; k < part; k++) { const id = piocher(ids, z, [z]); if (id) ids.push(id); }
  });
  // Zone trop petite : on complète avec l'autre zone choisie.
  while (ids.length < n) { const id = piocher(ids, null, zs); if (!id) break; ids.push(id); }
  donnees.jours[cleDate(new Date())] = { ids, faits: [], zones: zs };
  sauver();
}

// Programme du jour (null = pas encore tiré). Exercices supprimés entre-temps = remplacés.
function programmeDuJour() {
  const auj = cleDate(new Date());
  const j = donnees.jours[auj];
  if (!j) return null;
  if (!j.zones && !j.faits.length) { delete donnees.jours[auj]; sauver(); return null; } // v0.1 draw: let the user choose
  const avant = j.ids.join(), voulu = j.ids.length;
  j.ids = j.ids.filter(exo);
  j.faits = j.faits.filter(id => j.ids.includes(id));
  while (j.ids.length < voulu) { const id = piocher(j.ids, null, j.zones); if (!id) break; j.ids.push(id); }
  if (!j.ids.length) { delete donnees.jours[auj]; sauver(); return null; }
  if (j.ids.join() !== avant) sauver();
  return j;
}

// ---------- 4. Série de jours ----------
// Compte les jours validés d'affilée ; les jours de repos ne cassent rien,
// aujourd'hui pas encore fait non plus.
function serie() {
  const cles = Object.keys(donnees.jours).sort();
  if (!cles.length) return 0;
  const premier = cles[0];
  let d = new Date(), n = 0;
  if (jourFait(donnees.jours[cleDate(d)])) n++;
  for (d = decaler(d, -1); cleDate(d) >= premier; d = decaler(d, -1)) {
    const j = donnees.jours[cleDate(d)];
    if (jourFait(j)) n++;
    else if (!estRepos(d)) break;
  }
  return n;
}

// ---------- 5. Écran du jour ----------
let derniereSerie = null;

function afficherJour(vient) {
  const maintenant = new Date();
  $("date-jour").textContent = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const s = serie();
  const pastille = $("serie");
  pastille.hidden = s === 0;
  pastille.innerHTML = `<svg class="ic"><use href="#i-flamme"/></svg>${s} j`;
  if (derniereSerie !== null && s > derniereSerie) { pastille.classList.remove("pop"); void pastille.offsetWidth; pastille.classList.add("pop"); }
  derniereSerie = s;

  // 7 derniers jours
  let html = "";
  for (let i = 6; i >= 0; i--) {
    const d = decaler(maintenant, -i);
    const j = donnees.jours[cleDate(d)];
    const cl = jourFait(j) ? "fait" : (estRepos(d) ? "repos" : "");
    html += `<div class="jour ${cl} ${i === 0 ? "auj" : ""}"><i></i>${JOURS_COURTS[d.getDay()]}</div>`;
  }
  $("semaine").innerHTML = html;

  const zone = $("programme");
  if (!donnees.exercices.length) {
    zone.innerHTML = `<div class="vide"><svg class="ic"><use href="#i-liste"/></svg>Aucun exercice<br><button class="btn" data-action="ajouter">Ajouter</button></div>`;
    return;
  }
  if (estRepos(maintenant) && !donnees.jours[cleDate(maintenant)]) {
    zone.innerHTML = `<div class="vide"><svg class="ic"><use href="#i-lune"/></svg>Repos<br><button class="btn" data-action="forcer">S'entraîner quand même</button></div>`;
    return;
  }
  const j = programmeDuJour();
  if (!j) { afficherChoix(zone); return; }
  zone.innerHTML = j.ids.map((id, i) => {
    const e = exo(id), fait = j.faits.includes(id);
    return `<div class="carte ${fait ? "fait" : ""} ${vient === id ? "vient" : ""}" data-id="${id}">
      <div class="rond"><span>${i + 1}</span><svg class="ic"><use href="#i-coche"/></svg></div>
      ${htmlDessin(e.dessin)}
      <div class="corps"><div class="nom">${esc(e.nom)}</div>
        <div class="detail">${e.qte ? `<span>${esc(e.qte)}</span>` : ""}${e.zone ? `<span class="tag">${esc(e.zone)}</span>` : ""}</div></div>
      <button class="ico" data-action="autre" aria-label="Autre exercice"><svg class="ic"><use href="#i-autre"/></svg></button>
    </div>`;
  }).join("") + (jourFait(j) ? `<div class="bravo ${vient ? "pop" : ""}"><b>Séance faite</b>${s > 1 ? `${s} jours d'affilée` : "À demain"}</div>` : "");
}

// ---------- 5b. Choix de la séance : 1 ou 2 zones + nombre d'exercices ----------
const choix = { zones: [], n: donnees.nbSeance || 3 };
function bornes() {
  const dispo = choix.zones.length ? dansZones(choix.zones).length : 6;
  const max = Math.min(6, dispo);
  return { min: Math.min(2, max), max };
}
function afficherChoix(zone) {
  choix.zones = choix.zones.filter(z => zones().includes(z));
  const { min, max } = bornes();
  choix.n = Math.max(min, Math.min(max, choix.n));
  zone.innerHTML = `<div class="choix">
    <div class="puces grandes">${zones().map(z => `<button data-action="zone" aria-pressed="${choix.zones.includes(z)}">${esc(z)}</button>`).join("")}</div>
    <div class="nombre"><span>Exercices</span>
      <button class="ico" data-action="moins" aria-label="Moins" ${choix.n <= min ? "disabled" : ""}><svg class="ic"><use href="#i-moins"/></svg></button>
      <b>${choix.n}</b>
      <button class="ico" data-action="plus" aria-label="Plus" ${choix.n >= max ? "disabled" : ""}><svg class="ic"><use href="#i-plus"/></svg></button></div>
    <button class="btn plein" data-action="tirer" ${choix.zones.length ? "" : "disabled"}>C'est parti</button>
  </div>`;
}

const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

$("programme").addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "ajouter") ouvrirFiche(null);
  if (b.dataset.action === "forcer") { donnees.forces.push(cleDate(new Date())); sauver(); afficherJour(); }
  if (b.dataset.action === "zone") {
    const z = b.textContent, i = choix.zones.indexOf(z);
    if (i >= 0) choix.zones.splice(i, 1);
    else { choix.zones.push(z); if (choix.zones.length > 2) choix.zones.shift(); } // 2 max: oldest leaves
    afficherJour();
  }
  if (b.dataset.action === "moins") { choix.n--; afficherJour(); }
  if (b.dataset.action === "plus") { choix.n++; afficherJour(); }
  if (b.dataset.action === "tirer") {
    donnees.nbSeance = choix.n;
    tirer(choix.zones, choix.n);
    afficherJour();
  }
  if (b.dataset.action === "autre") {
    const j = programmeDuJour(), id = b.closest(".carte").dataset.id;
    const nouveau = piocher(j.ids, exo(id).zone, j.zones);
    if (!nouveau) { message("Pas d'autre exercice"); return; }
    j.ids[j.ids.indexOf(id)] = nouveau;
    sauver(); afficherJour();
  }
});

// ---------- 6. Appui long = valider (ou dévalider) ----------
// Pointer events + manual timer: works the same with finger and mouse.
// Moving more than 10 px cancels, so scrolling never validates by mistake.
let appui = null;

$("programme").addEventListener("pointerdown", e => {
  const carte = e.target.closest(".carte");
  if (!carte || e.target.closest("[data-action]") || e.button > 0) return;
  appui = { carte, x: e.clientX, y: e.clientY, debut: performance.now(), retour: carte.classList.contains("fait") };
  if (appui.retour) carte.classList.remove("fait"); // show the gauge draining back
  // Timer decides, rAF only draws (rAF can be throttled).
  appui.minuteur = setTimeout(() => { const a = appui; appui = null; cancelAnimationFrame(a.raf); terminerAppui(a); }, DUREE_APPUI);
  boucleAppui();
});
function boucleAppui() {
  if (!appui) return;
  const p = Math.min(1, (performance.now() - appui.debut) / DUREE_APPUI);
  appui.carte.style.setProperty("--jauge", appui.retour ? 1 - p : p);
  appui.raf = requestAnimationFrame(boucleAppui);
}
function annulerAppui(court) {
  if (!appui) return;
  cancelAnimationFrame(appui.raf);
  clearTimeout(appui.minuteur);
  const { carte, retour, debut } = appui;
  appui = null;
  carte.style.removeProperty("--jauge");
  if (retour) carte.classList.add("fait");
  else if (court && performance.now() - debut < 250) message("Maintenir pour valider");
}
addEventListener("pointerup", () => annulerAppui(true));
addEventListener("pointercancel", () => annulerAppui(false));
addEventListener("pointermove", e => {
  if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 10) annulerAppui(false);
});
$("programme").addEventListener("contextmenu", e => e.preventDefault());

function terminerAppui({ carte, retour }) {
  const j = programmeDuJour(), id = carte.dataset.id;
  if (retour) {
    j.faits = j.faits.filter(x => x !== id);
    sauver(); afficherJour(); vibrer(15);
    return;
  }
  if (!j.faits.includes(id)) j.faits.push(id);
  sauver();
  const complet = jourFait(j);
  afficherJour(id);
  vibrer(complet ? [40, 60, 40, 60, 120] : 35);
  son(j.faits.length, complet);
  if (complet) feter();
}

// ---------- 7. Récompenses : vibration, son, confettis ----------
function vibrer(motif) { if (feeling.vibration === "oui" && navigator.vibrate) navigator.vibrate(motif); }

let audio = null;
function note(freq, quand, duree, volume = .18) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = "triangle"; o.frequency.value = freq;
  g.gain.setValueAtTime(0, quand);
  g.gain.linearRampToValueAtTime(volume, quand + .01);
  g.gain.exponentialRampToValueAtTime(.001, quand + duree);
  o.connect(g).connect(audio.destination);
  o.start(quand); o.stop(quand + duree + .05);
}
// Each validation rings a bit higher (1, 2, 3); full session = small arpeggio.
function son(rang, complet) {
  if (feeling.son !== "oui") return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const gamme = [523, 659, 784, 1047];
    if (complet) [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * .09, .45));
    else note(gamme[Math.min(rang - 1, 3)], t, .25);
  } catch (e) {}
}

function feter() {
  if (animSimples()) return;
  const c = $("confettis"), ctx = c.getContext("2d");
  c.hidden = false;
  const r = devicePixelRatio || 1;
  c.width = innerWidth * r; c.height = innerHeight * r; ctx.scale(r, r);
  const couleurs = ["#E8743B", "#F2B84B", "#7FB3D5", "#8BC47A", "#E58FB0"];
  const bouts = Array.from({ length: 110 }, () => ({
    x: innerWidth / 2, y: innerHeight * .45,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 13 - 4,
    t: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4,
    c: couleurs[Math.floor(Math.random() * couleurs.length)]
  }));
  const debut = performance.now();
  (function image(now) {
    const age = now - debut;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - age / 1800);
    for (const b of bouts) {
      b.vy += .38; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.a += b.va;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.fillStyle = b.c; ctx.fillRect(-b.t / 2, -b.t / 4, b.t, b.t / 2);
      ctx.restore();
    }
    if (age < 1800) requestAnimationFrame(image);
    else { ctx.setTransform(1, 0, 0, 1, 0, 0); c.hidden = true; }
  })(debut);
}

// ---------- 8. Navigation entre écrans ----------
// Each screen pushes a history entry so the Android back button goes back.
const pile = ["ecran-jour"];
function montrer(id) {
  document.querySelectorAll(".ecran").forEach(s => s.hidden = s.id !== id);
  scrollTo(0, 0);
}
function aller(id) { pile.push(id); history.pushState({ n: pile.length }, ""); montrer(id); }
let ignorerPop = false; // history.back() done by fermerFiche itself
addEventListener("popstate", () => {
  if (ignorerPop) { ignorerPop = false; return; }
  if (!$("voile-dessins").hidden) { fermerDessins(true); return; }
  if (!$("voile-fiche").hidden) { fermerFiche(true); return; }
  if (pile.length > 1) pile.pop();
  montrer(pile[pile.length - 1]);
  if (pile.length === 1) afficherJour();
});
document.querySelectorAll("[data-retour]").forEach(b => b.addEventListener("click", () => history.back()));
$("btn-reglages").addEventListener("click", () => { afficherReglages(); aller("ecran-reglages"); });
$("btn-exercices").addEventListener("click", () => { afficherListe(); aller("ecran-exercices"); });
$("voir-exercices").addEventListener("click", () => { afficherListe(); aller("ecran-exercices"); });
$("voir-theme").addEventListener("click", () => aller("ecran-theme"));

// ---------- 9. Liste des exercices ----------
const zones = () => [...new Set(donnees.exercices.map(e => e.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

function afficherListe() {
  const q = $("recherche").value.trim().toLowerCase();
  const tri = (a, b) => (a.zone || "~").localeCompare(b.zone || "~", "fr") || a.nom.localeCompare(b.nom, "fr");
  const liste = donnees.exercices.filter(e => !q || (e.nom + " " + e.zone).toLowerCase().includes(q)).sort(tri);
  let html = "", zoneAvant = null;
  for (const e of liste) {
    if (e.zone !== zoneAvant) { html += `<li class="zone-titre">${esc(e.zone || "Sans zone")}</li>`; zoneAvant = e.zone; }
    html += `<li data-id="${e.id}">${htmlDessin(e.dessin, "dessin mini") || `<i class="dessin mini"></i>`}<span class="nom">${esc(e.nom)}</span><span class="qte">${esc(e.qte)}</span></li>`;
  }
  $("liste-exercices").innerHTML = html || `<li class="zone-titre">Aucun exercice</li>`;
}
$("recherche").addEventListener("input", afficherListe);
$("liste-exercices").addEventListener("click", e => {
  const li = e.target.closest("li[data-id]");
  if (li) ouvrirFiche(li.dataset.id);
});
$("btn-ajouter").addEventListener("click", () => ouvrirFiche(null));

// ---------- 10. Fiche exercice ----------
let ficheId = null, ficheDessin = "";
function ouvrirFiche(id) {
  ficheId = id;
  const e = id ? exo(id) : { nom: "", qte: "", zone: "", dessin: "" };
  $("fiche-titre").textContent = id ? "Exercice" : "Nouvel exercice";
  $("f-nom").value = e.nom; $("f-qte").value = e.qte; $("f-zone").value = e.zone;
  ficheDessin = e.dessin || ""; boutonDessin();
  $("btn-plus").hidden = !id;
  $("menu-plus").hidden = true;
  puces();
  $("voile-fiche").hidden = false;
  history.pushState({ fiche: true }, "");
  if (!id) setTimeout(() => $("f-nom").focus(), 50);
}
function puces() {
  const actuelle = $("f-zone").value.trim();
  $("f-zones").innerHTML = zones().map(z => `<button type="button" aria-pressed="${z === actuelle}">${esc(z)}</button>`).join("");
}
$("f-zone").addEventListener("input", puces);
$("f-zones").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  $("f-zone").value = b.getAttribute("aria-pressed") === "true" ? "" : b.textContent;
  puces();
});
// fromHistory: closed by the back button, so no extra history.back().
function fermerFiche(fromHistory) {
  if ($("voile-fiche").hidden) return;
  $("voile-fiche").hidden = true;
  if (!fromHistory) { ignorerPop = true; history.back(); }
}
$("fiche-fermer").addEventListener("click", () => fermerFiche());
$("voile-fiche").addEventListener("pointerdown", e => { if (e.target === e.currentTarget) fermerFiche(); });
$("btn-plus").addEventListener("click", () => { $("menu-plus").hidden = !$("menu-plus").hidden; });

$("fiche").addEventListener("submit", e => {
  e.preventDefault();
  const nom = $("f-nom").value.trim(); if (!nom) return;
  const vals = { nom, qte: $("f-qte").value.trim(), zone: $("f-zone").value.trim(), dessin: ficheDessin };
  if (ficheId) Object.assign(exo(ficheId), vals);
  else donnees.exercices.push({ id: nouvelId(), ...vals });
  sauver(); fermerFiche(); afficherListe();
});

// ---------- 10b. Choix du dessin (2e pop-up par-dessus la fiche) ----------
function boutonDessin() {
  $("f-dessin").innerHTML = (htmlDessin(ficheDessin) || `<i class="dessin"></i>`) +
    `<span>${ficheDessin ? esc(NOM_DESSIN[ficheDessin] || "") : "Choisir un dessin"}</span><svg class="ic"><use href="#i-suite"/></svg>`;
}
const sansAccent = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function grilleDessins() {
  const q = sansAccent($("recherche-dessin").value.trim());
  const liste = DESSINS.filter(([f, n]) => !q || sansAccent(n).includes(q) || f.includes(q));
  $("grille-dessins").innerHTML = (q ? "" : `<button data-d="" aria-pressed="${!ficheDessin}"><i class="dessin aucun"></i><span>Aucun</span></button>`) +
    liste.map(([f, n]) => `<button data-d="${f}" aria-pressed="${f === ficheDessin}">${htmlDessin(f)}<span>${esc(n)}</span></button>`).join("");
}
$("f-dessin").addEventListener("click", () => {
  $("recherche-dessin").value = "";
  grilleDessins();
  $("voile-dessins").hidden = false;
  history.pushState({ dessins: true }, "");
  $("grille-dessins").querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center" });
});
function fermerDessins(fromHistory) {
  if ($("voile-dessins").hidden) return;
  $("voile-dessins").hidden = true;
  if (!fromHistory) { ignorerPop = true; history.back(); }
}
$("recherche-dessin").addEventListener("input", grilleDessins);
$("grille-dessins").addEventListener("click", e => {
  const b = e.target.closest("[data-d]"); if (!b) return;
  ficheDessin = b.dataset.d; boutonDessin(); fermerDessins();
});
$("dessins-fermer").addEventListener("click", () => fermerDessins());
$("voile-dessins").addEventListener("pointerdown", e => { if (e.target === e.currentTarget) fermerDessins(); });

$("btn-supprimer").addEventListener("click", () => {
  const i = donnees.exercices.findIndex(e => e.id === ficheId);
  if (i < 0) return;
  const [ote] = donnees.exercices.splice(i, 1);
  const copieJours = JSON.stringify(donnees.jours);
  sauver(); fermerFiche(); afficherListe();
  message("Exercice supprimé", "Annuler", () => {
    donnees.exercices.splice(i, 0, ote);
    donnees.jours = JSON.parse(copieJours);
    sauver(); afficherListe();
  });
});

// ---------- 11. Petit message (avec « Annuler » éventuel) ----------
let minuteurMessage = null;
function message(texte, bouton, action) {
  const m = $("message");
  m.innerHTML = `<span>${esc(texte)}</span>${bouton ? `<button>${esc(bouton)}</button>` : ""}`;
  m.hidden = false;
  if (bouton) m.querySelector("button").onclick = () => { m.hidden = true; action(); };
  clearTimeout(minuteurMessage);
  minuteurMessage = setTimeout(() => m.hidden = true, bouton ? 5000 : 1800);
}

// ---------- 12. Réglages ----------
function afficherReglages() {
  // Monday first, like a French calendar.
  $("jours-repos").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(n =>
    `<button data-jour="${n}" aria-pressed="${donnees.repos.includes(n)}">${JOURS_COURTS[n]}</button>`).join("");
  document.querySelectorAll(".segments[data-reglage]").forEach(s =>
    s.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.val === feeling[s.dataset.reglage])));
  document.querySelectorAll("[data-theme-choix]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeChoix === feeling.theme));
  $("theme-actuel").textContent = { auto: "Auto", clair: "Clair", sombre: "Sombre" }[feeling.theme];
}
$("jours-repos").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const n = +b.dataset.jour;
  donnees.repos = donnees.repos.includes(n) ? donnees.repos.filter(x => x !== n) : [...donnees.repos, n];
  sauver(); afficherReglages();
});
document.querySelectorAll(".segments[data-reglage]").forEach(s => s.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  changerReglage(s.dataset.reglage, b.dataset.val);
  appliquerAnimations(); afficherReglages();
}));
$("choix-theme").addEventListener("click", e => {
  const b = e.target.closest("[data-theme-choix]"); if (!b) return;
  changerReglage("theme", b.dataset.themeChoix);
  window.appliquerTheme(b.dataset.themeChoix);
  afficherReglages();
});
$("ouvrir-notes").addEventListener("click", () => {
  NotesIdees.ouvrir(donnees.idees, texte => { donnees.idees = texte; sauver(); });
});

// ---------- 13. Excel ----------
$("btn-exporter").addEventListener("click", async () => {
  try {
    const ExcelJS = await chargerExcelJS();
    const c = new ExcelJS.Workbook();
    ajouterFeuille(c, "Exercices", [
      { header: "Nom", key: "nom", width: 44 }, { header: "Quantité", key: "qte", width: 20 }, { header: "Zone", key: "zone", width: 16 },
      { header: "Dessin", key: "dessin", width: 30 },
    ], [...donnees.exercices]);
    const nomDe = id => exo(id)?.nom || "";
    const cols = [1, 2, 3, 4, 5, 6];
    ajouterFeuille(c, "Historique", [
      { header: "Date", key: "date", width: 12 }, { header: "Parties", key: "zones", width: 20 },
      ...cols.map(n => ({ header: `Exercice ${n}`, key: `e${n}`, width: 30 })),
      { header: "Faits", key: "faits", width: 8 },
    ], Object.keys(donnees.jours).sort().reverse().map(k => {
      const j = donnees.jours[k];
      return { date: k, zones: (j.zones || []).join(", "), ...Object.fromEntries(cols.map(n => [`e${n}`, nomDe(j.ids[n - 1])])),
               faits: `${j.faits.length}/${j.ids.length}` };
    }));
    ajouterFeuille(c, "Repos", [{ header: "Jour de repos", key: "j", width: 16 }],
      donnees.repos.map(n => ({ j: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][n] })));
    await telechargerClasseur(c, "renfo");
  } catch (e) { message(e.message); }
});

$("btn-importer").addEventListener("click", () => $("fichier-import").click());
$("fichier-import").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const c = await lireClasseur(f);
    const lignes = lireFeuille(c.getWorksheet("Exercices")).filter(l => l.Nom);
    if (!lignes.length) throw new Error("Feuille « Exercices » vide ou absente");
    const exercices = lignes.map(l => ({ id: nouvelId(), nom: l.Nom, qte: l["Quantité"] || "", zone: l.Zone || "",
      dessin: NOM_DESSIN[l.Dessin] ? l.Dessin : (l.Dessin === undefined ? DESSIN_DEPART[l.Nom] || "" : "") }));
    const parNom = Object.fromEntries(exercices.map(x => [x.nom, x.id]));
    // History stores names; ones not in the list anymore are dropped.
    const jours = {};
    for (const l of lireFeuille(c.getWorksheet("Historique"))) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(l.Date)) continue;
      const ids = [1, 2, 3, 4, 5, 6].map(n => parNom[l[`Exercice ${n}`]]).filter(Boolean);
      const nb = parseInt(l.Faits) || 0;
      const zs = String(l.Parties || "").split(",").map(z => z.trim()).filter(Boolean);
      if (ids.length) jours[l.Date] = { ids, faits: ids.slice(0, nb), zones: zs.length ? zs : null };
    }
    const noms = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const repos = lireFeuille(c.getWorksheet("Repos")).map(l => noms.indexOf(String(l["Jour de repos"]).toLowerCase())).filter(n => n >= 0);
    const avant = JSON.stringify(donnees);
    donnees = { ...donnees, exercices, jours, repos, forces: [] };
    sauver(); afficherReglages();
    message(`${exercices.length} exercices importés`, "Annuler", () => { donnees = JSON.parse(avant); sauver(); afficherReglages(); });
  } catch (err) { message("Import impossible : " + err.message); }
});

// ---------- 14. Démarrage ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  }).catch(() => {});
  // Reload once when a new version takes over (not on first install, not with the form open).
  const avaitUneVersion = !!navigator.serviceWorker.controller;
  let dejaRecharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!avaitUneVersion || dejaRecharge) return;
    dejaRecharge = true;
    const essayer = () => $("voile-fiche").hidden && !appui ? location.reload() : setTimeout(essayer, 2000);
    essayer();
  });
}

// App left open overnight: redraw on return so the new day's program appears.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && pile.length === 1) afficherJour();
});
moinsAnimTel.addEventListener("change", appliquerAnimations);

$("version").textContent = VERSION;
appliquerAnimations();
sauver();
afficherJour();
