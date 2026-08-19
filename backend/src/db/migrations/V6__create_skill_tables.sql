-- Skills, grouped under an admin-managed category lookup. `skill_category` is a lookup like
-- `technology` (V3): id + name only, no audit columns, no soft delete.

CREATE TABLE skill_category (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_skill_category_name UNIQUE (name)
);

-- Case-insensitive uniqueness, for the same reason as `technology` (D-020): "Backend" and
-- "backend" must not become two groups on the public Skills page.
CREATE UNIQUE INDEX uq_skill_category_name_lower ON skill_category (lower(name));

CREATE TABLE skill (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    category_id   BIGINT       NOT NULL,
    proficiency   VARCHAR(20),
    icon          VARCHAR(200),
    display_order INT          NOT NULL DEFAULT 0,
    featured      BOOLEAN      NOT NULL DEFAULT false,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED',
    ai_visible    BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT ck_skill_proficiency CHECK (proficiency IN
        ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
    CONSTRAINT ck_skill_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    -- RESTRICT, not CASCADE: deleting a category that still has skills must fail loudly and
    -- force reassignment (docs/06-database/constraints-and-indexes.md).
    CONSTRAINT fk_skill_category FOREIGN KEY (category_id)
        REFERENCES skill_category (id) ON DELETE RESTRICT
);

CREATE INDEX idx_skill_status_display_order ON skill (status, display_order);
CREATE INDEX idx_skill_category_id ON skill (category_id);
