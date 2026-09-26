-- Raw reference DDL for Interactive Multi-Agent Task Harness
-- Database: PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    current_agent_id TEXT REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    duration_ms INTEGER NULL
);

-- Task events table (atomic sequential audit trail)
CREATE TABLE IF NOT EXISTS task_events (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    from_agent_id TEXT NULL,
    to_agent_id TEXT NULL,
    reason TEXT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_task_events_task_seq UNIQUE (task_id, sequence_no)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_task_id_seq ON task_events(task_id, sequence_no ASC);

-- Seed Agents
INSERT INTO agents (id, display_name, role, is_active)
VALUES
    ('email_agent', 'Email Specialist', 'Drafts, triages, and prepares email communications', TRUE),
    ('calendar_agent', 'Calendar Coordinator', 'Schedules, manages, and verifies calendar events via external API', TRUE),
    ('search_agent', 'Research Analyst', 'Investigates queries, gathers external data, and summarizes findings', TRUE),
    ('custom_agent', 'Executive Resolver', 'Handles low-confidence fallback, complex multi-domain workflows, and escalations', TRUE)
ON CONFLICT (id) DO NOTHING;
