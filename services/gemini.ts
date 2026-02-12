
import { GoogleGenAI, Type } from "@google/genai";
import { apiTracker } from "./apiTracker";

// Declare process for TS since we're in a browser environment but using Vite/System injection
declare const process: {
  env: {
    API_KEY: string;
  };
};

/**
 * Creates a new instance of the AI client. 
 * Initializing inside each service call ensures we pick up any runtime changes 
 * to process.env.API_KEY from the selection bridge.
 */
const createClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- AI SHEET HEADERS (11 COLUMNS) ---
const AI_SHEET_HEADERS = ["Name", "Item_Online_DisplayName", "Variation_Name", "Price", "Category", "Category_Online_DisplayName", "Short_Code", "Short_Code_2", "Description", "Attributes", "Goods_Services"];

// --- MANUAL SHEET HEADERS (40 COLUMNS) ---
const MANUAL_SHEET_HEADERS = [
  "Name", "Online_Nam", "Description", "Short_Code", "Short_Code", "Sap_Code", "HSN_Code", "Parent_Cat", "Category", "Category_o", 
  "Price", "Attributes", "Goods_Sen", "GST% (Allo", "Type (F=for", "(Optional)", "Unit", "is_Self_Iter", "minimum_s", "at_par_stoc", 
  "Rank", "Packing_Ch", "Allow_Deci", "Addon_Gro", "Addon_Gro", "Addon_Gro", "Addon_Gro", "Variation_g", 
  "Variation", "Variation_P", "Variation_S", "Variation_P", 
  "Variation", "Variation_P", "Variation_S", "Variation_P", 
  "Variation", "Variation_P", "Variation_S", "Variation_P"
];

const VARIATION_DIETARY_RULE = `
VARIATION & ITEM SPLIT RULES (FOR EXTRACTION):
1. DIETARY SPLIT: If slashes represent different dietary types (e.g., "Veg / Chicken"), create SEPARATE items/rows.
2. HOMOGENEOUS VARIATIONS: For the Manual Sheet, place different sizes/prices (e.g., Small, Medium, Large) in the horizontal Variation columns (Columns 29-40).
`;

const MANUAL_SHEET_SYSTEM_PROMPT = `Act as a Menu Data Digitization Expert. 
YOU MUST USE THE EXACT 40-COLUMN HEADER STRUCTURE PROVIDED BELOW.

STRICT VARIATION RULES FOR MANUAL SHEET:
1. HORIZONTAL VARIATIONS: If an item has up to 3 variations (e.g., Small, Medium, Large), place them horizontally in the Variation columns:
   - Variation Set 1: Columns 29-32
   - Variation Set 2: Columns 33-36
   - Variation Set 3: Columns 37-40
2. DIETARY SPLIT: If variations are dietary (e.g., Veg / Chicken), you MUST still create SEPARATE rows.
3. MAIN PRICE: If an item has variations in columns 29-40, set the main "Price" (Column 11) to "0".
4. PRESERVE HEADER: The first row of your JSON array MUST be the exact headers provided below.
5. NO NULLS: Use empty string "" for missing values.

EXACT HEADERS (40 COLUMNS): 
${JSON.stringify(MANUAL_SHEET_HEADERS)}`;

const AI_FIXER_SYSTEM_PROMPT = `Act as a professional Menu Data Correction Expert. 
STRICT OPERATIONAL LIMITS:
1. NO ROW SPLITTING: Keep the input row count exactly the same as the input data.
2. SPELLING FIXES: Fix spelling mistakes ONLY in the "Name" and "Category" columns.
3. JSON OUTPUT: Return a JSON array of arrays starting with the 11-column header.
HEADER (11 COLUMNS): ${JSON.stringify(AI_SHEET_HEADERS)}`;

const AI_SHEET_SYSTEM_PROMPT = `Act as a professional Menu Data Digitization Expert. 
HEADER (11 COLUMNS): ${JSON.stringify(AI_SHEET_HEADERS)}
- Category_Online_DisplayName: Sequential number.
- Goods_Services: "Services".`;

export async function aiLabSmartParse(text: string): Promise<any[]> {
  const startTime = Date.now();
  const ai = createClient();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Extract menu items from: ${text}\n\n${VARIATION_DIETARY_RULE}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              name: { type: Type.STRING },
              variation: { type: Type.STRING },
              attributes: { type: Type.STRING },
              price: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["category", "name", "attributes", "price"]
          }
        }
      }
    });
    const result = JSON.parse(response.text || "[]");
    apiTracker.logRequest({ tool: 'AI Lab Smart Parse', model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: 1, fileFormats: ['txt'], inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
    return result;
  } catch (e: any) { throw e; }
}

export async function aiFixMenuData(data: any[][]): Promise<any[][]> {
  const startTime = Date.now();
  const ai = createClient();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${AI_FIXER_SYSTEM_PROMPT}\n\nInput Data: ${JSON.stringify(data)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
      }
    });
    const result = JSON.parse(response.text || "[]");
    apiTracker.logRequest({ tool: 'AI Menu Fixer', model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: 1, fileFormats: ['xlsx'], inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount, accuracyScore: apiTracker.calculateAccuracy(result) });
    return result;
  } catch (e: any) { throw e; }
}

export async function aiTranslateData(data: any[][], targetLanguage: string, scope: 'names' | 'categories' | 'both'): Promise<any[][]> {
  const startTime = Date.now();
  const ai = createClient();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Translate to ${targetLanguage}. Scope: ${scope}. Data: ${JSON.stringify(data)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
      }
    });
    const result = JSON.parse(response.text || "[]");
    apiTracker.logRequest({ tool: `AI Translator`, model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: 1, fileFormats: ['xlsx'], inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
    return result;
  } catch (e: any) { throw e; }
}

export async function aiExtractToExcel(inputs: { data: string, mimeType: string, text?: string }[], language: string, mode: 'ai' | 'manual', isDeepScan: boolean): Promise<any[][]> {
  const startTime = Date.now();
  const ai = createClient();
  const model = 'gemini-3-flash-preview';
  const systemPrompt = mode === 'ai' ? AI_SHEET_SYSTEM_PROMPT : MANUAL_SHEET_SYSTEM_PROMPT;
  const deepPrompt = isDeepScan ? "\nDEEP SCAN: Pay extra attention to handwritten or complex layouts." : "";
  try {
    const parts: any[] = inputs.map(input => input.text ? { text: input.text } : { inlineData: { data: input.data, mimeType: input.mimeType } });
    parts.push({ text: `${systemPrompt}${deepPrompt}\nLanguage: ${language}. Extract all items as a consolidated table starting with the headers provided.` });
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
      }
    });
    const result = JSON.parse(response.text || "[[]]");
    apiTracker.logRequest({ tool: `AI OCR to Excel (${mode})`, model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: inputs.length, fileFormats: inputs.map(i => i.mimeType.split('/').pop() || 'unknown'), inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount, accuracyScore: apiTracker.calculateAccuracy(result) });
    return result;
  } catch (e: any) { throw e; }
}

export async function aiSummarizeDoc(text: string, images: { data: string, mimeType: string }[] = []): Promise<string> {
  const startTime = Date.now();
  const ai = createClient();
  const model = images.length > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  try {
    const parts: any[] = [];
    if (text) parts.push({ text: text.substring(0, 15000) });
    images.forEach(img => parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
    parts.push({ text: `Analyze document pricing, trends, and dish composition.` });
    const response = await ai.models.generateContent({ model, contents: { parts } });
    apiTracker.logRequest({ tool: 'AI Summarizer', model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: 1 + images.length, fileFormats: ['mixed'], inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
    return response.text || "Summary failed.";
  } catch (e: any) { throw e; }
}
