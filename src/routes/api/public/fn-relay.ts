import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ name: z.string().max(60), data: z.unknown() });

async function registry(): Promise<Record<string, (arg: any) => Promise<unknown>>> {
  const [ideas, mentors, password, help, projects, admin] = await Promise.all([
    import("@/lib/ideas.functions"),
    import("@/lib/mentors.functions"),
    import("@/lib/password.functions"),
    import("@/lib/password-help.functions"),
    import("@/lib/projects.functions"),
    import("@/lib/admin.functions"),
  ]);
  return {
    submitIdea: ideas.submitIdea,
    getIdeaFileLink: ideas.getIdeaFileLink,
    submitIdeaFull: ideas.submitIdeaFull,
    approveIdeaAsProducer: ideas.approveIdeaAsProducer,
    acceptMentorInvite: mentors.acceptMentorInvite,
    mentorProjects: mentors.mentorProjects,
    mentorMessageToClub: mentors.mentorMessageToClub,
    mentorThread: mentors.mentorThread,
    mentorSendMessage: mentors.mentorSendMessage,
    lookupMember: password.lookupMember,
    sendPasswordRequest: password.sendPasswordRequest,
    requesterDetails: help.requesterDetails,
    issueTemporaryPassword: help.issueTemporaryPassword,
    createProject: projects.createProject,
    getBootstrapStatus: admin.getBootstrapStatus,
    setMustChangePassword: admin.setMustChangePassword,
  } as any;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

// Relais pour les hébergements sans clé privée : chaque opération garde ses propres contrôles d'accès.
export const Route = createFileRoute("/api/public/fn-relay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Demande invalide" }, 400);
        const fn = (await registry())[parsed.data.name];
        if (!fn) return json({ error: "Opération inconnue" }, 404);
        try {
          const arg = parsed.data.data === null ? undefined : { data: parsed.data.data };
          return json({ result: await fn(arg) });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Opération impossible";
          return json({ error: msg }, /Unauthorized|session|refus/i.test(msg) ? 403 : 400);
        }
      },
    },
  },
});
