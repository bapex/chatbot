import { Run } from './openai';

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

export interface AssistantFile {
  id: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: 'assistants';
}

export interface RunEventCallback {
  onStart?: () => void;
  onMessage?: (message: AssistantMessage) => void;
  onStatusChange?: (status: Run['status']) => void;
  onComplete?: (run: Run) => void;
  onError?: (error: Error) => void;
}

export interface StreamConfig {
  pollInterval?: number;
  maxRetries?: number;
}