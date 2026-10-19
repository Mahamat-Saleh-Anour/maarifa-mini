// Maarifa Mini — application (navigateur). Toute la sécurité est appliquée
// côté serveur par Supabase (règles RLS + fonctions) : ce fichier ne fait
// qu'afficher les données et appeler ces fonctions.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, INACTIVITY_MINUTES } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "maarifa-mini-auth" },
});

/* =====================================================================
   Constantes
   ===================================================================== */
const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MODES = ["Espèces", "Airtel Money", "Moov Money", "Chèque", "Virement bancaire"];
const ROLE_LABEL = { fondateur: "Fondateur", admin: "Administrateur" };
const PAGE_SIZE = 25;
const STUDENT_FIELDS = [
  { k: "matricule", l: "Matricule", t: "text" },
  { k: "sexe", l: "Sexe", t: "select", o: ["M", "F"] },
  { k: "dateNaissance", l: "Date de naissance", t: "date" },
  { k: "lieuNaissance", l: "Lieu de naissance", t: "text" },
  { k: "nationalite", l: "Nationalité", t: "text" },
  { k: "numActe", l: "N° d'acte de naissance", t: "text" },
  { k: "dateInscription", l: "Date d'inscription", t: "date", hint: "Les mensualités commencent au mois d'inscription." },
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

/* Icônes (traits 24×24) */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  ledger: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16"/>',
  family: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.8.2 5 2.6 5 5.8"/>',
  student: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
};
const icon = (n, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* =====================================================================
   Outils
   ===================================================================== */
function monthRange(a, b) { const out = []; let [y, m] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number); let g = 0; while ((y < y2 || (y === y2 && m <= m2)) && g++ < 36) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } } return out; }
const mLabel = (k) => { const [y, m] = k.split("-"); return MOIS[+m - 1] + " " + y.slice(2); };
const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const nowKey = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const today = () => isoDay(new Date());
const F = (n) => Math.round(+n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const FC = (n) => { n = +n || 0; const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M"; if (a >= 1e3) return Math.round(n / 1e3) + " k"; return String(Math.round(n)); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const fmtDateTime = (t) => { if (!t) return ""; const d = new Date(t); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " à " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const famNum = (c) => parseInt(String(c || "").replace(/\D/g, "")) || 0;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const initials = (s) => String(s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
function genPassword() { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = new Uint32Array(10); crypto.getRandomValues(r); return Array.from(r, (x) => a[x % a.length]).join(""); }
function pwScore(p) { let s = 0; if (!p) return 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p)) s++; else if (/\d/.test(p)) s += 0.5; return Math.min(4, Math.max(1, Math.round(s))); }
const $ = (id) => document.getElementById(id);
const greet = () => { const h = new Date().getHours(); return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"; };

/* =====================================================================
   État
   ===================================================================== */
const S = {
  phase: "boot", // boot | login | changepw | app
  user: null, profile: null, memberships: [], sid: null,
  families: [], students: [], studentsAll: [], receipts: [], lines: [], linesAll: [], members: [], audit: [], loadingData: false, lastLoad: 0,
  years: [], yid: null, enrollments: [],
  platform: { schools: [], founders: [] },
  view: "dashboard", navOpen: false, menuOpen: false, theme: "system",
  f: { q: "", cls: "", late: false, sortis: false }, jf: { q: "", m: "", st: "", by: "" },
  af: { from: "", to: "", by: "", action: "" }, draft: null, pay: null, pages: {}, settingsTab: "etab",
};
try { S.view = localStorage.getItem("mm-view") || S.view; S.theme = localStorage.getItem("mm-theme") || "system"; } catch (e) {}
applyTheme();

const current = () => S.memberships.find((m) => m.school_id === S.sid);
const school = () => current()?.schools;
const myRole = () => current()?.role;
const isFondateur = () => myRole() === "fondateur";
const isSuper = () => !!S.profile?.is_superadmin;
const year = () => S.years.find((y) => y.id === S.yid);
const months = () => (year()?.months || []).filter((m) => m.on);
const classes = () => year()?.classes || [];
const yearReceipts = () => S.receipts.filter((r) => r.year_id === S.yid);
const lineLabel = (l) => ((l.kind || l.type) === "inscription" || (!l.month && !l.mois) ? "Inscription" : (months().find((m) => m.key === (l.month || l.mois))?.label || mLabel(l.month || l.mois)));
const fcfg = (g) => { const d = defaultFields()[g], c = (school()?.fields || {})[g] || {}; return Object.fromEntries(Object.keys(d).map((k) => [k, c[k] || d[k]])); };
const clsOf = (st) => classes().find((c) => c.id === st.classId);
const famOf = (st) => S.families.find((f) => f.id === st.familyId);
const monthly = (st) => Math.max(0, (+clsOf(st)?.fee || 0) - (+st.reduction || 0));
function dueFor(st, k) {
  if (!months().some((m) => m.key === k)) return 0;
  if (st.dateInscription && k < st.dateInscription.slice(0, 7)) return 0;
  if (st.statut === "Abandon" && st.dateSortie && k > st.dateSortie.slice(0, 7)) return 0;
  return monthly(st);
}
const dueIns = (st) => Math.max(0, (+clsOf(st)?.ins_fee || 0) - (+st.reductionIns || 0));
function paidIndex() { const m = new Map(); for (const p of S.lines) { const key = p.studentId + "|" + (p.kind === "inscription" ? "INS" : p.month); m.set(key, (m.get(key) || 0) + p.amount); } return m; }
function cellState(due, paid, k) { if (due <= 0 && paid <= 0) return "na"; if (paid >= due && due > 0) return "ok"; if (paid > 0) return "part"; return k <= nowKey() ? "late" : "up"; }
function studentSummary(st, PI) {
  const insDue = dueIns(st), insPaid = PI.get(st.id + "|INS") || 0, insReste = Math.max(0, insDue - insPaid);
  let paid = insPaid, dueNow = insDue, reste = insReste;
  for (const m of months()) { const d = dueFor(st, m.key), p = PI.get(st.id + "|" + m.key) || 0; paid += p; if (m.key <= nowKey()) { dueNow += d; reste += Math.max(0, d - p); } }
  return { paid, dueNow, reste, insDue, insPaid, insReste };
}
const studentsOfFam = (fid, all) => S.students.filter((s) => s.familyId === fid && (all || s.statut !== "Abandon")).sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
const nextFamCode = () => { let mx = 0; S.families.forEach((f) => (mx = Math.max(mx, famNum(f.code)))); return "F" + (mx + 1); };
function familyArrears(PI) {
  return S.families.map((f) => { let reste = 0; studentsOfFam(f.id).forEach((s) => (reste += studentSummary(s, PI).reste)); return { f, reste }; }).filter((x) => x.reste > 0).sort((a, b) => b.reste - a.reste);
}

/* =====================================================================
   Thème
   ===================================================================== */
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === "light" || S.theme === "dark") r.setAttribute("data-theme", S.theme); else r.removeAttribute("data-theme");
}
function setTheme(t) { S.theme = t; try { localStorage.setItem("mm-theme", t); } catch (e) {} applyTheme(); render(); }
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (S.theme === "system" && S.view === "dashboard") render(); });

/* =====================================================================
   Accès aux données
   ===================================================================== */
function errMsg(e) {
  const m = e?.message || String(e || "");
  if (e?.code === "23505") return "Cette valeur existe déjà (code famille en double ?).";
  if (e?.code === "23503") return "Impossible : cet enregistrement est lié à des paiements ou à des élèves.";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m)) return "Action non autorisée pour votre compte.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Connexion Internet indisponible. Réessayez.";
  return m || "Erreur inconnue.";
}
async function fetchAll(make) {
  const out = []; let from = 0;
  for (;;) { const { data, error } = await make().range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; from += 1000; }
  return out;
}
const mapFamily = (r) => ({ ...(r.info || {}), id: r.id, code: r.code, nom: r.nom });
const mapStudent = (r) => ({ ...(r.info || {}), id: r.id, familyId: r.family_id, nom: r.nom });
function rebuildYear() {
  const byId = new Map(S.studentsAll.map((s) => [s.id, s]));
  S.students = S.enrollments.filter((e) => e.year_id === S.yid && byId.has(e.student_id)).map((e) => ({ ...byId.get(e.student_id), enrId: e.id, classId: e.class_id, reduction: e.reduction || 0, reductionIns: e.reduction_ins || 0, statut: e.statut, dateInscription: e.date_inscription || "", dateSortie: e.date_sortie || "", motifSortie: e.motif_sortie || "" }));
  S.lines = S.linesAll.filter((l) => l.yearId === S.yid);
  S.draft = null;
}
function selectYear(id) {
  S.yid = id; try { localStorage.setItem("mm-yid-" + S.sid, id); } catch (e) {}
  rebuildYear(); S.pages = {}; S.auditLoaded = false; S._chartsDrawn = false; render();
}

async function loadSchoolData() {
  if (!S.sid) return;
  S.loadingData = true; render();
  try {
    const sid = S.sid;
    const [fams, sts, recs, mems, yrs, enr] = await Promise.all([
      fetchAll(() => sb.from("families").select("*").eq("school_id", sid).order("created_at")),
      fetchAll(() => sb.from("students").select("*").eq("school_id", sid).order("created_at")),
      fetchAll(() => sb.from("receipts").select("*, payment_lines(student_id,student_nom,kind,month,amount)").eq("school_id", sid).order("date", { ascending: false }).order("created_at", { ascending: false })),
      fetchAll(() => sb.from("memberships").select("user_id,role,active,created_at,profiles(full_name,email)").eq("school_id", sid).order("created_at")),
      fetchAll(() => sb.from("school_years").select("*").eq("school_id", sid).order("label")),
      fetchAll(() => sb.from("enrollments").select("*").eq("school_id", sid).order("created_at")),
    ]);
    if (sid !== S.sid) return;
    S.families = fams.map(mapFamily);
    S.studentsAll = sts.map(mapStudent);
    S.receipts = recs;
    S.years = yrs; S.enrollments = enr;
    S.linesAll = recs.filter((r) => r.status === "valide").flatMap((r) => r.payment_lines.map((l) => ({ studentId: l.student_id, month: l.month, kind: l.kind || "mensualite", amount: l.amount, receiptId: r.id, yearId: r.year_id })));
    if (!S.years.some((y) => y.id === S.yid)) { let saved = ""; try { saved = localStorage.getItem("mm-yid-" + sid) || ""; } catch (e) {} S.yid = (S.years.find((y) => y.id === saved) || S.years.find((y) => y.is_current) || S.years.at(-1))?.id || null; }
    const keepDraft = S.draft; rebuildYear(); if (keepDraft && keepDraft.yid === S.yid) S.draft = keepDraft;
    S.members = mems;
    S.lastLoad = Date.now();
  } catch (e) { toast("Chargement impossible : " + errMsg(e), "err"); }
  S.loadingData = false; render();
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
  try { const r = await fn(); if (ok) toast(ok, "ok"); return r ?? true; }
  catch (e) { console.error(e); if (!formErr(errMsg(e))) toast(errMsg(e), "err"); return false; }
}

/* =====================================================================
   Session
   ===================================================================== */
async function afterLogin(user) {
  S.user = user;
  const { data: prof, error } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (error || !prof) { toast("Profil introuvable : contactez l'administrateur.", "err"); await sb.auth.signOut(); S.phase = "login"; return render(); }
  S.profile = prof;
  if (prof.must_change_password) { S.phase = "changepw"; return render(); }
  await enterApp();
}
async function enterApp() {
  try { await loadMemberships(); await loadPlatform(); } catch (e) { toast(errMsg(e), "err"); }
  S.phase = "app";
  let saved = ""; try { saved = localStorage.getItem("mm-sid") || ""; } catch (e) {}
  const pick = S.memberships.find((m) => m.school_id === saved) || S.memberships[0];
  if (!pick && isSuper()) S.view = "plateforme";
  selectSchool(pick?.school_id || null);
}
function selectSchool(id) {
  Object.assign(S, { sid: id, families: [], students: [], studentsAll: [], receipts: [], lines: [], linesAll: [], members: [], audit: [], auditLoaded: false, draft: null, pages: {}, lastLoad: 0, years: [], yid: null, enrollments: [] });
  try { localStorage.setItem("mm-sid", id || ""); } catch (e) {}
  render();
  if (id) loadSchoolData();
}
async function logout(reason) {
  await sb.auth.signOut().catch(() => {});
  Object.assign(S, { phase: "login", user: null, profile: null, memberships: [], sid: null, families: [], students: [], receipts: [], lines: [], members: [], audit: [], draft: null, pay: null, menuOpen: false, navOpen: false });
  closeModal(); render();
  if (reason) toast(reason);
}
let lastActivity = Date.now();
["click", "keydown", "touchstart", "mousemove"].forEach((ev) => document.addEventListener(ev, () => (lastActivity = Date.now()), { passive: true }));
setInterval(() => { if (S.phase === "app" && Date.now() - lastActivity > (INACTIVITY_MINUTES || 30) * 60000) logout("Session fermée après inactivité."); }, 30000);
window.addEventListener("focus", () => { if (S.phase === "app" && S.sid && Date.now() - S.lastLoad > 60000) loadSchoolData(); });

/* =====================================================================
   Navigation
   ===================================================================== */
function navItems() {
  const g = [];
  if (S.sid) {
    g.push(["Pilotage", [["dashboard", "Tableau de bord", "dashboard"], ["tableau", "Registre", "ledger"], ["rapports", "Rapports annuels", "trend"]]]);
    g.push(["Scolarité", [["familles", "Familles & tuteurs", "family"], ["eleves", "Élèves", "student"]]]);
    g.push(["Caisse", [["paiements", "Reçus", "receipt"], ["audit", "Audit des caisses", "shield"]]]);
    g.push(["Administration", [["parametres", "Paramètres", "settings"], ["utilisateurs", "Utilisateurs", "key"]]]);
  }
  if (isSuper()) g.push(["Plateforme", [["plateforme", "Établissements", "building"]]]);
  return g;
}
const VIEW_TITLES = { rapports: "Rapports annuels", dashboard: "Tableau de bord", tableau: "Registre des paiements", familles: "Familles & tuteurs", eleves: "Élèves", paiements: "Reçus", audit: "Audit des caisses", parametres: "Paramètres", utilisateurs: "Utilisateurs", plateforme: "Établissements" };

/* =====================================================================
   Rendu principal
   ===================================================================== */
let charts = [];
function destroyCharts() { charts.forEach((c) => { try { c.destroy(); } catch (e) {} }); charts = []; }

function render() {
  const app = $("app");
  destroyCharts();
  if (S.phase === "boot") { app.innerHTML = `<div class="auth-main" style="min-height:100vh"><div class="meta">Chargement…</div></div>`; return; }
  if (S.phase === "login") return renderLogin(app);
  if (S.phase === "changepw") return renderChangePw(app);
  const fe = document.activeElement, fid = fe && fe.id, ss = fe && fe.selectionStart, se = fe && fe.selectionEnd;
  const groups = navItems();
  const allViews = groups.flatMap(([, items]) => items.map((i) => i[0]));
  if (!allViews.includes(S.view)) S.view = allViews[0] || "dashboard";
  const sc = school();
  const lateCount = S.sid && S.lastLoad ? familyArrears(paidIndex()).length : 0;
  const roleTxt = sc ? ROLE_LABEL[myRole()] : isSuper() ? "Super-admin" : "";
  app.innerHTML = `
  <div class="shell${S.navOpen ? " nav-open" : ""}">
    <aside class="sidebar" id="sidebar" aria-label="Navigation">
      <div class="side-brand"><div class="logo">M</div><div><b>Maarifa Mini</b><small>Gestion scolaire</small></div></div>
      ${S.memberships.length ? `<div class="side-school"><label for="school-sel">Établissement</label>${S.memberships.length > 1
        ? `<select id="school-sel">${S.memberships.map((m) => `<option value="${esc(m.school_id)}"${m.school_id === S.sid ? " selected" : ""}>${esc(m.schools.sigle || m.schools.name)}</option>`).join("")}</select>`
        : `<div class="name">${esc(sc?.sigle || sc?.name || "")}</div>`}</div>` : ""}
      ${S.sid && S.years.length ? `<div class="side-school"><label for="year-sel">Année scolaire</label><select id="year-sel">${S.years.map((y) => `<option value="${esc(y.id)}"${y.id === S.yid ? " selected" : ""}>${esc(y.label)}${y.is_current ? " · en cours" : ""}</option>`).join("")}</select></div>` : ""}
      <nav class="side-nav">${groups.map(([g, items]) => `<div class="side-group">${g}</div>${items.map(([k, l, ic]) => `<button class="side-link" data-tab="${k}"${S.view === k ? ' aria-current="page"' : ""}>${icon(ic)}<span>${l}</span>${k === "tableau" && lateCount ? `<span class="badge" title="Familles en retard">${lateCount}</span>` : ""}</button>`).join("")}`).join("")}</nav>
      <button class="side-user" data-act="account"><span class="avatar">${esc(initials(S.profile.full_name || S.profile.email))}</span><div><b>${esc(S.profile.full_name || S.profile.email)}</b><span>${esc(roleTxt)}</span></div></button>
    </aside>
    ${S.navOpen ? '<div class="backdrop" data-act="nav-close"></div>' : ""}
    <div class="main">
      <header class="topbar"><div class="topbar-in">
        <button class="btn icon ghost burger" data-act="nav-open" aria-label="Ouvrir le menu">${icon("menu")}</button>
        <div class="crumb"><small>${sc ? esc(sc.name) + (year() ? " · " + esc(year().label) : "") : "Maarifa Mini"}</small><b>${VIEW_TITLES[S.view] || ""}</b></div>
        <div class="top-actions">
          ${sc ? `<button class="btn brand" data-act="pay">${icon("plus")}<span class="lbl-hide">Encaisser</span></button>` : ""}
          <div class="menu-wrap">
            <button class="btn icon ghost" data-act="menu" aria-haspopup="true" aria-expanded="${S.menuOpen}" aria-label="Mon compte"><span class="avatar" style="width:32px;height:32px;font-size:12px">${esc(initials(S.profile.full_name || S.profile.email))}</span></button>
            ${S.menuOpen ? userMenu() : ""}
          </div>
        </div>
      </div></header>
      <main class="content" id="view">${viewBody()}</main>
    </div>
  </div>`;
  if (fid) { const el = $(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) {} } }
  if (S.view === "dashboard" && S.sid && S.lastLoad && year()) drawDashboardCharts();
  if (S.view === "rapports" && S.sid && S.lastLoad && year()) drawReportCharts();
}
function userMenu() {
  const th = (t, l, ic) => `<button data-act="theme" data-v="${t}" aria-pressed="${S.theme === t}">${icon(ic, "sm")}${l}</button>`;
  return `<div class="menu" role="menu">
    <div class="menu-head"><span class="avatar">${esc(initials(S.profile.full_name || S.profile.email))}</span><div style="min-width:0"><b>${esc(S.profile.full_name || "—")}</b><span>${esc(S.profile.email)}</span></div></div>
    <button data-act="account" role="menuitem">${icon("users")}Mon compte</button>
    <button data-act="password" role="menuitem">${icon("lock")}Changer le mot de passe</button>
    <hr><div class="lbl" style="padding:2px 10px">Apparence</div>
    <div class="seg">${th("light", "Clair", "sun")}${th("dark", "Sombre", "moon")}${th("system", "Auto", "monitor")}</div>
    <hr><button class="danger" data-act="logout" role="menuitem">${icon("logout")}Se déconnecter</button></div>`;
}
function pageHead(title, sub, actions = "") {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
function emptyState(ic, title, text, action = "") {
  return `<div class="empty"><div class="e-ico">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
}
function skeleton() {
  return `<div class="kpis">${'<div class="card kpi"><div class="skel" style="height:14px;width:50%"></div><div class="skel" style="height:26px;width:70%"></div><div class="skel" style="height:12px;width:40%"></div></div>'.repeat(4)}</div><div class="card" style="padding:18px"><div class="skel" style="height:260px"></div></div>`;
}
function viewBody() {
  if (S.view === "plateforme") return viewPlatform();
  if (!S.sid) return `<div class="card">${emptyState("building", "Aucun établissement", "Votre compte n'est rattaché à aucun établissement actif. Contactez le Fondateur de votre école.")}</div>`;
  if (!S.lastLoad) return skeleton();
  if (!year()) return `<div class="card">${emptyState("clock", "Aucune année scolaire", "Créez la première année scolaire dans Paramètres, onglet Années scolaires.", `<button class="btn primary" data-act="new-year">${icon("plus")}Nouvelle année scolaire</button>`)}</div>`;
  const old = !year().is_current && S.view !== "rapports" ? `<div class="banner info">${icon("info")}<span>Vous consultez l'année <b>${esc(year().label)}</b>, qui n'est pas l'année en cours. Les encaissements saisis ici seront rattachés à cette année.</span></div>` : "";
  return old + ({ rapports: viewReports, dashboard: viewDashboard, tableau: viewTableau, familles: viewFamilles, eleves: viewEleves, paiements: viewJournal, audit: viewAudit, parametres: viewSettings, utilisateurs: viewUsers }[S.view] || viewDashboard)();
}
function paginate(key, list) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, S.pages[key] || 1), pages);
  const slice = list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  const bar = list.length > PAGE_SIZE ? `<div class="pager"><span>${(p - 1) * PAGE_SIZE + 1}–${Math.min(p * PAGE_SIZE, list.length)} sur ${list.length}</span><div class="row">
    <button class="btn sm" data-act="page" data-key="${key}" data-p="${p - 1}" ${p <= 1 ? "disabled" : ""}>${icon("chevL", "sm")}Précédent</button>
    <span class="mono">${p} / ${pages}</span>
    <button class="btn sm" data-act="page" data-key="${key}" data-p="${p + 1}" ${p >= pages ? "disabled" : ""}>Suivant${icon("chevR", "sm")}</button></div></div>` : "";
  return { slice, bar };
}

/* ---------- Connexion ---------- */
function renderLogin(app) {
  app.innerHTML = `<div class="auth">
    <section class="auth-side">
      <div class="side-brand" style="padding:0"><div class="logo">M</div><div><b>Maarifa Mini</b><small>Gestion scolaire</small></div></div>
      <div><h1>La scolarité de votre école, <span>tenue au franc près.</span></h1>
      <p>Inscriptions, familles, mensualités et reçus réunis dans un registre sécurisé, accessible depuis un ordinateur ou un téléphone.</p></div>
      <div class="auth-feats">
        <div>${icon("ledger")}<div><b>Registre par famille</b><span>Chaque mois, chaque enfant : payé, partiel ou en retard.</span></div></div>
        <div>${icon("shield")}<div><b>Audit inaltérable</b><span>Qui a encaissé quoi, combien et quand. Rien ne s'efface.</span></div></div>
        <div>${icon("lock")}<div><b>Accès réservé</b><span>Seuls le Fondateur et les administrateurs de l'école.</span></div></div>
      </div>
    </section>
    <section class="auth-main"><form class="auth-card" id="login-form" autocomplete="on">
      <div><h2>Connexion</h2><p class="meta" style="margin:4px 0 0">Saisissez les identifiants remis par votre établissement.</p></div>
      <div class="field"><label for="lg-email">Adresse e-mail</label><input id="lg-email" name="email" type="email" autocomplete="username" required placeholder="nom@ecole.td"></div>
      <div class="field"><label for="lg-pw">Mot de passe</label><div class="pw-wrap"><input id="lg-pw" name="password" type="password" autocomplete="current-password" required><button type="button" class="btn" data-act="pw-eye" data-for="lg-pw" aria-label="Afficher le mot de passe">${icon("eye", "sm")}</button></div></div>
      <span class="err" id="lg-err" role="alert"></span>
      <button class="btn primary" type="submit">Se connecter</button>
      <p class="meta" style="margin:0">Mot de passe oublié ? Demandez au Fondateur de votre école de le réinitialiser.</p>
    </form></section></div>`;
  setTimeout(() => $("lg-email")?.focus(), 30);
}
function pwField(id, name, label, opts = {}) {
  return `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${opts.ac || "new-password"}" ${opts.meter ? `data-meter="${id}-m"` : ""} required><button type="button" class="btn" data-act="pw-eye" data-for="${id}" aria-label="Afficher le mot de passe">${icon("eye", "sm")}</button></div>${opts.meter ? `<div class="strength" id="${id}-m" data-s="0"><i></i><i></i><i></i><i></i></div><span class="hint">8 caractères minimum, avec des lettres et des chiffres.</span>` : ""}</div>`;
}
function renderChangePw(app) {
  app.innerHTML = `<div class="auth"><section class="auth-side">
      <div class="side-brand" style="padding:0"><div class="logo">M</div><div><b>Maarifa Mini</b><small>Gestion scolaire</small></div></div>
      <div><h1>Bienvenue, <span>${esc((S.profile.full_name || "").split(" ")[0] || "")}</span>.</h1><p>Pour protéger les données de l'école, remplacez le mot de passe provisoire qui vous a été remis.</p></div><div></div></section>
    <section class="auth-main"><form class="auth-card" id="pw-form">
      <div><h2>Choisissez votre mot de passe</h2><p class="meta" style="margin:4px 0 0">Première connexion</p></div>
      ${pwField("pw-1", "p1", "Nouveau mot de passe", { meter: true })}
      ${pwField("pw-2", "p2", "Confirmez le mot de passe")}
      <span class="err" id="pw-err" role="alert"></span>
      <button class="btn primary" type="submit">Enregistrer et continuer</button>
      <button class="btn ghost" type="button" data-act="logout">Se déconnecter</button>
    </form></section></div>`;
}

/* =====================================================================
   Tableau de bord
   ===================================================================== */
function dashData() {
  const PI = paidIndex(), ms = months(), nk = nowKey(), td = today(), mStart = td.slice(0, 7);
  const active = S.students.filter((s) => s.statut !== "Abandon");
  let dueNow = 0, reste = 0;
  active.forEach((st) => { const r = studentSummary(st, PI); dueNow += r.dueNow; reste += r.reste; });
  const valid = yearReceipts().filter((r) => r.status === "valide");
  const sumWhere = (fn) => valid.filter(fn).reduce((a, r) => a + r.total, 0);
  const paidToday = sumWhere((r) => r.date === td), nToday = valid.filter((r) => r.date === td).length;
  const paidMonth = sumWhere((r) => r.date.startsWith(mStart));
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1); const pKey = prev.getFullYear() + "-" + pad(prev.getMonth() + 1);
  const paidPrev = sumWhere((r) => r.date.startsWith(pKey));
  const paidTotal = valid.reduce((a, r) => a + r.total, 0);
  const rate = dueNow ? Math.round(((dueNow - reste) / dueNow) * 100) : 0;
  const perMonth = ms.map((m) => { let due = 0, paid = 0; S.students.forEach((st) => { due += dueFor(st, m.key); paid += PI.get(st.id + "|" + m.key) || 0; }); return { key: m.key, label: m.label || mLabel(m.key), due, paid, past: m.key <= nk }; });
  const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(isoDay(d)); }
  const perDay = days.map((d) => ({ d, v: sumWhere((r) => r.date === d) }));
  const byClass = classes().map((c) => { let r = 0, n = 0; active.filter((s) => s.classId === c.id).forEach((s) => { r += studentSummary(s, PI).reste; n++; }); return { name: c.name, reste: r, n }; }).filter((x) => x.n > 0).sort((a, b) => b.reste - a.reste);
  const byMode = {}; valid.forEach((r) => (byMode[r.mode || "Autre"] = (byMode[r.mode || "Autre"] || 0) + r.total));
  return { PI, active, dueNow, reste, paidToday, nToday, paidMonth, paidPrev, paidTotal, rate, perMonth, perDay, byClass, byMode: Object.entries(byMode).sort((a, b) => b[1] - a[1]), arrears: familyArrears(PI), recent: yearReceipts().slice(0, 6), insReste: active.reduce((a, st) => a + studentSummary(st, PI).insReste, 0), nAb: S.students.length - active.length };
}
let DASH = null;
function viewDashboard() {
  const D = (DASH = dashData());
  const first = (S.profile.full_name || "").split(" ")[0];
  const delta = D.paidPrev ? Math.round(((D.paidMonth - D.paidPrev) / D.paidPrev) * 100) : null;
  const moisNom = MOIS_LONG[new Date().getMonth()];
  if (!S.families.length && !S.students.length) return pageHead(`${greet()}${first ? ", " + esc(first) : ""}`, "Voici la situation de votre établissement.") +
    `<div class="card">${emptyState("family", "Commencez par enregistrer vos familles", "Une famille regroupe les frères et sœurs et porte les coordonnées du tuteur. Inscrivez ensuite chaque enfant dans sa classe.", `<button class="btn primary" data-act="new-family">${icon("plus")}Nouvelle famille</button>`)}</div>`;
  return `${pageHead(`${greet()}${first ? ", " + esc(first) : ""}`, `Situation au ${fmtDate(today())} · année scolaire ${esc(year().label)} · ${D.active.length} élèves actifs${D.nAb ? `, ${D.nAb} abandon${D.nAb > 1 ? "s" : ""}` : ""}`,
    `<button class="btn" data-act="reload">${icon("refresh")}Actualiser</button><button class="btn primary" data-act="pay">${icon("plus")}Encaisser un paiement</button>`)}
  <div class="kpis four">
    <div class="card kpi ok"><div class="k-top"><span class="k-lbl">Encaissé en ${moisNom}</span><span class="k-ico">${icon("wallet")}</span></div><div class="k-val">${F(D.paidMonth)}<small>FCFA</small></div>
      <div class="k-sub">${delta == null ? "Aucun encaissement le mois précédent" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} % par rapport au mois précédent`}</div></div>
    <div class="card kpi"><div class="k-top"><span class="k-lbl">Encaissé aujourd'hui</span><span class="k-ico">${icon("clock")}</span></div><div class="k-val">${F(D.paidToday)}<small>FCFA</small></div><div class="k-sub">${D.nToday} reçu${D.nToday > 1 ? "s" : ""} émis</div></div>
    <div class="card kpi late"><div class="k-top"><span class="k-lbl">Reste à recouvrer</span><span class="k-ico">${icon("alert")}</span></div><div class="k-val">${F(D.reste)}<small>FCFA</small></div><div class="k-sub">${D.arrears.length} famille${D.arrears.length > 1 ? "s" : ""} en retard${D.insReste ? ` · dont ${F(D.insReste)} d'inscriptions` : ""}</div></div>
    <div class="card kpi brand"><div class="k-top"><span class="k-lbl">Taux de recouvrement</span><span class="k-ico">${icon("trend")}</span></div><div class="k-val">${D.rate} %</div>
      <div class="bar" role="progressbar" aria-valuenow="${D.rate}" aria-valuemin="0" aria-valuemax="100"><i style="width:${D.rate}%"></i></div><div class="k-sub">${F(D.dueNow - D.reste)} sur ${F(D.dueNow)} FCFA échus</div></div>
  </div>
  <div class="dash">
    <section class="card span-8"><div class="card-h"><div><h2>Mensualités par mois de scolarité</h2><p>Montant attendu et montant encaissé, pour chaque mois de l'année</p></div>
      <div class="chart-legend"><span><i style="background:var(--series-ref)"></i>Attendu</span><span><i style="background:var(--series-1)"></i>Encaissé</span></div></div>
      <div class="card-b"><div class="chart-box"><canvas id="ch-months" role="img" aria-label="Attendu et encaissé par mois"></canvas></div></div></section>
    <section class="card span-4"><div class="card-h"><div><h2>Familles les plus en retard</h2><p>Reste échu à ce jour</p></div><button class="btn sm ghost" data-tab="tableau">Voir tout</button></div>
      <div class="card-b flush" style="margin-top:8px">${D.arrears.length ? `<ul class="rank">${D.arrears.slice(0, 6).map((x) => `<li><span class="code">${esc(x.f.code)}</span><div class="r-main"><b>${esc(x.f.nom)}</b><span>${esc(x.f.tel || x.f.tuteurNom || "")}</span></div><span class="mono" style="color:var(--late);font-weight:500">${F(x.reste)}</span><button class="btn sm icon" data-act="pay" data-fam="${x.f.id}" title="Encaisser" aria-label="Encaisser ${esc(x.f.nom)}">${icon("plus", "sm")}</button></li>`).join("")}</ul>`
        : emptyState("check", "Aucun retard", "Toutes les familles sont à jour de leurs mensualités échues.")}</div></section>
    <section class="card span-6"><div class="card-h"><div><h2>Encaissements des 30 derniers jours</h2><p>Total des reçus valides par jour</p></div></div>
      <div class="card-b"><div class="chart-box sm"><canvas id="ch-days" role="img" aria-label="Encaissements par jour"></canvas></div></div></section>
    <section class="card span-6"><div class="card-h"><div><h2>Reste à recouvrer par classe</h2><p>Mensualités échues non payées</p></div></div>
      <div class="card-b"><div class="chart-box sm"><canvas id="ch-class" role="img" aria-label="Reste à recouvrer par classe"></canvas></div></div></section>
    <section class="card span-4"><div class="card-h"><div><h2>Modes de paiement</h2><p>Depuis le début de l'année</p></div></div>
      <div class="card-b">${D.byMode.length ? `<div style="display:flex;flex-direction:column;gap:12px">${D.byMode.map(([k, v]) => { const pct = D.paidTotal ? Math.round((v / D.paidTotal) * 100) : 0; return `<div><div class="row" style="justify-content:space-between"><span style="font-weight:600">${esc(k)}</span><span class="mono">${F(v)} <span class="muted">· ${pct} %</span></span></div><div class="bar" style="margin-top:6px"><i style="width:${pct}%;background:var(--series-1)"></i></div></div>`; }).join("")}</div>` : `<p class="meta">Aucun paiement enregistré.</p>`}</div></section>
    <section class="card span-8"><div class="card-h"><div><h2>Derniers reçus</h2><p>Les 6 encaissements les plus récents</p></div><button class="btn sm ghost" data-tab="paiements">Tous les reçus</button></div>
      <div class="card-b flush" style="margin-top:8px">${D.recent.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Reçu</th><th>Famille</th><th>Date</th><th>Encaissé par</th><th class="num">Montant</th></tr></thead><tbody>${D.recent.map((r) => `<tr class="${r.status === "annule" ? "cancelled" : ""}" style="cursor:pointer" data-act="receipt" data-id="${r.id}">
        <td class="rt-title"><b class="mono">${esc(r.number)}</b> ${r.status === "annule" ? '<span class="pill late">Annulé</span>' : ""}</td><td data-label="Famille"><span class="code">${esc(r.family_code)}</span> ${esc(r.family_nom)}</td><td data-label="Date">${fmtDate(r.date)}</td><td data-label="Encaissé par">${esc(r.created_by_name)}</td><td data-label="Montant" class="num"><b class="amt">${F(r.total)}</b></td></tr>`).join("")}</tbody></table></div>`
        : emptyState("receipt", "Aucun reçu", "Les encaissements apparaîtront ici.")}</div></section>
  </div>`;
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function drawDashboardCharts() {
  const D = DASH; if (!D) return;
  if (!window.Chart) { ["ch-months", "ch-days", "ch-class"].forEach((id) => { const c = $(id); if (c) c.parentElement.innerHTML = '<div class="chart-fallback">Graphique indisponible (bibliothèque non chargée).</div>'; }); return; }
  const C = window.Chart, ink2 = cssVar("--ink-2"), ink3 = cssVar("--ink-3"), grid = cssVar("--grid"), s1 = cssVar("--series-1"), ref = cssVar("--series-ref"), surface = cssVar("--surface"), ink = cssVar("--ink");
  C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.font.size = 12; C.defaults.color = ink3;
  const tip = { backgroundColor: ink, titleColor: surface, bodyColor: surface, padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4, callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + " : " : ""}${F(c.parsed.y ?? c.parsed.x)} FCFA` } };
  const axisMoney = { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: ink3, padding: 8, callback: (v) => FC(v) }, beginAtZero: true };
  const axisCat = { grid: { display: false }, border: { color: grid }, ticks: { color: ink2, autoSkip: true, maxRotation: 0 } };
  const bar = { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start", maxBarThickness: 26, categoryPercentage: 0.72, barPercentage: 0.9, borderColor: surface, borderWidth: { top: 0, left: 1, right: 1, bottom: 0 } };
  const anim = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && !S._chartsDrawn ? { duration: 450 } : false;
  S._chartsDrawn = true;
  const base = { responsive: true, maintainAspectRatio: false, animation: anim, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: tip } };
  const m = $("ch-months");
  if (m) charts.push(new C(m, { type: "bar", data: { labels: D.perMonth.map((x) => x.label), datasets: [
    { label: "Attendu", data: D.perMonth.map((x) => x.due), backgroundColor: ref, ...bar },
    { label: "Encaissé", data: D.perMonth.map((x) => x.paid), backgroundColor: s1, ...bar }] }, options: { ...base, scales: { x: axisCat, y: axisMoney } } }));
  const d = $("ch-days");
  if (d) charts.push(new C(d, { type: "bar", data: { labels: D.perDay.map((x) => x.d.slice(8) + "/" + x.d.slice(5, 7)), datasets: [{ label: "Encaissé", data: D.perDay.map((x) => x.v), backgroundColor: s1, ...bar, maxBarThickness: 14 }] },
    options: { ...base, plugins: { ...base.plugins, tooltip: { ...tip, callbacks: { title: (c) => fmtDate(D.perDay[c[0].dataIndex].d), label: (c) => ` ${F(c.parsed.y)} FCFA` } } }, scales: { x: { ...axisCat, ticks: { ...axisCat.ticks, maxTicksLimit: 8 } }, y: axisMoney } } }));
  const k = $("ch-class");
  if (k) {
    if (!D.byClass.length) k.parentElement.innerHTML = '<div class="chart-fallback">Aucun élève inscrit dans une classe.</div>';
    else charts.push(new C(k, { type: "bar", data: { labels: D.byClass.map((x) => x.name), datasets: [{ label: "Reste", data: D.byClass.map((x) => x.reste), backgroundColor: s1, ...bar, borderRadius: { topRight: 4, bottomRight: 4 }, borderWidth: 0, maxBarThickness: 18 }] },
      options: { ...base, indexAxis: "y", interaction: { mode: "nearest", axis: "y", intersect: false }, plugins: { ...base.plugins, tooltip: { ...tip, callbacks: { label: (c) => ` ${F(c.parsed.x)} FCFA · ${D.byClass[c.dataIndex].n} élève(s)` } } }, scales: { y: { ...axisCat, ticks: { color: ink2 } }, x: { ...axisMoney } } } }));
  }
}

/* =====================================================================
   Registre des paiements
   ===================================================================== */
function viewTableau() {
  const PI = paidIndex(), ms = months(), f = S.f, q = f.q.trim().toLowerCase();
  const fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code) || (a.nom || "").localeCompare(b.nom || ""));
  const colPaid = {}; let insPaidTot = 0; const blocks = [];
  for (const fam of fams) {
    let sts = studentsOfFam(fam.id, f.sortis);
    if (f.cls) sts = sts.filter((s) => s.classId === f.cls);
    const famHit = !q || [fam.code, fam.nom, fam.tuteurNom, fam.tel, fam.tel2].some((x) => String(x || "").toLowerCase().includes(q));
    if (!famHit) sts = sts.filter((s) => (s.nom || "").toLowerCase().includes(q) || String(s.matricule || "").toLowerCase().includes(q));
    if (!sts.length) continue;
    let fPaid = 0, fReste = 0; sts.forEach((st) => { const r = studentSummary(st, PI); fPaid += r.paid; fReste += r.reste; });
    if (f.late && fReste <= 0) continue;
    blocks.push({ fam, sts, fPaid, fReste });
  }
  S.students.forEach((st) => { insPaidTot += PI.get(st.id + "|INS") || 0; ms.forEach((m) => (colPaid[m.key] = (colPaid[m.key] || 0) + (PI.get(st.id + "|" + m.key) || 0))); });
  const { slice, bar } = paginate("tableau", blocks);
  let rows = "";
  for (const { fam, sts, fPaid, fReste } of slice) {
    rows += `<tr class="fam"><td class="stick"><div class="famhead"><span class="code">${esc(fam.code)}</span><span class="famname">${esc(fam.nom)}</span></div></td>
      <td colspan="${ms.length + 4}"><div class="famhead"><span class="meta">${esc(fam.tuteurNom || "")}${fam.tel ? " · " + esc(fam.tel) : ""}${fam.tel2 ? " / " + esc(fam.tel2) : ""}</span>
      <span class="pill ok">Payé ${F(fPaid)}</span>${fReste > 0 ? `<span class="pill late">Reste ${F(fReste)}</span>` : '<span class="pill mute">À jour</span>'}
      <button class="btn sm" data-act="pay" data-fam="${fam.id}">${icon("plus", "sm")}Encaisser</button></div></td></tr>`;
    for (const st of sts) {
      const r = studentSummary(st, PI);
      const ab = st.statut === "Abandon" ? ` · <span style="color:var(--late)">Abandon ${fmtDate(st.dateSortie)}</span>` : "";
      rows += `<tr><td class="stick"><button class="st-name" data-act="edit-student" data-id="${st.id}">${esc(st.nom)}</button><div class="meta">${esc(clsOf(st)?.name || "Sans classe")}${st.reduction ? " · réd. " + F(st.reduction) : ""}${ab}</div></td><td class="num">${F(monthly(st))}</td>`;
      const ic = cellState(r.insDue, r.insPaid, "0000-00");
      rows += `<td><button class="cell ${ic}" ${ic === "na" || ic === "ok" ? "disabled" : ""} data-act="pay" data-fam="${fam.id}" data-st="${st.id}" data-m="INS" title="${esc(st.nom)} · inscription">${ic === "na" ? "—" : ic === "ok" ? F(r.insPaid) : ic === "part" ? `${F(r.insPaid)}<small>sur ${F(r.insDue)}</small>` : `0<small>dû ${F(r.insDue)}</small>`}</button></td>`;
      for (const m of ms) {
        const d = dueFor(st, m.key), p = PI.get(st.id + "|" + m.key) || 0, c = cellState(d, p, m.key);
        const txt = c === "na" ? "—" : c === "ok" ? F(p) : c === "part" ? `${F(p)}<small>sur ${F(d)}</small>` : c === "late" ? `0<small>dû ${F(d)}</small>` : F(d);
        rows += `<td><button class="cell ${c}" ${c === "na" || c === "ok" ? "disabled" : ""} data-act="pay" data-fam="${fam.id}" data-st="${st.id}" data-m="${m.key}" title="${esc(st.nom)} · ${esc(m.label || mLabel(m.key))}">${txt}</button></td>`;
      }
      rows += `<td class="num">${F(r.paid)}</td><td class="num" style="color:${r.reste > 0 ? "var(--late)" : "var(--ok)"};font-weight:600">${F(r.reste)}</td></tr>`;
    }
  }
  const head = `<tr><th class="stick">Famille / élève</th><th class="num">Mensualité</th><th style="text-align:center">Inscription</th>${ms.map((m) => `<th style="text-align:center">${esc(m.label || mLabel(m.key))}</th>`).join("")}<th class="num">Total payé</th><th class="num">Reste échu</th></tr>`;
  const foot = `<tr><td class="stick">Encaissé</td><td></td><td class="num">${F(insPaidTot)}</td>${ms.map((m) => `<td class="num">${F(colPaid[m.key] || 0)}</td>`).join("")}<td class="num">${F(insPaidTot + Object.values(colPaid).reduce((a, b) => a + b, 0))}</td><td></td></tr>`;
  return `${pageHead("Registre des paiements", `Année ${esc(year().label)} : chaque famille et ses enfants, l'inscription puis chaque mois. Touchez une case pour encaisser.`, `<button class="btn" data-act="export-tableau">${icon("download")}Exporter</button><button class="btn primary" data-act="new-family">${icon("plus")}Nouvelle famille</button>`)}
  <div class="toolbar">
    <div class="search">${icon("search")}<input id="f-q" data-f="q" placeholder="Famille, élève, tuteur, téléphone…" value="${esc(f.q)}" aria-label="Rechercher"></div>
    <select id="f-cls" data-f="cls" aria-label="Classe"><option value="">Toutes les classes</option>${classes().map((c) => `<option value="${esc(c.id)}"${f.cls === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" class="switch" id="f-late" data-f="late"${f.late ? " checked" : ""}>En retard</label>
    <label class="chk"><input type="checkbox" class="switch" id="f-sortis" data-f="sortis"${f.sortis ? " checked" : ""}>Abandons</label>
  </div>
  <div class="legend"><span><i style="background:var(--ok-bg);border:1px solid var(--ok)"></i>Payé</span><span><i style="background:var(--part-bg);border:1px solid var(--part)"></i>Partiel</span><span><i style="background:var(--late-bg);border:1px solid var(--late)"></i>Échu non payé</span><span><i style="border:1px dashed var(--up)"></i>À venir</span><span>— Non dû (avant l'inscription, après un abandon, ou exonéré)</span></div>
  ${!ms.length ? `<div class="banner">${icon("alert")}<span>Aucun mois de paiement n'est activé pour cette année. Configurez-les dans Paramètres.</span></div>` : ""}
  <div class="card">${blocks.length ? `<div class="scroller"><table class="ledger"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>${bar}`
    : emptyState("ledger", S.students.length ? "Aucune famille ne correspond" : "Aucun élève inscrit cette année", S.students.length ? "Modifiez la recherche ou les filtres." : (S.studentsAll.length ? "Réinscrivez les élèves de l'année précédente depuis la page Élèves." : "Commencez par créer une famille, puis inscrivez ses enfants."))}</div>`;
}
/* =====================================================================
   Familles & élèves
   ===================================================================== */
function viewFamilles() {
  const PI = paidIndex(), cfg = fcfg("family"), q = S.f.q.trim().toLowerCase();
  const cols = FAMILY_FIELDS.filter((d) => cfg[d.k]?.show && ["tuteurNom", "lien", "tel", "quartier"].includes(d.k));
  let fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code));
  if (q) fams = fams.filter((f) => [f.code, f.nom, f.tuteurNom, f.tel, f.tel2, f.quartier].some((x) => String(x || "").toLowerCase().includes(q)));
  const { slice, bar } = paginate("familles", fams);
  const rows = slice.map((f) => {
    const sts = studentsOfFam(f.id); let reste = 0; sts.forEach((s) => (reste += studentSummary(s, PI).reste));
    return `<tr><td class="rt-title"><span class="code">${esc(f.code)}</span> <b>${esc(f.nom)}</b></td>${cols.map((c) => `<td data-label="${esc(c.l)}">${esc(f[c.k] || "—")}</td>`).join("")}
    <td data-label="Élèves" class="num">${sts.length}</td><td data-label="Reste échu" class="num">${reste > 0 ? `<span class="pill late">${F(reste)}</span>` : '<span class="pill ok">À jour</span>'}</td>
    <td class="actions-cell" data-label=""><div class="row"><button class="btn sm" data-act="edit-family" data-id="${f.id}">Modifier</button><button class="btn sm" data-act="new-student" data-fam="${f.id}">${icon("plus", "sm")}Élève</button><button class="btn sm" data-act="pay" data-fam="${f.id}">Encaisser</button></div></td></tr>`;
  }).join("");
  return `${pageHead("Familles & tuteurs", `${S.families.length} famille${S.families.length > 1 ? "s" : ""} enregistrée${S.families.length > 1 ? "s" : ""}`, `<button class="btn primary" data-act="new-family">${icon("plus")}Nouvelle famille</button>`)}
  <div class="toolbar"><div class="search">${icon("search")}<input id="f-q2" data-f="q" placeholder="Famille, tuteur, téléphone, quartier…" value="${esc(S.f.q)}" aria-label="Rechercher"></div></div>
  <div class="card">${fams.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Famille</th>${cols.map((c) => `<th>${esc(c.l)}</th>`).join("")}<th class="num">Élèves</th><th class="num">Reste échu</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${bar}`
    : emptyState("family", S.families.length ? "Aucun résultat" : "Aucune famille", S.families.length ? "Modifiez la recherche." : "Une famille regroupe les frères et sœurs et porte les coordonnées du tuteur.")}</div>`;
}
function viewEleves() {
  const PI = paidIndex(), cfg = fcfg("student"), q = S.f.q.trim().toLowerCase();
  const cols = STUDENT_FIELDS.filter((d) => cfg[d.k]?.show && ["matricule", "sexe", "dateNaissance"].includes(d.k));
  let sts = S.students.filter((s) => S.f.sortis || s.statut !== "Abandon");
  if (S.f.cls) sts = sts.filter((s) => s.classId === S.f.cls);
  if (q) sts = sts.filter((s) => [s.nom, s.matricule, famOf(s)?.nom, famOf(s)?.code].some((x) => String(x || "").toLowerCase().includes(q)));
  sts.sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  const nAb = S.students.filter((s) => s.statut === "Abandon").length;
  const notEnrolled = S.studentsAll.filter((s) => !S.students.some((x) => x.id === s.id)).length;
  const { slice, bar } = paginate("eleves", sts);
  const rows = slice.map((s) => {
    const fa = famOf(s), r = studentSummary(s, PI);
    return `<tr><td class="rt-title"><b>${esc(s.nom)}</b>${s.statut === "Abandon" ? ` <span class="pill late plain">Abandon ${fmtDate(s.dateSortie)}</span>` : ""}</td>
    <td data-label="Famille">${fa ? `<span class="code">${esc(fa.code)}</span> ${esc(fa.nom)}` : "—"}</td><td data-label="Classe">${esc(clsOf(s)?.name || "—")}</td>
    ${cols.map((c) => `<td data-label="${esc(c.l)}">${esc(c.t === "date" ? fmtDate(s[c.k]) : s[c.k] || "—")}</td>`).join("")}
    <td data-label="Mensualité" class="num">${F(monthly(s))}</td><td data-label="Inscription" class="num">${r.insDue ? (r.insReste ? `<span class="pill late plain">${F(r.insReste)} dû</span>` : '<span class="pill ok plain">Payée</span>') : '<span class="meta">—</span>'}</td><td data-label="Reste échu" class="num">${r.reste > 0 ? `<span class="pill late">${F(r.reste)}</span>` : '<span class="pill ok">À jour</span>'}</td>
    <td class="actions-cell" data-label=""><button class="btn sm" data-act="edit-student" data-id="${s.id}">Modifier</button></td></tr>`;
  }).join("");
  return `${pageHead("Élèves", `${S.students.length - nAb} élève${S.students.length - nAb > 1 ? "s" : ""} actif${S.students.length - nAb > 1 ? "s" : ""} en ${esc(year().label)}${nAb ? ` · ${nAb} abandon${nAb > 1 ? "s" : ""}` : ""}`, `${S.years.length > 1 ? `<button class="btn" data-act="reinscrire">${icon("refresh")}Réinscrire</button>` : ""}<button class="btn" data-act="export-eleves">${icon("download")}Exporter</button><button class="btn primary" data-act="new-student">${icon("plus")}Inscrire un élève</button>`)}
  ${!S.students.length && notEnrolled ? `<div class="banner info">${icon("info")}<span>Aucun élève n'est encore inscrit en ${esc(year().label)}. Utilisez <b>Réinscrire</b> pour reprendre les élèves de l'année précédente.</span></div>` : ""}
  <div class="toolbar"><div class="search">${icon("search")}<input id="f-q3" data-f="q" placeholder="Élève, matricule, famille…" value="${esc(S.f.q)}" aria-label="Rechercher"></div>
    <select id="f-cls2" data-f="cls" aria-label="Classe"><option value="">Toutes les classes</option>${classes().map((c) => `<option value="${esc(c.id)}"${S.f.cls === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" class="switch" id="f-sortis2" data-f="sortis"${S.f.sortis ? " checked" : ""}>Afficher les abandons</label></div>
  <div class="card">${sts.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Nom & prénoms</th><th>Famille</th><th>Classe</th>${cols.map((c) => `<th>${esc(c.l)}</th>`).join("")}<th class="num">Mensualité</th><th class="num">Inscription</th><th class="num">Reste échu</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${bar}`
    : emptyState("student", S.students.length ? "Aucun résultat" : "Aucun élève inscrit", S.families.length ? "Inscrivez un élève et rattachez-le à sa famille." : "Créez d'abord une famille.")}</div>`;
}
/* =====================================================================
   Reçus
   ===================================================================== */
function filteredReceipts() {
  let rs = yearReceipts(); const q = S.jf.q.trim().toLowerCase();
  if (S.jf.m) rs = rs.filter((r) => r.date.startsWith(S.jf.m));
  if (S.jf.st) rs = rs.filter((r) => r.status === S.jf.st);
  if (S.jf.by) rs = rs.filter((r) => r.created_by === S.jf.by);
  if (q) rs = rs.filter((r) => [r.number, r.payer, r.family_nom, r.family_code, ...r.payment_lines.map((l) => l.student_nom)].some((x) => String(x || "").toLowerCase().includes(q)));
  return rs;
}
function viewJournal() {
  const rs = filteredReceipts();
  const periods = [...new Set(yearReceipts().map((r) => r.date.slice(0, 7)))].sort().reverse();
  const cashiers = [...new Map(yearReceipts().map((r) => [r.created_by, r.created_by_name])).entries()];
  const valid = rs.filter((r) => r.status === "valide");
  const total = valid.reduce((a, r) => a + r.total, 0);
  const { slice, bar } = paginate("recus", rs);
  const rows = slice.map((r) => {
    const names = [...new Set(r.payment_lines.map((l) => l.student_nom))];
    const ms = [...new Set(r.payment_lines.map((l) => l.kind === "inscription" ? "0" : l.month))].sort().map((k) => (k === "0" ? "Inscription" : mLabel(k)));
    return `<tr class="${r.status === "annule" ? "cancelled" : ""}"><td class="rt-title"><b class="mono">${esc(r.number)}</b> ${r.status === "annule" ? '<span class="pill late">Annulé</span>' : '<span class="pill ok">Valide</span>'}</td>
    <td data-label="Date" class="nowrap">${fmtDate(r.date)}</td><td data-label="Famille"><span class="code">${esc(r.family_code)}</span> ${esc(r.family_nom)}</td>
    <td data-label="Détail">${esc(names.join(", "))}<span class="sub">${esc(ms.join(", "))}</span></td><td data-label="Mode">${esc(r.mode)}</td>
    <td data-label="Encaissé par">${esc(r.created_by_name)}<span class="sub">${fmtDateTime(r.created_at)}</span></td>
    <td data-label="Montant" class="num"><b class="amt">${F(r.total)}</b></td>
    <td class="actions-cell" data-label=""><div class="row"><button class="btn sm" data-act="receipt" data-id="${r.id}">Voir</button>${r.status === "valide" ? `<button class="btn sm outline-danger" data-act="cancel-receipt" data-id="${r.id}">Annuler</button>` : ""}</div></td></tr>`;
  }).join("");
  return `${pageHead("Reçus", `Encaissements de l'année ${esc(year().label)}, avec le nom de la personne qui a encaissé.`, `<button class="btn" data-act="export-journal">${icon("download")}Exporter</button><button class="btn primary" data-act="pay">${icon("plus")}Encaisser</button>`)}
  <div class="kpis"><div class="card kpi ok"><div class="k-top"><span class="k-lbl">Encaissé (sélection)</span><span class="k-ico">${icon("wallet")}</span></div><div class="k-val">${F(total)}<small>FCFA</small></div><div class="k-sub">${valid.length} reçu${valid.length > 1 ? "s" : ""} valide${valid.length > 1 ? "s" : ""}</div></div>
    <div class="card kpi late"><div class="k-top"><span class="k-lbl">Reçus annulés</span><span class="k-ico">${icon("ban")}</span></div><div class="k-val">${rs.length - valid.length}</div><div class="k-sub">${F(rs.filter((r) => r.status === "annule").reduce((a, r) => a + r.total, 0))} FCFA annulés</div></div></div>
  <div class="toolbar"><div class="search">${icon("search")}<input id="j-q" data-jf="q" placeholder="N° de reçu, famille, élève, payeur…" value="${esc(S.jf.q)}" aria-label="Rechercher"></div>
  <select id="j-m" data-jf="m" aria-label="Période"><option value="">Toutes les dates</option>${periods.map((p) => `<option value="${p}"${S.jf.m === p ? " selected" : ""}>${MOIS_LONG[+p.slice(5) - 1]} ${p.slice(0, 4)}</option>`).join("")}</select>
  <select id="j-by" data-jf="by" aria-label="Caissier"><option value="">Tous les caissiers</option>${cashiers.map(([id, n]) => `<option value="${esc(id)}"${S.jf.by === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>
  <select id="j-st" data-jf="st" aria-label="Statut"><option value="">Tous les statuts</option><option value="valide"${S.jf.st === "valide" ? " selected" : ""}>Valides</option><option value="annule"${S.jf.st === "annule" ? " selected" : ""}>Annulés</option></select></div>
  <div class="card">${rs.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Reçu</th><th>Date</th><th>Famille</th><th>Élèves · mois</th><th>Mode</th><th>Encaissé par</th><th class="num">Montant</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${bar}`
    : emptyState("receipt", "Aucun reçu", "Les encaissements apparaîtront ici avec leur numéro et le nom du caissier.")}</div>`;
}

/* =====================================================================
   Audit
   ===================================================================== */
function auditDefaults() { if (!S.af.from) { const d = new Date(); S.af.from = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01"; S.af.to = today(); } }
async function loadAudit() {
  auditDefaults();
  if (S.auditLoading) return; S.auditLoading = true;
  let q = sb.from("audit_log").select("*").eq("school_id", S.sid).gte("at", S.af.from + "T00:00:00").lte("at", S.af.to + "T23:59:59.999").order("at", { ascending: false }).limit(2000);
  if (S.af.by) q = q.eq("actor_id", S.af.by);
  if (S.af.action) q = q.eq("action", S.af.action);
  const { data, error } = await q; S.auditLoading = false;
  if (error) return toast("Audit indisponible : " + errMsg(error), "err");
  S.audit = data; S.auditLoaded = true; if (S.view === "audit") render();
}
function viewAudit() {
  auditDefaults();
  if (!S.auditLoaded) { loadAudit(); return pageHead("Audit des caisses", "Chargement…") + skeleton(); }
  const per = {};
  for (const a of S.audit) {
    const p = (per[a.actor_id] ||= { name: a.actor_name || a.actor_email, role: a.actor_role, enc: 0, nEnc: 0, ann: 0, nAnn: 0 });
    if (a.action === "encaissement") { p.enc += a.amount; p.nEnc++; } else { p.ann += a.amount; p.nAnn++; }
  }
  const users = S.members.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email]);
  const { slice, bar } = paginate("audit", S.audit);
  const rows = slice.map((a) => {
    const d = a.details || {};
    const lignes = (d.lignes || []).map((l) => `${esc(l.eleve)} · ${esc(l.type === "inscription" || !l.mois ? "Inscription" : mLabel(l.mois))} · ${F(l.montant)}`).join("<br>");
    return `<tr><td class="rt-title"><span class="pill ${a.action === "encaissement" ? "ok" : "late"}">${a.action === "encaissement" ? "Encaissement" : "Annulation"}</span> <b class="mono">${esc(a.receipt_number || "")}</b></td>
    <td data-label="Date et heure" class="nowrap">${fmtDateTime(a.at)}</td>
    <td data-label="Utilisateur"><b>${esc(a.actor_name || a.actor_email)}</b><span class="sub">${esc(ROLE_LABEL[a.actor_role] || a.actor_role)} · ${esc(a.actor_email)}</span></td>
    <td data-label="Famille">${a.family_code ? `<span class="code">${esc(a.family_code)}</span> ` : ""}${esc(a.family_nom || "")}</td>
    <td data-label="Montant" class="num"><b>${a.action === "annulation" ? "−" : ""}${F(a.amount)}</b></td>
    <td data-label="Détails" style="min-width:220px">${a.action === "annulation" ? `<b>Motif :</b> ${esc(d.motif)}<span class="sub">Encaissé à l'origine par ${esc(d.encaisse_par)} le ${fmtDateTime(d.encaisse_le)}</span>` : `<span class="sub" style="margin:0">Reçu du ${fmtDate(d.date)}${d.annee ? " · année " + esc(d.annee) : ""} · ${esc(d.mode || "")}${d.verse_par ? " · versé par " + esc(d.verse_par) : ""}</span>`}<span class="sub">${lignes}</span></td></tr>`;
  }).join("");
  const perRows = Object.values(per).sort((a, b) => b.enc - a.enc).map((p) => `<tr><td class="rt-title"><b>${esc(p.name)}</b> <span class="pill mute plain">${esc(ROLE_LABEL[p.role] || "")}</span></td><td data-label="Encaissements" class="num">${p.nEnc}</td><td data-label="Montant encaissé" class="num">${F(p.enc)}</td><td data-label="Annulations" class="num">${p.nAnn}</td><td data-label="Montant annulé" class="num">${F(p.ann)}</td><td data-label="Net" class="num"><b>${F(p.enc - p.ann)}</b></td></tr>`).join("");
  return `${pageHead("Audit des caisses", "Chaque encaissement et chaque annulation est enregistré par le serveur : auteur, heure, montants, motif. Ces lignes ne peuvent être ni modifiées ni supprimées.", `<button class="btn" data-act="export-audit">${icon("download")}Exporter</button>`)}
  <div class="card"><div class="card-b"><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))">
      <div class="field"><label for="a-from">Du</label><input type="date" id="a-from" data-af="from" value="${S.af.from}"></div>
      <div class="field"><label for="a-to">Au</label><input type="date" id="a-to" data-af="to" value="${S.af.to}"></div>
      <div class="field"><label for="a-by">Utilisateur</label><select id="a-by" data-af="by"><option value="">Tous</option>${users.map(([id, n]) => `<option value="${esc(id)}"${S.af.by === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
      <div class="field"><label for="a-act">Opération</label><select id="a-act" data-af="action"><option value="">Toutes</option><option value="encaissement"${S.af.action === "encaissement" ? " selected" : ""}>Encaissements</option><option value="annulation"${S.af.action === "annulation" ? " selected" : ""}>Annulations</option></select></div>
  </div></div></div>
  ${perRows ? `<div class="card"><div class="card-h"><div><h2>Récapitulatif par utilisateur</h2><p>Sur la période sélectionnée</p></div></div><div class="card-b flush" style="margin-top:10px"><div class="scroller"><table class="list rt"><thead><tr><th>Utilisateur</th><th class="num">Encaissements</th><th class="num">Montant encaissé</th><th class="num">Annulations</th><th class="num">Montant annulé</th><th class="num">Net</th></tr></thead><tbody>${perRows}</tbody></table></div></div></div>` : ""}
  <div class="card">${S.audit.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Opération</th><th>Date et heure</th><th>Utilisateur</th><th>Famille</th><th class="num">Montant</th><th>Détails</th></tr></thead><tbody>${rows}</tbody></table></div>${bar}`
    : emptyState("shield", "Aucune opération sur cette période", "Changez les dates ou les filtres.")}</div>`;
}

/* =====================================================================
   Paramètres
   ===================================================================== */
function ensureDraft() {
  if (!S.draft || S.draft.sid !== S.sid || S.draft.yid !== S.yid) {
    const sc = school(), y = year();
    S.draft = JSON.parse(JSON.stringify({ sid: S.sid, yid: S.yid, name: sc.name, sigle: sc.sigle || "", adresse: sc.adresse || "", tel: sc.tel || "", fields: sc.fields || {}, classes: (y?.classes || []).map((c) => ({ ins_fee: 0, ...c })), months: y?.months || [] }));
    const df = defaultFields();
    ["student", "family"].forEach((g) => { S.draft.fields[g] = S.draft.fields[g] || {}; for (const k in df[g]) if (!S.draft.fields[g][k]) S.draft.fields[g][k] = df[g][k]; });
    S.draftDirty = false;
  }
  return S.draft;
}
function yearStats(y) {
  const enr = S.enrollments.filter((e) => e.year_id === y.id);
  const ca = S.linesAll.filter((l) => l.yearId === y.id).reduce((a, l) => a + l.amount, 0);
  return { n: enr.length, ab: enr.filter((e) => e.statut === "Abandon").length, ca };
}
function viewSettings() {
  const d = ensureDraft(), used = new Set(S.students.map((s) => s.classId)), t = S.settingsTab, yl = esc(year().label);
  const tabs = [["etab", "Établissement"], ["annees", "Années scolaires"], ["classes", "Classes et frais"], ["mois", "Mois de paiement"], ["champs", "Champs des fiches"]];
  const fieldRows = (g, defs) => defs.map((x) => { const c = d.fields[g][x.k]; return `<tr><td>${esc(x.l)}</td><td style="text-align:center"><input type="checkbox" class="switch" data-fld="${g}" data-k="${x.k}" data-p="show"${c.show ? " checked" : ""} aria-label="Afficher ${esc(x.l)}"></td><td style="text-align:center"><input type="checkbox" class="switch" data-fld="${g}" data-k="${x.k}" data-p="req"${c.req ? " checked" : ""} aria-label="Obligatoire ${esc(x.l)}"></td></tr>`; }).join("");
  let body = "";
  if (t === "etab") body = `<div class="card"><div class="card-h"><div><h2>Identité de l'établissement</h2><p>Ces informations apparaissent sur les reçus.</p></div></div><div class="card-b"><div class="form">
      <div class="field full"><label for="c-name">Nom</label><input id="c-name" data-cfg="name" value="${esc(d.name)}"></div>
      <div class="field"><label for="c-sigle">Sigle</label><input id="c-sigle" data-cfg="sigle" value="${esc(d.sigle)}"></div>
      <div class="field"><label for="c-adr">Adresse</label><input id="c-adr" data-cfg="adresse" value="${esc(d.adresse)}"></div>
      <div class="field"><label for="c-tel">Téléphone</label><input id="c-tel" data-cfg="tel" value="${esc(d.tel)}"></div></div></div></div>`;
  if (t === "annees") {
    const rows = [...S.years].sort((a, b) => b.label.localeCompare(a.label)).map((y) => { const st = yearStats(y), on = (y.months || []).filter((m) => m.on); return `<tr><td class="rt-title"><b>${esc(y.label)}</b> ${y.is_current ? '<span class="pill ok">En cours</span>' : ""}${y.id === S.yid ? ' <span class="pill mute plain">affichée</span>' : ""}</td>
      <td data-label="Période">${on.length ? esc(mLabel(on[0].key)) + " → " + esc(mLabel(on.at(-1).key)) : "—"}</td><td data-label="Élèves" class="num">${st.n}</td><td data-label="Abandons" class="num">${st.ab}</td><td data-label="Encaissé" class="num">${F(st.ca)}</td>
      <td class="actions-cell" data-label=""><div class="row">${y.id !== S.yid ? `<button class="btn sm" data-act="open-year" data-id="${y.id}">Afficher</button>` : ""}${y.is_current ? "" : `<button class="btn sm" data-act="set-current" data-id="${y.id}">Définir en cours</button>`}</div></td></tr>`; }).join("");
    body = `<div class="card"><div class="card-h"><div><h2>Années scolaires</h2><p>Chaque année a ses classes, ses tarifs, ses mois et ses inscriptions. L'année « en cours » s'ouvre par défaut pour tous les utilisateurs.</p></div><button class="btn sm primary" data-act="new-year">${icon("plus", "sm")}Nouvelle année</button></div>
      <div class="card-b flush" style="margin-top:12px"><div class="scroller"><table class="list rt"><thead><tr><th>Année</th><th>Période</th><th class="num">Élèves</th><th class="num">Abandons</th><th class="num">Encaissé</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div></div>
      <div class="banner info">${icon("info")}<span>Pour une nouvelle rentrée : créez l'année, définissez-la « en cours », puis réinscrivez les élèves depuis la page Élèves. L'ancienne année reste consultable, avec ses impayés.</span></div>`;
  }
  if (t === "classes") body = `<div class="card"><div class="card-h"><div><h2>Classes et frais · ${yl}</h2><p>Mensualité d'un élève = mensualité de la classe − sa réduction. Les frais d'inscription sont dus une fois par année, même en cas d'abandon.</p></div><button class="btn sm" data-act="cls-add">${icon("plus", "sm")}Ajouter</button></div>
    <div class="card-b"><div class="scroller"><table class="cfgtable"><thead><tr><th>Classe</th><th>Mensualité (FCFA)</th><th>Inscription (FCFA)</th><th>Élèves</th><th></th></tr></thead><tbody>
    ${d.classes.map((c, i) => { const n = S.students.filter((s) => s.classId === c.id && s.statut !== "Abandon").length; return `<tr><td><input type="text" id="cl-n-${i}" data-cls="name" data-i="${i}" value="${esc(c.name)}" aria-label="Nom de la classe"></td><td><input type="number" min="0" step="500" id="cl-f-${i}" data-cls="fee" data-i="${i}" value="${+c.fee || 0}" aria-label="Mensualité"></td><td><input type="number" min="0" step="500" id="cl-i-${i}" data-cls="ins_fee" data-i="${i}" value="${+c.ins_fee || 0}" aria-label="Frais d'inscription"></td><td class="mono">${n}</td>
    <td><button class="btn sm icon" data-act="cls-del" data-i="${i}" ${used.has(c.id) ? 'disabled title="Des élèves sont inscrits dans cette classe"' : 'title="Retirer"'} aria-label="Retirer">${icon("trash", "sm")}</button></td></tr>`; }).join("")}
    </tbody></table></div></div></div>`;
  if (t === "mois") {
    const first = d.months[0]?.key || nowKey(), last = d.months[d.months.length - 1]?.key || nowKey();
    body = `<div class="card"><div class="card-h"><div><h2>Mois de paiement · ${yl}</h2><p>Choisissez la période, puis désactivez les mois non payants (vacances, mois offert…). Le libellé est celui affiché dans le registre.</p></div></div><div class="card-b" style="display:flex;flex-direction:column;gap:16px">
    <div class="row" style="align-items:flex-end"><div class="field"><label for="m-a">Premier mois</label><input type="month" id="m-a" value="${first}"></div><div class="field"><label for="m-b">Dernier mois</label><input type="month" id="m-b" value="${last}"></div><button class="btn" data-act="months-gen">Appliquer la période</button></div>
    <div class="monthgrid">${d.months.map((m, i) => `<label class="${m.on ? "" : "off"}"><input type="checkbox" class="switch" data-mon="on" data-i="${i}"${m.on ? " checked" : ""} aria-label="Activer ${mLabel(m.key)}"><input type="text" id="mo-${i}" data-mon="label" data-i="${i}" value="${esc(m.label || mLabel(m.key))}"></label>`).join("")}</div></div></div>`;
  }
  if (t === "champs") body = `<div class="dash">
    <div class="card span-6"><div class="card-h"><div><h2>Fiche élève</h2><p>Nom, famille, classe et date d'inscription sont toujours demandés.</p></div></div><div class="card-b flush" style="margin-top:10px"><div class="scroller"><table class="cfgtable list"><thead><tr><th>Champ</th><th style="text-align:center">Afficher</th><th style="text-align:center">Obligatoire</th></tr></thead><tbody>${fieldRows("student", STUDENT_FIELDS.filter((x) => x.k !== "dateInscription"))}</tbody></table></div></div></div>
    <div class="card span-6"><div class="card-h"><div><h2>Fiche famille / tuteur</h2><p>Le code et le nom de famille sont toujours demandés.</p></div></div><div class="card-b flush" style="margin-top:10px"><div class="scroller"><table class="cfgtable list"><thead><tr><th>Champ</th><th style="text-align:center">Afficher</th><th style="text-align:center">Obligatoire</th></tr></thead><tbody>${fieldRows("family", FAMILY_FIELDS)}</tbody></table></div></div></div></div>`;
  return `${pageHead("Paramètres", "Configuration de l'établissement et de ses années scolaires.")}
  <div class="tabs-seg" role="tablist">${tabs.map(([k, l]) => `<button data-act="stab" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join("")}</div>
  ${body}
  ${t === "annees" ? "" : `<div class="savebar"><span class="meta">${S.draftDirty ? "Modifications non enregistrées." : "Aucune modification en attente."}</span><div class="row"><button class="btn" data-act="reset-settings" ${S.draftDirty ? "" : "disabled"}>Annuler</button><button class="btn primary" data-act="save-settings" ${S.draftDirty ? "" : "disabled"}>${icon("check")}Enregistrer</button></div></div>`}`;
}
/* =====================================================================
   Utilisateurs & plateforme
   ===================================================================== */
function viewUsers() {
  const F_ = isFondateur();
  const rows = S.members.map((m) => {
    const me = m.user_id === S.user.id, n = m.profiles?.full_name || m.profiles?.email || "";
    return `<tr><td class="rt-title"><div class="row" style="flex-wrap:nowrap"><span class="avatar">${esc(initials(n))}</span><div style="min-width:0"><b>${esc(n)}</b>${me ? ' <span class="pill mute plain">vous</span>' : ""}<span class="sub">${esc(m.profiles?.email || "")}</span></div></div></td>
    <td data-label="Rôle">${esc(ROLE_LABEL[m.role])}</td><td data-label="Statut">${m.active ? '<span class="pill ok">Actif</span>' : '<span class="pill late">Désactivé</span>'}</td><td data-label="Ajouté le">${fmtDate(m.created_at)}</td>
    <td class="actions-cell" data-label="">${F_ && !me ? `<div class="row">
      <button class="btn sm" data-act="member-reset" data-id="${m.user_id}">${icon("key", "sm")}Mot de passe</button>
      <button class="btn sm" data-act="member-role" data-id="${m.user_id}" data-v="${m.role === "admin" ? "fondateur" : "admin"}">Passer ${m.role === "admin" ? "Fondateur" : "Administrateur"}</button>
      <button class="btn sm ${m.active ? "outline-danger" : ""}" data-act="member-active" data-id="${m.user_id}" data-v="${m.active ? "0" : "1"}">${m.active ? "Désactiver" : "Réactiver"}</button></div>` : ""}</td></tr>`;
  }).join("");
  return `${pageHead("Utilisateurs", `Seules ces personnes peuvent ouvrir les données de ${esc(school().name)}. Le Fondateur et l'Administrateur ont les mêmes droits sur la scolarité et la caisse ; seul le Fondateur gère les comptes.`, F_ ? `<button class="btn primary" data-act="member-add">${icon("plus")}Ajouter un utilisateur</button>` : "")}
  ${F_ ? "" : `<div class="banner info">${icon("info")}<span>Pour ajouter ou retirer un compte, adressez-vous au Fondateur.</span></div>`}
  <div class="card"><div class="scroller"><table class="list rt"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Ajouté le</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function viewPlatform() {
  const { schools, founders } = S.platform;
  const rows = schools.map((s) => {
    const fo = founders.filter((f) => f.school_id === s.id);
    return `<tr><td class="rt-title"><b>${esc(s.name)}</b>${s.sigle ? ` <span class="meta">(${esc(s.sigle)})</span>` : ""}</td><td data-label="Année">${esc(s.annee || "—")}</td>
    <td data-label="Fondateur(s)">${fo.length ? fo.map((f) => `${esc(f.profiles?.full_name)}<span class="sub">${esc(f.profiles?.email)}${f.active ? "" : " · désactivé"}</span>`).join("") : '<span class="pill late">Aucun Fondateur</span>'}</td>
    <td data-label="Créé le">${fmtDate(s.created_at)}</td><td class="actions-cell" data-label=""><button class="btn sm" data-act="add-founder" data-id="${s.id}">${icon("plus", "sm")}Fondateur</button></td></tr>`;
  }).join("");
  return `${pageHead("Établissements", "Réservé au super-admin : vous créez les établissements et leur Fondateur. Vous ne voyez pas leurs élèves, familles ni paiements.", `<button class="btn primary" data-act="new-school">${icon("plus")}Nouvel établissement</button>`)}
  <div class="kpis"><div class="card kpi"><div class="k-top"><span class="k-lbl">Établissements</span><span class="k-ico">${icon("building")}</span></div><div class="k-val">${schools.length}</div></div>
    <div class="card kpi"><div class="k-top"><span class="k-lbl">Fondateurs actifs</span><span class="k-ico">${icon("users")}</span></div><div class="k-val">${founders.filter((f) => f.active).length}</div></div>
    <div class="card kpi late"><div class="k-top"><span class="k-lbl">Sans Fondateur</span><span class="k-ico">${icon("alert")}</span></div><div class="k-val">${schools.filter((s) => !founders.some((f) => f.school_id === s.id && f.active)).length}</div></div></div>
  <div class="card">${schools.length ? `<div class="scroller"><table class="list rt"><thead><tr><th>Établissement</th><th>Année</th><th>Fondateur(s)</th><th>Créé le</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("building", "Aucun établissement", "Créez le premier établissement et son Fondateur.")}</div>`;
}

/* =====================================================================
   Modales
   ===================================================================== */
function inputFor(def, val, req, prefix) {
  const id = prefix + def.k, lab = `<label for="${id}">${esc(def.l)}${req ? " <em>*</em>" : ""}</label>`;
  let inp;
  if (def.t === "select") inp = `<select id="${id}" name="${def.k}"><option value="">—</option>${def.o.map((o) => `<option${val === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  else if (def.t === "textarea") inp = `<textarea id="${id}" name="${def.k}" rows="2">${esc(val || "")}</textarea>`;
  else inp = `<input id="${id}" name="${def.k}" type="${def.t}" value="${esc(val || "")}">`;
  return `<div class="field${def.t === "textarea" ? " full" : ""}">${lab}${inp}${def.hint ? `<span class="hint">${esc(def.hint)}</span>` : ""}</div>`;
}
function modal(html) { const m = $("modal"); m.innerHTML = html; m.hidden = false; document.body.style.overflow = "hidden"; const f = m.querySelector("input:not([type=hidden]):not([readonly]),select,textarea") || m.querySelector(".dlg-f .btn.primary"); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { const m = $("modal"); m.hidden = true; m.innerHTML = ""; S.pay = null; document.body.style.overflow = ""; }
function formErr(msg) { const m = $("modal"); const e = m.querySelector(".err"); if (e && !m.hidden) { e.textContent = msg; return true; } return false; }
const dlg = ({ title, sub = "", body, foot, size = "narrow", id = "", tag = "form" }) => `<${tag} class="dlg ${size}" ${id ? `id="${id}"` : ""} role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dlg-h"><div><h3 id="dlg-t">${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div><button type="button" class="x" data-act="close" aria-label="Fermer">${icon("x")}</button></div><div class="dlg-b">${body}</div><div class="dlg-f"><span class="err" role="alert"></span>${foot}</div></${tag}>`;
let confirmFn = null;
function openConfirm({ title, text, ok = "Confirmer", danger = true, onOk }) {
  confirmFn = onOk;
  modal(dlg({ title, size: "xs", tag: "div", body: `<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="confirm-ico">${icon("alert")}</div><p style="margin:0">${text}</p></div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button type="button" class="btn ${danger ? "danger" : "primary"}" data-act="confirm-ok">${ok}</button>` }));
}

/* Familles */
function openFamily(id) {
  const f = id ? S.families.find((x) => x.id === id) : { code: nextFamCode(), dateInscription: today() }; const cfg = fcfg("family");
  const sts = id ? studentsOfFam(id, true) : [], anySt = id ? S.studentsAll.some((x) => x.familyId === id) : false;
  modal(dlg({ title: id ? `Famille ${esc(f.code)}` : "Nouvelle famille", sub: id ? esc(f.nom) : "Regroupe les frères et sœurs et les coordonnées du tuteur", id: "fam-form",
    body: `<div class="form">
      <div class="field"><label for="fa-code">Code famille <em>*</em></label><input id="fa-code" name="code" value="${esc(f.code || "")}"></div>
      <div class="field"><label for="fa-nom">Nom de la famille <em>*</em></label><input id="fa-nom" name="nom" value="${esc(f.nom || "")}" placeholder="ex. Issak Haroun"></div>
      <div class="subhead">Tuteur et coordonnées</div>
      ${FAMILY_FIELDS.filter((d) => cfg[d.k]?.show).map((d) => inputFor(d, f[d.k], cfg[d.k].req, "fa-")).join("")}
    </div>
    ${id ? `<div><div class="subhead" style="margin-bottom:8px">Enfants inscrits en ${esc(year().label)} (${sts.length})</div>${sts.length ? `<div class="member-list">${sts.map((s) => `<div><span><b>${esc(s.nom)}</b> <span class="meta">· ${esc(clsOf(s)?.name || "")}${s.statut === "Abandon" ? " · abandon" : ""}</span></span><button type="button" class="btn sm" data-act="edit-student" data-id="${s.id}">Ouvrir</button></div>`).join("")}</div>` : '<p class="meta" style="margin:0">Aucun élève.</p>'}</div>` : ""}`,
    foot: `${id && !anySt ? `<button type="button" class="btn outline-danger left" data-act="del-family" data-id="${id}">${icon("trash", "sm")}Supprimer</button>` : ""}${id ? `<button type="button" class="btn" data-act="new-student" data-fam="${id}">${icon("plus", "sm")}Inscrire un enfant</button>` : ""}<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button>` }));
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
/* Élèves */
function openStudent(id, famId) {
  if (!S.families.length) { toast("Créez d'abord une famille."); return openFamily(); }
  const s = id ? S.students.find((x) => x.id === id) : { familyId: famId || "", statut: "Actif", dateInscription: today(), reduction: 0, reductionIns: 0 }; const cfg = fcfg("student");
  if (!s) return;
  const payYear = id && S.lines.some((l) => l.studentId === id);
  const payAny = id && S.linesAll.some((l) => l.studentId === id);
  const nEnr = id ? S.enrollments.filter((e) => e.student_id === id).length : 0;
  const fa = id ? famOf(s) : null, cl = clsOf(s);
  const status = !id ? "" : s.statut === "Abandon"
    ? `<div class="banner late">${icon("ban")}<span><b>Abandon le ${fmtDate(s.dateSortie)}</b>${s.motifSortie ? " · " + esc(s.motifSortie) : ""}. Les mensualités après ${esc(mLabel(s.dateSortie.slice(0, 7)))} ne sont plus dues ; ce qui restait dû avant reste à recouvrer.</span></div>`
    : "";
  modal(dlg({ title: id ? esc(s.nom) : "Inscrire un élève", sub: (fa ? esc(fa.code + " · " + fa.nom) + " · " : "") + "Année " + esc(year().label), id: "stu-form",
    body: `${status}<div class="form">
      <div class="field full"><label for="st-nom">Nom & prénoms <em>*</em></label><input id="st-nom" name="nom" value="${esc(s.nom || "")}"></div>
      <div class="field"><label for="st-fam">Famille <em>*</em></label><select id="st-fam" name="familyId"><option value="">— Choisir —</option>${[...S.families].sort((a, b) => famNum(a.code) - famNum(b.code)).map((f) => `<option value="${f.id}"${s.familyId === f.id ? " selected" : ""}>${esc(f.code)} · ${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="field"><label for="st-cls">Classe <em>*</em></label><select id="st-cls" name="classId"><option value="">— Choisir —</option>${classes().map((c) => `<option value="${esc(c.id)}"${s.classId === c.id ? " selected" : ""}>${esc(c.name)} · ${F(c.fee)}/mois${+c.ins_fee ? " · inscr. " + F(c.ins_fee) : ""}</option>`).join("")}</select></div>
      <div class="field"><label for="st-red">Réduction sur la mensualité (FCFA)</label><input id="st-red" name="reduction" type="number" min="0" step="500" value="${+s.reduction || 0}"></div>
      <div class="field"><label for="st-redins">Réduction sur l'inscription (FCFA)</label><input id="st-redins" name="reductionIns" type="number" min="0" step="500" value="${+s.reductionIns || 0}"><span class="hint">${cl && +cl.ins_fee ? `Frais d'inscription de la classe : ${F(cl.ins_fee)}. Saisissez ce montant pour une exonération totale.` : "Pas de frais d'inscription pour cette classe."}</span></div>
      <div class="field"><label for="st-dateInscription">Date d'inscription <em>*</em></label><input id="st-dateInscription" name="dateInscription" type="date" value="${esc(s.dateInscription || "")}"><span class="hint">Les mensualités sont dues à partir de ce mois.</span></div>
      <div class="subhead">État civil</div>
      ${STUDENT_FIELDS.filter((d) => d.k !== "dateInscription" && cfg[d.k]?.show).map((d) => inputFor(d, s[d.k], cfg[d.k].req, "st-")).join("")}
    </div>${payAny ? `<div class="banner info">${icon("info")}<span>Cet élève a des paiements : il ne peut pas être supprimé. S'il quitte l'école, déclarez un abandon.</span></div>` : ""}`,
    foot: `${id && !payAny && nEnr <= 1 ? `<button type="button" class="btn outline-danger left" data-act="del-student" data-id="${id}">${icon("trash", "sm")}Supprimer</button>` : ""}${id && !payYear && nEnr > 1 ? `<button type="button" class="btn outline-danger left" data-act="unenroll" data-id="${id}">Retirer de ${esc(year().label)}</button>` : ""}${id ? (s.statut === "Abandon" ? `<button type="button" class="btn" data-act="cancel-abandon" data-id="${id}">Annuler l'abandon</button>` : `<button type="button" class="btn outline-danger" data-act="abandon" data-id="${id}">${icon("ban", "sm")}Déclarer un abandon</button>`) : ""}<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button>` }));
  $("stu-form").dataset.id = id || "";
}
async function saveStudent(form) {
  const id = form.dataset.id, fd = Object.fromEntries(new FormData(form)), cfg = fcfg("student");
  const nom = (fd.nom || "").trim();
  if (!nom || !fd.familyId || !fd.classId) return formErr("Le nom, la famille et la classe sont obligatoires.");
  if (!fd.dateInscription) return formErr("La date d'inscription est obligatoire.");
  const miss = STUDENT_FIELDS.filter((d) => d.k !== "dateInscription" && cfg[d.k]?.show && cfg[d.k].req && !String(fd[d.k] || "").trim()).map((d) => d.l);
  if (miss.length) return formErr("Champs obligatoires manquants : " + miss.join(", ") + ".");
  const old = id ? S.students.find((s) => s.id === id) : {};
  const info = {}; STUDENT_FIELDS.forEach((d) => { if (d.k === "dateInscription") return; const v = d.k in fd ? fd[d.k] : old[d.k]; if (v !== undefined && v !== "") info[d.k] = String(v).trim(); });
  const stu = { school_id: S.sid, family_id: fd.familyId, nom, info };
  const enr = { class_id: fd.classId, reduction: Math.max(0, Math.round(+fd.reduction || 0)), reduction_ins: Math.max(0, Math.round(+fd.reductionIns || 0)), date_inscription: fd.dateInscription };
  const ok = await run(async () => {
    if (id) {
      const { error } = await sb.from("students").update(stu).eq("id", id); if (error) throw error;
      const { error: e2 } = await sb.from("enrollments").update(enr).eq("id", old.enrId); if (e2) throw e2;
    } else {
      const { data, error } = await sb.from("students").insert(stu).select("id").single(); if (error) throw error;
      const { error: e2 } = await sb.from("enrollments").insert({ ...enr, school_id: S.sid, year_id: S.yid, student_id: data.id }); if (e2) throw e2;
    }
  }, id ? "Élève enregistré" : "Élève inscrit");
  if (ok) { closeModal(); loadSchoolData(); }
}
const MOTIFS = ["Déménagement", "Raisons financières", "Changement d'école", "Maladie", "Exclusion", "Autre"];
function openAbandon(id) {
  const s = S.students.find((x) => x.id === id); if (!s) return;
  const r = studentSummary(s, paidIndex());
  modal(dlg({ title: "Déclarer un abandon", sub: esc(s.nom) + " · " + esc(clsOf(s)?.name || "") + " · " + esc(year().label), id: "abandon-form",
    body: `<div class="form">
      <div class="field"><label for="ab-date">Date de départ <em>*</em></label><input id="ab-date" name="date" type="date" value="${today()}" min="${esc(s.dateInscription || "")}"><span class="hint">Le mois de départ reste dû ; les mois suivants ne le sont plus.</span></div>
      <div class="field"><label for="ab-motif">Motif <em>*</em></label><select id="ab-motif" name="motif">${MOTIFS.map((m) => `<option>${m}</option>`).join("")}</select></div>
      <div class="field full"><label for="ab-note">Précision</label><input id="ab-note" name="note" placeholder="ex. part au Cameroun avec sa famille"></div></div>
    <div class="banner">${icon("alert")}<span>Reste dû à ce jour : <b>${F(r.reste)} FCFA</b>. Ce montant reste à recouvrer auprès de la famille. Les rapports annuels comptent l'abandon et les mensualités perdues.</span></div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn danger" type="submit">Confirmer l'abandon</button>` }));
  $("abandon-form").dataset.id = id;
}
async function saveAbandon(form) {
  const s = S.students.find((x) => x.id === form.dataset.id), fd = Object.fromEntries(new FormData(form));
  if (!fd.date) return formErr("Indiquez la date de départ.");
  if (s.dateInscription && fd.date < s.dateInscription) return formErr("La date de départ est antérieure à l'inscription.");
  const PI = paidIndex(), dep = fd.date.slice(0, 7);
  const paidAfter = months().filter((m) => m.key > dep).reduce((a, m) => a + (PI.get(s.id + "|" + m.key) || 0), 0);
  if (paidAfter > 0) return formErr(`Des mois après ${mLabel(dep)} sont déjà payés (${F(paidAfter)} FCFA). Annulez d'abord ces reçus ou choisissez une date plus tardive.`);
  const motif = fd.motif + (fd.note.trim() ? " : " + fd.note.trim() : "");
  const ok = await run(async () => { const { error } = await sb.from("enrollments").update({ statut: "Abandon", date_sortie: fd.date, motif_sortie: motif }).eq("id", s.enrId); if (error) throw error; }, "Abandon enregistré");
  if (ok) { closeModal(); loadSchoolData(); }
}
function openPay(famId, stId, mk) {
  const PI = paidIndex(), fams = [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code));
  S.pay = { famId: famId || "", vals: {} };
  if (stId && mk) { const st = S.students.find((s) => s.id === stId); const r = (mk === "INS" ? dueIns(st) : dueFor(st, mk)) - (PI.get(stId + "|" + mk) || 0); if (r > 0) S.pay.vals[stId + "|" + mk] = r; }
  const fam = S.families.find((f) => f.id === famId);
  modal(dlg({ title: "Encaisser un paiement", sub: `Année ${esc(year().label)} · enregistré à votre nom : ${esc(S.profile.full_name || S.profile.email)}. Le numéro de reçu est attribué par le serveur.`, size: "", id: "pay-form",
    body: `<div class="form">
      <div class="field"><label for="p-fam">Famille <em>*</em></label><select id="p-fam" name="familyId"><option value="">— Choisir la famille —</option>${fams.map((f) => `<option value="${f.id}"${f.id === famId ? " selected" : ""}>${esc(f.code)} · ${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="field"><label for="p-date">Date <em>*</em></label><input id="p-date" name="date" type="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label for="p-mode">Mode de paiement</label><select id="p-mode" name="mode">${MODES.map((m) => `<option>${m}</option>`).join("")}</select></div>
      <div class="field"><label for="p-payer">Versé par</label><input id="p-payer" name="payer" value="${esc(fam?.tuteurNom || "")}"></div>
      <div class="field full"><label for="p-note">Note</label><input id="p-note" name="note" placeholder="ex. référence de la transaction Mobile Money"></div>
    </div><div id="pay-grid"></div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">${icon("check")}Enregistrer le paiement</button>` }));
  renderPayGrid();
}
function renderPayGrid() {
  const el = $("pay-grid"); if (!el) return;
  const P = S.pay, PI = paidIndex(), ms = months();
  if (!P.famId) { el.innerHTML = `<div class="banner info">${icon("info")}<span>Choisissez une famille pour afficher l'inscription et les mois à régler.</span></div>`; return; }
  const sts = studentsOfFam(P.famId, true);
  if (!sts.length) { el.innerHTML = `<div class="banner">${icon("alert")}<span>Cette famille n'a aucun élève inscrit en ${esc(year().label)}.</span></div>`; return; }
  let total = 0; Object.values(P.vals).forEach((v) => (total += +v || 0));
  let resteTot = 0;
  const cell = (st, key, d, p, past) => {
    const r = Math.max(0, d - p); if (past) resteTot += r;
    if (d <= 0) return '<td class="meta" style="text-align:center">—</td>';
    if (r <= 0) return '<td style="text-align:center"><span class="pill ok">Payé</span></td>';
    return `<td><input type="number" inputmode="numeric" min="0" max="${r}" step="500" id="pv-${st.id}-${key}" data-pv="${st.id}|${key}" value="${P.vals[st.id + "|" + key] || ""}" placeholder="0" aria-label="${esc(st.nom)} ${key === "INS" ? "inscription" : esc(mLabel(key))}"><div class="due">reste ${F(r)}</div></td>`;
  };
  const rows = sts.map((st) => `<tr><td class="stick"><b>${esc(st.nom)}</b><div class="meta">${esc(clsOf(st)?.name || "")} · ${F(monthly(st))}/mois${st.statut === "Abandon" ? " · abandon" : ""}</div></td>${cell(st, "INS", dueIns(st), PI.get(st.id + "|INS") || 0, true)}${ms.map((m) => cell(st, m.key, dueFor(st, m.key), PI.get(st.id + "|" + m.key) || 0, m.key <= nowKey())).join("")}</tr>`).join("");
  el.innerHTML = `<div class="totalbar"><div class="field" style="flex:1 1 180px"><label for="p-amount">Montant reçu</label><input type="number" inputmode="numeric" min="0" step="500" id="p-amount" placeholder="ex. 50000"></div>
    <button type="button" class="btn" data-act="spread" style="align-self:flex-end">Répartir (inscription, puis mois les plus anciens)</button><button type="button" class="btn ghost" data-act="clear-pv" style="align-self:flex-end">Vider</button>
    <span class="meta" style="align-self:flex-end;padding-bottom:9px">Reste échu de la famille : <b class="mono">${F(resteTot)}</b></span></div>
  <div class="card"><div class="scroller paygrid"><table class="ledger"><thead><tr><th class="stick">Élève</th><th style="text-align:center">Inscription</th>${ms.map((m) => `<th style="text-align:center">${esc(m.label || mLabel(m.key))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="totalbar" style="justify-content:space-between"><span>Total de ce reçu</span><b id="p-total">${F(total)} FCFA</b></div>`;
}
function spread() {
  const amt = +$("p-amount").value || 0; if (amt <= 0) return toast("Saisissez le montant reçu.", "err");
  const PI = paidIndex(), P = S.pay; P.vals = {}; let left = amt;
  const sts = studentsOfFam(P.famId, true);
  const take = (st, key, d) => { if (left <= 0) return; const r = Math.max(0, d - (PI.get(st.id + "|" + key) || 0)); if (r > 0) { const v = Math.min(r, left); P.vals[st.id + "|" + key] = v; left -= v; } };
  for (const st of sts) take(st, "INS", dueIns(st));
  for (const m of months()) for (const st of sts) take(st, m.key, dueFor(st, m.key));
  renderPayGrid(); $("p-amount").value = amt;
  if (left > 0) toast(F(left) + " FCFA dépassent le total dû et n'ont pas été affectés.", "err");
}
async function savePay(form) {
  const fd = Object.fromEntries(new FormData(form)), P = S.pay;
  if (!fd.familyId) return formErr("Choisissez la famille.");
  if (!fd.date) return formErr("Indiquez la date du paiement.");
  const PI = paidIndex();
  const lines = Object.entries(P.vals).filter(([, v]) => +v > 0);
  if (!lines.length) return formErr("Saisissez au moins un montant dans la grille.");
  for (const [k, v] of lines) { const [sid, mk] = k.split("|"); const st = S.students.find((s) => s.id === sid); const r = (mk === "INS" ? dueIns(st) : dueFor(st, mk)) - (PI.get(k) || 0); if (+v > r) return formErr(`Le montant pour ${st.nom} (${mk === "INS" ? "inscription" : mLabel(mk)}) dépasse le reste dû de ${F(r)}.`); }
  const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Enregistrement…";
  const res = await run(async () => {
    const { data, error } = await sb.rpc("create_receipt", { p_school: S.sid, p_year: S.yid, p_family: fd.familyId, p_date: fd.date, p_mode: fd.mode, p_payer: fd.payer || "", p_note: fd.note || "",
      p_lines: lines.map(([k, v]) => { const [sid, mk] = k.split("|"); return mk === "INS" ? { student_id: sid, kind: "inscription", amount: Math.round(+v) } : { student_id: sid, kind: "mensualite", month: mk, amount: Math.round(+v) }; }) });
    if (error) throw error; return data;
  });
  if (!res) { btn.disabled = false; btn.innerHTML = `${icon("check")}Enregistrer le paiement`; return; }
  toast(`Reçu ${res.number} enregistré : ${F(res.total)} FCFA`, "ok");
  closeModal(); await loadSchoolData(); openReceipt(res.id);
}
function openReceipt(id) {
  const r = S.receipts.find((x) => x.id === id); if (!r) return; const sc = school();
  const ry = S.years.find((y) => y.id === r.year_id);
  const lines = r.payment_lines.slice().sort((a, b) => (a.month || "0").localeCompare(b.month || "0") || a.student_nom.localeCompare(b.student_nom)).map((l) => `<tr><td>${esc(l.student_nom)}</td><td>${esc(l.kind === "inscription" ? "Inscription " + (ry?.label || "") : (ry?.months.find((m) => m.key === l.month)?.label || mLabel(l.month)))}</td><td class="num">${F(l.amount)}</td></tr>`).join("");
  modal(dlg({ title: `Reçu ${esc(r.number)}`, sub: fmtDate(r.date), tag: "div",
    body: `<div class="rcpt-head"><div><b style="font-size:16px">${esc(sc.name)}</b><div class="meta">${esc(sc.adresse || "")}${sc.tel ? " · " + esc(sc.tel) : ""}<br>Année scolaire ${esc(ry?.label || "")}</div></div>${r.status === "annule" ? '<span class="stamp">Annulé</span>' : '<span class="pill ok">Valide</span>'}</div>
    <div class="kv"><div><span>Famille</span><b>${esc(r.family_code + " · " + r.family_nom)}</b></div><div><span>Versé par</span><b>${esc(r.payer || "—")}</b></div><div><span>Mode</span><b>${esc(r.mode)}</b></div><div><span>Encaissé par</span><b>${esc(r.created_by_name)}</b><div class="meta">${fmtDateTime(r.created_at)}</div></div></div>
    <div class="card"><div class="scroller"><table class="list"><thead><tr><th>Élève</th><th>Objet</th><th class="num">Montant (FCFA)</th></tr></thead><tbody>${lines}</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${F(r.total)} FCFA</td></tr></tfoot></table></div></div>
    ${r.note ? `<p class="meta" style="margin:0">Note : ${esc(r.note)}</p>` : ""}
    ${r.status === "annule" ? `<div class="banner late">${icon("ban")}<span>Annulé le ${fmtDateTime(r.cancelled_at)} par ${esc(r.cancelled_by_name)}. Motif : ${esc(r.cancel_reason)}</span></div>` : ""}
    <div class="sig"><span>Signature du parent</span><span>Cachet et signature de la caisse</span></div>`,
    foot: `${r.status === "valide" ? `<button class="btn outline-danger left" data-act="cancel-receipt" data-id="${r.id}">Annuler ce reçu</button>` : ""}<button class="btn" data-act="print">${icon("printer")}Imprimer</button><button class="btn primary" data-act="close">Fermer</button>` }));
}
function openCancel(id) {
  const r = S.receipts.find((x) => x.id === id); if (!r) return;
  modal(dlg({ title: `Annuler le reçu ${esc(r.number)}`, id: "cancel-form",
    body: `<div class="kv"><div><span>Famille</span><b>${esc(r.family_code + " · " + r.family_nom)}</b></div><div><span>Montant</span><b class="mono">${F(r.total)} FCFA</b></div><div><span>Encaissé par</span><b>${esc(r.created_by_name)}</b><div class="meta">le ${fmtDate(r.date)}</div></div></div>
    <div class="banner">${icon("alert")}<span>Le reçu restera visible, barré. L'annulation sera inscrite dans l'audit à votre nom et les mois concernés redeviendront impayés.</span></div>
    <div class="field"><label for="c-reason">Motif de l'annulation <em>*</em></label><textarea id="c-reason" name="reason" rows="3" required minlength="5" placeholder="ex. Erreur de famille, montant saisi deux fois…"></textarea></div>`,
    foot: `<button type="button" class="btn" data-act="close">Retour</button><button class="btn danger" type="submit">Confirmer l'annulation</button>` }));
  $("cancel-form").dataset.id = id;
}
async function saveCancel(form) {
  const reason = (new FormData(form).get("reason") || "").trim();
  if (reason.length < 5) return formErr("Indiquez un motif d'au moins 5 caractères.");
  const ok = await run(async () => { const { error } = await sb.rpc("cancel_receipt", { p_receipt: form.dataset.id, p_reason: reason }); if (error) throw error; }, "Reçu annulé");
  if (ok) { closeModal(); S.auditLoaded = false; loadSchoolData(); }
}

/* Compte */
function openAccount() {
  if (S.menuOpen) { S.menuOpen = false; render(); }
  const p = S.profile, last = S.user?.last_sign_in_at, ms = S.memberships;
  modal(dlg({ title: "Mon compte", tag: "div", size: "narrow",
    body: `<div class="profile"><span class="avatar">${esc(initials(p.full_name || p.email))}</span><div style="min-width:0"><b>${esc(p.full_name || "—")}</b><span class="meta" style="word-break:break-all">${esc(p.email)}</span></div></div>
    <div class="kv"><div><span>Type de compte</span><b>${isSuper() ? "Super-admin de la plateforme" : "Membre d'établissement"}</b></div>${last ? `<div><span>Dernière connexion</span><b>${fmtDateTime(last)}</b></div>` : ""}</div>
    ${ms.length ? `<div><div class="subhead" style="margin-bottom:8px">Établissements</div><div class="member-list">${ms.map((m) => `<div><span><b>${esc(m.schools.name)}</b>${m.school_id === S.sid ? ' <span class="pill mute plain">ouvert</span>' : ""}</span><span class="pill ${m.role === "fondateur" ? "part" : "mute"} plain">${ROLE_LABEL[m.role]}</span></div>`).join("")}</div></div>` : ""}
    <div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="avatar" style="border-radius:10px">${icon("lock")}</span>
      <div style="flex:1;min-width:180px"><b>Mot de passe</b><div class="meta">Changez-le régulièrement et ne le partagez avec personne.</div></div><button class="btn" data-act="password">Changer le mot de passe</button></div>`,
    foot: `<button class="btn outline-danger left" data-act="logout">${icon("logout")}Se déconnecter</button><button class="btn primary" data-act="close">Fermer</button>` }));
}
function openPassword() {
  if (S.menuOpen) { S.menuOpen = false; render(); }
  modal(dlg({ title: "Changer le mot de passe", sub: "Vous resterez connecté sur cet appareil.", size: "xs", id: "password-form",
    body: `${pwField("cp-0", "p0", "Mot de passe actuel", { ac: "current-password" })}${pwField("cp-1", "p1", "Nouveau mot de passe", { meter: true })}${pwField("cp-2", "p2", "Confirmez le nouveau mot de passe")}`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button>` }));
}
function checkNewPassword(p1, p2) {
  if ((p1 || "").length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/\d/.test(p1) || !/[a-zA-Z]/.test(p1)) return "Mélangez des lettres et des chiffres.";
  if (p1 !== p2) return "Les deux mots de passe ne correspondent pas.";
  return "";
}
async function applyNewPassword(p1) {
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) throw new Error(/same|different from the old/i.test(error.message) ? "Choisissez un mot de passe différent de l'ancien." : errMsg(error));
  await sb.rpc("mark_password_changed");
}
function memberForm(title, schoolId, roleChoice) {
  modal(dlg({ title, sub: roleChoice ? esc(school()?.name || "") : esc(S.platform.schools.find((s) => s.id === schoolId)?.name || ""), id: "member-form",
    body: `<div class="form">
      <div class="field"><label for="mb-name">Nom complet <em>*</em></label><input id="mb-name" name="full_name" required></div>
      <div class="field"><label for="mb-email">E-mail <em>*</em></label><input id="mb-email" name="email" type="email" required></div>
      ${roleChoice ? `<div class="field"><label for="mb-role">Rôle</label><select id="mb-role" name="role"><option value="admin">Administrateur</option><option value="fondateur">Fondateur</option></select></div>` : '<input type="hidden" name="role" value="fondateur">'}
      <div class="field full"><label for="mb-pw">Mot de passe provisoire</label><input id="mb-pw" name="password" value="${genPassword()}" class="mono"><span class="hint">À remettre en main propre ; il devra être changé à la première connexion. Si la personne a déjà un compte, son mot de passe actuel reste valable.</span></div>
    </div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Créer l'accès</button>` }));
  $("member-form").dataset.school = schoolId;
}
function openNewSchool() {
  if (!isSuper()) return toast("Seul le super-admin peut créer un établissement.", "err");
  const y = new Date().getFullYear(), m = new Date().getMonth() + 1, start = m >= 7 ? y : y - 1;
  modal(dlg({ title: "Nouvel établissement", sub: "Les classes standard sont créées automatiquement et restent modifiables.", id: "school-form",
    body: `<div class="form">
      <div class="field full"><label for="ns-name">Nom de l'établissement <em>*</em></label><input id="ns-name" name="name" required></div>
      <div class="field"><label for="ns-sigle">Sigle</label><input id="ns-sigle" name="sigle"></div>
      <div class="field"><label for="ns-annee">Année scolaire</label><input id="ns-annee" name="annee" value="${start}-${start + 1}"></div>
      <div class="field"><label for="ns-a">Premier mois payant</label><input id="ns-a" name="from" type="month" value="${start}-10"></div>
      <div class="field"><label for="ns-b">Dernier mois payant</label><input id="ns-b" name="to" type="month" value="${start + 1}-06"></div>
      <div class="field"><label for="ns-fee">Mensualité par défaut (FCFA)</label><input id="ns-fee" name="fee" type="number" min="0" step="500" value="25000"></div>
      <div class="subhead">Fondateur</div>
      <div class="field"><label for="ns-fn">Nom complet <em>*</em></label><input id="ns-fn" name="f_name" required></div>
      <div class="field"><label for="ns-fe">E-mail <em>*</em></label><input id="ns-fe" name="f_email" type="email" required></div>
      <div class="field full"><label for="ns-fp">Mot de passe provisoire</label><input id="ns-fp" name="f_password" class="mono" value="${genPassword()}"><span class="hint">À remettre au Fondateur ; il le changera à sa première connexion.</span></div>
    </div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Créer l'établissement</button>` }));
}
function showPassword(title, who, pw) {
  modal(dlg({ title, tag: "div", size: "xs",
    body: `<p style="margin:0">Mot de passe provisoire de <b>${esc(who)}</b> :</p><div class="pwbox" id="pw-show">${esc(pw)}</div><div class="banner">${icon("alert")}<span>Notez-le maintenant : il ne sera plus affiché. La personne devra le changer à sa prochaine connexion.</span></div>`,
    foot: `<button class="btn" data-act="copy-pw">Copier</button><button class="btn primary" data-act="close">J'ai noté le mot de passe</button>` }));
}

/* =====================================================================
   Exports CSV
   ===================================================================== */
/* =====================================================================
   Années scolaires : création et réinscription
   ===================================================================== */
function nextLabel(l) { const m = String(l || "").match(/(\d{4})\s*[-\/]\s*(\d{4})/); return m ? `${+m[1] + 1}-${+m[2] + 1}` : ""; }
function shiftMonth(k, n) { let [y, m] = k.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } return y + "-" + pad(m); }
function openNewYear() {
  const src = year() || S.years.at(-1), on = (src?.months || []).filter((m) => m.on);
  const a = on.length ? shiftMonth(on[0].key, 12) : nowKey(), b = on.length ? shiftMonth(on.at(-1).key, 12) : shiftMonth(nowKey(), 8);
  modal(dlg({ title: "Nouvelle année scolaire", sub: "L'année est créée sans élèves ; vous les réinscrirez ensuite.", id: "year-form",
    body: `<div class="form">
      <div class="field full"><label for="ny-label">Libellé <em>*</em></label><input id="ny-label" name="label" value="${esc(nextLabel(src?.label))}" placeholder="2027-2028"></div>
      <div class="field"><label for="ny-a">Premier mois payant</label><input id="ny-a" name="from" type="month" value="${a}"></div>
      <div class="field"><label for="ny-b">Dernier mois payant</label><input id="ny-b" name="to" type="month" value="${b}"></div>
      ${src ? `<label class="chk field full" style="flex-direction:row"><input type="checkbox" name="copy" checked> Reprendre les classes, mensualités et frais d'inscription de ${esc(src.label)}</label>` : ""}
      <label class="chk field full" style="flex-direction:row"><input type="checkbox" name="current"> En faire l'année en cours dès maintenant</label>
    </div>`,
    foot: `<button type="button" class="btn" data-act="close">Annuler</button><button class="btn primary" type="submit">Créer l'année</button>` }));
  $("year-form").dataset.src = src?.id || "";
}
async function saveNewYear(form) {
  const fd = Object.fromEntries(new FormData(form)), label = (fd.label || "").trim();
  if (!label) return formErr("Indiquez le libellé de l'année (ex. 2027-2028).");
  if (S.years.some((y) => y.label === label)) return formErr("Cette année existe déjà.");
  if (!fd.from || !fd.to || fd.from > fd.to) return formErr("La période des mois est invalide.");
  const src = S.years.find((y) => y.id === form.dataset.src);
  if (!S.years.length) fd.current = "on";
  const row = { school_id: S.sid, label, months: monthRange(fd.from, fd.to).map((k) => ({ key: k, label: mLabel(k), on: true })), classes: fd.copy && src ? JSON.parse(JSON.stringify(src.classes)) : [] };
  const res = await run(async () => {
    const { data, error } = await sb.from("school_years").insert(row).select("id").single(); if (error) throw error;
    if (fd.current) { const { error: e2 } = await sb.rpc("set_current_year", { p_year: data.id }); if (e2) throw e2; }
    return data;
  }, `Année ${label} créée`);
  if (!res) return;
  closeModal(); try { localStorage.setItem("mm-yid-" + S.sid, res.id); } catch (e) {} S.yid = res.id;
  await loadSchoolData(); S.view = "eleves"; render();
  if (S.studentsAll.length) openReinscription();
}
function openReinscription(srcId) {
  const target = year(); const others = S.years.filter((y) => y.id !== target.id).sort((a, b) => b.label.localeCompare(a.label));
  if (!others.length) return toast("Il n'y a pas d'autre année d'où réinscrire.", "err");
  const src = others.find((y) => y.id === srcId) || others.find((y) => y.label < target.label) || others[0];
  const enrolled = new Set(S.enrollments.filter((e) => e.year_id === target.id).map((e) => e.student_id));
  const cand = S.enrollments.filter((e) => e.year_id === src.id && e.statut === "Actif" && !enrolled.has(e.student_id)).map((e) => ({ e, st: S.studentsAll.find((x) => x.id === e.student_id) })).filter((x) => x.st).sort((a, b) => (famOf(a.st)?.code || "").localeCompare(famOf(b.st)?.code || "", "fr", { numeric: true }) || a.st.nom.localeCompare(b.st.nom));
  const tc = target.classes || [];
  const nextClass = (cid) => { const sc = src.classes || [], i = sc.findIndex((c) => c.id === cid); if (i < 0) return ""; if (i === sc.length - 1) return ""; const nm = sc.at(i + 1).name; return (tc.find((c) => c.name === nm) || tc.find((c) => c.name === sc.at(i).name) || {}).id || ""; };
  const rows = cand.map(({ e, st }, i) => `<tr><td><input type="checkbox" data-rs="${i}"${nextClass(e.class_id) ? " checked" : ""} aria-label="Réinscrire ${esc(st.nom)}"></td><td><b>${esc(st.nom)}</b><span class="sub">${esc(famOf(st)?.code || "")} · ${esc(famOf(st)?.nom || "")}</span></td><td>${esc((src.classes || []).find((c) => c.id === e.class_id)?.name || "—")}</td>
    <td><select id="rs-c-${i}" class="input" style="min-width:150px">${`<option value="">— Classe —</option>` + tc.map((c) => `<option value="${esc(c.id)}"${c.id === nextClass(e.class_id) ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></td><td class="num">${e.reduction ? F(e.reduction) : "—"}</td></tr>`).join("");
  S.reinsc = { target: target.id, cand };
  const first = (target.months || []).find((m) => m.on)?.key;
  modal(dlg({ title: `Réinscrire en ${esc(target.label)}`, sub: "Les élèves actifs de l'année choisie, pas encore inscrits cette année. La classe suivante est proposée ; ajustez en cas de redoublement. Les élèves de la dernière classe sont décochés.", size: "", id: "reinsc-form",
    body: `<div class="form"><div class="field"><label for="rs-src">Reprendre les élèves de</label><select id="rs-src">${others.map((y) => `<option value="${y.id}"${y.id === src.id ? " selected" : ""}>${esc(y.label)}</option>`).join("")}</select></div>
      <div class="field"><label for="rs-date">Date d'inscription</label><input id="rs-date" name="date" type="date" value="${first ? first + "-01" : today()}"></div>
      <label class="chk field" style="flex-direction:row;align-self:end"><input type="checkbox" name="keepRed" checked> Garder les réductions sur la mensualité</label></div>
      ${!tc.length ? `<div class="banner">${icon("alert")}<span>Cette année n'a aucune classe. Ajoutez-les d'abord dans Paramètres, onglet Classes et frais.</span></div>` : ""}
      ${cand.length ? `<div class="card"><div class="scroller"><table class="list"><thead><tr><th><input type="checkbox" id="rs-all" checked aria-label="Tout cocher"></th><th>Élève</th><th>Ancienne classe</th><th>Nouvelle classe</th><th class="num">Réduction</th></tr></thead><tbody>${rows}</tbody></table></div></div>` : `<div class="banner info">${icon("info")}<span>Tous les élèves actifs de ${esc(src.label)} sont déjà inscrits en ${esc(target.label)}.</span></div>`}`,
    foot: `<span class="meta left">${cand.length} élève${cand.length > 1 ? "s" : ""} proposé${cand.length > 1 ? "s" : ""}</span><button type="button" class="btn" data-act="close">Fermer</button><button class="btn primary" type="submit" ${cand.length && tc.length ? "" : "disabled"}>Réinscrire la sélection</button>` }));
}
async function saveReinscription(form) {
  const R = S.reinsc, fd = Object.fromEntries(new FormData(form)), rows = [];
  for (const [i, { e }] of R.cand.entries()) {
    const box = form.querySelector(`[data-rs="${i}"]`); if (!box?.checked) continue;
    const cid = $("rs-c-" + i).value; if (!cid) return formErr("Choisissez la nouvelle classe de chaque élève coché.");
    rows.push({ school_id: S.sid, year_id: R.target, student_id: e.student_id, class_id: cid, reduction: fd.keepRed ? e.reduction || 0 : 0, date_inscription: fd.date || null });
  }
  if (!rows.length) return formErr("Cochez au moins un élève.");
  const ok = await run(async () => { const { error } = await sb.from("enrollments").insert(rows); if (error) throw error; }, `${rows.length} élève${rows.length > 1 ? "s" : ""} réinscrit${rows.length > 1 ? "s" : ""}`);
  if (ok) { closeModal(); loadSchoolData(); }
}

/* =====================================================================
   Rapports annuels
   ===================================================================== */
function yearReport(y) {
  const on = (y.months || []).filter((m) => m.on), nk = nowKey();
  const cls = (id) => (y.classes || []).find((c) => c.id === id);
  const enr = S.enrollments.filter((e) => e.year_id === y.id);
  const lines = S.linesAll.filter((l) => l.yearId === y.id);
  const PI = new Map(); lines.forEach((l) => { const k = l.studentId + "|" + (l.kind === "inscription" ? "INS" : l.month); PI.set(k, (PI.get(k) || 0) + l.amount); });
  const mens = (e) => Math.max(0, (+cls(e.class_id)?.fee || 0) - (e.reduction || 0));
  const ins = (e) => Math.max(0, (+cls(e.class_id)?.ins_fee || 0) - (e.reduction_ins || 0));
  const started = (e, k) => !e.date_inscription || k >= e.date_inscription.slice(0, 7);
  const gone = (e, k) => e.statut === "Abandon" && e.date_sortie && k > e.date_sortie.slice(0, 7);
  let attIns = 0, attMens = 0, echu = 0, reste = 0, perdu = 0, resteAb = 0;
  const byMonth = on.map((m) => ({ key: m.key, label: m.label || mLabel(m.key), due: 0, paid: 0 }));
  const byClass = {}, abandons = [];
  for (const e of enr) {
    const c = (byClass[e.class_id] ||= { name: cls(e.class_id)?.name || "—", n: 0, ab: 0, att: 0, paid: 0, reste: 0 });
    c.n++; if (e.statut === "Abandon") c.ab++;
    const di = ins(e), pi = PI.get(e.student_id + "|INS") || 0, ri = Math.max(0, di - pi);
    attIns += di; echu += di; reste += ri; c.att += di; c.paid += pi; c.reste += ri;
    let rE = ri, lost = 0;
    on.forEach((m, i) => {
      const d = started(e, m.key) && !gone(e, m.key) ? mens(e) : 0, p = PI.get(e.student_id + "|" + m.key) || 0;
      attMens += d; byMonth[i].due += d; byMonth[i].paid += p; c.att += d; c.paid += p;
      if (m.key <= nk) { echu += d; const r = Math.max(0, d - p); reste += r; c.reste += r; rE += r; }
      if (started(e, m.key) && gone(e, m.key)) lost += mens(e);
    });
    if (e.statut === "Abandon") { perdu += lost; resteAb += rE; abandons.push({ e, st: S.studentsAll.find((s) => s.id === e.student_id), cls: cls(e.class_id)?.name || "", reste: rE, lost }); }
  }
  const caIns = lines.filter((l) => l.kind === "inscription").reduce((a, l) => a + l.amount, 0), ca = lines.reduce((a, l) => a + l.amount, 0);
  return { y, n: enr.length, ab: abandons.length, attIns, attMens, att: attIns + attMens, echu, ca, caIns, caMens: ca - caIns, reste, perdu, resteAb, rate: echu ? Math.round(((echu - reste) / echu) * 100) : 0,
    byMonth, byClass: Object.values(byClass).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })), abandons: abandons.sort((a, b) => (a.e.date_sortie || "").localeCompare(b.e.date_sortie || "")) };
}
let REP = null;
function viewReports() {
  const all = [...S.years].sort((a, b) => a.label.localeCompare(b.label)).map(yearReport), R = all.find((r) => r.y.id === S.yid) || all.at(-1);
  REP = { all, R };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const cmp = all.slice().reverse().map((r) => `<tr${r.y.id === S.yid ? ' style="font-weight:600"' : ""}><td class="rt-title"><b>${esc(r.y.label)}</b> ${r.y.is_current ? '<span class="pill ok plain">en cours</span>' : ""}</td><td data-label="Inscrits" class="num">${r.n}</td><td data-label="Abandons" class="num">${r.ab}${r.n ? ` <span class="muted">(${pct(r.ab, r.n)} %)</span>` : ""}</td><td data-label="Attendu sur l'année" class="num">${F(r.att)}</td><td data-label="Encaissé (CA)" class="num"><b>${F(r.ca)}</b></td><td data-label="Reste échu" class="num" style="color:${r.reste ? "var(--late)" : "inherit"}">${F(r.reste)}</td><td data-label="Taux" class="num">${r.rate} %</td><td data-label="Manque à gagner (abandons)" class="num">${F(r.perdu)}</td></tr>`).join("");
  const months = R.byMonth.map((m) => `<tr><td class="rt-title">${esc(m.label)}</td><td data-label="Attendu" class="num">${F(m.due)}</td><td data-label="Encaissé" class="num">${F(m.paid)}</td><td data-label="Écart" class="num">${F(Math.max(0, m.due - m.paid))}</td><td data-label="Taux" class="num">${m.due ? pct(m.paid, m.due) + " %" : "—"}</td></tr>`).join("");
  const byCls = R.byClass.map((c) => `<tr><td class="rt-title"><b>${esc(c.name)}</b></td><td data-label="Inscrits" class="num">${c.n}${c.ab ? ` <span class="muted">(${c.ab} ab.)</span>` : ""}</td><td data-label="Attendu" class="num">${F(c.att)}</td><td data-label="Encaissé" class="num">${F(c.paid)}</td><td data-label="Reste échu" class="num">${F(c.reste)}</td></tr>`).join("");
  const abs = R.abandons.map((a) => `<tr><td class="rt-title"><b>${esc(a.st?.nom || "")}</b><span class="sub">${esc(famOf(a.st || {})?.code || "")} · ${esc(a.cls)}</span></td><td data-label="Départ" class="nowrap">${fmtDate(a.e.date_sortie)}</td><td data-label="Motif">${esc(a.e.motif_sortie || "—")}</td><td data-label="Reste dû" class="num" style="color:${a.reste ? "var(--late)" : "inherit"}">${F(a.reste)}</td><td data-label="Manque à gagner" class="num">${F(a.lost)}</td><td class="actions-cell" data-label="">${a.reste ? `<button class="btn sm" data-act="pay" data-fam="${a.st?.familyId}">Encaisser</button>` : ""}</td></tr>`).join("");
  return `${pageHead("Rapports annuels", "Chiffre d'affaires, recouvrement et abandons de chaque année scolaire. Le CA d'une année = les encaissements rattachés à cette année (reçus valides).", `<button class="btn" data-act="export-reports">${icon("download")}Exporter</button>`)}
  <div class="kpis four">
    <div class="card kpi ok"><div class="k-top"><span class="k-lbl">CA ${esc(R.y.label)}</span><span class="k-ico">${icon("wallet")}</span></div><div class="k-val">${F(R.ca)}<small>FCFA</small></div><div class="k-sub">Inscriptions ${F(R.caIns)} · mensualités ${F(R.caMens)}</div></div>
    <div class="card kpi"><div class="k-top"><span class="k-lbl">Attendu sur l'année</span><span class="k-ico">${icon("ledger")}</span></div><div class="k-val">${F(R.att)}<small>FCFA</small></div><div class="k-sub">${pct(R.ca, R.att)} % déjà encaissé · après abandons</div></div>
    <div class="card kpi late"><div class="k-top"><span class="k-lbl">Reste échu à recouvrer</span><span class="k-ico">${icon("alert")}</span></div><div class="k-val">${F(R.reste)}<small>FCFA</small></div><div class="k-sub">Taux de recouvrement ${R.rate} %${R.resteAb ? ` · dont ${F(R.resteAb)} sur élèves partis` : ""}</div></div>
    <div class="card kpi brand"><div class="k-top"><span class="k-lbl">Abandons</span><span class="k-ico">${icon("ban")}</span></div><div class="k-val">${R.ab}<small>sur ${R.n} inscrits</small></div><div class="k-sub">Manque à gagner : ${F(R.perdu)} FCFA</div></div>
  </div>
  <div class="dash">
    <section class="card span-8"><div class="card-h"><div><h2>Chiffre d'affaires par année scolaire</h2><p>Encaissements de l'année, inscriptions et mensualités</p></div><div class="chart-legend"><span><i style="background:var(--series-1)"></i>Mensualités</span><span><i style="background:var(--series-2)"></i>Inscriptions</span></div></div>
      <div class="card-b"><div class="chart-box sm"><canvas id="ch-ca" role="img" aria-label="Chiffre d'affaires par année"></canvas></div></div></section>
    <section class="card span-4"><div class="card-h"><div><h2>Ce que coûtent les abandons</h2><p>${esc(R.y.label)}</p></div></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
      <div><div class="lbl">Mensualités qui ne seront pas perçues</div><div class="k-val" style="font-size:22px;font-weight:700">${F(R.perdu)} FCFA</div><div class="meta">Mois restants de l'année après chaque départ.</div></div>
      <div><div class="lbl">Impayés laissés par les élèves partis</div><div class="k-val" style="font-size:22px;font-weight:700;color:${R.resteAb ? "var(--late)" : "inherit"}">${F(R.resteAb)} FCFA</div><div class="meta">Toujours dus par les familles ; inclus dans le reste échu.</div></div>
      <div><div class="lbl">Part des inscrits partis</div><div class="bar" style="margin-top:6px"><i style="width:${pct(R.ab, R.n)}%;background:var(--late)"></i></div><div class="meta" style="margin-top:4px">${R.ab} sur ${R.n} (${pct(R.ab, R.n)} %)</div></div></div></section>
    <section class="card span-12"><div class="card-h"><div><h2>Comparaison des années</h2><p>Attendu, encaissé et reste tiennent compte des inscriptions, des réductions et des abandons</p></div></div>
      <div class="card-b flush" style="margin-top:10px"><div class="scroller"><table class="list rt"><thead><tr><th>Année</th><th class="num">Inscrits</th><th class="num">Abandons</th><th class="num">Attendu sur l'année</th><th class="num">Encaissé (CA)</th><th class="num">Reste échu</th><th class="num">Taux</th><th class="num">Manque à gagner</th></tr></thead><tbody>${cmp}</tbody></table></div></div></section>
    <section class="card span-6"><div class="card-h"><div><h2>Mois par mois · ${esc(R.y.label)}</h2><p>Mensualités attendues et encaissées</p></div></div>
      <div class="card-b flush" style="margin-top:10px"><div class="scroller"><table class="list rt"><thead><tr><th>Mois</th><th class="num">Attendu</th><th class="num">Encaissé</th><th class="num">Écart</th><th class="num">Taux</th></tr></thead><tbody>${months}</tbody></table></div></div></section>
    <section class="card span-6"><div class="card-h"><div><h2>Par classe · ${esc(R.y.label)}</h2><p>Inscriptions et mensualités</p></div></div>
      <div class="card-b flush" style="margin-top:10px">${byCls ? `<div class="scroller"><table class="list rt"><thead><tr><th>Classe</th><th class="num">Inscrits</th><th class="num">Attendu</th><th class="num">Encaissé</th><th class="num">Reste échu</th></tr></thead><tbody>${byCls}</tbody></table></div>` : emptyState("student", "Aucun élève", "Aucune inscription pour cette année.")}</div></section>
    <section class="card span-12"><div class="card-h"><div><h2>Abandons · ${esc(R.y.label)}</h2><p>Élèves partis en cours d'année, avec ce qu'ils doivent encore</p></div></div>
      <div class="card-b flush" style="margin-top:10px">${abs ? `<div class="scroller"><table class="list rt"><thead><tr><th>Élève</th><th>Départ</th><th>Motif</th><th class="num">Reste dû</th><th class="num">Manque à gagner</th><th></th></tr></thead><tbody>${abs}</tbody></table></div>` : emptyState("check", "Aucun abandon", "Aucun élève n'a quitté l'école cette année.")}</div></section>
  </div>`;
}
function drawReportCharts() {
  const c = $("ch-ca"); if (!c || !REP) return;
  if (!window.Chart) { c.parentElement.innerHTML = '<div class="chart-fallback">Graphique indisponible (bibliothèque non chargée).</div>'; return; }
  const C = window.Chart, ink3 = cssVar("--ink-3"), ink2 = cssVar("--ink-2"), grid = cssVar("--grid"), surface = cssVar("--surface"), ink = cssVar("--ink");
  C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.color = ink3;
  const all = REP.all, bar = { maxBarThickness: 56, borderColor: surface, borderWidth: { top: 2, left: 0, right: 0, bottom: 0 }, borderSkipped: "start" };
  charts.push(new C(c, { type: "bar", data: { labels: all.map((r) => r.y.label), datasets: [
    { label: "Mensualités", data: all.map((r) => r.caMens), backgroundColor: cssVar("--series-1"), ...bar, borderRadius: 0 },
    { label: "Inscriptions", data: all.map((r) => r.caIns), backgroundColor: cssVar("--series-2"), ...bar, borderRadius: { topLeft: 4, topRight: 4 } }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: ink, titleColor: surface, bodyColor: surface, padding: 10, cornerRadius: 8, callbacks: { label: (x) => ` ${x.dataset.label} : ${F(x.parsed.y)} FCFA`, footer: (xs) => `Total : ${F(xs.reduce((a, x) => a + x.parsed.y, 0))} FCFA` } } },
      scales: { x: { stacked: true, grid: { display: false }, border: { color: grid }, ticks: { color: ink2 } }, y: { stacked: true, beginAtZero: true, grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: ink3, padding: 8, callback: (v) => FC(v) } } } } }));
}
function exportReports() {
  const { all, R } = REP || {}; if (!all) return;
  const rows = [["Année", "Inscrits", "Abandons", "Attendu inscriptions", "Attendu mensualités", "Attendu total", "Encaissé inscriptions", "Encaissé mensualités", "CA total", "Reste échu", "Taux de recouvrement (%)", "Manque à gagner abandons", "Impayés élèves partis"]];
  all.forEach((r) => rows.push([r.y.label, r.n, r.ab, r.attIns, r.attMens, r.att, r.caIns, r.caMens, r.ca, r.reste, r.rate, r.perdu, r.resteAb]));
  rows.push([], ["Abandons " + R.y.label], ["Élève", "Code famille", "Classe", "Date de départ", "Motif", "Reste dû", "Manque à gagner"]);
  R.abandons.forEach((a) => rows.push([a.st?.nom, famOf(a.st || {})?.code, a.cls, a.e.date_sortie, a.e.motif_sortie, a.reste, a.lost]));
  saveCsv(`rapports_${tag()}.csv`, rows);
}

/* =====================================================================
   Exports CSV
   ===================================================================== */
function saveCsv(name, rows) {
  const data = "﻿" + rows.map((r) => r.map((c) => { c = String(c ?? ""); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Export prêt : " + name, "ok");
}
const tag = () => ((school()?.sigle || "ecole") + "_" + (year()?.label || "")).replace(/[^\w-]+/g, "_") + "_" + today();
function exportTableau() {
  const PI = paidIndex(), ms = months(), rows = [["Année", "Code famille", "Famille", "Tuteur", "Téléphone", "Élève", "Classe", "Statut", "Mensualité", "Inscription due", "Inscription payée", ...ms.map((m) => m.label || mLabel(m.key)), "Total payé", "Reste échu"]];
  [...S.families].sort((a, b) => famNum(a.code) - famNum(b.code)).forEach((f) => studentsOfFam(f.id, true).forEach((st) => { const r = studentSummary(st, PI); rows.push([year().label, f.code, f.nom, f.tuteurNom, f.tel, st.nom, clsOf(st)?.name, st.statut === "Abandon" ? "Abandon " + st.dateSortie : "Actif", monthly(st), r.insDue, r.insPaid, ...ms.map((m) => (dueFor(st, m.key) ? PI.get(st.id + "|" + m.key) || 0 : "-")), r.paid, r.reste]); }));
  saveCsv(`registre_${tag()}.csv`, rows);
}
function exportEleves() {
  const cfg = fcfg("student"), defs = STUDENT_FIELDS.filter((d) => d.k !== "dateInscription" && cfg[d.k]?.show);
  const rows = [["Année", "Nom & prénoms", "Code famille", "Famille", "Classe", "Date d'inscription", "Statut", "Date de départ", "Motif", "Réduction mensualité", "Réduction inscription", ...defs.map((d) => d.l)]];
  S.students.forEach((s) => { const f = famOf(s); rows.push([year().label, s.nom, f?.code, f?.nom, clsOf(s)?.name, s.dateInscription, s.statut, s.dateSortie, s.motifSortie, s.reduction, s.reductionIns, ...defs.map((d) => s[d.k])]); });
  saveCsv(`eleves_${tag()}.csv`, rows);
}
function exportJournal() {
  const rows = [["Date", "Reçu", "Statut", "Code famille", "Famille", "Élève", "Mois", "Montant", "Mode", "Versé par", "Encaissé par", "Encaissé le", "Annulé par", "Motif d'annulation"]];
  filteredReceipts().slice().reverse().forEach((r) => r.payment_lines.forEach((l) => rows.push([r.date, r.number, r.status === "annule" ? "Annulé" : "Valide", r.family_code, r.family_nom, l.student_nom, l.kind === "inscription" ? "Inscription" : mLabel(l.month), l.amount, r.mode, r.payer, r.created_by_name, fmtDateTime(r.created_at), r.cancelled_by_name || "", r.cancel_reason || ""])));
  saveCsv(`recus_${tag()}.csv`, rows);
}
function exportAudit() {
  const rows = [["Date et heure", "Utilisateur", "E-mail", "Rôle", "Opération", "Reçu", "Code famille", "Famille", "Montant", "Motif", "Détail"]];
  S.audit.forEach((a) => rows.push([fmtDateTime(a.at), a.actor_name, a.actor_email, ROLE_LABEL[a.actor_role] || a.actor_role, a.action, a.receipt_number, a.family_code, a.family_nom, a.action === "annulation" ? -a.amount : a.amount, a.details?.motif || "", (a.details?.lignes || []).map((l) => `${l.eleve} ${l.type === "inscription" || !l.mois ? "inscription" : l.mois} ${l.montant}`).join(" | ")]));
  saveCsv(`audit_${tag()}.csv`, rows);
}

/* =====================================================================
   Événements
   ===================================================================== */
function toast(t, kind = "") {
  const box = $("toasts"); const el = document.createElement("div");
  el.className = "toast " + kind; el.setAttribute("role", kind === "err" ? "alert" : "status");
  el.innerHTML = `${icon(kind === "err" ? "alert" : kind === "ok" ? "check" : "info")}<span>${esc(t)}</span>`;
  box.appendChild(el); setTimeout(() => el.remove(), kind === "err" ? 6000 : 3800);
  while (box.children.length > 3) box.firstChild.remove();
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-act]");
  if (S.menuOpen && !e.target.closest(".menu-wrap")) { S.menuOpen = false; if (!t) return render(); }
  if (!t) return;
  if (t.dataset.tab) {
    S.view = t.dataset.tab; S.navOpen = false; S.menuOpen = false; S._chartsDrawn = false;
    try { localStorage.setItem("mm-view", S.view); } catch (err) {}
    if (S.view === "audit") S.auditLoaded = false;
    closeModal(); render(); window.scrollTo(0, 0); return;
  }
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "close") { e.preventDefault(); return closeModal(); }
  if (a === "nav-open") { S.navOpen = true; return render(); }
  if (a === "nav-close") { S.navOpen = false; return render(); }
  if (a === "menu") { S.menuOpen = !S.menuOpen; return render(); }
  if (a === "theme") { S._chartsDrawn = false; return setTheme(t.dataset.v); }
  if (a === "logout") return logout();
  if (a === "account") { S.navOpen = false; return openAccount(); }
  if (a === "password") return openPassword();
  if (a === "pw-eye") { const inp = $(t.dataset.for); if (inp) { const show = inp.type === "password"; inp.type = show ? "text" : "password"; t.innerHTML = icon(show ? "eyeoff" : "eye", "sm"); t.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe"); } return; }
  if (a === "reload") return loadSchoolData();
  if (a === "print") return window.print();
  if (a === "page") { S.pages[t.dataset.key] = +t.dataset.p; render(); window.scrollTo(0, 0); return; }
  if (a === "copy-pw") { const txt = $("pw-show").textContent; try { await navigator.clipboard.writeText(txt); toast("Mot de passe copié", "ok"); } catch (err) { const r = document.createRange(); r.selectNodeContents($("pw-show")); getSelection().removeAllRanges(); getSelection().addRange(r); } return; }
  if (a === "confirm-ok") { const fn = confirmFn; confirmFn = null; t.disabled = true; if (fn) await fn(); return; }
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
  if (a === "del-family") { const f = S.families.find((x) => x.id === id); return openConfirm({ title: "Supprimer la famille ?", text: `La famille <b>${esc(f?.code)} · ${esc(f?.nom)}</b> sera définitivement supprimée.`, ok: "Supprimer", onOk: async () => { const ok = await run(async () => { const { error } = await sb.from("families").delete().eq("id", id); if (error) throw error; }, "Famille supprimée"); closeModal(); if (ok) loadSchoolData(); } }); }
  if (a === "del-student") { const s = S.students.find((x) => x.id === id); return openConfirm({ title: "Supprimer l'élève ?", text: `<b>${esc(s?.nom)}</b> sera définitivement supprimé. Pour un départ en cours d'année, préférez le statut « Sorti ».`, ok: "Supprimer", onOk: async () => { const ok = await run(async () => { const { error } = await sb.from("students").delete().eq("id", id); if (error) throw error; }, "Élève supprimé"); closeModal(); if (ok) loadSchoolData(); } }); }
  if (a === "stab") { S.settingsTab = t.dataset.v; return render(); }
  if (a === "abandon") return openAbandon(id);
  if (a === "cancel-abandon") { const st = S.students.find((x) => x.id === id); return openConfirm({ title: "Annuler l'abandon ?", text: `<b>${esc(st?.nom)}</b> redevient actif : les mensualités après ${esc(fmtDate(st?.dateSortie))} seront de nouveau dues.`, ok: "Annuler l'abandon", danger: false, onOk: async () => { const ok = await run(async () => { const { error } = await sb.from("enrollments").update({ statut: "Actif", date_sortie: null, motif_sortie: "" }).eq("id", st.enrId); if (error) throw error; }, "Élève réintégré"); closeModal(); if (ok) loadSchoolData(); } }); }
  if (a === "unenroll") { const st = S.students.find((x) => x.id === id); return openConfirm({ title: `Retirer de ${esc(year().label)} ?`, text: `L'inscription de <b>${esc(st?.nom)}</b> pour ${esc(year().label)} sera supprimée. Ses autres années ne changent pas.`, ok: "Retirer", onOk: async () => { const ok = await run(async () => { const { error } = await sb.from("enrollments").delete().eq("id", st.enrId); if (error) throw error; }, "Inscription retirée"); closeModal(); if (ok) loadSchoolData(); } }); }
  if (a === "reinscrire") return openReinscription();
  if (a === "new-year") return openNewYear();
  if (a === "open-year") return selectYear(id);
  if (a === "set-current") { const y = S.years.find((x) => x.id === id); return openConfirm({ title: `Passer en ${esc(y?.label)} ?`, text: `<b>${esc(y?.label)}</b> deviendra l'année en cours pour tous les utilisateurs de l'établissement. Les autres années restent consultables.`, ok: "Définir en cours", danger: false, onOk: async () => { const ok = await run(async () => { const { error } = await sb.rpc("set_current_year", { p_year: id }); if (error) throw error; }, "Année en cours modifiée"); closeModal(); if (ok) { S.yid = id; try { localStorage.setItem("mm-yid-" + S.sid, id); } catch (e) {} loadSchoolData(); } } }); }
  if (a === "export-reports") return exportReports();
  if (a === "cls-add") { S.draft.classes.push({ id: newId().slice(0, 8), name: "Nouvelle classe", fee: S.draft.classes[0]?.fee || 0, ins_fee: S.draft.classes[0]?.ins_fee || 0 }); S.draftDirty = true; return render(); }
  if (a === "cls-del") { S.draft.classes.splice(+t.dataset.i, 1); S.draftDirty = true; return render(); }
  if (a === "months-gen") { const A = $("m-a").value, B = $("m-b").value; if (!A || !B || A > B) return toast("Période invalide.", "err"); const old = Object.fromEntries(S.draft.months.map((m) => [m.key, m])); S.draft.months = monthRange(A, B).map((k) => old[k] || { key: k, label: mLabel(k), on: true }); S.draftDirty = true; return render(); }
  if (a === "reset-settings") { S.draft = null; render(); return toast("Modifications annulées"); }
  if (a === "save-settings") {
    const d = S.draft; if (!d.name.trim()) return toast("Le nom de l'établissement est obligatoire.", "err"); if (d.classes.some((c) => !c.name.trim())) return toast("Chaque classe doit avoir un nom.", "err");
    const ok = await run(async () => {
      const { error } = await sb.from("schools").update({ name: d.name.trim(), sigle: d.sigle || "", adresse: d.adresse || "", tel: d.tel || "", fields: d.fields }).eq("id", S.sid); if (error) throw error;
      const { error: e2 } = await sb.from("school_years").update({ classes: d.classes.map((c) => ({ ...c, fee: Math.max(0, +c.fee || 0), ins_fee: Math.max(0, +c.ins_fee || 0) })), months: d.months }).eq("id", d.yid); if (e2) throw e2;
    }, "Paramètres enregistrés");
    if (ok) { S.draft = null; await loadMemberships(); await loadSchoolData(); }
    return;
  }
  if (a === "member-add") return memberForm("Ajouter un utilisateur", S.sid, true);
  if (a === "add-founder") return memberForm("Ajouter un Fondateur", id, false);
  if (a === "new-school") return openNewSchool();
  if (a === "member-active") {
    const m = S.members.find((x) => x.user_id === id), on = t.dataset.v === "1", n = esc(m?.profiles?.full_name || "");
    const go = async () => { const ok = await run(() => callAdmin({ action: "set_active", school_id: S.sid, user_id: id, active: on }), on ? "Compte réactivé" : "Compte désactivé"); closeModal(); if (ok) loadSchoolData(); };
    return on ? go() : openConfirm({ title: "Désactiver ce compte ?", text: `<b>${n}</b> perdra immédiatement l'accès aux données de l'établissement. Vous pourrez le réactiver plus tard.`, ok: "Désactiver", onOk: go });
  }
  if (a === "member-role") { const ok = await run(() => callAdmin({ action: "set_role", school_id: S.sid, user_id: id, role: t.dataset.v }), "Rôle modifié"); if (ok) loadSchoolData(); return; }
  if (a === "member-reset") {
    const m = S.members.find((x) => x.user_id === id);
    return openConfirm({ title: "Réinitialiser le mot de passe ?", text: `Un nouveau mot de passe provisoire sera créé pour <b>${esc(m?.profiles?.full_name || "")}</b>. L'ancien ne fonctionnera plus.`, ok: "Réinitialiser", danger: false,
      onOk: async () => { const pw = genPassword(); const ok = await run(() => callAdmin({ action: "reset_password", school_id: S.sid, user_id: id, password: pw })); if (ok) showPassword("Mot de passe réinitialisé", m?.profiles?.full_name || "", pw); else closeModal(); } });
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target;
  if (f.id === "login-form") {
    const fd = Object.fromEntries(new FormData(f)), btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Connexion…"; $("lg-err").textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: fd.email.trim(), password: fd.password });
    btn.disabled = false; btn.textContent = "Se connecter";
    if (error) { $("lg-err").textContent = /invalid/i.test(error.message) ? "E-mail ou mot de passe incorrect." : errMsg(error); return; }
    lastActivity = Date.now(); return afterLogin(data.user);
  }
  if (f.id === "pw-form") {
    const fd = Object.fromEntries(new FormData(f)), msg = checkNewPassword(fd.p1, fd.p2);
    if (msg) { $("pw-err").textContent = msg; return; }
    try { await applyNewPassword(fd.p1); } catch (err) { $("pw-err").textContent = err.message; return; }
    S.profile.must_change_password = false; toast("Mot de passe enregistré", "ok"); return enterApp();
  }
  if (f.id === "password-form") {
    const fd = Object.fromEntries(new FormData(f)), msg = checkNewPassword(fd.p1, fd.p2);
    if (!fd.p0) return formErr("Saisissez votre mot de passe actuel.");
    if (msg) return formErr(msg);
    const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    const { error: e1 } = await sb.auth.signInWithPassword({ email: S.profile.email, password: fd.p0 });
    if (e1) { btn.disabled = false; return formErr("Le mot de passe actuel est incorrect."); }
    try { await applyNewPassword(fd.p1); } catch (err) { btn.disabled = false; return formErr(err.message); }
    closeModal(); return toast("Mot de passe changé", "ok");
  }
  if (f.id === "fam-form") return saveFamily(f);
  if (f.id === "stu-form") return saveStudent(f);
  if (f.id === "pay-form") return savePay(f);
  if (f.id === "cancel-form") return saveCancel(f);
  if (f.id === "abandon-form") return saveAbandon(f);
  if (f.id === "year-form") return saveNewYear(f);
  if (f.id === "reinsc-form") return saveReinscription(f);
  if (f.id === "member-form") {
    const fd = Object.fromEntries(new FormData(f));
    if (!fd.full_name.trim() || !fd.email.trim()) return formErr("Nom et e-mail obligatoires.");
    const res = await run(() => callAdmin({ action: "add_member", school_id: f.dataset.school, email: fd.email, full_name: fd.full_name, role: fd.role, password: fd.password }));
    if (!res) return;
    if (res.user_created) showPassword("Accès créé", fd.full_name, fd.password); else { closeModal(); toast("Compte existant rattaché : son mot de passe actuel reste valable.", "ok"); }
    if (S.view === "plateforme") { await loadPlatform(); render(); } else loadSchoolData();
    return;
  }
  if (f.id === "school-form") {
    if (!isSuper()) return formErr("Seul le super-admin peut créer un établissement.");
    const fd = Object.fromEntries(new FormData(f));
    const res = await run(() => callAdmin({ action: "create_school", school: { name: fd.name, sigle: fd.sigle, annee: fd.annee, from: fd.from, to: fd.to, fee: fd.fee }, fondateur: { full_name: fd.f_name, email: fd.f_email, password: fd.f_password } }));
    if (!res) return;
    await loadPlatform(); render();
    if (res.user_created) showPassword("Établissement créé", fd.f_name, fd.f_password); else { closeModal(); toast("Établissement créé ; le Fondateur avait déjà un compte.", "ok"); }
  }
});
let searchT;
document.addEventListener("input", (e) => {
  const t = e.target, ds = t.dataset;
  if (ds.meter) { const m = $(ds.meter); if (m) m.dataset.s = t.value ? pwScore(t.value) : 0; return; }
  if (ds.f) { S.f[ds.f] = t.type === "checkbox" ? t.checked : t.value; S.pages = {}; if (t.type === "checkbox" || t.tagName === "SELECT") return render(); clearTimeout(searchT); searchT = setTimeout(render, 160); return; }
  if (ds.jf) { S.jf[ds.jf] = t.value; S.pages.recus = 1; if (t.tagName === "SELECT") return render(); clearTimeout(searchT); searchT = setTimeout(render, 160); return; }
  if (ds.cfg) { S.draft[ds.cfg] = t.value; markDirty(); return; }
  if (ds.cls) { S.draft.classes[+ds.i][ds.cls] = ds.cls === "name" ? t.value : Math.max(0, +t.value || 0); markDirty(); return; }
  if (ds.mon === "label") { S.draft.months[+ds.i].label = t.value; markDirty(); return; }
  if (ds.pv) { S.pay.vals[ds.pv] = Math.max(0, +t.value || 0); let tot = 0; Object.values(S.pay.vals).forEach((v) => (tot += +v || 0)); const el = $("p-total"); if (el) el.textContent = F(tot) + " FCFA"; }
});
function markDirty() { if (S.draftDirty) return; S.draftDirty = true; const bar = document.querySelector(".savebar"); if (bar) { bar.querySelector(".meta").textContent = "Modifications non enregistrées."; bar.querySelectorAll("button").forEach((b) => (b.disabled = false)); } }
document.addEventListener("change", (e) => {
  const t = e.target, ds = t.dataset;
  if (t.id === "school-sel") { S.navOpen = false; return selectSchool(t.value); }
  if (t.id === "year-sel") { S.navOpen = false; return selectYear(t.value); }
  if (t.id === "rs-src") return openReinscription(t.value);
  if (t.id === "rs-all") { document.querySelectorAll("[data-rs]").forEach((b) => (b.checked = t.checked)); return; }
  if (t.id === "p-fam") { S.pay.famId = t.value; S.pay.vals = {}; const f = S.families.find((x) => x.id === t.value); const p = $("p-payer"); if (p && f) p.value = f.tuteurNom || ""; return renderPayGrid(); }
  if (ds.af) { S.af[ds.af] = t.value; S.auditLoaded = false; S.pages.audit = 1; return render(); }
  if (ds.mon === "on") { S.draft.months[+ds.i].on = t.checked; S.draftDirty = true; return render(); }
  if (ds.fld) { const c = S.draft.fields[ds.fld][ds.k]; c[ds.p] = t.checked; if (ds.p === "req" && t.checked) c.show = true; if (ds.p === "show" && !t.checked) c.req = false; S.draftDirty = true; return render(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("modal").hidden) return closeModal();
  if (S.menuOpen || S.navOpen) { S.menuOpen = false; S.navOpen = false; render(); }
});
$("modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") closeModal(); });
let rzT; window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { if (S.navOpen && innerWidth >= 1024) { S.navOpen = false; render(); } }, 150); });

/* =====================================================================
   Démarrage
   ===================================================================== */
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.phase !== "login") { S.phase = "login"; render(); } });
(async () => {
  if (SUPABASE_URL.includes("VOTRE-PROJET")) { $("app").innerHTML = `<div class="auth-main" style="min-height:100vh"><div class="auth-card"><h2>Configuration requise</h2><p>Renseignez l'adresse et la clé publique de votre projet Supabase dans <code>config.js</code> (voir le README).</p></div></div>`; return; }
  const { data } = await sb.auth.getSession();
  if (data.session?.user) await afterLogin(data.session.user); else { S.phase = "login"; render(); }
})();
