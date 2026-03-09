import { GoogleGenerativeAI } from '@google/generative-ai';
import { useState } from 'react';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY as string);

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askGemini = async (prompt: string) => {
    setLoading(true);
    setError(null);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); 
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { askGemini, loading, error };
};