import { eq } from 'drizzle-orm'
import { post } from '../db/schemas'

// Generate embeddings for every feedback entry point after commit. The domain
// dispatcher isolates listener failures from the successful business response.

async function loadFeedbackPost(feedbackId: string) {
  const [row] = await useDB()
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      contentHash: post.contentHash,
    })
    .from(post)
    .where(eq(post.id, feedbackId))
    .limit(1)
  return row ?? null
}

export default defineNitroPlugin((nitroApp) => {
  onDomainEvent(nitroApp, 'feedback.created', async (domainEvent) => {
    const row = await loadFeedbackPost(domainEvent.data.feedbackId)
    // No row: deleted between commit and listener run. No hash: a legacy row
    // this event cannot describe — every path that publishes writes one.
    if (!row || !row.contentHash) return
    await generatePostEmbedding(row.id, domainEvent.orgId, row.title, row.content, row.contentHash)
  })

  // This fork intentionally does not send staff email for new feedback.
})
