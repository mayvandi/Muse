import { useEffect, useState } from 'react';

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('aubin-theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('aubin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <button
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-muted text-sm"
        onClick={() => setDark(!dark)}
        aria-label="Toggle dark mode"
      >
        {dark ? 'Light' : 'Dark'}
      </button>
      <div className="text-center space-y-6 max-w-sm w-full">
        <h1 className="text-4xl font-serif text-accent font-semibold">Aubin</h1>
        <a
          href="/api/auth/login"
          className="inline-block w-full min-h-[44px] px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity focus:outline-none text-center"
        >
          Sign in with GitHub
        </a>
      </div>
    </div>
  );
}
