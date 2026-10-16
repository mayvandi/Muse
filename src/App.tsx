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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  if (settingsOpen) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <header className="flex items-center px-4 py-3">
          <button
            onClick={() => setSettingsOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center text-muted text-xl"
            aria-label="Tutup"
          >
            ✕
          </button>
          <h2 className="flex-1 text-center font-serif text-accent font-semibold">
            Pengaturan
          </h2>
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted text-sm"
            aria-label="Info"
          >
            ⓘ
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 max-w-2xl mx-auto w-full">
          {user && (
            <section className="mb-6">
              <div className="flex items-center gap-3 py-3 px-3 rounded-2xl bg-muted/5">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-10 h-10 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-accent font-medium truncate">
                    {user.name || user.login}
                  </p>
                  <p className="text-muted text-xs truncate">
                    @{user.login} · Free
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mb-6">
            <h3 className="text-muted text-xs mb-2 px-1">Akun</h3>
            <div className="rounded-2xl border border-muted/20 overflow-hidden">
              <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/5 text-left">
                <span className="text-accent">Repo</span>
                <span className="text-muted">›</span>
              </button>
              <div className="border-t border-muted/20" />
              <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/5 text-left">
                <span className="text-accent">Profil</span>
                <span className="text-muted">›</span>
              </button>
              <div className="border-t border-muted/20" />
              <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/5 text-left">
                <span className="text-accent">Notifikasi</span>
                <span className="text-muted">›</span>
              </button>
              <div className="border-t border-muted/20" />
              <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/5 text-left">
                <span className="text-accent">Privasi</span>
                <span className="text-muted">›</span>
              </button>
              <div className="border-t border-muted/20" />
              <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/5 text-left">
                <span className="text-accent">Tautan yang dibagikan</span>
                <span className="text-muted">›</span>
              </button>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-muted text-xs mb-2 px-1">Aplikasi</h3>
            <div className="rounded-2xl border border-muted/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-4">
                <span className="text-accent">Tema</span>
                <div className="flex gap-1 bg-muted/10 rounded-lg p-1">
                  <button
                    onClick={() => setDark(false)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      !dark ? 'bg-accent text-white' : 'text-muted'
                    }`}
                  >
                    Terang
                  </button>
                  <button
                    onClick={() => setDark(true)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      dark ? 'bg-accent text-white' : 'text-muted'
                    }`}
                  >
                    Gelap
                  </button>
                </div>
              </div>
            </div>
          </section>

          {user && (
            <a
              href="/api/auth/logout"
              className="flex items-center gap-2 px-3 py-4 text-red-500 hover:opacity-80 transition-opacity"
            >
              <span>←</span>
              <span>Keluar</span>
            </a>
          )}
        </main>
      </div>
    );
  }

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
          <button
            onClick={() => setSettingsOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center gap-2 text-muted text-xs"
          >
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-6 h-6 rounded-full"
            />
            <span>{user.name || user.login}</span>
          </button>
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
