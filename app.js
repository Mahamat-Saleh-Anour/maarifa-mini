// Maarifa Mini — application (navigateur). Toute la sécurité est appliquée
// côté serveur par Supabase (règles RLS + fonctions) : ce fichier ne fait
// qu'afficher et appeler ces fonctions.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, INACTIVITY_MINUTES } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "maarifa-mini-auth" },
});

/* ---------- Constantes ---------- */
const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MODES = ["Espèces", "Airtel Money", "Moov Money", "Chèque", "Virement bancaire"];
const ROLE_LABEL = { fondateur: "Fondateur", admin: "Administrateur" };
const STUDENT_FIELDS = [
  { k: "matricule", l: "Matricule", t: "text" },
  { k: "sexe", l: "Sexe", t: "select", o: ["M", "F"] },
  { k: "dateNaissance", l: "Date de naissance", t: "date" },
  { k: "lieuNaissance", l: "Lieu de naissance", t: "text" },
  { k: "nationalite", l: "Nationalité", t: "text" },
  { k: "numActe", l: "N° d'acte de naissance", t: "text" },
  { k: "dateInscription", l: "Date d'inscription", t: "date", hint: "Les mensualités commencent au mois d'inscription" },
  { k: "ecolePrecedente", l: "École précédente", t: "text" },
  { k: "observation", l: "Observation", t: "textarea" },
];
const FAMILY_FIELDS = [
  { k: "tuteurNom", l: "Nom du tuteur", t: "text" },
  { k: "lien", l: "Lien avec les élèves", t: "select", o: ["Père", "Mère", "Oncle", "Tante", "Frère / sœur", "Grand-parent", "Tuteur légal", "Autre"] },
  { k: "tel", l: "Téléphone", t: "tel" },
  { k: "tel2", l: "Téléphone 2", t: "tel" },
  { k: "quartier", l: "Quartier / adresse", t: "text" },
  { k: "profession", l: "Profession", t: "text" },
  { k: "email", l: "E-mail", t: "email" },
  { k: "pieceId", l: "N° pièce d'identité", t: "text" },
  { k: "dateInscription", l: "Date d'inscription de la famille", t: "date" },
  { k: "observation", l: "Observation", t: "textarea" },
];
function defaultFields() {
  const s = {}, f = {};
  STUDENT_FIELDS.forEach((d) => (s[d.k] = { show: ["matricule", "sexe", "dateNaissance", "lieuNaissance", "dateInscription", "observation"].includes(d.k), req: false }));
  FAMILY_FIELDS.forEach((d) => (f[d.k] = { show: ["tuteurNom", "lien", "tel", "tel2", "quartier", "dateInscription", "observation"].includes(d.k), req: d.k === "tel" }));
  return { student: s, family: f };
}

/* ---------- Outils ---------- */
function monthRange(a, b) { const out = []; let [y, m] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number); let g = 0; while ((y < y2 || (y === y2 && m <= m2)) && g++ < 36) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } } return out; }
const mLabel = (k) => { const [y, m] = k.split("-"); return MOIS[+m - 1] + " " + y.slice(2); };
const pad = (n) => String(n).padStart(2, "0");
const nowKey = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const F = (n) => Math.round(+n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const fmtDateTime = (t) => { if (!t) return ""; const d = new Date(t); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const famNum = (c) => parseInt(String(c || "").replace(/\D/g, "")) || 0;
const newId = () => crypto.randomUUID();
function genPassword() { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = new Uint32Array(10); crypto.getRandomValues(r); return Array.from(r, (x) => a[x % a.length]).join(""); }
const $ = (id) => document.getElementById(id);

/* ---------- État ---------- */
const S = {
  phase: "boot", // boot | login | changepw | app
  user: null, profile: null, memberships: [], sid: null,
  families: [], students: [], receipts: [], lines: [], members: [], audit: [], loadingData: false, lastLoad: 0,
  platform: { schools: [], founders: [] },
  view: "tableau", f: { q: "", cls: "", late: false, sortis: false }, jf: { q: "", m: "", st: "", by: "" },
  af: { from: "", to: "", by: "", action: "" }, draft: null, pay: null,
};
try { const v = localStorage.getItem("mm-view"); if (v) S.view = v; } catch (e) {}

const current = () => S.memberships.find((m) => m.school_id === S.sid);
const school = () => current()?.schools;
const myRole = () => current()?.role;
const isFondateur = () => myRole() === "fondateur";
const isSuper = () => !!S.profile?.is_superadmin;
const months = () => (school()?.months || []).filter((m) => m.on);
const classes = () => school()?.classes || [];
const fcfg = (g) => { const d = defaultFields()[g], c = (school()?.fields || {})[g] || {}; return Object.fromEntries(Object.keys(d).map((k) => [k, c[k] || d[k]])); };
const clsOf = (st) => classes().find((c) => c.id === st.classId);
const famOf = (st) => S.families.find((f) => f.id === st.familyId);
const monthly = (st) => Math.max(0, (+clsOf(st)?.fee || 0) - (+st.reduction || 0));
function dueFor(st, k) {
  if (!months().some((m) => m.key === k)) return 0;
  if (st.dateInscription && k < st.dateInscription.slice(0, 7)) return 0;
  if (st.statut === "Sorti" && st.dateSortie && k > st.dateSortie.slice(0, 7)) return 0;
  return monthly(st);
}
function paidIndex() { const m = new Map(); for (const p of S.lines) { const key = p.studentId + "|" + p.month; m.set(key, (m.get(key) || 0) + p.amount); } return m; }
function cellState(due, paid, k) { if (due <= 0 && paid <= 0) return "na"; if (paid >= due && due > 0) return "ok"; if (paid > 0) return "part"; return k <= nowKey() ? "late" : "up"; }
function studentSummary(st, PI) {
  let paid = 0, dueNow = 0, reste = 0;
  for (const m of months()) { const d = dueFor(st, m.key), p = PI.get(st.id + "|" + m.key) || 0; paid += p; if (m.key <= nowKey()) { dueNow += d; reste += Math.max(0, d - p); } }
  return { paid, dueNow, reste };
}
const studentsOfFam = (fid, all) => S.students.filter((s) => s.familyId === fid && (all || s.statut !== "Sorti")).sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
const nextFamCode = () => { let mx = 0; S.families.forEach((f) => (mx = Math.max(mx, famNum(f.code)))); return "F" + (mx + 1); };

/* ---------- Accès aux données ---------- */
function errMsg(e) {
  const m = e?.message || String(e || "");
  if (e?.code === "23505") return "Cette valeur existe déjà (code famille en double ?).";
  if (e?.code === "23503") return "Impossible : cet enregistrement est lié à des paiements ou à des élèves.";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m)) return "Action non autorisée pour votre compte.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Connexion Internet indisponible. Réessayez.";
  return m || "Erreur inconnue.";
}
async function fetchAll(make) {
  const out = []; let from = 0;
  for (;;) { const { data, error } = await make().range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; from += 1000; }
  return out;
}
const mapFamily = (r) => ({ ...(r.info || {}), id: r.id, code: r.code, nom: r.nom });
const mapStudent = (r) => ({ ...(r.info || {}), id: r.id, familyId: r.family_id, nom: r.nom, classId: r.class_id, reduction: r.reduction, statut: r.statut, dateInscription: r.date_inscription || "", dateSortie: r.date_sortie || "" });

async function loadSchoolData() {
  if (!S.sid) return;
  S.loadingData = true; render();
  try {
    const sid = S.sid;
    const [fams, sts, recs, mems] = await Promise.all([
      fetchAll(() => sb.from("families").select("*").eq("school_id", sid).order("created_at")),
      fetchAll(() => sb.from("students").select("*").eq("school_id", sid).order("created_at")),
      fetchAll(() => sb.from("receipts").select("*, payment_lines(student_id,student_nom,month,amount)").eq("school_id", sid).order("date", { ascending: false }).order("created_at", { ascending: false })),
      fetchAll(() => sb.from("memberships").select("user_id,role,active,created_at,profiles(full_name,email)").eq("school_id", sid).order("created_at")),
    ]);
    if (sid !== S.sid) return;
    S.families = fams.map(mapFamily);
    S.students = sts.map(mapStudent);
    S.receipts = recs;
    S.lines = recs.filter((r) => r.status === "valide").flatMap((r) => r.payment_lines.map((l) => ({ studentId: l.student_id, month: l.month, amount: l.amount, receiptId: r.id })));
    S.members = mems;
    S.lastLoad = Date.now();
  } catch (e) { toast("Chargement impossible : " + errMsg(e)); }
  S.loadingData = false; render();
  if (S.view === "audit") loadAudit();
}
async function loadMemberships() {
  const { data, error } = await sb.from("memberships").select("school_id,role,active,schools(*)").eq("user_id", S.user.id).eq("active", true);
  if (error) throw error;
  S.memberships = (data || []).filter((m) => m.schools).sort((a, b) => a.schools.name.localeCompare(b.schools.name));
}
async function loadPlatform() {
  if (!isSuper()) return;
  const [sc, fo] = await Promise.all([
    sb.from("schools").select("id,name,sigle,annee,created_at").order("name"),
    sb.from("memberships").select("school_id,role,active,profiles(full_name,email)").eq("role", "fondateur"),
  ]);
  S.platform = { schools: sc.data || [], founders: fo.data || [] };
}
async function callAdmin(body) {
  const { data, error } = await sb.functions.invoke("manage-users", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
async function run(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok); return r ?? true; }
  catch (e) { console.error(e); formErr(errMsg(e)) || toast(errMsg(e)); return false; }
}

/* ---------- Session ---------- */
async function afterLogin(user) {
  S.user = user;
  const { data: prof, error } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (error || !prof) { toast("Profil introuvable : contactez l'administrateur."); await sb.auth.signOut(); return; }
  S.profile = prof;
  if (prof.must_change_password) { S.phase = "changepw"; return render(); }
  await enterApp();
}
async function enterApp() {
  try { await loadMemberships(); await loadPlatform(); } catch (e) { toast(errMsg(e)); }
  S.phase = "app";
  let saved = ""; try { saved = localStorage.getItem("mm-sid") || ""; } catch (e) {}
  const pick = S.memberships.find((m) => m.school_id === saved) || S.memberships[0];
  if (!pick && isSuper()) S.view = "plateforme";
  selectSchool(pick?.school_id || null);
}
function selectSchool(id) {
  S.sid = id; S.families = []; S.students = []; S.receipts = []; S.lines = []; S.members = []; S.audit = []; S.draft = null;
  try { localStorage.setItem("mm-sid", id || ""); } catch (e) {}
  render();
  if (id) loadSchoolData();
}
async function logout(reason) {
  await sb.auth.signOut().catch(() => {});
  Object.assign(S, { phase: "login", user: null, profile: null, memberships: [], sid: null, families: [], students: [], receipts: [], lines: [], members: [], audit: [], draft: null, pay: null });
  closeModal(); render();
  if (reason) toast(reason);
}
// Déconnexion automatique après inactivité
let lastActivity = Date.now();
["click", "keydown", "touchstart", "mousemove"].forEach((ev) => document.addEventListener(ev, () => (lastActivity = Date.now()), { passive: true }));
setInterval(() => { if (S.phase === "app" && Date.now() - lastActivity > (INACTIVITY_MINUTES || 30) * 60000) logout("Session fermée après inactivité."); }, 30000);
window.addEventListener("focus", () => { if (S.phase === "app" && S.sid && Date.now() - S.lastLoad > 60000) loadSchoolData(); });

/* ---------- Rendu ---------- */
function tabs() {
  const t = [];
  if (S.sid) t.push(["tableau", "Tableau des familles"], ["familles", "Familles & tuteurs"], ["eleves", "Élèves"], ["paiements", "Reçus"], ["audit", "Audit des caisses"], ["parametres", "Paramètres"], ["utilisateurs", "Utilisateurs"]);
  if (isSuper()) t.push(["plateforme", "Plateforme"]);
  return t;
}
function render() {
  const app = $("app");
  if (S.phase === "boot") { app.innerHTML = `<div class="gate"><p class="meta">Chargement…</p></div>`; return; }
  if (S.phase === "login") return renderLogin(app);
  if (S.phase === "changepw") return renderChangePw(app);
  const fe = document.activeElement, fid = fe && fe.id, ss = fe && fe.selectionStart, se = fe && fe.selectionEnd;
  const sc = school(), T = tabs();
  if (!T.some(([k]) => k === S.view)) S.view = T[0]?.[0] || "tableau";
  app.innerHTML = `
  <header class="top"><div class="wrap">
    <div class="brand"><small>${sc ? "Année scolaire " + esc(sc.annee || "—") + (sc.adresse ? " · " + esc(sc.adresse) : "") : "Maarifa Mini"}</small>
      <h1>${sc ? esc(sc.name) + (sc.sigle ? ` <span>(${esc(sc.sigle)})</span>` : "") : isSuper() ? "Administration de la plateforme" : "Aucun établissement"}</h1></div>
    <div class="top-actions">
      ${S.memberships.length > 1 ? `<label for="school-sel" class="meta" style="color:inherit">Établissement</label><select id="school-sel">${S.memberships.map((m) => `<option value="${esc(m.school_id)}"${m.school_id === S.sid ? " selected" : ""}>${esc(m.schools.sigle || m.schools.name)}</option>`).join("")}</select>` : ""}
      ${sc ? `<button class="btn ink" data-act="pay">+ Encaisser</button>` : ""}
      <div class="userchip"><b>${esc(S.profile.full_name || S.profile.email)}</b><span>${isSuper() && !sc ? "Super-admin" : esc(ROLE_LABEL[myRole()] || "")}</span></div>
      <button class="btn sm" data-act="account">Mon compte</button>
    </div>
  </div></header>
  <nav class="tabs"><div class="wrap">${T.map(([k, l]) => `<button data-tab="${k}"${S.view === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</div></nav>
  <main><div class="wrap" id="view">${viewBody()}</div></main>`;
  if (fid) { const el = $(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) {} } }
}
function viewBody() {
  if (S.view === "plateforme") return viewPlatform();
  if (!S.sid) return `<div class="section empty"><h3>Aucun établissement</h3><p>Votre compte n'est rattaché à aucun établissement actif. Contactez le Fondateur de votre école.</p></div>`;
  if (S.loadingData && !S.lastLoad) return `<div class="empty">Chargement des données…</div>`;
  return ({ tableau: viewTableau, familles: viewFamilles, eleves: viewEleves, paiements: viewJournal, audit: viewAudit, parametres: viewSettings, utilisateurs: viewUsers }[S.view] || viewTableau)();
}

function renderLogin(app) {
  app.innerHTML = `<div class="gate"><div class="gate-card"><header><small>Gestion scolaire</small><h1>Maarifa Mini</h1></header>
  <form id="login-form" autocomplete="on">
    <div class="field"><label for="lg-email">E-mail</label><input id="lg-email" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="lg-pw">Mot de passe</label><input id="lg-pw" name="password" type="password" autocomplete="current-password" required></div>
    <span class="err" id="lg-err"></span>
    <button class="btn primary" type="submit">Se connecter</button>
    <p class="meta" style="margin:0">Mot de passe oublié ? Demandez au Fondateur de votre école de le réinitialiser.</p>
  </form></div></div>`;
  setTimeout(() => $("lg-email")?.focus(), 30);
}
function renderChangePw(app) {
  app.innerHTML = `<div class="gate"><div class="gate-card"><header><small>Première connexion</small><h1>Choisissez votre mot de passe</h1></header>
  <form id="pw-form">
    <p class="meta" style="margin:0">Le mot de passe provisoire qu'on vous a remis doit être remplacé. Utilisez au moins 8 caractères, avec des chiffres et des lettres.</p>
    <div class="field"><label for="pw-1">Nouveau mot de passe</label><input id="pw-1" name="p1" type="password" autocomplete="new-password" required minlength="8"></div>
    <div class="field"><label for="pw-2">Confirmez</label><input id="pw-2" name="p2" type="password" autocomplete="new-password" required minlength="8"></div>
    <span class="err" id="pw-err"></span>
    <button class="btn primary" type="submit">Enregistrer et continuer</button>
    <button class="btn" type="button" data-act="logout">Se déconnecter</button>
  </form></div></div>`;
}

/* Tableau des familles */
function viewTableau() {
  const PI = paidIndex(), ms = months(), f = S.f, q = f.q.trim().toLowerCase();
  const fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code) || (a.nom || "").localeCompare(b.nom || ""));
  const tot = { stu: 0, dueNow: 0, paid: 0, reste: 0 }, colPaid = {};
  S.students.filter((s) => s.statut !== "Sorti").forEach((st) => { const r = studentSummary(st, PI); tot.stu++; tot.dueNow += r.dueNow; tot.reste += r.reste; });
  S.lines.forEach((p) => (tot.paid += p.amount));
  const rate = tot.dueNow ? Math.round(((tot.dueNow - tot.reste) / tot.dueNow) * 100) : 0;
  let rows = "", shown = 0;
  for (const fam of fams) {
    let sts = studentsOfFam(fam.id, f.sortis);
    if (f.cls) sts = sts.filter((s) => s.classId === f.cls);
    const famHit = !q || [fam.code, fam.nom, fam.tuteurNom, fam.tel, fam.tel2].some((x) => String(x || "").toLowerCase().includes(q));
    if (!famHit) sts = sts.filter((s) => (s.nom || "").toLowerCase().includes(q) || String(s.matricule || "").toLowerCase().includes(q));
    if (!sts.length) continue;
    let fPaid = 0, fReste = 0; sts.forEach((st) => { const r = studentSummary(st, PI); fPaid += r.paid; fReste += r.reste; });
    if (f.late && fReste <= 0) continue;
    shown++;
    rows += `<tr class="fam"><td class="stick"><div class="famhead"><span class="code">${esc(fam.code)}</span><span class="famname">${esc(fam.nom)}</span></div></td>
      <td colspan="${ms.length + 3}"><div class="famhead"><span class="meta">${esc(fam.tuteurNom || "")}${fam.tel ? " · " + esc(fam.tel) : ""}${fam.tel2 ? " / " + esc(fam.tel2) : ""}${fam.dateInscription ? " · inscrite le " + fmtDate(fam.dateInscription) : ""}</span>
      <span class="pill ok">Payé ${F(fPaid)}</span>${fReste > 0 ? `<span class="pill late">Reste échu ${F(fReste)}</span>` : '<span class="pill mute">À jour</span>'}
      <button class="btn sm" data-act="pay" data-fam="${fam.id}">Encaisser</button></div></td></tr>`;
    for (const st of sts) {
      const r = studentSummary(st, PI);
      rows += `<tr><td class="stick"><button class="cell" style="text-align:left;font-family:var(--f-body);font-size:13.5px;padding:0;background:none" data-act="edit-student" data-id="${st.id}">${esc(st.nom)}${st.statut === "Sorti" ? ' <span class="pill mute">Sorti</span>' : ""}</button><div class="meta">${esc(clsOf(st)?.name || "Sans classe")}${st.reduction ? " · réd. " + F(st.reduction) : ""}</div></td>
        <td class="num">${F(monthly(st))}</td>`;
      for (const m of ms) {
        const d = dueFor(st, m.key), p = PI.get(st.id + "|" + m.key) || 0, c = cellState(d, p, m.key);
        colPaid[m.key] = (colPaid[m.key] || 0) + p;
        const txt = c === "na" ? "—" : c === "ok" ? F(p) : c === "part" ? `${F(p)}<small>sur ${F(d)}</small>` : c === "late" ? `0<small>dû ${F(d)}</small>` : F(d);
        rows += `<td><button class="cell ${c}" ${c === "na" || c === "ok" ? "disabled" : ""} data-act="pay" data-fam="${fam.id}" data-st="${st.id}" data-m="${m.key}" title="${esc(st.nom)} · ${esc(m.label || mLabel(m.key))}">${txt}</button></td>`;
      }
      rows += `<td class="num">${F(r.paid)}</td><td class="num" style="color:${r.reste > 0 ? "var(--late)" : "var(--ok)"}">${F(r.reste)}</td></tr>`;
    }
  }
  const head = `<tr><th class="stick">Famille / élève</th><th class="num">Mensualité</th>${ms.map((m) => `<th style="text-align:center">${esc(m.label || mLabel(m.key))}</th>`).join("")}<th class="num">Total payé</th><th class="num">Reste échu</th></tr>`;
  const foot = `<tr><td class="stick">Encaissé par mois</td><td></td>${ms.map((m) => `<td class="num">${F(colPaid[m.key] || 0)}</td>`).join("")}<td class="num">${F(Object.values(colPaid).reduce((a, b) => a + b, 0))}</td><td></td></tr>`;
  return `<div class="stats">
    <div class="stat"><span>Familles</span><b>${S.families.length}</b></div>
    <div class="stat"><span>Élèves actifs</span><b>${tot.stu}</b></div>
    <div class="stat"><span>Attendu à ce jour</span><b>${F(tot.dueNow)}</b></div>
    <div class="stat ok"><span>Encaissé</span><b>${F(tot.paid)}</b></div>
    <div class="stat late"><span>Reste à recouvrer</span><b>${F(tot.reste)}</b></div>
    <div class="stat"><span>Taux de recouvrement</span><b>${rate} %</b></div></div>
  <div class="toolbar">
    <input class="grow" id="f-q" data-f="q" placeholder="Rechercher famille, élève, tuteur, téléphone…" value="${esc(f.q)}">
    <select id="f-cls" data-f="cls"><option value="">Toutes les classes</option>${classes().map((c) => `<option value="${esc(c.id)}"${f.cls === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" id="f-late" data-f="late"${f.late ? " checked" : ""}> En retard seulement</label>
    <label class="chk"><input type="checkbox" id="f-sortis" data-f="sortis"${f.sortis ? " checked" : ""}> Inclure les sortis</label>
    <button class="btn" data-act="reload">Actualiser</button>
    <button class="btn" data-act="export-tableau">Exporter (CSV)</button>
  </div>
  <div class="legend"><span><i style="background:var(--ok-bg);border:1px solid var(--ok)"></i>Payé</span><span><i style="background:var(--part-bg);border:1px solid var(--part)"></i>Partiel</span><span><i style="background:var(--late-bg);border:1px solid var(--late)"></i>Échu non payé</span><span><i style="border:1px dashed var(--up)"></i>À venir</span><span>— Non dû</span><span>Touchez une case pour encaisser.</span></div>
  ${!ms.length ? '<div class="banner">Aucun mois de paiement n\'est activé. Configurez-les dans Paramètres.</div>' : ""}
  ${shown ? `<div class="scroller"><table class="ledger"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>`
    : `<div class="section empty"><h3>${S.families.length ? "Aucune famille ne correspond" : "Aucune famille enregistrée"}</h3><p>${S.families.length ? "Modifiez la recherche ou les filtres." : "Commencez par créer une famille, puis inscrivez ses enfants."}</p>${S.families.length ? "" : '<button class="btn primary" data-act="new-family">Nouvelle famille</button>'}</div>`}`;
}

/* Familles */
function viewFamilles() {
  const PI = paidIndex(), cfg = fcfg("family"), q = S.f.q.trim().toLowerCase();
  const cols = FAMILY_FIELDS.filter((d) => cfg[d.k]?.show && ["tuteurNom", "lien", "tel", "tel2", "quartier", "profession"].includes(d.k));
  let fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code));
  if (q) fams = fams.filter((f) => [f.code, f.nom, f.tuteurNom, f.tel, f.tel2, f.quartier].some((x) => String(x || "").toLowerCase().includes(q)));
  const rows = fams.map((f) => {
    const sts = studentsOfFam(f.id); let reste = 0; sts.forEach((s) => (reste += studentSummary(s, PI).reste));
    return `<tr><td><span class="code">${esc(f.code)}</span></td><td class="wrapok"><b>${esc(f.nom)}</b></td>${cols.map((c) => `<td>${esc(f[c.k] || "")}</td>`).join("")}
    <td class="num">${sts.length}</td><td class="num" style="color:${reste > 0 ? "var(--late)" : "var(--ok)"}">${F(reste)}</td>
    <td><div class="row"><button class="btn sm" data-act="edit-family" data-id="${f.id}">Modifier</button><button class="btn sm" data-act="new-student" data-fam="${f.id}">+ Élève</button></div></td></tr>`;
  }).join("");
  return `<div class="toolbar"><input class="grow" id="f-q2" data-f="q" placeholder="Rechercher une famille, un tuteur, un téléphone…" value="${esc(S.f.q)}"><button class="btn primary" data-act="new-family">+ Nouvelle famille</button></div>
  ${fams.length ? `<div class="scroller"><table class="list"><thead><tr><th>Code</th><th>Famille</th>${cols.map((c) => `<th>${esc(c.l)}</th>`).join("")}<th class="num">Élèves</th><th class="num">Reste échu</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="section empty"><h3>Aucune famille</h3><p>Une famille regroupe les frères et sœurs et porte les coordonnées du tuteur.</p></div>`}`;
}

/* Élèves */
function viewEleves() {
  const PI = paidIndex(), cfg = fcfg("student"), q = S.f.q.trim().toLowerCase();
  const cols = STUDENT_FIELDS.filter((d) => cfg[d.k]?.show && !["observation", "numActe", "ecolePrecedente"].includes(d.k));
  let sts = S.students.filter((s) => S.f.sortis || s.statut !== "Sorti");
  if (S.f.cls) sts = sts.filter((s) => s.classId === S.f.cls);
  if (q) sts = sts.filter((s) => [s.nom, s.matricule, famOf(s)?.nom, famOf(s)?.code].some((x) => String(x || "").toLowerCase().includes(q)));
  sts.sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  const rows = sts.map((s) => {
    const fa = famOf(s), r = studentSummary(s, PI);
    return `<tr><td class="wrapok"><b>${esc(s.nom)}</b>${s.statut === "Sorti" ? ' <span class="pill mute">Sorti</span>' : ""}</td>
    <td>${fa ? `<span class="code">${esc(fa.code)}</span> ${esc(fa.nom)}` : '<span class="meta">—</span>'}</td><td>${esc(clsOf(s)?.name || "—")}</td>
    ${cols.map((c) => `<td>${esc(c.t === "date" ? fmtDate(s[c.k]) : s[c.k] || "")}</td>`).join("")}
    <td class="num">${F(monthly(s))}</td><td class="num" style="color:${r.reste > 0 ? "var(--late)" : "var(--ok)"}">${F(r.reste)}</td>
    <td><button class="btn sm" data-act="edit-student" data-id="${s.id}">Modifier</button></td></tr>`;
  }).join("");
  return `<div class="toolbar"><input class="grow" id="f-q3" data-f="q" placeholder="Rechercher un élève, un matricule, une famille…" value="${esc(S.f.q)}">
    <select id="f-cls2" data-f="cls"><option value="">Toutes les classes</option>${classes().map((c) => `<option value="${esc(c.id)}"${S.f.cls === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" id="f-sortis2" data-f="sortis"${S.f.sortis ? " checked" : ""}> Inclure les sortis</label>
    <button class="btn" data-act="export-eleves">Exporter (CSV)</button>
    <button class="btn primary" data-act="new-student">+ Inscrire un élève</button></div>
  <p class="meta" style="margin:0">${sts.length} élève(s)</p>
  ${sts.length ? `<div class="scroller"><table class="list"><thead><tr><th>Nom & prénoms</th><th>Famille</th><th>Classe</th>${cols.map((c) => `<th>${esc(c.l)}</th>`).join("")}<th class="num">Mensualité</th><th class="num">Reste échu</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="section empty"><h3>Aucun élève</h3><p>${S.families.length ? "Inscrivez un élève et rattachez-le à sa famille." : "Créez d'abord une famille."}</p></div>`}`;
}

/* Reçus */
function filteredReceipts() {
  let rs = S.receipts; const q = S.jf.q.trim().toLowerCase();
  if (S.jf.m) rs = rs.filter((r) => r.date.startsWith(S.jf.m));
  if (S.jf.st) rs = rs.filter((r) => r.status === S.jf.st);
  if (S.jf.by) rs = rs.filter((r) => r.created_by === S.jf.by);
  if (q) rs = rs.filter((r) => [r.number, r.payer, r.family_nom, r.family_code, ...r.payment_lines.map((l) => l.student_nom)].some((x) => String(x || "").toLowerCase().includes(q)));
  return rs;
}
function viewJournal() {
  const rs = filteredReceipts();
  const periods = [...new Set(S.receipts.map((r) => r.date.slice(0, 7)))].sort().reverse();
  const cashiers = [...new Map(S.receipts.map((r) => [r.created_by, r.created_by_name])).entries()];
  const valid = rs.filter((r) => r.status === "valide");
  const total = valid.reduce((a, r) => a + r.total, 0);
  const byMode = {}; valid.forEach((r) => (byMode[r.mode || "—"] = (byMode[r.mode || "—"] || 0) + r.total));
  const rows = rs.map((r) => {
    const names = [...new Set(r.payment_lines.map((l) => l.student_nom))];
    const ms = [...new Set(r.payment_lines.map((l) => l.month))].sort().map(mLabel);
    return `<tr class="${r.status === "annule" ? "cancelled" : ""}"><td>${fmtDate(r.date)}</td><td><b class="mono">${esc(r.number)}</b>${r.status === "annule" ? ' <span class="pill late">Annulé</span>' : ""}</td>
    <td><span class="code">${esc(r.family_code)}</span> ${esc(r.family_nom)}</td>
    <td class="wrapok">${esc(names.join(", "))}<div class="meta">${esc(ms.join(", "))}</div></td><td>${esc(r.mode)}</td>
    <td class="wrapok">${esc(r.created_by_name)}<div class="meta">${fmtDateTime(r.created_at)}</div></td>
    <td class="num"><b class="amt">${F(r.total)}</b></td>
    <td><div class="row"><button class="btn sm" data-act="receipt" data-id="${r.id}">Voir</button>${r.status === "valide" ? `<button class="btn sm" data-act="cancel-receipt" data-id="${r.id}">Annuler</button>` : ""}</div></td></tr>`;
  }).join("");
  return `<div class="stats"><div class="stat ok"><span>Encaissé (reçus valides)</span><b>${F(total)}</b></div><div class="stat"><span>Reçus valides</span><b>${valid.length}</b></div><div class="stat late"><span>Reçus annulés</span><b>${rs.length - valid.length}</b></div>
    ${Object.entries(byMode).map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${F(v)}</b></div>`).join("")}</div>
  <div class="toolbar"><input class="grow" id="j-q" data-jf="q" placeholder="Rechercher un reçu, une famille, un élève, un payeur…" value="${esc(S.jf.q)}">
  <select id="j-m" data-jf="m"><option value="">Toutes les dates</option>${periods.map((p) => `<option value="${p}"${S.jf.m === p ? " selected" : ""}>Payés en ${MOIS_LONG[+p.slice(5) - 1]} ${p.slice(0, 4)}</option>`).join("")}</select>
  <select id="j-by" data-jf="by"><option value="">Tous les caissiers</option>${cashiers.map(([id, n]) => `<option value="${esc(id)}"${S.jf.by === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>
  <select id="j-st" data-jf="st"><option value="">Valides et annulés</option><option value="valide"${S.jf.st === "valide" ? " selected" : ""}>Valides</option><option value="annule"${S.jf.st === "annule" ? " selected" : ""}>Annulés</option></select>
  <button class="btn" data-act="export-journal">Exporter (CSV)</button><button class="btn primary" data-act="pay">+ Encaisser</button></div>
  ${rs.length ? `<div class="scroller"><table class="list"><thead><tr><th>Date</th><th>Reçu</th><th>Famille</th><th>Élèves · mois réglés</th><th>Mode</th><th>Encaissé par</th><th class="num">Montant</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="section empty"><h3>Aucun reçu</h3><p>Les encaissements apparaîtront ici avec leur numéro de reçu et le nom du caissier.</p></div>`}`;
}

/* Audit */
function auditDefaults() { if (!S.af.from) { const d = new Date(); S.af.from = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01"; S.af.to = today(); } }
async function loadAudit() {
  auditDefaults();
  if (S.auditLoading) return; S.auditLoading = true;
  let q = sb.from("audit_log").select("*").eq("school_id", S.sid).gte("at", S.af.from + "T00:00:00").lte("at", S.af.to + "T23:59:59.999").order("at", { ascending: false }).limit(2000);
  if (S.af.by) q = q.eq("actor_id", S.af.by);
  if (S.af.action) q = q.eq("action", S.af.action);
  const { data, error } = await q; S.auditLoading = false;
  if (error) return toast("Audit indisponible : " + errMsg(error));
  S.audit = data; S.auditLoaded = true; if (S.view === "audit") render();
}
function viewAudit() {
  auditDefaults();
  if (!S.auditLoaded) { loadAudit(); return `<div class="empty">Chargement de l'audit…</div>`; }
  const per = {};
  for (const a of S.audit) {
    const p = (per[a.actor_id] ||= { name: a.actor_name || a.actor_email, role: a.actor_role, enc: 0, nEnc: 0, ann: 0, nAnn: 0 });
    if (a.action === "encaissement") { p.enc += a.amount; p.nEnc++; } else { p.ann += a.amount; p.nAnn++; }
  }
  const users = S.members.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email]);
  const rows = S.audit.map((a) => {
    const d = a.details || {};
    const lignes = (d.lignes || []).map((l) => `${esc(l.eleve)} · ${esc(mLabel(l.mois))} · ${F(l.montant)}`).join("<br>");
    return `<tr><td class="mono">${fmtDateTime(a.at)}</td><td class="wrapok"><b>${esc(a.actor_name || a.actor_email)}</b><div class="meta">${esc(ROLE_LABEL[a.actor_role] || a.actor_role)} · ${esc(a.actor_email)}</div></td>
    <td><span class="pill ${a.action === "encaissement" ? "ok" : "late"}">${a.action === "encaissement" ? "Encaissement" : "Annulation"}</span></td>
    <td class="mono">${esc(a.receipt_number || "")}</td><td>${a.family_code ? `<span class="code">${esc(a.family_code)}</span> ` : ""}${esc(a.family_nom || "")}</td>
    <td class="num"><b>${a.action === "annulation" ? "−" : ""}${F(a.amount)}</b></td>
    <td class="wrapok" style="min-width:240px">${a.action === "annulation" ? `<b>Motif :</b> ${esc(d.motif)}<div class="meta">Encaissé à l'origine par ${esc(d.encaisse_par)} le ${fmtDateTime(d.encaisse_le)}</div>` : `<div class="meta">Reçu du ${fmtDate(d.date)} · ${esc(d.mode || "")}${d.verse_par ? " · versé par " + esc(d.verse_par) : ""}</div>`}<div class="meta" style="margin-top:3px">${lignes}</div></td></tr>`;
  }).join("");
  const perRows = Object.values(per).sort((a, b) => b.enc - a.enc).map((p) => `<tr><td><b>${esc(p.name)}</b> <span class="meta">${esc(ROLE_LABEL[p.role] || "")}</span></td><td class="num">${p.nEnc}</td><td class="num">${F(p.enc)}</td><td class="num">${p.nAnn}</td><td class="num">${F(p.ann)}</td><td class="num"><b>${F(p.enc - p.ann)}</b></td></tr>`).join("");
  return `<div class="section"><h2>Audit des caisses</h2><p class="help">Chaque encaissement et chaque annulation est enregistré automatiquement par le serveur, avec l'auteur, l'heure exacte, les montants et le motif. Ces lignes ne peuvent être ni modifiées ni supprimées, même par le Fondateur.</p>
    <div class="row">
      <div class="field"><label for="a-from">Du</label><input class="inp" type="date" id="a-from" data-af="from" value="${S.af.from}"></div>
      <div class="field"><label for="a-to">Au</label><input class="inp" type="date" id="a-to" data-af="to" value="${S.af.to}"></div>
      <div class="field"><label for="a-by">Utilisateur</label><select class="inp" id="a-by" data-af="by"><option value="">Tous</option>${users.map(([id, n]) => `<option value="${esc(id)}"${S.af.by === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
      <div class="field"><label for="a-act">Opération</label><select class="inp" id="a-act" data-af="action"><option value="">Toutes</option><option value="encaissement"${S.af.action === "encaissement" ? " selected" : ""}>Encaissements</option><option value="annulation"${S.af.action === "annulation" ? " selected" : ""}>Annulations</option></select></div>
      <button class="btn" data-act="export-audit">Exporter (CSV)</button>
    </div></div>
  ${perRows ? `<div class="scroller"><table class="list"><thead><tr><th>Par utilisateur (période)</th><th class="num">Encaissements</th><th class="num">Montant encaissé</th><th class="num">Annulations</th><th class="num">Montant annulé</th><th class="num">Net</th></tr></thead><tbody>${perRows}</tbody></table></div>` : ""}
  ${S.audit.length ? `<div class="scroller"><table class="list"><thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Opération</th><th>Reçu</th><th>Famille</th><th class="num">Montant</th><th>Détails</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="section empty"><h3>Aucune opération sur cette période</h3><p>Changez les dates ou les filtres.</p></div>`}`;
}

/* Paramètres */
function ensureDraft() {
  if (!S.draft || S.draft.id !== S.sid) {
    S.draft = JSON.parse(JSON.stringify(school()));
    const df = defaultFields(); S.draft.fields = S.draft.fields || {};
    ["student", "family"].forEach((g) => { S.draft.fields[g] = S.draft.fields[g] || {}; for (const k in df[g]) if (!S.draft.fields[g][k]) S.draft.fields[g][k] = df[g][k]; });
  }
  return S.draft;
}
function viewSettings() {
  const d = ensureDraft(), used = new Set(S.students.map((s) => s.classId));
  const first = d.months[0]?.key || nowKey(), last = d.months[d.months.length - 1]?.key || nowKey();
  const fieldRows = (g, defs) => defs.map((x) => { const c = d.fields[g][x.k]; return `<tr><td>${esc(x.l)}</td><td style="text-align:center"><input type="checkbox" data-fld="${g}" data-k="${x.k}" data-p="show"${c.show ? " checked" : ""} aria-label="Afficher ${esc(x.l)}"></td><td style="text-align:center"><input type="checkbox" data-fld="${g}" data-k="${x.k}" data-p="req"${c.req ? " checked" : ""} aria-label="Obligatoire ${esc(x.l)}"></td></tr>`; }).join("");
  return `<div class="grid2">
  <div class="section"><h2>Établissement</h2>
    <div class="form">
      <div class="field full"><label for="c-name">Nom</label><input id="c-name" data-cfg="name" value="${esc(d.name)}"></div>
      <div class="field"><label for="c-sigle">Sigle</label><input id="c-sigle" data-cfg="sigle" value="${esc(d.sigle || "")}"></div>
      <div class="field"><label for="c-annee">Année scolaire</label><input id="c-annee" data-cfg="annee" value="${esc(d.annee || "")}" placeholder="2026-2027"></div>
      <div class="field"><label for="c-adr">Adresse</label><input id="c-adr" data-cfg="adresse" value="${esc(d.adresse || "")}"></div>
      <div class="field"><label for="c-tel">Téléphone</label><input id="c-tel" data-cfg="tel" value="${esc(d.tel || "")}"></div>
    </div></div>
  <div class="section"><h2>Classes et mensualités</h2><p class="help">Mensualité d'un élève = mensualité de sa classe − sa réduction (fratrie, personnel, bourse…).</p>
    <div class="scroller"><table class="cfgtable"><thead><tr><th>Classe</th><th class="num">Mensualité (FCFA)</th><th></th></tr></thead><tbody>
    ${d.classes.map((c, i) => `<tr><td><input type="text" id="cl-n-${i}" data-cls="name" data-i="${i}" value="${esc(c.name)}" aria-label="Nom de la classe"></td><td><input type="number" min="0" step="500" id="cl-f-${i}" data-cls="fee" data-i="${i}" value="${+c.fee || 0}" aria-label="Mensualité"></td>
    <td><button class="btn sm" data-act="cls-del" data-i="${i}" ${used.has(c.id) ? 'disabled title="Des élèves sont inscrits dans cette classe"' : ""}>Retirer</button></td></tr>`).join("")}
    </tbody></table></div><button class="btn" data-act="cls-add" style="align-self:start">+ Ajouter une classe</button></div>
  <div class="section" style="grid-column:1/-1"><h2>Mois de paiement</h2><p class="help">Choisissez la période puis décochez les mois non payants (vacances, mois offert…). Le libellé est celui affiché dans le tableau.</p>
    <div class="row"><div class="field"><label for="m-a">Premier mois</label><input type="month" id="m-a" value="${first}" class="inp"></div><div class="field"><label for="m-b">Dernier mois</label><input type="month" id="m-b" value="${last}" class="inp"></div><button class="btn" data-act="months-gen">Appliquer la période</button></div>
    <div class="monthgrid">${d.months.map((m, i) => `<label class="${m.on ? "" : "off"}"><input type="checkbox" data-mon="on" data-i="${i}"${m.on ? " checked" : ""} aria-label="Activer ${mLabel(m.key)}"><input type="text" id="mo-${i}" data-mon="label" data-i="${i}" value="${esc(m.label || mLabel(m.key))}"></label>`).join("")}</div></div>
  <div class="section"><h2>Champs de la fiche élève</h2><p class="help">Nom & prénoms, famille et classe sont toujours demandés.</p>
    <div class="scroller"><table class="cfgtable"><thead><tr><th>Champ</th><th style="text-align:center">Afficher</th><th style="text-align:center">Obligatoire</th></tr></thead><tbody>${fieldRows("student", STUDENT_FIELDS)}</tbody></table></div></div>
  <div class="section"><h2>Champs de la fiche famille / tuteur</h2><p class="help">Le code famille (F1, F2…) et le nom de famille sont toujours demandés.</p>
    <div class="scroller"><table class="cfgtable"><thead><tr><th>Champ</th><th style="text-align:center">Afficher</th><th style="text-align:center">Obligatoire</th></tr></thead><tbody>${fieldRows("family", FAMILY_FIELDS)}</tbody></table></div></div>
  </div>
  <div class="row"><button class="btn primary" data-act="save-settings">Enregistrer les paramètres</button><button class="btn" data-act="reset-settings">Annuler les modifications</button></div>`;
}

/* Utilisateurs de l'établissement */
function viewUsers() {
  const F_ = isFondateur();
  const rows = S.members.map((m) => {
    const me = m.user_id === S.user.id;
    return `<tr><td class="wrapok"><b>${esc(m.profiles?.full_name || "")}</b>${me ? ' <span class="pill mute">vous</span>' : ""}<div class="meta">${esc(m.profiles?.email || "")}</div></td>
    <td>${esc(ROLE_LABEL[m.role])}</td><td>${m.active ? '<span class="pill ok">Actif</span>' : '<span class="pill late">Désactivé</span>'}</td><td>${fmtDate(m.created_at)}</td>
    <td>${F_ && !me ? `<div class="row">
      <button class="btn sm" data-act="member-active" data-id="${m.user_id}" data-v="${m.active ? "0" : "1"}">${m.active ? "Désactiver" : "Réactiver"}</button>
      <button class="btn sm" data-act="member-role" data-id="${m.user_id}" data-v="${m.role === "admin" ? "fondateur" : "admin"}">Passer ${m.role === "admin" ? "Fondateur" : "Administrateur"}</button>
      <button class="btn sm" data-act="member-reset" data-id="${m.user_id}">Nouveau mot de passe</button></div>` : ""}</td></tr>`;
  }).join("");
  return `<div class="section"><h2>Utilisateurs de l'établissement</h2>
    <p class="help">Seules ces personnes peuvent ouvrir les données de ${esc(school().name)}. Le Fondateur et l'Administrateur ont les mêmes droits sur les élèves, familles, paiements et paramètres ; seul le Fondateur gère les comptes.</p>
    ${F_ ? `<button class="btn primary" data-act="member-add" style="align-self:start">+ Ajouter un utilisateur</button>` : `<p class="ro-note">Pour ajouter ou retirer un compte, adressez-vous au Fondateur.</p>`}</div>
  <div class="scroller"><table class="list"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Ajouté le</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* Plateforme (super-admin) */
function viewPlatform() {
  const { schools, founders } = S.platform;
  const rows = schools.map((s) => {
    const fo = founders.filter((f) => f.school_id === s.id);
    return `<tr><td class="wrapok"><b>${esc(s.name)}</b>${s.sigle ? ` <span class="meta">(${esc(s.sigle)})</span>` : ""}</td><td>${esc(s.annee)}</td>
    <td class="wrapok">${fo.length ? fo.map((f) => `${esc(f.profiles?.full_name)} <span class="meta">${esc(f.profiles?.email)}</span>${f.active ? "" : ' <span class="pill late">désactivé</span>'}`).join("<br>") : '<span class="pill late">Aucun Fondateur</span>'}</td>
    <td>${fmtDate(s.created_at)}</td><td><button class="btn sm" data-act="add-founder" data-id="${s.id}">+ Fondateur</button></td></tr>`;
  }).join("");
  return `<div class="section"><h2>Établissements de la plateforme</h2>
    <p class="help">En tant que super-admin, vous créez les établissements et leur Fondateur. Vous ne voyez pas leurs élèves, familles ni paiements : seuls leurs membres y ont accès.</p>
    <button class="btn primary" data-act="new-school" style="align-self:start">+ Nouvel établissement</button></div>
  ${schools.length ? `<div class="scroller"><table class="list"><thead><tr><th>Établissement</th><th>Année</th><th>Fondateur(s)</th><th>Créé le</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="section empty"><h3>Aucun établissement</h3><p>Créez le premier établissement et son Fondateur.</p></div>`}`;
}

/* ---------- Fenêtres ---------- */
function inputFor(def, val, req, prefix) {
  const id = prefix + def.k, lab = `<label for="${id}">${esc(def.l)}${req ? " <em>*</em>" : ""}</label>`;
  let inp;
  if (def.t === "select") inp = `<select id="${id}" name="${def.k}"><option value="">—</option>${def.o.map((o) => `<option${val === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  else if (def.t === "textarea") inp = `<textarea id="${id}" name="${def.k}" rows="2">${esc(val || "")}</textarea>`;
  else inp = `<input id="${id}" name="${def.k}" type="${def.t}" value="${esc(val || "")}">`;
  return `<div class="field${def.t === "textarea" ? " full" : ""}">${lab}${inp}${def.hint ? `<span class="meta">${esc(def.hint)}</span>` : ""}</div>`;
}
function modal(html) { const m = $("modal"); m.innerHTML = html; m.hidden = false; const f = m.querySelector("input:not([type=hidden]),select,textarea"); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { const m = $("modal"); m.hidden = true; m.innerHTML = ""; S.pay = null; }
function formErr(msg) { const e = document.querySelector("#modal .err"); if (e && !$("modal").hidden) { e.textContent = msg; return true; } return false; }
const dlg = (title, body, foot, narrow = true, id = "") => `<form class="dlg${narrow ? " narrow" : ""}" ${id ? `id="${id}"` : ""}><div class="dlg-h"><h3>${title}</h3><button type="button" class="x" data-act="close" aria-label="Fermer">×</button></div><div class="dlg-b">${body}</div><div class="dlg-f"><span class="err"></span>${foot}</div></form>`;

function openFamily(id) {
  const f = id ? S.families.find((x) => x.id === id) : { code: nextFamCode(), dateInscription: today() }; const cfg = fcfg("family");
  const sts = id ? studentsOfFam(id, true) : [];
  modal(dlg(id ? "Famille " + esc(f.code) : "Nouvelle famille",
    `<div class="form">
      <div class="field"><label for="fa-code">Code famille <em>*</em></label><input id="fa-code" name="code" value="${esc(f.code || "")}"></div>
      <div class="field"><label for="fa-nom">Nom de la famille <em>*</em></label><input id="fa-nom" name="nom" value="${esc(f.nom || "")}" placeholder="ex. Issak Haroun"></div>
      <div class="subhead">Tuteur et coordonnées</div>
      ${FAMILY_FIELDS.filter((d) => cfg[d.k]?.show).map((d) => inputFor(d, f[d.k], cfg[d.k].req, "fa-")).join("")}
    </div>
    ${id ? `<div><div class="subhead" style="margin-bottom:6px">Élèves de la famille</div>${sts.length ? sts.map((s) => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(s.nom)} · <span class="meta">${esc(clsOf(s)?.name || "")}</span></span><button type="button" class="btn sm" data-act="edit-student" data-id="${s.id}">Ouvrir</button></div>`).join("") : '<p class="meta">Aucun élève.</p>'}</div>` : ""}`,
    `${id && !sts.length ? `<button type="button" class="btn danger" data-act="del-family" data-id="${id}">Supprimer</button>` : ""}${id ? `<button type="button" class="btn" data-act="new-student" data-fam="${id}">+ Inscrire un enfant</button>` : ""}<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button>`,
    true, "fam-form"));
  $("fam-form").dataset.id = id || "";
}
async function saveFamily(form) {
  const id = form.dataset.id, fd = Object.fromEntries(new FormData(form)), cfg = fcfg("family");
  const code = (fd.code || "").trim(), nom = (fd.nom || "").trim();
  if (!code || !nom) return formErr("Le code et le nom de la famille sont obligatoires.");
  if (S.families.some((f) => f.id !== id && f.code.trim().toLowerCase() === code.toLowerCase())) return formErr("Ce code famille existe déjà.");
  const miss = FAMILY_FIELDS.filter((d) => cfg[d.k]?.show && cfg[d.k].req && !String(fd[d.k] || "").trim()).map((d) => d.l);
  if (miss.length) return formErr("Champs obligatoires manquants : " + miss.join(", ") + ".");
  const old = id ? S.families.find((f) => f.id === id) : {};
  const info = {}; FAMILY_FIELDS.forEach((d) => { const v = d.k in fd ? fd[d.k] : old[d.k]; if (v !== undefined && v !== "") info[d.k] = String(v).trim(); });
  const row = { school_id: S.sid, code, nom, info };
  const ok = await run(async () => { const { error } = id ? await sb.from("families").update(row).eq("id", id) : await sb.from("families").insert(row); if (error) throw error; }, "Famille enregistrée");
  if (ok) { closeModal(); loadSchoolData(); }
}
function openStudent(id, famId) {
  if (!S.families.length) { toast("Créez d'abord une famille."); return openFamily(); }
  const s = id ? S.students.find((x) => x.id === id) : { familyId: famId || "", statut: "Actif", dateInscription: today(), reduction: 0 }; const cfg = fcfg("student");
  const hasPay = id && S.receipts.some((r) => r.payment_lines.some((l) => l.student_id === id));
  modal(dlg(id ? esc(s.nom) : "Inscrire un élève",
    `<div class="form">
      <div class="field full"><label for="st-nom">Nom & prénoms <em>*</em></label><input id="st-nom" name="nom" value="${esc(s.nom || "")}"></div>
      <div class="field"><label for="st-fam">Famille <em>*</em></label><select id="st-fam" name="familyId"><option value="">— Choisir —</option>${[...S.families].sort((a, b) => famNum(a.code) - famNum(b.code)).map((f) => `<option value="${f.id}"${s.familyId === f.id ? " selected" : ""}>${esc(f.code)} · ${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="field"><label for="st-cls">Classe <em>*</em></label><select id="st-cls" name="classId"><option value="">— Choisir —</option>${classes().map((c) => `<option value="${esc(c.id)}"${s.classId === c.id ? " selected" : ""}>${esc(c.name)} · ${F(c.fee)}</option>`).join("")}</select></div>
      <div class="field"><label for="st-red">Réduction mensuelle (FCFA)</label><input id="st-red" name="reduction" type="number" min="0" step="500" value="${+s.reduction || 0}"></div>
      <div class="field"><label for="st-statut">Statut</label><select id="st-statut" name="statut"><option${s.statut !== "Sorti" ? " selected" : ""}>Actif</option><option${s.statut === "Sorti" ? " selected" : ""}>Sorti</option></select></div>
      <div class="field"><label for="st-sortie">Date de sortie</label><input id="st-sortie" name="dateSortie" type="date" value="${esc(s.dateSortie || "")}"></div>
      <div class="subhead">État civil et scolarité</div>
      ${STUDENT_FIELDS.filter((d) => cfg[d.k]?.show).map((d) => inputFor(d, s[d.k], cfg[d.k].req, "st-")).join("")}
    </div>${hasPay ? '<p class="meta">Cet élève a des paiements : il ne peut pas être supprimé. Pour un départ, utilisez le statut « Sorti ».</p>' : ""}`,
    `${id && !hasPay ? `<button type="button" class="btn danger" data-act="del-student" data-id="${id}">Supprimer</button>` : ""}<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button>`,
    true, "stu-form"));
  $("stu-form").dataset.id = id || "";
}
async function saveStudent(form) {
  const id = form.dataset.id, fd = Object.fromEntries(new FormData(form)), cfg = fcfg("student");
  const nom = (fd.nom || "").trim();
  if (!nom || !fd.familyId || !fd.classId) return formErr("Le nom, la famille et la classe sont obligatoires.");
  const miss = STUDENT_FIELDS.filter((d) => cfg[d.k]?.show && cfg[d.k].req && !String(fd[d.k] || "").trim()).map((d) => d.l);
  if (miss.length) return formErr("Champs obligatoires manquants : " + miss.join(", ") + ".");
  const old = id ? S.students.find((s) => s.id === id) : {};
  const info = {}; STUDENT_FIELDS.forEach((d) => { if (d.k === "dateInscription") return; const v = d.k in fd ? fd[d.k] : old[d.k]; if (v !== undefined && v !== "") info[d.k] = String(v).trim(); });
  const dIns = "dateInscription" in fd ? fd.dateInscription : old.dateInscription;
  const row = { school_id: S.sid, family_id: fd.familyId, nom, class_id: fd.classId, reduction: Math.max(0, Math.round(+fd.reduction || 0)), statut: fd.statut === "Sorti" ? "Sorti" : "Actif", date_inscription: dIns || null, date_sortie: fd.dateSortie || null, info };
  const ok = await run(async () => { const { error } = id ? await sb.from("students").update(row).eq("id", id) : await sb.from("students").insert(row); if (error) throw error; }, "Élève enregistré");
  if (ok) { closeModal(); loadSchoolData(); }
}

/* Encaissement */
function openPay(famId, stId, mk) {
  const PI = paidIndex(), fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code));
  S.pay = { famId: famId || "", vals: {} };
  if (stId && mk) { const st = S.students.find((s) => s.id === stId); const r = dueFor(st, mk) - (PI.get(stId + "|" + mk) || 0); if (r > 0) S.pay.vals[stId + "|" + mk] = r; }
  const fam = S.families.find((f) => f.id === famId);
  modal(dlg("Encaisser un paiement",
    `<div class="form">
      <div class="field"><label for="p-fam">Famille <em>*</em></label><select id="p-fam" name="familyId"><option value="">— Choisir la famille —</option>${fams.map((f) => `<option value="${f.id}"${f.id === famId ? " selected" : ""}>${esc(f.code)} · ${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="field"><label for="p-date">Date <em>*</em></label><input id="p-date" name="date" type="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label for="p-mode">Mode de paiement</label><select id="p-mode" name="mode">${MODES.map((m) => `<option>${m}</option>`).join("")}</select></div>
      <div class="field"><label for="p-payer">Versé par</label><input id="p-payer" name="payer" value="${esc(fam?.tuteurNom || "")}"></div>
      <div class="field full"><label for="p-note">Note (ex. référence Mobile Money)</label><input id="p-note" name="note"></div>
    </div>
    <p class="meta" style="margin:0">Le numéro de reçu est attribué par le serveur. Cet encaissement sera enregistré à votre nom : ${esc(S.profile.full_name || S.profile.email)}.</p>
    <div id="pay-grid"></div>`,
    `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer le paiement</button>`, false, "pay-form"));
  renderPayGrid();
}
function renderPayGrid() {
  const el = $("pay-grid"); if (!el) return;
  const P = S.pay, PI = paidIndex(), ms = months();
  if (!P.famId) { el.innerHTML = '<p class="meta">Choisissez une famille pour voir les mois à régler.</p>'; return; }
  const sts = studentsOfFam(P.famId);
  if (!sts.length) { el.innerHTML = "<p class=\"meta\">Cette famille n'a aucun élève actif.</p>"; return; }
  let total = 0; Object.values(P.vals).forEach((v) => (total += +v || 0));
  let resteTot = 0;
  const rows = sts.map((st) => `<tr><td class="stick" style="min-width:150px"><b>${esc(st.nom)}</b><div class="meta">${esc(clsOf(st)?.name || "")} · ${F(monthly(st))}/mois</div></td>${ms.map((m) => {
    const d = dueFor(st, m.key), p = PI.get(st.id + "|" + m.key) || 0, r = Math.max(0, d - p), key = st.id + "|" + m.key;
    if (m.key <= nowKey()) resteTot += r;
    if (d <= 0) return '<td class="meta" style="text-align:center">—</td>';
    if (r <= 0) return '<td style="text-align:center"><span class="pill ok">Payé</span></td>';
    return `<td><input type="number" min="0" max="${r}" step="500" id="pv-${st.id}-${m.key}" data-pv="${key}" value="${P.vals[key] || ""}" placeholder="0" aria-label="${esc(st.nom)} ${esc(m.label)}"><div class="due">reste ${F(r)}</div></td>`;
  }).join("")}</tr>`).join("");
  el.innerHTML = `<div class="totalbar"><span>Montant reçu à répartir</span><input type="number" min="0" step="500" id="p-amount" class="inp" style="width:150px" placeholder="ex. 50000"><button type="button" class="btn" data-act="spread">Répartir sur les plus anciens mois</button><button type="button" class="btn" data-act="clear-pv">Vider</button><span class="meta">Reste échu de la famille : ${F(resteTot)}</span></div>
  <div class="scroller paygrid"><table class="ledger"><thead><tr><th class="stick">Élève</th>${ms.map((m) => `<th style="text-align:center">${esc(m.label || mLabel(m.key))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
  <div class="totalbar"><span>Total de ce reçu</span><b id="p-total">${F(total)} FCFA</b></div>`;
}
function spread() {
  const amt = +$("p-amount").value || 0; if (amt <= 0) return toast("Saisissez le montant reçu.");
  const PI = paidIndex(), P = S.pay; P.vals = {}; let left = amt;
  const sts = studentsOfFam(P.famId);
  for (const m of months()) for (const st of sts) { if (left <= 0) break; const r = Math.max(0, dueFor(st, m.key) - (PI.get(st.id + "|" + m.key) || 0)); if (r > 0) { const v = Math.min(r, left); P.vals[st.id + "|" + m.key] = v; left -= v; } }
  renderPayGrid(); $("p-amount").value = amt;
  if (left > 0) toast(F(left) + " FCFA dépassent le total dû : non affectés.");
}
async function savePay(form) {
  const fd = Object.fromEntries(new FormData(form)), P = S.pay;
  if (!fd.familyId) return formErr("Choisissez la famille.");
  if (!fd.date) return formErr("Indiquez la date du paiement.");
  const PI = paidIndex();
  const lines = Object.entries(P.vals).filter(([, v]) => +v > 0);
  if (!lines.length) return formErr("Saisissez au moins un montant dans la grille.");
  for (const [k, v] of lines) { const [sid, mk] = k.split("|"); const st = S.students.find((s) => s.id === sid); const r = dueFor(st, mk) - (PI.get(k) || 0); if (+v > r) return formErr(`Le montant pour ${st.nom} (${mLabel(mk)}) dépasse le reste dû de ${F(r)}.`); }
  const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Enregistrement…";
  const res = await run(async () => {
    const { data, error } = await sb.rpc("create_receipt", { p_school: S.sid, p_family: fd.familyId, p_date: fd.date, p_mode: fd.mode, p_payer: fd.payer || "", p_note: fd.note || "", p_lines: lines.map(([k, v]) => { const [sid, mk] = k.split("|"); return { student_id: sid, month: mk, amount: Math.round(+v) }; }) });
    if (error) throw error; return data;
  });
  if (!res) { btn.disabled = false; btn.textContent = "Enregistrer le paiement"; return; }
  toast(`Reçu ${res.number} enregistré : ${F(res.total)} FCFA`);
  closeModal(); await loadSchoolData(); openReceipt(res.id);
}
function openReceipt(id) {
  const r = S.receipts.find((x) => x.id === id); if (!r) return; const sc = school();
  const lines = r.payment_lines.slice().sort((a, b) => a.month.localeCompare(b.month) || a.student_nom.localeCompare(b.student_nom)).map((l) => `<tr><td>${esc(l.student_nom)}</td><td>${esc(months().find((m) => m.key === l.month)?.label || mLabel(l.month))}</td><td class="num">${F(l.amount)}</td></tr>`).join("");
  modal(`<div class="dlg narrow"><div class="dlg-h"><h3>Reçu ${esc(r.number)}</h3><button type="button" class="x" data-act="close" aria-label="Fermer">×</button></div>
  <div class="dlg-b"><div class="rcpt-head"><div><b>${esc(sc.name)}</b><div class="meta">${esc(sc.adresse || "")} ${sc.tel ? " · " + esc(sc.tel) : ""}<br>Année scolaire ${esc(sc.annee || "")}</div></div>${r.status === "annule" ? '<span class="stamp">Annulé</span>' : ""}</div>
  <div class="form"><div class="field"><label>Date</label><span>${fmtDate(r.date)}</span></div><div class="field"><label>Famille</label><span>${esc(r.family_code + " · " + r.family_nom)}</span></div><div class="field"><label>Versé par</label><span>${esc(r.payer || "—")}</span></div><div class="field"><label>Mode</label><span>${esc(r.mode)}</span></div><div class="field"><label>Encaissé par</label><span>${esc(r.created_by_name)} · ${fmtDateTime(r.created_at)}</span></div></div>
  <div class="scroller"><table class="list"><thead><tr><th>Élève</th><th>Mois</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${lines}</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${F(r.total)} FCFA</td></tr></tfoot></table></div>
  ${r.note ? `<p class="meta">Note : ${esc(r.note)}</p>` : ""}
  ${r.status === "annule" ? `<div class="banner">Annulé le ${fmtDateTime(r.cancelled_at)} par ${esc(r.cancelled_by_name)}. Motif : ${esc(r.cancel_reason)}</div>` : ""}
  <div class="row" style="justify-content:space-between;margin-top:24px"><span class="meta">Signature du parent</span><span class="meta">Cachet et signature de la caisse</span></div></div>
  <div class="dlg-f"><button class="btn" data-act="print">Imprimer</button><button class="btn primary" data-act="close">Fermer</button></div></div>`);
}
function openCancel(id) {
  const r = S.receipts.find((x) => x.id === id); if (!r) return;
  modal(dlg("Annuler le reçu " + esc(r.number),
    `<p style="margin:0">${esc(r.family_code + " · " + r.family_nom)} — <b>${F(r.total)} FCFA</b> encaissés le ${fmtDate(r.date)} par ${esc(r.created_by_name)}.</p>
    <p class="meta" style="margin:0">Le reçu restera visible, barré, et l'annulation sera inscrite dans l'audit à votre nom. Les mois concernés redeviennent impayés.</p>
    <div class="field"><label for="c-reason">Motif de l'annulation <em>*</em></label><textarea id="c-reason" name="reason" rows="3" required minlength="5" placeholder="ex. Erreur de famille, montant saisi deux fois…"></textarea></div>`,
    `<button type="button" class="btn" data-act="close">Retour</button><button class="btn danger" type="submit">Confirmer l'annulation</button>`, true, "cancel-form"));
  $("cancel-form").dataset.id = id;
}
async function saveCancel(form) {
  const reason = (new FormData(form).get("reason") || "").trim();
  if (reason.length < 5) return formErr("Indiquez un motif d'au moins 5 caractères.");
  const ok = await run(async () => { const { error } = await sb.rpc("cancel_receipt", { p_receipt: form.dataset.id, p_reason: reason }); if (error) throw error; }, "Reçu annulé");
  if (ok) { closeModal(); S.auditLoaded = false; loadSchoolData(); }
}

/* Comptes */
function openAccount() {
  modal(dlg("Mon compte",
    `<p style="margin:0"><b>${esc(S.profile.full_name)}</b><br><span class="meta">${esc(S.profile.email)}</span></p>
    <div class="subhead">Changer mon mot de passe</div>
    <div class="form"><div class="field"><label for="ac-1">Nouveau mot de passe</label><input id="ac-1" name="p1" type="password" autocomplete="new-password" minlength="8"></div>
    <div class="field"><label for="ac-2">Confirmez</label><input id="ac-2" name="p2" type="password" autocomplete="new-password" minlength="8"></div></div>`,
    `<button type="button" class="btn danger" data-act="logout">Se déconnecter</button><button type="button" class="btn" data-act="close">Fermer</button><button class="btn primary" type="submit">Changer le mot de passe</button>`, true, "account-form"));
}
async function changePassword(p1, p2, errEl) {
  const show = (m) => { if (errEl) errEl.textContent = m; else formErr(m); };
  if ((p1 || "").length < 8) return show("Au moins 8 caractères."), false;
  if (!/\d/.test(p1) || !/[a-zA-Z]/.test(p1)) return show("Mélangez des lettres et des chiffres."), false;
  if (p1 !== p2) return show("Les deux mots de passe sont différents."), false;
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) return show(/same|different from the old/i.test(error.message) ? "Choisissez un mot de passe différent de l'ancien." : errMsg(error)), false;
  await sb.rpc("mark_password_changed");
  return true;
}
function memberForm(title, schoolId, roleChoice) {
  const pw = genPassword();
  modal(dlg(title,
    `<div class="form">
      <div class="field"><label for="mb-name">Nom complet <em>*</em></label><input id="mb-name" name="full_name" required></div>
      <div class="field"><label for="mb-email">E-mail <em>*</em></label><input id="mb-email" name="email" type="email" required></div>
      ${roleChoice ? `<div class="field"><label for="mb-role">Rôle</label><select id="mb-role" name="role"><option value="admin">Administrateur</option><option value="fondateur">Fondateur</option></select></div>` : '<input type="hidden" name="role" value="fondateur">'}
      <div class="field full"><label for="mb-pw">Mot de passe provisoire</label><input id="mb-pw" name="password" value="${pw}" class="mono"><span class="meta">Communiquez-le en main propre. La personne devra le changer à sa première connexion. Si elle a déjà un compte (autre école), son mot de passe actuel reste valable.</span></div>
    </div>`,
    `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Créer l'accès</button>`, true, "member-form"));
  $("member-form").dataset.school = schoolId;
}
function openNewSchool() {
  const y = new Date().getFullYear(), m = new Date().getMonth() + 1, start = m >= 7 ? y : y - 1;
  modal(dlg("Nouvel établissement",
    `<div class="form">
      <div class="field full"><label for="ns-name">Nom de l'établissement <em>*</em></label><input id="ns-name" name="name" required></div>
      <div class="field"><label for="ns-sigle">Sigle</label><input id="ns-sigle" name="sigle"></div>
      <div class="field"><label for="ns-annee">Année scolaire</label><input id="ns-annee" name="annee" value="${start}-${start + 1}"></div>
      <div class="field"><label for="ns-a">Premier mois payant</label><input id="ns-a" name="from" type="month" value="${start}-10"></div>
      <div class="field"><label for="ns-b">Dernier mois payant</label><input id="ns-b" name="to" type="month" value="${start + 1}-06"></div>
      <div class="field"><label for="ns-fee">Mensualité par défaut (FCFA)</label><input id="ns-fee" name="fee" type="number" min="0" step="500" value="25000"></div>
      <div class="subhead">Fondateur</div>
      <div class="field"><label for="ns-fn">Nom complet <em>*</em></label><input id="ns-fn" name="f_name" required></div>
      <div class="field"><label for="ns-fe">E-mail <em>*</em></label><input id="ns-fe" name="f_email" type="email" required></div>
      <div class="field full"><label for="ns-fp">Mot de passe provisoire</label><input id="ns-fp" name="f_password" class="mono" value="${genPassword()}"><span class="meta">À remettre au Fondateur ; il le changera à sa première connexion.</span></div>
    </div>`,
    `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Créer l'établissement</button>`, true, "school-form"));
}
function showPassword(title, who, pw) {
  modal(`<div class="dlg narrow"><div class="dlg-h"><h3>${title}</h3><button type="button" class="x" data-act="close" aria-label="Fermer">×</button></div>
  <div class="dlg-b"><p style="margin:0">Mot de passe provisoire de <b>${esc(who)}</b> :</p><div class="pwbox" id="pw-show">${esc(pw)}</div>
  <p class="meta" style="margin:0">Notez-le maintenant : il ne sera plus affiché. La personne devra le changer à sa prochaine connexion.</p></div>
  <div class="dlg-f"><button class="btn" data-act="copy-pw">Copier</button><button class="btn primary" data-act="close">J'ai noté le mot de passe</button></div></div>`);
}

/* ---------- Exports CSV ---------- */
function saveCsv(name, rows) {
  const data = "﻿" + rows.map((r) => r.map((c) => { c = String(c ?? ""); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const tag = () => (school()?.sigle || "ecole").replace(/[^\w-]+/g, "_") + "_" + today();
function exportTableau() {
  const PI = paidIndex(), ms = months(), rows = [["Code famille", "Famille", "Tuteur", "Téléphone", "Élève", "Classe", "Mensualité", ...ms.map((m) => m.label || mLabel(m.key)), "Total payé", "Reste échu"]];
  [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code)).forEach((f) => studentsOfFam(f.id, S.f.sortis).forEach((st) => { const r = studentSummary(st, PI); rows.push([f.code, f.nom, f.tuteurNom, f.tel, st.nom, clsOf(st)?.name, monthly(st), ...ms.map((m) => (dueFor(st, m.key) ? PI.get(st.id + "|" + m.key) || 0 : "-")), r.paid, r.reste]); }));
  saveCsv(`tableau_${tag()}.csv`, rows);
}
function exportEleves() {
  const cfg = fcfg("student"), defs = STUDENT_FIELDS.filter((d) => cfg[d.k]?.show);
  const rows = [["Nom & prénoms", "Code famille", "Famille", "Classe", "Statut", "Réduction", ...defs.map((d) => d.l)]];
  S.students.forEach((s) => { const f = famOf(s); rows.push([s.nom, f?.code, f?.nom, clsOf(s)?.name, s.statut, s.reduction, ...defs.map((d) => s[d.k])]); });
  saveCsv(`eleves_${tag()}.csv`, rows);
}
function exportJournal() {
  const rows = [["Date", "Reçu", "Statut", "Code famille", "Famille", "Élève", "Mois", "Montant", "Mode", "Versé par", "Encaissé par", "Encaissé le", "Annulé par", "Motif d'annulation"]];
  filteredReceipts().slice().reverse().forEach((r) => r.payment_lines.forEach((l) => rows.push([r.date, r.number, r.status === "annule" ? "Annulé" : "Valide", r.family_code, r.family_nom, l.student_nom, mLabel(l.month), l.amount, r.mode, r.payer, r.created_by_name, fmtDateTime(r.created_at), r.cancelled_by_name || "", r.cancel_reason || ""])));
  saveCsv(`recus_${tag()}.csv`, rows);
}
function exportAudit() {
  const rows = [["Date et heure", "Utilisateur", "E-mail", "Rôle", "Opération", "Reçu", "Code famille", "Famille", "Montant", "Motif", "Détail"]];
  S.audit.forEach((a) => rows.push([fmtDateTime(a.at), a.actor_name, a.actor_email, ROLE_LABEL[a.actor_role] || a.actor_role, a.action, a.receipt_number, a.family_code, a.family_nom, a.action === "annulation" ? -a.amount : a.amount, a.details?.motif || "", (a.details?.lignes || []).map((l) => `${l.eleve} ${l.mois} ${l.montant}`).join(" | ")]));
  saveCsv(`audit_${tag()}.csv`, rows);
}

/* ---------- Événements ---------- */
let toastT;
function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 4000); }
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
  if (t.dataset.tab) { S.view = t.dataset.tab; try { localStorage.setItem("mm-view", S.view); } catch (e) {} if (S.view === "audit") S.auditLoaded = false; render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "close") { e.preventDefault(); return closeModal(); }
  if (a === "logout") return logout();
  if (a === "account") return openAccount();
  if (a === "reload") return loadSchoolData();
  if (a === "print") return window.print();
  if (a === "copy-pw") { const txt = $("pw-show").textContent; try { await navigator.clipboard.writeText(txt); toast("Copié"); } catch (err) { const r = document.createRange(); r.selectNodeContents($("pw-show")); getSelection().removeAllRanges(); getSelection().addRange(r); } return; }
  if (a === "pay") { if (!school()) return; return openPay(t.dataset.fam, t.dataset.st, t.dataset.m); }
  if (a === "new-family") return openFamily();
  if (a === "edit-family") return openFamily(id);
  if (a === "new-student") return openStudent(null, t.dataset.fam);
  if (a === "edit-student") return openStudent(id);
  if (a === "spread") return spread();
  if (a === "clear-pv") { S.pay.vals = {}; return renderPayGrid(); }
  if (a === "receipt") return openReceipt(id);
  if (a === "cancel-receipt") return openCancel(id);
  if (a === "export-tableau") return exportTableau();
  if (a === "export-eleves") return exportEleves();
  if (a === "export-journal") return exportJournal();
  if (a === "export-audit") return exportAudit();
  if (a === "del-family") { if (t.dataset.sure) { const ok = await run(async () => { const { error } = await sb.from("families").delete().eq("id", id); if (error) throw error; }, "Famille supprimée"); if (ok) { closeModal(); loadSchoolData(); } return; } t.dataset.sure = "1"; t.textContent = "Confirmer la suppression"; return; }
  if (a === "del-student") { if (t.dataset.sure) { const ok = await run(async () => { const { error } = await sb.from("students").delete().eq("id", id); if (error) throw error; }, "Élève supprimé"); if (ok) { closeModal(); loadSchoolData(); } return; } t.dataset.sure = "1"; t.textContent = "Confirmer la suppression"; return; }
  if (a === "cls-add") { S.draft.classes.push({ id: newId().slice(0, 8), name: "Nouvelle classe", fee: S.draft.classes[0]?.fee || 0 }); return render(); }
  if (a === "cls-del") { S.draft.classes.splice(+t.dataset.i, 1); return render(); }
  if (a === "months-gen") { const A = $("m-a").value, B = $("m-b").value; if (!A || !B || A > B) return toast("Période invalide."); const old = Object.fromEntries(S.draft.months.map((m) => [m.key, m])); S.draft.months = monthRange(A, B).map((k) => old[k] || { key: k, label: mLabel(k), on: true }); return render(); }
  if (a === "reset-settings") { S.draft = null; render(); return toast("Modifications annulées"); }
  if (a === "save-settings") {
    const d = S.draft; if (!d.name.trim()) return toast("Le nom de l'établissement est obligatoire."); if (d.classes.some((c) => !c.name.trim())) return toast("Chaque classe doit avoir un nom.");
    const ok = await run(async () => { const { error } = await sb.from("schools").update({ name: d.name.trim(), sigle: d.sigle || "", annee: d.annee || "", adresse: d.adresse || "", tel: d.tel || "", classes: d.classes, months: d.months, fields: d.fields }).eq("id", S.sid); if (error) throw error; }, "Paramètres enregistrés");
    if (ok) { S.draft = null; await loadMemberships(); render(); }
    return;
  }
  if (a === "member-add") return memberForm("Ajouter un utilisateur", S.sid, true);
  if (a === "add-founder") return memberForm("Ajouter un Fondateur", id, false);
  if (a === "new-school") return openNewSchool();
  if (a === "member-active") { const ok = await run(() => callAdmin({ action: "set_active", school_id: S.sid, user_id: id, active: t.dataset.v === "1" }), t.dataset.v === "1" ? "Compte réactivé" : "Compte désactivé"); if (ok) loadSchoolData(); return; }
  if (a === "member-role") { const ok = await run(() => callAdmin({ action: "set_role", school_id: S.sid, user_id: id, role: t.dataset.v }), "Rôle modifié"); if (ok) loadSchoolData(); return; }
  if (a === "member-reset") { const pw = genPassword(); const m = S.members.find((x) => x.user_id === id); const ok = await run(() => callAdmin({ action: "reset_password", school_id: S.sid, user_id: id, password: pw })); if (ok) showPassword("Mot de passe réinitialisé", m?.profiles?.full_name || "", pw); return; }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target;
  if (f.id === "login-form") {
    const fd = Object.fromEntries(new FormData(f)), btn = f.querySelector("[type=submit]"); btn.disabled = true; $("lg-err").textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: fd.email.trim(), password: fd.password });
    btn.disabled = false;
    if (error) { $("lg-err").textContent = /invalid/i.test(error.message) ? "E-mail ou mot de passe incorrect." : errMsg(error); return; }
    lastActivity = Date.now(); return afterLogin(data.user);
  }
  if (f.id === "pw-form") { const fd = Object.fromEntries(new FormData(f)); if (await changePassword(fd.p1, fd.p2, $("pw-err"))) { S.profile.must_change_password = false; toast("Mot de passe enregistré"); enterApp(); } return; }
  if (f.id === "account-form") { const fd = Object.fromEntries(new FormData(f)); if (await changePassword(fd.p1, fd.p2)) { closeModal(); toast("Mot de passe changé"); } return; }
  if (f.id === "fam-form") return saveFamily(f);
  if (f.id === "stu-form") return saveStudent(f);
  if (f.id === "pay-form") return savePay(f);
  if (f.id === "cancel-form") return saveCancel(f);
  if (f.id === "member-form") {
    const fd = Object.fromEntries(new FormData(f));
    if (!fd.full_name.trim() || !fd.email.trim()) return formErr("Nom et e-mail obligatoires.");
    const res = await run(() => callAdmin({ action: "add_member", school_id: f.dataset.school, email: fd.email, full_name: fd.full_name, role: fd.role, password: fd.password }));
    if (!res) return;
    if (res.user_created) showPassword("Accès créé", fd.full_name, fd.password); else { closeModal(); toast("Compte existant rattaché : son mot de passe actuel reste valable."); }
    if (S.view === "plateforme") { await loadPlatform(); render(); } else loadSchoolData();
    return;
  }
  if (f.id === "school-form") {
    const fd = Object.fromEntries(new FormData(f));
    const res = await run(() => callAdmin({ action: "create_school", school: { name: fd.name, sigle: fd.sigle, annee: fd.annee, from: fd.from, to: fd.to, fee: fd.fee }, fondateur: { full_name: fd.f_name, email: fd.f_email, password: fd.f_password } }));
    if (!res) return;
    await loadPlatform(); render();
    if (res.user_created) showPassword("Établissement créé", fd.f_name, fd.f_password); else { closeModal(); toast("Établissement créé ; le Fondateur avait déjà un compte."); }
  }
});
document.addEventListener("input", (e) => {
  const t = e.target, ds = t.dataset;
  if (ds.f) { S.f[ds.f] = t.type === "checkbox" ? t.checked : t.value; return render(); }
  if (ds.jf) { S.jf[ds.jf] = t.value; return render(); }
  if (ds.cfg) { S.draft[ds.cfg] = t.value; return; }
  if (ds.cls) { S.draft.classes[+ds.i][ds.cls] = ds.cls === "fee" ? Math.max(0, +t.value || 0) : t.value; return; }
  if (ds.mon === "label") { S.draft.months[+ds.i].label = t.value; return; }
  if (ds.pv) { S.pay.vals[ds.pv] = Math.max(0, +t.value || 0); let tot = 0; Object.values(S.pay.vals).forEach((v) => (tot += +v || 0)); const el = $("p-total"); if (el) el.textContent = F(tot) + " FCFA"; }
});
document.addEventListener("change", (e) => {
  const t = e.target, ds = t.dataset;
  if (t.id === "school-sel") return selectSchool(t.value);
  if (t.id === "p-fam") { S.pay.famId = t.value; S.pay.vals = {}; const f = S.families.find((x) => x.id === t.value); const p = $("p-payer"); if (p && f) p.value = f.tuteurNom || ""; return renderPayGrid(); }
  if (ds.af) { S.af[ds.af] = t.value; S.auditLoaded = false; return render(); }
  if (ds.mon === "on") { S.draft.months[+ds.i].on = t.checked; return render(); }
  if (ds.fld) { const c = S.draft.fields[ds.fld][ds.k]; c[ds.p] = t.checked; if (ds.p === "req" && t.checked) c.show = true; if (ds.p === "show" && !t.checked) c.req = false; return render(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });
$("modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") closeModal(); });

/* ---------- Démarrage ---------- */
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.phase !== "login") { Object.assign(S, { phase: "login" }); render(); } });
(async () => {
  if (SUPABASE_URL.includes("VOTRE-PROJET")) { $("app").innerHTML = `<div class="gate"><div class="gate-card"><header><small>Configuration</small><h1>Maarifa Mini</h1></header><form><p>Renseignez l'adresse et la clé publique de votre projet Supabase dans <code>config.js</code> (voir le README).</p></form></div></div>`; return; }
  const { data } = await sb.auth.getSession();
  if (data.session?.user) await afterLogin(data.session.user); else { S.phase = "login"; render(); }
})();
