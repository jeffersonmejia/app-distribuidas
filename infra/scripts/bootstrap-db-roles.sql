\set ON_ERROR_STOP on
\getenv migration_password DB_MIGRATION_PASSWORD
\getenv runtime_password DB_RUNTIME_PASSWORD

SELECT 'CREATE ROLE erp_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_runtime')
\gexec

SELECT format(
    'CREATE ROLE erp_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',
    :'migration_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_migrator')
\gexec
ALTER ROLE erp_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'migration_password';

SELECT format(
    'CREATE ROLE erp_runtime_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L',
    :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_runtime_login')
\gexec
ALTER ROLE erp_runtime_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'runtime_password';
GRANT erp_runtime TO erp_runtime_login;
GRANT USAGE, CREATE ON SCHEMA public TO erp_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE erp_migrator IN SCHEMA public GRANT SELECT ON TABLES TO erp_runtime;
