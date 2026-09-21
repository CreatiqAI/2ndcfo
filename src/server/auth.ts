import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from './db';
import { authAttempts, companies, memberships, sessions, users } from './db/schema';
import { AppError, assert, audit, type Actor, type Role } from './core';
const scrypt = promisify(scryptCb);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
async function verify(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return key.length === 128 && timingSafeEqual(hash, Buffer.from(key, 'hex'));
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase().trim()),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(128),
  name: z.string().trim().min(2).max(100).optional(),
  company: z.string().trim().min(2).max(100).optional(),
});
export async function authenticate(input: unknown, signup: boolean) {
  const data = credentials.parse(input),
    db = await getDb();
  if (signup) assert(process.env.ALLOW_SIGNUP !== 'false', 'Registration is disabled.', 403);
  const throttleKey = tokenHash(data.email);
  const attempts = await db.execute(
    sql`INSERT INTO auth_attempts(key,count,reset_at) VALUES(${throttleKey},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempts.reset_at<now() THEN 1 ELSE auth_attempts.count+1 END, reset_at=CASE WHEN auth_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE auth_attempts.reset_at END RETURNING count`,
  );
  assert(Number(attempts.rows[0].count) <= 10, 'Too many attempts. Try again in 15 minutes.', 429);
  let [user] = await db.select().from(users).where(eq(users.email, data.email));
  if (signup) {
    assert(!user, 'Unable to create this account. Try signing in.', 409);
    assert(data.name && data.company, 'Your name and company name are required.');
    const passwordHash = await hashPassword(data.password);
    user = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ email: data.email, name: data.name!, passwordHash })
        .returning();
      const [company] = await tx.insert(companies).values({ name: data.company! }).returning();
      await tx
        .insert(memberships)
        .values({ companyId: company.id, userId: newUser.id, role: 'Admin' });
      await audit(
        tx,
        { userId: newUser.id, companyId: company.id, role: 'Admin', department: null },
        company.id,
        'workspace.created',
        null,
        { name: company.name },
      );
      return newUser;
    });
  } else {
    // Fixed-cost password computation also occurs for unknown accounts.
    const valid = await verify(
      data.password,
      user?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`,
    );
    assert(user && valid, 'Email or password is incorrect.', 401);
  }
  await db.delete(authAttempts).where(eq(authAttempts.key, throttleKey));
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 8 * 3600000),
  });
  return token;
}
export async function sessionUser(token: string | undefined) {
  if (!token) throw new AppError(401, 'Please sign in.');
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())));
  assert(row, 'Session expired. Please sign in.', 401);
  return row;
}
export async function actorFor(userId: string, companyId: string): Promise<Actor> {
  assert(z.uuid().safeParse(companyId).success, 'Select a valid workspace.');
  const [member] = await (
    await getDb()
  )
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.companyId, companyId)));
  assert(member, 'You do not have access to this workspace.', 403);
  return { userId, companyId, role: member.role as Role, department: member.department };
}
export function checkOrigin(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local') {
    assert(
      process.env.APP_ORIGIN?.startsWith('https://'),
      'Production APP_ORIGIN must be configured as HTTPS.',
      503,
    );
  }
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  assert(request.headers.get('origin') === expected, 'Request origin was rejected.', 403);
}
