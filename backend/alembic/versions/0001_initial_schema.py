"""initial schema and seed agents

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create agents table
    agents_table = op.create_table(
        'agents',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('display_name', sa.Text(), nullable=False),
        sa.Column('role', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Create tasks table
    op.create_table(
        'tasks',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('current_agent_id', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['current_agent_id'], ['agents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_tasks_status', 'tasks', ['status'], unique=False)
    op.create_index('idx_tasks_created_at', 'tasks', [sa.text('created_at DESC')], unique=False)

    # 3. Create task_events table
    op.create_table(
        'task_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('sequence_no', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('from_agent_id', sa.String(length=100), nullable=True),
        sa.Column('to_agent_id', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'sequence_no', name='uq_task_events_task_seq')
    )
    op.create_index('idx_task_events_task_id_seq', 'task_events', ['task_id', 'sequence_no'], unique=False)

    # 4. Data migration: Seed agents table
    op.bulk_insert(
        agents_table,
        [
            {
                'id': 'email_agent',
                'display_name': 'Email Specialist',
                'role': 'Drafts, triages, and prepares email communications',
                'is_active': True,
            },
            {
                'id': 'calendar_agent',
                'display_name': 'Calendar Coordinator',
                'role': 'Schedules, manages, and verifies calendar events via external API',
                'is_active': True,
            },
            {
                'id': 'search_agent',
                'display_name': 'Research Analyst',
                'role': 'Investigates queries, gathers external data, and summarizes findings',
                'is_active': True,
            },
            {
                'id': 'custom_agent',
                'display_name': 'Executive Resolver',
                'role': 'Handles low-confidence fallback, complex multi-domain workflows, and escalations',
                'is_active': True,
            },
        ]
    )


def downgrade() -> None:
    op.drop_index('idx_task_events_task_id_seq', table_name='task_events')
    op.drop_table('task_events')
    op.drop_index('idx_tasks_created_at', table_name='tasks')
    op.drop_index('idx_tasks_status', table_name='tasks')
    op.drop_table('tasks')
    op.drop_table('agents')
