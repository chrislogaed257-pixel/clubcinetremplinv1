import { createServerFn } from "@tanstack/react-start";
import { requireCloudAuth } from "@/lib/cloud-auth";

export type PositionAssignment = { positionId: string; rank: string };

type MemberInput = {
  email: string;
  password: string;
  fullName: string;
  positions: PositionAssignment[];
  managerIds: string[];
  role: "admin" | "member" | "mentor" | "funder";
  likes?: string | undefined;
  dislikes?: string | undefined;
  projectIds?: string[] | undefined;
  roleDescription?: string | undefined;
};

/** Description officielle des postes choisis, utilisée si aucune description n'est saisie. */
async function officialDescription(positions: PositionAssignment[]) {
  const ids = positions.map((p) => p.positionId).filter(Boolean);
  if (ids.length === 0) return "";
  const db = await admin();
  const { data } = await db.from("positions").select("name, description").in("id", ids);
  return (data ?? [])
    .filter((p) => (p.description ?? "").trim())
    .map((p) => `${p.name} : ${p.description}`)
    .join("\n\n");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureMentorConversation(role: string, id: string, name: string) {
  if (role !== "mentor") return;
  const db = await admin();
  await db
    .from("conversations")
    .upsert(
      { kind: "mentor", title: `Mentor — ${name}`, ref_id: id },
      { onConflict: "kind,ref_id" },
    );
}

async function memberCount() {
  const db = await admin();
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Accepte l'admin technique et le Producteur général. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: allowed } = await context.supabase.rpc("is_admin_or_general_producer", {
    _user_id: context.userId,
  });
  if (allowed) return;
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Accès refusé");
}

/** Conserve l'historique des postes occupés (poste, rang, période). */
async function recordPositionHistory(id: string, positions: PositionAssignment[]) {
  const db = await admin();
  const ids = positions.map((p) => p.positionId).filter(Boolean);
  const { data: names } = ids.length
    ? await db.from("positions").select("id, name").in("id", ids)
    : { data: [] };
  const wanted = positions.map((p) => ({
    name: (names ?? []).find((n) => n.id === p.positionId)?.name ?? "",
    rank: p.rank ?? "",
  }));
  const { data: current } = await db
    .from("profile_position_history")
    .select("id, position_name, rank_label")
    .eq("profile_id", id)
    .is("ended_on", null);

  for (const row of current ?? []) {
    const stays = wanted.some(
      (w) => w.name === row.position_name && w.rank === row.rank_label,
    );
    if (!stays) {
      await db
        .from("profile_position_history")
        .update({ ended_on: new Date().toISOString().slice(0, 10) })
        .eq("id", row.id);
    }
  }
  const toAdd = wanted.filter(
    (w) =>
      w.name &&
      !(current ?? []).some((c) => c.position_name === w.name && c.rank_label === w.rank),
  );
  if (toAdd.length > 0) {
    await db.from("profile_position_history").insert(
      toAdd.map((w) => ({ profile_id: id, position_name: w.name, rank_label: w.rank })),
    );
  }
}

async function syncPositionsAndManagers(
  id: string,
  positions: PositionAssignment[],
  managerIds: string[],
) {
  const db = await admin();
  await recordPositionHistory(id, positions);
  await db.from("profile_positions").delete().eq("profile_id", id);
  if (positions.length > 0) {
    const { error } = await db.from("profile_positions").insert(
      positions.map((p) => ({
        profile_id: id,
        position_id: p.positionId,
        rank_label: p.rank ?? "",
      })),
    );
    if (error) throw new Error(error.message);
  }
  await db.from("profile_managers").delete().eq("profile_id", id);
  const managers = managerIds.filter((m) => m && m !== id);
  if (managers.length > 0) {
    const { error } = await db
      .from("profile_managers")
      .insert(managers.map((m) => ({ profile_id: id, manager_id: m })));
    if (error) throw new Error(error.message);
  }
  // Compatibilité avec les anciens champs
  const { data: first } = await db
    .from("positions")
    .select("name")
    .eq("id", positions[0]?.positionId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  await db
    .from("profiles")
    .update({ position: first?.name ?? "", manager_id: managers[0] ?? null })
    .eq("id", id);
}


function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/{{\s*(\w+)\s*}}/g, (_m, k: string) => vars[k] ?? "");
}

async function template(key: string) {
  const db = await admin();
  const { data } = await db
    .from("message_templates")
    .select("subject, body")
    .eq("key", key)
    .maybeSingle();
  return { subject: data?.subject ?? "", body: data?.body ?? "" };
}

/** Rattache un membre aux projets sélectionnés (sans retirer les rattachements existants). */
async function syncProjects(id: string, projectIds: string[] | undefined, addedBy: string) {
  if (!projectIds || projectIds.length === 0) return;
  const db = await admin();
  await db.from("project_members").upsert(
    projectIds.map((project_id) => ({
      project_id,
      profile_id: id,
      added_by: addedBy,
      status: "pending",
    })),
    { onConflict: "project_id,profile_id", ignoreDuplicates: true },
  );
}

/** Notifications internes : bienvenue au membre + alerte à chacun de ses supérieurs. */
async function announceNewMember(
  id: string,
  fullName: string,
  email: string,
  password: string,
  managerIds: string[],
) {
  const db = await admin();
  const { data: pps } = await db
    .from("profile_positions")
    .select("position_id")
    .eq("profile_id", id);
  const posIds = (pps ?? []).map((p) => p.position_id);
  const { data: posRows } = posIds.length
    ? await db.from("positions").select("name").in("id", posIds)
    : { data: [] };
  const poste = (posRows ?? []).map((p) => p.name).join(", ") || "membre du club";

  const welcome = await template("welcome");
  await db.from("notifications").insert({
    user_id: id,
    title: welcome.subject || "Bienvenue dans Ciné Tremplin",
    body: fill(welcome.body, {
      nom: fullName,
      poste,
      email,
      mot_de_passe: password,
      lien: "/dashboard",
    }),
    link: "/dashboard",
  });

  const managers = [...new Set(managerIds.filter(Boolean))];
  if (managers.length === 0) return;
  const { data: mgrProfiles } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", managers);
  const alert = await template("new_member_manager");
  await db.from("notifications").insert(
    (mgrProfiles ?? []).map((m) => ({
      user_id: m.id,
      title: alert.subject || "Un nouveau membre rejoint votre équipe",
      body: fill(alert.body, { nom_superieur: m.full_name, nom: fullName, poste }),
      link: "/organigramme",
    })),
  );
}

export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { needsBootstrap: (await memberCount()) === 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; fullName: string }) => d)
  .handler(async ({ data }) => {
    if ((await memberCount()) > 0) throw new Error("Un compte administrateur existe déjà.");
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Création impossible");
    const id = created.user.id;
    const { error: pErr } = await db.from("profiles").insert({
      id,
      email: data.email,
      full_name: data.fullName,
      position: "Producteur général",
      manager_id: null,
    });
    if (pErr) throw new Error(pErr.message);
    const { error: rErr } = await db.from("user_roles").insert({ user_id: id, role: "admin" });
    if (rErr) throw new Error(rErr.message);
    const { data: pg } = await db
      .from("positions")
      .select("id")
      .eq("name", "Producteur général")
      .maybeSingle();
    if (pg) await db.from("profile_positions").insert({ profile_id: id, position_id: pg.id });
    return { ok: true };
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: MemberInput) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Création impossible");
    const id = created.user.id;
    const { error: pErr } = await db.from("profiles").insert({
      id,
      email: data.email,
      full_name: data.fullName,
      position: "",
      manager_id: null,
      likes: data.likes ?? "",
      dislikes: data.dislikes ?? "",
      role_description:
        (data.roleDescription ?? "").trim() || (await officialDescription(data.positions)),
    });
    if (pErr) throw new Error(pErr.message);
    const { error: rErr } = await db.from("user_roles").insert({ user_id: id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await ensureMentorConversation(data.role, id, data.fullName);
    await syncPositionsAndManagers(id, data.positions, data.managerIds);
    await syncProjects(id, data.projectIds, context.userId);
    await announceNewMember(id, data.fullName, data.email, data.password, data.managerIds);
    return { ok: true, id };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator(
    (d: {
      id: string;
      email?: string | undefined;
      fullName: string;
      positions: PositionAssignment[];
      managerIds: string[];
      role: "admin" | "member" | "mentor" | "funder";
      password?: string | undefined;
      likes?: string | undefined;
      dislikes?: string | undefined;
      projectIds?: string[] | undefined;
      roleDescription?: string | undefined;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const description =
      (data.roleDescription ?? "").trim() || (await officialDescription(data.positions));
    const newEmail = (data.email ?? "").trim().toLowerCase();
    if (newEmail) {
      const { error: eErr } = await db.auth.admin.updateUserById(data.id, {
        email: newEmail,
        email_confirm: true,
      });
      if (eErr) throw new Error(eErr.message);
    }
    const { error: pErr } = await db
      .from("profiles")
      .update({
        full_name: data.fullName,
        likes: data.likes ?? "",
        dislikes: data.dislikes ?? "",
        ...(newEmail ? { email: newEmail } : {}),
        ...(description ? { role_description: description } : {}),
      })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);

    if (data.password && data.password.length >= 6) {
      const { error } = await db.auth.admin.updateUserById(data.id, { password: data.password });
      if (error) throw new Error(error.message);
    }

    await db.from("user_roles").delete().eq("user_id", data.id);
    const { error: rErr } = await db
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await ensureMentorConversation(data.role, data.id, data.fullName);

    await syncPositionsAndManagers(data.id, data.positions, data.managerIds);
    await syncProjects(data.id, data.projectIds, context.userId);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId)
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const db = await admin();
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertProducer(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (isAdmin) return;
  for (const p of ["Producteur général", "Producteur délégué"]) {
    const { data: ok } = await context.supabase.rpc("has_position", {
      _user_id: context.userId,
      _position: p,
    });
    if (ok) return;
  }
  throw new Error("Accès refusé");
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `Cine-${out}!`;
}

/** Génère un nouveau mot de passe pour un membre et le renvoie une seule fois. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { id: string; forceChange: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertProducer(context);
    const db = await admin();
    const password = randomPassword();
    const { error } = await db.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);
    await db
      .from("profiles")
      .update({ must_change_password: data.forceChange })
      .eq("id", data.id);
    return { password };
  });

/** Force (ou annule) le changement de mot de passe à la prochaine connexion. */
export const setMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { id: string; value: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertProducer(context);
    const db = await admin();
    const { error } = await db
      .from("profiles")
      .update({ must_change_password: data.value })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Désactive ou réactive un compte sans supprimer aucune donnée. */
export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireCloudAuth])
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId && !data.active)
      throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    const { error: pErr } = await db
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });
