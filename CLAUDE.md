# The Hunt: hub site

A mobile-first web app for a school-wide treasure hunt run by the Strategic Reasoning Club. ~200 players, Years 9-12, runs for about 4 weeks. Keep it simple: this is a game, not a product.

## Stack

- Next.js (App Router, TypeScript), deployed on Vercel
- Supabase (Postgres) for data. Use the service role key only on the server.
- Tailwind for styling. Single column, large tap targets, readable on a phone.
- No third-party auth. Login is student ID + PIN, handled by us (see below).

## Game rules the code must enforce

1. There are 6 stages. Each stage has 2-4 components in a fixed order.
2. A player can only view or solve a component if every earlier component (across all stages) is solved.
3. A component is not visible before its release time. Enforce this on the server, not just by hiding it in the UI.
4. Each component is solved either by scanning its QR (a secret token) or by submitting a text answer. Answers are case- and whitespace-insensitive.
5. Solving the last component of a stage awards that stage's fragment to the player.
6. Solves are timestamped once and never overwritten.

## Data model (Supabase)

players
- id (uuid, pk)
- student_id (text, unique, required)
- display_name (text)
- pin_hash (text) — bcrypt, never store the raw PIN
- created_at

components
- id (uuid, pk)
- stage (int, 1-6)
- position (int, order within stage)
- title (text)
- clue_text (text, markdown allowed)
- solve_type (enum: 'qr' | 'answer')
- qr_token (text, unique, random 8+ chars, null unless solve_type = 'qr')
- answer (text, null unless solve_type = 'answer')
- release_at (timestamptz)
- hint_text (text)
- hint_released (bool, default false)
- fragment (text, null except on the last component of a stage)

progress
- id (uuid, pk)
- player_id (fk players)
- component_id (fk components)
- solved_at (timestamptz)
- unique (player_id, component_id)

Seed the components table with placeholder rows for 6 stages × 3 components so the app runs before real content exists.

## Auth

- Register: student_id, display_name, PIN (4-6 digits). Reject duplicate student_id.
- Login: student_id + PIN. On success set an httpOnly session cookie (signed JWT, 30 days).
- Log out clears it.
- Rate-limit login attempts per student_id (e.g. 10 per 15 minutes) so PINs can't be brute-forced.
- Admin: a single password from env var ADMIN_PASSWORD, separate cookie.

## Pages

/register and /login
- Simple forms. Errors inline.

/ (case file, requires login)
- Header: display name, current rank out of total players.
- Six stage cards in a grid. Each shows: stage number and theme, a checklist of its components (solved / current / locked), the fragment if the stage is complete, and the release date if the stage isn't out yet.
- Below the cards: the current component's clue text, and an answer box if solve_type = 'answer'. If solve_type = 'qr', say "Scan the code where the clue leads".
- If the current component's hint is released, show it under the clue.
- A small footer with total registered and how many players have passed each stage.

/s/[token] (QR landing, requires login; if not logged in, log in then return here)
- Look up the component by qr_token.
- If the player has not solved every earlier component, or the component isn't released: show "Evidence locked. You haven't found what leads here yet." and nothing else. Do not reveal the stage or title.
- Otherwise: record the solve (idempotent), show "Evidence found", the fragment if this completes a stage, and a link back to the case file.

/leaderboard (public)
- Rank players by furthest component solved, then earliest solved_at for that component. Show rank, display name, "Stage N". Highlight the logged-in player's row. Top 50 plus the player's own row.

/admin (requires admin cookie)
- Table: every player, current component, time spent on it, last solve.
- Per component: toggle hint_released, edit clue_text and hint_text inline, edit release_at.
- Reset a player's PIN (sets a new one you type in).
- Show each component's qr_token as a QR image (use a QR library) with a download button, so the organisers can print them.
- Log of the last 100 solves with timestamps, so out-of-order or suspicious scans are visible.

## Stage themes (for labels only; content lives in the database)

1 Riddles · 2 Basketball · 3 Music · 4 History · 5 Classics · 6 Finale

## Build order

1. Supabase schema + seed. Register, login, session cookie.
2. Case file page reading real data, gating logic, answer submission.
3. /s/[token] with gating. Test with two players at different stages.
4. Leaderboard.
5. Admin page.
6. Deploy to Vercel. Test on a phone over the school Wi-Fi.

## Non-goals

No email, no password reset by email, no social features, no image uploads, no analytics beyond the admin page. Do not hardcode any clue content.

## Framework notes

@AGENTS.md
