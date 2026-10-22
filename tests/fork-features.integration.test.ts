import assert from 'node:assert/strict'
import { test } from 'node:test'

const target = process.env.FORK_FEATURES_TEST_URL
test('fork moderation retains assignees, audit comments, private email and media uploads', { skip: !target }, async () => {
  const origin = new URL(target!).origin
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  let cookie = ''
  async function request(path: string, body?: unknown, method?: string) {
    const response = await fetch(origin + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { origin, cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const value of response.headers.getSetCookie()) cookie += (cookie ? '; ' : '') + value.split(';')[0]
    const data = await response.json()
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`)
    return data
  }
  const signup = await request('/api/auth/sign-up/email', { email: 'fork-admin@example.invalid', name: 'Local Test', password: 'local-test-password-only' })
  const created = await request('/api/posts', { title: 'Fork integration test', content: 'Preserve existing fork behavior' })
  await request(`/api/admin/posts/${created.id}`, { assigneeId: signup.user.id, status: 'cancelled' }, 'PATCH')
  const detail = await request(`/api/posts/${created.slug}`)
  assert.equal(detail.assigneeId, signup.user.id)
  assert.equal(detail.assignee.id, signup.user.id)
  assert.equal(detail.status, 'cancelled')
  assert.equal(detail.commentCount, 2)
  assert.equal(Object.hasOwn(detail.author, 'email'), false)
  const comments = await request(`/api/posts/${created.id}/comments`)
  assert.deepEqual(comments.data.map((row: { type: string }) => row.type).sort(), ['assigneeChange', 'statusChange'])
  const form = new FormData()
  form.append('file', new File([new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109])], 'test.mp4', { type: 'video/mp4' }))
  const uploaded = await fetch(origin + '/api/upload', { method: 'POST', headers: { cookie, origin }, body: form })
  assert.equal(uploaded.status, 200)
  const media = await uploaded.json()
  assert.equal(media.type, 'video')
  const download = await fetch(origin + '/api/files/' + media.key, { headers: { cookie } })
  assert.equal(download.status, 200)
  assert.match(download.headers.get('content-type')!, /video\/mp4/)
  assert.equal((await download.arrayBuffer()).byteLength, 12)
})
