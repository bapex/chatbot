import OpenAI from 'openai';
import { AssistantMessage, RunEventCallback, StreamConfig } from '../types/assistant';
import { Message, Run, Thread, Assistant, FileObject } from '../types/openai';
import fs from 'fs';

export class AssistantService {
  private openai: OpenAI;
  private assistantId: string = 'asst_zImRIH5G99dASDFdnAZiigjZ';
  private defaultStreamConfig: StreamConfig = {
    pollInterval: 1000,
    maxRetries: 10
  };

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async createThread(): Promise<Thread> {
    return await this.openai.beta.threads.create();
  }

  async addMessage(threadId: string, content: string, fileIds?: string[]): Promise<Message> {
    const messageData: any = {
      role: 'user',
      content
    };

    if (fileIds && fileIds.length > 0) {
      messageData.file_ids = fileIds;
    }

    return await this.openai.beta.threads.messages.create(threadId, messageData);
  }

  async runAssistant(threadId: string, callbacks?: RunEventCallback, config?: StreamConfig): Promise<Run> {
    const streamConfig = { ...this.defaultStreamConfig, ...config };

    try {
      callbacks?.onStart?.();

      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: this.assistantId
      });

      this.streamRunStatus(threadId, run.id, callbacks, streamConfig);
      return run;
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async streamRunStatus(
    threadId: string,
    runId: string,
    callbacks?: RunEventCallback,
    config?: StreamConfig
  ): Promise<void> {
    let retryCount = 0;
    let lastMessageCount = 0;

    const checkStatus = async () => {
      try {
        const run = await this.getRunStatus(threadId, runId);
        callbacks?.onStatusChange?.(run.status);

        if (run.status === 'completed') {
          const messages = await this.getMessages(threadId);
          if (messages.length > lastMessageCount) {
            const newMessages = messages.slice(lastMessageCount);
            for (const message of newMessages) {
              callbacks?.onMessage?.(message);
            }
            lastMessageCount = messages.length;
          }
          callbacks?.onComplete?.(run);
          return true;
        }

        if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
          const error = new Error(`Run ${run.status}: ${(run as any).last_error?.message || 'Unknown error'}`);
          callbacks?.onError?.(error);
          return true;
        }

        if (run.status === 'requires_action') {
          // 将来的なツール呼び出しのサポートのために予約
          return false;
        }

        return false;
      } catch (error) {
        retryCount++;
        if (retryCount >= (config?.maxRetries || 10)) {
          callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
          return true;
        }
        return false;
      }
    };

    while (!(await checkStatus())) {
      await new Promise(resolve => setTimeout(resolve, config?.pollInterval || 1000));
    }
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
    const file = await this.openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'assistants'
    });

    await this.openai.beta.assistants.update(this.assistantId, {
      tools: [{ type: "code_interpreter" }],
      tool_resources: {
        code_interpreter: {
          file_ids: [file.id]
        }
      }
    });

    return file;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.openai.files.del(fileId);
  }

  async downloadFile(fileId: string, outputPath: string): Promise<void> {
    const response = await this.openai.files.content(fileId);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
  }

  async getRunSteps(threadId: string, runId: string) {
    return await this.openai.beta.threads.runs.steps.list(threadId, runId);
  }
}