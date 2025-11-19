import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChangeRecord, DiffRegion } from "../types";

const cleanBase64 = (dataUrl: string) => dataUrl.split(',')[1];

export const analyzeDifferences = async (
  imageOld: string,
  imageNew: string,
  diffImage: string,
  diffRegions: DiffRegion[],
  pageNumber: number
): Promise<{ summary: string; changes: ChangeRecord[] }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is not defined");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a specialized IRS Tax Form Compliance Auditor.
    
    I have performed a computer-vision difference check on these documents.
    Image 1: The OLD version.
    Image 2: The NEW version.
    Image 3: The NEW version with detected changes highlighted in RED boxes and labeled with numeric IDs (e.g., "1", "2").

    Your Task:
    1. Look at Image 3 to see where the visual changes are.
    2. Compare Image 1 and Image 2 at those specific locations to understand the context.
    3. Group the visual change IDs into logical semantic changes. 
       - For example, if boxes "1", "2", and "3" are all part of a new paragraph in the instructions, group them as one "Modification".
       - If box "4" is a changed tax rate, that is a separate change.
    4. Provide a structured list of these semantic changes.

    CRITICAL: You must link each semantic change to the specific IDs found in Image 3.
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
            id: { type: Type.STRING, description: "Unique ID for the semantic change (e.g. 'change-1')" },
            type: { type: Type.STRING, enum: ["addition", "deletion", "modification", "layout"] },
            severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
            description: { type: Type.STRING, description: "Detailed description of what changed" },
            section: { type: Type.STRING, description: "Relevant section header or line number" },
            relatedDiffIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of numeric IDs (as strings) from Image 3 that belong to this change."
            }
          },
          required: ["type", "severity", "description", "section", "relatedDiffIds"]
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
          { inlineData: { mimeType: 'image/png', data: cleanBase64(imageOld) } },
          { inlineData: { mimeType: 'image/png', data: cleanBase64(imageNew) } },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(diffImage) } }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text);
    
    // Post-Processing: Map the AI's "relatedDiffIds" back to our precise "diffRegions"
    if (parsed.changes && Array.isArray(parsed.changes)) {
        parsed.changes = parsed.changes.map((change: any) => {
            const relatedIds: string[] = change.relatedDiffIds || [];
            
            // Find all boxes associated with these IDs
            const boxes: number[][] = [];
            
            relatedIds.forEach(rid => {
                // Loose matching (string vs number)
                const region = diffRegions.find(r => r.id.toString() === rid.toString());
                if (region) {
                    boxes.push(region.boundingBox);
                }
            });

            // Filter out duplicates or empty
            if (boxes.length > 0) {
                return { ...change, boundingBoxes: boxes };
            } else {
                // Fallback: If AI hallucinated an ID, we have no box. 
                // Ideally we shouldn't show a box, or maybe the AI made a mistake.
                return change;
            }
        });
    }

    return parsed;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};