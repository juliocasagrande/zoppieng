-- A short description at report creation so the list is scannable ("o que
-- foi feito"), and an audit trail for the engineer's per-point pass/fail
-- confirmation during review — the field technician's result is only ever a
-- suggestion; the report can't be approved/signed until an engineer has
-- explicitly confirmed (or overridden) every point.
alter table reports add column description text;

alter table anchor_points
  add column result_confirmed_by uuid references users (id),
  add column result_confirmed_at timestamptz;
