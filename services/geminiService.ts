import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChangeRecord, DiffRegion } from "../types";

const cleanBase64 = (dataUrl: string) => dataUrl.split(',')[1];

/**
 * Transcribe a single PDF page image to markdown
 */
export const transcribePageToMarkdown = async (
  image: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is not defined");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a specialized IRS Tax Form Compliance Auditor with OCR-level accuracy requirements.
    
    Your task is to transcribe the provided PDF page image into Markdown format.
    
    CRITICAL ACCURACY REQUIREMENTS:
    - TRANSCRIBE ONLY WHAT YOU CAN SEE: Only include text that is clearly visible in the image. Do NOT infer, guess, or make up content.
    - EXACT TEXT MATCHING: Copy text character-by-character as it appears. Preserve spacing, line breaks, and formatting exactly.
    - NO HALLUCINATION: If text is blurry, unclear, or partially obscured, transcribe only the visible parts or use "[unclear]" for truly illegible sections.
    - NO INFERENCE: Do not fill in missing information, complete partial words, or add context that isn't explicitly visible.
    - PRESERVE STRUCTURE: Maintain the document structure (headers, tables, lists) as it appears visually.
    
    Output the markdown transcription directly. Do not wrap it in any JSON or additional formatting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return text;
  } catch (error) {
    console.error("Markdown Transcription Error:", error);
    throw error;
  }
};

export const analyzeDifferences = async (
  oldPageMarkdown: string,
  newPageMarkdown: string,
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
    
    I have already transcribed two PDF pages into markdown and performed a computer-vision difference check.
    
    Inputs:
    - Old Page Markdown: The transcribed text from the OLD version
    - New Page Markdown: The transcribed text from the NEW version
    - Image 1: The OLD version with detected changes highlighted in RED boxes and labeled with numeric IDs.
    - Image 2: The NEW version with detected changes highlighted in RED boxes and labeled with numeric IDs.
    - Image 3: A "Diff Mask" where magenta pixels indicate exactly where visual changes occurred.

    Your Task:
    1. COMPARE MARKDOWN: Analyze the differences between the old and new markdown transcriptions.
    2. VISUAL VERIFICATION: Cross-reference with the diff images to identify which visual changes correspond to which text changes.
    3. CHANGE DETECTION: Group the changes into logical semantic changes (e.g. a whole paragraph update, a new line added).
    4. ID ASSIGNMENT: Assign a unique, short ID to each semantic change (e.g., "c1", "c2", "c3").
    5. MARKDOWN TAGGING: 
       - For the OLD markdown: Wrap any text segments that were DELETED or MODIFIED with <change id="c1">text content</change> tags.
       - For the NEW markdown: Wrap any text segments that were ADDED or MODIFIED with <change id="c1">text content</change> tags.
    6. JSON OUTPUT: Provide the structured list of changes.
       - Ensure the "id" field in the JSON object matches the "id" attribute used in the <change> tags.
       - For "originalText" and "revisedText", extract the plain text content from the markdown.

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
        description: "The Old Page Markdown with <change id='...'> tags added for deleted/modified text segments.",
      },
      newPageMarkdown: {
        type: Type.STRING,
        description: "The New Page Markdown with <change id='...'> tags added for added/modified text segments.",
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
              description: "List of numeric IDs (as strings) from the diff images that belong to this change."
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
          { text: `OLD PAGE MARKDOWN:\n\`\`\`\n${oldPageMarkdown}\n\`\`\`` },
          { text: `NEW PAGE MARKDOWN:\n\`\`\`\n${newPageMarkdown}\n\`\`\`` },
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

    // Return with the tagged markdown
    return {
      summary: parsed.summary,
      changes: parsed.changes,
      oldPageMarkdown: parsed.oldPageMarkdown,
      newPageMarkdown: parsed.newPageMarkdown
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};