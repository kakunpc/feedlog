import assert from 'node:assert/strict'
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const url = process.env.FORK_UPGRADE_DATABASE_URL

test('upgrade discord_oauth without skipping upstream migrations or changing existing data', { skip: !url }, async () => {
  const target = new URL(url!)
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname))
  assert.match(target.pathname, /fork_upgrade_test/)
  const connection = postgres(url!, { max: 1 })
  const db = drizzle(connection)
  const dir = await mkdtemp(join(tmpdir(), 'feedlog-fork-'))
  try {
    await cp('server/db/migrations', dir, { recursive: true })
    const journal = JSON.parse(await readFile(join(dir, 'meta/_journal.json'), 'utf8'))
    const previous = journal.entries.slice(0, 11)
    assert.equal(previous.at(-1).tag, '0010_post_assignee')
    assert.equal(previous.at(-1).when, 1786496400000)
    assert.ok(journal.entries.slice(11).every((entry: { when: number }) => entry.when > previous.at(-1).when))
    await writeFile(join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: previous }))
    await migrate(db, { migrationsFolder: dir })
    await connection`UPDATE post SET status='cancelled', assignee_id='system' WHERE slug=(SELECT slug FROM post LIMIT 1)`
    await connection`INSERT INTO access_invite(id,organization_id,role,created_by,expires_at) VALUES ('fork-invite','default-org','contributor','system','2099-01-01')`
    await connection`INSERT INTO account(id,account_id,provider_id,user_id,created_at,updated_at) VALUES ('fork-discord','12345','discord','system',now(),now())`
    const posts = await connection`SELECT id,title,content,status,assignee_id FROM post ORDER BY id`
    await migrate(db, { migrationsFolder: 'server/db/migrations' })
    await migrate(db, { migrationsFolder: 'server/db/migrations' })
    assert.deepEqual(await connection`SELECT id,title,content,status,assignee_id FROM post ORDER BY id`, posts)
    assert.equal((await connection`SELECT count(*)::int AS n FROM access_invite WHERE id='fork-invite'`)[0]!.n, 1)
    assert.equal((await connection`SELECT provider_id FROM account WHERE id='fork-discord'`)[0]!.provider_id, 'discord')
    for (const table of ['conversation', 'message', 'help_article', 'conversation_item']) {
      assert.equal((await connection`SELECT to_regclass(${`public.${table}`})::text AS name`)[0]!.name, table)
    }
    assert.equal((await connection`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)[0]!.n, journal.entries.length)
  } finally {
    await connection.end()
    await rm(dir, { recursive: true, force: true })
  }
})
