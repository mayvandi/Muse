import { useEffect, useState } from 'react';

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('aubin-theme') === 'dark');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('aubin-theme', dark ? 'dark' : 'light');
  }, [dark]);

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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <button
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-muted text-sm"
        onClick={() => setDark(!dark)}
        aria-label="Toggle dark mode"
      >
        {dark ? 'Light' : 'Dark'}
      </button>

      <div className="text-center space-y-6 max-w-sm w-full">
        <h1 className="text-4xl font-serif text-accent font-semibold">Aubin</h1>

        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : user ? (
          <div className="flex flex-col items-center space-y-4">
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-16 h-16 rounded-full"
            />
            <p className="text-lg font-serif text-accent font-semibold">
              Welcome, {user.name || user.login}
            </p>
            <p className="text-muted text-sm">
              Your repositories will appear here soon.
            </p>
            <a
              href="/api/auth/logout"
              className="text-muted text-sm underline hover:opacity-90 transition-opacity"
            >
              Sign out
            </a>
          </div>
        ) : (
          <a
            href="/api/auth/login"
            className="inline-block w-full min-h-[44px] px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity focus:outline-none text-center"
          >
            Sign in with GitHub
          </a>
        )}
      </div>
    </div>
  );
}
