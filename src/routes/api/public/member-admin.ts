import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    memberId: z.string().uuid(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
  }),
  z.object({ action: z.literal("delete"), memberId: z.string().uuid() }),
  z.object({
    action: z.literal("reset-password"),
    memberId: z.string().uuid(),
    password: z.string().min(6),
  }),
  z.object({ action: z.literal("set-active"), memberId: z.string().uuid(), active: z.boolean() }),
]);

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const Route = createFileRoute("/api/public/member-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authorization = request.headers.get("authorization") ?? "";
          if (!authorization.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);
          const token = authorization.slice(7);
          const url = process.env["SUPABASE_URL"]!;
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
          const authClient = createClient(url, key, {
            global: { headers: { Authorization: authorization } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: userData, error: userError } = await authClient.auth.getUser(token);
          const user = userData.user;
          if (userError || !user) return json({ error: "Session invalide" }, 401);

          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return json({ error: "Demande invalide" }, 400);

          const { data: isGeneralProducer } = await authClient.rpc(
            "is_admin_or_general_producer",
            { _user_id: user.id },
          );
          let allowed = !!isGeneralProducer;
          if (!allowed && parsed.data.action === "reset-password") {
            const { data: isDelegateProducer } = await authClient.rpc("has_position", {
              _user_id: user.id,
              _position: "Producteur délégué",
            });
            allowed = !!isDelegateProducer;
          }
          if (!allowed) return json({ error: "Accès refusé" }, 403);
          if (
            parsed.data.memberId === user.id &&
            (parsed.data.action === "delete" ||
              (parsed.data.action === "set-active" && !parsed.data.active))
          ) {
            return json({ error: "Vous ne pouvez pas supprimer ou désactiver votre propre compte." }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let error: { message: string } | null = null;
          if (parsed.data.action === "update") {
            const attrs: { email?: string; email_confirm?: boolean; password?: string } = {};
            if (parsed.data.email) {
              attrs.email = parsed.data.email.trim().toLowerCase();
              attrs.email_confirm = true;
            }
            if (parsed.data.password) attrs.password = parsed.data.password;
            if (Object.keys(attrs).length > 0) {
              ({ error } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.memberId, attrs));
            }
          } else if (parsed.data.action === "delete") {
            ({ error } = await supabaseAdmin.auth.admin.deleteUser(parsed.data.memberId));
          } else if (parsed.data.action === "reset-password") {
            ({ error } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.memberId, {
              password: parsed.data.password,
            }));
          } else {
            ({ error } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.memberId, {
              ban_duration: parsed.data.active ? "none" : "876000h",
            }));
          }
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Opération impossible";
          return json({ error: message }, 500);
        }
      },
    },
  },
});