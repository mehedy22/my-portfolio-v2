-- Competitive-programming and judge profiles, shown alongside Skills and Certifications.
--
-- A profile is an identity on someone else's platform, so the only things worth storing are how
-- to find it (platform + handle + url) and the few figures those platforms actually publish.
-- Nothing is scraped or synced: the admin types what they want shown, because a stale number the
-- site claims is worse than no number.

CREATE TABLE problem_solving_profile (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform         VARCHAR(50)  NOT NULL,
    handle           VARCHAR(100) NOT NULL,
    profile_url      VARCHAR(500),
    problems_solved  INT,
    rating           INT,
    rank_title       VARCHAR(100),
    display_order    INT          NOT NULL DEFAULT 0,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED',
    ai_visible       BOOLEAN      NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    CONSTRAINT ck_problem_solving_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_problem_solving_counts CHECK (
        (problems_solved IS NULL OR problems_solved >= 0) AND (rating IS NULL OR rating >= 0))
);

-- One handle per platform among live rows: two entries for the same LeetCode account would be a
-- data-entry slip, not a legitimate state.
CREATE UNIQUE INDEX uq_problem_solving_platform_handle_active
    ON problem_solving_profile (lower(platform), lower(handle)) WHERE deleted_at IS NULL;

CREATE INDEX idx_problem_solving_status_display_order
    ON problem_solving_profile (status, display_order);
