-- A savings goal can carry a picture of the thing being saved for, stored the same way trips and
-- vehicles store theirs: a downscaled JPEG data URL in a text column. Additive and nullable, so a
-- client that never sends one keeps working.
--
-- Its own file rather than an edit to 009, which has already been applied — migrations are
-- forward-only and _migrations tracks them by filename.
alter table savings_goals add column if not exists photo text;
