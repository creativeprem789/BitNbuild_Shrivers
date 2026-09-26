export type AgentId = 'email_agent' | 'calendar_agent' | 'search_agent' | 'custom_agent';

export type AgentState = 'idle' | 'working' | 'blocked';

export type TaskEventType = 
  | 'task.created'
  | 'task.routed'
  | 'task.handoff'
  | 'task.blocked'
  | 'task.completed';

export interface TaskCreatedEvent {
  event_type: 'task.created';
  task_id: string;
  description: string;
  sequence_no: number;
  timestamp?: string;
}

export interface TaskRoutedEvent {
  event_type: 'task.routed';
  task_id: string;
  agent_id: AgentId;
  confidence: number;
  reason: string;
  sequence_no: number;
  timestamp?: string;
}

export interface TaskHandoffEvent {
  event_type: 'task.handoff';
  task_id: string;
  from_agent: AgentId;
  to_agent: AgentId;
  reason: string;
  sequence_no: number;
  timestamp?: string;
}

export interface TaskBlockedEvent {
  event_type: 'task.blocked';
  task_id: string;
  agent_id: AgentId;
  reason: string;
  sequence_no: number;
  timestamp?: string;
}

export interface TaskCompletedEvent {
  event_type: 'task.completed';
  task_id: string;
  duration_ms: number;
  sequence_no: number;
  timestamp?: string;
}

export type TaskEvent = 
  | TaskCreatedEvent
  | TaskRoutedEvent
  | TaskHandoffEvent
  | TaskBlockedEvent
  | TaskCompletedEvent;

export type TaskLocation = 'inbox' | AgentId | 'done';

export interface ActiveTask {
  id: string;
  description: string;
  status: 'created' | 'routed' | 'working' | 'blocked' | 'completed';
  currentLocation: TaskLocation;
  currentAgentId?: AgentId;
  lastSequenceNo: number;
  events: TaskEvent[];
  createdAt: number;
  updatedAt: number;
  durationMs?: number;
  confidence?: number;
  blockReason?: string;
}

export interface AgentInfo {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  avatar: string;
  color: string;
  secondaryColor: string;
  iconName: string;
}

export const AGENT_DEFINITIONS: Record<AgentId, AgentInfo> = {
  email_agent: {
    id: 'email_agent',
    name: 'Email Specialist',
    role: 'Communication & Outreach',
    description: 'Drafts executive briefs, composes updates & sends notifications',
    avatar: '✉️',
    color: '#3b82f6', // blue
    secondaryColor: '#60a5fa',
    iconName: 'Mail'
  },
  calendar_agent: {
    id: 'calendar_agent',
    name: 'Calendar Manager',
    role: 'Schedule & Logistics',
    description: 'Queries external APIs, books slots & resolves time conflicts',
    avatar: '📅',
    color: '#8b5cf6', // purple
    secondaryColor: '#a78bfa',
    iconName: 'Calendar'
  },
  search_agent: {
    id: 'search_agent',
    name: 'Research Analyst',
    role: 'Web & Vector Knowledge',
    description: 'Crawls live data, aggregates benchmarks & synthesizes facts',
    avatar: '🔍',
    color: '#10b981', // emerald
    secondaryColor: '#34d399',
    iconName: 'Search'
  },
  custom_agent: {
    id: 'custom_agent',
    name: 'Executive Resolver',
    role: 'Fallback & Escalation Handler',
    description: 'Handles low confidence tasks & resolves blocked workflow deadlocks',
    avatar: '⚡',
    color: '#f59e0b', // amber
    secondaryColor: '#fbbf24',
    iconName: 'ShieldAlert'
  }
};
