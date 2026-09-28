import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { actorFor, sessionUser } from './auth';
import { AppError } from './core';
export async function requestUser() {
  return sessionUser((await cookies()).get('finance_session')?.value);
}
export async function requestActor(companyId: string) {
  const user = await requestUser();
  return actorFor(user.id, companyId);
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((x) => `${x.path.join('.')}: ${x.message}`)
          .slice(0, 5)
          .join('; '),
      },
      { status: 400 },
    );
  // Inspect the driver cause without logging ORM queries or bound financial data.
  const cause = error instanceof Error ? error.cause || error : null;
  if (cause instanceof Error && cause.message.includes('EMAXCONNSESSION')) {
    console.error('Request failed: database session pool capacity reached');
    return NextResponse.json(
      { error: 'The database is temporarily busy. Please wait a few seconds and retry.' },
      { status: 503, headers: { 'Retry-After': '5' } },
    );
  }
  // ORM error messages can contain financial values or credential hashes.
  console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json(
    {
      error:
        'The request could not be completed. Your existing records are preserved. Please retry or check the server logs.',
    },
    { status: 500 },
  );
}
