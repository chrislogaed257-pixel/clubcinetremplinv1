import { supabase } from "@/integrations/supabase/client";

/** Journal de traçabilité des opérations comptables. */
export async function logAccounting(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  detail: string,
) {
  await supabase
    .from("accounting_log")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId, detail });
}
