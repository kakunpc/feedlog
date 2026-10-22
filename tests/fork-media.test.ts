import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown } from '../app/lib/markdown-render'
import { requiresSourcePreservation } from '../app/lib/markdown-editor'

test('preserve stored MP4 attachments in the upstream editor and render safe playback', () => {
  const source = '<video controls preload="metadata" src="attachment:uploads/example.mp4"></video>'
  assert.equal(requiresSourcePreservation(source), true)
  assert.match(renderMarkdown(source), /<video[^>]*src="\/api\/files\/uploads\/example.mp4"/)
  const unsafe = renderMarkdown('<video src="javascript:alert(1)" onerror="alert(1)" autoplay></video>')
  assert.doesNotMatch(unsafe, /javascript:|onerror|autoplay/)
})
