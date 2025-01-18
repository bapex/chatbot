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

// タイムアウトの設定
const TIMEOUT = 5 * 60 * 1000; // 5分

// ミドルウェアの設定
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'));

// AssistantServiceのインスタンス化
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEYが設定されていません');
  process.exit(1);
}

const assistantService = new AssistantService(process.env.OPENAI_API_KEY);

// 新しいスレッドの作成
app.post('/api/threads', async (req, res) => {
  try {
    const thread = await assistantService.createThread();
    res.json(thread);
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'スレッドの作成に失敗しました'
    });
  }
});

// メッセージの送信（ストリーミング）
app.post('/api/threads/:threadId/messages', async (req, res) => {
  // タイムアウトの設定
  req.setTimeout(TIMEOUT);
  res.setTimeout(TIMEOUT);

  try {
    const { threadId } = req.params;
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'メッセージが必要です' });
      return;
    }

    // SSEヘッダーの設定
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Nginxのバッファリングを無効化
    });

    // Keep-Alive用のインターバル
    const keepAliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    try {
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
        onComplete: () => {
          clearInterval(keepAliveInterval);
          res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
          res.end();
        },
        onError: (error) => {
          clearInterval(keepAliveInterval);
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'エラーが発生しました'
          })}\n\n`);
          res.end();
        }
      });
    } catch (error) {
      clearInterval(keepAliveInterval);
      console.error('Error in message stream:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'メッセージの処理中にエラーが発生しました'
      })}\n\n`);
      res.end();
    }

    // クライアントが切断した場合の処理
    req.on('close', () => {
      clearInterval(keepAliveInterval);
    });

  } catch (error) {
    console.error('Error in message endpoint:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'メッセージの送信に失敗しました'
    });
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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'メッセージの取得に失敗しました'
    });
  }
});

// メインページのルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// エラーハンドリングミドルウェア
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : '内部サーバーエラー'
  });
});

// サーバーの起動
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});