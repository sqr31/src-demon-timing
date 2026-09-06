# The Hunt — hub site

Mobile-first web app for the Strategic Reasoning Club treasure hunt.
Next.js (App Router, TypeScript) + Supabase + Tailwind. The full spec is in
[CLAUDE.md](./CLAUDE.md).

## Build progress

- [x] **1. Supabase schema + seed. Register, login, session cookie.**
- [x] **2. Case file page, gating logic, answer submission.**
- [x] **3. `/s/[token]` with gating.**
- [ ] 4. Leaderboard
- [ ] 5. Admin page
- [ ] 6. Deploy to Vercel

## Setup

1. Create a Supabase project (free tier is enough for ~200 players).
2. Copy `.env.example` to `.env.local` and fill it in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API.
   - `SESSION_SECRET` from `openssl rand -base64 32`.
   - `ADMIN_PASSWORD` — whatever the organisers will use in step 5.
3. Apply the schema and seed. In the Supabase SQL editor, run
   `supabase/migrations/0001_init.sql` then `supabase/seed.sql`. With the
   Supabase CLI linked to the project, `supabase db push` followed by
   `supabase db seed` does the same thing.
4. `npm install`, then `npm run verify` to check the database is set up
   correctly. It confirms the tables, the 18 seeded components and a full PIN
   hash round trip, creating and deleting one throwaway player.
5. `npm run dev`, then open http://localhost:3000. Register a player and log
   out and back in to confirm the session cookie sticks.

The seed creates 6 stages × 3 placeholder components so the app runs before any
real clue content exists. Stage 1 is released immediately and each later stage
one week after the previous one; all of it is editable from `/admin` in step 5.

## Notes

- The service role key is used from server code only (`src/lib/db.ts` imports
  `server-only`). Every table has RLS enabled with no policies, so a leaked
  publishable key still reads nothing.
- Sessions are a signed JWT (HS256, 30 days) in an httpOnly cookie.
- PINs are bcrypt hashes; the raw PIN is never stored.
- Login attempts are throttled to 10 failures per student ID per 15 minutes,
  tracked in the `login_attempts` table because serverless instances share no
  memory.
- The game rules live in `src/lib/rules.ts` as pure functions of the components,
  a player's solves and the current time, with the database access alongside in
  `src/lib/game.ts`. That split is what `npm test` exercises.
- Gating is resolved on the server from the player's own progress, never from
  the request, so a hand-made form post can't reach a component the player
  hasn't earned. Titles and clues of unreached or unreleased components are
  never sent to the browser.
- Dates render in `Australia/Sydney` (`src/lib/format.ts`).
- On `/s/[token]`, an unknown token and a locked one return the identical
  response, so a scanned code from further ahead — or a guessed URL — tells the
  player nothing. The locked page carries a link back to the case file, which
  reveals nothing and saves a dead end on a phone.
- Re-scanning a code already found succeeds without touching the original
  timestamp.

## Testing a QR code with two players

The build order asks for this check, and it needs two real accounts:

1. In the SQL editor, get a token from a stage 1 component:
   `select position, qr_token from components where stage = 1 order by position;`
2. Register two players. Solve stage 1 as the first one, leave the second at
   the start.
3. Open `/s/<token of stage 1, component 3>` as each. The player who has worked
   up to it sees "Evidence found" and the stage fragment; the one who hasn't
   sees "Evidence locked" and nothing else — same page for a made-up token.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — the game rules (gating, release times, answers, ranking)
- `npm run verify` — check a configured Supabase project (schema, seed, auth)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
