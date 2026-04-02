const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const pg      = require('pg');
const cors    = require('cors');
const path    = require('path');
const XLSX    = require('xlsx');

/* ── PostgreSQL connection ──────────────────────────────────────── */
pg.types.setTypeParser(20, val => parseInt(val, 10)); // BIGINT → JS Number

const isLocal = (process.env.DATABASE_URL || '').includes('localhost');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

const queryAll = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows;
};
const queryOne = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
};

/* ── Schema (idempotent) ────────────────────────────────────────── */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                 SERIAL  PRIMARY KEY,
      title              TEXT    NOT NULL,
      status             TEXT    NOT NULL DEFAULT 'todo',
      assignee           TEXT    NOT NULL DEFAULT '',
      unidad_residencial TEXT    NOT NULL DEFAULT '',
      hora_inicio        BIGINT  DEFAULT NULL,
      hora_fin           BIGINT  DEFAULT NULL,
      priority           INTEGER NOT NULL DEFAULT 0,
      created_at         BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
    CREATE TABLE IF NOT EXISTS subtasks (
      id         SERIAL  PRIMARY KEY,
      task_id    INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
    CREATE TABLE IF NOT EXISTS informes (
      id         SERIAL  PRIMARY KEY,
      title      TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);
  console.log('Schema ready');
}

console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ── GET /tasks  (includes subtasks array per task) ────────────── */
app.get('/tasks', async (req, res) => {
  try {
    const tasks   = await queryAll('SELECT * FROM tasks ORDER BY created_at ASC');
    const allSubs = await queryAll('SELECT * FROM subtasks ORDER BY created_at ASC');
    const subMap  = {};
    for (const s of allSubs) {
      if (!subMap[s.task_id]) subMap[s.task_id] = [];
      subMap[s.task_id].push(s);
    }
    tasks.forEach(t => { t.subtasks = subMap[t.id] || []; });
    res.json(tasks);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── POST /tasks ────────────────────────────────────────────────── */
app.post('/tasks', async (req, res) => {
  try {
    const { title, status = 'todo', assignee = '', unidad_residencial = '', priority = 0 } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
    const task = await queryOne(
      `INSERT INTO tasks (title, status, assignee, unidad_residencial, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title.trim(), status, assignee.trim(), unidad_residencial.trim(), priority ? 1 : 0]
    );
    task.subtasks = [];
    res.status(201).json(task);
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── PUT /tasks/:id ─────────────────────────────────────────────── */
app.put('/tasks/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await queryOne('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });

    const title              = req.body.title              !== undefined ? req.body.title              : ex.title;
    const status             = req.body.status             !== undefined ? req.body.status             : ex.status;
    const assignee           = req.body.assignee           !== undefined ? req.body.assignee           : ex.assignee;
    const unidad_residencial = req.body.unidad_residencial !== undefined ? req.body.unidad_residencial : ex.unidad_residencial;
    const priority           = req.body.priority           !== undefined ? Number(req.body.priority)   : ex.priority;

    let hora_inicio = ex.hora_inicio;
    let hora_fin    = ex.hora_fin;

    if (status === 'inprogress' && !hora_inicio) hora_inicio = Date.now();
    if (status === 'done')                        hora_fin    = Date.now();
    else if (ex.status === 'done')                hora_fin    = null;

    const updated = await queryOne(`
      UPDATE tasks
      SET title=$1, status=$2, assignee=$3, unidad_residencial=$4,
          hora_inicio=$5, hora_fin=$6, priority=$7
      WHERE id=$8
      RETURNING *
    `, [title, status, assignee, unidad_residencial, hora_inicio, hora_fin, priority, id]);

    updated.subtasks = await queryAll(
      'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY created_at ASC', [id]
    );
    res.json(updated);
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── DELETE /tasks/:id  (also removes its subtasks) ────────────── */
app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await queryOne('SELECT id FROM tasks WHERE id = $1', [id]);
    if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });
    await pool.query('DELETE FROM subtasks WHERE task_id = $1', [id]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── POST /tasks/:id/subtasks ───────────────────────────────────── */
app.post('/tasks/:id/subtasks', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const task   = await queryOne('SELECT id FROM tasks WHERE id = $1', [taskId]);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
    const subtask = await queryOne(
      'INSERT INTO subtasks (task_id, title) VALUES ($1, $2) RETURNING *',
      [taskId, title.trim()]
    );
    res.status(201).json(subtask);
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── PUT /subtasks/:id ──────────────────────────────────────────── */
app.put('/subtasks/:id', async (req, res) => {
  try {
    const id  = Number(req.params.id);
    const sub = await queryOne('SELECT * FROM subtasks WHERE id = $1', [id]);
    if (!sub) return res.status(404).json({ error: 'Subtarea no encontrada' });
    const completed = req.body.completed !== undefined ? Number(req.body.completed) : sub.completed;
    const title     = req.body.title     !== undefined ? req.body.title             : sub.title;
    const updated   = await queryOne(
      'UPDATE subtasks SET completed=$1, title=$2 WHERE id=$3 RETURNING *',
      [completed, title, id]
    );
    res.json(updated);
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── DELETE /subtasks/:id ───────────────────────────────────────── */
app.delete('/subtasks/:id', async (req, res) => {
  try {
    const id  = Number(req.params.id);
    const sub = await queryOne('SELECT id FROM subtasks WHERE id = $1', [id]);
    if (!sub) return res.status(404).json({ error: 'Subtarea no encontrada' });
    await pool.query('DELETE FROM subtasks WHERE id = $1', [id]);
    res.json({ success: true });
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── GET /unidades — tasks grouped by unidad_residencial ───────── */
app.get('/unidades', async (req, res) => {
  try {
    const rows    = await queryAll(`SELECT * FROM tasks WHERE unidad_residencial != '' ORDER BY unidad_residencial ASC, created_at ASC`);
    const allSubs = await queryAll('SELECT * FROM subtasks ORDER BY created_at ASC');
    const subMap  = {};
    for (const s of allSubs) {
      if (!subMap[s.task_id]) subMap[s.task_id] = [];
      subMap[s.task_id].push(s);
    }
    rows.forEach(t => { t.subtasks = subMap[t.id] || []; });
    const grouped = {};
    for (const t of rows) {
      if (!grouped[t.unidad_residencial]) grouped[t.unidad_residencial] = [];
      grouped[t.unidad_residencial].push(t);
    }
    res.json(Object.entries(grouped).map(([unidad, tasks]) => ({ unidad, tasks })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── GET /asignaciones ──────────────────────────────────────────── */
app.get('/asignaciones', async (req, res) => {
  try {
    const rows    = await queryAll(`SELECT * FROM tasks WHERE assignee != '' ORDER BY assignee ASC, created_at ASC`);
    const allSubs = await queryAll('SELECT * FROM subtasks ORDER BY created_at ASC');
    const subMap  = {};
    for (const s of allSubs) {
      if (!subMap[s.task_id]) subMap[s.task_id] = [];
      subMap[s.task_id].push(s);
    }
    rows.forEach(t => { t.subtasks = subMap[t.id] || []; });
    const grouped = {};
    for (const t of rows) {
      if (!grouped[t.assignee]) grouped[t.assignee] = [];
      grouped[t.assignee].push(t);
    }
    res.json(Object.entries(grouped).map(([assignee, tasks]) => ({ assignee, tasks })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── GET /informes ──────────────────────────────────────────────── */
app.get('/informes', async (req, res) => {
  try {
    res.json(await queryAll('SELECT * FROM informes ORDER BY created_at DESC'));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── POST /informes ─────────────────────────────────────────────── */
app.post('/informes', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Título requerido' });
    const info = await queryOne(
      'INSERT INTO informes (title, completed) VALUES ($1, 1) RETURNING *',
      [title.trim()]
    );
    res.json(info);
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── PATCH /informes/:id/toggle ─────────────────────────────────── */
app.patch('/informes/:id/toggle', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM informes WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    await pool.query(
      'UPDATE informes SET completed = $1 WHERE id = $2',
      [row.completed ? 0 : 1, req.params.id]
    );
    res.json({ success: true });
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── DELETE /informes/:id ───────────────────────────────────────── */
app.delete('/informes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM informes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── POST /admin/seed ───────────────────────────────────────────── */
app.post('/admin/seed', async (req, res) => {
  try {
    const { key } = req.body;
    if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Clave incorrecta' });

    const wbU  = XLSX.readFile(path.join(__dirname, 'unidades', 'LISTA UNIDADES PH..xlsx'));
    const rowsU = XLSX.utils.sheet_to_json(wbU.Sheets[wbU.SheetNames[0]], { header: 1 });
    const unidades = rowsU.slice(1).map(r => (r[2] || '').trim()).filter(Boolean);

    const wbT  = XLSX.readFile(path.join(__dirname, 'unidades', 'TAREAS.xlsx'));
    const rowsT = XLSX.utils.sheet_to_json(wbT.Sheets[wbT.SheetNames[0]], { header: 1 });
    const tareas = [];
    let currentTask = null;
    for (const row of rowsT) {
      const taskName = (row[0] || '').trim();
      const subName  = (row[1] || '').trim();
      if (taskName) { currentTask = { title: taskName, subtasks: [] }; tareas.push(currentTask); }
      if (subName && currentTask) currentTask.subtasks.push(subName);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let totalTareas = 0, totalSubs = 0;
      for (const unidad of unidades) {
        for (const tarea of tareas) {
          const { rows } = await client.query(
            `INSERT INTO tasks (title, status, assignee, unidad_residencial, priority)
             VALUES ($1, 'todo', '', $2, 0) RETURNING id`,
            [tarea.title, unidad]
          );
          totalTareas++;
          for (const sub of tarea.subtasks) {
            await client.query(
              `INSERT INTO subtasks (task_id, title, completed) VALUES ($1, $2, 0)`,
              [rows[0].id, sub]
            );
            totalSubs++;
          }
        }
      }
      await client.query('COMMIT');
      res.json({ success: true, unidades: unidades.length, tareas: totalTareas, subtareas: totalSubs });
      io.emit('refresh');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── POST /admin/reset ──────────────────────────────────────────── */
const ADMIN_KEY = process.env.ADMIN_KEY || "ph-admin-8475*/-";

app.post('/admin/reset', async (req, res) => {
  try {
    const { key } = req.body;
    if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Clave incorrecta' });
    await pool.query(`
      UPDATE tasks
      SET status = 'todo', assignee = '', priority = 0,
          hora_inicio = NULL, hora_fin = NULL
    `);
    await pool.query(`UPDATE subtasks SET completed = 0`);
    res.json({ success: true });
    io.emit('refresh');
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ── Start ──────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
initSchema()
  .then(() => httpServer.listen(PORT, () => console.log(`Servidor Kanban corriendo en puerto ${PORT}`)))
  .catch(err => { console.error('Error initializing schema:', err); process.exit(1); });
