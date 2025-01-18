# AI Assistant Chat

OpenAI Assistants APIを使用したストリーミングチャットアプリケーション。

## 機能

- リアルタイムストリーミングレスポンス
- 会話の継続性維持
- エラー時の自動再接続
- マークダウン形式のメッセージ表示
- コードブロックのシンタックスハイライト
- レスポンシブデザイン

## 必要要件

- Node.js 18以上
- OpenAI API Key

## セットアップ

1. リポジトリのクローン
```bash
git clone [repository-url]
cd chatbot
```

2. 依存関係のインストール
```bash
npm install
```

3. 環境変数の設定
```bash
cp .env.example .env
```

`.env`ファイルを編集し、必要な環境変数を設定：
```
OPENAI_API_KEY=your_api_key_here
PORT=3000
```

4. アプリケーションの起動
```bash
# 開発モード
npm run dev

# プロダクションモード
npm run build
npm start
```

## 使用方法

1. ブラウザで`http://localhost:3000`を開く
2. メッセージを入力して送信
3. アシスタントからのリアルタイムレスポンスを受信

## 主な機能の説明

### ストリーミングレスポンス
- リアルタイムでメッセージを表示
- タイピングインジケーターによる応答状態の表示
- 会話の継続性を維持

### エラーハンドリング
- 接続切断時の自動再接続
- タイムアウト処理
- エラーメッセージの表示

### UI/UX
- レスポンシブデザイン
- マークダウン形式のメッセージ表示
- コードブロックのシンタックスハイライト
- スムーズなスクロール

## 開発者向け情報

### プロジェクト構成
```
chatbot/
├── public/          # 静的ファイル
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── src/            # ソースコード
│   ├── index.ts    # サーバーエントリーポイント
│   ├── services/   # サービス層
│   └── types/      # 型定義
└── package.json
```

### 主要な技術スタック
- Express.js - Webサーバー
- OpenAI Assistants API - AI機能
- TypeScript - 型安全な開発
- Server-Sent Events - ストリーミング通信

### デバッグ
開発モードでは、詳細なログが表示されます：
```bash
npm run dev
```

### テスト
```bash
npm test
```

## 注意事項

- OpenAI APIの利用料金が発生する可能性があります
- 長時間の会話でメモリ使用量が増加する可能性があります
- プロダクション環境では適切なセキュリティ対策を実施してください

## ライセンス

MIT License