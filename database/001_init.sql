-- =============================================================================
-- OctoSky (Project Orca) — Database Bootstrap
-- Target: PostgreSQL 16+ on Hetzner VPS "Octopus"
-- Run as the postgres superuser:
--   sudo -u postgres psql -f /opt/octosky/database/001_init.sql
-- =============================================================================

-- -------------------------------------------------------
-- 1. Role & Database
-- -------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'octosky_user') THEN
        CREATE ROLE octosky_user WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
    END IF;
END
$$;

CREATE DATABASE octosky
    OWNER    octosky_user
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE   'en_US.UTF-8'
    TEMPLATE   template0;

-- Connect to the new database for the remaining DDL.
\connect octosky

-- -------------------------------------------------------
-- 2. Schema
-- -------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS weather AUTHORIZATION octosky_user;

-- -------------------------------------------------------
-- 3. Main table — weather_logs
--    • cities JSONB stores an array of city objects, allowing
--      flexible querying (GIN index below).
--    • ai_suggestions JSONB stores the Ollama enrichment payload.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather.weather_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_url      TEXT        NOT NULL DEFAULT 'havadurumu15gunluk.net',
    cities          JSONB       NOT NULL,          -- raw scraper output
    ai_suggestions  JSONB,                         -- enriched AI output
    metadata        JSONB       DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 4. Indexes for fast JSONB lookups
-- -------------------------------------------------------
-- GIN index lets us query individual city names / conditions inside the array.
CREATE INDEX IF NOT EXISTS idx_weather_logs_cities_gin
    ON weather.weather_logs USING GIN (cities);

-- BRIN index on the timestamp for efficient range scans (time-series friendly).
CREATE INDEX IF NOT EXISTS idx_weather_logs_scraped_at_brin
    ON weather.weather_logs USING BRIN (scraped_at);

-- -------------------------------------------------------
-- 5. Grants
-- -------------------------------------------------------
GRANT USAGE  ON SCHEMA weather TO octosky_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA weather TO octosky_user;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA weather TO octosky_user;

-- Future tables in this schema automatically get the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA weather
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO octosky_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA weather
    GRANT USAGE, SELECT                  ON SEQUENCES TO octosky_user;

-- -------------------------------------------------------
-- 6. Utility view — latest snapshot
-- -------------------------------------------------------
CREATE OR REPLACE VIEW weather.latest_snapshot AS
SELECT id, scraped_at, cities, ai_suggestions
FROM   weather.weather_logs
ORDER  BY scraped_at DESC
LIMIT  1;

GRANT SELECT ON weather.latest_snapshot TO octosky_user;

-- -------------------------------------------------------
-- Done.  Verify with:
--   \dt weather.*
--   \di weather.*
-- =============================================================================
