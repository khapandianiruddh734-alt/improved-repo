
import React from 'react';
import { Tool } from '../types';

interface ToolCardProps {
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(tool)}
      className={`
        relative overflow-hidden group p-6 rounded-2xl bg-white border border-slate-200 
        shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer
        ${tool.color.includes('border-') ? tool.color.split(' ').find(c => c.startsWith('border-')) : ''}
      `}
    >
      <div className={`w-12 h-12 rounded-xl ${tool.color.split(' ')[0]} ${tool.color.split(' ')[1]} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
        {tool.icon}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-1">{tool.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2">{tool.description}</p>
      
      {/* Subtle indicator for AI tools */}
      {tool.category === 'AI' && (
        <div className="absolute top-4 right-4 flex items-center bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full border border-indigo-100 uppercase tracking-tighter">
          <span className="mr-1">AI</span>
          <div className="w-1 h-1 bg-indigo-600 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
};
