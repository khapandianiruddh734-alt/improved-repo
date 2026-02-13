import React, { useState, useEffect } from 'react';
import { apiTracker } from '../services/apiTracker';
import { AdminSettings } from '../types';
import { ApiUsageDashboard } from './admin/ApiUsageDashboard';
import { UserManager } from './admin/UserManager';

interface AdminDashboardProps {
  onLogout: () => void;
  user?: { role?: string };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, user }) => {
  const [stats, setStats] = useState(apiTracker.getStats());
  const [settings, setSettings] = useState<AdminSettings>(apiTracker.getSettings());
  const [activeTab, setActiveTab] = useState<'ops' | 'tools' | 'logs' | 'config' | 'api' | 'users'>('ops');

  useEffect(() => {
    if (user?.role !== 'admin') {
      onLogout();
      window.location.assign('/');
      return;
    }

    const interval = setInterval(() => {
      setStats(apiTracker.getStats());
    }, 2000);
    return () => clearInterval(interval);
  }, [onLogout, user?.role]);

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    apiTracker.updateSettings(settings);
    alert('Dynamic Ops Config Synchronized.');
  };

  const rpmUsage = (stats.rpm / stats.rpmLimit) * 100;
  const dailyUsage = (stats.dailyUsed / stats.dailyLimit) * 100;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24hLogs = apiTracker.getLogs().filter(log => !log.isAlert && log.timestamp >= oneDayAgo);

  const activityByDate: Record<string, Record<string, number>> = {};
  last24hLogs.forEach(log => {
    const day = new Date(log.timestamp).toLocaleDateString();
    if (!activityByDate[day]) activityByDate[day] = {};
    activityByDate[day][log.tool] = (activityByDate[day][log.tool] || 0) + 1;
  });
  const activityDates = Object.keys(activityByDate).sort((a, b) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return db - da;
  });
  const mostRecentTool = last24hLogs.length > 0 ? last24hLogs[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="z-10 flex items-center gap-6">
          <div className="relative">
             <div className={`w-3 h-3 rounded-full ${stats.health === 'Healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'} absolute -top-1 -right-1`}></div>
             <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">🛰️</div>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">System Command</h2>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mt-1">Status: {stats.health} Control</p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 z-10 bg-white/5 p-2 rounded-2xl backdrop-blur-md border border-white/5">
          <button onClick={() => setActiveTab('ops')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'ops' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Metrics</button>
          <button onClick={() => setActiveTab('tools')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'tools' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Tools</button>
          <button onClick={() => setActiveTab('logs')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'logs' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Logs</button>
          <button onClick={() => setActiveTab('api')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'api' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>API Usage</button>
          <button onClick={() => setActiveTab('users')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'users' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Users</button>
          <button onClick={() => setActiveTab('config')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'config' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Setup</button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button onClick={onLogout} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase text-rose-400 hover:bg-rose-500 hover:text-white transition-all">Logout</button>
        </div>
      </div>

      {activeTab === 'ops' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Estimated Cost (USD)</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900">${stats.estimatedCost}</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">Total Burn</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-4 leading-relaxed font-medium">Calculated based on Gemini 3 Flash I/O token rates.</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Extraction Fidelity</h4>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-indigo-600">{stats.accuracyAvg}%</span>
               <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
             </div>
             <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${stats.accuracyAvg}%` }}></div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Throughput Efficiency</h4>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-emerald-500">{stats.successRate.toFixed(1)}%</span>
             </div>
             <p className="text-[9px] text-slate-400 mt-4 leading-relaxed font-medium">Successful operations vs total attempts.</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Request Intensity (RPM)</h4>
             <div className="flex items-baseline gap-2">
               <span className={`text-4xl font-black ${rpmUsage > 80 ? 'text-rose-500' : 'text-slate-900'}`}>{stats.rpm}</span>
               <span className="text-[10px] font-bold text-slate-300 uppercase">/ {stats.rpmLimit}</span>
             </div>
             <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${rpmUsage > 80 ? 'bg-rose-500' : 'bg-slate-900'}`} style={{ width: `${rpmUsage}%` }}></div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl animate-in slide-in-from-bottom-10">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tool Engagement Matrix</h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Activity View</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(stats.toolUsage).map(([name, toolEntry]) => {
                // Fix: Cast unknown toolEntry to expected type structure
                const data = toolEntry as { count: number; success: number };
                const sRate = (data.success / data.count) * 100;
                return (
                  <div key={name} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
                     <h4 className="text-sm font-black text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{name}</h4>
                     <div className="flex justify-between items-end mt-4">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Invocations</p>
                           <p className="text-xl font-black text-slate-900">{data.count}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Success</p>
                           <p className={`text-lg font-black ${sRate > 90 ? 'text-emerald-500' : sRate > 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                             {sRate.toFixed(0)}%
                           </p>
                        </div>
                     </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Tool Request Count (Last 24 Hours)</h3>
              {mostRecentTool && (
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Recent: {mostRecentTool.tool} • {new Date(mostRecentTool.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            {activityDates.length === 0 ? (
              <p className="text-sm font-bold text-slate-400">No tool requests in the last 24 hours.</p>
            ) : (
              <div className="space-y-6">
                {activityDates.map((date) => (
                  <div key={date} className="border-b border-slate-100 pb-4 last:border-0">
                    <p className="text-[11px] font-black text-slate-600 mb-2">{date}</p>
                    <div className="space-y-1">
                      {Object.entries(activityByDate[date]).map(([tool, count]) => (
                        <p key={`${date}-${tool}`} className="text-[12px] font-bold text-slate-700">
                          {tool} requests: {count}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Intel ID</th>
                    <th className="px-8 py-5">Target Tool</th>
                    <th className="px-8 py-5">Operational Metrics</th>
                    <th className="px-8 py-5">Final State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-mono text-[10px] text-slate-400">#{log.id}</td>
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-800">{log.tool}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex gap-6">
                          <div className="text-[10px]">
                            <span className="text-slate-400 uppercase font-black text-[8px] block mb-1">I/O Tokens</span>
                            <span className="font-bold text-slate-700">{log.inputTokens || 0}i / {log.outputTokens || 0}o</span>
                          </div>
                          <div className="text-[10px]">
                            <span className="text-slate-400 uppercase font-black text-[8px] block mb-1">Fidelity</span>
                            <span className={`font-bold ${(log.accuracyScore || 100) > 80 ? 'text-emerald-600' : 'text-rose-500'}`}>{log.accuracyScore ?? 100}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                            {log.status === 'error' ? log.errorCategory : 'Validated'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api' && <ApiUsageDashboard />}
      {activeTab === 'users' && <UserManager />}

      {activeTab === 'config' && (
        <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-xl max-w-2xl mx-auto animate-in zoom-in-95">
           <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Intelligence Guardrails</h3>
           <form onSubmit={handleUpdateSettings} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Admin Ops Notification Email</label>
                <input 
                  type="email" 
                  value={settings.alertEmail} 
                  onChange={(e) => setSettings({...settings, alertEmail: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Threat Threshold: {settings.threshold}% RPM</label>
                <input 
                  type="range" min="50" max="95" step="5" value={settings.threshold}
                  onChange={(e) => setSettings({...settings, threshold: parseInt(e.target.value)})}
                  className="w-full h-3 bg-slate-100 rounded-full appearance-none accent-indigo-600"
                />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-slate-800 transition-all">Apply Dynamic Logic</button>
           </form>
        </div>
      )}
    </div>
  );
};
