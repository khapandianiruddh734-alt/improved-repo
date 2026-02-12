
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

// --- MANUAL SHEET HEADERS (USER FORMAT) ---
const MANUAL_SHEET_HEADERS = [
  "Name",
  "Online_Name",
  "Description",
  "Short_Code",
  "Short_Code_2",
  "Sap_Code",
  "HSN_Code",
  "Parent_Category",
  "Category",
  "Category_online_display",
  "Price",
  "Attributes",
  "Goods_Services",
  "Unit",
  "is_Self_Item_Recipe",
  "minimum_stock_level",
  "at_par_stock_level",
  "Rank",
  "Packing_Charges",
  "Allow_Decimal_Qty",
  "Addon_Group_Name",
  "Addon_Group_Selection",
  "Addon_Group_Min",
  "Addon_Group_Max",
  "Variation_group_name",
  "Variation",
  "Variation_Price",
  "Variation_Sap_Code",
  "Variation_Packing_Charges",
  "#If there is a need for addon in variation than enter from this column onwards"
];

const VARIATION_DIETARY_RULE = `
VARIATION & ITEM SPLIT RULES (FOR EXTRACTION):
1. DIETARY SPLIT: If slashes represent different dietary types (e.g., "Veg / Chicken"), create SEPARATE items/rows.
2. HOMOGENEOUS VARIATIONS: For the Manual Sheet, place different sizes/prices (e.g., Small, Medium, Large) in the horizontal Variation columns (Columns 29-40).
`;

const MANUAL_SHEET_SYSTEM_PROMPT = `Act as a Menu Data Digitization Expert. 
YOU MUST USE THE EXACT 40-COLUMN HEADER STRUCTURE PROVIDED BELOW.

STRICT VARIATION RULES FOR MANUAL SHEET:
1. KEEP PREVIOUS VARIATION LOGIC: Preserve the same variation extraction behavior as before.
2. PRIMARY VARIATION SLOT: Put the first variation in these columns:
   - Variation_group_name
   - Variation
   - Variation_Price
   - Variation_Sap_Code
   - Variation_Packing_Charges
3. ADDITIONAL VARIATIONS / ADDON-IN-VARIATION: If more variation blocks are needed, continue to the right starting from:
   - "#If there is a need for addon in variation than enter from this column onwards"
4. DIETARY SPLIT: If variations are dietary (e.g., Veg / Chicken), you MUST create separate rows.
5. MAIN PRICE: If item-level variations exist, set the main "Price" to "0".
6. PRESERVE HEADER: The first row MUST be the exact headers below.
7. NO NULLS: Use empty string "" for missing values.

EXACT HEADERS:
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
    const raw = JSON.parse(response.text || "[[]]");
    const result = Array.isArray(raw) ? raw : [[]];
    if (mode === 'manual') {
      // Enforce exact requested header format while keeping extracted rows untouched.
      result[0] = MANUAL_SHEET_HEADERS;
    }
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
