-- Accessibility hardening (Sprint 8): every image must carry alt text.
--
-- Added NOT VALID on purpose. Rows uploaded before this rule existed are left alone: a migration
-- cannot invent a meaningful description of an image, and backfilling the filename would create
-- alt text that is technically present and practically useless — worse than none, because it
-- silences the tooling that would otherwise flag it. New and updated rows are enforced from here
-- on; the existing few can be corrected by hand in the Media library.
--
-- Run `ALTER TABLE media VALIDATE CONSTRAINT ck_media_image_has_alt_text;` once they have been.

ALTER TABLE media
    ADD CONSTRAINT ck_media_image_has_alt_text
    CHECK (mime_type NOT LIKE 'image/%' OR (alt_text IS NOT NULL AND btrim(alt_text) <> ''))
    NOT VALID;
