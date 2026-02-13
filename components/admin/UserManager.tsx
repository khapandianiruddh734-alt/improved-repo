import React, { useCallback, useMemo, useState } from 'react';

type UsersResponse = { users: string[] };

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Unable to load users');
      const payload = (await response.json()) as UsersResponse;
      const normalized = Array.isArray(payload.users) ? payload.users.map(String) : [];
      normalized.sort((a, b) => a.localeCompare(b));
      setUsers(normalized);
    } catch (e: any) {
      setError(e?.message || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError('Email is required');
      return;
    }
    if (!isValidEmail(normalized)) {
      setError('Invalid email format');
      return;
    }
    if (users.includes(normalized)) {
      setError('Email already exists');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to add user');
      }
      setEmail('');
      setMessage(`Added ${normalized}`);
      await fetchUsers();
    } catch (e: any) {
      setError(e?.message || 'Unable to add user');
    } finally {
      setLoading(false);
    }
  }, [email, fetchUsers, users]);

  const handleRemove = useCallback(async (target: string) => {
    setMessage(null);
    setError(null);
    const confirmRemove = window.confirm(`Remove user "${target}"?`);
    if (!confirmRemove) return;

    setLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to remove user');
      }
      setMessage(`Removed ${target}`);
      await fetchUsers();
    } catch (e: any) {
      setError(e?.message || 'Unable to remove user');
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(user => user.includes(q));
  }, [search, users]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Users</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Total users: {users.length}
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-60"
          >
            Add User
          </button>
        </form>

        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={loading}
          />
        </div>

        {message && <p className="mt-3 text-[11px] font-bold text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-[11px] font-bold text-rose-600">{error}</p>}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">User List</p>
        <div className="space-y-2">
          {filteredUsers.length === 0 && (
            <p className="text-sm font-bold text-slate-400">No users found.</p>
          )}
          {filteredUsers.map((user) => (
            <div key={user} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <span className="text-sm font-bold text-slate-700">{user}</span>
              <button
                onClick={() => handleRemove(user)}
                disabled={loading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

