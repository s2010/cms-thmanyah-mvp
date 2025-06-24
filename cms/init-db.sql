-- Thmanyah CMS Database Initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Ensure UTF8 encoding
SET client_encoding = 'UTF8';

-- Create indexes for better performance (TypeORM will create the tables)
-- These will be applied after TypeORM creates the schema

-- Note: The actual table creation is handled by TypeORM synchronization
-- This file is for any additional database setup if needed

-- Create extension for better text search (optional)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- You can add any custom SQL here that should run at database startup
-- For example, creating custom functions, triggers, or additional indexes

-- Log initialization
INSERT INTO pg_stat_statements_reset() VALUES (default) ON CONFLICT DO NOTHING; 