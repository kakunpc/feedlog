import { and, eq, sql } from 'drizzle-orm'
import { comment, post, postSearch } from '#layers/feedlog/server/db/schemas'
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
    .select({ id: post.id, title: post.title, content: post.content, status: post.status })
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

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  // Check if title or content changed
  const newTitle = (updates.title as string) ?? existing.title
  const newContent = (updates.content as string) ?? existing.content
  const contentChanged = newTitle !== existing.title || newContent !== existing.content
  const statusChanged = body.status !== undefined && body.status !== existing.status

  if (contentChanged) {
    updates.contentHash = computeContentHash(newTitle, newContent)
  }
  if (statusChanged) {
    updates.commentCount = sql`${post.commentCount} + 1`
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
