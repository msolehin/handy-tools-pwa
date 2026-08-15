-- A trip can carry one cover photo, stored the same way every other tool stores one: a
-- downscaled JPEG data URL in a text column. Additive and nullable, so existing rows stay valid
-- and a client that never sends one keeps working. (Same rule as 005, 006 and 009.)
--
-- text rather than bytea because the client holds it as a data URL either way — the blob it
-- syncs is JSON, so bytes would only mean base64 twice over.
alter table trips add column if not exists photo text;
