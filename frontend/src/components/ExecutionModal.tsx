import React, { useState, useEffect } from 'react';
import type { ActiveTask, AgentId, TaskEvent } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';

interface ExecutionModalProps {
  task: ActiveTask;
  allTasks: ActiveTask[];
  onClose: () => void;
}

type StepStatus = 'done' | 'active' | 'pending';

interface ExecutionStep {
  id: number;
  label: string;
  detail?: string;
  status: StepStatus;
}

// Human-readable execution steps per agent
const AGENT_STEPS: Record<AgentId, Array<{ label: string; detail: string }>> = {
  email_agent: [
    { label: 'Understanding your request', detail: 'Reading what you need and who to contact' },
    { label: 'Choosing the right format', detail: 'Selecting appropriate tone and structure for the email' },
    { label: 'Writing the email content', detail: 'Composing the subject line, body, and closing' },
    { label: 'Reviewing the message', detail: 'Checking for accuracy and completeness' },
    { label: 'Sending the email', detail: 'Delivering the message to the intended recipient(s)' },
  ],
  calendar_agent: [
    { label: 'Parsing your schedule request', detail: 'Identifying attendees, date preferences, and duration' },
    { label: 'Checking calendar availability', detail: 'Finding free slots that work for all participants' },
    { label: 'Reserving the time slot', detail: 'Blocking the calendar and creating the event' },
    { label: 'Sending invitations', detail: 'Notifying all attendees with event details' },
    { label: 'Confirming the booking', detail: 'Verifying the event has been successfully scheduled' },
  ],
  search_agent: [
    { label: 'Understanding the research topic', detail: 'Breaking down exactly what information is needed' },
    { label: 'Searching relevant sources', detail: 'Querying databases, web, and knowledge repositories' },
    { label: 'Gathering and filtering data', detail: 'Collecting the most relevant and reliable information' },
    { label: 'Analyzing the findings', detail: 'Comparing, summarizing, and synthesizing key insights' },
    { label: 'Preparing the report', detail: 'Structuring findings into a clear, actionable summary' },
  ],
  custom_agent: [
    { label: 'Assessing the request', detail: 'Determining the best approach for this unique task' },
    { label: 'Identifying the solution path', detail: 'Planning how to resolve or escalate appropriately' },
    { label: 'Processing the task', detail: 'Executing the required steps with available tools' },
    { label: 'Validating the outcome', detail: 'Checking that the result meets the original requirement' },
    { label: 'Finalizing and completing', detail: 'Wrapping up and preparing the final response' },
  ],
};

// Build human-readable timeline from task events
function buildTimeline(events: TaskEvent[]): string[] {
  return events.map(e => {
    switch (e.event_type) {
      case 'task.created': return `Task received at Reception`;
      case 'task.routed': {
        const agentName = AGENT_DEFINITIONS[e.agent_id]?.name ?? e.agent_id;
        return `Assigned to ${agentName}`;
      }
      case 'task.handoff': {
        const fromName = AGENT_DEFINITIONS[e.from_agent]?.name ?? e.from_agent;
        const toName = AGENT_DEFINITIONS[e.to_agent]?.name ?? e.to_agent;
        return `Handed off from ${fromName} to ${toName}`;
      }
      case 'task.blocked': return `Paused — more information needed`;
      case 'task.completed': return `Task completed successfully`;
      default: return '';
    }
  }).filter(Boolean);
}

// Derive agent journey from events
function buildAgentJourney(events: TaskEvent[]): AgentId[] {
  const agents: AgentId[] = [];
  for (const e of events) {
    if (e.event_type === 'task.routed' && !agents.includes(e.agent_id)) {
      agents.push(e.agent_id);
    }
    if (e.event_type === 'task.handoff' && !agents.includes(e.to_agent)) {
      agents.push(e.to_agent);
    }
  }
  return agents;
}

const AGENT_ICON_CLASS: Record<AgentId, string> = {
  email_agent: 'icon-email',
  calendar_agent: 'icon-calendar',
  search_agent: 'icon-research',
  custom_agent: 'icon-executive',
};

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ task, onClose }) => {
  const agentId = task.currentAgentId ?? 'email_agent';
  const agentDef = AGENT_DEFINITIONS[agentId];
  const stepDefs = AGENT_STEPS[agentId];

  // Animate steps progressively
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setCurrentStep(0);
    const totalSteps = stepDefs.length;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= totalSteps - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, task.status === 'completed' ? 0 : 1800);

    return () => clearInterval(interval);
  }, [agentId, task.status]);

  // If task is completed, show all steps done
  const displayStep = task.status === 'completed' ? stepDefs.length - 1 : currentStep;

  const steps: ExecutionStep[] = stepDefs.map((def, i) => ({
    id: i + 1,
    label: def.label,
    detail: def.detail,
    status: i < displayStep ? 'done' : i === displayStep ? 'active' : 'pending',
  }));

  const completedCount = steps.filter(s => s.status === 'done').length + (task.status === 'completed' ? 1 : 0);
  const totalCount = steps.length;
  const progressPct = (completedCount / totalCount) * 100;

  const timeline = buildTimeline(task.events);
  const journey = buildAgentJourney(task.events);

  const isCompleted = task.status === 'completed';
  const isBlocked = task.status === 'blocked';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="execution-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className={`modal-agent-icon ${AGENT_ICON_CLASS[agentId]}`} style={{ fontSize: '22px' }}>
            {agentDef.avatar}
          </div>
          <div className="modal-title-block">
            <div className="modal-title">{agentDef.name}</div>
            <div className="modal-subtitle">
              {isCompleted
                ? '✓ Task completed successfully'
                : isBlocked
                ? '⚠️ Needs your attention'
                : 'Working on your request…'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Task description */}
        <div className="modal-task-desc">
          "{task.description}"
        </div>

        {/* Agent journey (if multi-agent) */}
        {journey.length > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Path:
            </span>
            {journey.map((aid, i) => (
              <React.Fragment key={aid}>
                <span style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  background: aid === agentId ? AGENT_DEFINITIONS[aid].color + '15' : 'var(--surface-subtle)',
                  border: `1px solid ${aid === agentId ? AGENT_DEFINITIONS[aid].color + '40' : 'var(--border)'}`,
                  borderRadius: '4px',
                  color: aid === agentId ? AGENT_DEFINITIONS[aid].color : 'var(--text-secondary)',
                  fontWeight: aid === agentId ? 600 : 400
                }}>
                  {AGENT_DEFINITIONS[aid].avatar} {AGENT_DEFINITIONS[aid].name}
                </span>
                {i < journey.length - 1 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                )}
              </React.Fragment>
            ))}
            {!isCompleted && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>}
            {!isCompleted && (
              <span style={{
                fontSize: '12px',
                padding: '3px 8px',
                background: 'var(--status-done-bg)',
                border: '1px solid var(--status-done-border)',
                borderRadius: '4px',
                color: 'var(--status-done)',
              }}>
                ✅ Submit Desk
              </span>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="steps-list">
          {steps.map(step => (
            <div key={step.id} className="step-item">
              <div className={`step-icon step-${step.status}`}>
                {step.status === 'done' ? '✓' : step.status === 'active' ? '●' : step.id}
              </div>
              <div className="step-content">
                <div className={`step-label step-${step.status}`}>
                  {step.label}
                </div>
                {step.status === 'active' && step.detail && (
                  <div className="step-detail">{step.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="step-progress-row">
          <span className="step-counter">
            Step {Math.min(displayStep + 1, totalCount)} of {totalCount}
          </span>
          <div className="step-progress-bar">
            <div
              className={`step-progress-fill ${isCompleted ? 'done' : ''}`}
              style={{ width: `${isCompleted ? 100 : progressPct}%` }}
            />
          </div>
          <span className="step-counter" style={{ color: isCompleted ? 'var(--status-done)' : undefined }}>
            {isCompleted ? '✓ Done' : `${Math.round(isCompleted ? 100 : progressPct)}%`}
          </span>
        </div>

        {/* Blocked state warning */}
        {isBlocked && task.blockReason && (
          <div style={{
            marginTop: '16px',
            padding: '12px 14px',
            background: 'var(--status-blocked-bg)',
            border: '1px solid var(--status-blocked-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--status-blocked)'
          }}>
            ⚠️ <strong>Attention needed:</strong> {task.blockReason}
          </div>
        )}

        {/* Timeline of events */}
        {timeline.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '10px'
            }}>
              What happened
            </div>
            {timeline.map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '8px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: i === timeline.length - 1 && isCompleted
                    ? 'var(--status-done-bg)'
                    : 'var(--surface-subtle)',
                  border: `1px solid ${i === timeline.length - 1 && isCompleted ? 'var(--status-done-border)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                  color: i === timeline.length - 1 && isCompleted ? 'var(--status-done)' : 'var(--text-muted)'
                }}>
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Completion footer */}
        {isCompleted && (
          <div style={{
            marginTop: '16px',
            padding: '14px',
            background: 'var(--status-done-bg)',
            border: '1px solid var(--status-done-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--status-done)',
            textAlign: 'center'
          }}>
            ✓ Your task has been completed successfully
            {task.durationMs && (
              <div style={{ fontSize: '12px', fontWeight: 400, marginTop: '3px', color: 'var(--status-done)' }}>
                Total time: {task.durationMs < 1000 ? `${task.durationMs}ms` : `${(task.durationMs / 1000).toFixed(1)}s`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
