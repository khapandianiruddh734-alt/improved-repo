import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UsageUser = {
  id: string;
  count: number;
};

type StatsResponse = {
  users: UsageUser[];
  total: number;
};

type LocalCache = {
  timestamp: number;
  users: UsageUser[];
  total: number;
};

const STATS_CACHE_TTL_MS = 5000;
const REFRESH_INTERVAL_MS = 10000;
const DAILY_LIMIT = 60;

let localCache: LocalCache | null = null;

export const ApiUsageDashboard: React.FC = () => {
  const [users, setUsers] = useState<UsageUser[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [addUserMessage, setAddUserMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchStats = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && localCache && now - localCache.timestamp < STATS_CACHE_TTL_MS) {
      setUsers(localCache.users);
      setTotalRequests(localCache.total);
      setLastUpdated(localCache.timestamp);
      setError(null);
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stats', { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as StatsResponse;
      const normalized = Array.isArray(payload.users) ? payload.users : [];
      normalized.sort((a, b) => b.count - a.count);
      const total = typeof payload.total === 'number'
        ? payload.total
        : normalized.reduce((sum, user) => sum + user.count, 0);

      if (requestId !== requestIdRef.current) return;

      const stamp = Date.now();
      localCache = { timestamp: stamp, users: normalized, total };
      setUsers(normalized);
      setTotalRequests(total);
      setLastUpdated(stamp);
      setError(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError('Unable to load usage stats');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(true), REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats]);

  const totalUsers = users.length;
  const highestUsage = users[0] || null;
  const maxCount = users.length > 0 ? Math.max(...users.map(user => user.count)) : 1;

  const rows = useMemo(() => users.slice(0, 30), [users]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleAddUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newUserId.trim().toLowerCase();
    if (!email) {
      setAddUserMessage('Enter an email.');
      return;
    }
    if (!isValidEmail(email)) {
      setAddUserMessage('Invalid email format.');
      return;
    }

    setAddingUser(true);
    setAddUserMessage(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to add user');
      }

      setAddUserMessage(`User "${email}" added.`);
      setNewUserId('');
      await fetchStats(true);
    } catch (e: any) {
      setAddUserMessage(e?.message || 'Unable to add user');
    } finally {
      setAddingUser(false);
    }
  }, [fetchStats, newUserId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">API Usage</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            Auto refresh every 10 seconds
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-sm">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Add User</p>
        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-3">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={addingUser}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-60"
          >
            {addingUser ? 'Adding...' : 'Add User'}
          </button>
        </form>
        {addUserMessage && (
          <p className="mt-3 text-[11px] font-bold text-slate-500">{addUserMessage}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Users</p>
          <p className="text-3xl font-black text-slate-900">{totalUsers}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Requests</p>
          <p className="text-3xl font-black text-slate-900">{totalRequests}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Highest Usage User</p>
          <p className="text-xl font-black text-indigo-600 truncate">
            {highestUsage ? highestUsage.id : '-'}
          </p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">
            {highestUsage ? `${highestUsage.count} requests` : 'No requests yet'}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Requests Per User</p>
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm font-bold text-slate-400">No usage data available.</p>
          )}
          {rows.map((user) => {
            const width = Math.max(4, Math.round((user.count / maxCount) * 100));
            const quotaPercent = Math.min(100, Math.round((user.count / DAILY_LIMIT) * 100));
            const highUsage = user.count > 15;
            return (
              <div key={user.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-black ${highUsage ? 'text-rose-600' : 'text-slate-700'}`}>
                    {user.id}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{user.count}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${highUsage ? 'bg-rose-500' : 'bg-indigo-500'}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Daily quota used: {quotaPercent}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
