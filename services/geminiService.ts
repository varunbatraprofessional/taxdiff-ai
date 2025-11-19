import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChangeRecord, DiffRegion } from "../types";

const cleanBase64 = (dataUrl: string) => dataUrl.split(',')[1];

export const analyzeDifferences = async (
  imageOld: string,
  imageNew: string,
  diffImageOld: string,
  diffImageNew: string,
  maskImage: string,
  diffRegions: DiffRegion[],
  pageNumber: number
): Promise<{ summary: string; changes: ChangeRecord[]; oldPageMarkdown: string; newPageMarkdown: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is not defined");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a specialized IRS Tax Form Compliance Auditor.
    
    I have performed a computer-vision difference check on these documents.
    
    Inputs:
    Image 1: The OLD version (Original).
    Image 2: The NEW version.
    Image 3: The OLD version with detected changes highlighted in RED boxes and labeled with numeric IDs.
    Image 4: The NEW version with detected changes highlighted in RED boxes and labeled with numeric IDs.
    Image 5: A "Diff Mask" where magenta pixels indicate exactly where visual changes occurred.

    Your Task:
    1. VISUAL ANALYSIS: Look at the provided images to identify visual changes.
    2. CHANGE DETECTION: Group the visual changes into logical semantic changes (e.g. a whole paragraph update, a new line added).
    3. ID ASSIGNMENT: Assign a unique, short ID to each semantic change (e.g., "c1", "c2", "c3").
    4. MARKDOWN TRANSCRIPTION (OLD): Transcribe the full text of Image 1 (Old Version) into Markdown.
       - CRITICAL: Wrap any text segments that were DELETED or MODIFIED in a specific XML tag using the assigned ID: <change id="c1">text content</change>.
    5. MARKDOWN TRANSCRIPTION (NEW): Transcribe the full text of Image 2 (New Version) into Markdown.
       - CRITICAL: Wrap any text segments that were ADDED or MODIFIED in a specific XML tag using the assigned ID: <change id="c1">text content</change>.
    6. JSON OUTPUT: Provide the structured list of changes.
       - Ensure the "id" field in the JSON object matches the "id" attribute used in the <change> tags.
       - For "originalText" and "revisedText", extract the plain text content inside the tags.

    Note: The <change> tags in the markdown are essential for the frontend to highlight the exact differences.
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "A concise executive summary of the changes on this page.",
      },
      oldPageMarkdown: {
        type: Type.STRING,
        description: "Full Markdown of the Old Page, containing <change id='...'> tags for deleted/modified text.",
      },
      newPageMarkdown: {
        type: Type.STRING,
        description: "Full Markdown of the New Page, containing <change id='...'> tags for added/modified text.",
      },
      changes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (e.g. 'c1') matching the tags in markdown." },
            type: { type: Type.STRING, enum: ["addition", "deletion", "modification", "layout"] },
            severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
            description: { type: Type.STRING, description: "Detailed description of what changed" },
            section: { type: Type.STRING, description: "Relevant section header or line number" },
            originalText: { type: Type.STRING, description: "The plain text content from the Old version." },
            revisedText: { type: Type.STRING, description: "The plain text content from the New version." },
            relatedDiffIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of numeric IDs (as strings) from Image 3 that belong to this change."
            }
          },
          required: ["id", "type", "severity", "description", "section", "relatedDiffIds", "originalText", "revisedText"]
        }
      }
    },
    required: ["summary", "changes", "oldPageMarkdown", "newPageMarkdown"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: cleanBase64(imageOld) } },
          { inlineData: { mimeType: 'image/png', data: cleanBase64(imageNew) } },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(diffImageOld) } },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(diffImageNew) } },
          { inlineData: { mimeType: 'image/png', data: cleanBase64(maskImage) } }
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