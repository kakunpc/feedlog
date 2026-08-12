import { and, asc, eq, inArray } from 'drizzle-orm'
import { member, user } from '#layers/feedlog/server/db/schemas'

// GET /api/admin/assignees — dashboard-capable members eligible for assignment.
export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })

  return useDB()
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: member.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(
      eq(member.organizationId, orgId),
      inArray(member.role, ['contributor', 'manager', 'owner']),
    ))
    .orderBy(asc(user.name), asc(user.id))
})
