import OpenAI from 'openai';
import { AssistantMessage, AssistantFile } from '../types/assistant';
import { Message, Run, Thread, Assistant, FileObject } from '../types/openai';

export class AssistantService {
  private openai: OpenAI;
  private assistantId: string | null = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async initializeAssistant(): Promise<Assistant> {
    const assistant = await this.openai.beta.assistants.create({
      name: "AI Assistant",
      description: "ユーザーフレンドリーで効率的なAIアシスタント",
      model: "gpt-4-1106-preview",
      tools: [
        { type: "code_interpreter" },
        { type: "file_search" }
      ]
    });
    this.assistantId = assistant.id;
    return assistant;
  }

  async createThread(): Promise<Thread> {
    return await this.openai.beta.threads.create();
  }

  async addMessage(threadId: string, content: string): Promise<Message> {
    return await this.openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content
    });
  }

  async runAssistant(threadId: string): Promise<Run> {
    if (!this.assistantId) {
      throw new Error('Assistant not initialized');
    }

    return await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: this.assistantId
    });
  }

  async getRunStatus(threadId: string, runId: string): Promise<Run> {
    return await this.openai.beta.threads.runs.retrieve(threadId, runId);
  }

  async getMessages(threadId: string): Promise<AssistantMessage[]> {
    const messages = await this.openai.beta.threads.messages.list(threadId);
    return messages.data.map(msg => {
      const content = msg.content[0];
      if (content.type !== 'text') {
        throw new Error('Unsupported message content type');
      }
      return {
        role: msg.role,
        content: content.text.value
      };
    });
  }

  async uploadFile(filePath: string): Promise<FileObject> {
    return await this.openai.files.create({
      file: await import('fs').then(fs => fs.createReadStream(filePath)),
      purpose: 'assistants'
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.openai.files.del(fileId);
  }

  async waitForRunCompletion(threadId: string, runId: string): Promise<Run> {
    let run = await this.getRunStatus(threadId, runId);

    while (run.status === 'queued' || run.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await this.getRunStatus(threadId, runId);
    }

    return run;
  }
}