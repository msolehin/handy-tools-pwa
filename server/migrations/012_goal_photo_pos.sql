-- Where the photo is anchored inside its crop, as a CSS object-position value ('50% 30%'). The
-- list thumbnail is a narrow slice of a wide photo, so the middle is often the wrong part of it.
--
-- text and free-form rather than two numeric columns: it is written straight into a style
-- attribute, and the client is the only thing that ever interprets it.
alter table savings_goals add column if not exists photo_pos text;
