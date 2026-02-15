
import React, { useState, useRef, useEffect } from 'react';
import { Tool, ProcessingState, DuplicateOptions, CompressionLevel } from '../types';
import * as pdfService from '../services/pdfService';
import * as dataService from '../services/dataService';
import * as geminiService from '../services/gemini';
import { apiTracker } from '../services/apiTracker';
import { MenuQALab } from './MenuQALab';

interface WorkspaceProps {
  tool: Tool;
}

interface PdfPage {
  id: string;
  file: File;
  originalPageIndex: number;
  thumbnail: string;
  isImage?: boolean;
  rotation: number;
  sourceFileKey: string;
  sourceFileName: string;
}

const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German', 
  'Chinese (Simplified)', 'Japanese', 'Arabic', 'Russian', 'Portuguese',
  'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Malayalam'
];

export const Workspace: React.FC<WorkspaceProps> = ({ tool }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({ status: 'idle', message: '' });
  const [compLevel, setCompLevel] = useState<CompressionLevel>('Standard');
  const [ocrLang, setOcrLang] = useState<string>('English');
  const [targetLang, setTargetLang] = useState<string>('English');
  const [transScope, setTransScope] = useState<'names' | 'categories' | 'both'>('both');
  const [ocrMode, setOcrMode] = useState<'ai' | 'manual'>('ai');
  const [isDeepScan, setIsDeepScan] = useState(false);
  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const architectFileInputRef = useRef<HTMLInputElement>(null);

  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [isArchitectMode, setIsArchitectMode] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);

  const [gridData, setGridData] = useState<any[][]>([]);
  const [isGridMode, setIsGridMode] = useState(false);
  const [dupOptions, setDupOptions] = useState<DuplicateOptions>({ criteria: 'row', mode: 'highlight' });
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());

  const [hasApiKey, setHasApiKey] = useState<boolean>(true); // Optimistically true, checked on use

  useEffect(() => {
    // Check key status on mount if tool is AI
    if (tool.category === 'AI') {
      checkKeyInitial();
    }
  }, [tool]);

  const checkKeyInitial = async () => {
    const aiStudio = (window as any).aistudio;
    const bridgeSelected = await aiStudio?.hasSelectedApiKey();
    const envPresent = !!process.env.API_KEY && process.env.API_KEY !== "undefined";
    setHasApiKey(bridgeSelected || envPresent);
  };

  const handleOpenKeyBridge = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio?.openSelectKey) {
      await aiStudio.openSelectKey();
      // Assume success after trigger to mitigate race conditions as per guidelines
      setHasApiKey(true); 
    }
  };

  const getColIndices = (headers: any[]) => {
    const indices = { name: 0, price: -1, variation: -1 };
    headers.forEach((h, i) => {
      const head = String(h || '').toLowerCase();
      if (head.includes('price')) indices.price = i;
      if (head.includes('variation')) indices.variation = i;
      if (head.includes('item_online_displayname') || (head === 'name' && indices.name === 0)) indices.name = i;
    });
    return indices;
  };

  useEffect(() => {
    if (isGridMode && gridData.length > 0) {
      const seen = new Set<string>();
      const dups = new Set<number>();
      const headers = gridData[0];
      const indices = getColIndices(headers);
      
      gridData.forEach((row, i) => {
        if (i === 0) return; 
        
        let key = "";
        if (dupOptions.criteria === 'row') {
          key = JSON.stringify(row);
        } else {
          const name = String(row[indices.name] || '').trim().toLowerCase();
          const price = indices.price !== -1 ? String(row[indices.price] || '').trim().toLowerCase() : '';
          const variation = indices.variation !== -1 ? String(row[indices.variation] || '').trim().toLowerCase() : '';
          
          if (name === "") return; 
          key = `${name}|${variation}|${price}`;
        }
        
        if (key === "" || key === "[]" || key === '""' || key === "||") return;
        
        if (seen.has(key)) {
          dups.add(i);
        } else {
          seen.add(key);
        }
      });
      setDuplicateIndices(dups);
    }
  }, [gridData, dupOptions, isGridMode]);

  const resetWorkspace = () => {
    if (tool.id === 'menu-qa-lab') {
      if (confirm("Reset Menu QA Lab? All unsaved data and history will be lost.")) {
        localStorage.removeItem('menu_qa_lab_data');
        setResetKey(prev => prev + 1);
      }
      return;
    }

    setFiles([]);
    setProcessing({ status: 'idle', message: '' });
    setPreviewData(null);
    setSummaryText(null);
    setPdfPages([]);
    setIsArchitectMode(false);
    setSelectedPageIds(new Set());
    setDraggingPageId(null);
    setGridData([]);
    setIsGridMode(false);
    setDuplicateIndices(new Set());
    setIsDeepScan(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files) as File[]);
  };

  const handleArchitectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files) as File[];
    const pages = await processInputFilesToPages(incoming);
    setPdfPages(prev => [...prev, ...pages]);
    setSelectedPageIds(new Set());
    e.target.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => file && file.size > 0);
    setFiles(prev => tool.multiple ? [...prev, ...validFiles] : validFiles);
  };

  const preprocessImage = async (file: File): Promise<{ data: string, mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ data: (e.target?.result as string).split(',')[1], mimeType: file.type });
            return;
          }

          const MAX_DIM = 2400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.filter = 'contrast(1.2) brightness(1.05) grayscale(1)';
          ctx.drawImage(img, 0, 0, width, height);

          resolve({ 
            data: canvas.toDataURL('image/jpeg', 0.95).split(',')[1], 
            mimeType: 'image/jpeg' 
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const processFile = async () => {
    if (files.length === 0) return;
    
    const startTime = Date.now();
    setProcessing({ status: 'processing', message: 'Initiating operation...' });
    setPreviewData(null);
    setSummaryText(null);

    try {
      let resultBlob: Blob | undefined;
      let resultFilename = 'result.pdf';

      if (tool.id === 'duplicate-remover') {
        const buffer = await files[0].arrayBuffer();
        const wb = (window as any).XLSX.read(buffer);
        const data = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
        setGridData(data);
        setIsGridMode(true);
        setProcessing({ status: 'idle', message: '' });
        return;
      }

      if (tool.id === 'pdf-menu-architect') {
        const pages = await processInputFilesToPages(files);
        setPdfPages(pages);
        setSelectedPageIds(new Set());
        setDraggingPageId(null);
        setIsArchitectMode(true);
        setProcessing({ status: 'idle', message: '' });
        return;
      }

      switch (tool.id) {
        case 'jpg-to-pdf':
          resultBlob = await pdfService.imagesToPdf(files);
          resultFilename = 'combined_images.pdf';
          break;
        case 'word-to-pdf':
          resultBlob = await pdfService.wordToPdf(files[0]);
          resultFilename = `${files[0].name.split('.')[0]}.pdf`;
          break;
        case 'compress-pdf':
          resultBlob = await pdfService.compressPdf(files[0], compLevel);
          resultFilename = `compressed_${files[0].name}`;
          break;
        case 'pdf-to-jpg':
          resultBlob = await pdfService.pdfToJpgs(files[0]);
          resultFilename = 'extracted_pages.zip';
          break;
        case 'pdf-to-excel':
          resultBlob = await pdfService.pdfToExcel(files[0]);
          resultFilename = `${files[0].name.split('.')[0]}.xlsx`;
          break;
        case 'excel-to-pdf':
          resultBlob = await dataService.excelToPdf(files[0]);
          resultFilename = 'spreadsheet.pdf';
          break;
        case 'clean-excel':
          resultBlob = await dataService.cleanExcel(files[0]);
          resultFilename = 'cleaned_data.xlsx';
          break;
        case 'ai-menu-fixer': {
          const buffer = await files[0].arrayBuffer();
          const wb = (window as any).XLSX.read(buffer);
          const grid = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
          const restructuredData = await geminiService.aiFixMenuData(grid);
          setPreviewData(restructuredData);
          setProcessing({ status: 'success', message: 'Menu Formatting Complete!', details: 'Preview your data before exporting.' });
          return;
        }
        case 'ai-data-translator': {
          const buffer = await files[0].arrayBuffer();
          const wb = (window as any).XLSX.read(buffer);
          const grid = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
          const translatedData = await geminiService.aiTranslateData(grid, targetLang, transScope);
          setPreviewData(translatedData);
          setProcessing({ status: 'success', message: `Translation into ${targetLang} Complete!`, details: `Scope: ${transScope === 'both' ? 'Names & Categories' : transScope.toUpperCase()}` });
          return;
        }
        case 'pdf-img-to-excel': {
          setProcessing({ 
            status: 'processing', 
            message: 'Deconstructing grid layout and extracting menu intelligence...' 
          });
          
          const inputs = await Promise.all(files.map(async f => {
            const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || f.type === 'application/vnd.ms-excel';
            
            if (f.type.startsWith('image/')) {
              return await preprocessImage(f);
            } else if (isExcel) {
              const buffer = await f.arrayBuffer();
              const wb = (window as any).XLSX.read(buffer);
              let allSheetText = "";
              wb.SheetNames.forEach((sheetName: string) => {
                const sheet = wb.Sheets[sheetName];
                const json = (window as any).XLSX.utils.sheet_to_json(sheet, { header: 1 });
                allSheetText += `SHEET: ${sheetName}\n${JSON.stringify(json)}\n\n`;
              });
              return { 
                data: '', 
                mimeType: 'text/spreadsheet', 
                text: allSheetText 
              };
            } else {
              const reader = new FileReader();
              const b64Promise = new Promise<string>((resolve) => {
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(f);
              });
              return { data: await b64Promise, mimeType: f.type };
            }
          }));

          const extracted = await geminiService.aiExtractToExcel(inputs, ocrLang, ocrMode, isDeepScan);
          setPreviewData(extracted);
          setProcessing({ status: 'success', message: 'AI Grid Extraction Complete!', details: `Successfully mapped ${files.length} file(s) into consolidated format.` });
          return;
        }
        case 'ai-document-summary': {
          const imageFiles = files.filter(f => f.type.startsWith('image/'));
          const docFiles = files.filter(f => !f.type.startsWith('image/'));
          
          setProcessing({ status: 'processing', message: 'Analyzing Intelligence...' });

          let textContent = "";
          for (const doc of docFiles) {
            if (doc.type === 'application/pdf') {
              textContent += await pdfService.extractPdfText(doc) + "\n";
            } else {
              textContent += await doc.text() + "\n";
            }
          }

          const imageInputs = await Promise.all(imageFiles.map(async f => {
            const reader = new FileReader();
            const b64Promise = new Promise<string>((resolve) => {
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(f);
            });
            return { data: await b64Promise, mimeType: f.type };
          }));

          const summary = await geminiService.aiSummarizeDoc(textContent, imageInputs);
          setSummaryText(summary);
          setProcessing({ status: 'success', message: 'Audit Results Ready!', details: 'Deep reasoning analysis complete.' });
          return;
        }
        default: throw new Error('Tool logic not implemented.');
      }

      if (resultBlob) {
        setProcessing({ status: 'success', message: 'Completed!', details: 'File ready.', resultBlob, resultFilename });
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("entity was not found") || msg.includes("api key") || msg.includes("invalid")) {
        setHasApiKey(false);
      }
      const quotaError =
        msg.includes("quota exceeded") ||
        msg.includes("resource_exhausted") ||
        msg.includes("billing");
      setProcessing({
        status: 'error',
        message: quotaError ? 'Gemini Quota Exceeded' : 'Operation Failed',
        details: err.message,
      });
    }
  };

  const handleDownload = () => {
    if (previewData) {
      dataService.exportToExcel(previewData, `achievers_${tool.id}_export.xlsx`);
      return;
    }
    processing.resultBlob && (window as any).saveAs(processing.resultBlob, processing.resultFilename);
  };

  const finalizeDuplicateRemoval = async () => {
    setProcessing({ status: 'processing', message: 'Refining dataset...' });
    try {
      const blob = await dataService.processDuplicates(files[0], dupOptions);
      setProcessing({ 
        status: 'success', 
        message: dupOptions.mode === 'highlight' ? 'Highlights Applied!' : 'Duplicates Removed!', 
        details: `${duplicateIndices.size} duplicates identified.`, 
        resultBlob: blob, 
        resultFilename: `${dupOptions.mode === 'highlight' ? 'highlighted' : 'cleansed'}_${files[0].name}` 
      });
      setIsGridMode(false);
    } catch (err: any) {
      setProcessing({ status: 'error', message: 'Operation Failed', details: err.message });
    }
  };

  const processInputFilesToPages = async (targetFiles: File[]): Promise<PdfPage[]> => {
    const pages: PdfPage[] = [];
    for (const file of targetFiles) {
      const sourceFileKey = `${file.name}-${file.size}-${file.lastModified}`;
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const pdf = await (window as any).pdfjsLib.getDocument(buffer).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          pages.push({
            id: Math.random().toString(36).substr(2, 9),
            file,
            originalPageIndex: i - 1,
            thumbnail: canvas.toDataURL(),
            rotation: 0,
            sourceFileKey,
            sourceFileName: file.name
          });
        }
      } else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        pages.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          originalPageIndex: 0,
          thumbnail: url,
          isImage: true,
          rotation: 0,
          sourceFileKey,
          sourceFileName: file.name
        });
      }
    }
    return pages;
  };

  const removeArchitectPage = (id: string) => {
    setPdfPages(prev => prev.filter(page => page.id !== id));
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const rotateArchitectPage = (id: string) => {
    setPdfPages(prev =>
      prev.map(page => (
        page.id === id
          ? { ...page, rotation: (page.rotation + 90) % 360 }
          : page
      ))
    );
  };

  const toggleArchitectPageSelection = (id: string) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelectedArchitectPages = () => {
    if (selectedPageIds.size === 0) return;
    setPdfPages(prev => prev.filter(page => !selectedPageIds.has(page.id)));
    setSelectedPageIds(new Set());
  };

  const deleteArchitectSeries = (page: PdfPage) => {
    setPdfPages(prev => prev.filter(p => p.sourceFileKey !== page.sourceFileKey));
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      pdfPages.forEach(p => {
        if (p.sourceFileKey === page.sourceFileKey) next.delete(p.id);
      });
      return next;
    });
  };

  const reorderArchitectPages = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setPdfPages(prev => {
      const from = prev.findIndex(p => p.id === draggedId);
      const to = prev.findIndex(p => p.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const finalizeArchitectPdf = async () => {
    if (pdfPages.length === 0) return;
    setProcessing({ status: 'processing', message: 'Generating master document...' });
    try {
      const blob = await pdfService.editPdf(pdfPages.map(p => ({ file: p.file, originalPageIndex: p.originalPageIndex, isImage: p.isImage, rotation: p.rotation })));
      setProcessing({ status: 'success', message: 'Master PDF Built!', details: `${pdfPages.length} pages merged.`, resultBlob: blob, resultFilename: `architected_doc.pdf` });
      setIsArchitectMode(false);
      setSelectedPageIds(new Set());
      setDraggingPageId(null);
    } catch (err: any) {
      setProcessing({ status: 'error', message: 'Export Failed', details: err.message });
    }
  };

  if (isGridMode) {
    return (
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col h-[85vh] animate-in fade-in duration-500 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 px-4 shrink-0 gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Duplicate Finder Grid
              {duplicateIndices.size > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full font-black uppercase">
                  {duplicateIndices.size} Duplicates Found
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Refine and export your dataset</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setDupOptions({...dupOptions, criteria: 'row'})}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${dupOptions.criteria === 'row' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Full Row Match
                </button>
                <button 
                  onClick={() => setDupOptions({...dupOptions, criteria: 'col1'})}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${dupOptions.criteria === 'col1' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Smart Name Match
                </button>
             </div>

             <div className="flex bg-slate-900 p-1 rounded-xl">
                <button 
                  onClick={() => setDupOptions({...dupOptions, mode: 'highlight'})}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${dupOptions.mode === 'highlight' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                >
                  Highlight
                </button>
                <button 
                  onClick={() => setDupOptions({...dupOptions, mode: 'remove'})}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${dupOptions.mode === 'remove' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                >
                  Remove
                </button>
             </div>

            <button onClick={finalizeDuplicateRemoval} className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Download {dupOptions.mode === 'highlight' ? 'Highlighted' : 'Clean'} File</button>
            <button onClick={resetWorkspace} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-600 text-[10px] font-black uppercase rounded-xl transition-colors">Cancel</button>
          </div>
        </div>
        
        <div className="flex-grow overflow-auto bg-slate-50 rounded-[2rem] border border-slate-100 relative shadow-inner">
           <table className="w-full text-left border-collapse text-[11px]">
             <thead className="sticky top-0 z-20 bg-slate-200/95 backdrop-blur-md">
                <tr>
                   <th className="px-4 py-3 border-b border-slate-300 font-black text-slate-600 uppercase">#</th>
                   {gridData[0]?.map((h, i) => <th key={i} className="px-4 py-3 border-b border-slate-300 font-black text-slate-600 uppercase whitespace-nowrap">{h || `Col ${i+1}`}</th>)}
                </tr>
             </thead>
             <tbody>
                {gridData.slice(1).map((row, idx) => {
                   const absoluteIdx = idx + 1;
                   const isDup = duplicateIndices.has(absoluteIdx);
                   const shouldHide = dupOptions.mode === 'remove' && isDup;

                   if (shouldHide) return null;

                   return (
                      <tr key={idx} className={`transition-colors group ${isDup ? 'bg-amber-100/60 hover:bg-amber-100' : 'bg-white hover:bg-slate-50'}`}>
                         <td className="px-4 py-3 border-b border-slate-100 font-mono text-slate-400 group-hover:text-slate-900 sticky left-0 bg-inherit">
                           {isDup ? <span className="text-amber-600 font-black">⚠️ {absoluteIdx}</span> : absoluteIdx}
                         </td>
                         {row.map((cell, ci) => (
                           <td key={ci} className={`px-4 py-3 border-b border-slate-100 truncate max-w-[250px] ${isDup ? 'text-amber-900 font-bold' : 'text-slate-600'}`}>
                             {cell}
                           </td>
                         ))}
                      </tr>
                   );
                })}
             </tbody>
           </table>
        </div>
      </div>
    );
  }

  if (isArchitectMode) {
    return (
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col h-[85vh] animate-in fade-in duration-500 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 px-4 shrink-0 gap-4">
          <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">PDF Master Architect</h2></div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={deleteSelectedArchitectPages} disabled={selectedPageIds.size === 0} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-colors">Delete Selected ({selectedPageIds.size})</button>
            <button onClick={() => architectFileInputRef.current?.click()} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-colors">Add PDF / Image</button>
            <button onClick={finalizeArchitectPdf} className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg">Export Master</button>
            <button onClick={resetWorkspace} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-600 text-[10px] font-black uppercase rounded-xl transition-colors">Reset Architect</button>
            <input type="file" ref={architectFileInputRef} className="hidden" accept=".pdf,image/*" multiple onChange={handleArchitectFileChange} />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-8 bg-slate-50 rounded-[2rem] border border-slate-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {pdfPages.map((page, idx) => (
            <div
              key={page.id}
              draggable
              onDragStart={() => setDraggingPageId(page.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingPageId) reorderArchitectPages(draggingPageId, page.id);
                setDraggingPageId(null);
              }}
              onDragEnd={() => setDraggingPageId(null)}
              className={`relative bg-white p-2 rounded-2xl border shadow-sm ${selectedPageIds.has(page.id) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
            >
              <div className="absolute top-2 left-2 z-10 text-white text-[9px] font-black px-2 py-1 rounded-md bg-slate-900">P.{idx + 1}</div>
              <div className="absolute bottom-2 left-2 z-10 text-[8px] font-black px-2 py-1 rounded-md bg-slate-900 text-white max-w-[92%] truncate">
                {page.sourceFileName}
              </div>
              <button
                onClick={() => toggleArchitectPageSelection(page.id)}
                className={`absolute top-2 right-[132px] z-10 px-2 py-1 text-[9px] font-black rounded-md ${selectedPageIds.has(page.id) ? 'bg-indigo-700 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}
              >
                {selectedPageIds.has(page.id) ? 'Selected' : 'Select'}
              </button>
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                <button onClick={() => rotateArchitectPage(page.id)} className="px-2 py-1 text-[9px] font-black bg-indigo-600 text-white rounded-md">Rotate</button>
                <button onClick={() => removeArchitectPage(page.id)} className="px-2 py-1 text-[9px] font-black bg-rose-600 text-white rounded-md">Remove</button>
                <button onClick={() => deleteArchitectSeries(page)} className="px-2 py-1 text-[9px] font-black bg-slate-800 text-white rounded-md">Delete Series</button>
              </div>
              <img src={page.thumbnail} alt={`P ${idx+1}`} style={{ transform: `rotate(${page.rotation}deg)` }} className="w-full h-auto aspect-[1/1.41] object-contain rounded-lg transition-transform" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 relative">
      <div className="flex justify-between items-start mb-8">
        <div className="text-left">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{tool.title}</h2>
          <p className="text-slate-500">{tool.description}</p>
        </div>
        {(files.length > 0 || processing.status !== 'idle' || tool.id === 'menu-qa-lab') && (
          <button 
            onClick={resetWorkspace}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-xl text-[10px] font-black uppercase transition-all border border-slate-100"
          >
            <span>↺</span> Reset Workspace
          </button>
        )}
      </div>

      {tool.id === 'menu-qa-lab' ? (
        <MenuQALab key={resetKey} />
      ) : (
        <>
          {tool.category === 'AI' && !hasApiKey && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-[2rem] animate-in slide-in-from-top duration-500">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-amber-100">🔑</div>
                <div className="flex-grow text-center md:text-left">
                  <h3 className="text-lg font-black text-amber-900">Secure API Connection Required</h3>
                  <p className="text-sm text-amber-700 font-medium">This AI tool requires a valid Gemini API key to process your documents securely.</p>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-2 block hover:underline">View Billing Documentation →</a>
                </div>
                <button 
                  onClick={handleOpenKeyBridge}
                  className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95"
                >
                  Connect API Key
                </button>
              </div>
            </div>
          )}

          {processing.status === 'idle' && (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files) as File[]); }}
                className={`border-2 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 bg-slate-50/30'}`}
              >
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100"><span className="text-3xl">📂</span></div>
                <p className="text-lg font-bold text-slate-700">Drop files or <span className="text-indigo-600 underline">browse</span></p>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest">Accepts: {tool.accept}</p>
                <input type="file" ref={fileInputRef} className="hidden" accept={tool.accept} multiple={tool.multiple} onChange={handleFileChange} />
              </div>

              {files.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  {tool.id === 'ai-data-translator' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">Target Language</label>
                        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none cursor-pointer">
                          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Translation Scope</label>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => setTransScope('names')} className={`w-full py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${transScope === 'names' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Item Names Only</button>
                          <button onClick={() => setTransScope('categories')} className={`w-full py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${transScope === 'categories' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Categories Only</button>
                          <button onClick={() => setTransScope('both')} className={`w-full py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${transScope === 'both' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Both Names & Categories</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {tool.id === 'pdf-img-to-excel' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">Extraction Logic</label>
                        <div className="flex gap-2">
                           <button onClick={() => setOcrMode('ai')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${ocrMode === 'ai' ? 'bg-indigo-600' : 'bg-slate-800 text-slate-500'}`}>AI Sheet</button>
                           <button onClick={() => setOcrMode('manual')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${ocrMode === 'manual' ? 'bg-indigo-600' : 'bg-slate-800 text-slate-500'}`}>Manual Sheet</button>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Menu Language</label>
                        <select value={ocrLang} onChange={(e) => setOcrLang(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 cursor-pointer">
                          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 flex flex-col justify-center items-center shadow-sm">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-3 block">Enhanced Recognition</label>
                        <button 
                          onClick={() => setIsDeepScan(!isDeepScan)}
                          className={`w-full py-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${isDeepScan ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}
                        >
                          {isDeepScan && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                          {isDeepScan ? 'Deep Scan Active' : 'Enable Deep Scan'}
                        </button>
                        <p className="text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-tighter text-center">For Handwriting / Blurry Scans / Complex Grids</p>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={processFile} 
                    disabled={tool.category === 'AI' && !hasApiKey}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Process {files.length} Document(s)
                  </button>
                </div>
              )}
            </div>
          )}

          {processing.status === 'processing' && (
            <div className="py-20 text-center animate-in zoom-in duration-500">
              <div className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-10 shadow-lg"></div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{processing.message}</h3>
              <p className="text-slate-400 text-sm mt-3 italic font-medium">Gemini AI is auditing your document intelligence...</p>
            </div>
          )}

          {processing.status === 'success' && (
            <div className="animate-in fade-in duration-500">
              {summaryText ? (
                <div className="w-full bg-slate-50 p-8 rounded-[3rem] border border-slate-200 mb-6 max-h-[600px] overflow-y-auto">
                  <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-6">Executive Briefing</h4>
                  <div className="prose prose-slate prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                    {summaryText}
                  </div>
                </div>
              ) : previewData ? (
                 <div className="w-full">
                    <div className="flex justify-between items-center mb-4"><h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Operation Results</h4></div>
                    <div className="bg-slate-50 rounded-[2rem] border border-slate-200 overflow-hidden shadow-inner mb-6">
                       <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] font-mono border-collapse">
                             <thead className="bg-slate-200/50">
                                <tr>{previewData[0]?.slice(0, 8).map((h, i) => <th key={i} className="px-4 py-3 border-b border-slate-200 font-black uppercase text-slate-500">{h}</th>)}</tr>
                             </thead>
                             <tbody>
                                {previewData.slice(1, 11).map((row, ri) => (
                                   <tr key={ri} className="bg-white border-b border-slate-100 last:border-0 hover:bg-indigo-50/50">
                                      {row.slice(0, 8).map((cell, ci) => <td key={ci} className="px-4 py-3 truncate max-w-[200px] text-slate-600">{cell}</td>)}
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="w-full bg-slate-50 p-10 rounded-[3rem] text-center border border-slate-100">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">✓</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-4">{processing.message}</h3>
                    <p className="text-slate-600 text-sm font-medium">{processing.details}</p>
                 </div>
              )}
              <div className="flex gap-4 mt-4">
                {!summaryText && <button onClick={handleDownload} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3">📥 DOWNLOAD RESULTS</button>}
                <button onClick={resetWorkspace} className={`flex-1 ${summaryText ? 'w-full' : ''} bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-5 rounded-2xl transition-all`}>NEW BATCH</button>
              </div>
            </div>
          )}

          {processing.status === 'error' && (
            <div className="py-12 text-center animate-in shake">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">!</div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Processing Error</h3>
              <p className="text-slate-500 mb-10 font-medium px-10">{processing.details}</p>
              <button onClick={() => setProcessing({ status: 'idle', message: '' })} className="w-full max-w-xs bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl">RETRY</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
