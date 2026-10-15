import crypto from 'node:crypto';

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('OAuth not configured');
  }

  const state = crypto.randomUUID();

  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ]);

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.statusCode = 302;
  res.setHeader('Location', authUrl);
  return res.end();
}
