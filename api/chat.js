export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { provider, model, apiKey, messages, selectedRepo } = req.body || {};
  if (!provider || !model || !apiKey || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing provider, model, apiKey, or messages' });
  }

  const systemPrompt = "You are Aubin, a helpful AI coding agent. Help users write, debug, and explain code. Use markdown for code blocks.";
  const repoContext = selectedRepo ? `The currently selected repository is ${selectedRepo}. Use this repo for all file operations unless the user specifies otherwise.` : 'Ask the user to select a repository in Settings if they want to edit files.';

  const formattedMessages = [
    { role: 'system', content: systemPrompt + '\n' + repoContext },
    ...messages
  ];

  const providers = {
    groq: {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Aubin-App' },
      body: { model, messages: formattedMessages, stream: false },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Aubin-App' },
      body: { model, messages: formattedMessages, stream: false },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    deepseek: {
      url: 'https://api.deepseek.com/chat/completions',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Aubin-App' },
      body: { model, messages: formattedMessages, stream: false },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Aubin-App' },
      body: { model, messages: formattedMessages, stream: false },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    anthropic: {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: { model, max_tokens: 4096, system: systemPrompt, messages },
      extract: (d) => d.content?.[0]?.text || ''
    }
  };

  const p = providers[provider];
  if (!p) return res.status(400).json({ error: 'Unknown provider' });

  try {
    const r = await fetch(p.url, {
      method: 'POST',
      headers: p.headers,
      body: JSON.stringify(p.body)
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || data?.message || 'Provider error' });
    }
    const reply = p.extract(data);
    if (!reply) return res.status(502).json({ error: 'Empty reply from provider' });
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
