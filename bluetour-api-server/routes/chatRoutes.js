const express = require('express');
const router = express.Router();
const Tour = require('../models/Tour');
const Booking = require('../models/Booking');
const GeminiService = require('../services/geminiService');
const { Op } = require('sequelize');

const geminiService = new GeminiService();

// 사용자별 대화 컨텍스트 저장
const conversationHistory = new Map();

// 챗봇 메시지 처리 (Gemini AI 통합)
router.post('/message', async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        console.log(`[푸른투어 챗봇] 사용자 ${userId}: ${message}`);

        // 사용자 대화 기록 가져오기
        const userHistory = conversationHistory.get(userId) || [];
        
        // 1단계: Gemini로 사용자 의도 분석
        const intentAnalysis = await geminiService.analyzeUserIntent(message);
        console.log('의도 분석 결과:', intentAnalysis);

        // 2단계: 의도에 따른 DB 검색
        let tourData = [];
        let searchPerformed = false;

        switch (intentAnalysis.intent) {
            case 'destination':
                tourData = await searchByDestination(intentAnalysis.entities.destination || message);
                searchPerformed = true;
                break;
            
            case 'price':
                tourData = await searchByPrice(intentAnalysis.entities.price_range || message);
                searchPerformed = true;
                break;
            
            case 'category':
                tourData = await searchByCategory(intentAnalysis.entities.category || message);
                searchPerformed = true;
                break;
            
            case 'popular':
                tourData = await getPopularTours();
                searchPerformed = true;
                break;
            
            case 'booking':
                // 예약 관련은 DB 검색 없이 Gemini가 응답
                break;
            
            default:
                // 일반적인 질문은 전체 상품 중 일부를 컨텍스트로 제공
                tourData = await getRecentTours(3);
                break;
        }

        // 3단계: Gemini로 응답 생성
        const context = userHistory.slice(-3).map(h => `사용자: ${h.user}\n챗봇: ${h.bot}`).join('\n');
        const aiResponse = await geminiService.generateResponse(message, tourData, context);

        // 4단계: 대화 기록 저장
        userHistory.push({
            user: message,
            bot: aiResponse,
            timestamp: new Date(),
            intent: intentAnalysis.intent,
            searchPerformed: searchPerformed,
            tourCount: tourData.length
        });

        // 최근 10개 대화만 유지
        if (userHistory.length > 10) {
            userHistory.splice(0, userHistory.length - 10);
        }
        conversationHistory.set(userId, userHistory);

        res.json({
            success: true,
            response: aiResponse,
            timestamp: new Date().toISOString(),
            intent: intentAnalysis.intent,
            tourDataCount: tourData.length,
            metadata: {
                searchPerformed: searchPerformed,
                confidence: intentAnalysis.confidence
            }
        });

    } catch (error) {
        console.error('챗봇 처리 오류:', error);
        
        // Gemini API 오류시 폴백 응답
        const fallbackResponse = getFallbackResponse();
        
        res.status(500).json({ 
            success: false,
            error: '챗봇 처리 중 오류가 발생했습니다.',
            response: fallbackResponse,
            fallback: true
        });
    }
});

// 대화 기록 조회 API
router.get('/history/:userId', (req, res) => {
    const { userId } = req.params;
    const history = conversationHistory.get(userId) || [];
    
    res.json({
        success: true,
        history: history,
        count: history.length
    });
});

// 대화 기록 초기화 API
router.delete('/history/:userId', (req, res) => {
    const { userId } = req.params;
    conversationHistory.delete(userId);
    
    res.json({
        success: true,
        message: '대화 기록이 초기화되었습니다.'
    });
});

// === DB 검색 함수들 ===

async function searchByDestination(query) {
    try {
        const tours = await Tour.findAll({
            where: {
                [Op.or]: [
                    { destination: { [Op.like]: `%${query}%` } },
                    { name: { [Op.like]: `%${query}%` } }
                ],
                is_active: true
            },
            limit: 5,
            order: [['rating', 'DESC'], ['price', 'ASC']]
        });
        
        return tours;
    } catch (error) {
        console.error('목적지 검색 오류:', error);
        return [];
    }
}

async function searchByPrice(query) {
    try {
        const priceMatch = query.match(/(\d+)만원?/);
        if (!priceMatch) return [];

        const budget = parseInt(priceMatch[1]) * 10000;
        const isUnder = /이하|미만|아래|까지/.test(query);

        const tours = await Tour.findAll({
            where: {
                price: isUnder ? { [Op.lte]: budget } : { [Op.gte]: budget },
                is_active: true
            },
            limit: 5,
            order: [['rating', 'DESC']]
        });

        return tours;
    } catch (error) {
        console.error('가격 검색 오류:', error);
        return [];
    }
}

async function searchByCategory(query) {
    try {
        let category = '';
        if (/국내/i.test(query)) category = '국내';
        else if (/해외/i.test(query)) category = '해외';
        else if (/크루즈/i.test(query)) category = '크루즈';
        else if (/패키지/i.test(query)) category = '패키지';

        if (!category) return [];

        const tours = await Tour.findAll({
            where: {
                category: category,
                is_active: true
            },
            order: [['rating', 'DESC']],
            limit: 5
        });

        return tours;
    } catch (error) {
        console.error('카테고리 검색 오류:', error);
        return [];
    }
}

async function getPopularTours() {
    try {
        const tours = await Tour.findAll({
            where: { is_active: true },
            order: [['rating', 'DESC'], ['available_seats', 'DESC']],
            limit: 5
        });

        return tours;
    } catch (error) {
        console.error('인기 상품 조회 오류:', error);
        return [];
    }
}

async function getRecentTours(limit = 3) {
    try {
        const tours = await Tour.findAll({
            where: { is_active: true },
            order: [['createdAt', 'DESC']],
            limit: limit
        });

        return tours;
    } catch (error) {
        console.error('최신 상품 조회 오류:', error);
        return [];
    }
}

// Gemini API 실패시 폴백 응답
function getFallbackResponse() {
    const responses = [
        '죄송합니다. 일시적인 시스템 오류가 발생했습니다. 🙏',
        '',
        '📞 직접 상담: 02-1234-5678',
        '📧 이메일: booking@bluetour.com',
        '🕐 운영시간: 평일 09:00-18:00',
        '',
        '빠른 시일 내에 정상 서비스로 복구하겠습니다.'
    ];
    
    return responses.join('\n');
}

module.exports = router;