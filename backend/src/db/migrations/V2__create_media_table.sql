-- Media module: owner-agnostic file store (docs/06-database/table-definitions.md).
-- `media` deliberately does not know who references it — content tables point *at* media,
-- never the other way round (docs/05-architecture/system-architecture.md).
--
-- file_name is a server-generated, collision-resistant name; original_file_name is kept only
-- for display. The raw user-supplied name is never used on disk (docs/08-security/
-- application-security.md — path-traversal / overwrite mitigation).

CREATE TABLE media (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_name            VARCHAR(255)  NOT NULL,
    original_file_name   VARCHAR(255)  NOT NULL,
    mime_type            VARCHAR(100)  NOT NULL,
    size_bytes           BIGINT        NOT NULL,
    storage_backend      VARCHAR(20)   NOT NULL,
    storage_path_or_url  VARCHAR(1000) NOT NULL,
    width                INT,
    height               INT,
    alt_text             VARCHAR(300),
    uploaded_by_admin_id BIGINT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT ck_media_size_bytes_positive CHECK (size_bytes > 0),
    CONSTRAINT ck_media_storage_backend CHECK (storage_backend IN ('LOCAL', 'OBJECT_STORAGE')),
    CONSTRAINT fk_media_uploaded_by_admin FOREIGN KEY (uploaded_by_admin_id)
        REFERENCES admin (id) ON DELETE SET NULL
);

-- docs/06-database/constraints-and-indexes.md: admin media-library filtering.
CREATE INDEX idx_media_uploaded_by_admin_id ON media (uploaded_by_admin_id);
