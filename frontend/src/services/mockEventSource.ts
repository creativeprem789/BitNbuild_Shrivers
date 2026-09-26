import type { TaskEvent, AgentId } from '../types/task';

type EventListener = (event: TaskEvent) => void;

class MockEventSource {
  private listeners: Set<EventListener> = new Set();

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: TaskEvent) {
    const timestampedEvent = {
      ...event,
      timestamp: new Date().toLocaleTimeString()
    };
    this.listeners.forEach((listener) => listener(timestampedEvent));
  }

  public dispatchTask(description: string): string {
    const taskId = 'mock-' + Math.random().toString(36).substring(2, 9);
    
    // Determine scenario based on description keywords
    const descLower = description.toLowerCase();

    if (descLower.includes('block') || descLower.includes('missing') || descLower.includes('unscheduled')) {
      this.runBlockedScenario(taskId, description);
    } else if (descLower.includes('research') || descLower.includes('search') || descLower.includes('handoff') || descLower.includes('benchmark')) {
      this.runHandoffScenario(taskId, description);
    } else if (descLower.includes('complex') || descLower.includes('audit') || descLower.includes('low confidence')) {
      this.runLowConfidenceScenario(taskId, description);
    } else {
      this.runStandardScenario(taskId, description);
    }

    return taskId;
  }

  private runStandardScenario(taskId: string, description: string) {
    let seq = 1;

    // 1. Created
    setTimeout(() => {
      this.emit({
        event_type: 'task.created',
        task_id: taskId,
        description,
        sequence_no: seq++
      });
    }, 100);

    // 2. Routed
    setTimeout(() => {
      const isEmail = description.toLowerCase().includes('email') || description.toLowerCase().includes('digest');
      const agentId: AgentId = isEmail ? 'email_agent' : 'calendar_agent';
      this.emit({
        event_type: 'task.routed',
        task_id: taskId,
        agent_id: agentId,
        confidence: 0.96,
        reason: isEmail 
          ? 'Identified request to compose & deliver executive email briefing.' 
          : 'Task involves scheduling or calendar event coordination.',
        sequence_no: seq++
      });
    }, 1200);

    // 3. Completed
    setTimeout(() => {
      this.emit({
        event_type: 'task.completed',
        task_id: taskId,
        duration_ms: 1450,
        sequence_no: seq++
      });
    }, 2800);
  }

  private runHandoffScenario(taskId: string, description: string) {
    let seq = 1;

    // 1. Created
    setTimeout(() => {
      this.emit({
        event_type: 'task.created',
        task_id: taskId,
        description,
        sequence_no: seq++
      });
    }, 100);

    // 2. Routed to search_agent
    setTimeout(() => {
      this.emit({
        event_type: 'task.routed',
        task_id: taskId,
        agent_id: 'search_agent',
        confidence: 0.92,
        reason: 'Initial phase requires crawling web search and retrieving vector knowledge.',
        sequence_no: seq++
      });
    }, 1200);

    // 3. Handoff to email_agent
    setTimeout(() => {
      this.emit({
        event_type: 'task.handoff',
        task_id: taskId,
        from_agent: 'search_agent',
        to_agent: 'email_agent',
        reason: 'Web research synthesis complete. Transferring report draft to Email Specialist for formatting & dispatch.',
        sequence_no: seq++
      });
    }, 2900);

    // 4. Completed
    setTimeout(() => {
      this.emit({
        event_type: 'task.completed',
        task_id: taskId,
        duration_ms: 3200,
        sequence_no: seq++
      });
    }, 4600);
  }

  private runBlockedScenario(taskId: string, description: string) {
    let seq = 1;

    // 1. Created
    setTimeout(() => {
      this.emit({
        event_type: 'task.created',
        task_id: taskId,
        description,
        sequence_no: seq++
      });
    }, 100);

    // 2. Routed to calendar_agent
    setTimeout(() => {
      this.emit({
        event_type: 'task.routed',
        task_id: taskId,
        agent_id: 'calendar_agent',
        confidence: 0.89,
        reason: 'Attempting room reservation and calendar allocation.',
        sequence_no: seq++
      });
    }, 1200);

    // 3. Blocked
    setTimeout(() => {
      this.emit({
        event_type: 'task.blocked',
        task_id: taskId,
        agent_id: 'calendar_agent',
        reason: 'Missing date and time parameters for calendar reservation. Awaiting user details or retry input.',
        sequence_no: seq++
      });
    }, 2800);
  }

  private runLowConfidenceScenario(taskId: string, description: string) {
    let seq = 1;

    setTimeout(() => {
      this.emit({
        event_type: 'task.created',
        task_id: taskId,
        description,
        sequence_no: seq++
      });
    }, 100);

    setTimeout(() => {
      this.emit({
        event_type: 'task.routed',
        task_id: taskId,
        agent_id: 'custom_agent',
        confidence: 0.48,
        reason: 'Classifier confidence < 0.60. Routing to Executive Resolver (custom_agent) for heuristic parsing.',
        sequence_no: seq++
      });
    }, 1200);

    setTimeout(() => {
      this.emit({
        event_type: 'task.completed',
        task_id: taskId,
        duration_ms: 1890,
        sequence_no: seq++
      });
    }, 3000);
  }

  public retryTask(taskId: string, lastSeq: number) {
    let seq = lastSeq + 1;

    // Handoff to custom_agent / resolver on retry
    setTimeout(() => {
      this.emit({
        event_type: 'task.handoff',
        task_id: taskId,
        from_agent: 'calendar_agent',
        to_agent: 'custom_agent',
        reason: 'Retry payload received with missing parameters resolved. Escalated to Executive Resolver for override.',
        sequence_no: seq++
      });
    }, 800);

    // Completed
    setTimeout(() => {
      this.emit({
        event_type: 'task.completed',
        task_id: taskId,
        duration_ms: 1950,
        sequence_no: seq++
      });
    }, 2500);
  }
}

export const mockEventSource = new MockEventSource();
