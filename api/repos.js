export default async function handler(req, res) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/gh_token=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const ghRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Aubin-App', Accept: 'application/vnd.github+json' }
    });
    const data = await ghRes.json();
    res.status(200).json({ repos: data.map(r => r.full_name) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
}
