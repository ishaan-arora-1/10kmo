import { withSupabase } from "npm:@supabase/server@1.5.2";
import type { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const userID = context.userClaims?.id;
    if (!userID) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const { error: deleteError } = await context.supabaseAdmin.auth.admin
      .deleteUser(userID);
    if (deleteError) {
      console.error("account deletion failed", deleteError);
      return Response.json(
        { error: "Account could not be deleted" },
        { status: 500 },
      );
    }

    return Response.json({ deleted: true });
  }),
};
