import { NextResponse } from 'next/server';
import { actorFor } from '@/server/auth';
import { failure, requestUser } from '@/server/http';
import { snapshot, workspaceList } from '@/server/workspace';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requestUser(),
      workspaces = await workspaceList(user.id),
      companyId = new URL(request.url).searchParams.get('company') || workspaces[0]?.id;
    return NextResponse.json(
      {
        user,
        workspaces,
        state: companyId ? await snapshot(await actorFor(user.id, companyId)) : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
