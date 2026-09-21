import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkOrigin, sessionUser, tokenHash } from '@/server/auth';
import { oauthClient, oauthConfig } from '@/server/google-auth';
import { failure } from '@/server/http';
import { assert } from '@/server/core';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { origin, url, key } = oauthConfig();
    const settings = await fetch(url + '/auth/v1/settings', {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    assert(
      settings.ok && (await settings.json()).external?.google === true,
      'Google sign-in is waiting for Google OAuth setup in Supabase. Please use email and password for now.',
      503,
    );
    const jar = await cookies(),
      session = jar.get('finance_session')?.value;
    const body = await request.json();
    const link = body.link === true;
    if (link) await sessionUser(session);
    const storage: Record<string, string> = {},
      state = randomBytes(32).toString('base64url');
    const client = oauthClient(storage);
    const result = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: origin + '/api/auth/google/callback?state=' + state,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    assert(!result.error && result.data.url, 'Unable to start Google sign-in.', 502);
    jar.set(
      'finance_google',
      JSON.stringify({
        state,
        storage,
        started: Date.now(),
        linkSession: link ? tokenHash(session!) : null,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: origin.startsWith('https:'),
        path: '/api/auth/google',
        maxAge: 600,
      },
    );
    return NextResponse.json(
      { url: result.data.url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
