
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Gemini API를 사용하여 영수증 이미지를 분석합니다.
 * @param mimeType 이미지의 MIME 타입 (image/jpeg, image/png 등)
 * @param base64Data 이미지의 Base64 데이터 (데이터 URL 접두사 제외)
 */
export const analyzeReceipt = async (mimeType: string, base64Data: string) => {
  // 사용자가 제공한 기본 API 키
  const defaultApiKey = "AIzaSyC93qXIy2YbzZqHJoKB0sIvsUeGkw1qHNY";
  const savedApiKey = localStorage.getItem('GEMINI_API_KEY') || defaultApiKey;
  
  if (!savedApiKey || savedApiKey.length < 10) {
    throw new Error("AI 분석 키가 설정되지 않았습니다. 설정에서 API 키를 확인해주세요.");
  }

  const ai = new GoogleGenAI({ apiKey: savedApiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType, 
              data: base64Data 
            } 
          },
          { 
            text: `주유 영수증 이미지입니다. 다음 정보를 추출하여 JSON 형식으로만 반환하세요:
            - date: 날짜 (YYYY-MM-DD)
            - time: 시간 (HH:mm)
            - liters: 주유량 (숫자)
            - unitPrice: 단가 (숫자)
            - totalAmount: 총 주유 금액 (숫자)
            - subsidy: 유가보조금 (숫자, 없으면 0)
            - actualPayment: 실 결제 금액 (숫자)
            
            반드시 JSON 문자열만 반환하고 다른 텍스트는 포함하지 마세요.`
          }
        ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            liters: { type: Type.NUMBER },
            unitPrice: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            subsidy: { type: Type.NUMBER },
            actualPayment: { type: Type.NUMBER }
          },
          required: ["date", "time", "totalAmount"]
        }
      }
    });
    
    if (!response.text) {
      throw new Error("분석 결과 텍스트가 비어있습니다.");
    }

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw error;
  }
};
