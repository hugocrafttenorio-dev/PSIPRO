import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const enhanceClinicalNotes = async (text: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Erro: Chave de API não configurada.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Atue como um assistente profissional para psicólogos.
      Melhore o seguinte texto de anotação clínica, tornando-o mais formal, 
      organizado e profissional, mantendo a confidencialidade e a essência da informação.
      
      Texto original: "${text}"
      
      Retorne apenas o texto melhorado.`,
    });
    return response.text || text;
  } catch (error) {
    console.error("Erro na IA:", error);
    return text; // Fallback to original
  }
};
