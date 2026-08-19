# FinBot — Contexto Completo de Base de Datos

## Conexión

| Parámetro | Valor |
|---|---|
| Motor | PostgreSQL (serverless) |
| Host | Neon Console |
| Credencial n8n | `4jBhffR2sWogrTHP` |

---

## Tablas

### `categorias`

Catálogo de categorías de gasto/ingreso. Se usa en JOIN con `transacciones`.

```sql
CREATE TABLE categorias (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT,
  emoji   TEXT
);
```

**Ejemplo de datos:**
| id | nombre | emoji |
|----|--------|-------|
| 1  | Comida | 🍔    |
| 2  | Transporte | 🚗 |
| 3  | Salud  | 💊    |

---

### `transacciones`

Tabla principal. Almacena todos los registros financieros del usuario.

```sql
CREATE TABLE transacciones (
  id            SERIAL PRIMARY KEY,
  chat_id       TEXT,         -- ID del usuario en Telegram
  username      TEXT,
  tipo          TEXT,         -- 'gasto' | 'ganancia'
  monto         NUMERIC,
  categoria_id  INTEGER REFERENCES categorias(id),
  descripcion   TEXT,
  medio_pago    TEXT,         -- efectivo, tarjeta, transferencia, etc.
  fecha         TIMESTAMP,    -- automática al insertar
  fecha_manual  DATE          -- si el usuario especificó una fecha distinta
);
```

**Notas:**
- `chat_id` es el identificador único del usuario (viene de Telegram).
- `fecha_manual` permite registrar gastos de días anteriores sin alterar `fecha`.
- Las operaciones de modificar y eliminar siempre actúan sobre el **último registro** (`ORDER BY fecha DESC LIMIT 1`).

---

### `metas_ahorro`

Registro de metas de ahorro por usuario. No se eliminan físicamente.

```sql
CREATE TABLE metas_ahorro (
  id              SERIAL PRIMARY KEY,
  chat_id         TEXT,
  nombre          TEXT,
  monto_objetivo  NUMERIC,
  monto_actual    NUMERIC,    -- se incrementa con cada aporte
  completada      BOOLEAN,    -- TRUE en lugar de DELETE físico
  prioridad       TEXT,       -- 'alta' | 'media' | 'baja'
  fecha_limite    DATE,
  created_at      TIMESTAMP
);
```

**Notas:**
- `eliminar_meta` no hace DELETE — hace `UPDATE completada = TRUE`.
- `actualizar_meta` hace `UPDATE monto_actual = monto_actual + :aporte`.
- Solo se muestran metas donde `completada = FALSE` en consultas normales.

---

## Relaciones

```
categorias (1) ──────── (N) transacciones
                              via categoria_id
```

`metas_ahorro` no tiene FK — es independiente, vinculada solo por `chat_id`.

---

## Consultas SQL clave

### Registrar gasto o ganancia
```sql
INSERT INTO transacciones (chat_id, username, tipo, monto, categoria_id, descripcion, medio_pago, fecha_manual)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
```

### Consultar transacciones
```sql
SELECT t.tipo, t.monto, c.nombre AS categoria, t.descripcion, t.medio_pago, t.fecha
FROM transacciones t
JOIN categorias c ON c.id = t.categoria_id
WHERE t.chat_id = $1 AND t.tipo = $2
ORDER BY t.fecha DESC;
```

### Resumen agrupado por categoría
```sql
SELECT c.nombre AS categoria, SUM(t.monto) AS total
FROM transacciones t
JOIN categorias c ON c.id = t.categoria_id
WHERE t.chat_id = $1 AND t.tipo = 'gasto'
  AND DATE_TRUNC('month', t.fecha) = DATE_TRUNC('month', NOW())
GROUP BY c.nombre
ORDER BY total DESC;
```

### Historial (últimos 6 meses)
```sql
SELECT t.tipo, t.monto, c.nombre AS categoria, t.descripcion, t.fecha
FROM transacciones t
JOIN categorias c ON c.id = t.categoria_id
WHERE t.chat_id = $1
  AND t.fecha >= NOW() - INTERVAL '6 months'
ORDER BY t.fecha DESC;
```

### Modificar último registro (solo campos mencionados)
```sql
UPDATE transacciones
SET
  monto        = CASE WHEN $1 IS NOT NULL THEN $1 ELSE monto END,
  categoria_id = CASE WHEN $2 IS NOT NULL THEN $2 ELSE categoria_id END,
  descripcion  = CASE WHEN $3 IS NOT NULL THEN $3 ELSE descripcion END,
  medio_pago   = CASE WHEN $4 IS NOT NULL THEN $4 ELSE medio_pago END,
  fecha_manual = CASE WHEN $5 IS NOT NULL THEN $5 ELSE fecha_manual END
WHERE id = (
  SELECT id FROM transacciones
  WHERE chat_id = $6
  ORDER BY fecha DESC LIMIT 1
);
```

### Eliminar último registro
```sql
DELETE FROM transacciones
WHERE id = (
  SELECT id FROM transacciones
  WHERE chat_id = $1
  ORDER BY fecha DESC LIMIT 1
)
RETURNING tipo, monto, descripcion;
```

### Gráfica — gastos del mes por categoría
```sql
SELECT c.nombre AS categoria, SUM(t.monto) AS total
FROM transacciones t
JOIN categorias c ON c.id = t.categoria_id
WHERE t.chat_id = $1 AND t.tipo = 'gasto'
  AND DATE_TRUNC('month', t.fecha) = DATE_TRUNC('month', NOW())
GROUP BY c.nombre;
```

### Crear meta
```sql
INSERT INTO metas_ahorro (chat_id, nombre, monto_objetivo, monto_actual, completada, prioridad, fecha_limite, created_at)
VALUES ($1, $2, $3, 0, FALSE, $4, $5, NOW());
```

### Actualizar meta (aporte)
```sql
UPDATE metas_ahorro
SET monto_actual = monto_actual + $1
WHERE nombre ILIKE $2 AND chat_id = $3 AND completada = FALSE;
```

### Consultar metas activas
```sql
SELECT nombre, monto_objetivo, monto_actual, prioridad, fecha_limite
FROM metas_ahorro
WHERE chat_id = $1 AND completada = FALSE
ORDER BY prioridad;
```

### Eliminar meta (soft delete)
```sql
UPDATE metas_ahorro
SET completada = TRUE
WHERE nombre ILIKE $1 AND chat_id = $2;
```

---

## Credenciales n8n

| Servicio | Credencial ID |
|---|---|
| PostgreSQL (Neon) | `4jBhffR2sWogrTHP` |
| Telegram | `CIIEoWGTpwIsanLe` |
| Groq | `giRaz8fHs8N8ixdr` |

---

## Intenciones del bot y su operación en BD

| Intención | Tabla | Operación |
|---|---|---|
| `registrar_gasto` | `transacciones` | INSERT |
| `registrar_ganancia` | `transacciones` | INSERT |
| `consultar` | `transacciones` + `categorias` | SELECT + JOIN |
| `resumen` | `transacciones` + `categorias` | SELECT + GROUP BY |
| `ver_historial` | `transacciones` + `categorias` | SELECT últimos 6 meses |
| `modificar_registro` | `transacciones` | UPDATE último registro |
| `eliminar_registro` | `transacciones` | DELETE último registro |
| `ver_grafica` | `transacciones` + `categorias` | SELECT + GROUP BY → QuickChart |
| `crear_meta` | `metas_ahorro` | INSERT |
| `actualizar_meta` | `metas_ahorro` | UPDATE monto_actual |
| `consultar_metas` | `metas_ahorro` | SELECT activas |
| `eliminar_meta` | `metas_ahorro` | UPDATE completada = TRUE |

---

## Notas de diseño

- **Modificar/eliminar** siempre apunta al último registro para evitar ambigüedad y no requerir memoria entre interacciones.
- **Metas** usan soft delete (`completada = TRUE`) para conservar historial.
- **`chat_id`** es el identificador de usuario en toda la BD — no hay tabla de usuarios separada.
- **QuickChart** recibe los datos agrupados y genera una imagen doughnut via URL — los labels no deben incluir emojis (no se renderizan).
- Los Schedule Triggers (resumen semanal y mensual) tienen `chat_id` hardcodeado ya que no hay usuario entrante.
