
import React, { useState, useEffect } from 'react';
import * as geminiService from '../services/gemini';

interface MenuItem {
  id: string;
  name: string;
  variation: string;
  category: string;
  attributes: string;
  description: string;
  price: string;
}

export const MenuQALab: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [past, setPast] = useState<MenuItem[][]>([]);
  const [future, setFuture] = useState<MenuItem[][]>([]);
  const [isAiParsing, setIsAiParsing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('menu_qa_lab_data');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved menu data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('menu_qa_lab_data', JSON.stringify(items));
  }, [items]);

  const saveToHistory = (currentItems: MenuItem[]) => {
    setPast(prev => [JSON.parse(JSON.stringify(currentItems)), ...prev].slice(0, 50));
    setFuture([]);
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[0];
    const newPast = past.slice(1);
    
    setFuture(prev => [JSON.parse(JSON.stringify(items)), ...prev]);
    setItems(previous);
    setPast(newPast);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [JSON.parse(JSON.stringify(items)), ...prev]);
    setItems(next);
    setFuture(newFuture);
  };

  const parseData = () => {
    saveToHistory(items);
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    const parsed: MenuItem[] = lines.map(line => {
      const priceMatch = line.match(/(\d+[\.,]\d{2})|(\d+)$/);
      let name = line;
      let price = '';
      
      if (priceMatch) {
        price = priceMatch[0];
        name = line.replace(price, '').trim();
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        name: name || 'Unnamed Item',
        variation: '',
        category: '',
        attributes: 'Veg',
        description: '',
        price: price || '0'
      };
    });
    setItems(prev => [...prev, ...parsed]);
    setRawText('');
  };

  const aiSmartParse = async () => {
    if (!rawText.trim()) return;
    setIsAiParsing(true);
    saveToHistory(items);
    
    try {
      const parsedItems = await geminiService.aiLabSmartParse(rawText);
      const formattedItems: MenuItem[] = parsedItems.map((item: any) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: item.name || '',
        variation: item.variation || '',
        category: item.category || '',
        attributes: item.attributes || 'Veg',
        description: item.description || '',
        price: String(item.price || '0')
      }));
      setItems(prev => [...prev, ...formattedItems]);
      setRawText('');
    } catch (error) {
      alert("AI Parsing failed. Check console or API key.");
    } finally {
      setIsAiParsing(false);
    }
  };

  const resetAll = () => {
    if (confirm("Permanently clear ALL items and history?")) {
      setItems([]);
      setRawText('');
      setPast([]);
      setFuture([]);
      localStorage.removeItem('menu_qa_lab_data');
    }
  };

  const updateItem = (id: string, field: keyof MenuItem, value: string) => {
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    setItems(newItems);
  };

  const deleteItem = (id: string) => {
    saveToHistory(items);
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const fixCapitalization = () => {
    saveToHistory(items);
    setItems(prev => prev.map(item => ({
      ...item,
      name: item.name.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()),
      variation: item.variation.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()),
      category: item.category.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
    })));
  };

  const standardizePrices = () => {
    saveToHistory(items);
    setItems(prev => prev.map(item => {
      const num = parseFloat(item.price.replace(',', '.'));
      return {
        ...item,
        price: isNaN(num) ? '0.00' : num.toFixed(2)
      };
    }));
  };

  const sanitizeText = () => {
    saveToHistory(items);
    setItems(prev => prev.map(item => ({
      ...item,
      name: item.name.replace(/\?+/g, '').replace(/[^\x20-\x7E]/g, '').trim(),
      variation: item.variation.replace(/\?+/g, '').replace(/[^\x20-\x7E]/g, '').trim(),
      category: item.category.replace(/\?+/g, '').replace(/[^\x20-\x7E]/g, '').trim(),
      description: item.description.replace(/\?+/g, '').replace(/[^\x20-\x7E]/g, '').trim(),
      price: item.price.replace(/\?+/g, '').trim()
    })));
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    alert('JSON copied to clipboard!');
  };

  const copyCSV = () => {
    const headers = ['Category', 'Name', 'Variation', 'Attributes', 'Price', 'Description'];
    const rows = items.map(i => [i.category, i.name, i.variation, i.attributes, i.price, i.description].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    navigator.clipboard.writeText(csv);
    alert('CSV copied to clipboard!');
  };

  const isPriceInvalid = (price: string) => {
    const p = price.trim();
    return !p || p === '0' || p === '0.00' || p === '0.0';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      <div className="lg:w-1/4 space-y-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Raw Menu Data</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste menu text here... (Item Name, Price, Category info)"
            className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono text-sm resize-none transition-all"
          />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={parseData}
              disabled={!rawText.trim() || isAiParsing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-all disabled:opacity-50 text-[10px] uppercase tracking-wider"
            >
              Basic Parse
            </button>
            <button
              onClick={aiSmartParse}
              disabled={!rawText.trim() || isAiParsing}
              className={`bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50 text-[10px] uppercase tracking-wider flex items-center justify-center gap-2`}
            >
              {isAiParsing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "✨ AI Smart Parse"}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:w-3/4 space-y-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 sticky top-20 z-10 backdrop-blur-md bg-white/90">
          <div className="flex flex-wrap gap-2 mr-auto">
            <button onClick={fixCapitalization} className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 text-[10px] font-black uppercase rounded-xl border border-slate-100">Fix Caps</button>
            <button onClick={standardizePrices} className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 text-[10px] font-black uppercase rounded-xl border border-slate-100">Prices</button>
            <button onClick={sanitizeText} className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 text-[10px] font-black uppercase rounded-xl border border-slate-100">Clean</button>
            
            <div className="flex gap-1 ml-2">
              <button 
                onClick={undo} 
                disabled={past.length === 0}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 disabled:opacity-30 hover:bg-indigo-50 text-indigo-600 transition-all"
                title="Undo (↩)"
              >
                ↩
              </button>
              <button 
                onClick={redo} 
                disabled={future.length === 0}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 disabled:opacity-30 hover:bg-indigo-50 text-indigo-600 transition-all"
                title="Redo (↪)"
              >
                ↪
              </button>
            </div>
            <button 
              onClick={resetAll} 
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 text-[10px] font-black uppercase rounded-xl border border-rose-100 ml-4 transition-colors"
            >
              Clear Workspace
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={copyJSON} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Copy JSON</button>
            <button onClick={copyCSV} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl">Copy CSV</button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const invalidPrice = isPriceInvalid(item.price);
            return (
              <div 
                key={item.id} 
                className={`grid grid-cols-12 gap-3 p-3 border rounded-2xl bg-white shadow-sm transition-all ${
                  invalidPrice ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'border-slate-100'
                }`}
              >
                <div className="col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Category</label>
                  <input 
                    type="text" 
                    value={item.category} 
                    onFocus={() => saveToHistory(items)}
                    onChange={(e) => updateItem(item.id, 'category', e.target.value)} 
                    placeholder="Category"
                    className="w-full bg-slate-50 p-2 rounded-lg font-bold text-xs text-indigo-600 outline-none" 
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Item Name</label>
                  <input 
                    type="text" 
                    value={item.name} 
                    onFocus={() => saveToHistory(items)}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)} 
                    className="w-full bg-transparent p-2 font-mono text-sm font-bold text-slate-800 outline-none" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Variation</label>
                  <input 
                    type="text" 
                    value={item.variation} 
                    onFocus={() => saveToHistory(items)}
                    onChange={(e) => updateItem(item.id, 'variation', e.target.value)} 
                    className="w-full bg-transparent p-2 font-mono text-xs text-slate-500 outline-none" 
                    placeholder="Variation" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Attributes</label>
                  <select 
                    value={item.attributes}
                    onFocus={() => saveToHistory(items)}
                    onChange={(e) => updateItem(item.id, 'attributes', e.target.value)}
                    className="w-full bg-slate-50 p-2 rounded-lg font-bold text-[10px] text-slate-600 outline-none appearance-none"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Egg">Egg</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Price</label>
                  <div className={`flex items-center px-2 rounded-xl transition-colors ${invalidPrice ? 'bg-red-100' : 'bg-slate-50'}`}>
                    <span className={`font-mono text-[10px] ${invalidPrice ? 'text-red-600' : 'text-slate-400'}`}>$</span>
                    <input 
                      type="text" 
                      value={item.price} 
                      onFocus={() => saveToHistory(items)}
                      onChange={(e) => updateItem(item.id, 'price', e.target.value)} 
                      className={`w-full bg-transparent p-2 font-mono text-sm outline-none text-right font-bold ${invalidPrice ? 'text-red-700' : 'text-slate-900'}`} 
                    />
                  </div>
                </div>
                <div className="col-span-1 flex justify-end items-center">
                  <button onClick={() => deleteItem(item.id)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-300 hover:text-red-500 rounded-full transition-all">✕</button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
             <div className="py-20 text-center opacity-20 border-2 border-dashed border-slate-200 rounded-[2rem]">
               <p className="font-black text-xs uppercase tracking-widest">Workspace is empty</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
