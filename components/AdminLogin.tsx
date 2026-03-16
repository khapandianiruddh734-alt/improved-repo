
import React, { useState } from 'react';
import { Logo } from './Layout';

// EDIT THESE VALUES TO SET YOUR ADMIN LOGIN
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'iamadmin';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validating against centralized constants
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError('Invalid credentials. Access Denied.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Logo className="w-12 h-12 text-2xl" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Gateway</h2>
          <p className="text-slate-500 text-sm mt-1">Authorized Personnel Only</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
              placeholder="Admin"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center animate-bounce">
              {error}
            </div>
          )}

          <div className="pt-6 flex flex-col gap-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-[0.98] tracking-wide"
            >
              Verify & Unlock
            </button>
            <button 
              type="button"
              onClick={onCancel}
              className="w-full bg-white text-slate-400 font-bold py-3 rounded-2xl hover:bg-slate-50 hover:text-slate-600 transition-all text-xs"
            >
              Cancel Access Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
