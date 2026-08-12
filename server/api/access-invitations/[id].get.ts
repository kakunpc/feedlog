import { and, eq, gt } from 'drizzle-orm'
import { accessInvite, organization } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const [row] = await useDB().select({ id: accessInvite.id, role: accessInvite.role,
    expiresAt: accessInvite.expiresAt, organizationName: organization.name })
    .from(accessInvite).innerJoin(organization, eq(accessInvite.organizationId, organization.id))
    .where(and(eq(accessInvite.id, id), eq(accessInvite.enabled, true), gt(accessInvite.expiresAt, new Date()))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Invitation not found' })
  return { ...row, expiresAt: row.expiresAt.toISOString(), kind: 'link' as const }
})
