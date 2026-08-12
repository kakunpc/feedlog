import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { accessInvite } from '#layers/feedlog/server/db/schemas'

const schema = z.object({ role: z.enum(['owner', 'manager', 'contributor']) })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const { session, orgId } = await requireOrgPermission(event, { invitation: ['create'] })
  const callerRole = getOrgMemberRole(session, orgId)
  if (body.role === 'owner' && callerRole !== 'owner') {
    throw createError({ statusCode: 403, message: 'Only owners can invite owners' })
  }
  const [created] = await useDB().insert(accessInvite).values({
    id: uuidv7(), organizationId: orgId, role: body.role,
    createdBy: session.user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning()
  return created
})
