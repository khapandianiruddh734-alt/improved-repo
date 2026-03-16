import { CompressionLevel } from '../types';

declare const jspdf: any;
declare const pdfjsLib: any;
declare const html2pdf: any;
declare const mammoth: any;
declare const PDFLib: any;
declare const XLSX: any;

/**
 * JPG/PNG to PDF
 */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) {
    throw new Error('No images provided.');
  }

  let doc: any;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imgData = await fileToDataUrl(file);
    const img = await loadImage(imgData);

    // Keep each page in the same orientation/aspect as the source image.
    const pageWidth = img.naturalWidth || img.width;
    const pageHeight = img.naturalHeight || img.height;
    const orientation = pageWidth > pageHeight ? 'l' : 'p';

    if (!doc) {
      doc = new jspdf.jsPDF({
        orientation,
        unit: 'pt',
        format: [pageWidth, pageHeight],
      });
    } else {
      doc.addPage([pageWidth, pageHeight], orientation);
    }

    // Preserve input format behavior (PNG stays PNG, JPEG stays JPEG) with no rotation.
    const format = file.type === 'image/png' ? 'PNG' : 'JPEG';
    doc.addImage(imgData, format, 0, 0, pageWidth, pageHeight, undefined, 'NONE', 0);
  }

  return doc.output('blob');
}

/**
 * Edit PDF (Reorder, Remove, Merge)
 */
export async function editPdf(pages: { file: File, originalPageIndex: number, isImage?: boolean, rotation?: number }[]): Promise<Blob> {
  const mergedPdf = await PDFLib.PDFDocument.create();
  
  const docCache = new Map<string, any>();
  const degrees = (value: number) => PDFLib.degrees(value);

  for (const pageInfo of pages) {
    const rotation = pageInfo.rotation || 0;

    if (pageInfo.isImage || pageInfo.file.type.startsWith('image/')) {
      const imageBytes = await pageInfo.file.arrayBuffer();
      const imageType = pageInfo.file.type.toLowerCase();
      const isPng = imageType.includes('png');
      const embeddedImage = isPng
        ? await mergedPdf.embedPng(imageBytes)
        : await mergedPdf.embedJpg(imageBytes);

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const pdfPage = mergedPdf.addPage([imgWidth, imgHeight]);

      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
      });
      pdfPage.setRotation(degrees(rotation));
      continue;
    }

    const fileId = pageInfo.file.name + pageInfo.file.size;
    let srcDoc = docCache.get(fileId);
    
    if (!srcDoc) {
      const arrayBuffer = await pageInfo.file.arrayBuffer();
      srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      docCache.set(fileId, srcDoc);
    }

    const [copiedPage] = await mergedPdf.copyPages(srcDoc, [pageInfo.originalPageIndex]);
    copiedPage.setRotation(degrees(rotation));
    mergedPdf.addPage(copiedPage);
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Word to PDF (Docx to PDF)
 */
export async function wordToPdf(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = `
    <div style="padding: 40px; font-family: 'Inter', sans-serif; line-height: 1.6; color: #1e293b;">
      ${result.value}
    </div>
  `;

  const opt = {
    margin: 10,
    filename: file.name.replace('.docx', '.pdf'),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  return await (window as any).html2pdf().set(opt).from(html).output('blob');
}

/**
 * PDF Compression
 */
export async function compressPdf(file: File, level: CompressionLevel = 'Standard'): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buffer).promise;
  
  const settings = {
    'Standard': { scale: 2.0, quality: 0.85 }, 
    'High': { scale: 1.5, quality: 0.65 }, 
    'Maximum': { scale: 1.0, quality: 0.45 } 
  }[level];

  let doc: any;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const originalViewport = page.getViewport({ scale: 1 });
    const width = originalViewport.width;
    const height = originalViewport.height;
    
    const renderViewport = page.getViewport({ scale: settings.scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
    }
    
    await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    const imgData = canvas.toDataURL('image/jpeg', settings.quality);

    if (i === 1) {
      doc = new jspdf.jsPDF({
        orientation: width > height ? 'l' : 'p',
        unit: 'pt',
        format: [width, height]
      });
    } else {
      doc.addPage([width, height], width > height ? 'l' : 'p');
    }

    doc.addImage(imgData, 'JPEG', 0, 0, width, height, undefined, 'FAST');
  }
  
  return doc.output('blob');
}

/**
 * PDF to JPG Zip
 */
export async function pdfToJpgs(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buffer).promise;
  const zip = new (window as any).JSZip();
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    
    const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    zip.file(`page-${i}.jpg`, base64, { base64: true });
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * PDF to EXCEL
 */
export async function pdfToExcel(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buffer).promise;
  const wb = XLSX.utils.book_new();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items;

    // 🔧 FIXED HERE
    const xStarts: number[] = items.map((it: any) => Math.round(it.transform[4]));
    xStarts.sort((a: number, b: number) => a - b);

    const colStarts: number[] = [];
    if (xStarts.length > 0) {
      colStarts.push(xStarts[0]);
      for (let j = 1; j < xStarts.length; j++) {
        if (xStarts[j] - colStarts[colStarts.length - 1] > 15) {
          colStarts.push(xStarts[j]);
        }
      }
    }

    const rowsMap = new Map<number, any[]>();
    items.forEach((item: any) => {
      const y = Math.round(item.transform[5]);
      if (!rowsMap.has(y)) rowsMap.set(y, []);
      rowsMap.get(y)?.push(item);
    });

    const sortedY = Array.from(rowsMap.keys()).sort((a: number, b: number) => b - a);
    const grid: string[][] = [];

    sortedY.forEach(y => {
      const rowItems = rowsMap.get(y) || [];
      const rowData = new Array(colStarts.length).fill("");

      rowItems.forEach((item: any) => {
        const x = item.transform[4];
        let colIdx = colStarts.length - 1;

        for (let j = 0; j < colStarts.length - 1; j++) {
          if (x < (colStarts[j] + colStarts[j + 1]) / 2) {
            colIdx = j;
            break;
          }
        }

        rowData[colIdx] = (rowData[colIdx] + " " + item.str).trim();
      });

      if (rowData.some(cell => cell !== "")) {
        grid.push(rowData);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(grid);
    XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
  }

  const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Extract Text from PDF
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buffer).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it: any) => it.str).join(' ') + "\n";
  }

  return fullText;
}

// Helpers
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}
