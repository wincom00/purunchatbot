require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// 데이터베이스 및 컨트롤러
const { sequelize, testConnection } = require('./config/database');
const BlueTourChatController = require('./src/controllers/bluetourChatController');

const app = express();
const server = http.createServer(app);
const chatController = new BlueTourChatController();

// 환경변수에서 값 가져오기
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ["*"];

console.log(`🌍 환경: ${NODE_ENV}`);
console.log(`🔗 CORS 허용 도메인:`, CORS_ORIGIN);

// 데이터베이스 연결 테스트
testConnection();

// Socket.io 설정
const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// 미들웨어
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static('public'));

// 사용자 세션 관리
const connectedUsers = new Map();

// 기본 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 위젯 설정 API
app.get('/api/config', (req, res) => {
  res.json({
    title: process.env.WIDGET_TITLE || '푸른투어 챗봇',
    theme: process.env.WIDGET_THEME || 'blue',
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 500,
    welcomeMessage: `${process.env.WIDGET_TITLE || '푸른투어 챗봇'}에 오신 것을 환영합니다! 🌏✈️`
  });
});

// AI 상태 확인 API
app.get('/api/ai-status', (req, res) => {
  res.json({
    geminiEnabled: process.env.GEMINI_API_KEY && process.env.ENABLE_GEMINI === 'true',
    model: process.env.GEMINI_MODEL || 'gemini-pro',
    timestamp: new Date().toISOString()
  });
});

// 통계 API
app.get('/api/stats', (req, res) => {
  res.json({
    connectedUsers: connectedUsers.size,
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: '푸른투어',
    aiEnabled: process.env.GEMINI_API_KEY && process.env.ENABLE_GEMINI === 'true'
  });
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
  const userId = socket.id;
  connectedUsers.set(userId, {
    id: userId,
    connectedAt: new Date(),
    messageCount: 0
  });

  if (NODE_ENV === 'development') {
    console.log(`🔗 푸른투어 고객 연결: ${userId} (총 ${connectedUsers.size}명)`);
  }

  // 환영 메시지 전송
  socket.emit('response', {
    message: `${process.env.WIDGET_TITLE || '푸른투어 챗봇'}에 오신 것을 환영합니다! 🌏✈️\n\n어떤 여행을 계획하고 계신가요?\n• 여행지 검색 (예: "제주도 여행")\n• 예산별 상품 (예: "50만원 이하")\n• 인기 상품 (예: "인기 여행")\n• 예약 문의 (예: "예약하기")`,
    timestamp: new Date(),
    type: 'welcome'
  });

  // 메시지 처리
  socket.on('message', async (data) => {
    const user = connectedUsers.get(userId);
    if (!user) return;

    user.messageCount++;

    if (NODE_ENV === 'development') {
      console.log(`📨 [푸른투어 고객-${userId}] 문의:`, data.message);
    }

    // 메시지 길이 검증
    const maxLength = parseInt(process.env.MAX_MESSAGE_LENGTH) || 500;
    if (data.message && data.message.length > maxLength) {
      socket.emit('error', {
        message: `메시지가 너무 깁니다. 최대 ${maxLength}자까지 입력 가능합니다.`,
        timestamp: new Date()
      });
      return;
    }

    // 빈 메시지 확인
    if (!data.message || data.message.trim().length === 0) {
      socket.emit('error', {
        message: '문의 내용을 입력해주세요.',
        timestamp: new Date()
      });
      return;
    }

    try {
      // 푸른투어 챗봇 응답 생성 (패턴 + Gemini AI)
      //onst botResponse = await chatController.processMessage(data.message);
      const botResponse = await chatController.processMessage(userId, data.message);
      // 응답 전송 (타이핑 효과)
      setTimeout(() => {
        socket.emit('response', {
          message: botResponse,
          timestamp: new Date(),
          type: 'bluetour',
          userMessageCount: user.messageCount
        });
      }, 800 + Math.random() * 700);

    } catch (error) {
      console.error('챗봇 응답 생성 오류:', error);
      socket.emit('error', {
        message: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date()
      });
    }
  });

  // 연결 해제 처리
  socket.on('disconnect', () => {
    const user = connectedUsers.get(userId);
    if (user && NODE_ENV === 'development') {
      console.log(`❌ 푸른투어 고객 연결 해제: ${userId} (메시지 ${user.messageCount}개)`);
    }
    connectedUsers.delete(userId);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 푸른투어 챗봇이 http://localhost:${PORT}에서 실행중입니다`);
  console.log(`📱 위젯 제목: ${process.env.WIDGET_TITLE || '푸른투어 챗봇'}`);
  console.log(`🎨 테마: ${process.env.WIDGET_THEME || 'blue'}`);
  console.log(`📊 통계 확인: http://localhost:${PORT}/api/stats`);
  
  // Gemini AI 상태 표시
  if (process.env.GEMINI_API_KEY && process.env.ENABLE_GEMINI === 'true') {
    console.log(`🤖 Gemini AI: 활성화 (${process.env.GEMINI_MODEL || 'gemini-pro'})`);
  } else {
    console.log(`🤖 Gemini AI: 비활성화 (기본 패턴 모드)`);
  }
});

// 에러 핸들링
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});