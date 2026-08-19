-- Projects: the largest MUST-tier content module (docs/06-database/table-definitions.md).
-- Challenges, gallery and technologies are children of a project — they are managed through the
-- project's own create/update payload and have no independent lifecycle, which is why they
-- CASCADE (docs/07-api/endpoints.md).

CREATE TABLE project (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                VARCHAR(200) NOT NULL,
    slug                 VARCHAR(220) NOT NULL,
    short_description    VARCHAR(500) NOT NULL,
    detailed_description TEXT,
    thumbnail_media_id   BIGINT,
    github_url           VARCHAR(500),
    live_url             VARCHAR(500),
    project_type         VARCHAR(30),
    start_date           DATE,
    end_date             DATE,
    featured             BOOLEAN     NOT NULL DEFAULT false,
    status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    display_order        INT         NOT NULL DEFAULT 0,
    features             TEXT,
    ai_visible           BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT ck_project_type CHECK (project_type IN ('PERSONAL', 'PROFESSIONAL', 'OPEN_SOURCE', 'CLIENT')),
    CONSTRAINT ck_project_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_project_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_project_thumbnail_media FOREIGN KEY (thumbnail_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

-- Slug uniqueness is scoped to live rows (D-021). A plain UNIQUE(slug) would let a soft-deleted
-- project keep its slug forever: the admin deletes "my-api", recreates it, and gets a 409 whose
-- cause is a row they can no longer see. Scoping it to `deleted_at IS NULL` makes a deleted
-- project's slug reusable, which is what "deleted" means from the admin's side.
CREATE UNIQUE INDEX uq_project_slug_active ON project (slug) WHERE deleted_at IS NULL;

-- The universal "published items, in display order" query (NFR-01/NFR-02).
CREATE INDEX idx_project_status_display_order ON project (status, display_order);

CREATE TABLE project_challenge (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id    BIGINT       NOT NULL,
    title         VARCHAR(200) NOT NULL,
    challenge     TEXT         NOT NULL,
    solution      TEXT         NOT NULL,
    display_order INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_project_challenge_project FOREIGN KEY (project_id)
        REFERENCES project (id) ON DELETE CASCADE
);

CREATE INDEX idx_project_challenge_project_id ON project_challenge (project_id);

CREATE TABLE project_gallery (
    project_id    BIGINT NOT NULL,
    media_id      BIGINT NOT NULL,
    display_order INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, media_id),
    CONSTRAINT fk_project_gallery_project FOREIGN KEY (project_id)
        REFERENCES project (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_gallery_media FOREIGN KEY (media_id)
        REFERENCES media (id) ON DELETE CASCADE
);

CREATE TABLE project_technology (
    project_id    BIGINT NOT NULL,
    technology_id BIGINT NOT NULL,
    PRIMARY KEY (project_id, technology_id),
    CONSTRAINT fk_project_technology_project FOREIGN KEY (project_id)
        REFERENCES project (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_technology_technology FOREIGN KEY (technology_id)
        REFERENCES technology (id) ON DELETE CASCADE
);

-- Supports the reverse direction — "which projects use technology X" — which the composite PK,
-- being project-first, does not (docs/06-database/constraints-and-indexes.md).
CREATE INDEX idx_project_technology_technology_id ON project_technology (technology_id);
