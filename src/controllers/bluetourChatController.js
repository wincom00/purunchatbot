const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class BlueTourChatController {
    constructor() {
        this.conversationState = new Map();
        this.initializeGemini();
        // this.initializeOllama(); // 새로 추가
        // p_week 코드 매핑 (0~9)
        this.weekDays = {
            0: '월요일',
            1: '화요일',
            2: '수요일',
            3: '목요일',
            4: '금요일',
            5: '토요일',
            6: '일요일',
            7: '매주 출발',
            8: '격주 출발',
            9: '매일 출발'
        };

        this.responses = {
            welcome: [
                '안녕하세요! 푸른투어 챗봇입니다. 🌏✈️',
                '어떤 여행을 계획하고 계신가요?',
                '• 여행지 추천 (예: "제주도 여행")',
                '• 가격 문의 (예: "1000 달러이하")',
                '• 예약 상담 (예: "예약하기")',
                '• 인기 상품 (예: "인기 여행")'
            ].join('\n'),

            help: [
                '푸른투어에서 도움드릴 수 있는 것들:',
                '🏖️ 여행지별 상품 검색',
                '💰 예산별 여행 추천',
                '📅 출발일별 상품 검색',
                '⭐ 인기/추천 여행 상품',
                '📞 예약 및 상담',
                '',
                '예시: "제주도 3박4일", "해외여행 추천", "이번 주말 여행"'
            ].join('\n'),

            fallback: [
                '죄송합니다. 일시적인 시스템 오류가 발생했습니다. 🙏',
                '',
                '📞 직접 상담: 02-1234-5678',
                '📧 이메일: booking@bluetour.com',
                '🕐 운영시간: 평일 09:00-18:00',
                '',
                '잠시 후 다시 시도해주세요.'
            ].join('\n')
        };

        this.patterns = {
            greetings: /안녕|하이|헬로|hello|hi|반가|좋은|안녕하세요/i,
            farewell: /안녕히|잘가|goodbye|bye|감사|고마워|끝|종료/i,
            help: /도움|help|뭘|무엇|어떤|할수있|문의|궁금|질문|알려줘/i,
            destination: /미국|미주|동부|서부|캐나다|남미|중남미|페루|브라질|유럽|스페인|칸쿤|하와이|알래스카|멕시코|제주|부산|강릉|경주|전주|여수|속초|일본|중국|태국|베트남|싱가포르|필리핀|usa|canada|south america|europe|hawaii|alaska|mexico/i,
            CATEGORY_SEARCH: /미국|캐나다|유럽|중남미|아시아|남미|동부|서부|라스베가스|그랜드캐년|옐로스톤|알래스카|골프|크루즈|뮤지컬/i,
            DESTINATION_SEARCH: /미국|캐나다|유럽|중남미|아시아|동부|서부|라스베가스|그랜드캐년|옐로스톤|알래스카|골프|크루즈|뮤지컬/i,
            recommendation: /추천|괜찮은|좋은|인기|순위|어때|best|recommend|popular|top/i,
            RESERVATION_SEARCH: /예약|신청|예약조회|예약방법|자리|좌석|가능|불가능|availability|available|book|reservation|reserve/i,
            PRICE_SEARCH: /가격|결제|가격|비용|금액|견적|입금|카드|페이|얼마|price|cost|fee|payment/i,
            company_info: /푸른투어|회사|어디|주소|연락처|전화번호|찾아가|소개|about us|contact/i,
            departure_day: /월요일|화요일|수요일|목요일|금요일|토요일|일요일|주말|매일|언제|출발일/i,
            GUIDE_SEARCH: /가이드\s*([가-힣]{2,4})\s*\(?(?:뉴욕|LA|라스베가스|시애틀|달라스|애틀랜타|본사)\)?/i,
            SEASONAL_SEARCH: /(봄|여름|가을|겨울|크리스마스|신년|연휴)/i,
            DURATION_SEARCH: /(\d+)박\s*(\d+)일|(\d+)일|당일|단기|장기/i





        };
    }

    // 안전한 문자열 처리 유틸리티 메서드 추가
    safeTrim(value) {
        if (value == null || value === undefined) {
            return '';
        }
        return String(value).trim();
    }

    // 🆕 Ollama 초기화 메서드 추가
    async initializeOllama() {
        try {
            this.ollamaEnabled = process.env.ENABLE_OLLAMA === 'true';
            if (this.ollamaEnabled) {
                this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
                this.ollamaModel = process.env.OLLAMA_MODEL || 'benedict/linkbricks-llama3.1-korean:8b';

                // Ollama 서버 연결 테스트
                const response = await fetch(`${this.ollamaUrl}/api/tags`);
                if (response.ok) {
                    const models = await response.json();
                    console.log('✅ Ollama 로컬 LLM 초기화 완료');
                    console.log(`🤖 사용 모델: ${this.ollamaModel}`);
                    console.log(`📋 설치된 모델:12 ${models.models.map(m => m.name).join(', ')} 12`);
                } else {
                    throw new Error('Ollama 서버 연결 실패');
                }
            } else {
                console.log('⚠️ Ollama 비활성화');
            }
        } catch (error) {
            console.error('❌ Ollama 초기화 실패:', error.message);
            this.ollamaEnabled = false;
        }
    }

    initializeGemini() {
        try {
            if (process.env.GEMINI_API_KEY && process.env.ENABLE_GEMINI === 'true') {
                this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                this.model = this.genAI.getGenerativeModel({
                    model: process.env.GEMINI_MODEL || 'gemini-pro'
                });
                this.geminiEnabled = true;
                console.log('✅ Gemini AI 초기화 완료');

                this.systemPrompt = `
당신은 "푸른투어"의 전문 여행 상담 AI 어시스턴트입니다.

**역할:**
- 친근하고 전문적인 여행 상담사
- 고객의 여행 니즈를 파악하고 적절한 상품 추천
- 푸른투어 브랜드의 신뢰성 있는 서비스 제공

**응답 스타일:**
- 항상 존댓말 사용
- 친근하면서도 전문적인 톤
- 적절한 이모지 활용 (🌏 ✈️ 🏖️ 💰 📞 등)
- 간결하고 명확한 정보 제공

**회사 정보:**
- 푸른투어
- 전화: 02-1234-5678 / 010-1234-5678
- 이메일: booking@bluetour.com
- 운영시간: 평일 09:00-18:00

여행 상품 데이터가 제공되면 반드시 그 정보를 기반으로 구체적인 추천을 해주세요.
답변은 400자 이내로 간결하게 작성해주세요.
`;
            } else {
                this.geminiEnabled = false;
                console.log('⚠️ Gemini AI 비활성화 - 기본 패턴 모드로 동작');
            }
        } catch (error) {
            console.error('❌ Gemini AI 초기화 실패:', error);
            this.geminiEnabled = false;
        }
    }

    async processMessage(userId, message) {
        // 안전한 trim 처리 적용
        const cleanMessage = this.safeTrim(message);

        try {
            // AI 타입 표시 수정
            const aiType = this.ollamaEnabled ? 'Ollama' : (this.geminiEnabled ? 'Gemini' : '패턴');
            console.log(`[푸른투어 ${aiType}] 고객 ${userId}: ${cleanMessage}`);

            // 빈 메시지 처리
            if (!cleanMessage) {
                return '메시지를 입력해주세요! 😊\n\n예시: "하와이 여행", "유럽 패키지", "예약 문의"';
            }

            // 1단계: 빠른 패턴 응답
            const quickResponse = this.getQuickResponse(cleanMessage);
            if (quickResponse) {
                return quickResponse;
            }

            // 2단계: 실제 SQL로 여행 상품 검색
            const tourData = await this.processSearchQuery(cleanMessage);
            console.log(`DB 검색 결과: ${tourData.length}개 상품`);
            console.log('DB 검색 결과:', tourData);
            // 3단계: AI 응답 생성 (우선순위: Ollama > Gemini > 패턴)
            if (this.ollamaEnabled) {
                try {
                    const aiResponse = await this.generateOllamaResponse(cleanMessage, tourData, userId);
                    this.saveConversation(userId, cleanMessage, aiResponse);
                    return aiResponse;
                } catch (ollamaError) {
                    console.warn('Ollama 응답 실패, 다음 방법 시도:', ollamaError.message);
                }
            }

            if (this.geminiEnabled) {
                try {
                    const aiResponse = await this.generateGeminiResponse(cleanMessage, tourData, userId);
                    this.saveConversation(userId, cleanMessage, aiResponse);
                    return aiResponse;
                } catch (geminiError) {
                    console.warn('Gemini 응답 실패, 패턴 기반 응답 사용:', geminiError.message);
                }
            }

            // 폴백: 패턴 기반 응답
            const patternResponse = this.generatePatternResponse(cleanMessage, tourData);
            this.saveConversation(userId, cleanMessage, patternResponse);
            return patternResponse;

        } catch (error) {
            console.error('푸른투어 챗봇 오류:', error);
            return this.responses.fallback;
        }
    }

    // 🆕 Ollama 응답 생성 메서드 추가
    async generateOllamaResponse(message, tourData, userId) {
        try {
            let prompt = `당신은 "푸른투어"의 전문 여행 상담 AI 어시스턴트입니다.

    **역할:**
    - 친근하고 전문적인 여행 상담사
    - 고객의 여행 니즈를 파악하고 적절한 상품 추천
    - 푸른투어 브랜드의 신뢰성 있는 서비스 제공

    **응답 스타일:**
    - 항상 존댓말 사용
    - 친근하면서도 전문적인 톤
    - 적절한 이모지 활용 (🌏 ✈️ 🏖️ 💰 📞 등)
    - 간결하고 명확한 정보 제공
    - 한글로 답변해줘

    **회사 정보:**
    - 푸른투어
    - 전화: 02-1234-5678 / 010-1234-5678
    - 이메일: booking@bluetour.com
    - 운영시간: 평일 09:00-18:00`;

            if (tourData && tourData.length > 0) {
                prompt += `\n\n**검색된 푸른투어 상품들:**\n`;
                tourData.slice(0, 3).forEach((tour, index) => {
                    prompt += `${index + 1}. ${tour.p_name}\n`;
                    prompt += `   📍 목적지: ${tour.t_addr || '미정'}\n`;
                    prompt += `   💰 성인가격: ${tour.price_1adult ? Number(tour.price_1adult).toLocaleString() : '문의'}원\n`;
                    if (tour.price_0child && tour.price_0child > 0) {
                        prompt += `   👶 아동가격: ${Number(tour.price_0child).toLocaleString()}원\n`;
                    }
                    prompt += `   📅 기간: ${tour.p_day || '미정'}일\n`;
                    prompt += `   🗓️ ${this.formatDepartureInfo(tour.p_week)}\n`;
                    prompt += `   🏷️ 상품코드: ${tour.p_code}\n`;
                    if (tour.p_sdesc) {
                        prompt += `   📝 ${tour.p_sdesc}\n`;
                    }
                    prompt += `\n`;
                });
            } else {
                prompt += `\n\n**안내:** 현재 고객 문의에 정확히 맞는 상품이 검색되지 않았습니다. 일반적인 여행 상담과 푸른투어 연락처를 안내해주세요.\n`;
            }

            const context = this.getConversationContext(userId);
            if (context) {
                prompt += `\n**이전 대화:**\n${context}\n`;
            }

            prompt += `\n**고객 문의:** "${message}"\n\n**푸른투어 상담사 답변 (한국어로, 400자 이내):**`;

            const response = await fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        max_tokens: 500,
                        top_p: 0.9
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API 오류: ${response.status}`);
            }

            const result = await response.json();
            return result.response.trim();

        } catch (error) {
            console.error('Ollama 응답 생성 오류:', error);
            throw error;
        }
    }

    getQuickResponse(message) {
        if (this.patterns?.greetings?.test(message)) {
            return this.responses.welcome;
        }

        if (this.patterns?.help?.test(message)) {
            return this.responses.help;
        }

        if (this.patterns?.farewell?.test(message)) {
            return '감사합니다! 즐거운 여행 되세요! 🌟\n\n또 언제든 푸른투어를 찾아주세요! ✈️';
        }

        if (this.patterns?.booking_reservation?.test(message)) {
            return this.getBookingInfo();
        }

        if (this.patterns?.company_info?.test(message)) {
            return this.getCompanyInfo();
        }

        return null;
    }
    detectSearchIntent(message) {
        // 안전한 문자열 처리
        const cleanMessage = this.safeTrim(message).toLowerCase();

        if (!cleanMessage) {
            return { type: 'UNKNOWN', confidence: 0 };
        }

        // 검색 의도별 점수 계산
        const intents = [
            {
                type: 'RESERVATION_SEARCH',
                patterns: [
                    /예약|신청|예약번호|예약조회|예약확인|예약상황|예약상태/i,
                    /([A-Z]{2,3}\d{6,8})/i, // 예약코드 패턴
                    /(\d{3}-?\d{3,4}-?\d{4})/i, // 전화번호 패턴
                    /이름.*?([가-힣]{2,4})/i // 이름 패턴
                ]
            },
            {
                type: 'GUIDE_SEARCH',
                patterns: [
                    /가이드\s*([가-힣]{2,4})\s*\(?(?:뉴욕|LA|라스베가스|시애틀|달라스|애틀랜타|본사)\)?/i,
                    /가이드.*?(정보|연락처|소개)/i,
                    /(뉴욕|LA|라스베가스|시애틀|달라스|애틀랜타).*?가이드/i
                ]
            },
            {
                type: 'PRICE_SEARCH',
                patterns: [
                    /(\d+)만원?\s*이하|(\d+)\s*달러?\s*이하/i,
                    /(\d+)만원?\s*~\s*(\d+)만원?/i,
                    /가격|비용|금액|견적|요금|price|cost/i,
                    /저렴한|싼|경제적인|가성비/i,
                    /예산.*?(\d+)/i
                ]
            },
            {
                type: 'DURATION_SEARCH',
                patterns: [
                    /(\d+)박\s*(\d+)일|(\d+)일/i,
                    /당일|단기|장기/i,
                    /며칠|몇일|기간/i
                ]
            },
            {
                type: 'CATEGORY_SEARCH',
                patterns: [
                    /미국|캐나다|유럽|중남미|아시아/i,
                    /동부|서부|라스베가스|그랜드캐년|옐로스톤|알래스카/i,
                    /골프|크루즈|뮤지컬/i,
                    /패키지|자유여행|단체여행/i
                ]
            },
            {
                type: 'SEASONAL_SEARCH',
                patterns: [
                    /(봄|여름|가을|겨울)/i,
                    /(크리스마스|신년|연휴)/i,
                    /시즌|계절/i,
                    /(3월|4월|5월|6월|7월|8월|9월|10월|11월|12월|1월|2월)/i
                ]
            },
            {
                type: 'DESTINATION_SEARCH',
                patterns: [
                    /미국|미주|동부|서부|캐나다|남미|중남미|페루|브라질/i,
                    /유럽|스페인|칸쿤|하와이|알래스카|멕시코/i,
                    /제주|부산|강릉|경주|전주|여수|속초/i,
                    /일본|중국|태국|베트남|싱가포르|필리핀/i,
                    /뉴욕|LA|라스베가스|샌프란시스코|시애틀/i
                ]
            }
        ];

        // 각 의도별 점수 계산
        let bestMatch = { type: 'COMPREHENSIVE_SEARCH', confidence: 0 };

        for (const intent of intents) {
            let score = 0;
            let matchCount = 0;

            for (const pattern of intent.patterns) {
                if (pattern.test(cleanMessage)) {
                    matchCount++;
                    // 패턴별 가중치 부여
                    if (pattern.source.includes('\\d+')) {
                        score += 3; // 숫자 패턴은 높은 점수
                    } else if (pattern.source.length > 20) {
                        score += 2; // 복잡한 패턴은 중간 점수
                    } else {
                        score += 1; // 기본 점수
                    }
                }
            }

            // 신뢰도 계산 (매치된 패턴 수 + 점수)
            const confidence = matchCount > 0 ? (score / intent.patterns.length) * 100 : 0;

            if (confidence > bestMatch.confidence) {
                bestMatch = {
                    type: intent.type,
                    confidence: Math.min(confidence, 100), // 최대 100%
                    matchCount: matchCount
                };
            }
        }

        // 특별 케이스: 복합 검색 판단
        const hasMultipleIntents = intents.filter(intent =>
            intent.patterns.some(pattern => pattern.test(cleanMessage))
        ).length > 1;

        if (hasMultipleIntents || bestMatch.confidence < 50) {
            return {
                type: 'COMPREHENSIVE_SEARCH',
                confidence: Math.max(bestMatch.confidence, 30),
                originalIntent: bestMatch.type
            };
        }

        return bestMatch;
    }
    async processSearchQuery(message) {
        try {
            // 검색 의도 분석
            const intent = this.detectSearchIntent(message);

            let results = [];
            console.log(intent.type);
            switch (intent.type) {
                case 'RESERVATION_SEARCH':
                    results = await this.searchReservationSQL(message);
                    break;

                case 'GUIDE_SEARCH':
                    results = await this.searchGuideInfoSQL(message);
                    break;

                case 'PRICE_SEARCH':
                    results = await this.searchByPriceRangeSQL(message);
                    break;

                case 'DURATION_SEARCH':
                    results = await this.searchByDurationSQL(message);
                    break;

                case 'CATEGORY_SEARCH':
                    results = await this.searchByCategorySQL(message);
                    break;

                case 'SEASONAL_SEARCH':
                    results = await this.searchSeasonalProductsSQL(message);
                    break;

                case 'DESTINATION_SEARCH':
                    results = await this.searchByDestinationSQL(message);
                    break;

                default:
                    results = await this.comprehensiveSearchSQL(message);
            }

            // 결과가 배열이 아닌 경우 처리
            if (!Array.isArray(results)) {
                console.warn('검색 결과가 배열이 아닙니다:', results);
                results = [];
            }

            return results; // 단순히 배열 반환

        } catch (error) {
            console.error('검색 처리 오류:', error);
            return []; // 빈 배열 반환
        }
    }
    async searchWithSQL(message) {
        try {
            let tours = [];

            // 목적지 검색
            if (this.patterns.destination.test(message)) {
                tours = await this.searchByDestinationSQL(message);
            }
            // 가격 검색
            else if (this.patterns.payment_price.test(message) && /\d달러?/.test(message)) {
                tours = await this.searchByPriceSQL(message);
            }
            //zkxprh
            // 출발일 검색
            else if (this.patterns.departure_day.test(message)) {
                tours = await this.searchByDepartureDaySQL(message);
            }
            // 인기 상품
            else if (this.patterns.recommendation.test(message)) {
                tours = await this.getPopularToursSQL();
            }
            // 일반 검색
            else {
                tours = await this.generalSearchSQL(message);
            }

            return tours;
        } catch (error) {
            console.error('SQL 검색 오류:', error);
            return [];
        }
    }

    // === 실제 SQL 쿼리 메서드들 ===

    async searchByDestinationSQL(message) {
        try {
            const destinations = message.match(this.patterns.destination);
            if (!destinations) return [];

            const destination = destinations[0];

            const query = `
                SELECT DISTINCT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.t_addr,
                    pm.price_1adult,
                    pm.price_0child,
                    pm.p_day,
                    pm.p_sdesc,
                    pm.p_4sdesc,
                    pm.p_include,
                    pm.p_uninclude,
                    pm.p_vstart,
                    pm.p_vend,
                    pm.p_week,
                    pm.tour_area_value,
                    pm.c_code1,
                    pm.c_code2,
                    pm.c_code3,
                    cb1.comment as main_category,
                    cb2.comment as sub_category,
                    pm.wdate
                FROM
                    product_master AS pm
                LEFT JOIN
                    product_details AS pd ON pm.p_code = pd.p_code
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                LEFT JOIN
                    code_base AS cb2 ON pm.c_code1 = cb2.lvcode1 AND pm.c_code2 = cb2.lvcode2 AND cb2.lvcode3 = '00'
                WHERE
                    (
                        pm.p_name LIKE :destination
                        OR pm.t_addr LIKE :destination
                        OR pm.p_4sdesc LIKE :destination
                        OR pm.tour_area_value LIKE :destination
                        OR pd.content LIKE :destination
                        OR pd.area LIKE :destination
                        OR cb1.comment LIKE :destination
                        OR cb2.comment LIKE :destination
                    )
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND pm.price_1adult > 0
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.pos ASC, pm.pos ASC, pm.wdate DESC
                LIMIT 10
            `;

            const tours = await sequelize.query(query, {
                replacements: {
                    destination: `%${destination}%`
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('목적지 검색 SQL 오류:', error);
            return [];
        }
    }

    async searchByPriceRangeSQL(message) {
        try {
            // 가격 범위 추출
            const pricePatterns = [
                /(\d+)만원?\s*이하/i,
                /(\d+)\s*달러?\s*이하/i,
                /(\d+)만원?\s*~\s*(\d+)만원?/i,
                /(\d+)\s*달러?\s*~\s*(\d+)\s*달러?/i,
                /예산.*?(\d+)/i
            ];

            let minPrice = 0;
            let maxPrice = 10000000; // 기본 최대값 1000만원
            let priceFound = false;

            for (const pattern of pricePatterns) {
                const match = message.match(pattern);
                if (match) {
                    priceFound = true;
                    if (pattern.source.includes('이하')) {
                        if (pattern.source.includes('만원')) {
                            maxPrice = parseInt(match[1]) * 10000;
                        } else {
                            maxPrice = parseInt(match[1]); // 달러
                        }
                    } else if (pattern.source.includes('~')) {
                        if (pattern.source.includes('만원')) {
                            minPrice = parseInt(match[1]) * 10000;
                            maxPrice = parseInt(match[2]) * 10000;
                        } else {
                            minPrice = parseInt(match[1]);
                            maxPrice = parseInt(match[2]);
                        }
                    } else {
                        // 예산 관련
                        maxPrice = parseInt(match[1]) * 10000;
                    }
                    break;
                }
            }

            if (!priceFound) return [];

            const query = `
            SELECT
                pm.seq_no,
                pm.p_code,
                pm.p_name,
                pm.t_addr,
                pm.price_1adult,
                pm.price_0child,
                pm.p_day,
                pm.p_sdesc,
                pm.tour_area_value,
                pm.p_week,
                cb1.comment as category_name
                FROM
                product_master AS pm
            LEFT JOIN
                code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
            WHERE
                pm.price_1adult BETWEEN :minPrice AND :maxPrice
                AND pm.p_display = 'Y'
                AND pm.end_yn = 'n'
                AND pm.price_1adult > 0
                AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
            ORDER BY
                pm.price_1adult ASC, pm.pos ASC
            LIMIT 10
        `;

            const tours = await sequelize.query(query, {
                replacements: {
                    minPrice: minPrice,
                    maxPrice: maxPrice
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('가격 범위 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchByPriceRangeSQL(message) {
        try {
            // 가격 범위 추출
            const pricePatterns = [
                /(\d+)만원?\s*이하/i,
                /(\d+)\s*달러?\s*이하/i,
                /(\d+)만원?\s*~\s*(\d+)만원?/i,
                /(\d+)\s*달러?\s*~\s*(\d+)\s*달러?/i,
                /예산.*?(\d+)/i
            ];

            let minPrice = 0;
            let maxPrice = 10000000; // 기본 최대값 1000만원
            let priceFound = false;

            for (const pattern of pricePatterns) {
                const match = message.match(pattern);
                if (match) {
                    priceFound = true;
                    if (pattern.source.includes('이하')) {
                        if (pattern.source.includes('만원')) {
                            maxPrice = parseInt(match[1]) * 10000;
                        } else {
                            maxPrice = parseInt(match[1]); // 달러
                        }
                    } else if (pattern.source.includes('~')) {
                        if (pattern.source.includes('만원')) {
                            minPrice = parseInt(match[1]) * 10000;
                            maxPrice = parseInt(match[2]) * 10000;
                        } else {
                            minPrice = parseInt(match[1]);
                            maxPrice = parseInt(match[2]);
                        }
                    } else {
                        // 예산 관련
                        maxPrice = parseInt(match[1]) * 10000;
                    }
                    break;
                }
            }

            if (!priceFound) return [];

            const query = `
                SELECT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.t_addr,
                    pm.price_1adult,
                    pm.price_0child,
                    pm.p_day,
                    pm.p_sdesc,
                    pm.tour_area_value,
                    pm.p_week,
                    cb1.comment as category_name
                    
                FROM
                    product_master AS pm
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                WHERE
                    pm.price_1adult BETWEEN :minPrice AND :maxPrice
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND pm.price_1adult > 0
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.price_1adult ASC, pm.pos ASC
                LIMIT 10
            `;

            const tours = await sequelize.query(query, {
                replacements: {
                    minPrice: minPrice,
                    maxPrice: maxPrice
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('가격 범위 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchByPriceSQL(message) {
        try {
            const priceMatch = message.match(/(\d+)만원?\s*이하|(\d+)\s*달러?\s*이하|(\d+)만원?\s*~\s*(\d+)만원?/);
            if (!priceMatch) return [];

            let minPrice = 0;
            let maxPrice = 10000;

            if (priceMatch[1]) {
                maxPrice = parseInt(priceMatch[1]) * 10000; // 만원 단위
            } else if (priceMatch[2]) {
                maxPrice = parseInt(priceMatch[2]); // 달러 단위
            } else if (priceMatch[3] && priceMatch[4]) {
                minPrice = parseInt(priceMatch[3]) * 10000;
                maxPrice = parseInt(priceMatch[4]) * 10000;
            }

            const query = `
                SELECT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.price_1adult,
                    pm.price_0child,
                    pm.p_day,
                    pm.p_sdesc,
                    pm.tour_area_value,
                    cb1.comment as category_name,
                    pm.p_vstart,
                    pm.p_vend
                FROM
                    product_master AS pm
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                WHERE
                    pm.price_1adult BETWEEN :minPrice AND :maxPrice
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.price_1adult ASC
                LIMIT 8
            `;

            const tours = await sequelize.query(query, {
                replacements: {
                    minPrice: minPrice,
                    maxPrice: maxPrice
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('가격대별 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchByDurationSQL(message) {
        try {
            const durationMatch = message.match(/(\d+)박\s*(\d+)일|(\d+)일|당일|단기|장기/);
            if (!durationMatch) return [];

            let minDay = 0;
            let maxDay = 30;

            if (durationMatch[0].includes('당일')) {
                maxDay = 1;
            } else if (durationMatch[0].includes('단기')) {
                maxDay = 4;
            } else if (durationMatch[0].includes('장기')) {
                minDay = 8;
                maxDay = 30;
            } else if (durationMatch[2]) {
                minDay = maxDay = parseInt(durationMatch[2]);
            } else if (durationMatch[3]) {
                minDay = maxDay = parseInt(durationMatch[3]);
            }

            const query = `
                SELECT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.p_day,
                    pm.price_1adult,
                    pm.p_sdesc,
                    pm.tour_area_value,
                    cb1.comment as category_name,
                    cb2.comment as duration_category
                FROM
                    product_master AS pm
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                LEFT JOIN
                    code_base AS cb2 ON 'C01' = cb2.lvcode1 AND cb2.lvcode3 = '00'
                WHERE
                    pm.p_day BETWEEN :minDay AND :maxDay
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.p_day ASC, pm.price_1adult ASC
                LIMIT 8
            `;

            const tours = await sequelize.query(query, {
                replacements: {
                    minDay: minDay,
                    maxDay: maxDay
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('여행 기간별 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchByCategorySQL(message) {
        try {
            // 카테고리 매핑 (code_base 데이터 기반)
            const categoryMap = {
                '미국': 'T01-15',
                '캐나다': 'T01-10',
                '유럽': 'T01-20',
                '중남미': 'T01-30',
                '아시아': 'T01-45',
                '동부': 'T01-15-10',
                '서부': 'T01-15-15',
                '라스베가스': 'T01-15-20',
                '그랜드캐년': 'T01-15-15',
                '옐로스톤': 'T01-15-35',
                '알래스카': 'T01-15-30',
                '골프': 'T01-55-10',
                '크루즈': 'T01-55-15',
                '뮤지컬': 'T01-60-10'
            };

            let categoryCode = null;
            for (const [keyword, code] of Object.entries(categoryMap)) {
                if (message.includes(keyword)) {
                    categoryCode = code;
                    break;
                }
            }

            if (!categoryCode) return [];

            const [c1, c2, c3] = categoryCode.split('-');

            const query = `
                SELECT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.price_1adult,
                    pm.p_day,
                    pm.p_sdesc,
                    pm.tour_area_value,
                    cb1.comment as main_category,
                    cb2.comment as sub_category,
                    cb3.comment as detail_category
                FROM
                    product_master AS pm
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                LEFT JOIN
                    code_base AS cb2 ON pm.c_code1 = cb2.lvcode1 AND pm.c_code2 = cb2.lvcode2 AND cb2.lvcode3 = '00'
                LEFT JOIN
                    code_base AS cb3 ON pm.c_code1 = cb3.lvcode1 AND pm.c_code2 = cb3.lvcode2 AND pm.c_code3 = cb3.lvcode3
                WHERE
                    pm.c_code1 = :c1
                    ${c2 ? 'AND pm.c_code2 = :c2' : ''}
                    ${c3 ? 'AND pm.c_code3 = :c3' : ''}
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.price_1adult ASC, pm.pos ASC
                LIMIT 10
            `;

            const replacements = { c1 };
            if (c2) replacements.c2 = c2;
            if (c3) replacements.c3 = c3;

            const tours = await sequelize.query(query, {
                replacements,
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('카테고리별 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchReservationSQL(message) {
        try {
            console.log('입력 메시지:', message);
            console.log('메시지 타입:', typeof message);
            console.log('메시지 길이:', message ? message.length : 0);

            const reserveCodeMatch = message.match(/(?:예약번호|booking\s?#|PNR|b_code)?:?\s*([A-Z]{2,3}\d{5,30}|[A-Z0-9]{6,10})/i);
            const phoneMatch = message.match(/(?:전화번호|연락처|핸드폰|모바일|phone|mobile|contact|tel)?:?\s*(?:\+82[\s-]?)?\(?(010|02|0[3-7]\d{1,2})\)?[\s-]?(\d{3,4})[\s-]?(\d{4})/i);
            const nameMatch = message.match(/(?<!상품|투어|호텔)\s*(?:성함|성명|예약자명|고객명|가이드명|이름)(?:은|이|:)?\s*([가-힣]{2,4})/);

            console.log('예약코드 매치:', reserveCodeMatch);
            console.log('전화번호 매치:', phoneMatch);
            console.log('이름 매치:', nameMatch);

            if (!reserveCodeMatch && !phoneMatch && !nameMatch) return [];

            let whereConditions = ['ri.parent = "MAIN"']; // 대표예약만 조회
            let replacements = {};

            if (reserveCodeMatch) {
                whereConditions.push('ri.reserveCode = :reserveCode');
                replacements.reserveCode = reserveCodeMatch[1];
            }

            if (phoneMatch) {
                const phone = phoneMatch[1].replace(/-/g, '');
                whereConditions.push('ri.book_phone LIKE :phone');
                replacements.phone = `%${phone}%`;
            }

            if (nameMatch) {
                whereConditions.push('ri.book_pri LIKE :name');
                replacements.name = `%${nameMatch[1]}%`;
            }

            const query = `
            SELECT
                ri.reserveCode,
                ri.grand_revNo,
                ri.book_pri,
                ri.p_name,
                ri.stDate,
                ri.edDate,
                ri.p_cnt,
                ri.last_total,
                ri.payment_st,
                ri.rev_status,
                ri.book_pri as rep_traveler_nm,      -- 대표예약자명
                ri.book_phone as rep_traveler_phone, -- 대표예약자 연락처
                ri.book_email as rep_traveler_email, -- 대표예약자 이메일
                pm.p_day
            FROM
                reserve_info ri
                LEFT JOIN product_master pm ON ri.p_code = pm.p_code
            WHERE
                ri.wdate >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
                AND ${whereConditions.join(' AND ')}
            ORDER BY
                ri.wdate DESC
            LIMIT 5
        `;

            const reservations = await sequelize.query(query, {
                replacements,
                type: QueryTypes.SELECT
            });

            console.log('최적화된 쿼리:', query);
            console.log('검색 결과:', reservations.length);
            console.log('검색 결과:', reservations);
            return reservations;

        } catch (error) {
            console.error('예약 조회 SQL 오류:', error);
            return [];
        }
    }
    async searchGuideInfoSQL(message) {
        try {
            const guideNameMatch = message.match(/가이드.*?([가-힣]{2,4})/);
            const areaMatch = message.match(/(뉴욕|LA|라스베가스|시애틀|달라스|애틀랜타|본사)/);

            let whereConditions = ['ml.division = "guide"', 'ml.del_yn = "N"'];
            let replacements = {};

            if (guideNameMatch) {
                whereConditions.push('ml.kor_name LIKE :guideName');
                replacements.guideName = `%${guideNameMatch[1]}%`;
            }

            if (areaMatch) {
                whereConditions.push('ml.company_area LIKE :area');
                replacements.area = `%${areaMatch[1]}%`;
            }

            const query = `
            SELECT
                ml.userid,
                ml.kor_name,
                ml.eng_name,
                ml.email,
                ml.cell_phone,
                ml.company_area,
                ml.guide_status,
                COUNT(tg.seq_no) as tour_count,
                ml.wdate as join_date
            FROM
                member_list AS ml
            LEFT JOIN
                tour_guide AS tg ON ml.userid = tg.guide_id
            WHERE
                ${whereConditions.join(' AND ')}
            GROUP BY
                ml.userid, ml.kor_name, ml.eng_name, ml.email, 
                ml.cell_phone, ml.company_area, ml.guide_status, ml.wdate
            ORDER BY
                tour_count DESC, ml.wdate DESC
            LIMIT 5
        `;

            const guides = await sequelize.query(query, {
                replacements,
                type: QueryTypes.SELECT
            });

            console.log('가이드 검색 결과:', guides.length);
            return guides;

        } catch (error) {
            console.error('가이드 정보 검색 SQL 오류:', error);
            return [];
        }
    }

    async searchSeasonalProductsSQL(message) {
        try {
            const seasonMap = {
                '봄': ['03', '04', '05'],
                '여름': ['06', '07', '08'],
                '가을': ['09', '10', '11'],
                '겨울': ['12', '01', '02'],
                '크리스마스': ['12'],
                '신년': ['01'],
                '연휴': ['05', '10']
            };

            let season = null;
            for (const [key, months] of Object.entries(seasonMap)) {
                if (message.includes(key)) {
                    season = months;
                    break;
                }
            }

            if (!season) return [];

            const currentMonth = new Date().getMonth() + 1;
            const monthStr = currentMonth.toString().padStart(2, '0');

            const query = `
                SELECT
                    pm.seq_no,
                    pm.p_code,
                    pm.p_name,
                    pm.price_1adult,
                    pm.p_day,
                    pm.p_sdesc,
                    pm.tour_area_value,
                    cb1.comment as category_name,
                    pm.p_vstart,
                    pm.p_vend
                     FROM
                    product_master AS pm
                LEFT JOIN
                    code_base AS cb1 ON pm.c_code1 = cb1.lvcode1 AND cb1.lvcode2 = '00'
                WHERE
                    (
                        pm.c_code1 = 'T01' AND pm.c_code2 = '50'  -- 시즌특별상품
                        OR MONTH(pm.p_vstart) IN (${season.map(() => '?').join(',')})
                        OR pm.p_week LIKE '%${monthStr}%'
                    )
                    AND pm.p_display = 'Y'
                    AND pm.end_yn = 'n'
                    AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
                ORDER BY
                    pm.price_1adult ASC, pm.pos ASC
                LIMIT 8
            `;

            const tours = await sequelize.query(query, {
                replacements: season,
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('시즌별 상품 검색 SQL 오류:', error);
            return [];
        }
    }
    async comprehensiveSearchSQL(message) {
        try {
            // 여러 검색 조건을 동시에 처리
            const searchPromises = [
                this.searchByDestinationSQL(message),
                this.searchByPriceRangeSQL(message),
                this.searchByDurationSQL(message),
                this.searchByCategorySQL(message)
            ];

            const results = await Promise.all(searchPromises);

            // 결과 통합 및 중복 제거
            const allTours = results.flat();
            const uniqueTours = allTours.filter((tour, index, self) =>
                index === self.findIndex(t => t.p_code === tour.p_code)
            );

            // 관련도 점수 계산 및 정렬
            const scoredTours = uniqueTours.map(tour => {
                let score = 0;

                // 메시지와 상품명 유사도
                const nameMatch = tour.p_name.toLowerCase().includes(message.toLowerCase());
                if (nameMatch) score += 10;

                // 카테고리 매치
                if (tour.category_name && message.includes(tour.category_name)) score += 5;

                // 랭킹 점수 (낮을수록 좋음)
                if (tour.ranking) score += (100 - tour.ranking);

                return { ...tour, relevanceScore: score };
            });

            return scoredTours
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, 10);

        } catch (error) {
            console.error('통합 검색 SQL 오류:', error);
            return [];
        }
    }
    async searchByDepartureDaySQL(message) {
        try {
            let weekCondition = '';
            let weekValues = [];

            // 요일별 검색
            if (/월요일|월/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['0'];
            } else if (/화요일|화/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['1'];
            } else if (/수요일|수/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['2'];
            } else if (/목요일|목/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['3'];
            } else if (/금요일|금/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['4'];
            } else if (/토요일|토/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['5'];
            } else if (/일요일|일/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['6'];
            } else if (/주말/.test(message)) {
                weekCondition = 'p_week IN (?, ?)';
                weekValues = ['5', '6'];
            } else if (/매일/.test(message)) {
                weekCondition = 'p_week = ?';
                weekValues = ['9'];
            } else {
                // 매일 출발 상품만 검색
                weekCondition = 'p_week = ?';
                weekValues = ['9'];
            }

            const query = `
               SELECT 
                   seq_no,
                   p_code,
                   p_name,
                   t_addr,
                   price_1adult,
                   price_0child,
                   p_day,
                   p_sdesc,
                   p_4sdesc,
                   p_week,
                   wdate
               FROM product_master 
               WHERE ${weekCondition}
                 AND (p_display = 'y' OR p_display = 'y')
                 AND (end_yn = 'n' OR end_yn = 'N')
                 AND price_1adult > 0
                 AND (p_vend IS NULL OR p_vend >= CURDATE())
               ORDER BY wdate DESC
               LIMIT 5
           `;

            const tours = await sequelize.query(query, {
                replacements: weekValues,
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('출발일 검색 SQL 오류:', error);
            return [];
        }
    }

    async getPopularToursSQL() {
        try {
            const query = `
               SELECT 
                   pm.seq_no,
                   pm.p_code,
                   pm.p_name,
                   pm.t_addr,
                   pm.price_1adult,
                   pm.price_0child,
                   pm.p_day,
                   pm.p_sdesc,
                   pm.p_4sdesc,
                   pm.p_week,
                   pm.wdate,
                   COUNT(ri.p_code) as booking_count
               FROM product_master pm
               LEFT JOIN reserve_info ri ON pm.p_code = ri.p_code 
                   AND ri.revDate >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
               WHERE (pm.p_display = 'y' OR pm.p_display = 'y')
                 AND (pm.end_yn = 'n' OR pm.end_yn = 'N')
                 AND pm.price_1adult > 0
                 AND ri.parent = 'MAIN'
                 AND (pm.p_vend IS NULL OR pm.p_vend >= CURDATE())
               GROUP BY pm.seq_no, pm.p_code, pm.p_name, pm.t_addr, 
                        pm.price_1adult, pm.price_0child, pm.p_day, 
                        pm.p_sdesc, pm.p_4sdesc, pm.p_week, pm.wdate
               ORDER BY booking_count DESC, pm.wdate DESC
               LIMIT 5
           `;

            const tours = await sequelize.query(query, {
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('인기 상품 SQL 오류:', error);

            // 폴백: 최신 상품으로 검색
            const fallbackQuery = `
               SELECT 
                   seq_no,
                   p_code,
                   p_name,
                   t_addr,
                   price_1adult,
                   price_0child,
                   p_day,
                   p_sdesc,
                   p_4sdesc,
                   p_week,
                   wdate
               FROM product_master 
               WHERE (p_display = 'Y' OR p_display = '1')
                 AND (end_yn = 'n' OR end_yn = 'N')
                 AND price_1adult > 0
                 AND (p_vend IS NULL OR p_vend >= CURDATE())
               ORDER BY wdate DESC
               LIMIT 5
           `;

            const fallbackTours = await sequelize.query(fallbackQuery, {
                type: QueryTypes.SELECT
            });

            return fallbackTours;
        }
    }

    async generalSearchSQL(query) {
        try {
            const searchQuery = `
               SELECT 
                   seq_no,
                   p_code,
                   p_name,
                   t_addr,
                   price_1adult,
                   price_0child,
                   p_day,
                   p_sdesc,
                   p_4sdesc,
                   p_week,
                   wdate
               FROM product_master 
               WHERE (p_name LIKE :searchTerm 
                      OR t_addr LIKE :searchTerm 
                      OR p_sdesc LIKE :searchTerm
                      OR p_4sdesc LIKE :searchTerm)
                 AND (p_display = 'y' OR p_display = 'y')
                 AND (end_yn = 'n' OR end_yn = 'N')
                 AND price_1adult > 0
                 AND (p_vend IS NULL OR p_vend >= CURDATE())
               ORDER BY 
                   CASE 
                       WHEN p_name LIKE :searchTerm THEN 1
                       WHEN t_addr LIKE :searchTerm THEN 2
                       WHEN p_sdesc LIKE :searchTerm THEN 3
                       ELSE 4
                   END,
                   wdate DESC
               LIMIT 3
           `;

            const tours = await sequelize.query(searchQuery, {
                replacements: {
                    searchTerm: `%${query}%`
                },
                type: QueryTypes.SELECT
            });

            return tours;
        } catch (error) {
            console.error('일반 검색 SQL 오류:', error);
            return [];
        }
    }

    // === 출발 요일 정보 포맷팅 ===
    formatDepartureInfo(p_week) {
        if (!p_week) return '출발일 미정';

        const weekCode = p_week.toString();
        if (this.weekDays[weekCode]) {
            return this.weekDays[weekCode] + ' 출발';
        }

        // 다중 요일인 경우 (예: "1,3,5")
        if (weekCode.includes(',')) {
            const days = weekCode.split(',').map(code => this.weekDays[code.trim()]).filter(Boolean);
            return days.join(', ') + ' 출발';
        }

        return '출발일 문의';
    }
     stripHtml = (html) => {
        return html ? html.replace(/<[^>]*>/g, "") : "";
    }

    // === Gemini AI 응답 생성 ===

    async generateGeminiResponse(message, tourData, userId) {
        try {
            let prompt = this.systemPrompt;

            if (tourData) {
                // --- 1. 예약 정보(booking)일 경우의 프롬프트 구성 ---
                const booking = Array.isArray(tourData) ? tourData[0] : tourData; // 데이터가 배열이어도 첫 번째 요소를 사용

                prompt += `\n\n**[CONTEXT] 고객이 조회를 요청한 예약 상세 정보:**\n`;
                prompt += `(이 정보를 바탕으로 고객의 질문에 답변하세요)\n`;
                prompt += `---------------------------------\n`;
                prompt += `1. 예약 기본 정보:\n`;
                prompt += `   - 예약번호: ${booking.reserveCode}\n`;
                prompt += `   - 상품명: ${this.stripHtml(booking.p_name)}\n`;
                prompt += `   - 여행 기간: ${booking.stDate} ~ ${booking.edDate} (${booking.p_day}일)\n`;
                prompt += `   - 인원: ${booking.p_cnt}명\n`;
                prompt += `2. 예약자 정보:\n`;
                prompt += `   - 대표 여행자: ${booking.rep_traveler_nm}\n`;
                prompt += `   - 연락처: ${booking.rep_traveler_phone}\n`;
                prompt += `3. 상태 및 금액:\n`;
                prompt += `   - 예약 상태: ${booking.rev_status}\n`;
                prompt += `   - 결제 상태: ${booking.payment_st}\n`;
                prompt += `   - 총 금액: $${Number(booking.last_total).toLocaleString('en-US')}\n`;
                prompt += `   - 푸른투어 담당자: ${booking.book_pri}\n`;
                prompt += `---------------------------------\n`;

                // --- 2. 여행 상품 목록(tours)일 경우의 프롬프트 구성 ---
            }

            if (!tourData || (Array.isArray(tourData) && tourData.length === 0)) {
                prompt += `\n\n**[CONTEXT] 안내:** 현재 고객의 문의에 정확히 맞는 정보가 검색되지 않았습니다. 일반적인 여행 상담과 푸른투어 연락처를 안내해주세요.\n`;
            }

            const context = this.getConversationContext(userId);
            if (context) {
                prompt += `\n**이전 대화:**\n${context}\n`;
            }

            prompt += `\n**고객 문의:** "${message}"\n\n**푸른투어 전문 상담사 답변:**`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();

        } catch (error) {
            console.error('Gemini 응답 생성 오류:', error);
            throw error;
        }
    }
    generatePatternResponse(message, tourData, dataType = 'tours') {
        if (tourData) {
            // --- 1. 예약 정보(booking)일 경우의 답변 구성 ---

            const booking = Array.isArray(tourData) ? tourData[0] : tourData;

            let response = `✅ **[${booking.rep_traveler_nm}님]**의 예약 내역이 확인되었습니다.\n\n`;
            response += `📦 **상품명**: ${this.stripHtml(booking.p_name)}\n`;
            response += `🏷️ **예약번호**: ${booking.reserveCode}\n`;
            response += `📅 **여행일정**: ${booking.stDate} ~ ${booking.edDate}\n`;
            response += `👥 **인원**: ${booking.p_cnt}명\n`;
            response += `💰 **총 금액**: $${Number(booking.last_total).toLocaleString('en-US')}\n`;
            response += `💳 **결제상태**: ${booking.payment_st}\n`;
            response += `📋 **예약상태**: ${booking.rev_status}\n\n`;
            response += `예약 변경, 취소, 또는 기타 문의사항이 있으시면 말씀해주세요. 😊`;

            return response;

            // --- 2. 여행 상품 목록(tours)일 경우의 답변 구성 ---

        }

        // --- 3. 데이터가 없는 경우의 기본 답변 ---
        return [
            `"${message}"와 관련된 정보를 찾지 못했습니다. 😔`,
            `다른 검색어나 예약번호로 시도해보시거나 아래로 연락해주세요:`,
            `📞 (대표 연락처)`,
            `\n도움이 필요하시면 "상담원 연결"이라고 입력해주세요.`
        ].join('\n');
    }


    // === 기타 유틸리티 메서드들 ===

    saveConversation(userId, userMessage, botResponse) {
        // 안전한 문자열 처리 적용
        const safeUserMessage = this.safeTrim(userMessage);
        const safeBotResponse = this.safeTrim(botResponse);

        let state = this.conversationState.get(userId) || { history: [] };

        state.history.push({
            user: safeUserMessage,
            bot: safeBotResponse,
            timestamp: new Date()
        });

        if (state.history.length > 5) {
            state.history = state.history.slice(-5);
        }

        this.conversationState.set(userId, state);
    }

    getConversationContext(userId) {
        const state = this.conversationState.get(userId);
        if (!state || !state.history || state.history.length === 0) return '';

        return state.history
            .slice(-2)
            .map(conv => `고객: ${this.safeTrim(conv.user)}\n상담사: ${this.safeTrim(conv.bot)}`)
            .join('\n---\n');
    }

    getBookingInfo() {
        return [
            '📞 푸른투어 예약 문의',
            '',
            '🏢 본사: 02-1234-5678',
            '📱 모바일: 010-1234-5678',
            '🕐 운영시간: 평일 09:00-18:00',
            '📧 이메일: booking@bluetour.com',
            '🌐 홈페이지: www.bluetour.com',
            '',
            '💬 상품코드를 알려주시면 더 빠른 상담이 가능합니다!',
            '예: "상품코드 ABC123 예약 문의"'
        ].join('\n');
    }

    getCompanyInfo() {
        return [
            '🏢 푸른투어 회사 정보',
            '',
            '📍 주소: 서울특별시 강남구 테헤란로 123',
            '📞 대표전화: 02-1234-5678',
            '📧 이메일: info@bluetour.com',
            '🌐 홈페이지: www.bluetour.com',
            '',
            '🕐 운영시간:',
            '   평일: 09:00 - 18:00',
            '   토요일: 09:00 - 15:00',
            '   일요일/공휴일: 휴무',
            '',
            '🚇 오시는 길: 지하철 2호선 강남역 3번 출구'
        ].join('\n');
    }
}

module.exports = BlueTourChatController;
