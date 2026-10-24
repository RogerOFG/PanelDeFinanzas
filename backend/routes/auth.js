const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

const SESSION_TTL_DAYS = 30;

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Token de Google inválido o expirado' });
  }

  if (payload.email_verified !== true || !payload.sub) {
    return res.status(401).json({ error: 'El correo de esta cuenta de Google no está verificado' });
  }

  const email = payload.email;
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Cuenta no autorizada' });
  }

  // La cuenta queda amarrada al primer `sub` de Google que inicia sesión con ese email;
  // otro `sub` con el mismo email no actualiza la fila y no recibe sesión.
  const result = await pool.query(
    `INSERT INTO usuarios (email, nombre, picture, google_sub) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre, picture = EXCLUDED.picture,
       google_sub = COALESCE(usuarios.google_sub, EXCLUDED.google_sub)
     WHERE usuarios.google_sub IS NULL OR usuarios.google_sub = EXCLUDED.google_sub
     RETURNING id, email, nombre, picture;`,
    [email, payload.name, payload.picture, payload.sub]
  );
  const usuario = result.rows[0];
  if (!usuario) return res.status(403).json({ error: 'Cuenta no autorizada' });

  const token = jwt.sign(
    { uid: usuario.id, email: usuario.email },
    process.env.SESSION_SECRET,
    { expiresIn: `${SESSION_TTL_DAYS}d` }
  );
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;

  res.json({ token, exp, usuario });
});

module.exports = router;
