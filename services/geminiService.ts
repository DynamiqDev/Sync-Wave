import { GoogleGenAI, Type } from "@google/genai";
import { DEFAULT_SYSTEM_INSTRUCTION } from "../constants";
import { Track, TrackSource } from "../types";
import { v4 as uuidv4 } from 'uuid';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generatePlaylistSuggestions = async (
  currentTrackTitle: string,
  vibe: string
): Promise<Track[]> => {
  const ai = getAiClient();
  if (!ai) {
    console.warn("No API Key found for Gemini");
    return [];
  }

  try {
    const prompt = `Suggest 5 songs that match the vibe: "${vibe}" and are similar to "${currentTrackTitle}". Return a list of songs with their titles and estimated duration.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              artist: { type: Type.STRING },
              durationSeconds: { type: Type.NUMBER },
            },
            required: ["title", "artist", "durationSeconds"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const suggestions = JSON.parse(text);

    // Map to Track interface (Note: These are suggestions, they need a search step to get real IDs, 
    // but for this demo we will treat them as YouTube search queries)
    return suggestions.map((s: any) => ({
      id: uuidv4(),
      source: TrackSource.YOUTUBE,
      title: s.title,
      artist: s.artist,
      url: `${s.title} ${s.artist}`, // In a real app, we'd search YouTube API here
      duration: s.durationSeconds,
      addedBy: 'Gemini AI',
    }));

  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
};
