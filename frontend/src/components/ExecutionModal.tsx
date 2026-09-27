import React, { useState, useEffect, useRef } from 'react';
import type { ActiveTask, AgentId, TaskEvent } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';

// ─────────────────────────────────────────────────────────────────
// Timing constants
// ─────────────────────────────────────────────────────────────────
const STEP_MS      = 2200;   // time each step is "active" (normal)
const FAST_STEP_MS = 350;    // fast-forward when task already completed
const DONE_PAUSE   = 1000;   // pause after last step before signalling done

// ─────────────────────────────────────────────────────────────────
// Per-agent steps
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
    { label: 'Understanding the scheduling request', detail: 'Identifying attendees, purpose and time preferences' },
    { label: 'Checking the required date and time',  detail: 'Parsing dates, durations and time zone details' },
    { label: 'Checking calendar availability',        detail: 'Finding free slots that work for all participants' },
    { label: 'Preparing the event details',           detail: 'Setting up title, location, agenda and attendee list' },
    { label: 'Confirming the schedule',               detail: 'Verifying no conflicts exist before committing' },
    { label: 'Adding the event',                      detail: 'Creating the calendar entry and sending invitations' },
  ],
  search_agent: [
    { label: 'Understanding the research request', detail: 'Breaking down exactly what information is needed' },
    { label: 'Identifying relevant information',   detail: 'Determining the best sources and search strategies' },
    { label: 'Searching available sources',        detail: 'Querying databases, web and knowledge repositories' },
    { label: 'Comparing useful findings',          detail: 'Evaluating quality and relevance of discovered data' },
    { label: 'Organising the information',         detail: 'Structuring the key facts and insights clearly' },
    { label: 'Preparing the result',               detail: 'Compiling a clear, actionable summary or report' },
  ],
  custom_agent: [
    { label: 'Understanding the request',           detail: 'Assessing what is needed and the best approach' },
    { label: 'Reviewing the available information', detail: 'Checking context, prior steps and relevant data' },
    { label: 'Identifying the required action',     detail: 'Determining the exact steps needed to resolve this' },
    { label: 'Resolving the request',               detail: 'Executing the required steps with available tools' },
    { label: 'Verifying the result',               detail: 'Checking the outcome meets the original requirement' },
    { label: 'Preparing the final response',       detail: 'Wrapping up and delivering a clear result' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Contextual confirmation config — one per agent, at a specific step
// ─────────────────────────────────────────────────────────────────
interface ConfirmConfig {
  afterStep: number;          // show confirmation AFTER this step index is done
  intro: string;
  suggestion: string;
  yesLabel: string;
  noLabel: string;
  yesResult: string;          // text shown after YES
  noResult: string;           // text shown after NO
}

const AGENT_CONFIRMATIONS: Partial<Record<AgentId, ConfirmConfig>> = {
  email_agent: {
    afterStep: 1,             // after "Preparing recipient details"
    intro: 'I found a better subject for this email:',
    suggestion: '"Engineering Team Meeting — Tomorrow\'s Review"',
    yesLabel: 'Yes, use this subject',
    noLabel: 'No, keep original',
    yesResult: '✓ Subject confirmed — using suggested subject.',
    noResult: '↩ Keeping the original subject as provided.',
  },
  calendar_agent: {
    afterStep: 2,             // after "Checking availability"
    intro: 'I found a potential time conflict. Schedule at 3:00 PM instead?',
    suggestion: '3:00 PM — No conflicts detected',
    yesLabel: 'Yes, use 3:00 PM',
    noLabel: 'No, keep original time',
    yesResult: '✓ Confirmed — scheduling at 3:00 PM.',
    noResult: '↩ Using the originally requested time.',
  },
  search_agent: {
    afterStep: 2,             // after "Searching sources"
    intro: 'I found two source sets. Use the broader, more comprehensive set?',
    suggestion: 'Broader set — 8 sources, 47 results',
    yesLabel: 'Yes, use broader sources',
    noLabel: 'No, use focused set',
    yesResult: '✓ Confirmed — using the broader source set.',
    noResult: '↩ Using the focused source set.',
  },
  custom_agent: {
    afterStep: 2,             // after "Identifying required action"
    intro: 'I identified two possible resolution paths. Which should I use?',
    suggestion: 'Path A — Direct resolution (recommended)',
    yesLabel: 'Use Path A (faster)',
    noLabel: 'Use Path B (thorough)',
    yesResult: '✓ Confirmed — proceeding with Path A.',
    noResult: '↩ Proceeding with Path B.',
  },
};

const AGENT_ICON_CLASS: Record<AgentId, string> = {
  email_agent: 'icon-email', calendar_agent: 'icon-calendar',
  search_agent: 'icon-research', custom_agent: 'icon-executive',
};

function buildJourneyFromEvents(events: TaskEvent[]): AgentId[] {
  const agents: AgentId[] = [];
  for (const e of events) {
    if (e.event_type === 'task.routed' && !agents.includes(e.agent_id)) agents.push(e.agent_id);
    if (e.event_type === 'task.handoff' && !agents.includes(e.to_agent)) agents.push(e.to_agent);
  }
  return agents;
}

// ─────────────────────────────────────────────────────────────────
// ExecutionModal — fresh mount per agent (key prop in parent)
// ─────────────────────────────────────────────────────────────────
interface ExecutionModalProps {
  agentId: AgentId;
  taskDescription: string;
  taskId: string;
  tasks: ActiveTask[];
  isClosing: boolean;
  onClose: () => void;
  onStepsComplete?: () => void;   // ← called when all steps finish animating
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  agentId, taskDescription, taskId, tasks, isClosing, onClose, onStepsComplete,
}) => {
  const agentDef   = AGENT_DEFINITIONS[agentId];
  const stepDefs   = AGENT_STEPS[agentId];
  const totalSteps = stepDefs.length;
  const conf       = AGENT_CONFIRMATIONS[agentId] ?? null;

  // ── Core state ──────────────────────────────────────────────────
  const [waitingConfirm,    setWaitingConfirm]    = useState(false);
  const [confirmChoice,     setConfirmChoice]     = useState<'yes' | 'no' | null>(null);
  const [allStepsDone,      setAllStepsDone]      = useState(false);
  const [displayedStepCount, setDisplayedStepCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // Live task info
  const liveTask       = tasks.find(t => t.id === taskId);
  const isBlocked      = liveTask?.status === 'blocked';
  const journey        = liveTask ? buildJourneyFromEvents(liveTask.events) : [];

  // Count how many task.step events we received for this agent
  const receivedSteps = liveTask?.events.filter(e => e.event_type === 'task.step' && e.agent_id === agentId).length || 0;
  
  // Has the agent fully completed its work (handoff, complete, or blocked)?
  const agentFinished = liveTask?.events.some(e => 
    (e.event_type === 'task.handoff' && e.from_agent === agentId) ||
    e.event_type === 'task.completed' ||
    (e.event_type === 'task.blocked' && e.agent_id === agentId)
  ) || false;

  // ── Step engine ──────────────────────────────────────────────────
  useEffect(() => {
    clearTimer();
    if (allStepsDone) return;

    let targetCount = receivedSteps;
    if (agentFinished) {
      targetCount = totalSteps; // Ensure it reaches the end if finished
    }

    // Determine the barrier (the step after which we must pause)
    const barrierStep = (conf && confirmChoice === null) ? conf.afterStep + 1 : totalSteps + 1;

    // We can only display up to the target, bounded by the barrier
    const maxAllowed = Math.min(targetCount, barrierStep);

    if (displayedStepCount < maxAllowed) {
      // Advance step by step visually so it looks nice even if backend is fast
      timerRef.current = setTimeout(() => {
        setDisplayedStepCount(c => c + 1);
      }, 350); // fast visual catchup
      return clearTimer;
    }

    // If we hit the barrier, pause for confirmation
    if (conf && confirmChoice === null && displayedStepCount === barrierStep) {
      setWaitingConfirm(true);
      return;
    }

    // If we reached the end of the agent's work and no barrier is blocking us
    if (agentFinished && displayedStepCount >= totalSteps) {
      timerRef.current = setTimeout(() => {
        setAllStepsDone(true);
        setTimeout(() => onStepsComplete?.(), 1000); // 1s pause before closing
      }, 350);
      return clearTimer;
    }
  }, [receivedSteps, agentFinished, displayedStepCount, waitingConfirm, confirmChoice, allStepsDone, conf, totalSteps]);

  // Cleanup on unmount
  useEffect(() => clearTimer, []);

  // ── Confirmation handler ─────────────────────────────────────────
  const handleConfirm = (choice: 'yes' | 'no') => {
    setConfirmChoice(choice);
    setWaitingConfirm(false);
    // The main useEffect will now naturally see waitingConfirm=false, confirmChoice!=null
    // and set up a new timer to advance.
  };

  // ── Render helpers ───────────────────────────────────────────────
  // current active index is displayedStepCount - 1 (since 0 count means nothing active)
  const displayStep = Math.min(Math.max(displayedStepCount - 1, 0), totalSteps - 1);
  // Progress: count done steps
  const doneCount   = allStepsDone ? totalSteps : displayedStepCount;
  const progressPct = (doneCount / totalSteps) * 100;

  const headerStatus = allStepsDone
    ? '✓ All done — closing'
    : (agentFinished && displayedStepCount >= totalSteps)
    ? '✓ Work complete'
    : isBlocked
    ? '⚠ Needs your attention'
    : waitingConfirm
    ? '⏸ Waiting for your input…'
    : 'Working on your task…';

  return (
    <div
      className={`modal-overlay ${isClosing ? 'modal-overlay-out' : ''}`}
      onClick={onClose}
    >
      <div
        className={`execution-modal ${isClosing ? 'modal-content-out' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="modal-header">
          <div className={`modal-agent-icon ${AGENT_ICON_CLASS[agentId]}`}>
            {agentDef.avatar}
          </div>
          <div className="modal-title-block">
            <div className="modal-title">{agentDef.name}</div>
            <div className="modal-subtitle">{headerStatus}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Task description ─────────────────────────────────────── */}
        <div className="modal-task-desc">"{taskDescription}"</div>

        {/* ── Multi-agent journey path ─────────────────────────────── */}
        {journey.length > 1 && (
          <div className="modal-journey">
            <span className="modal-journey-label">Journey so far:</span>
            {journey.map((aid, i) => (
              <React.Fragment key={aid}>
                <span className={`journey-chip ${aid === agentId ? 'journey-chip-active' : 'journey-chip-done'}`}>
                  {AGENT_DEFINITIONS[aid].avatar} {AGENT_DEFINITIONS[aid].name}
                </span>
                {i < journey.length - 1 && <span className="journey-sep">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Steps list — with embedded confirmation ──────────────── */}
        <div className="steps-list">
          {stepDefs.map((def, i) => {
            // Determine individual step state
            const isDone    = allStepsDone || i < displayStep;
            const isActive  = !allStepsDone && i === displayStep;
            const isPending = !allStepsDone && !isDone && !isActive;
            const status    = isDone ? 'done' : isActive ? 'active' : 'pending';

            return (
              <React.Fragment key={i}>
                {/* Step row */}
                <div className={`step-item step-item-${status}`}>
                  <div className={`step-icon step-${status}`}>
                    {isDone  ? '✓'
                     : isActive ? <PulseDot />
                     : '○'}
                  </div>
                  <div className="step-content">
                    <div className={`step-label step-${status}`}>{def.label}</div>
                    {isActive && !waitingConfirm && (
                      <div className="step-detail">{def.detail}</div>
                    )}
                  </div>
                </div>

                {/* Inject confirmation panel AFTER the trigger step */}
                {conf && i === conf.afterStep && (
                  <>
                    {waitingConfirm && !confirmChoice && (
                      <ConfirmPanel conf={conf} onConfirm={handleConfirm} />
                    )}
                    {confirmChoice && (
                      <ConfirmResult choice={confirmChoice} conf={conf} />
                    )}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Progress bar ─────────────────────────────────────────── */}
        <div className="step-progress-row">
          <span className="step-counter">
            {allStepsDone ? `All ${totalSteps} steps done` : `Step ${displayStep + 1} of ${totalSteps}`}
          </span>
          <div className="step-progress-bar">
            <div
              className={`step-progress-fill ${allStepsDone ? 'done' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="step-counter" style={{ color: allStepsDone ? 'var(--status-done)' : undefined }}>
            {allStepsDone ? '✓ Done' : `${Math.round(progressPct)}%`}
          </span>
        </div>

        {/* ── Blocked warning ─────────────────────────────────────── */}
        {isBlocked && liveTask?.blockReason && (
          <div className="modal-blocked-banner">
            ⚠ <strong>Attention needed:</strong> {liveTask.blockReason}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Pulsing dot for active step icon ────────────────────────────
const PulseDot: React.FC = () => (
  <span className="pulse-dot" />
);

// ── Contextual confirmation panel ────────────────────────────────
const ConfirmPanel: React.FC<{ conf: ConfirmConfig; onConfirm: (c: 'yes' | 'no') => void }> = ({ conf, onConfirm }) => (
  <div className="confirm-panel">
    <div className="confirm-panel-intro">{conf.intro}</div>
    <div className="confirm-panel-suggestion">
      {conf.suggestion}
    </div>
    <div className="confirm-panel-actions">
      <button className="confirm-btn confirm-btn-yes" onClick={() => onConfirm('yes')}>
        ✓ {conf.yesLabel}
      </button>
      <button className="confirm-btn confirm-btn-no" onClick={() => onConfirm('no')}>
        ↩ {conf.noLabel}
      </button>
    </div>
  </div>
);

// ── Result after confirmation ────────────────────────────────────
const ConfirmResult: React.FC<{ choice: 'yes' | 'no'; conf: ConfirmConfig }> = ({ choice, conf }) => (
  <div className={`confirm-result confirm-result-${choice}`}>
    {choice === 'yes' ? conf.yesResult : conf.noResult}
  </div>
);
