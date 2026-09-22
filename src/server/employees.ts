import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { credentials, hashPassword } from './auth';
import { getDb } from './db';
import { users, memberships } from './db/schema';
import { type Actor, requireRole, lockCompany, assert, audit } from './core';

export async function addEmployee(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin']);
  const data = credentials
    .extend({
      name: z.string().trim().min(2).max(100),
      department: z.string().trim().min(1).max(100),
    })
    .parse(input);
  const passwordHash = await hashPassword(data.password);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email));
    assert(
      !existing,
      'This email already has an account. Add it through Settings → Workspace member; its password will stay unchanged.',
      409,
    );
    const [user] = await tx
      .insert(users)
      .values({ name: data.name, email: data.email, passwordHash })
      .returning({ id: users.id });
    const [member] = await tx
      .insert(memberships)
      .values({
        companyId: actor.companyId,
        userId: user.id,
        role: 'Employee',
        department: data.department,
      })
      .returning();
    await audit(tx, actor, member.id, 'employee.created', null, {
      userId: user.id,
      name: data.name,
      email: data.email,
      department: data.department,
      role: 'Employee',
    });
    return { id: user.id };
  });
}
