import { useEffect, useState } from 'react';

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
  needsReauth?: boolean;
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('aubin-theme') === 'dark');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('aubin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'cancelled') setAuthError('Sign-in cancelled.');
    else if (err === 'auth_failed') setAuthError('Sign-in failed. Please try again.');
    else if (err === 'missing_code') setAuthError('Something went wrong. Please try again.');
    else if (err === 'state_mismatch') setAuthError('Security check failed. Please try again.');
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setNotice('Chat is coming soon.');
    setInput('');
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        {user ? (
          <a
            href="/api/auth/logout"
            className="min-h-[44px] min-w-[44px] flex items-center text-muted text-xs"
          >
            Sign out
          </a>
        ) : (
          <div />
        )}
        <button
          className="min-h-[44px] min-w-[44px] text-muted text-sm"
          onClick={() => setDark(!dark)}
          aria-label="Toggle dark mode"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : !user ? (
          <div className="flex flex-col items-center text-center space-y-6 max-w-sm w-full">
            <h1 className="text-4xl font-serif text-accent font-semibold">Aubin</h1>
            {authError && <p className="text-muted text-sm">{authError}</p>}
            <a
              href="/api/auth/login"
              className="inline-block w-full min-h-[44px] px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center"
            >
              Sign in with GitHub
            </a>
          </div>
        ) : user.needsReauth ? (
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm w-full">
            <h1 className="text-3xl font-serif text-accent font-semibold">
              Welcome back, {user.name || user.login}
            </h1>
            <p className="text-muted text-sm">
              Aubin needs access to your repositories to continue.
            </p>
            <a
              href="/api/auth/logout"
              className="inline-block min-h-[44px] px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center"
            >
              Reconnect GitHub
            </a>
          </div>
        ) : (
          <div className="w-full max-w-xl flex flex-col items-center space-y-8">
            <h1 className="text-3xl font-serif text-accent font-semibold text-center">
              Welcome back, {user.name || user.login}
            </h1>

            <form onSubmit={handleSubmit} className="w-full">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Aubin anything..."
                  className="w-full min-h-[56px] pl-5 pr-14 rounded-2xl border border-muted/30 bg-transparent placeholder:text-muted/60 focus:outline-none focus:border-accent/60 transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  →
                </button>
              </div>
            </form>

            {notice && <p className="text-muted text-sm">{notice}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
