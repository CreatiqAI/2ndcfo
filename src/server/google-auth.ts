import { randomBytes } from 'node:crypto';
import { createClient, type User } from '@supabase/supabase-js';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { users, companies, memberships, sessions } from './db/schema';
import { assert, audit } from './core';
import { hashPassword, tokenHash } from './auth';

export function oauthConfig() {
  const origin = process.env.APP_ORIGIN;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  assert(origin && url && key, 'Google sign-in is not configured yet.', 503);
  assert(new URL(origin).origin === origin, 'Invalid application origin.', 503);
  assert(new URL(url).protocol === 'https:', 'Supabase requires HTTPS.', 503);
  assert(
    process.env.NODE_ENV !== 'production' || origin.startsWith('https://'),
    'HTTPS is required.',
    503,
  );
  return { origin, url, key };
}
export function oauthClient(storage: Record<string, string>) {
  const { url, key } = oauthConfig();
  return createClient(url, key, {
    auth: {
      flowType: 'pkce',
      storageKey: 'finance-google',
      detectSessionInUrl: false,
      autoRefreshToken: false,
      persistSession: true,
      storage: {
        getItem: (key) => storage[key] ?? null,
        setItem: (key, value) => {
          storage[key] = value;
        },
        removeItem: (key) => {
          delete storage[key];
        },
      },
    },
  });
}
export function verifiedGoogleIdentity(user: User) {
  const identity = user.identities?.find((i) => i.provider === 'google');
  const data = identity?.identity_data;
  assert(
    user.email && user.email_confirmed_at && data?.email_verified === true,
    'A verified Google email is required.',
    401,
  );
  assert(
    typeof data.email === 'string' && data.email.toLowerCase() === user.email.toLowerCase(),
    'Google identity email mismatch.',
    401,
  );
  assert(user.id && identity?.provider === 'google', 'Google identity required.', 401);
  return {
    subject: user.id,
    email: user.email.toLowerCase(),
    name:
      typeof data.full_name === 'string' ? data.full_name.slice(0, 100) : user.email.split('@')[0],
  };
}
export async function googleSession(user: User, linkUserId?: string) {
  const identity = verifiedGoogleIdentity(user),
    db = await getDb();
  // Random unexposed password prevents password login on new Google-only accounts.
  const passwordHash = await hashPassword(randomBytes(48).toString('base64url'));
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${identity.email}))`);
    let [account] = await tx.select().from(users).where(eq(users.googleSubject, identity.subject));
    if (linkUserId) {
      assert(
        !account || account.id === linkUserId,
        'This Google account is already linked elsewhere.',
        409,
      );
      const [existing] = await tx.select().from(users).where(eq(users.id, linkUserId));
      assert(
        existing && existing.email === identity.email,
        'Use the Google account with the same email as your existing account.',
        409,
      );
      assert(
        !existing.googleSubject || existing.googleSubject === identity.subject,
        'A different Google account is already linked.',
        409,
      );
      [account] = await tx
        .update(users)
        .set({ googleSubject: identity.subject })
        .where(eq(users.id, linkUserId))
        .returning();
      const links = await tx.select().from(memberships).where(eq(memberships.userId, linkUserId));
      for (const member of links)
        await audit(
          tx,
          {
            userId: linkUserId,
            companyId: member.companyId,
            role: member.role as 'Admin',
            department: member.department,
          },
          linkUserId,
          'auth.google_linked',
          null,
          { provider: 'google' },
        );
    } else if (!account) {
      const [existing] = await tx.select().from(users).where(eq(users.email, identity.email));
      assert(
        !existing,
        'Sign in with your existing password first, then link Google in Settings.',
        409,
      );
      assert(process.env.ALLOW_SIGNUP !== 'false', 'Registration is disabled.', 403);
      [account] = await tx
        .insert(users)
        .values({
          email: identity.email,
          name: identity.name,
          passwordHash,
          googleSubject: identity.subject,
        })
        .returning();
      const [company] = await tx
        .insert(companies)
        .values({ name: identity.name + ' workspace' })
        .returning();
      await tx
        .insert(memberships)
        .values({ userId: account.id, companyId: company.id, role: 'Admin' });
      await audit(
        tx,
        { userId: account.id, companyId: company.id, role: 'Admin', department: null },
        company.id,
        'workspace.created',
        null,
        { provider: 'google' },
      );
    }
    const token = randomBytes(32).toString('base64url');
    await tx
      .insert(sessions)
      .values({
        userId: account.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 8 * 3600000),
      });
    return token;
  });
}
