import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';
import { LiquidGlassView as LiquidGlass } from '@zerocoder1/liquid-glass/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
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

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackContent?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Markdown rendering error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="text-foreground whitespace-pre-wrap font-sans text-sm">
          {this.props.fallbackContent}
        </div>
      );
    }
    return this.props.children;
  }
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
  const [repoList, setRepoList] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState(() => localStorage.getItem('aubin-selected-repo') || '');

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

  useEffect(() => { if (user) { fetch('/api/repos').then(r => r.json()).then(d => { if (d.repos) setRepoList(d.repos); }); } }, [user]);

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
          selectedRepo,
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
      <div className="flex flex-col h-[100dvh] bg-background text-foreground font-sans">
        <header className="flex-none flex items-center px-4 py-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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

        <main className="flex-1 overflow-y-auto px-4 pb-24 max-w-2xl mx-auto w-full font-sans">
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
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 9.51 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
                  <span className="font-sans text-foreground">Repositories</span>
                </div>
                <select
                  value={selectedRepo}
                  onChange={e => { setSelectedRepo(e.target.value); localStorage.setItem('aubin-selected-repo', e.target.value); }}
                  className="font-sans bg-transparent text-right outline-none max-w-[60%] text-muted text-sm appearance-none"
                >
                  <option value="">Select repo...</option>
                  {repoList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden relative">
      {/* Floating Header Buttons */}
      {user && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-between px-4 pt-[calc(env(safe-area-inset-top)+8px)] pointer-events-none">
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open Settings"
            className="pointer-events-auto w-11 h-11 rounded-full liquid-glass flex items-center justify-center text-foreground transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </svg>
          </button>

          <button
            aria-label="Ghost"
            className="pointer-events-auto w-11 h-11 rounded-full liquid-glass flex items-center justify-center text-foreground transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5 2.5-2.5 3 3V10a8 8 0 0 0-8-8z"></path>
            </svg>
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pt-24 flex flex-col items-center justify-center">
        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : !user ? (
          <div className="flex flex-col items-center text-center space-y-6 max-w-sm w-full my-auto">
            <h1 className="text-3xl font-serif text-accent font-semibold text-center">Aubin</h1>
            {authError && <p className="text-muted text-sm">{authError}</p>}
            <a
              href="/api/auth/login"
              className="inline-block w-full min-h-[44px] px-6 py-3 rounded-xl bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center shadow-md font-sans"
            >
              Sign in with GitHub
            </a>
          </div>
        ) : user.needsReauth ? (
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm w-full my-auto">
            <h1 className="text-3xl font-serif text-accent font-semibold text-center">
              Welcome back, {user.name || user.login}
            </h1>
            <p className="text-muted text-sm font-sans">
              Aubin needs access to your repositories to continue.
            </p>
            <a
              href="/api/auth/logout"
              className="inline-block min-h-[44px] px-6 py-3 rounded-xl bg-accent text-white font-medium hover:opacity-90 transition-opacity text-center shadow-md font-sans"
            >
              Reconnect GitHub
            </a>
          </div>
        ) : messages.length === 0 ? (
          <div className="w-full max-w-xl flex flex-col items-center text-center space-y-3 my-auto">
            <h1 className="text-3xl font-serif text-accent font-semibold text-center">
              Welcome back, {user.name || user.login}
            </h1>
            {notice && (
              <p className="text-sm font-medium font-sans text-foreground/80 bg-muted/10 px-3 py-1.5 rounded-full backdrop-blur-sm animate-fade-in">
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
                {m.role === 'user' ? (
                  <div className="max-w-[80%] bg-accent text-black font-sans rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
                    {m.content}
                  </div>
                ) : (
                  <div className="w-full max-w-full px-0 py-2">
                    <ErrorBoundary fallbackContent={m.content}>
                      <div className="markdown-content w-full text-[15px] leading-relaxed font-sans">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-muted/10 text-foreground flex items-center gap-1 font-sans">
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

      {/* Input Box Bottom Bar */}
      {user && !user.needsReauth && (
        import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';

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

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('aubin-theme') === 'dark');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [provider, setProvider] = useState(() => localStorage.getItem('aubin-provider') || 'groq');
  const [model, setModel] = useState(() => localStorage.getItem('aubin-model') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('aubin-api-key') || '');
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [repoList, setRepoList] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState(() => localStorage.getItem('aubin-selected-repo') || '');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('aubin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUser(data);
        if (data) {
          const savedMsgs = localStorage.getItem(`aubin-chat-${data.login}`);
          if (savedMsgs) setMessages(JSON.parse(savedMsgs));
        }
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) {
      fetch('/api/repos').then(r => r.json()).then(d => {
        if (d.repos) setRepoList(d.repos);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (user && messages.length > 0) {
      localStorage.setItem(`aubin-chat-${user.login}`, JSON.stringify(messages.slice(-100)));
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, user]);

  const handleSubmit = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || sending) return;

    if (!apiKey) {
      setChatError('Please add an API key in Settings first.');
      return;
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    setChatError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey, messages: newMessages, selectedRepo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get reply');
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setChatError(err.message);
    } finally {
      setSending(false);
    }
  };

  const fetchModels = async (p: string, key: string) => {
    if (!key) return;
    setLoadingModels(true);
    try {
      const urls: Record<string, string> = {
        groq: 'https://api.groq.com/openai/v1/models',
        openrouter: 'https://openrouter.ai/api/v1/models',
        deepseek: 'https://api.deepseek.com/models',
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/models'
      };
      const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
      if (p === 'anthropic') {
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
      }
      const res = await fetch(urls[p], { headers });
      const data = await res.json();
      const list = data.data?.map((m: any) => m.id) || [];
      const filtered = list.filter((m: string) => !m.includes('whisper') && !m.includes('orpheus') && !m.includes('guard') && !m.includes('tts'));
      setModels(filtered);
    } catch (e) {
      console.error(e);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('aubin-provider', provider);
    localStorage.setItem('aubin-model', model);
    localStorage.setItem('aubin-api-key', apiKey);
    setSettingsOpen(false);
  };

  if (loading) {
    return <div className="h-[100dvh] flex items-center justify-center bg-background text-foreground font-sans">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground px-6">
        <h1 className="text-4xl font-serif text-accent font-semibold mb-8">Aubin</h1>
        <a href="/api/auth/login" className="bg-accent text-white px-8 py-3 rounded-lg font-medium font-sans hover:opacity-90">Sign in with GitHub</a>
      </div>
    );
  }

  if (settingsOpen) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background text-foreground">
        <div className="flex-none flex items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)] border-b border-muted/10">
          <button onClick={() => setSettingsOpen(false)} className="text-muted text-xl min-h-[44px] min-w-[44px] flex items-center">✕</button>
          <h2 className="font-serif text-accent font-semibold text-lg">Settings</h2>
          <div className="w-11" />
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-24 max-w-2xl mx-auto w-full pt-6">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img src={user.avatar_url} alt="avatar" className="w-12 h-12 rounded-full" />
            <div>
              <p className="font-sans font-medium text-foreground text-lg">{user.name || user.login}</p>
              <p className="font-sans text-muted text-sm">@{user.login} · Free</p>
            </div>
          </div>

          <h3 className="font-sans text-muted text-xs uppercase tracking-wider mb-3 px-1">Account</h3>
          <div className="rounded-2xl border border-muted/20 mb-8 overflow-hidden bg-white/50 dark:bg-transparent">
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
                <span className="font-sans text-foreground">GitHub</span>
              </div>
              <span className="font-sans text-muted text-sm">@{user.login}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 9.51 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
                <span className="font-sans text-foreground">Repositories</span>
              </div>
              <select 
                value={selectedRepo} 
                onChange={e => { setSelectedRepo(e.target.value); localStorage.setItem('aubin-selected-repo', e.target.value); }} 
                className="font-sans bg-transparent text-right outline-none max-w-[60%] text-muted text-sm appearance-none"
              >
                <option value="">Select repo...</option>
                {repoList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <h3 className="font-sans text-muted text-xs uppercase tracking-wider mb-3 px-1">AI</h3>
          <div className="rounded-2xl border border-muted/20 mb-8 overflow-hidden bg-white/50 dark:bg-transparent">
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                <span className="font-sans text-foreground">Provider</span>
              </div>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="font-sans bg-transparent text-right outline-none text-muted text-sm appearance-none">
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>
                <span className="font-sans text-foreground">Model</span>
              </div>
              {loadingModels ? <span className="font-sans text-muted text-xs">Loading...</span> : (
                <select value={model} onChange={e => setModel(e.target.value)} className="font-sans bg-transparent text-right outline-none max-w-[60%] text-muted text-sm appearance-none">
                  <option value="">Select model...</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>
                <span className="font-sans text-foreground">API Key</span>
              </div>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} onBlur={() => fetchModels(provider, apiKey)} placeholder="Enter key..." className="font-sans bg-transparent text-right outline-none w-1/2 text-muted text-sm" />
            </div>
          </div>

          <h3 className="font-sans text-muted text-xs uppercase tracking-wider mb-3 px-1">App</h3>
          <div className="rounded-2xl border border-muted/20 mb-8 overflow-hidden bg-white/50 dark:bg-transparent">
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                <span className="font-sans text-foreground">Theme</span>
              </div>
              <div className="flex gap-1 bg-muted/10 rounded-lg p-1">
                <button onClick={() => setDark(false)} className={`font-sans px-4 py-1.5 rounded-md text-xs transition-colors ${!dark ? 'bg-accent text-white' : 'text-muted'}`}>Light</button>
                <button onClick={() => setDark(true)} className={`font-sans px-4 py-1.5 rounded-md text-xs transition-colors ${dark ? 'bg-accent text-white' : 'text-muted'}`}>Dark</button>
                <button className="font-sans px-4 py-1.5 rounded-md text-xs text-muted">System</button>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>
                <span className="font-sans text-foreground">Language</span>
              </div>
              <span className="font-sans text-muted text-sm flex items-center gap-1">English <span className="text-lg leading-none">⟠</span></span>
            </div>
          </div>

          <button onClick={saveSettings} className="font-sans w-full bg-accent text-white py-3 rounded-xl font-medium mb-4 hover:opacity-90">Save Changes</button>
          <a href="/api/auth/logout" className="font-sans block text-center text-red-500 py-3 mb-4">Sign Out</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground relative">
      
      {/* Floating Header Buttons */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-between px-4 pt-[calc(env(safe-area-inset-top)+8px)] pointer-events-none">
        <button onClick={() => setSettingsOpen(true)} className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm text-foreground">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="14" x2="17" y2="14" /></svg>
        </button>
        <button className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"></path></svg>
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-24 pb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <h1 className="text-3xl font-serif text-accent font-semibold">Welcome back, {user.name || user.login}</h1>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((m, i) => (
              <div key={i} className={`flex w-full mb-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.role === 'user' ? 'bg-accent text-black rounded-2xl px-4 py-3 max-w-[85%]' : 'w-full text-foreground'}`}>
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap font-sans text-[15px]">{m.content}</p>
                  ) : (
                    <div className="markdown-content font-sans text-[15px] leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypePrettyCode, { theme: 'github-dark' }]]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - True Transparent Background */}
      <div className="flex-none w-full px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-transparent z-10">
        <div className="max-w-3xl mx-auto w-full">
          {chatError && <div className="text-red-500 text-sm mb-2 text-center font-sans">{chatError}</div>}
          
          <form onSubmit={handleSubmit} className="relative w-full rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col p-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Chat with Aubin"
              className="w-full bg-transparent border-none outline-none resize-none px-4 py-3 text-[16px] max-h-32 text-foreground placeholder:text-muted focus:ring-0"
              rows={1}
            />
            <div className="flex items-center justify-between mt-1 px-2">
              <div className="flex items-center gap-2">
                <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 text-foreground shrink-0 transition-colors">
                  <span className="text-xl leading-none font-light">+</span>
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} className="px-4 py-2.5 rounded-full bg-black/5 dark:bg-white/10 text-xs font-medium text-foreground truncate max-w-[140px] transition-colors font-sans">
                  {model || 'Select model'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 text-foreground shrink-0 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                </button>
                <button type="submit" disabled={sending || !input.trim()} className="w-10 h-10 rounded-full flex items-center justify-center bg-foreground text-background shrink-0 disabled:opacity-50 transition-colors shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}