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
