-- Same as savings goals: where the cover photo is anchored inside its crop, a CSS
-- object-position value ('50% 30%'). A trip photo is shown twice at different shapes — a wide
-- banner on the card and a narrow slice in the timeline — so the middle is often the wrong part.
alter table trips add column if not exists photo_pos text;
