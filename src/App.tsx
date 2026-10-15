import { useEffect, useState } from 'react';

const GITHUB_CLIENT_ID = "Ov23liMpiKZXXFmkCncl";

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('aubin-theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('aubin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleSignIn = () => {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo,user`;
  };

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
        <button
          onClick={handleSignIn}
          className="w-full min-h-[44px] px-6 py-3 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity focus:outline-none"
        >
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
