-- Blog (FR-13, SHOULD). `tag` is shared with Research when that module ships (D-014), which is
-- why it is a table of its own rather than nested under article.

CREATE TABLE category (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    CONSTRAINT uq_category_slug UNIQUE (slug)
);

CREATE UNIQUE INDEX uq_category_name_lower ON category (lower(name));

CREATE TABLE tag (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    CONSTRAINT uq_tag_slug UNIQUE (slug)
);

CREATE UNIQUE INDEX uq_tag_name_lower ON tag (lower(name));

CREATE TABLE article (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                VARCHAR(250) NOT NULL,
    slug                 VARCHAR(270) NOT NULL,
    excerpt              VARCHAR(500),
    content              TEXT         NOT NULL,
    thumbnail_media_id   BIGINT,
    author_admin_id      BIGINT,
    category_id          BIGINT,
    status               VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    published_at         TIMESTAMPTZ,
    reading_time_minutes INT,
    seo_title            VARCHAR(200),
    seo_description      VARCHAR(300),
    og_image_media_id    BIGINT,
    ai_visible           BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT ck_article_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
    -- A scheduled or published article must say when; a draft need not.
    CONSTRAINT ck_article_published_at CHECK (status NOT IN ('SCHEDULED', 'PUBLISHED') OR published_at IS NOT NULL),
    CONSTRAINT fk_article_thumbnail_media FOREIGN KEY (thumbnail_media_id)
        REFERENCES media (id) ON DELETE SET NULL,
    CONSTRAINT fk_article_og_image_media FOREIGN KEY (og_image_media_id)
        REFERENCES media (id) ON DELETE SET NULL,
    CONSTRAINT fk_article_author_admin FOREIGN KEY (author_admin_id)
        REFERENCES admin (id) ON DELETE SET NULL,
    CONSTRAINT fk_article_category FOREIGN KEY (category_id)
        REFERENCES category (id) ON DELETE SET NULL
);

-- Slug uniqueness scoped to live rows, for the reason recorded in D-021.
CREATE UNIQUE INDEX uq_article_slug_active ON article (slug) WHERE deleted_at IS NULL;

CREATE INDEX idx_article_status_published_at ON article (status, published_at DESC);
CREATE INDEX idx_article_category_id ON article (category_id);

CREATE TABLE article_tag (
    article_id BIGINT NOT NULL,
    tag_id     BIGINT NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    CONSTRAINT fk_article_tag_article FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE,
    CONSTRAINT fk_article_tag_tag FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

CREATE INDEX idx_article_tag_tag_id ON article_tag (tag_id);
