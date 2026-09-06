-- Placeholder components so the app runs before real content exists.
-- 6 stages x 3 components. Every field here is meant to be replaced from /admin.
-- Re-runnable: existing (stage, position) rows are left alone.

insert into components (stage, position, title, clue_text, solve_type, qr_token, answer, release_at, hint_text, fragment)
select
  s.stage,
  p.position,
  s.theme || ' - part ' || p.position,
  'Placeholder clue for stage ' || s.stage || ', component ' || p.position || '.',
  p.solve_type,
  case when p.solve_type = 'qr' then substr(md5(random()::text), 1, 10) end,
  case when p.solve_type = 'answer' then 'placeholder-' || s.stage || '-' || p.position end,
  -- Stage 1 is open immediately, then one stage a week.
  now() + ((s.stage - 1) * interval '7 days'),
  'Placeholder hint for stage ' || s.stage || ', component ' || p.position || '.',
  case when p.position = 3 then 'FRAGMENT-' || s.stage end
from (values
  (1, 'Riddles'),
  (2, 'Basketball'),
  (3, 'Music'),
  (4, 'History'),
  (5, 'Classics'),
  (6, 'Finale')
) as s (stage, theme)
cross join (values
  (1, 'qr'::solve_type),
  (2, 'answer'::solve_type),
  (3, 'qr'::solve_type)
) as p (position, solve_type)
on conflict (stage, position) do nothing;
