CREATE TABLE education (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    institution        VARCHAR(200) NOT NULL,
    degree             VARCHAR(200),
    field              VARCHAR(200),
    description        TEXT,
    start_date         DATE,
    end_date           DATE,
    currently_studying BOOLEAN     NOT NULL DEFAULT false,
    logo_media_id      BIGINT,
    display_order      INT         NOT NULL DEFAULT 0,
    status             VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ai_visible         BOOLEAN     NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    CONSTRAINT ck_education_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_education_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_education_logo_media FOREIGN KEY (logo_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

CREATE INDEX idx_education_status_display_order ON education (status, display_order);
