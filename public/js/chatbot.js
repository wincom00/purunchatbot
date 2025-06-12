const socket = io();

const messagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');

let widgetConfig = {
    title: '푸른투어 챗봇',
    theme: 'blue',
    maxMessageLength: 500,
    welcomeMessage: '푸른투어 챗봇에 오신 것을 환영합니다!'
};

let isTyping = false;
let typingTimeout;
let messageCount = 0;

// 서버에서 설정 가져오기
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        widgetConfig = await response.json();
        
        // UI에 설정 적용
        document.title = widgetConfig.title;
        const headerTitle = document.getElementById('chat-title');
        if (headerTitle) {
            headerTitle.textContent = widgetConfig.title;
        }
        
        messageInput.placeholder = `여행 관련 질문을 입력하세요... (최대 ${widgetConfig.maxMessageLength}자)`;
        messageInput.maxLength = widgetConfig.maxMessageLength;
        
        // 테마 적용
        document.body.className = `theme-${widgetConfig.theme}`;
        
    } catch (error) {
        console.error('설정 로드 실패:', error);
    }
}

// AI 상태 확인
async function checkAIStatus() {
    try {
        const response = await fetch('/api/ai-status');
        const status = await response.json();
        
        if (status.geminiEnabled) {
            console.log('🤖 Gemini AI 활성화됨');
            document.body.classList.add('ai-enabled');
        } else {
            console.log('🤖 기본 패턴 모드');
        }
    } catch (error) {
        console.warn('AI 상태 확인 실패:', error);
    }
}

// 메시지 추가 함수 (타이핑 효과 포함)
function addMessage(message, isUser = false, messageType = 'normal') {
    messageCount++;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.setAttribute('data-message-id', messageCount);
    
    if (messageType === 'welcome') {
        messageDiv.classList.add('welcome-message');
    }
    
    // 타임스탬프 생성
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (!isUser && messageType !== 'welcome') {
        // 봇 메시지에 타이핑 효과
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
        
        // 실제 메시지로 교체
        setTimeout(() => {
            messageDiv.innerHTML = `
                <div class="message-content">${formatMessage(message)}</div>
                <div class="message-time">${timestamp}</div>
            `;
        }, 1000 + Math.random() * 500);
    } else {
        // 사용자 메시지 또는 환영 메시지
        messageDiv.innerHTML = `
            <div class="message-content">${formatMessage(message)}</div>
            <div class="message-time">${timestamp}</div>
        `;
        messagesContainer.appendChild(messageDiv);
    }
    
    scrollToBottom();
    return messageDiv;
}

// 메시지 포맷팅 (줄바꿈, 링크 등 처리)
function formatMessage(message) {
    return message
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// 스크롤을 아래로
function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

// 메시지 전송
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // 메시지 길이 검증
    if (message.length > widgetConfig.maxMessageLength) {
        showError(`메시지가 너무 깁니다. 최대 ${widgetConfig.maxMessageLength}자까지 입력 가능합니다.`);
        return;
    }
    
    // 사용자 메시지 표시
    addMessage(message, true);
    
    // 서버로 메시지 전송
    socket.emit('message', { 
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // 입력창 초기화
    messageInput.value = '';
    updateSendButton();
    
    // 전송 버튼 일시적으로 비활성화
    sendButton.disabled = true;
    setTimeout(() => {
        sendButton.disabled = false;
        updateSendButton();
    }, 1500);
}

// 에러 메시지 표시
function showError(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="message-content">${errorMessage}</div>
    `;
    messagesContainer.appendChild(errorDiv);
    scrollToBottom();
    
    // 5초 후 에러 메시지 제거
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// 전송 버튼 상태 업데이트
function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasText || !socket.connected;
}

// 타이핑 상태 처리
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', { isTyping: true });
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('typing', { isTyping: false });
    }, 1000);
}

// 연결 상태 업데이트
function updateConnectionStatus(connected) {
    if (connected) {
        document.body.classList.add('connected');
        console.log('✅ 서버에 연결되었습니다');
} else {
document.body.classList.remove('connected');
console.log('❌ 서버 연결이 끊어졌습니다');
}
updateSendButton();
}
// 이벤트 리스너 설정
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
sendMessage();
} else {
handleTyping();
}
});
messageInput.addEventListener('input', () => {
updateSendButton();
handleTyping();
});
// 페이지 가시성 변경 감지
document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'visible') {
// 페이지가 다시 보일 때 연결 상태 확인
if (!socket.connected) {
socket.connect();
}
}
});
// Socket 이벤트 처리
socket.on('response', (data) => {
console.log('서버 응답:', data);
addMessage(data.message, false, data.type);
});
socket.on('error', (data) => {
console.error('서버 오류:', data);
showError(data.message);
});
socket.on('connect', () => {
console.log('🔗 서버에 연결되었습니다');
updateConnectionStatus(true);
});
socket.on('disconnect', (reason) => {
console.log('💔 서버와 연결이 끊어졌습니다:', reason);
updateConnectionStatus(false);
if (reason === 'io server disconnect') {
    // 서버에서 연결을 끊은 경우 자동 재연결 시도
    showError('서버와 연결이 끊어졌습니다. 재연결을 시도합니다...');
}
});
socket.on('connect_error', (error) => {
console.error('연결 오류:', error);
updateConnectionStatus(false);
showError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
});
socket.on('reconnect', (attemptNumber) => {

updateConnectionStatus(true);
});
socket.on('reconnect_attempt', (attemptNumber) => {
});
socket.on('reconnect_failed', () => {
console.error('❌ 재연결 실패');
showError('서버에 재연결할 수 없습니다. 페이지를 새로고침해주세요.');
});
// 페이지 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
console.log('📱 푸른투어 챗봇 위젯 초기화 중...');
// 설정 로드
await loadConfig();

// AI 상태 확인
await checkAIStatus();

// 초기 UI 상태 설정
updateSendButton();

// 입력창에 포커스
messageInput.focus();

console.log('✅ 챗봇 위젯 초기화 완료');
});
// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
if (socket.connected) {
socket.disconnect();
}
});
// 개발 모드에서 디버그 정보 표시
if (window.location.hostname === 'localhost') {
console.log('🔧 개발 모드 활성화');
// 디버그 명령어들
window.chatbotDebug = {
    getConfig: () => widgetConfig,
    getMessageCount: () => messageCount,
    clearMessages: () => {
        messagesContainer.innerHTML = '';
        messageCount = 0;
    },
    simulateError: (message) => showError(message || '테스트 오류 메시지'),
    getConnectionStatus: () => socket.connected,
    reconnect: () => socket.connect()
};

console.log('💡 디버그 명령어: window.chatbotDebug');
}