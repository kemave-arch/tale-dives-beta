import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: "A red ball",
      config: { imageConfig: { aspectRatio: '1:1' } }
    });
    console.log("Success 2.5:", res.candidates[0].content.parts[0].inlineData.mimeType);
  } catch (e) {
    console.error("Error 2.5:", e.message);
  }
}
run();
