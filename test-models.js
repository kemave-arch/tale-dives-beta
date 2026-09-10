import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  for await (const m of await ai.models.list()) {
    if (m.name.includes("image") || m.name.includes("nanobanana")) console.log(m.name);
  }
}
run();
