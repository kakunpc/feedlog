import { z } from 'zod'

export const inboxStatus = z.enum(['ai_handling', 'open', 'pending', 'snoozed', 'closed'])
export type InboxStatus = z.infer<typeof inboxStatus>
export const handoffReason = z.enum([
  'user_requested',
  'knowledge_gap',
  'sensitive_or_permission',
  'dissatisfied',
  'support_rule',
])
export type HandoffReason = z.infer<typeof handoffReason> | 'ai_error'
export const handoffRule = z.object({
  id: z.string().min(1),
  scenario: z.string().min(1),
  scenarioZh: z.string().min(1).optional(),
}).strict()
export type HandoffRule = z.infer<typeof handoffRule>
export const systemEventPart = z
  .object({
    type: z.literal('system_event'),
    kind: z.enum(['handoff', 'reopened', 'customer_resumed', 'priority_changed', 'snoozed', 'resumed', 'closed']),
    reason: z.enum([...handoffReason.options, 'ai_error', 'manual', 'timeout', 'customer_message']),
    fromStatus: inboxStatus,
    toStatus: inboxStatus,
    rule: handoffRule.optional(),
    dueAt: z.iso.datetime().optional(),
    fromPriority: z.enum(['normal', 'high']).optional(),
    toPriority: z.enum(['normal', 'high']).optional(),
  })
  .strict()
export type SystemEventPart = z.infer<typeof systemEventPart>
export function handling(status: InboxStatus): 'ai' | 'human' | 'closed' {
  return status === 'ai_handling' ? 'ai' : status === 'closed' ? 'closed' : 'human'
}
export const HANDOFF_NOTICE = "Your question has been passed to our support team. You can send more details or screenshots here."
