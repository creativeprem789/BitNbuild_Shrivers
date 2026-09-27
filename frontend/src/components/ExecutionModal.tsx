import React, { useState, useEffect } from 'react';
import type { ActiveTask, AgentId, TaskEvent } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';

// ─────────────────────────────────────────────────────────────────
// Per-agent step definitions  (human-readable, non-technical)
// ─────────────────────────────────────────────────────────────────
const AGENT_STEPS: Record<AgentId, Array<{ label: string; detail: string }>> = {
  email_agent: [
    { label: 'Understanding the email request',    detail: 'Reading what you need and identifying who to contact' },
    { label: 'Preparing the recipient details',    detail: 'Gathering email addresses and contact information' },
    { label: 'Choosing an appropriate subject',    detail: 'Selecting a clear, relevant subject line' },
    { label: 'Writing the email content',          detail: 'Composing the body text with the right tone and detail' },
    { label: 'Reviewing the message',              detail: 'Checking for accuracy, tone and completeness' },
    { label: 'Sending the email',                  detail: 'Delivering the message to the intended recipient(s)' },
  ],
  calendar_agent: [
    { label: 'Understanding the scheduling request', detail: 'Identifying attendees, purpose and any time preferences' },
    { label: 'Checking the required date and time',  detail: 'Parsing dates, durations and time zone details' },
    { label: 'Checking calendar availability',       detail: 'Finding free slots that work for all participants' },
    { label: 'Preparing the event details',          detail: 'Setting up title, location, agenda and attendee list' },
    { label: 'Confirming the schedule',              detail: 'Verifying no conflicts exist before committing' },
    { label: 'Adding the event',                     detail: 'Creating the calendar entry and sending invitations' },
  ],
  search_agent: [
    { label: 'Understanding the research request', detail: 'Breaking down exactly what information is needed' },
    { label: 'Identifying relevant information',   detail: 'Determining the best sources and search strategies' },
    { label: 'Searching available sources',        detail: 'Querying databases, web, and knowledge repositories' },
    { label: 'Comparing useful findings',          detail: 'Evaluating quality and relevance of discovered data' },
    { label: 'Organising the information',         detail: 'Structuring the key facts and insights clearly' },
    { label: 'Preparing the result',               detail: 'Compiling a clear, actionable summary or report' },
  ],
  custom_agent: [
    { label: 'Understanding the request',            detail: 'Assessing what is needed and the best approach' },
    { label: 'Reviewing the available information',  detail: 'Checking context, prior steps and relevant data' },
    { label: 'Identifying the required action',      detail: 'Determining the exact steps needed to resolve this' },
    { label: 'Resolving the request',               detail: 'Executing the required steps with available tools' },
    { label: 'Verifying the result',                detail: 'Checking the outcome meets the original requirement' },
    { label: 'Preparing the final response',        detail: 'Wrapping up and delivering a clear result' },
  ],
};

const AGENT_ICON_CLASS: Record<AgentId, string> = {
  email_agent:    'icon-email',
  calendar_agent: 'icon-calendar',
  search_agent:   'icon-research',
  custom_agent:   'icon-executive',
};

// Build human-readable journey from events
function buildJourneyFromEvents(events: TaskEvent[]): AgentId[] {
  const agents: AgentId[] = [];
  for (const e of events) {
    if (e.event_type === 'task.routed' && !agents.includes(e.agent_id)) agents.push(e.agent_id);
    if (e.event_type === 'task.handoff' && !agents.includes(e.to_agent)) agents.push(e.to_agent);
  }
  return agents;
}

// ─────────────────────────────────────────────────────────────────
// ExecutionModal – renders fresh every time (key forces remount)
// ─────────────────────────────────────────────────────────────────
interface ExecutionModalProps {
  agentId: AgentId;
  taskDescription: string;
  taskId: string;
  tasks: ActiveTask[];
  isClosing: boolean;
  onClose: () => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  agentId,
  taskDescription,
  taskId,
  tasks,
  isClosing,
  onClose,
}) => {
  const agentDef  = AGENT_DEFINITIONS[agentId];
  const stepDefs  = AGENT_STEPS[agentId];
  const totalSteps = stepDefs.length;

  // ── Step progression (starts from -1 = pre-start, then 0..N-1) ──
  const [currentStep, setCurrentStep] = useState(-1);

  // Small entry delay so the panel itself has animated in first
  useEffect(() => {
    const startTimer = setTimeout(() => setCurrentStep(0), 400);
    return () => clearTimeout(startTimer);
  }, []);

  // Advance step every 2 000 ms
  useEffect(() => {
    if (currentStep < 0 || currentStep >= totalSteps - 1) return;
    const t = setTimeout(() => setCurrentStep(s => s + 1), 2000);
    return () => clearTimeout(t);
  }, [currentStep, totalSteps]);

  // Derive live task status for this taskId
  const liveTask = tasks.find(t => t.id === taskId);
  const isTaskCompleted = liveTask?.status === 'completed';
  const isTaskBlocked   = liveTask?.status === 'blocked';
  const journey = liveTask ? buildJourneyFromEvents(liveTask.events) : [];

  // Display step — snap to end if task already completed
  const displayStep = isTaskCompleted ? totalSteps - 1 : Math.max(currentStep, 0);
  const progressPct = ((displayStep + 1) / totalSteps) * 100;

  return (
    <div
      className={`modal-overlay ${isClosing ? 'modal-overlay-out' : ''}`}
      onClick={onClose}
    >
      <div
        className={`execution-modal ${isClosing ? 'modal-content-out' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="modal-header">
          <div className={`modal-agent-icon ${AGENT_ICON_CLASS[agentId]}`}>
            {agentDef.avatar}
          </div>
          <div className="modal-title-block">
            <div className="modal-title">{agentDef.name}</div>
            <div className="modal-subtitle">
              {isTaskCompleted
                ? '✓ Work complete — handing off'
                : isTaskBlocked
                ? '⚠ Needs your attention'
                : 'Working on your task…'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Task description ────────────────────────────────── */}
        <div className="modal-task-desc">"{taskDescription}"</div>

        {/* ── Journey path (multi-agent) ──────────────────────── */}
        {journey.length > 1 && (
          <div className="modal-journey">
            <span className="modal-journey-label">Journey so far:</span>
            {journey.map((aid, i) => (
              <React.Fragment key={aid}>
                <span
                  className={`journey-chip ${aid === agentId ? 'journey-chip-active' : 'journey-chip-done'}`}
                >
                  {AGENT_DEFINITIONS[aid].avatar} {AGENT_DEFINITIONS[aid].name}
                </span>
                {i < journey.length - 1 && <span className="journey-sep">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Steps list ─────────────────────────────────────── */}
        <div className="steps-list">
          {stepDefs.map((def, i) => {
            const status: 'done' | 'active' | 'pending' =
              i < displayStep ? 'done'
              : i === displayStep ? 'active'
              : 'pending';
            return (
              <div key={i} className={`step-item step-item-${status}`}>
                <div className={`step-icon step-${status}`}>
                  {status === 'done' ? '✓' : status === 'active' ? <PulseCircle /> : i + 1}
                </div>
                <div className="step-content">
                  <div className={`step-label step-${status}`}>{def.label}</div>
                  {status === 'active' && (
                    <div className="step-detail">{def.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Progress bar ───────────────────────────────────── */}
        <div className="step-progress-row">
          <span className="step-counter">Step {displayStep + 1} of {totalSteps}</span>
          <div className="step-progress-bar">
            <div
              className={`step-progress-fill ${isTaskCompleted ? 'done' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span
            className="step-counter"
            style={{ color: isTaskCompleted ? 'var(--status-done)' : undefined }}
          >
            {isTaskCompleted ? '✓ Done' : `${Math.round(progressPct)}%`}
          </span>
        </div>

        {/* ── Blocked warning ────────────────────────────────── */}
        {isTaskBlocked && liveTask?.blockReason && (
          <div className="modal-blocked-banner">
            ⚠ <strong>Attention needed:</strong> {liveTask.blockReason}
          </div>
        )}
      </div>
    </div>
  );
};

// Small animated pulse circle for the active step icon
const PulseCircle: React.FC = () => (
  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor', animation: 'step-pulse-inner 1.2s ease-in-out infinite' }}>
    <style>{`@keyframes step-pulse-inner { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
  </span>
);
