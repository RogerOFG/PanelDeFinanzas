const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token de autenticación' });

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const email = payload.email;
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Cuenta no autorizada' });
  }

  const result = await pool.query(
    `INSERT INTO usuarios (email, nombre, picture) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre, picture = EXCLUDED.picture
     RETURNING id, email, nombre, picture;`,
    [email, payload.name, payload.picture]
  );

  req.usuario = result.rows[0];
  next();
}

module.exports = { requireAuth };
