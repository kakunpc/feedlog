import assert from 'node:assert/strict'
import { test } from 'node:test'

const target = process.env.DISCORD_TEST_URL
test('Discord-only configuration generates the provider redirect without contacting Discord', { skip: !target }, async () => {
  const origin = new URL(target!).origin
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin + '/health')).ok) break } catch {}
    if (attempt === 59) assert.fail('Application did not become healthy')
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  const config = await fetch(origin + '/api/auth-config').then(r => r.json())
  assert.equal(config.discord, true)
  assert.equal(config.email, false)
  assert.equal(config.google, false)
  assert.equal(config.github, false)
  const response = await fetch(origin + '/api/auth/sign-in/social', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ provider: 'discord', callbackURL: '/auth/callback', disableRedirect: true }),
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  const redirect = new URL(body.url)
  assert.equal(redirect.hostname, 'discord.com')
  assert.equal(redirect.searchParams.get('client_id'), '123456789012345678')
  assert.equal(redirect.searchParams.get('redirect_uri'), origin + '/api/auth/callback/discord')
  assert.ok(redirect.searchParams.get('state'))
  assert.match(redirect.searchParams.get('scope')!, /identify/)
  assert.match(redirect.searchParams.get('scope')!, /email/)
  const cancelled = await fetch(origin + '/api/auth/callback/discord?error=access_denied', { redirect: 'manual' })
  assert.ok([302, 303].includes(cancelled.status))
})
