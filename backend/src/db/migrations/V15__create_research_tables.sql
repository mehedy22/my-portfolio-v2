-- Research (D-014, SHOULD tier). Scheduled here because Sprint 11's nav change requires the page
-- to exist — it was designed in Phase 6 but never placed in the sprint plan.
--
-- Unlike Blog, a research entry links OUT to an external paper or an uploaded PDF rather than
-- hosting its content, so there is no rich-text body and no detail route; the list item is the
-- whole thing (docs/06-database/table-definitions.md).

CREATE TABLE research (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title             VARCHAR(250) NOT NULL,
    slug              VARCHAR(270) NOT NULL,
    abstract          VARCHAR(600) NOT NULL,
    publication_venue VARCHAR(250),
    publication_date  DATE,
    external_url      VARCHAR(500),
    pdf_media_id      BIGINT,
    status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    display_order     INT          NOT NULL DEFAULT 0,
    ai_visible        BOOLEAN      NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    CONSTRAINT ck_research_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT fk_research_pdf_media FOREIGN KEY (pdf_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

-- Slug uniqueness scoped to live rows, for the reason recorded in D-021.
CREATE UNIQUE INDEX uq_research_slug_active ON research (slug) WHERE deleted_at IS NULL;

CREATE INDEX idx_research_publication_date ON research (publication_date DESC);
CREATE INDEX idx_research_status_display_order ON research (status, display_order);

-- Reuses Blog's `tag` table rather than a research-only one (Phase 6).
CREATE TABLE research_tag (
    research_id BIGINT NOT NULL,
    tag_id      BIGINT NOT NULL,
    PRIMARY KEY (research_id, tag_id),
    CONSTRAINT fk_research_tag_research FOREIGN KEY (research_id) REFERENCES research (id) ON DELETE CASCADE,
    CONSTRAINT fk_research_tag_tag FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

CREATE INDEX idx_research_tag_tag_id ON research_tag (tag_id);
