import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI client directly on the frontend.
// In a real production app, it is highly recommended to proxy these requests through a backend
// to avoid exposing your API key to the client.
export const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});
