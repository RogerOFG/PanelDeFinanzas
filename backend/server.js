require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/me', requireAuth, (req, res) => res.json(req.usuario));

app.use('/api/cuentas', requireAuth, require('./routes/cuentas'));
app.use('/api/transacciones', requireAuth, require('./routes/transacciones'));
app.use('/api/metas', requireAuth, require('./routes/metas'));
app.use('/api/prestamos', requireAuth, require('./routes/prestamos'));
app.use('/api/deudas', requireAuth, require('./routes/deudas'));
app.use('/api/config', requireAuth, require('./routes/config'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FinBot backend escuchando en puerto ${PORT}`));
