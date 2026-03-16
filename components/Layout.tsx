
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  onLogoClick: () => void;
  onAdminClick: () => void;
  isAdminActive: boolean;
}

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <div className={`${className} bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100`}>
    A
  </div>
);

export const Layout: React.FC<LayoutProps> = ({ children, onLogoClick, onAdminClick, isAdminActive }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 glass-effect border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div 
              className="flex items-center cursor-pointer select-none group" 
              onClick={onLogoClick}
            >
              <div className="mr-3 group-hover:scale-110 transition-transform duration-300">
                <Logo className="w-9 h-9 text-xl" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                The <span className="text-indigo-600">Achievers</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={onAdminClick}
                className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                  isAdminActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isAdminActive ? 'Viewing Dashboard' : 'Admin Panel'}
              </button>
              <div className="hidden md:block w-px h-6 bg-slate-200"></div>
              <span className="hidden md:block text-xs font-semibold uppercase tracking-widest text-slate-400">Enterprise Productivity</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-4 opacity-30 grayscale hover:grayscale-0 transition-all cursor-default">
             <Logo className="w-6 h-6 text-[10px]" />
          </div>
          <p className="text-slate-400 text-sm">
            The Achievers. All rights reserved. 
            <span className="mx-2">|</span> 
            Processing is performed 100% locally for your privacy.
          </p>
        </div>
      </footer>
    </div>
  );
};
