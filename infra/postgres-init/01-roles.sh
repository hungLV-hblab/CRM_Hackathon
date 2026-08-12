#!/bin/bash
# Runs EXACTLY ONCE, when Postgres initialises a cluster on an empty volume.
# If an old volume is still there this script does NOT run again → the three roles are
# missing → everything fails in confusing ways. Seeing "role crm_owner does not exist"?
# Run `docker compose down -v` and bring the stack back up.
#
# Why .sh rather than the .sql the plan named: a .sql file under initdb cannot interpolate
# environment variables, so the password would have to be hard-coded and committed.
# CLAUDE.md section 6 forbids committing secrets, hence a shell script reading $CRM_DB_PASSWORD.
set -euo pipefail

: "${CRM_DB_PASSWORD:?CRM_DB_PASSWORD is missing — see .env.example}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- ADR-0010: three roles, none of them a superuser.
    CREATE ROLE crm_owner  LOGIN PASSWORD '${CRM_DB_PASSWORD}' NOSUPERUSER NOCREATEROLE;
    CREATE ROLE crm_app    LOGIN PASSWORD '${CRM_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    CREATE ROLE crm_system LOGIN PASSWORD '${CRM_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;

    -- crm_owner owns the database and the schema. The app NEVER connects as this role:
    -- a table owner bypasses every column privilege, even when NOSUPERUSER
    -- (ADR-0010, measurement 3).
    ALTER DATABASE ${POSTGRES_DB} OWNER TO crm_owner;
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO crm_app, crm_system;

    -- A separate database for tests, same cluster. Column-privilege tests must run against
    -- the real schema.
    CREATE DATABASE crm_test OWNER crm_owner;
    GRANT CONNECT ON DATABASE crm_test TO crm_app, crm_system;
EOSQL

# USAGE on schema public has to be granted INSIDE each database, not at cluster level.
for db in "$POSTGRES_DB" crm_test; do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
        ALTER SCHEMA public OWNER TO crm_owner;
        GRANT USAGE ON SCHEMA public TO crm_app, crm_system;
        -- No CREATE granted: only crm_owner may create tables, i.e. only migrations may.
EOSQL
done

echo "Created roles crm_owner / crm_app / crm_system and database crm_test."
