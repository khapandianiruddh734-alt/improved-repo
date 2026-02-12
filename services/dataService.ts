
import { DuplicateOptions } from '../types';

declare const XLSX: any;

/**
 * Excel to PDF - Enhanced for Multiple Sheets
 */
export async function excelToPdf(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  
  let combinedHtml = '<div style="padding: 20px; font-family: sans-serif;">';
  
  wb.SheetNames.forEach((name: string, index: number) => {
    const sheet = wb.Sheets[name];
    const html = XLSX.utils.sheet_to_html(sheet);
    
    combinedHtml += `
      <div class="sheet-container" style="${index > 0 ? 'page-break-before: always; margin-top: 40px;' : ''}">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
          Sheet: ${name}
        </h2>
        <div style="overflow-x: auto; background: white;">
          ${html}
        </div>
      </div>
    `;
  });
  
  combinedHtml += '</div>';

  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'spreadsheet_export.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      logging: false
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'landscape' 
    }
  };
  
  return await (window as any).html2pdf().set(opt).from(combinedHtml).output('blob');
}

/**
 * Clean Excel with Change Highlighting and Question Mark Removal
 */
export async function cleanExcel(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  
  wb.SheetNames.forEach((name: string) => {
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    const styledData = data.map(row => 
      row.map(cellValue => {
        let cleanedValue = cellValue;
        let wasChanged = false;

        if (typeof cellValue === 'string') {
          // 1. Normalize unicode characters
          // 2. Remove clusters of question marks (OCR artifacts)
          // 3. Remove single question marks (encoding errors)
          // 4. Remove non-printable/non-standard ASCII
          cleanedValue = cellValue.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Diacritics
            .replace(/\?+/g, "")             // Remove ALL question marks as requested
            .replace(/[^\x20-\x7E]/g, "")    // Non-ASCII
            .trim();
          
          if (cleanedValue !== cellValue) {
            wasChanged = true;
          }
        }

        const cell: any = { 
          v: cleanedValue, 
          t: typeof cleanedValue === 'number' ? 'n' : 's' 
        };

        if (wasChanged) {
          cell.s = {
            fill: { fgColor: { rgb: "FFFF00" } }, // Yellow background
            font: { bold: true, color: { rgb: "C2410C" } }, // Dark orange text
            border: {
              top: { style: 'thin', color: { rgb: "000000" } },
              bottom: { style: 'thin', color: { rgb: "000000" } },
              left: { style: 'thin', color: { rgb: "000000" } },
              right: { style: 'thin', color: { rgb: "000000" } }
            }
          };
        }
        return cell;
      })
    );
    
    wb.Sheets[name] = XLSX.utils.aoa_to_sheet(styledData);
  });
  
  const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * Process Duplicates with Smart Variation-Aware Logic
 */
export async function processDuplicates(file: File, options: DuplicateOptions): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const name = wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  const seen = new Set<string>();
  const duplicatesIndices = new Set<number>();
  
  const headers = rows[0] || [];
  const indices = { name: 0, price: -1, variation: -1 };
  headers.forEach((h, i) => {
    const head = String(h || '').toLowerCase();
    if (head.includes('price')) indices.price = i;
    if (head.includes('variation')) indices.variation = i;
    if (head.includes('item_online_displayname') || (head === 'name' && indices.name === 0)) indices.name = i;
  });

  rows.forEach((row, i) => {
    if (i === 0) return; // Skip headers

    let key = "";
    if (options.criteria === 'row') {
      key = JSON.stringify(row);
    } else {
      // Variation-aware "Smart Match"
      const itemName = String(row[indices.name] || '').trim().toLowerCase();
      const price = indices.price !== -1 ? String(row[indices.price] || '').trim().toLowerCase() : '';
      const variation = indices.variation !== -1 ? String(row[indices.variation] || '').trim().toLowerCase() : '';
      
      if (itemName === "") return;
      key = `${itemName}|${variation}|${price}`;
    }

    if (key === "" || key === "[]" || key === "||") return;
    
    if (seen.has(key)) {
      duplicatesIndices.add(i);
    } else {
      seen.add(key);
    }
  });

  const workbook = XLSX.utils.book_new();
  let finalSheet;

  if (options.mode === 'remove') {
    const finalRows = rows.filter((_, i) => !duplicatesIndices.has(i));
    finalSheet = XLSX.utils.aoa_to_sheet(finalRows);
  } else {
    const styledRows = rows.map((row, i) => {
      const isDuplicate = duplicatesIndices.has(i);
      const isHeader = i === 0;
      
      return row.map(cellValue => {
        const cell: any = { v: cellValue, t: typeof cellValue === 'number' ? 'n' : 's' };
        if (isDuplicate && !isHeader) {
          cell.s = {
            fill: { fgColor: { rgb: "FFFF00" } }, // Bright Yellow
            font: { color: { rgb: "991B1B" }, bold: true }, // Dark Red Text
            border: {
              top: { style: 'thin', color: { rgb: "000000" } },
              bottom: { style: 'thin', color: { rgb: "000000" } },
              left: { style: 'thin', color: { rgb: "000000" } },
              right: { style: 'thin', color: { rgb: "000000" } }
            }
          };
        }
        return cell;
      });
    });
    finalSheet = XLSX.utils.aoa_to_sheet(styledRows);
  }

  XLSX.utils.book_append_sheet(workbook, finalSheet, "Processed Data");
  const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * Generic Sheet Exporter
 */
export function exportToExcel(data: any[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}
