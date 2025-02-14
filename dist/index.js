"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const assistant_1 = require("./services/assistant");
// 環境変数の読み込み
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// ミドルウェアの設定
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// AssistantServiceのインスタンス化
const assistantService = new assistant_1.AssistantService(process.env.OPENAI_API_KEY);
// APIエンドポイント
// アシスタントの初期化
app.post('/api/assistant/init', async (req, res) => {
    try {
        const assistant = await assistantService.initializeAssistant();
        res.json(assistant);
    }
    catch (error) {
        console.error('Error initializing assistant:', error);
        res.status(500).json({ error: 'Failed to initialize assistant' });
    }
});
// 新しいスレッドの作成
app.post('/api/threads', async (req, res) => {
    try {
        const thread = await assistantService.createThread();
        res.json(thread);
    }
    catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).json({ error: 'Failed to create thread' });
    }
});
// メッセージの送信と応答の取得
app.post('/api/threads/:threadId/messages', async (req, res) => {
    try {
        const { threadId } = req.params;
        const { message } = req.body;
        // メッセージの追加
        await assistantService.addMessage(threadId, message);
        // アシスタントの実行
        const run = await assistantService.runAssistant(threadId);
        // 実行完了を待機
        const completedRun = await assistantService.waitForRunCompletion(threadId, run.id);
        if (completedRun.status === 'completed') {
            // メッセージの取得
            const messages = await assistantService.getMessages(threadId);
            res.json(messages);
        }
        else {
            throw new Error(`Run failed with status: ${completedRun.status}`);
        }
    }
    catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});
// スレッドのメッセージ履歴の取得
app.get('/api/threads/:threadId/messages', async (req, res) => {
    try {
        const { threadId } = req.params;
        const messages = await assistantService.getMessages(threadId);
        res.json(messages);
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
// ファイルのアップロード
app.post('/api/files', async (req, res) => {
    try {
        const { filePath } = req.body;
        const file = await assistantService.uploadFile(filePath);
        res.json(file);
    }
    catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});
// サーバーの起動
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
