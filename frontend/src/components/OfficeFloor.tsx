import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ActiveTask, AgentId, AgentState } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { ReceptionIcon, EmailIcon, CalendarIcon, ResearchIcon, ExecutiveIcon, SubmitIcon } from './GlassIcons';

// ─── Constants ────────────────────────────────────────────────────
const TOKEN_WIDTH  = 200;   // px – width of the traveling task token card
const TOKEN_HEIGHT = 52;    // px – height of the token card
const TRAVEL_MS    = 1400;  // token travel animation duration (ms)

// Agents shown left-to-right in the office row
const AGENT_ORDER: AgentId[] = ['email_agent', 'calendar_agent', 'search_agent', 'custom_agent'];

const AGENT_ICON_CLASS: Record<AgentId, string> = {
  email_agent:    'icon-email',
  calendar_agent: 'icon-calendar',
  search_agent:   'icon-research',
  custom_agent:   'icon-executive',
};

const AGENT_WORKING_VERB: Record<AgentId, string> = {
  email_agent:    'Writing & sending',
  calendar_agent: 'Scheduling',
  search_agent:   'Researching',
  custom_agent:   'Resolving',
};

// ─── Types ────────────────────────────────────────────────────────
interface OfficeFloorProps {
  agentStates:      Record<AgentId, AgentState>;
  tasks:            ActiveTask[];
  onRetryTask:      (taskId: string, lastSeq: number) => void;
  onOpenExecution:  (task: ActiveTask) => void;
  justCompletedTask: ActiveTask | null;
  onAskAssistant:   () => void;
}

// ─── Helper: get the single most-relevant "active" task ───────────
function getPrimaryTask(tasks: ActiveTask[]): ActiveTask | null {
  return (
    tasks.find(t => t.status === 'working')   ||
    tasks.find(t => t.status === 'routed')    ||
    tasks.find(t => t.status === 'blocked')   ||
    tasks.find(t => t.status === 'completed') ||
    null
  );
}

// ─── Office Floor Component ───────────────────────────────────────
export const OfficeFloor: React.FC<OfficeFloorProps> = ({
  agentStates,
  tasks,
  onRetryTask,
  onOpenExecution,
  justCompletedTask,
  onAskAssistant,
}) => {
  const [hoveredCard, setHoveredCard] = React.useState<string | null>(null);

  const containerRef   = useRef<HTMLDivElement>(null);
  const receptionRef   = useRef<HTMLDivElement>(null);
  const submitRef      = useRef<HTMLDivElement>(null);
  const agentRefs      = useRef<Record<string, HTMLDivElement | null>>({});

  // Token animation state
  const [tokenLeft, setTokenLeft]         = useState<number>(-9999);
  const [tokenVisible, setTokenVisible]   = useState(false);
  const [tokenDesc, setTokenDesc]         = useState('');
  const [tokenAnimation, setTokenAnimation] = useState(false);

  // Track which agents have been visited (for ✓ completed state)
  const [visitedAgents, setVisitedAgents] = useState<Set<AgentId>>(new Set());
  const prevAgentIdRef = useRef<AgentId | null>(null);

  const task = getPrimaryTask(tasks);

  // ── Calculate token left offset centred on a given element ──────
  const calcTokenLeft = useCallback((el: HTMLElement | null): number => {
    if (!el || !containerRef.current) return -9999;
    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect        = el.getBoundingClientRect();
    return elRect.left - containerRect.left + elRect.width / 2 - TOKEN_WIDTH / 2;
  }, []);

  // ── Move token to target element (with transition) ───────────────
  const moveToken = useCallback((el: HTMLElement | null) => {
    const newLeft = calcTokenLeft(el);
    // Enable transition, update left
    setTokenAnimation(true);
    setTokenLeft(newLeft);
  }, [calcTokenLeft]);

  // ── Respond to task location changes ────────────────────────────
  useEffect(() => {
    if (!task) {
      setTokenVisible(false);
      prevAgentIdRef.current = null;
      return;
    }

    setTokenDesc(task.description);

    const location = task.currentLocation;

    // Choose target element
    let targetEl: HTMLElement | null = null;
    if (location === 'inbox') {
      targetEl = receptionRef.current;
    } else if (location === 'done') {
      targetEl = submitRef.current;
    } else {
      targetEl = agentRefs.current[location as AgentId] ?? null;
    }

    // First time: snap without animation
    if (!tokenVisible) {
      setTokenAnimation(false);
      setTokenLeft(calcTokenLeft(targetEl));
      setTokenVisible(true);
      return;
    }

    // Subsequent moves: animate
    moveToken(targetEl);

    // Track visited agents
    if (task.currentAgentId && task.currentAgentId !== prevAgentIdRef.current) {
      prevAgentIdRef.current = task.currentAgentId;
      setVisitedAgents(prev => {
        const next = new Set(prev);
        next.add(task.currentAgentId!);
        return next;
      });
    }
  }, [task?.currentLocation, task?.currentAgentId]);

  // Reset visited agents when tasks are cleared
  useEffect(() => {
    if (tasks.length === 0) {
      setTokenVisible(false);
      setVisitedAgents(new Set());
      prevAgentIdRef.current = null;
    }
  }, [tasks.length]);

  const inboxTasks = tasks.filter(t => t.currentLocation === 'inbox' && t.status !== 'completed');
  const doneTasks  = tasks.filter(t => t.status === 'completed');
  const isReceptionActive = inboxTasks.length > 0 || tasks.some(t => t.status === 'created');

  return (
    <section className="office-floor-section">
      {/* ── Horizontal office row ────────────────────────────────── */}
      <div
        className="office-row-outer"
        ref={containerRef}
      >
        {/* Traveling task token */}
        {tokenVisible && task && (
          <div
            className="task-token-pill"
            style={{
              left:       `${tokenLeft}px`,
              width:      `${TOKEN_WIDTH}px`,
              transition: tokenAnimation ? `left ${TRAVEL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
            }}
          >
            <span className="token-emoji">
              {task.status === 'completed' ? '✅'
               : task.status === 'blocked' ? '⚠️'
               : task.currentAgentId ? AGENT_DEFINITIONS[task.currentAgentId].avatar
               : '📋'}
            </span>
            <span className="token-text">
              {task.description.length > 26
                ? task.description.slice(0, 26) + '…'
                : task.description}
            </span>
          </div>
        )}

        {/* ── Office stations horizontal row ───────────────────── */}
        <div className="office-stations-row">

          {/* RECEPTION */}
          <div
            ref={receptionRef}
            className={`office-station station-reception ${isReceptionActive ? 'station-active' : ''}`}
            onMouseEnter={() => setHoveredCard('reception')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="station-icon icon-reception">
              <ReceptionIcon isActive={isReceptionActive} isHovered={hoveredCard === 'reception'} />
            </div>
            <div className="station-name">Reception</div>
            <div className="station-role">Task Intake</div>
            <div className="station-status-row">
              <span
                className="status-indicator"
                style={{
                  background: isReceptionActive ? 'var(--accent)' : 'var(--status-idle)',
                  animation: isReceptionActive ? 'working-pulse 1.4s infinite' : 'none'
                }}
              />
              <span style={{ fontSize: '10.5px', color: isReceptionActive ? 'var(--accent)' : 'var(--status-idle)', fontWeight: 600 }}>
                {isReceptionActive ? 'Receiving' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Arrow → */}
          <FlowArrow active={isReceptionActive} />

          {/* SPECIALIST MANAGERS */}
          {AGENT_ORDER.map((agentId, idx) => {
            const def     = AGENT_DEFINITIONS[agentId];
            const state   = agentStates[agentId];
            const agentTask = tasks.find(t => t.currentAgentId === agentId && t.status !== 'completed');
            const wasVisited = visitedAgents.has(agentId) && state === 'idle';
            const isActive   = state === 'working' || state === 'blocked';

            return (
              <React.Fragment key={agentId}>
                <div
                  ref={el => { agentRefs.current[agentId] = el; }}
                  className={`office-station station-manager
                    ${state === 'working'  ? 'station-working'  : ''}
                    ${state === 'blocked'  ? 'station-blocked'  : ''}
                    ${wasVisited           ? 'station-visited'  : ''}
                    ${state === 'idle' && !wasVisited ? 'station-idle' : ''}
                  `}
                  onClick={() => agentTask && onOpenExecution(agentTask)}
                  onMouseEnter={() => setHoveredCard(agentId)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{ cursor: agentTask ? 'pointer' : 'default' }}
                >
                  <div className={`station-icon ${AGENT_ICON_CLASS[agentId]}`}>
                    {agentId === 'email_agent' && <EmailIcon isActive={isActive} isHovered={hoveredCard === agentId} />}
                    {agentId === 'calendar_agent' && <CalendarIcon isActive={isActive} isHovered={hoveredCard === agentId} />}
                    {agentId === 'search_agent' && <ResearchIcon isActive={isActive} isHovered={hoveredCard === agentId} />}
                    {agentId === 'custom_agent' && <ExecutiveIcon isActive={isActive} isHovered={hoveredCard === agentId} />}
                  </div>
                  <div className="station-name">{def.name}</div>
                  <div className="station-role">
                    {agentId === 'email_agent'    ? 'Communication & Outreach'
                     : agentId === 'calendar_agent' ? 'Schedule & Logistics'
                     : agentId === 'search_agent'   ? 'Research & Knowledge'
                     : 'Fallback & Resolution'}
                  </div>

                  <div className="station-status-row">
                    <span className={`status-indicator ${state}`} />
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: state === 'working' ? 'var(--status-working)'
                           : state === 'blocked' ? 'var(--status-blocked)'
                           : wasVisited ? 'var(--status-done)'
                           : 'var(--status-idle)'
                    }}>
                      {state === 'working' ? 'Working'
                       : state === 'blocked' ? 'Attention'
                       : wasVisited ? '✓ Done'
                       : 'Idle'}
                    </span>
                  </div>

                  {/* Working sub-label */}
                  {state === 'working' && agentTask && (
                    <div className="station-working-label">
                      {AGENT_WORKING_VERB[agentId]} →
                    </div>
                  )}

                  {/* Blocked retry button */}
                  {state === 'blocked' && agentTask && (
                    <button
                      className="btn-retry"
                      style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}
                      onClick={e => {
                        e.stopPropagation();
                        onRetryTask(agentTask.id, agentTask.lastSequenceNo);
                      }}
                    >
                      ↺ Retry
                    </button>
                  )}

                  {/* Visited checkmark overlay */}
                  {wasVisited && (
                    <div className="station-done-badge">✓</div>
                  )}
                </div>

                {/* Arrow between managers, and between last manager and submit */}
                <FlowArrow
                  active={state === 'working' || (wasVisited && idx < AGENT_ORDER.length - 1)}
                  done={wasVisited}
                />
              </React.Fragment>
            );
          })}

          {/* SUBMIT DESK */}
          <div
            ref={submitRef}
            className={`office-station station-submit ${doneTasks.length > 0 ? 'station-done' : ''}`}
            onMouseEnter={() => setHoveredCard('submit')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="station-icon icon-submit">
              <SubmitIcon isHovered={hoveredCard === 'submit'} />
            </div>
            <div className="station-name">Submit Desk</div>
            <div className="station-role">Completed Tasks</div>

            <div className="station-status-row">
              <span
                className="status-indicator"
                style={{ background: doneTasks.length > 0 ? 'var(--status-done)' : 'var(--status-idle)' }}
              />
              <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: doneTasks.length > 0 ? 'var(--status-done)' : 'var(--status-idle)'
              }}>
                {doneTasks.length > 0 ? `${doneTasks.length} completed` : 'Empty'}
              </span>
            </div>

            {justCompletedTask && (
              <div className="station-completion-badge">
                ✓ Task done!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Completed task summary card (below office row) ─────────── */}
      {justCompletedTask && (
        <div className="completion-card">
          <div className="completion-title">✓ Task Completed</div>
          <div className="completion-desc">{justCompletedTask.description}</div>
          {justCompletedTask.durationMs && (
            <div style={{ fontSize: '12px', color: 'var(--status-done)', marginBottom: '12px' }}>
              Finished in {(justCompletedTask.durationMs / 1000).toFixed(1)}s
            </div>
          )}
          <div className="completion-actions">
            <button className="btn-completion" onClick={onAskAssistant}>
              💬 Ask about this task
            </button>
            <button className="btn-completion" style={{ background: 'var(--status-done-bg)', borderColor: 'var(--status-done-border)', color: 'var(--status-done)' }}>
              ✓ Saved to History
            </button>
          </div>
        </div>
      )}

      {/* ── Flow legend ─────────────────────────────────────────────── */}
      <div className="office-legend">
        <LegendDot color="var(--status-idle)"    label="Idle" />
        <LegendDot color="var(--status-working)" label="Working" pulse />
        <LegendDot color="var(--status-done)"    label="Completed" />
        <LegendDot color="var(--status-blocked)" label="Needs Attention" />
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '11.5px' }}>
          Click any active desk to view execution
        </span>
      </div>
    </section>
  );
};

// ─── Sub-components ────────────────────────────────────────────────

const FlowArrow: React.FC<{ active?: boolean; done?: boolean }> = ({ active, done }) => (
  <div className={`flow-arrow-h ${active ? 'flow-arrow-active' : ''} ${done ? 'flow-arrow-done' : ''}`}>
    <div className="flow-arrow-line" />
    <div className="flow-arrow-head" />
  </div>
);

const LegendDot: React.FC<{ color: string; label: string; pulse?: boolean }> = ({ color, label, pulse }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
    <span style={{
      width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block',
      animation: pulse ? 'working-pulse 1.4s infinite' : 'none'
    }} />
    {label}
  </span>
);
