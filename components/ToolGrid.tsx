
import React from 'react';
import { Tool } from '../types';
import { ToolCard } from './ToolCard';

interface ToolGridProps {
  tools: Tool[];
  onSelect: (tool: Tool) => void;
}

export const ToolGrid: React.FC<ToolGridProps> = ({ tools, onSelect }) => {
  const categories = Array.from(new Set(tools.map(t => t.category)));

  return (
    <div className="space-y-12">
      {categories.map(category => (
        <div key={category}>
          <div className="flex items-center mb-6">
            <h2 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">
              {category} Tools
            </h2>
            <div className="flex-grow h-[1px] bg-slate-200 ml-4"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools
              .filter(t => t.category === category)
              .map(tool => (
                <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};
