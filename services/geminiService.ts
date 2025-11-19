import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChangeRecord } from "../types";

const cleanBase64 = (dataUrl: string) => dataUrl.split(',')[1];

export const analyzeDifferences = async (
  imageOld: string,
  imageNew: string,
  pageNumber: number
): Promise<{ summary: string; changes: ChangeRecord[] }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is not defined");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a specialized IRS Tax Form Compliance Auditor.
    Analyze these two images of tax documents. The first image is the OLD version. The second image is the NEW version.
    
    Your goal is to identify changes in:
    1. Line items (numbers, text descriptions).
    2. Tax rates or tables.
    3. Layout structures (moved boxes, resized sections).
    4. Instructions or legal text.

    Provide a summary of the main changes, and then a structured list of specific detected differences.
    
    For each specific change, try to estimate a bounding box for where the change occurred on the NEW form (the second image).
    The bounding box should be [ymin, xmin, ymax, xmax] as integers from 0 to 100 (percentages of the page height/width).
    
    Example Bounding Box: Top left corner 10% size would be [0, 0, 10, 10].
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "A concise executive summary of the changes on this page.",
      },
      changes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID for the change" },
            type: { type: Type.STRING, enum: ["addition", "deletion", "modification", "layout"] },
            severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
            description: { type: Type.STRING, description: "Detailed description of what changed" },
            section: { type: Type.STRING, description: "Relevant section header or line number (e.g. 'Part I, Line 4')" },
            boundingBox: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Array of 4 numbers [ymin, xmin, ymax, xmax] representing percentage coordinates (0-100)."
            }
          },
          required: ["type", "severity", "description", "section"]
        }
      }
    },
    required: ["summary", "changes"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(imageOld)
            }
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64(imageNew)
            }
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster, direct visual analysis
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text);
    return parsed;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};