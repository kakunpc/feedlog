import { and, desc, eq, gt } from 'drizzle-orm'
import { accessInvite } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { invitation: ['create'] })
  return useDB().select().from(accessInvite)
    .where(and(eq(accessInvite.organizationId, orgId), gt(accessInvite.expiresAt, new Date())))
    .orderBy(desc(accessInvite.createdAt))
})
