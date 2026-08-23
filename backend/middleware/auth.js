const jwt = require('jsonwebtoken');
const pool = require('../db');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token de autenticación' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.SESSION_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const result = await pool.query(`SELECT id, email, nombre, picture FROM usuarios WHERE id = $1;`, [payload.uid]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });

  req.usuario = result.rows[0];
  next();
}

module.exports = { requireAuth };
