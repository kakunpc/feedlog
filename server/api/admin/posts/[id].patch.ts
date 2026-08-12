import { and, eq, inArray, sql } from 'drizzle-orm'
import { comment, member, post, postSearch, user } from '#layers/feedlog/server/db/schemas'
import { updatePostSchema } from '#layers/feedlog/shared/schemas/post'

// PATCH /api/admin/posts/:id — Moderator-style update (status / board / title / content).
// Moderator gate covers all moderation fields uniformly; the dedicated public
// PATCH /api/posts/:id handles author edits with the inline ownership check.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, updatePostSchema.parse)

  const { session, orgId } = await requireOrgPermission(event, { feedlog: ['moderate'] })

  const db = useDB()

  const [existing] = await db
    .select({ id: post.id, title: post.title, content: post.content, status: post.status, assigneeId: post.assigneeId })
    .from(post)
    .where(and(eq(post.id, id), eq(post.orgId, orgId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Post not found' })
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) {
    updates.content = body.content
    updates.excerpt = generateExcerpt(body.content)
  }
  if (body.status !== undefined) updates.status = body.status
  if (body.boardId !== undefined) updates.boardId = body.boardId
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  // Check if title or content changed
  const newTitle = (updates.title as string) ?? existing.title
  const newContent = (updates.content as string) ?? existing.content
  const contentChanged = newTitle !== existing.title || newContent !== existing.content
  const statusChanged = body.status !== undefined && body.status !== existing.status
  const assigneeChanged = body.assigneeId !== undefined && body.assigneeId !== existing.assigneeId
  const auditLogCount = Number(statusChanged) + Number(assigneeChanged)

  let nextAssignee: { id: string; name: string | null } | null = null
  if (assigneeChanged && body.assigneeId) {
    const [eligible] = await db
      .select({ id: user.id, name: user.name })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(
        eq(member.organizationId, orgId),
        eq(member.userId, body.assigneeId),
        inArray(member.role, ['contributor', 'manager', 'owner']),
      ))
      .limit(1)
    if (!eligible) {
      throw createError({ statusCode: 400, message: 'Assignee must be a dashboard member of this workspace' })
    }
    nextAssignee = eligible
  }

  let previousAssignee: { id: string; name: string | null } | null = null
  if (assigneeChanged && existing.assigneeId) {
    const [previous] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, existing.assigneeId))
      .limit(1)
    previousAssignee = previous ?? null
  }

  if (contentChanged) {
    updates.contentHash = computeContentHash(newTitle, newContent)
  }
  if (auditLogCount > 0) {
    updates.commentCount = sql`${post.commentCount} + ${auditLogCount}`
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(post)
      .set(updates)
      .where(and(eq(post.id, id), eq(post.orgId, orgId)))
      .returning()

    if (statusChanged) {
      await tx.insert(comment).values({
        postId: id,
        authorId: session.user.id,
        type: 'statusChange',
        content: `${existing.status}から${body.status}に変更`,
        metadata: {
          fromStatus: existing.status,
          toStatus: body.status,
        },
      })
    }

    if (assigneeChanged) {
      await tx.insert(comment).values({
        postId: id,
        authorId: session.user.id,
        type: 'assigneeChange',
        content: `${previousAssignee?.name ?? 'なし'}から${nextAssignee?.name ?? 'なし'}に変更`,
        metadata: {
          fromAssigneeId: previousAssignee?.id ?? null,
          fromAssigneeName: previousAssignee?.name ?? null,
          toAssigneeId: nextAssignee?.id ?? null,
          toAssigneeName: nextAssignee?.name ?? null,
        },
      })
    }

    return row
  })

  // Update search text and trigger embedding if content changed
  if (contentChanged) {
    const searchText = stripMarkdown(newTitle + '\n' + newContent)
    await db
      .insert(postSearch)
      .values({ postId: id, orgId, searchText })
      .onConflictDoUpdate({
        target: postSearch.postId,
        set: { searchText },
      })

    event.waitUntil(
      generatePostEmbedding(id, orgId, newTitle, newContent, updates.contentHash as string),
    )
  }

  // Status changes are intentionally email-free.
  return updated
})
