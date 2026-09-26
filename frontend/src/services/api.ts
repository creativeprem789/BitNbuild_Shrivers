import { mockEventSource } from './mockEventSource';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface CreateTaskResponse {
  task_id: string;
  status: string;
  description: string;
}

export interface TaskHistoryResponse {
  task: {
    id: string;
    status: string;
    current_agent_id?: string;
    duration_ms?: number;
  };
  events: Array<{
    sequence_no: number;
    event_type: string;
    payload: any;
  }>;
}

export async function apiCreateTask(description: string, isMock: boolean): Promise<CreateTaskResponse> {
  if (isMock) {
    const taskId = mockEventSource.dispatchTask(description);
    return {
      task_id: taskId,
      status: 'received',
      description
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn('Backend API unavailable, falling back to mock event source', err);
    const taskId = mockEventSource.dispatchTask(description);
    return {
      task_id: taskId,
      status: 'received (mock fallback)',
      description
    };
  }
}

export async function apiRetryTask(taskId: string, lastSeq: number, isMock: boolean): Promise<void> {
  if (isMock || taskId.startsWith('mock-')) {
    mockEventSource.retryTask(taskId, lastSeq);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Retry returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn('Backend retry endpoint failed, attempting mock retry fallback', err);
    mockEventSource.retryTask(taskId, lastSeq);
  }
}

export async function apiGetTaskDetails(taskId: string): Promise<TaskHistoryResponse | null> {
  if (taskId.startsWith('mock-')) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch task history for re-sync', err);
    return null;
  }
}

export async function apiGetGraphMermaid(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/orchestration/graph`);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
