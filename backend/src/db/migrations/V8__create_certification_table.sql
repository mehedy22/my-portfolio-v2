CREATE TABLE certification (
    id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                       VARCHAR(200) NOT NULL,
    issuer                     VARCHAR(200) NOT NULL,
    credential_id              VARCHAR(200),
    credential_url             VARCHAR(500),
    issue_date                 DATE,
    expiry_date                DATE,
    description                TEXT,
    certificate_image_media_id BIGINT,
    display_order              INT         NOT NULL DEFAULT 0,
    status                     VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    ai_visible                 BOOLEAN     NOT NULL DEFAULT false,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                 TIMESTAMPTZ,
    CONSTRAINT ck_certification_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_certification_dates CHECK (expiry_date IS NULL OR expiry_date >= issue_date),
    CONSTRAINT fk_certification_image_media FOREIGN KEY (certificate_image_media_id)
        REFERENCES media (id) ON DELETE SET NULL
);

CREATE INDEX idx_certification_status_display_order ON certification (status, display_order);
