-- Checklist of common issues spotted at an anchor point (spec-driven addition:
-- field flow now offers checkboxes, not just free text, for the technician to
-- describe the point's condition — mirrors an insurance-claim style checklist.
alter table anchor_points add column issue_tags text[] not null default '{}';
