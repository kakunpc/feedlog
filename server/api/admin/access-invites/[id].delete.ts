import { and, eq } from 'drizzle-orm'
import { accessInvite } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const { orgId } = await requireOrgPermission(event, { invitation: ['cancel'] })
  const id = getRouterParam(event, 'id')!
  const [disabled] = await useDB().update(accessInvite).set({ enabled: false })
    .where(and(eq(accessInvite.id, id), eq(accessInvite.organizationId, orgId))).returning({ id: accessInvite.id })
  if (!disabled) throw createError({ statusCode: 404, message: 'Invite not found' })
  return { success: true }
})
