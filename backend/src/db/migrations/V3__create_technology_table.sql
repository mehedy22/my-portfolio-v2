-- Shared lookup, normalized rather than free-text tags specifically so "which projects use
-- Redis?" is a join and not a text search once the AI module exists
-- (docs/06-database/table-definitions.md).
--
-- Used by `project_technology` (V4) and, from Sprint 4, `experience_technology`.

CREATE TABLE technology (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_technology_name UNIQUE (name)
);

-- Case-insensitive uniqueness (D-020). Without it "Redis" and "redis" become two rows and the
-- join above silently returns half the projects — which would defeat the whole reason this table
-- is normalized. The plain UNIQUE above is kept: it is what docs/06-database/ specifies, and it
-- is the index used for exact-name lookups.
CREATE UNIQUE INDEX uq_technology_name_lower ON technology (lower(name));
