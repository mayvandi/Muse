function parseCookies(req) {
  if (req.cookies) return req.cookies;
  const list = {};
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest) {
      list[name.trim()] = rest.join('=').trim();
    }
  });
  return list;
}

export default async function handler(req, res) {
  try {
    const query = req.query || {};
    const { code, error, state } = query;

    if (error === 'access_denied') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      return res.end("<h1>Sign-in cancelled</h1><a href='/'>Go back</a>");
    }

    if (!code) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing code' }));
    }

    const cookies = parseCookies(req);
    const oauthState = cookies.oauth_state;

    if (!oauthState || state !== oauthState) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'State mismatch' }));
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'OAuth not configured' }));
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Aubin-App'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    if (!token) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/html');
      return res.end("<h1>Sign-in failed</h1><a href='/'>Try again</a>");
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Aubin-App',
        Accept: 'application/vnd.github+json'
      }
    });

    const user = await userResponse.json();

    res.setHeader('Set-Cookie', [
      `gh_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<h1>Signed in as @${user.login}</h1><a href='/'>Continue to Aubin</a>`);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
