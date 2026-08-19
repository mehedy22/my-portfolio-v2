-- Visitor contact submissions (FR-09, FR-10).
--
-- Deliberately stores nothing the visitor did not type: no IP address, no user agent, no
-- fingerprint (docs/06-database/table-definitions.md — "avoid collecting unnecessary personal
-- information"). Spam protection lives in Redis as a per-IP counter that expires, so the
-- abuse signal never becomes stored personal data.

CREATE TABLE contact_message (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    subject    VARCHAR(300),
    message    TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_contact_message_status CHECK (status IN ('NEW', 'READ', 'REPLIED'))
);

-- Admin inbox filtering by New/Read/Replied (docs/06-database/constraints-and-indexes.md).
CREATE INDEX idx_contact_message_status ON contact_message (status);
