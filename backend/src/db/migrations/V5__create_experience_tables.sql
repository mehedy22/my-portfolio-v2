-- Work experience, plus its share of the `technology` lookup introduced in V3.

CREATE TABLE experience (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company              VARCHAR(200) NOT NULL,
    position             VARCHAR(200) NOT NULL,
    employment_type      VARCHAR(20),
    description          TEXT,
    responsibilities     TEXT,
    start_date           DATE        NOT NULL,
    end_date             DATE,
    currently_working    BOOLEAN     NOT NULL DEFAULT false,
    company_logo_media_id BIGINT,
    display_order        INT         NOT NULL DEFAULT 0,
    status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ai_visible           BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT ck_experience_employment_type CHECK (employment_type IN
        ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE')),
    CONSTRAINT ck_experience_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    -- A job you still hold cannot also have ended.
    CONSTRAINT ck_experience_currently_working CHECK (NOT currently_working OR end_date IS NULL),
    CONSTRAINT ck_experience_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_experience_company_logo_media FOREIGN KEY (company_logo_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

CREATE INDEX idx_experience_status_display_order ON experience (status, display_order);

CREATE TABLE experience_technology (
    experience_id BIGINT NOT NULL,
    technology_id BIGINT NOT NULL,
    PRIMARY KEY (experience_id, technology_id),
    CONSTRAINT fk_experience_technology_experience FOREIGN KEY (experience_id)
        REFERENCES experience (id) ON DELETE CASCADE,
    CONSTRAINT fk_experience_technology_technology FOREIGN KEY (technology_id)
        REFERENCES technology (id) ON DELETE CASCADE
);

CREATE INDEX idx_experience_technology_technology_id ON experience_technology (technology_id);
