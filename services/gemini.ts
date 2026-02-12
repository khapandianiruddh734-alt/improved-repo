
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

// --- AI OCR TO EXCEL HEADERS (LATEST USER FORMAT) ---
const OCR_EXCEL_HEADERS = [
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

// Manual sheet fixed item columns (A to Y) + dynamic variation blocks from Z onward.
const MANUAL_FIXED_HEADERS = [
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
];

const VARIATION_BLOCK_HEADERS = [
  "Variation",
  "Variation_Price",
  "Variation_Sap_Code",
  "Variation_Packing_Charges"
];

const VARIATION_DIETARY_RULE = `
VARIATION & ITEM SPLIT RULES (FOR EXTRACTION):
1. DIETARY SPLIT: If slashes represent different dietary types (e.g., "Veg / Chicken"), create SEPARATE items/rows.
2. HOMOGENEOUS VARIATIONS: For the Manual Sheet, place different sizes/prices (e.g., Small, Medium, Large) in the horizontal Variation columns (Columns 29-40).
`;

const MANUAL_SHEET_SYSTEM_PROMPT = `Act as a Menu Data Digitization Expert. 
YOU MUST USE THE EXACT HEADER STRUCTURE PROVIDED BELOW.

STRICT VARIATION RULES FOR MANUAL SHEET:
1. KEEP PREVIOUS VARIATION LOGIC: Preserve the same variation extraction behavior as before.
2. ONE ITEM ROW FOR VARIATIONS: If an item has multiple variations, keep ONE item row and place all variations in horizontal blocks.
3. PRIMARY VARIATION SLOT: Put the first variation in these columns:
   - Variation_group_name
   - Variation
   - Variation_Price
   - Variation_Sap_Code
   - Variation_Packing_Charges
4. SECOND VARIATION START: Add second variation block immediately after AC (after Variation_Packing_Charges).
5. MORE THAN 2 VARIATIONS: Keep appending the same 4-column block after the previous block:
   - Variation
   - Variation_Price
   - Variation_Sap_Code
   - Variation_Packing_Charges
6. DIETARY SPLIT: If variations are dietary (e.g., Veg / Chicken), you MUST create separate rows.
7. MAIN PRICE: If item-level variations exist, set the main "Price" to "0".
8. PRESERVE HEADER: The first row MUST be the exact headers below.
9. NO NULLS: Use empty string "" for missing values.

EXACT HEADERS:
${JSON.stringify([...MANUAL_FIXED_HEADERS, ...VARIATION_BLOCK_HEADERS])}`;

const AI_FIXER_SYSTEM_PROMPT = `Act as a professional Menu Data Correction Expert. 
STRICT OPERATIONAL LIMITS:
1. NO ROW SPLITTING: Keep the input row count exactly the same as the input data.
2. SPELLING FIXES: Fix spelling mistakes ONLY in the "Name" and "Category" columns.
3. JSON OUTPUT: Return a JSON array of arrays starting with the 11-column header.
HEADER (11 COLUMNS): ${JSON.stringify(AI_SHEET_HEADERS)}`;

const AI_SHEET_SYSTEM_PROMPT = `Act as a professional Menu Data Digitization Expert.
YOU MUST OUTPUT THE EXACT HEADER BELOW AS FIRST ROW.
KEEP PREVIOUS VARIATION EXTRACTION LOGIC INTACT.
NO NULLS: Use empty string "" for missing values.

EXACT HEADERS:
${JSON.stringify(OCR_EXCEL_HEADERS)}`;

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
    let finalResult = result;
    if (mode === 'manual') {
      finalResult = normalizeManualSheetResult(result);
    } else {
      // AI mode keeps the fixed latest OCR header.
      finalResult[0] = OCR_EXCEL_HEADERS;
    }
    apiTracker.logRequest({ tool: `AI OCR to Excel (${mode})`, model, status: 'success', errorCategory: 'N/A', latency: Date.now() - startTime, fileCount: inputs.length, fileFormats: inputs.map(i => i.mimeType.split('/').pop() || 'unknown'), inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount, accuracyScore: apiTracker.calculateAccuracy(finalResult) });
    return finalResult;
  } catch (e: any) { throw e; }
}

function normalizeManualSheetResult(rawTable: any[][]): any[][] {
  const rows = Array.isArray(rawTable) ? rawTable : [];
  const dataRows = rows.slice(1).map(r => Array.isArray(r) ? r.map(cell => String(cell ?? "")) : []);

  const fixedLen = MANUAL_FIXED_HEADERS.length;
  const blockLen = VARIATION_BLOCK_HEADERS.length;
  const nameIdx = 0;
  const onlineNameIdx = 1;
  const parentCategoryIdx = 7;
  const categoryIdx = 8;
  const priceIdx = 10;

  const grouped = new Map<string, { base: string[]; blocks: string[][] }>();

  for (const sourceRow of dataRows) {
    const row = [...sourceRow];
    while (row.length < fixedLen + blockLen) row.push("");

    const base = row.slice(0, fixedLen).map(v => String(v ?? ""));
    const key = [
      base[nameIdx],
      base[onlineNameIdx],
      base[parentCategoryIdx],
      base[categoryIdx],
    ].map(v => v.trim().toLowerCase()).join("|");

    const blocks: string[][] = [];
    for (let i = fixedLen; i < row.length; i += blockLen) {
      const block = [
        row[i] || "",
        row[i + 1] || "",
        row[i + 2] || "",
        row[i + 3] || "",
      ];
      if (block[0].trim() !== "" && block[1].trim() === "" && base[priceIdx].trim() !== "") {
        block[1] = base[priceIdx];
      }
      if (block.some(v => String(v).trim() !== "")) {
        blocks.push(block);
      }
    }

    if (!grouped.has(key)) {
      grouped.set(key, { base: [...base], blocks: [] });
    } else {
      // Keep the most complete item record while still merging into one row per item name.
      const existing = grouped.get(key)!;
      for (let i = 0; i < fixedLen; i++) {
        if (existing.base[i].trim() === "" && base[i].trim() !== "") {
          existing.base[i] = base[i];
        }
      }
    }

    const current = grouped.get(key)!;
    for (const block of blocks) {
      const signature = block.map(v => v.trim().toLowerCase()).join("|");
      const alreadyExists = current.blocks.some(
        b => b.map(v => v.trim().toLowerCase()).join("|") === signature
      );
      if (!alreadyExists) current.blocks.push(block);
    }
  }

  let maxBlocks = 1;
  const mergedRows: string[][] = [];

  for (const entry of grouped.values()) {
    const blocks = entry.blocks.length > 0 ? entry.blocks : [["", "", "", ""]];
    if (entry.blocks.length > 0) {
      entry.base[priceIdx] = "0";
    }
    maxBlocks = Math.max(maxBlocks, blocks.length);
    mergedRows.push([...entry.base, ...blocks.flat()]);
  }

  const dynamicHeaders = [...MANUAL_FIXED_HEADERS];
  for (let i = 0; i < maxBlocks; i++) {
    dynamicHeaders.push(...VARIATION_BLOCK_HEADERS);
  }

  const normalizedRows = mergedRows.map(row => {
    const padded = [...row];
    while (padded.length < dynamicHeaders.length) padded.push("");
    return padded.slice(0, dynamicHeaders.length);
  });

  return [dynamicHeaders, ...normalizedRows];
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
