import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import './styles/markdown.css';

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
  needsReauth?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  deepseek: 'https://api.deepseek.com/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  openai: 'https://api.openai.com/v1/models',
};

const EXCLUDED_MODEL_KEYWORDS = [
  'whisper',
  'orpheus',
  'tts',
  'audio',
  'prompt-guard',
  'safeguard',
];

const rehypePrettyCodeOptions = {
  theme: 'github-dark',
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

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Attachment state
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mic active state
  const [isMicActive, setIsMicActive] = useState(false);

  // Model selection popup state
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Settings state
  const [selectedRepo, setSelectedRepo] = useState(() => localStorage.getItem('aubin-repo') || 'All Repositories');
  const [provider, setProvider] = useState(() => localStorage.getItem('aubin-provider') || 'groq');
  const [model, setModel] = useState(() => localStorage.getItem('aubin-model') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('aubin-api-key') || '');
  const [language, setLanguage] = useState(() => localStorage.getItem('aubin-language') || 'en');

  // Dynamic models state
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, [provider]);

  useEffect(() => {
    localStorage.setItem('aubin-model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('aubin-api-key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('aubin-language', language);
  }, [language]);

  // Load chat messages on mount / user change
  useEffect(() => {
    if (user?.login) {
      const saved = localStorage.getItem(`aubin-chat-${user.login}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed.slice(-100));
          }
        } catch {
          // ignore error
        }
      }
    }
  }, [user?.login]);

  // Save chat messages on change
  useEffect(() => {
    if (user?.login && messages.length > 0) {
      localStorage.setItem(`aubin-chat-${user.login}`, JSON.stringify(messages.slice(-100)));
    }
  }, [messages, user?.login]);

  // Scroll to bottom when messages or sending state change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, chatError]);

  // Adjust textarea height up to 5 lines (~120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [input]);

  // Fetch / load models dynamically per provider
  useEffect(() => {
    setModelError(null);

    const isChatModel = (id: string) => {
      const lower = id.toLowerCase();
      return !EXCLUDED_MODEL_KEYWORDS.some(keyword => lower.includes(keyword));
    };

    const cached = localStorage.getItem(`aubin-models-${provider}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(isChatModel);
          setModelsList(filtered);
          if (!model || !filtered.includes(model)) {
            setModel(filtered[0] || '');
          }
          return;
        }
      } catch {
        // ignore cache error
      }
    }

    if (!apiKey.trim()) {
      setModelsList([]);
      return;
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) {
      setModelsList([]);
      return;
    }

    let isMounted = true;
    setFetchingModels(true);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    };

    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    }

    fetch(endpoint, { method: 'GET', headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!isMounted) return;
        let ids: string[] = [];
        if (Array.isArray(data.data)) {
          ids = data.data.map((m: { id?: string; name?: string }) => m.id || m.name || '').filter(Boolean);
        } else if (Array.isArray(data.models)) {
          ids = data.models.map((m: { id?: string; name?: string }) => m.id || m.name || '').filter(Boolean);
        } else if (Array.isArray(data)) {
          ids = data.map((m: { id?: string; name?: string }) => m.id || m.name || '').filter(Boolean);
        }

        ids = ids.filter(isChatModel);

        if (ids.length === 0) {
          throw new Error('No models found');
        }

        ids = Array.from(new Set(ids)).sort();

        setModelsList(ids);
        localStorage.setItem(`aubin-models-${provider}`, JSON.stringify(ids));

        if (!model || !ids.includes(model)) {
          setModel(ids[0]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setModelError("Couldn't load models");
      })
      .finally(() => {
        if (isMounted) setFetchingModels(false);
      });

    return () => {
      isMounted = false;
    };
  }, [provider, apiKey]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMsgText = input.trim();
    const updatedMessages: Message[] = [...messages, { role: 'user', content: userMsgText }];

    setMessages(updatedMessages);
    setInput('');
    setAttachedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    setChatError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          messages: updatedMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send message');
      }

      if (data.reply) {
        setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Something went wrong';
      setChatError(errMsg);
      setTimeout(() => setChatError(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Display friendly model name
  const displayModelName = model
    ? model.split('/').pop()?.replace(/^(llama-3\.\d-|claude-3-5-|gpt-4o-)/i, '') || model
    : 'Select model';

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

        <main
          className="flex-1 overflow-y-auto px-4 max-w-2xl mx-auto w-full font-sans"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}
        >
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
              <div className="flex flex-col px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-foreground text-sm font-medium">Model</span>
                  </div>
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    disabled={!apiKey.trim() || fetchingModels || modelsList.length === 0}
                    className="bg-transparent text-muted text-sm focus:outline-none cursor-pointer text-right max-w-[200px] truncate disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!apiKey.trim() ? (
                      <option value="" className="bg-background text-foreground">Add API key first</option>
                    ) : fetchingModels ? (
                      <option value="" className="bg-background text-foreground">Loading models...</option>
                    ) : modelsList.length === 0 ? (
                      <option value="" className="bg-background text-foreground">No models available</option>
                    ) : (
                      modelsList.map(m => (
                        <option key={m} value={m} className="bg-background text-foreground">
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {modelError && (
                  <p className="text-red-500 text-xs mt-1 text-right">{modelError}</p>
                )}
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
    <div className="min-h-screen flex flex-col justify-between relative">
      {/* Top Header */}
      {user && (
        <header
          className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center justify-between"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open Settings"
            className="w-11 h-11 rounded-full bg-muted/15 hover:bg-muted/25 backdrop-blur-md flex items-center justify-center transition-colors text-foreground"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h12M4 18h8" />
            </svg>
          </button>
          <button
            aria-label="Ghost placeholder"
            className="w-11 h-11 rounded-full bg-muted/15 hover:bg-muted/25 backdrop-blur-md flex items-center justify-center transition-colors text-foreground"
          >
            <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 1 15 0v6.75a.75.75 0 0 1-1.28.53 1.5 1.5 0 0 0-2.12 0 .75.75 0 0 1-1.28-.53V18a1.5 1.5 0 0 0-3 0v.75a.75.75 0 0 1-1.28.53 1.5 1.5 0 0 0-2.12 0 .75.75 0 0 1-1.28-.53V18a1.5 1.5 0 0 0-2.12 0A.75.75 0 0 1 4.5 18.75V12z" />
              <circle cx="9" cy="11" r="1" fill="currentColor" />
              <circle cx="15" cy="11" r="1" fill="currentColor" />
            </svg>
          </button>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-44 overflow-y-auto">
        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : !user ? (
          <div className="flex flex-col items-center text-center space-y-6 max-w-sm w-full my-auto">
            <h1 className="text-4xl font-serif text-accent font-semibold">Aubin</h1>
            {authError && <p className="text-muted text-sm">{authError}</p>}
            <a
              href="/api/auth/login"
              className="inline-block w-full min-h-[44px] px-6 py-3 rounded-xl bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center shadow-md"
            >
              Sign in with GitHub
            </a>
          </div>
        ) : user.needsReauth ? (
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm w-full my-auto">
            <h1 className="text-3xl font-serif text-accent font-semibold">
              Welcome back, {user.name || user.login}
            </h1>
            <p className="text-muted text-sm">
              Aubin needs access to your repositories to continue.
            </p>
            <a
              href="/api/auth/logout"
              className="inline-block min-h-[44px] px-6 py-3 rounded-xl bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center shadow-md"
            >
              Reconnect GitHub
            </a>
          </div>
        ) : messages.length === 0 ? (
          <div className="w-full max-w-xl flex flex-col items-center text-center space-y-3 my-auto">
            <h1 className="text-3xl md:text-4xl font-serif text-accent font-semibold tracking-tight">
              Welcome back, {user.name || user.login}
            </h1>
            {notice && (
              <p className="text-sm font-medium text-foreground/80 bg-muted/10 px-3 py-1.5 rounded-full backdrop-blur-sm animate-fade-in">
                {notice}
              </p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col space-y-4 my-auto">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-accent text-black font-medium'
                      : 'bg-muted/10 text-foreground'
                  }`}
                >
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[[rehypePrettyCode, rehypePrettyCodeOptions]]}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-muted/10 text-foreground flex items-center gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        )}
      </main>

      {/* Liquid Glass Bottom Input Area for Signed-In Users */}
      {user && !user.needsReauth && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 z-20 flex flex-col items-center pointer-events-none"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <div className="w-full max-w-xl pointer-events-auto relative flex flex-col gap-2">

            {/* Red Error Banner */}
            {chatError && (
              <div className="bg-red-500/10 text-red-500 border border-red-500/20 text-xs px-3 py-2 rounded-xl mb-1 text-center font-medium backdrop-blur-md animate-fade-in">
                {chatError}
              </div>
            )}

            {/* Image Attachment Thumbnail Preview */}
            {attachedImage && (
              <div className="self-start relative group rounded-2xl overflow-hidden border border-white/20 shadow-lg mb-1">
                <img src={attachedImage} alt="Attachment preview" className="w-20 h-20 object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs backdrop-blur-sm"
                  aria-label="Remove attached image"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Model Selector Dropdown Popover */}
            {showModelPicker && (
              <div className="liquid-glass rounded-2xl p-2 mb-1 max-h-48 overflow-y-auto shadow-2xl z-30">
                {modelsList.length === 0 ? (
                  <p className="text-xs text-muted p-2 text-center">No models loaded. Set API key in Settings.</p>
                ) : (
                  modelsList.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setModel(m);
                        setShowModelPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-xl font-medium truncate flex items-center justify-between ${
                        m === model ? 'bg-accent/15 text-accent font-semibold' : 'text-foreground hover:bg-muted/10'
                      }`}
                    >
                      <span className="truncate">{m}</span>
                      {m === model && <span>✓</span>}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Liquid Glass Container Card */}
            <div className="liquid-glass rounded-[28px] p-3 flex flex-col gap-2">
              {/* Row 1: Top Textarea Input */}
              <div className="px-1 pt-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Chat with Aubin"
                  rows={1}
                  className="w-full bg-transparent border-0 resize-none text-foreground placeholder:text-muted/60 focus:outline-none text-base font-normal leading-snug max-h-32"
                />
              </div>

              {/* Row 2: Bottom Control Toolbar */}
              <div className="flex items-center justify-between pt-1">
                {/* Left Controls: Attachment + Model Pill */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="w-10 h-10 rounded-full glass-pill flex items-center justify-center text-foreground font-light text-xl hover:opacity-80 transition-all"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="h-10 px-3.5 rounded-full glass-pill flex items-center gap-1.5 text-xs font-medium text-foreground hover:opacity-80 transition-all truncate max-w-[180px]"
                  >
                    <span className="truncate">{displayModelName}</span>
                    <span className="text-[10px] opacity-60">▼</span>
                  </button>
                </div>

                {/* Right Controls: Mic + Send Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMicActive(!isMicActive)}
                    aria-label="Toggle microphone"
                    className={`w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-all ${
                      isMicActive ? 'text-accent bg-accent/20' : 'text-foreground'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sending}
                    aria-label="Send message"
                    className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.5m0-10.5L7.5 7.5M12 3l4.5 4.5M6 18h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
