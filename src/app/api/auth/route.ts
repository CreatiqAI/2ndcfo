import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { authenticate, actorFor, checkOrigin, sessionUser, tokenHash } from '@/server/auth';
import { getDb, localMode } from '@/server/db';
import { sessions } from '@/server/db/schema';
import { assert } from '@/server/core';
import { failure } from '@/server/http';
import { seedDemo } from '@/server/demo';
import { workspaceList } from '@/server/workspace';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const data = await request.json();
    if (data.action === 'logout') {
      const jar = await cookies(),
        token = jar.get('finance_session')?.value;
      if (token)
        await (await getDb()).delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
      jar.delete('finance_session');
      return NextResponse.json({ ok: true });
    }
    assert(['login', 'signup', 'demo'].includes(data.action), 'Unknown authentication action.');
    let token: string;
    if (data.action === 'demo') {
      assert(localMode(), 'Demo workspaces are available only in local mode.', 403);
      token = await authenticate(
        {
          email: `demo-${randomBytes(8).toString('hex')}@example.invalid`,
          password: randomBytes(24).toString('base64url'),
          name: 'Alex Morgan',
          company: 'Northstar · Demo workspace',
        },
        true,
      );
      const user = await sessionUser(token),
        [company] = await workspaceList(user.id);
      await seedDemo(await actorFor(user.id, company.id));
    } else token = await authenticate(data, data.action === 'signup');
    (await cookies()).set('finance_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.APP_ORIGIN || request.url).startsWith('https:'),
      path: '/',
      maxAge: 8 * 3600,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
