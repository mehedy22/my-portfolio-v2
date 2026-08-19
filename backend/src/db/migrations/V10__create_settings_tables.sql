-- Settings: everything the frontends must not hardcode (FR-11, FR-14, D-015).

-- Deliberately EAV: simple, low-cardinality config (site title, tagline, SEO defaults).
-- Which keys exist, what type each holds, and which are safe to expose publicly are NOT stored
-- here — they live in the SettingKey registry in code (D-024). This table only holds values.
CREATE TABLE site_setting (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE social_link (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform      VARCHAR(50)  NOT NULL,
    url           VARCHAR(500) NOT NULL,
    display_order INT          NOT NULL DEFAULT 0,
    is_visible    BOOLEAN      NOT NULL DEFAULT true
);

-- One row expected, like `admin` — no hard singleton constraint (D-015). A dedicated table
-- rather than two `site_setting` keys precisely so these can be real FKs: removing an uploaded
-- file must null the reference, not leave a dangling id in a text column.
CREATE TABLE site_profile (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_image_media_id BIGINT,
    resume_media_id        BIGINT,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_site_profile_profile_image_media FOREIGN KEY (profile_image_media_id)
        REFERENCES media (id) ON DELETE SET NULL,
    CONSTRAINT fk_site_profile_resume_media FOREIGN KEY (resume_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);
