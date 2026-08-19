-- Auth module: the single admin account (D-005 — exactly one authenticated identity exists;
-- there is no registration endpoint, hence no DB-level singleton constraint).
-- Credentials are NEVER seeded here: the admin row is created at deploy time from environment
-- variables by AdminBootstrap (docs/06-database/migration-strategy.md — "No admin credentials
-- in a migration file").

CREATE TABLE admin (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_email UNIQUE (email)
);
