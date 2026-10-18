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
        body: JSON.stringify({ provider, model, apiKey, messages: newMessages })
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

  const handleApprove = () => {
    handleSubmit(undefined, "Approved. Proceed with the plan.");
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

  const renderMessage = (msg: Message, idx: number) => {
    const isUser = msg.role === 'user';
    const isPlan = !isUser && msg.content.includes('## Execution Plan');

    return (
      <div key={idx} className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`${isUser ? 'bg-accent text-slate-900 rounded-2xl px-4 py-3 max-w-[85%]' : 'w-full text-foreground'}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : isPlan ? (
            <div className="bg-muted/10 border border-muted/20 rounded-2xl p-5">
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypePrettyCode, { theme: 'github-dark' }]]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              <button
                onClick={handleApprove}
                className="mt-4 bg-accent text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Approve & Execute
              </button>
            </div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypePrettyCode, { theme: 'github-dark' }]]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-background text-foreground">Loading...</div>;

  if (!user) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground px-6">
        <h1 className="text-4xl font-serif text-accent font-semibold mb-8">Aubin</h1>
        <a href="/api/auth/login" className="bg-accent text-white px-8 py-3 rounded-lg font-medium">Sign in with GitHub</a>
      </div>
    );
  }

  if (settingsOpen) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background text-foreground">
        <div className="flex-none flex items-center justify-between px-4 py-4 pt-[calc(env(safe-area-inset-top)+12px)] border-b border-muted/10">
          <button onClick={() => setSettingsOpen(false)} className="text-muted text-lg">✕</button>
          <h2 className="font-serif text-accent font-semibold">Settings</h2>
          <div className="w-6" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-24 max-w-2xl mx-auto w-full pt-6">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img src={user.avatar_url} alt="avatar" className="w-12 h-12 rounded-full" />
            <div>
              <p className="font-medium">{user.name || user.login}</p>
              <p className="text-muted text-xs">@{user.login} · Free</p>
            </div>
          </div>

          <h3 className="text-muted text-xs uppercase tracking-wide mb-2 px-1">AI</h3>
          <div className="rounded-2xl border border-muted/20 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <span>Provider</span>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="bg-transparent text-right outline-none">
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-4 border-b border-muted/20">
              <span>API Key</span>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} onBlur={() => fetchModels(provider, apiKey)} placeholder="Enter key..." className="bg-transparent text-right outline-none w-1/2" />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span>Model</span>
              {loadingModels ? <span className="text-muted text-xs">Loading...</span> : (
                <select value={model} onChange={e => setModel(e.target.value)} className="bg-transparent text-right outline-none max-w-[60%]">
                  <option value="">Select model...</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>
          </div>

          <h3 className="text-muted text-xs uppercase tracking-wide mb-2 px-1">App</h3>
          <div className="rounded-2xl border border-muted/20 mb-8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4">
              <span>Theme</span>
              <div className="flex gap-1 bg-muted/10 rounded-lg p-1">
                <button onClick={() => setDark(false)} className={`px-3 py-1 rounded text-xs ${!dark ? 'bg-accent text-white' : 'text-muted'}`}>Light</button>
                <button onClick={() => setDark(true)} className={`px-3 py-1 rounded text-xs ${dark ? 'bg-accent text-white' : 'text-muted'}`}>Dark</button>
              </div>
            </div>
          </div>

          <button onClick={saveSettings} className="w-full bg-accent text-white py-3 rounded-xl font-medium mb-4">Save Changes</button>
          <a href="/api/auth/logout" className="block text-center text-red-500 py-3">Sign Out</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-between px-4 pt-[calc(env(safe-area-inset-top)+8px)] pointer-events-none">
        <button onClick={() => setSettingsOpen(true)} className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="14" x2="17" y2="14" /></svg>
        </button>
        <button className="pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm">
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
            {messages.map((m, i) => renderMessage(m, i))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-none w-full px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-background z-10">
        <div className="max-w-3xl mx-auto w-full">
          {chatError && <div className="text-red-500 text-sm mb-2 text-center">{chatError}</div>}
          <form onSubmit={handleSubmit} className="relative bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-3xl p-2 shadow-lg">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Chat with Aubin"
              className="w-full bg-transparent resize-none outline-none px-3 py-2 text-[15px] max-h-32"
              rows={1}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-2">
                <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/20 text-foreground shrink-0"><span className="text-xl leading-none">+</span></button>
                <button type="button" onClick={() => setSettingsOpen(true)} className="px-3 py-1.5 rounded-full bg-muted/20 text-xs font-medium text-foreground truncate max-w-[120px]">{model || 'Select model'}</button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/20 text-foreground shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                </button>
                <button type="submit" disabled={sending || !input.trim()} className="w-10 h-10 rounded-full flex items-center justify-center bg-foreground text-background shrink-0 disabled:opacity-50">
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
