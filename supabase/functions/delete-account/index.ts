// POST /functions/v1/delete-account  — the signed-in guest deletes their account (Apple App Review 5.1.1(v)).
// Personal data is erased; anonymous payment/trip records are kept as the law requires. Refused while the
// guest has upcoming paid trips (cancel those first, so nobody loses money by accident).
import { withSupabase } from 'npm:@supabase/server@1';
import { fail, json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    const uid = ctx.userClaims!.id;
    const { data, error } = await ctx.supabaseAdmin.rpc('erase_guest', { p_guest: uid });
    if (error) return fail(500, 'erase_failed', error.message);
    if (data === 'has_upcoming') return fail(409, 'has_upcoming', 'Cancel or finish your upcoming trips first');
    // Soft delete: the login (email) is removed and can't sign in again; the anonymous id keeps records valid.
    // Remove the guest's community photos and videos too (best effort; the posts are already deleted).
    const bucket = ctx.supabaseAdmin.storage.from('community');
    const { data: files } = await bucket.list(uid, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f: { name: string }) => `${uid}/${f.name}`));
    const { error: derr } = await ctx.supabaseAdmin.auth.admin.deleteUser(uid, true);
    if (derr) return fail(500, 'delete_failed', derr.message);
    return json({ deleted: true });
  }),
};
