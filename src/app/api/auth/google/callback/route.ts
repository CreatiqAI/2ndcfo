import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { oauthClient, oauthConfig, googleSession } from '@/server/google-auth';
import { sessionUser, tokenHash } from '@/server/auth';
import { assert, AppError } from '@/server/core';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const jar = await cookies(),
    origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  try {
    oauthConfig();
    const params = new URL(request.url).searchParams;
    const pending = JSON.parse(jar.get('finance_google')?.value || 'null');
    jar.delete({ name: 'finance_google', path: '/api/auth/google' });
    assert(
      pending &&
        pending.state === params.get('state') &&
        Date.now() - pending.started < 600000 &&
        pending.started <= Date.now(),
      'Google sign-in expired. Please try again.',
      400,
    );
    assert(
      !params.get('error') && params.get('code'),
      'Google sign-in was cancelled or could not finish.',
      400,
    );
    let linkUserId: string | undefined;
    if (pending.linkSession) {
      const token = jar.get('finance_session')?.value;
      assert(
        token && tokenHash(token) === pending.linkSession,
        'Sign in again before linking Google.',
        401,
      );
      linkUserId = (await sessionUser(token)).id;
    }
    const client = oauthClient(pending.storage);
    const { data, error } = await client.auth.exchangeCodeForSession(params.get('code')!);
    assert(!error && data.session, 'Google sign-in could not be verified. Please try again.', 401);
    const verified = await client.auth.getUser(data.session.access_token);
    assert(!verified.error && verified.data.user, 'Google identity could not be verified.', 401);
    const token = await googleSession(verified.data.user, linkUserId);
    jar.set('finance_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin.startsWith('https:'),
      path: '/',
      maxAge: 8 * 3600,
    });
    return NextResponse.redirect(origin + '/?google=success');
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : 'Google sign-in could not finish. Please try again.';
    return NextResponse.redirect(origin + '/?auth_error=' + encodeURIComponent(message));
  }
}
