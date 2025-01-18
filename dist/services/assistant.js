"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantService = void 0;
const openai_1 = __importDefault(require("openai"));
class AssistantService {
    constructor(apiKey) {
        this.assistantId = null;
        this.openai = new openai_1.default({ apiKey });
    }
    async initializeAssistant() {
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
    async createThread() {
        return await this.openai.beta.threads.create();
    }
    async addMessage(threadId, content) {
        return await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content
        });
    }
    async runAssistant(threadId) {
        if (!this.assistantId) {
            throw new Error('Assistant not initialized');
        }
        return await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: this.assistantId
        });
    }
    async getRunStatus(threadId, runId) {
        return await this.openai.beta.threads.runs.retrieve(threadId, runId);
    }
    async getMessages(threadId) {
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
    async uploadFile(filePath) {
        return await this.openai.files.create({
            file: await import('fs').then(fs => fs.createReadStream(filePath)),
            purpose: 'assistants'
        });
    }
    async deleteFile(fileId) {
        await this.openai.files.del(fileId);
    }
    async waitForRunCompletion(threadId, runId) {
        let run = await this.getRunStatus(threadId, runId);
        while (run.status === 'queued' || run.status === 'in_progress') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            run = await this.getRunStatus(threadId, runId);
        }
        return run;
    }
}
exports.AssistantService = AssistantService;
