import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { AssistantService } from './services/assistant';

// 環境変数の読み込み
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public')); // 静的ファイルの提供

// AssistantServiceのインスタンス化
const assistantService = new AssistantService(process.env.OPENAI_API_KEY!);

// APIエンドポイント

// アシスタントの初期化
app.post('/api/assistant/init', async (req, res) => {
  try {
    const assistant = await assistantService.initializeAssistant();
    res.json(assistant);
  } catch (error) {
    console.error('Error initializing assistant:', error);
    res.status(500).json({ error: 'Failed to initialize assistant' });
  }
});

// 新しいスレッドの作成
app.post('/api/threads', async (req, res) => {
  try {
    const thread = await assistantService.createThread();
    res.json(thread);
  } catch (error) {
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
    } else {
      throw new Error(`Run failed with status: ${completedRun.status}`);
    }
  } catch (error) {
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
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// メインページのルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// サーバーの起動
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});