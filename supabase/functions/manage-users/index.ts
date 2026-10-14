// Maarifa Mini — gestion des établissements et des comptes
// Déployée comme Edge Function Supabase « manage-users ».
// Elle utilise la clé service_role (disponible automatiquement côté serveur,
// JAMAIS dans le navigateur) et vérifie elle-même les droits de l'appelant :
//   • Super-admin : crée un établissement et son Fondateur, ajoute un Fondateur.
//   • Fondateur   : ajoute / désactive / réactive les comptes de SON établissement,
//                   réinitialise un mot de passe (seulement si le compte n'appartient
//                   à aucun autre établissement qu'il ne dirige pas).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const CLASSES = ["Petite section", "Moyenne section", "Grande section", "CP1", "CP2", "CE1", "CE2", "CM1", "CM2",
  "6e", "5e", "4e", "3e", "2nde", "1re", "Terminale"];
const STUDENT_SHOW = ["matricule", "sexe", "dateNaissance", "lieuNaissance", "dateInscription", "observation"];
const STUDENT_ALL = [...STUDENT_SHOW, "nationalite", "numActe", "ecolePrecedente"];
const FAMILY_SHOW = ["tuteurNom", "lien", "tel", "tel2", "quartier", "dateInscription", "observation"];
const FAMILY_ALL = [...FAMILY_SHOW, "profession", "email", "pieceId"];

function monthRange(a: string, b: string) {
  if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b) || a > b) throw new Fail("Période des mois invalide.");
  const out: { key: string; label: string; on: boolean }[] = [];
  let [y, m] = a.split("-").map(Number);
  while (out.length < 36) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > b) break;
    out.push({ key, label: `${MOIS[m - 1]} ${String(y).slice(2)}`, on: true });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
const defaultFields = () => ({
  student: Object.fromEntries(STUDENT_ALL.map((k) => [k, { show: STUDENT_SHOW.includes(k), req: false }])),
  family: Object.fromEntries(FAMILY_ALL.map((k) => [k, { show: FAMILY_SHOW.includes(k), req: k === "tel" }])),
});
const clean = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function findUserByEmail(email: string) {
  const { data } = await admin.from("profiles").select("id,is_superadmin").eq("email", email).maybeSingle();
  return data as { id: string; is_superadmin: boolean } | null;
}

// Crée le compte s'il n'existe pas ; sinon renvoie l'existant (son mot de passe n'est PAS modifié).
async function ensureUser(email: string, fullName: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.is_superadmin) throw new Fail("Le compte super-admin ne peut pas être rattaché à un établissement.");
    return { id: existing.id, created: false };
  }
  if (password.length < 8) throw new Fail("Le mot de passe provisoire doit faire au moins 8 caractères.");
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Fail("Création du compte impossible : " + (error?.message ?? "erreur inconnue"));
  await admin.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, must_change_password: true });
  return { id: data.user.id, created: true };
}

async function role(uid: string, school: string) {
  const { data } = await admin.from("memberships").select("role,active").eq("school_id", school).eq("user_id", uid).maybeSingle();
  return data?.active ? data.role as string : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) throw new Fail("Session expirée : reconnectez-vous.", 401);
    const me = auth.user.id;
    const { data: prof } = await admin.from("profiles").select("is_superadmin").eq("id", me).single();
    const superadmin = !!prof?.is_superadmin;
    const body = await req.json();
    const action = String(body.action ?? "");

    // ---------- Super-admin : nouvel établissement + Fondateur ----------
    if (action === "create_school") {
      if (!superadmin) throw new Fail("Réservé au super-admin.", 403);
      const s = body.school ?? {}, f = body.fondateur ?? {};
      const name = clean(s.name), email = clean(f.email).toLowerCase(), fullName = clean(f.full_name);
      if (!name) throw new Fail("Le nom de l'établissement est obligatoire.");
      if (!isEmail(email) || !fullName) throw new Fail("Nom et e-mail du Fondateur obligatoires.");
      const fee = Math.max(0, Math.round(Number(s.fee) || 0));
      const { data: school, error } = await admin.from("schools").insert({
        name, sigle: clean(s.sigle, 30), annee: clean(s.annee, 20), created_by: me,
        classes: CLASSES.map((n, i) => ({ id: "c" + (i + 1), name: n, fee })),
        months: monthRange(clean(s.from, 7), clean(s.to, 7)), fields: defaultFields(),
      }).select("id").single();
      if (error) throw new Fail("Création de l'établissement impossible : " + error.message);
      const u = await ensureUser(email, fullName, String(f.password ?? ""));
      await admin.from("memberships").upsert({ school_id: school.id, user_id: u.id, role: "fondateur", active: true, created_by: me });
      return json({ ok: true, school_id: school.id, user_created: u.created });
    }

    // ---------- Ajouter un membre ----------
    if (action === "add_member") {
      const school = clean(body.school_id, 40), email = clean(body.email).toLowerCase(), fullName = clean(body.full_name);
      const r = body.role === "fondateur" ? "fondateur" : "admin";
      const myRole = await role(me, school);
      if (!(superadmin || myRole === "fondateur")) throw new Fail("Seul le Fondateur peut ajouter des comptes.", 403);
      if (superadmin && myRole !== "fondateur" && r !== "fondateur") throw new Fail("Le super-admin ajoute uniquement des Fondateurs.", 403);
      if (!isEmail(email) || !fullName) throw new Fail("Nom complet et e-mail valides obligatoires.");
      const { data: sc } = await admin.from("schools").select("id").eq("id", school).maybeSingle();
      if (!sc) throw new Fail("Établissement introuvable.");
      const u = await ensureUser(email, fullName, String(body.password ?? ""));
      const { error } = await admin.from("memberships").upsert({ school_id: school, user_id: u.id, role: r, active: true, created_by: me });
      if (error) throw new Fail(error.message);
      return json({ ok: true, user_created: u.created });
    }

    // ---------- Activer / désactiver ----------
    if (action === "set_active") {
      const school = clean(body.school_id, 40), target = clean(body.user_id, 40);
      if ((await role(me, school)) !== "fondateur" && !superadmin) throw new Fail("Réservé au Fondateur.", 403);
      if (target === me) throw new Fail("Vous ne pouvez pas désactiver votre propre compte.");
      const { error } = await admin.from("memberships").update({ active: !!body.active }).eq("school_id", school).eq("user_id", target);
      if (error) throw new Fail(error.message);
      return json({ ok: true });
    }

    // ---------- Changer le rôle ----------
    if (action === "set_role") {
      const school = clean(body.school_id, 40), target = clean(body.user_id, 40);
      if ((await role(me, school)) !== "fondateur") throw new Fail("Réservé au Fondateur.", 403);
      if (target === me) throw new Fail("Vous ne pouvez pas changer votre propre rôle.");
      const r = body.role === "fondateur" ? "fondateur" : "admin";
      await admin.from("memberships").update({ role: r }).eq("school_id", school).eq("user_id", target);
      return json({ ok: true });
    }

    // ---------- Réinitialiser un mot de passe ----------
    if (action === "reset_password") {
      const school = clean(body.school_id, 40), target = clean(body.user_id, 40), pwd = String(body.password ?? "");
      if (pwd.length < 8) throw new Fail("Le mot de passe provisoire doit faire au moins 8 caractères.");
      const { data: tp } = await admin.from("profiles").select("is_superadmin").eq("id", target).single();
      if (tp?.is_superadmin) throw new Fail("Impossible pour ce compte.", 403);
      if (!superadmin) {
        if ((await role(me, school)) !== "fondateur") throw new Fail("Réservé au Fondateur.", 403);
        // le compte ne doit appartenir qu'à des établissements que je dirige
        const { data: theirs } = await admin.from("memberships").select("school_id").eq("user_id", target);
        const { data: mine } = await admin.from("memberships").select("school_id").eq("user_id", me).eq("role", "fondateur").eq("active", true);
        const mineSet = new Set((mine ?? []).map((m) => m.school_id));
        if (!(theirs ?? []).length || (theirs ?? []).some((m) => !mineSet.has(m.school_id)))
          throw new Fail("Ce compte travaille aussi pour un autre établissement : demandez au super-admin.", 403);
      }
      const { error } = await admin.auth.admin.updateUserById(target, { password: pwd });
      if (error) throw new Fail(error.message);
      await admin.from("profiles").update({ must_change_password: true }).eq("id", target);
      return json({ ok: true });
    }

    throw new Fail("Action inconnue.");
  } catch (e) {
    const err = e instanceof Fail ? e : new Fail("Erreur serveur.", 500);
    if (!(e instanceof Fail)) console.error(e);
    return json({ error: err.message }, err.status);
  }
});
