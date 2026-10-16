export default async function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'gh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
  ]);
  res.statusCode = 302;
  res.setHeader('Location', '/');
  return res.end();
}
