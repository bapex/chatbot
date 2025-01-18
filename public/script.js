class ChatBot {
    constructor() {
        this.threadId = null;
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.currentAssistantMessage = null;
        this.accumulatedContent = '';
        this.messageHistory = [];
        this.isGenerating = false;
        this.retryCount = 0;
        this.maxRetries = 3;

        this.initialize();
        this.setupEventListeners();
    }

    async initialize() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/threads`, { method: 'POST' });
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

            // ユーザーメッセージを追加
            this.addMessage(message, 'user');
            this.messageHistory.push({ role: 'user', content: message });

            // 新しい会話を開始する前に、前の会話が完了していない場合は保持
            if (!this.isGenerating) {
                this.currentAssistantMessage = null;
                this.accumulatedContent = '';
            }

            await this.streamMessage(message);
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('メッセージの送信に失敗しました');
        } finally {
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    async streamMessage(message, isRetry = false) {
        try {
            this.isGenerating = true;
            const response = await fetch(`${this.apiBaseUrl}/threads/${this.threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('メッセージの送信に失敗しました');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith(': keepalive')) continue;
                    if (line.trim() && line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            this.handleStreamEvent(data);
                        } catch (error) {
                            console.error('Error parsing SSE data:', error, line);
                        }
                    }
                }
            }

            this.retryCount = 0;
        } catch (error) {
            console.error('Stream error:', error);
            if (!isRetry && this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`Retrying... (${this.retryCount}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
                await this.streamMessage(message, true);
            } else {
                this.showError('接続が切断されました');
            }
        } finally {
            this.isGenerating = false;
        }
    }

    handleStreamEvent(data) {
        switch (data.type) {
            case 'start':
                if (!this.isGenerating) {
                    this.showLoading();
                }
                break;
            case 'message':
                if (data.message.role === 'assistant') {
                    this.accumulatedContent = data.message.content;
                    this.updateAssistantMessage(this.accumulatedContent);
                }
                break;
            case 'error':
                this.showError(data.error);
                break;
            case 'complete':
                if (this.currentAssistantMessage) {
                    this.currentAssistantMessage.classList.remove('typing');
                    this.messageHistory.push({
                        role: 'assistant',
                        content: this.accumulatedContent
                    });
                }
                const loadingElement = document.querySelector('.loading');
                if (loadingElement) {
                    loadingElement.remove();
                }
                break;
        }
    }

    updateAssistantMessage(content) {
        if (!this.currentAssistantMessage) {
            this.currentAssistantMessage = document.createElement('div');
            this.currentAssistantMessage.className = 'message assistant typing';
            this.chatMessages.appendChild(this.currentAssistantMessage);
        }
        this.currentAssistantMessage.textContent = content;
        this.scrollToBottom();
    }

    addMessage(content, role) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        messageElement.textContent = content;
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    showLoading() {
        const existingLoading = document.querySelector('.loading');
        if (existingLoading) return;

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
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'message error';
        errorElement.textContent = message;
        this.chatMessages.appendChild(errorElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});