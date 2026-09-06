/**
 * Checks that a Supabase project is set up correctly for The Hunt.
 *
 *   node --env-file=.env.local scripts/verify-setup.mjs
 *
 * Verifies the env vars, the schema, the seed, and a full bcrypt PIN round trip
 * against the real database. Creates one throwaway player and deletes it again.
 */
import { createClient } from '@supabase/supabase-js'
import { compare, hash } from 'bcryptjs'

const checks = []
let failed = false

function report(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  if (!ok) failed = true
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run this as: node --env-file=.env.local scripts/verify-setup.mjs')
  process.exit(1)
}
report('env vars present', true, new URL(url).host)
report('SESSION_SECRET set', Boolean(process.env.SESSION_SECRET))
report('ADMIN_PASSWORD set', Boolean(process.env.ADMIN_PASSWORD))

const db = createClient(url, key, { auth: { persistSession: false } })

// Schema: every table the app touches must be reachable with this key.
for (const table of ['players', 'components', 'progress', 'login_attempts']) {
  const { error } = await db.from(table).select('id', { count: 'exact', head: true })
  report(`table ${table}`, !error, error?.message ?? '')
}

// Seed: 6 stages x 3 components, each stage ending in a fragment.
const { data: components, error: seedError } = await db
  .from('components')
  .select('stage, position, solve_type, qr_token, answer, fragment')
  .order('stage')
  .order('position')

if (seedError) {
  report('seed rows', false, seedError.message)
} else {
  report('seed rows', components.length === 18, `${components.length} components (expected 18)`)
  const stages = new Set(components.map((c) => c.stage))
  report('six stages', stages.size === 6, `stages ${[...stages].join(', ')}`)
  const fragments = components.filter((c) => c.fragment)
  report('one fragment per stage', fragments.length === 6, `${fragments.length} fragments`)
  const wellFormed = components.every((c) =>
    c.solve_type === 'qr' ? c.qr_token && !c.answer : c.answer && !c.qr_token,
  )
  report('qr/answer fields consistent', wellFormed)
}

// Auth round trip: hash a PIN, store it, read it back, compare both ways.
const studentId = `zz-selftest-${Math.random().toString(36).slice(2, 8)}`
const pin = '4821'
const { data: created, error: insertError } = await db
  .from('players')
  .insert({ student_id: studentId, display_name: 'Self test', pin_hash: await hash(pin, 10) })
  .select('id')
  .single()

if (insertError) {
  report('create player', false, insertError.message)
} else {
  report('create player', true, studentId)

  const { data: fetched } = await db
    .from('players')
    .select('pin_hash')
    .eq('student_id', studentId)
    .single()

  report('correct PIN verifies', await compare(pin, fetched.pin_hash))
  report('wrong PIN rejected', !(await compare('0000', fetched.pin_hash)))

  const { error: dupError } = await db
    .from('players')
    .insert({ student_id: studentId, display_name: 'Dupe', pin_hash: 'x' })
  report('duplicate student ID rejected', dupError?.code === '23505', dupError?.code ?? 'no error')

  await db.from('players').delete().eq('id', created.id)
  const { count } = await db
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('id', created.id)
  report('test player cleaned up', count === 0)
}

console.log(
  failed
    ? '\nSomething is off — see the FAIL lines above.'
    : `\nAll ${checks.length} checks passed. The database is ready.`,
)
process.exit(failed ? 1 : 0)
