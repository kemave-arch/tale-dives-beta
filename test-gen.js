import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: "A red ball",
      config: { imageConfig: { aspectRatio: '1:1' } }
    });
    console.log("Success:", res.candidates[0].content.parts[0].inlineData.mimeType);
  } catch (e) {
    console.error("Error gemini-3.1-flash-image:", e.message);
  }
}
run();
