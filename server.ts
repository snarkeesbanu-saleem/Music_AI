import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded GoogleGenAI helper
let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI {
  if (!genAiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("The required API key (GEMINI_API_KEY) is not defined in your Secrets configuration.");
    }
    genAiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAiClient;
}

// REST endpoints for Composition AI API
app.post("/api/ai/generate-melody", async (req, res) => {
  try {
    const { prompt, keySignature = "C Major", length = 16 } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "A prompt describing the musical mood or style is required." });
      return;
    }

    const ai = getGenAiClient();
    const systemPrompt = `You are an expert AI Music Composer. You compile creative monophonic musical sequences from user descriptions. You output a JSON array of note events representing the generated melody. Ensure note selection follows natural melodic contour, fits the specified key signature, and has a coherent rhythmic flow.`;

    const instructions = `Generate a sequence of notes matching the description: "${prompt}" in the key of "${keySignature}". Ensure the melody has between 12 and ${Math.min(length, 32)} notes.
Available note lengths (durations) are modeled in grid steps of 16th notes:
- 1 step = 16th note
- 2 steps = 8th note
- 4 steps = quarter note
- 8 steps = half note
- 16 steps = whole note

Ensure there is a mixture of durations to make it rhythmically interesting. You can use note value 0 to represent rests. Use MIDI pitches mostly in the vocal/melodic range of index 55 (G3) to 81 (A5).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: instructions,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "A chronological array of musical note objects.",
          items: {
            type: Type.OBJECT,
            properties: {
              pitch: {
                type: Type.INTEGER,
                description: "MIDI note pitch (e.g., 60 for C4, 62 for D4, etc.). Set to 0 for a rest."
              },
              duration: {
                type: Type.INTEGER,
                description: "Note duration in 16th-note steps. 1, 2, 3, 4, 6, 8, or 12."
              },
              name: {
                type: Type.STRING,
                description: "Readable note description (e.g. 'C4 Quarter note', 'Rest Eighth note', 'G#5')"
              }
            },
            required: ["pitch", "duration", "name"]
          }
        },
        temperature: 1.0,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text content received from the composition model.");
    }
    
    const parsedMelody = JSON.parse(text);
    res.json({ success: true, melody: parsedMelody });
  } catch (error: any) {
    console.error("Melody generation error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate melody from standard API model." 
    });
  }
});

app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      res.status(400).json({ error: "An array of musical notes is required for analysis." });
      return;
    }

    const ai = getGenAiClient();
    const systemPrompt = `You are a professional Musicologist. You analyze note sequences and provide clear, engaging, and educational insights on their musical structures, scales, potential chords, rhythmic syncopation, and mood. Keep your analysis concise, structured, and insightful in Markdown.`;

    const melodySummary = notes
      .map((n, idx) => `Step ${idx + 1}: ${n.pitch === 0 ? "Rest" : `MIDI Pitch ${n.pitch} (${n.name || 'Note'})`} (Duration: ${n.duration} steps)`)
      .join("\n");

    const prompt = `Analyze this sequence of notes:\n${melodySummary}\n\nProvide an analysis of:\n1. Melodic Contour & Shape (e.g., steps, leaps, arches, repeating patterns)\n2. Implied Key & Scale Fit\n3. Rhythmic Complexity (e.g. syncopation, speed, pacing)\n4. Harmonization Recommendations (what chords would sit beautifully underneath this?)\n5. Dynamic Music Score rating out of 100 for creativity, melodic balance, and rhythmic variety.\n\nOutput your response in valid JSON matching the specified schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A creative thematic title for the melody based on its vibe (e.g. 'Starlit Promenade', 'Whispering Pines')."
            },
            keySignature: {
              type: Type.STRING,
              description: "The estimated or closest musical key (e.g., 'C Major', 'D Natural Minor')."
            },
            score: {
              type: Type.INTEGER,
              description: "A calculated composition rating from 1 to 100."
            },
            contour: {
              type: Type.STRING,
              description: "Description of the melodic flow and intervals (steps vs leaps)."
            },
            harmony: {
              type: Type.STRING,
              description: "A recommended chord progression matching the timeline of these notes."
            },
            rhythm: {
              type: Type.STRING,
              description: "Analysis of the rhythm, pace, and timing."
            },
            overallFeedback: {
              type: Type.STRING,
              description: "Summary markdown text explaining the artistic and musicological evaluation."
            }
          },
          required: ["title", "keySignature", "score", "contour", "harmony", "rhythm", "overallFeedback"]
        },
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No analysis text received from the evaluation model.");
    }

    const parsedAnalysis = JSON.parse(text);
    res.json({ success: true, analysis: parsedAnalysis });
  } catch (error: any) {
    console.error("Musicology analysis error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to analyze music with the evaluation model." 
    });
  }
});

// Setup Vite Dev Server / Static Files Serve
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully started on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Server failed to bootstrap:", err);
  process.exit(1);
});
