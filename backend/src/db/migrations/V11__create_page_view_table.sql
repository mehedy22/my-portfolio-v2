-- Analytics (FR-17, MUST per D-008).
--
-- A log, not a manageable resource: no soft delete, no updated_at, and deliberately no visitor
-- identifier of any kind — no IP, no session id, no raw User-Agent. `device_type` and `browser`
-- are coarse buckets derived server-side, which is the most that can be recorded without
-- building a fingerprint (docs/06-database/table-definitions.md).
--
-- `entity_id` carries no FK on purpose: the log must outlive the row it refers to.

CREATE TABLE page_view (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    path        VARCHAR(500) NOT NULL,
    entity_type VARCHAR(30),
    entity_id   BIGINT,
    referrer    VARCHAR(500),
    device_type VARCHAR(30),
    browser     VARCHAR(50),
    viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_page_view_device_type CHECK (device_type IN ('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN'))
);

-- Aggregation queries (docs/06-database/constraints-and-indexes.md).
CREATE INDEX idx_page_view_entity ON page_view (entity_type, entity_id);
CREATE INDEX idx_page_view_viewed_at ON page_view (viewed_at);
