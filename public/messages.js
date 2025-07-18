class MessagesView {
    constructor() {
        this.playerId = this.getPlayerIdFromUrl();
        this.token = localStorage.getItem('token');
        this.init();
    }

    getPlayerIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async init() {
        if (!this.playerId) {
            alert('No player ID provided');
            window.close();
            return;
        }

        if (!this.token) {
            alert('Please login first');
            window.close();
            return;
        }

        try {
            await this.loadPlayerInfo();
            await this.loadMessages();
        } catch (error) {
            console.error('Error loading messages:', error);
            alert('Error loading messages');
        }
    }

    async loadPlayerInfo() {
        try {
            const response = await fetch(`/api/players/${this.playerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const player = await response.json();
                document.getElementById('player-name').textContent = player.personalInfo?.fullName || 'Unknown Player';
            }
        } catch (error) {
            console.error('Error loading player info:', error);
        }
    }

    async loadMessages() {
        try {
            const response = await fetch(`/api/players/${this.playerId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const messages = await response.json();
                this.displayMessages(messages);
                this.updateStats(messages);
            } else {
                throw new Error('Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('no-messages').style.display = 'block';
        }
    }

    displayMessages(messages) {
        const loadingDiv = document.getElementById('loading');
        const noMessagesDiv = document.getElementById('no-messages');
        const messagesListDiv = document.getElementById('messages-list');

        loadingDiv.style.display = 'none';

        if (messages.length === 0) {
            noMessagesDiv.style.display = 'block';
            return;
        }

        messagesListDiv.innerHTML = '';

        messages.forEach(message => {
            const messageCard = this.createMessageCard(message);
            messagesListDiv.appendChild(messageCard);
        });
    }

    createMessageCard(message) {
        const card = document.createElement('div');
        card.className = `message-card ${message.read ? '' : 'unread'}`;
        card.dataset.messageId = message.id;

        const phoneDisplay = message.sender_phone ? 
            `<br>Phone: ${message.sender_phone}` : '';

        card.innerHTML = `
            <div class="message-header">
                <div class="sender-info">
                    <div class="sender-name">${this.escapeHtml(message.sender_name)}</div>
                    <div class="sender-contact">
                        Email: ${this.escapeHtml(message.sender_email)}${phoneDisplay}
                    </div>
                </div>
                <div class="message-date">
                    ${this.formatDate(message.created_at)}
                    ${message.read ? '' : '<br><strong>UNREAD</strong>'}
                </div>
            </div>
            <div class="message-content">
                ${this.escapeHtml(message.message).replace(/\n/g, '<br>')}
            </div>
            <div class="message-actions">
                ${message.read ? 
                    '<span style="color: #27ae60; font-size: 0.85rem;">✓ Read</span>' : 
                    `<button class="mark-read-btn" onclick="messagesView.markAsRead(${message.id})">Mark as Read</button>`
                }
            </div>
        `;

        return card;
    }

    async markAsRead(messageId) {
        try {
            const response = await fetch(`/api/messages/${messageId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                // Update the UI
                const card = document.querySelector(`[data-message-id="${messageId}"]`);
                card.classList.remove('unread');
                
                const actionsDiv = card.querySelector('.message-actions');
                actionsDiv.innerHTML = '<span style="color: #27ae60; font-size: 0.85rem;">✓ Read</span>';
                
                const dateDiv = card.querySelector('.message-date');
                dateDiv.innerHTML = dateDiv.innerHTML.replace('<br><strong>UNREAD</strong>', '');
                
                // Reload messages to update stats
                await this.loadMessages();
            } else {
                alert('Failed to mark message as read');
            }
        } catch (error) {
            console.error('Error marking message as read:', error);
            alert('Failed to mark message as read');
        }
    }

    updateStats(messages) {
        const statsContainer = document.getElementById('stats-container');
        const totalMessages = messages.length;
        const unreadMessages = messages.filter(m => !m.read).length;
        const readMessages = totalMessages - unreadMessages;

        document.getElementById('total-messages').textContent = totalMessages;
        document.getElementById('unread-messages').textContent = unreadMessages;
        document.getElementById('read-messages').textContent = readMessages;

        if (totalMessages > 0) {
            statsContainer.style.display = 'flex';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const messagesView = new MessagesView();