function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length) {
      list[name.trim()] = rest.join('=').trim();
    }
  });
  return list;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.gh_token;

    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Not authenticated' }));
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Aubin-App',
        Accept: 'application/vnd.github+json'
      }
    });

    if (!userResponse.ok) {
      res.setHeader('Set-Cookie', [
        'gh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
      ]);
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Not authenticated' }));
    }

    const user = await userResponse.json();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
