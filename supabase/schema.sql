-- =====================================================================
--  Maarifa Mini — schéma Supabase
--  À exécuter une seule fois dans : Supabase > SQL Editor > New query
--
--  Principes de sécurité
--  * Chaque donnée appartient à un établissement (school_id).
--  * Seuls les membres actifs d'un établissement (Fondateur ou
--    Administrateur) peuvent lire ou modifier ses données (RLS).
--  * L'argent ne passe QUE par deux fonctions serveur :
--      create_receipt()  -> encaissement (montants vérifiés côté serveur)
--      cancel_receipt()  -> annulation motivée
--    Personne ne peut écrire directement dans receipts / payment_lines.
--  * Les reçus et lignes de paiement ne peuvent jamais être supprimés ;
--    un reçu peut seulement passer de « valide » à « annulé ».
--  * Le journal d'audit est en ajout seul : ni modification, ni suppression.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  is_superadmin boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sigle text not null default '',
  annee text not null default '',
  adresse text not null default '',
  tel text not null default '',
  classes jsonb not null default '[]'::jsonb,   -- [{id,name,fee}]
  months  jsonb not null default '[]'::jsonb,   -- [{key:'2026-10',label,on}]
  fields  jsonb not null default '{}'::jsonb,   -- {student:{k:{show,req}}, family:{...}}
  receipt_seq integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.memberships (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('fondateur','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (school_id, user_id)
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  code text not null check (length(trim(code)) > 0),
  nom text not null check (length(trim(nom)) > 0),
  info jsonb not null default '{}'::jsonb,       -- tuteur, téléphones, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code),
  unique (id, school_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  family_id uuid not null,
  nom text not null check (length(trim(nom)) > 0),
  class_id text,
  reduction integer not null default 0 check (reduction >= 0),
  statut text not null default 'Actif' check (statut in ('Actif','Sorti')),
  date_inscription date,
  date_sortie date,
  info jsonb not null default '{}'::jsonb,       -- état civil configurable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (family_id, school_id) references public.families(id, school_id) on delete restrict
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  number text not null,
  family_id uuid not null,
  family_code text not null default '',
  family_nom text not null default '',
  date date not null,
  mode text not null default '',
  payer text not null default '',
  note text not null default '',
  total integer not null check (total > 0),
  status text not null default 'valide' check (status in ('valide','annule')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_by_name text not null default '',
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancelled_by_name text,
  cancel_reason text,
  unique (school_id, number),
  unique (id, school_id),
  foreign key (family_id, school_id) references public.families(id, school_id) on delete restrict
);

create table if not exists public.payment_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  school_id uuid not null,
  student_id uuid not null,
  student_nom text not null default '',
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount integer not null check (amount > 0),
  foreign key (receipt_id, school_id) references public.receipts(id, school_id) on delete restrict,
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  at timestamptz not null default now(),
  actor_id uuid not null,
  actor_name text not null default '',
  actor_email text not null default '',
  actor_role text not null default '',
  action text not null check (action in ('encaissement','annulation')),
  receipt_id uuid,
  receipt_number text,
  family_code text,
  family_nom text,
  amount integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create index if not exists families_school_idx on public.families(school_id);
create index if not exists students_school_idx on public.students(school_id);
create index if not exists students_family_idx on public.students(family_id);
create index if not exists receipts_school_idx on public.receipts(school_id, date desc);
create index if not exists lines_school_idx on public.payment_lines(school_id);
create index if not exists lines_student_month_idx on public.payment_lines(student_id, month);
create index if not exists lines_receipt_idx on public.payment_lines(receipt_id);
create index if not exists audit_school_idx on public.audit_log(school_id, at desc);
create index if not exists memberships_user_idx on public.memberships(user_id);

-- ---------------------------------------------------------------------
-- Profil créé automatiquement pour chaque compte
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Fonctions d'aide pour les règles d'accès
-- ---------------------------------------------------------------------
create or replace function public.is_member(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where school_id = p_school and user_id = auth.uid() and active);
$$;

create or replace function public.is_fondateur(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where school_id = p_school and user_id = auth.uid() and active and role = 'fondateur');
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.shares_school(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships a
                 join public.memberships b on a.school_id = b.school_id
                 where a.user_id = auth.uid() and a.active and b.user_id = p_user);
$$;

-- ---------------------------------------------------------------------
-- Mensualité due pour un élève et un mois (même règle que l'application)
-- ---------------------------------------------------------------------
create or replace function public.due_for(p_school public.schools, p_st public.students, p_month text)
returns integer language plpgsql stable set search_path = public as $$
declare v_on boolean; v_fee numeric;
begin
  select coalesce((m->>'on')::boolean, false) into v_on
    from jsonb_array_elements(p_school.months) m where m->>'key' = p_month limit 1;
  if not coalesce(v_on, false) then return 0; end if;
  if p_st.date_inscription is not null and p_month < to_char(p_st.date_inscription, 'YYYY-MM') then return 0; end if;
  if p_st.statut = 'Sorti' and p_st.date_sortie is not null and p_month > to_char(p_st.date_sortie, 'YYYY-MM') then return 0; end if;
  select nullif(c->>'fee','')::numeric into v_fee
    from jsonb_array_elements(p_school.classes) c where c->>'id' = p_st.class_id limit 1;
  return greatest(0, round(coalesce(v_fee, 0))::integer - p_st.reduction);
end $$;

-- ---------------------------------------------------------------------
-- Encaissement (seule porte d'entrée de l'argent)
--   p_lines = [{"student_id": "...", "month": "2026-10", "amount": 25000}, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_receipt(
  p_school uuid, p_family uuid, p_date date, p_mode text, p_payer text, p_note text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text; v_prof public.profiles; v_school public.schools; v_fam public.families;
  v_st public.students; v_line jsonb; v_amt integer; v_month text;
  v_due integer; v_paid integer; v_total integer := 0; v_seq integer;
  v_rec public.receipts; v_details jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Vous devez être connecté.'; end if;
  select role into v_role from public.memberships where school_id = p_school and user_id = v_uid and active;
  if v_role is null then raise exception 'Accès refusé à cet établissement.'; end if;

  -- verrouille l'établissement : numéros de reçu sans trou ni doublon
  select * into v_school from public.schools where id = p_school for update;
  select * into v_fam from public.families where id = p_family and school_id = p_school;
  if not found then raise exception 'Famille introuvable dans cet établissement.'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 366 then
    raise exception 'Date de paiement invalide.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Aucun montant saisi.'; end if;
  if jsonb_array_length(p_lines) > 200 then raise exception 'Trop de lignes sur un reçu.'; end if;
  if exists (select 1 from jsonb_array_elements(p_lines) l
             group by l->>'student_id', l->>'month' having count(*) > 1) then
    raise exception 'Un même élève et un même mois apparaissent deux fois.'; end if;

  -- 1) vérification de chaque ligne
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_amt := nullif(v_line->>'amount','')::numeric::integer;
    v_month := v_line->>'month';
    if v_amt is null or v_amt <= 0 then raise exception 'Montant invalide.'; end if;
    select * into v_st from public.students
      where id = (v_line->>'student_id')::uuid and school_id = p_school and family_id = p_family;
    if not found then raise exception 'Un élève ne fait pas partie de cette famille.'; end if;
    v_due := public.due_for(v_school, v_st, v_month);
    select coalesce(sum(pl.amount),0) into v_paid
      from public.payment_lines pl join public.receipts r on r.id = pl.receipt_id
      where pl.student_id = v_st.id and pl.month = v_month and r.status = 'valide';
    if v_amt > v_due - v_paid then
      raise exception 'Montant trop élevé pour % (%) : reste dû %.', v_st.nom, v_month, greatest(v_due - v_paid, 0);
    end if;
    v_total := v_total + v_amt;
    v_details := v_details || jsonb_build_object('eleve', v_st.nom, 'mois', v_month, 'montant', v_amt);
  end loop;

  -- 2) écriture
  select * into v_prof from public.profiles where id = v_uid;
  v_seq := v_school.receipt_seq + 1;
  update public.schools set receipt_seq = v_seq where id = p_school;

  insert into public.receipts (school_id, number, family_id, family_code, family_nom, date, mode, payer, note,
                               total, created_by, created_by_name)
  values (p_school, 'R-' || lpad(v_seq::text, 5, '0'), p_family, v_fam.code, v_fam.nom, p_date,
          left(coalesce(p_mode,''),60), left(coalesce(p_payer,''),120), left(coalesce(p_note,''),500),
          v_total, v_uid, coalesce(nullif(v_prof.full_name,''), v_prof.email))
  returning * into v_rec;

  insert into public.payment_lines (receipt_id, school_id, student_id, student_nom, month, amount)
  select v_rec.id, p_school, s.id, s.nom, l->>'month', (l->>'amount')::numeric::integer
    from jsonb_array_elements(p_lines) l join public.students s on s.id = (l->>'student_id')::uuid;

  insert into public.audit_log (school_id, actor_id, actor_name, actor_email, actor_role, action,
                                receipt_id, receipt_number, family_code, family_nom, amount, details)
  values (p_school, v_uid, v_prof.full_name, v_prof.email, v_role, 'encaissement',
          v_rec.id, v_rec.number, v_fam.code, v_fam.nom, v_total,
          jsonb_build_object('date', p_date, 'mode', v_rec.mode, 'verse_par', v_rec.payer,
                             'note', v_rec.note, 'lignes', v_details));

  return jsonb_build_object('id', v_rec.id, 'number', v_rec.number, 'total', v_total);
end $$;

-- ---------------------------------------------------------------------
-- Annulation motivée d'un reçu
-- ---------------------------------------------------------------------
create or replace function public.cancel_receipt(p_receipt uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rec public.receipts; v_role text; v_prof public.profiles; v_lines jsonb;
begin
  if v_uid is null then raise exception 'Vous devez être connecté.'; end if;
  select * into v_rec from public.receipts where id = p_receipt for update;
  if not found then raise exception 'Reçu introuvable.'; end if;
  select role into v_role from public.memberships where school_id = v_rec.school_id and user_id = v_uid and active;
  if v_role is null then raise exception 'Accès refusé à cet établissement.'; end if;
  if v_rec.status = 'annule' then raise exception 'Ce reçu est déjà annulé.'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Indiquez le motif de l''annulation (5 caractères minimum).'; end if;

  select * into v_prof from public.profiles where id = v_uid;
  update public.receipts set status = 'annule', cancelled_at = now(), cancelled_by = v_uid,
         cancelled_by_name = coalesce(nullif(v_prof.full_name,''), v_prof.email),
         cancel_reason = left(trim(p_reason), 500)
   where id = p_receipt;

  select coalesce(jsonb_agg(jsonb_build_object('eleve', student_nom, 'mois', month, 'montant', amount)), '[]'::jsonb)
    into v_lines from public.payment_lines where receipt_id = p_receipt;

  insert into public.audit_log (school_id, actor_id, actor_name, actor_email, actor_role, action,
                                receipt_id, receipt_number, family_code, family_nom, amount, details)
  values (v_rec.school_id, v_uid, v_prof.full_name, v_prof.email, v_role, 'annulation',
          v_rec.id, v_rec.number, v_rec.family_code, v_rec.family_nom, v_rec.total,
          jsonb_build_object('motif', left(trim(p_reason),500), 'encaisse_par', v_rec.created_by_name,
                             'encaisse_le', v_rec.created_at, 'date_recu', v_rec.date, 'lignes', v_lines));
  return jsonb_build_object('id', v_rec.id, 'number', v_rec.number);
end $$;

create or replace function public.mark_password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Gardes d'inaltérabilité
-- ---------------------------------------------------------------------
create or replace function public.guard_receipts() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Un reçu ne peut pas être supprimé ; annulez-le.'; end if;
  if old.status = 'annule' then raise exception 'Un reçu annulé ne peut plus être modifié.'; end if;
  if new.status <> 'annule'
     or (new.id, new.school_id, new.number, new.family_id, new.family_code, new.family_nom, new.date, new.mode,
         new.payer, new.note, new.total, new.created_at, new.created_by, new.created_by_name)
        is distinct from
        (old.id, old.school_id, old.number, old.family_id, old.family_code, old.family_nom, old.date, old.mode,
         old.payer, old.note, old.total, old.created_at, old.created_by, old.created_by_name)
  then raise exception 'Seule l''annulation d''un reçu est permise.'; end if;
  return new;
end $$;
drop trigger if exists guard_receipts on public.receipts;
create trigger guard_receipts before update or delete on public.receipts
  for each row execute function public.guard_receipts();

create or replace function public.guard_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Enregistrement inaltérable (%).', tg_table_name;
end $$;
drop trigger if exists guard_lines on public.payment_lines;
create trigger guard_lines before update or delete on public.payment_lines
  for each row execute function public.guard_immutable();
drop trigger if exists guard_audit on public.audit_log;
create trigger guard_audit before update or delete on public.audit_log
  for each row execute function public.guard_immutable();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_families on public.families;
create trigger touch_families before update on public.families for each row execute function public.touch_updated_at();
drop trigger if exists touch_students on public.students;
create trigger touch_students before update on public.students for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.schools       enable row level security;
alter table public.memberships   enable row level security;
alter table public.families      enable row level security;
alter table public.students      enable row level security;
alter table public.receipts      enable row level security;
alter table public.payment_lines enable row level security;
alter table public.audit_log     enable row level security;

-- Les visiteurs non connectés n'ont accès à rien.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;

-- Les connectés : lecture via RLS, écriture limitée aux tables autorisées.
revoke all on all tables in schema public from authenticated;
grant select on public.profiles, public.schools, public.memberships, public.families, public.students,
                public.receipts, public.payment_lines, public.audit_log to authenticated;
grant insert, update, delete on public.families, public.students to authenticated;
grant update (name, sigle, annee, adresse, tel, classes, months, fields) on public.schools to authenticated;

grant execute on function public.is_member(uuid), public.is_fondateur(uuid), public.is_superadmin(),
  public.shares_school(uuid), public.create_receipt(uuid,uuid,date,text,text,text,jsonb),
  public.cancel_receipt(uuid,text), public.mark_password_changed() to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_superadmin() or public.shares_school(id));

drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools for select to authenticated
  using (public.is_member(id) or public.is_superadmin());
drop policy if exists schools_update on public.schools;
create policy schools_update on public.schools for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_member(school_id) or public.is_superadmin());

drop policy if exists families_all on public.families;
create policy families_all on public.families for all to authenticated
  using (public.is_member(school_id)) with check (public.is_member(school_id));

drop policy if exists students_all on public.students;
create policy students_all on public.students for all to authenticated
  using (public.is_member(school_id)) with check (public.is_member(school_id));

drop policy if exists receipts_read on public.receipts;
create policy receipts_read on public.receipts for select to authenticated using (public.is_member(school_id));
drop policy if exists lines_read on public.payment_lines;
create policy lines_read on public.payment_lines for select to authenticated using (public.is_member(school_id));
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_member(school_id));
