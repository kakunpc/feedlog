import { and, eq, gt } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { accessInvite, member } from '#layers/feedlog/server/db/schemas'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if ((session.session as { ssoOrgId?: string | null }).ssoOrgId) {
    throw createError({ statusCode: 403, message: 'SSO sessions cannot join staff workspaces' })
  }
  const id = getRouterParam(event, 'id')!
  const [invite] = await useDB().select().from(accessInvite)
    .where(and(eq(accessInvite.id, id), eq(accessInvite.enabled, true), gt(accessInvite.expiresAt, new Date()))).limit(1)
  if (!invite) throw createError({ statusCode: 404, message: 'Invitation not found' })
  await useDB().insert(member).values({ id: uuidv7(), organizationId: invite.organizationId,
    userId: session.user.id, role: invite.role }).onConflictDoNothing()
  return { success: true }
})
