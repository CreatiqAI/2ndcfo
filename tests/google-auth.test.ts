import { beforeAll, describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { googleSession, verifiedGoogleIdentity } from '../src/server/google-auth';
import { authenticate, sessionUser } from '../src/server/auth';
import { getDb } from '../src/server/db';
import { users, memberships } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';
const identity = (email: string, id = randomUUID()) =>
  ({
    id,
    email,
    aud: 'authenticated',
    app_metadata: { provider: 'google' },
    user_metadata: {},
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    identities: [
      {
        id,
        identity_id: randomUUID(),
        user_id: id,
        provider: 'google',
        identity_data: { email, email_verified: true, full_name: 'Google Tester' },
      },
    ],
  }) as User;
beforeAll(async () => {
  process.env.DATABASE_MODE = 'local';
  process.env.LOCAL_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'finance-google-'));
  await getDb();
});
describe('Google identity and existing account protection', () => {
  it('rejects missing or unverified Google identities', () => {
    const user = identity('unverified@example.invalid');
    user.identities![0].identity_data!.email_verified = false;
    expect(() => verifiedGoogleIdentity(user)).toThrow();
    user.identities = [];
    expect(() => verifiedGoogleIdentity(user)).toThrow();
  });
  it('rejects identity email mismatch', () => {
    const user = identity('a@example.invalid');
    user.identities![0].identity_data!.email = 'b@example.invalid';
    expect(() => verifiedGoogleIdentity(user)).toThrow();
  });
  it('creates one workspace and reuses the stable identity on repeat login', async () => {
    const user = identity('google-new@example.invalid');
    const first = await sessionUser(await googleSession(user));
    const second = await sessionUser(await googleSession(user));
    expect(second.id).toBe(first.id);
    const links = await (
      await getDb()
    )
      .select()
      .from(memberships)
      .where(eq(memberships.userId, first.id));
    expect(links).toHaveLength(1);
    expect(links[0].role).toBe('Admin');
  });
  it('requires password session linking for existing email and preserves membership', async () => {
    const email = 'existing-google@example.invalid';
    const existing = await sessionUser(
      await authenticate(
        {
          email,
          password: 'existing-account-password',
          name: 'Existing User',
          company: 'Existing Company',
        },
        true,
      ),
    );
    const google = identity(email);
    await expect(googleSession(google)).rejects.toThrow('existing password');
    const linked = await sessionUser(await googleSession(google, existing.id));
    expect(linked.id).toBe(existing.id);
    expect((await sessionUser(await googleSession(google))).id).toBe(existing.id);
    const links = await (
      await getDb()
    )
      .select()
      .from(memberships)
      .where(eq(memberships.userId, existing.id));
    expect(links).toHaveLength(1);
    await expect(
      googleSession(identity('someone-else@example.invalid'), existing.id),
    ).rejects.toThrow('same email');
    const [saved] = await (await getDb()).select().from(users).where(eq(users.id, existing.id));
    expect(saved.googleSubject).toBe(google.id);
  });
});
