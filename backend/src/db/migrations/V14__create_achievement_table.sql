-- Achievements (FR-12, COULD tier).
--
-- The Phase 6 plan pencilled this in as V12; V12 and V13 were taken by the alt-text constraint
-- and the Blog tables as those sprints landed first. Migration numbers are sequential by
-- application order, not by the planning table — the plan's column is a proposal, not an index.

CREATE TABLE achievement (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title          VARCHAR(200) NOT NULL,
    description    TEXT,
    achieved_on    DATE,
    image_media_id BIGINT,
    display_order  INT         NOT NULL DEFAULT 0,
    status         VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ai_visible     BOOLEAN     NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT ck_achievement_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT fk_achievement_image_media FOREIGN KEY (image_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

CREATE INDEX idx_achievement_status_display_order ON achievement (status, display_order);
