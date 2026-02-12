
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ToolGrid } from './components/ToolGrid';
import { Workspace } from './components/Workspace';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { Tool } from './types';

const TOOLS: Tool[] = [
  // PDF Category
  { id: 'pdf-menu-architect', title: 'PDF Master Architect', description: 'Comprehensive PDF Studio: Merge, Reorder, Delete Pages, and Extract Ranges with Drag-Drop.', icon: '🏗️', category: 'PDF', accept: '.pdf,image/*', multiple: true, color: 'bg-indigo-100 text-indigo-700 border-indigo-500 font-bold shadow-indigo-100' },
  { id: 'jpg-to-pdf', title: 'JPG to PDF', description: 'Combine multiple images into one clean PDF.', icon: '🖼️', category: 'PDF', accept: 'image/jpeg,image/png', multiple: true, color: 'bg-amber-100 text-amber-600' },
  { id: 'word-to-pdf', title: 'WORD to PDF', description: 'Convert DOCX documents to high-quality PDF.', icon: '📝', category: 'PDF', accept: '.docx', color: 'bg-blue-100 text-blue-600' },
  { id: 'pdf-to-jpg', title: 'PDF to JPG', description: 'Extract all pages of a PDF as separate images.', icon: '📄', category: 'PDF', accept: '.pdf', color: 'bg-red-100 text-red-600' },
  { id: 'compress-pdf', title: 'Compress PDF', description: 'Reduce file size while keeping text clear.', icon: '📉', category: 'PDF', accept: '.pdf', color: 'bg-emerald-100 text-emerald-600' },

  // Data Category
  { id: 'menu-qa-lab', title: 'Menu QA Lab', description: 'High-volume text parsing, cleaning, and manual QA.', icon: '🧪', category: 'Data', accept: 'text/plain', color: 'bg-indigo-100 text-indigo-700 border-indigo-400' },
  { id: 'pdf-to-excel', title: 'PDF to EXCEL', description: 'Fast extraction of tabular data and text from PDF files into XLSX.', icon: '📑', category: 'Data', accept: '.pdf', color: 'bg-emerald-100 text-emerald-700 border-emerald-400' },
  { id: 'excel-to-pdf', title: 'EXCEL to PDF', description: 'Convert spreadsheets to formatted PDF.', icon: '📊', category: 'Data', accept: '.xlsx,.xls', color: 'bg-green-100 text-green-600' },
  { id: 'clean-excel', title: 'Clean Excel', description: 'Remove special characters and fix spacing.', icon: '🧹', category: 'Data', accept: '.xlsx,.xls,.csv', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'duplicate-remover', title: 'Duplicate Finder', description: 'Identify and remove redundant data rows.', icon: '📋', category: 'Data', accept: '.xlsx,.xls,.csv', color: 'bg-orange-100 text-orange-600' },

  // AI Category
  { id: 'ai-menu-fixer', title: 'AI Menu Fixer', description: 'Smartly fix spelling & formatting in menus.', icon: '🍔', category: 'AI', accept: '.xlsx,.xls,.csv', color: 'bg-pink-100 text-pink-600 border-pink-500' },
  { id: 'ai-data-translator', title: 'AI Data Translator', description: 'Translate entire datasets/menus into English or any global language.', icon: '🌍', category: 'AI', accept: '.xlsx,.xls,.csv', color: 'bg-blue-100 text-blue-700 border-blue-400' },
  { id: 'pdf-img-to-excel', title: 'AI OCR to Excel', description: 'Extract complex tables from multiple images, PDFs, or horizontal Excel menus using Gemini AI.', icon: '👁️', category: 'AI', accept: '.pdf,image/*,.xlsx,.xls', multiple: true, color: 'bg-purple-100 text-purple-600' },
  { id: 'ai-document-summary', title: 'AI Summarizer & Vision', description: 'Audit documents or analyze photos for pricing, trends, and dish composition.', icon: '✨', category: 'AI', accept: '.pdf,.docx,.txt,image/*', multiple: true, color: 'bg-cyan-100 text-cyan-600' },
];

export default function App() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem('achievers_admin_session');
    if (session === 'active') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setShowAdmin(false);
    setShowLogin(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedTool(null);
    setShowAdmin(false);
    setShowLogin(false);
  };

  const handleAdminRequest = () => {
    if (isAuthenticated) {
      setShowAdmin(true);
      setSelectedTool(null);
    } else {
      setShowLogin(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setShowLogin(false);
    setShowAdmin(true);
    setSelectedTool(null);
    sessionStorage.setItem('achievers_admin_session', 'active');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowAdmin(false);
    sessionStorage.removeItem('achievers_admin_session');
  };

  return (
    <Layout onLogoClick={handleBack} onAdminClick={handleAdminRequest} isAdminActive={showAdmin}>
      {showLogin && (
        <AdminLogin 
          onSuccess={handleLoginSuccess} 
          onCancel={() => setShowLogin(false)} 
        />
      )}

      {showAdmin && isAuthenticated ? (
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={handleBack}
            className="flex items-center text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors group"
          >
            <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span> 
            Back to Dashboard
          </button>
          <AdminDashboard onLogout={handleLogout} />
        </div>
      ) : !selectedTool ? (
        <div className="animate-in fade-in duration-700">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
              The <span className="text-indigo-600">Achievers</span> Workspace
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Professional tools for enterprise document processing and high-volume data.
            </p>
          </div>
          
          <ToolGrid tools={TOOLS} onSelect={handleToolSelect} />
        </div>
      ) : (
        <div className="max-w-[1400px] mx-auto">
          <button 
            onClick={handleBack}
            className="flex items-center text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors group px-4"
          >
            <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span> 
            Back to origin
          </button>
          <Workspace tool={selectedTool} />
        </div>
      )}
    </Layout>
  );
}
