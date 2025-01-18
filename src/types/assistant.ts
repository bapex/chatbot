export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  file_ids?: string[];
}

export interface Thread {
  id: string;
  created_at: number;
  metadata?: Record<string, any>;
}

export interface Run {
  id: string;
  thread_id: string;
  assistant_id: string;
  status: 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';
  created_at: number;
  completed_at?: number;
}

export interface AssistantFile {
  id: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: 'assistants';
}