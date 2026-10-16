import { useEffect, useState } from 'react';

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
  needsReauth?: boolean;
}

const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  groq: [
    { label: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
    { label: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
    { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
  ],
  deepseek: [
    { label: 'DeepSeek V3', value: 'deepseek-chat' },
    { label: 'DeepSeek R1', value: 'deepseek-reasoner' },
  ],
  openrouter: [
    { label: 'Auto (Best for task)', value: 'auto' },
    { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
  ],
  anthropic: [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'o3-mini', value: 'o3-mini' },
  ],
};

export default function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('aubin-theme') as 'light' | 'dark' | 'system') || 'dark';
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings state
  const [selectedRepo, setSelectedRepo] = useState(() => localStorage.getItem('aubin-repo') || 'All Repositories');
  const [provider, setProvider] = useState(() => localStorage.getItem('aubin-provider') || 'groq');
  const [model, setModel] = useState(() => localStorage.getItem('aubin-model') || 'llama-3.3-70b-versatile');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('aubin-api-key') || '');
  const [language, setLanguage] = useState(() => localStorage.getItem('aubin-language') || 'en');

  useEffect(() => {
    let isDark = false;
    if (themeMode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = themeMode === 'dark';
    }
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('aubin-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('aubin-repo', selectedRepo);
  }, [selectedRepo]);

  useEffect(() => {
    localStorage.setItem('aubin-provider', provider);
    const availableModels = PROVIDER_MODELS[provider];
    if (availableModels && !availableModels.some(m => m.value === model)) {
      const defaultModel = availableModels[0]?.value || '';
      setModel(defaultModel);
      localStorage.setItem('aubin-model', defaultModel);
    }
  }, [provider, model]);

  useEffect(() => {
    localStorage.setItem('aubin-model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('aubin-api-key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('aubin-language', language);
  }, [language]);

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
    setNotice('Agent is initialized and ready.');
    setInput('');
    setTimeout(() => setNotice(null), 3000);
  };

  if (settingsOpen) {
    return (
      <div
        className="min-h-screen flex flex-col font-sans"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <header className="flex items-center px-4 py-3">
          <button
            onClick={() => setSettingsOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center text-muted text-xl"
            aria-label="Close"
          >
            ✕
          </button>
          <h2 className="flex-1 text-center font-sans text-foreground font-semibold text-base">
            Settings
          </h2>
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted text-sm"
            aria-label="Info"
          >
            ⓘ
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 max-w-2xl mx-auto w-full font-sans">
          {user && (
            <section className="mb-6">
              <div className="flex items-center gap-3 py-3 px-3 rounded-2xl bg-muted/5">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-10 h-10 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium truncate">
                    {user.name || user.login}
                  </p>
                  <p className="text-muted text-xs truncate">
                    @{user.login} · Free
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ACCOUNT SECTION */}
          <section className="mb-6">
            <h3 className="text-muted text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              Account
            </h3>
            <div className="rounded-2xl border border-muted/20 overflow-hidden bg-muted/5">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">GitHub</span>
                </div>
                <span className="text-muted text-sm">{user ? `@${user.login}` : 'Not connected'}</span>
              </div>
              <div className="border-t border-muted/20" />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">Repositories</span>
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedRepo}
                    onChange={e => setSelectedRepo(e.target.value)}
                    className="bg-transparent text-muted text-sm focus:outline-none cursor-pointer text-right"
                  >
                    <option value="All Repositories" className="bg-background text-foreground">All Repositories</option>
                    <option value="Current Repo" className="bg-background text-foreground">Current Repo</option>
                  </select>
                  <span className="text-muted text-sm">›</span>
                </div>
              </div>
            </div>
          </section>

          {/* AI SECTION */}
          <section className="mb-6">
            <h3 className="text-muted text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              AI
            </h3>
            <div className="rounded-2xl border border-muted/20 overflow-hidden bg-muted/5">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">Provider</span>
                </div>
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  className="bg-transparent text-muted text-sm focus:outline-none cursor-pointer text-right capitalize"
                >
                  <option value="groq" className="bg-background text-foreground">Groq</option>
                  <option value="deepseek" className="bg-background text-foreground">DeepSeek</option>
                  <option value="openrouter" className="bg-background text-foreground">OpenRouter</option>
                  <option value="anthropic" className="bg-background text-foreground">Anthropic</option>
                  <option value="openai" className="bg-background text-foreground">OpenAI</option>
                </select>
              </div>
              <div className="border-t border-muted/20" />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">Model</span>
                </div>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="bg-transparent text-muted text-sm focus:outline-none cursor-pointer text-right max-w-[180px] truncate"
                >
                  {(PROVIDER_MODELS[provider] || []).map(m => (
                    <option key={m.value} value={m.value} className="bg-background text-foreground">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t border-muted/20" />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">API Key</span>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter key..."
                  className="bg-transparent text-right text-muted placeholder:text-muted/50 text-sm focus:outline-none w-36"
                />
              </div>
            </div>
          </section>

          {/* APP SECTION */}
          <section className="mb-8">
            <h3 className="text-muted text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              App
            </h3>
            <div className="rounded-2xl border border-muted/20 overflow-hidden bg-muted/5">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">Theme</span>
                </div>
                <div className="flex gap-1 bg-muted/10 rounded-lg p-1">
                  <button
                    onClick={() => setThemeMode('light')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      themeMode === 'light' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      themeMode === 'dark' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setThemeMode('system')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      themeMode === 'system' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    System
                  </button>
                </div>
              </div>
              <div className="border-t border-muted/20" />
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span className="text-foreground text-sm font-medium">Language</span>
                </div>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="bg-transparent text-muted text-sm focus:outline-none cursor-pointer text-right"
                >
                  <option value="en" className="bg-background text-foreground">English</option>
                  <option value="id" className="bg-background text-foreground">Bahasa Indonesia</option>
                </select>
              </div>
            </div>
          </section>

          {user && (
            <div className="flex justify-center pt-2">
              <a
                href="/api/auth/logout"
                className="flex items-center gap-2 px-4 py-3 text-red-500 font-medium text-sm hover:opacity-80 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </a>
            </div>
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
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          {themeMode === 'dark' ? 'Light' : 'Dark'}
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
