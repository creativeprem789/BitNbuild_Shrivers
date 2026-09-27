import React, { useState, useRef, useEffect } from 'react';
import type { ActiveTask, TaskEvent, AgentId } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';

interface ChatbotPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  tasks: ActiveTask[];
  activityLogs: TaskEvent[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function buildAgentJourney(events: TaskEvent[]): string {
  const parts: string[] = ['Reception'];
  for (const e of events) {
    if (e.event_type === 'task.routed') {
      parts.push(AGENT_DEFINITIONS[e.agent_id]?.name ?? e.agent_id);
    }
    if (e.event_type === 'task.handoff') {
      parts.push(AGENT_DEFINITIONS[e.to_agent]?.name ?? e.to_agent);
    }
    if (e.event_type === 'task.completed') {
      parts.push('Submit Desk');
    }
  }
  return parts.join(' → ');
}

function generateAssistantResponse(
  userMessage: string,
  tasks: ActiveTask[],
  activityLogs: TaskEvent[]
): string {
  const lowerMsg = userMessage.toLowerCase();
  const recentTask = tasks[tasks.length - 1];
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  // No tasks yet
  if (tasks.length === 0) {
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "Hello! I'm your office assistant. Dispatch a task above and I'll help you understand what's happening as your specialists work on it.";
    }
    return "No tasks have been dispatched yet. Try giving the office a task above — describe what you need done in plain language, and the right specialist will handle it automatically.";
  }

  // Where is my task
  if (lowerMsg.includes('where') && (lowerMsg.includes('task') || lowerMsg.includes('it'))) {
    if (!recentTask) return "No active tasks right now.";
    const loc = recentTask.currentLocation;
    if (loc === 'inbox') return `Your task is at Reception, being processed and about to be assigned to the right specialist.`;
    if (loc === 'done') return `Your task has been completed and is at the Submit Desk. It's all done!`;
    const agentName = recentTask.currentAgentId ? AGENT_DEFINITIONS[recentTask.currentAgentId]?.name : 'a specialist';
    return `Your task is currently with the **${agentName}**, who is actively working on it.`;
  }

  // Who is working
  if (lowerMsg.includes('who') && (lowerMsg.includes('working') || lowerMsg.includes('handling') || lowerMsg.includes('doing'))) {
    if (!recentTask?.currentAgentId) return "No one is actively working on a task right now.";
    const def = AGENT_DEFINITIONS[recentTask.currentAgentId];
    return `The **${def.name}** is handling your task. Their role is ${def.description.toLowerCase()}.`;
  }

  // What is happening
  if (lowerMsg.includes('what') && (lowerMsg.includes('doing') || lowerMsg.includes('happening') || lowerMsg.includes('working on'))) {
    if (!recentTask?.currentAgentId) return "Nothing is actively being worked on right now.";
    const def = AGENT_DEFINITIONS[recentTask.currentAgentId];
    const status = recentTask.status;
    if (status === 'working' || status === 'routed') {
      return `The **${def.name}** is working on: "${recentTask.description}". They specialize in ${def.description.toLowerCase()}.`;
    }
    return `The task status is: ${status}.`;
  }

  // Is task finished / done / completed
  if (lowerMsg.includes('done') || lowerMsg.includes('finish') || lowerMsg.includes('complet') || lowerMsg.includes('ready')) {
    if (completedTasks.length === 0) return "Not yet! The task is still being worked on. I'll let you know when it's done.";
    const t = completedTasks[completedTasks.length - 1];
    const dur = t.durationMs ? ` It took ${(t.durationMs / 1000).toFixed(1)} seconds.` : '';
    return `Yes! Your task has been completed.${dur} It's now at the Submit Desk. The journey was: ${buildAgentJourney(t.events)}.`;
  }

  // What happened / history / explain
  if (lowerMsg.includes('happened') || lowerMsg.includes('explain') || lowerMsg.includes('show') || lowerMsg.includes('step')) {
    if (!recentTask) return "No task history available.";
    const journey = buildAgentJourney(recentTask.events);
    return `Here's what happened with your task:\n\n"${recentTask.description}"\n\nJourney: ${journey}\n\nThe office automatically assigned it to the right specialist based on what you asked for.`;
  }

  // Which agent / who handled
  if (lowerMsg.includes('which') || lowerMsg.includes('agent') || lowerMsg.includes('manager') || lowerMsg.includes('specialist')) {
    if (activeTasks.length > 0) {
      const t = activeTasks[activeTasks.length - 1];
      if (t.currentAgentId) {
        const def = AGENT_DEFINITIONS[t.currentAgentId];
        return `The **${def.name}** is currently handling your task. They handle ${def.description.toLowerCase()}.`;
      }
    }
    if (completedTasks.length > 0) {
      const t = completedTasks[completedTasks.length - 1];
      const journey = buildAgentJourney(t.events);
      return `Your last completed task went through: ${journey}.`;
    }
    return "Dispatch a task and I'll tell you exactly which specialist handles it.";
  }

  // Why
  if (lowerMsg.includes('why')) {
    if (!recentTask) return "No tasks to explain yet.";
    const routedEvent = recentTask.events.find(e => e.event_type === 'task.routed');
    if (routedEvent && routedEvent.event_type === 'task.routed') {
      return `The task was assigned because: ${routedEvent.reason}`;
    }
    return "The office automatically determined the best specialist based on your task description.";
  }

  // Replay
  if (lowerMsg.includes('replay') || lowerMsg.includes('again') || lowerMsg.includes('redo')) {
    return "To replay an execution, open a task from the History page. You'll see the full step-by-step journey of any past task.";
  }

  // Summary
  if (lowerMsg.includes('summary') || lowerMsg.includes('overview') || lowerMsg.includes('status')) {
    return `Office summary:\n• Total tasks: ${tasks.length}\n• Active: ${activeTasks.length}\n• Completed: ${completedTasks.length}\n\n${recentTask ? `Latest: "${recentTask.description}" — Status: ${recentTask.status}` : ''}`;
  }

  // Hello / greetings
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    return `Hello! I'm your office assistant. You can ask me things like:\n• "Where is my task?"\n• "What is the email manager doing?"\n• "Is my task done?"\n• "Why was this sent to research?"\n\nHow can I help?`;
  }

  // Help
  if (lowerMsg.includes('help') || lowerMsg.includes('what can you')) {
    return `I can help you understand what's happening with your tasks. Try asking:\n• "Where is my task?"\n• "Who is working on it?"\n• "What are they doing?"\n• "Is my task finished?"\n• "What happened?"\n• "Which specialist handled this?"`;
  }

  // Default
  return `I'm your office assistant. I can answer questions like "Where is my task?", "Who is working on it?", "Is it done?", or "What happened?". What would you like to know?`;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  isOpen,
  onToggle,
  tasks,
  activityLogs
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your office assistant. Dispatch a task and ask me anything about what's happening — like \"Where is my task?\" or \"What is the email manager doing?\"",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate assistant thinking
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

    const response = generateAssistantResponse(trimmed, tasks, activityLogs);
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    "Where is my task?",
    "Is it done?",
    "What happened?"
  ];

  return (
    <>
      {/* Toggle button */}
      <button
        className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title="Office Assistant"
        aria-label="Toggle Office Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Panel */}
      <div className={`chatbot-panel ${isOpen ? '' : 'collapsed'}`}>
        <div className="chatbot-header">
          <div className="chatbot-avatar">🤝</div>
          <div>
            <div className="chatbot-title">Office Assistant</div>
            <div className="chatbot-subtitle">Ask me about your tasks</div>
          </div>
        </div>

        <div className="chatbot-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="chat-bubble">
                {msg.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.split('**').map((part, j) =>
                      j % 2 === 1
                        ? <strong key={j}>{part}</strong>
                        : <span key={j}>{part}</span>
                    )}
                    {i < msg.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat-message assistant">
              <div className="chat-bubble" style={{ display: 'flex', gap: '4px', padding: '10px 14px' }}>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--text-muted)',
                      display: 'inline-block',
                      animation: `working-pulse 1.2s infinite ${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {quickQuestions.map(q => (
              <button
                key={q}
                className="preset-pill"
                style={{ fontSize: '11px' }}
                onClick={() => {
                  setInput(q);
                  setTimeout(handleSend, 50);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="chatbot-input-row">
          <input
            className="chatbot-input"
            placeholder="Ask about your task…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <button className="chatbot-send" onClick={handleSend} disabled={isTyping || !input.trim()}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
};
