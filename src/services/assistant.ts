import OpenAI from 'openai';
import { AssistantMessage, RunEventCallback, StreamConfig } from '../types/assistant';
import { Message, Run, Thread, Assistant, FileObject } from '../types/openai';
import fs from 'fs';

export class AssistantService {
  private openai: OpenAI;
  private assistantId: string = 'asst_zImRIH5G99dASDFdnAZiigjZ';
  private activeStreams: Map<string, boolean> = new Map();

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async createThread(): Promise<Thread> {
    try {
      return await this.openai.beta.threads.create();
    } catch (error) {
      console.error('Error creating thread:', error);
      throw new Error('スレッドの作成に失敗しました');
    }
  }

  async addMessage(threadId: string, content: string, fileIds?: string[]): Promise<Message> {
    try {
      const messageData: any = {
        role: 'user',
        content
      };

      if (fileIds && fileIds.length > 0) {
        messageData.file_ids = fileIds;
      }

      return await this.openai.beta.threads.messages.create(threadId, messageData);
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error('メッセージの追加に失敗しました');
    }
  }

  async runAssistant(threadId: string, callbacks?: RunEventCallback): Promise<void> {
    try {
      // 既存のストリームがアクティブな場合は待機
      if (this.activeStreams.get(threadId)) {
        await new Promise<void>((resolve) => {
          const checkStream = () => {
            if (!this.activeStreams.get(threadId)) {
              resolve();
            } else {
              setTimeout(checkStream, 100);
            }
          };
          checkStream();
        });
      }

      this.activeStreams.set(threadId, true);
      callbacks?.onStart?.();

      const stream = await this.openai.beta.threads.runs.createAndStream(threadId, {
        assistant_id: this.assistantId
      });

      let accumulatedContent = '';

      stream
        .on('textCreated', () => {
          callbacks?.onMessage?.({
            role: 'assistant',
            content: accumulatedContent
          });
        })
        .on('textDelta', (delta) => {
          if (delta.value) {
            accumulatedContent += delta.value;
            callbacks?.onMessage?.({
              role: 'assistant',
              content: accumulatedContent
            });
          }
        })
        .on('toolCallCreated', (toolCall) => {
          callbacks?.onStatusChange?.('in_progress');
        })
        .on('toolCallDelta', (delta, snapshot) => {
          if (delta.type === 'code_interpreter' && delta.code_interpreter) {
            const interpreter = delta.code_interpreter;
            if (interpreter.outputs) {
              interpreter.outputs.forEach(output => {
                if (output.type === 'logs') {
                  callbacks?.onMessage?.({
                    role: 'assistant',
                    content: `[Code Output] ${output.logs}`
                  });
                }
              });
            }
          }
        })
        .on('error', (error) => {
          console.error('Stream error:', error);
          callbacks?.onError?.(error);
          this.activeStreams.set(threadId, false);
        })
        .on('end', async () => {
          try {
            if (accumulatedContent) {
              callbacks?.onMessage?.({
                role: 'assistant',
                content: accumulatedContent
              });
            }
            callbacks?.onComplete?.();
          } catch (error) {
            console.error('Error in end event:', error);
            callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
          } finally {
            this.activeStreams.set(threadId, false);
          }
        });

      try {
        await stream.done();
      } catch (error) {
        console.error('Stream done error:', error);
        callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
        this.activeStreams.set(threadId, false);
      }
    } catch (error) {
      console.error('RunAssistant error:', error);
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.activeStreams.set(threadId, false);
    }
  }

  async getRunStatus(threadId: string, runId: string): Promise<Run> {
    try {
      return await this.openai.beta.threads.runs.retrieve(threadId, runId);
    } catch (error) {
      console.error('Error getting run status:', error);
      throw new Error('実行状態の取得に失敗しました');
    }
  }

  async getMessages(threadId: string): Promise<AssistantMessage[]> {
    try {
      const messages = await this.openai.beta.threads.messages.list(threadId);
      return messages.data.map(msg => {
        const content = msg.content[0];
        if (content.type !== 'text') {
          throw new Error('サポートされていないメッセージタイプです');
        }
        return {
          role: msg.role,
          content: content.text.value
        };
      });
    } catch (error) {
      console.error('Error getting messages:', error);
      throw new Error('メッセージの取得に失敗しました');
    }
  }

  async uploadFile(filePath: string): Promise<FileObject> {
    try {
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
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('ファイルのアップロードに失敗しました');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.openai.files.del(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('ファイルの削除に失敗しました');
    }
  }

  async downloadFile(fileId: string, outputPath: string): Promise<void> {
    try {
      const response = await this.openai.files.content(fileId);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('ファイルのダウンロードに失敗しました');
    }
  }

  async getRunSteps(threadId: string, runId: string) {
    try {
      return await this.openai.beta.threads.runs.steps.list(threadId, runId);
    } catch (error) {
      console.error('Error getting run steps:', error);
      throw new Error('実行ステップの取得に失敗しました');
    }
  }
}