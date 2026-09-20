
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Gemini API를 사용하여 영수증 이미지를 분석합니다.
 * @param mimeType 이미지의 MIME 타입 (image/jpeg, image/png 등)
 * @param base64Data 이미지의 Base64 데이터 (데이터 URL 접두사 제외)
 */
export const analyzeReceipt = async (mimeType: string, base64Data: string) => {
  const savedApiKey = localStorage.getItem('GEMINI_API_KEY')?.trim();
  const fallbackApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "AIzaSyC93qXIy2YbzZqHJoKB0sIvsUeGkw1qHNY";
  const effectiveApiKey = savedApiKey || fallbackApiKey;
  
  if (!effectiveApiKey || effectiveApiKey.length < 10) {
    throw new Error("AI 분석을 위해 '관리 > AI 서비스 설정'에서 Gemini API 키를 등록해 주세요.");
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
  
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
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    const errMsg = error?.message || '';
    if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('does not have permission')) {
      throw new Error("Gemini API 키 권한이 없거나 만료되었습니다. '관리 > AI 서비스 설정'에서 유효한 API 키를 새로 입력해 주세요.");
    }
    throw error;
  }
};
