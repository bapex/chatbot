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
app.use(express.static('public'));

// AssistantServiceのインスタンス化
const assistantService = new AssistantService(process.env.OPENAI_API_KEY!);

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

// SSEを使用したメッセージのストリーミング
app.post('/api/threads/:threadId/messages/stream', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { message } = req.body;

    // SSEヘッダーの設定
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // メッセージの追加
    await assistantService.addMessage(threadId, message);

    // アシスタントの実行（ストリーミングモード）
    await assistantService.runAssistant(threadId, {
      onStart: () => {
        res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      },
      onStatusChange: (status) => {
        res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
      },
      onMessage: (message) => {
        res.write(`data: ${JSON.stringify({ type: 'message', message })}\n\n`);
      },
      onComplete: (run) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', run })}\n\n`);
        res.end();
      },
      onError: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to process message' })}\n\n`);
    res.end();
  }
});

// 通常のメッセージ送信エンドポイント（後方互換性のため）
app.post('/api/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { message } = req.body;

    await assistantService.addMessage(threadId, message);
    const run = await assistantService.runAssistant(threadId);

    const messages = await assistantService.getMessages(threadId);
    res.json(messages);
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