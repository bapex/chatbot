class ChatBot {
    constructor() {
        this.threadId = null;
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');

        this.initialize();
        this.setupEventListeners();
    }

    async initialize() {
        try {
            // アシスタントの初期化
            await fetch('/api/assistant/init', { method: 'POST' });

            // スレッドの作成
            const response = await fetch('/api/threads', { method: 'POST' });
            const thread = await response.json();
            this.threadId = thread.id;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('チャットの初期化に失敗しました');
        }
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.threadId) return;

        try {
            this.messageInput.value = '';
            this.messageInput.disabled = true;
            this.sendButton.disabled = true;

            // ユーザーメッセージの表示
            this.addMessage(message, 'user');

            // ローディングインジケータの表示
            const loadingElement = this.showLoading();

            // メッセージの送信
            const response = await fetch(`/api/threads/${this.threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('メッセージの送信に失敗しました');
            }

            // レスポンスの処理
            const messages = await response.json();

            // ローディングインジケータの削除
            loadingElement.remove();

            // 最新のアシスタントメッセージを表示
            const assistantMessage = messages.find(msg => msg.role === 'assistant');
            if (assistantMessage) {
                this.addMessage(assistantMessage.content, 'assistant');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('メッセージの送信に失敗しました');
        } finally {
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    addMessage(content, role) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        messageElement.textContent = content;
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    showLoading() {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.innerHTML = `
            応答を生成中
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        this.chatMessages.appendChild(loadingElement);
        this.scrollToBottom();
        return loadingElement;
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'message error';
        errorElement.textContent = message;
        this.chatMessages.appendChild(errorElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// チャットボットのインスタンス化
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});