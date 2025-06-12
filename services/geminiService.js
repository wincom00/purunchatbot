const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️ Gemini API 키가 설정되지 않았습니다.');
            this.enabled = false;
            return;
        }

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: process.env.GEMINI_MODEL || 'gemini-pro' 
        });
        this.enabled = process.env.ENABLE_GEMINI === 'true';
        
        // 푸른투어 전용 시스템 프롬프트
        this.systemPrompt = `
당신은 "푸른투어"의 전문 여행 상담 AI 챗봇입니다.

**브랜드 정체성:**
- 푸른투어는 신뢰할 수 있는 여행 전문 브랜드
- 고객 맞춤형 여행 상품과 서비스 제공
- 친근하면서도 전문적인 상담 서비스

**응답 스타일:**
- 항상 존댓말과 친근한 톤 사용
- 적절한 이모지 활용 (🌏 ✈️ 🏖️ 💰 📞 등)
- 간결하고 명확한 정보 제공
- 고객의 니즈에 따른 맞춤 추천

**주요 업무:**
1. 여행 상품 정보 제공 및 추천
2. 가격, 일정, 포함사항 상세 안내
3. 고객 예산과 선호도 고려한 상담
4. 예약 및 문의 연결 안내

**회사 정보:**
- 상호: 푸른투어
- 전화: 02-1234-5678 (본사), 010-1234-5678 (모바일)
- 이메일: booking@bluetour.com
- 운영시간: 평일 09:00-18:00
- 홈페이지: www.bluetour.com

**응답 가이드라인:**
- 여행 상품이 제공된 경우: 상품 정보를 기반으로 구체적 추천
- 상품이 없는 경우: 일반적인 여행 정보와 연락처 안내
- 예약 문의 시: 반드시 연락처 정보 제공
- 답변 길이: 200-400자 내외로 적절히 조절

제공된 여행 상품 데이터가 있다면 반드시 그 정보를 활용해서 답변하세요.
`;
    }

    async generateTravelResponse(userMessage, tourData = [], context = '') {
        if (!this.enabled) {
            throw new Error('Gemini AI가 비활성화되어 있습니다.');
        }

        try {
            let prompt = this.systemPrompt;
            
            // 여행 상품 데이터가 있는 경우
            if (tourData && tourData.length > 0) {
                prompt += `\n\n**현재 검색된 푸른투어 상품들:**\n`;
                tourData.forEach((tour, index) => {
                    prompt += `${index + 1}. ${tour.name}\n`;
                    prompt += `   📍 목적지: ${tour.destination}\n`;
                    prompt += `   💰 가격: ${tour.price.toLocaleString()}원\n`;
                    prompt += `   📅 기간: ${tour.duration}일\n`;
                    prompt += `   ⭐ 평점: ${tour.rating}/5.0\n`;
                    prompt += `   🪑 잔여석: ${tour.available_seats}석\n`;
                    prompt += `   🏷️ 카테고리: ${tour.category}\n`;
                    if (tour.description) {
                        prompt += `   📝 설명: ${tour.description}\n`;
                    }
                    if (tour.departure_date) {
                        const depDate = new Date(tour.departure_date);
                        prompt += `   🛫 출발일: ${depDate.toLocaleDateString('ko-KR')}\n`;
                    }
                    prompt += `\n`;
                });
            } else {
                prompt += `\n\n**안내:** 현재 고객 문의에 정확히 맞는 상품이 검색되지 않았습니다. 일반적인 여행 상담과 푸른투어 연락처를 안내해주세요.\n`;
            }

            // 이전 대화 컨텍스트 (있는 경우)
            if (context) {
                prompt += `\n**이전 대화:**\n${context}\n`;
            }

            prompt += `\n**고객 문의:** "${userMessage}"\n\n**푸른투어 상담사 답변:**`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return text.trim();

        } catch (error) {
            console.error('Gemini API 호출 오류:', error);
            throw error;
        }
    }

    async analyzeTravelIntent(message) {
        if (!this.enabled) {
            return { intent: 'general', confidence: 0.5 };
        }

        try {
            const prompt = `
다음 고객의 여행 관련 문의를 분석해서 의도를 파악해주세요.

고객 메시지: "${message}"

다음 JSON 형태로만 응답해주세요:
{
  "intent": "destination|price|popular|booking|category|duration|general",
  "entities": {
    "destination": "추출된 목적지명",
    "price_budget": "추출된 예산 금액",
    "price_type": "under|over",
    "category": "국내|해외|크루즈|패키지",
    "duration": "일수"
  },
  "confidence": 0.0~1.0,
  "summary": "의도 요약"
}

의도 분류:
- destination: 특정 지역/국가 여행 문의
- price: 예산/가격대별 여행 상품 문의
- popular: 인기/추천 여행 상품 문의
- booking: 예약/상담 관련 문의
- category: 여행 유형별 문의 (국내/해외 등)
- duration: 여행 기간별 문의
- general: 일반적인 여행 질문
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            try {
                // JSON 부분만 추출
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('JSON 형태가 아님');
                }
            } catch (parseError) {
                console.warn('의도 분석 JSON 파싱 실패:', parseError);
                return {
                    intent: 'general',
                    entities: {},
                    confidence: 0.3,
                    summary: '분석 실패'
                };
            }

        } catch (error) {
            console.error('Gemini 의도 분석 오류:', error);
            return {
                intent: 'general',
                entities: {},
                confidence: 0.0,
                summary: 'API 오류'
            };
        }
    }

    isEnabled() {
        return this.enabled;
    }
}

module.exports = GeminiService;