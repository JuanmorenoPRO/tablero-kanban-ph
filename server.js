const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new Database('kanban.db');

/* ── Schema ────────────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    title              TEXT    NOT NULL,
    status             TEXT    NOT NULL DEFAULT 'todo',
    assignee           TEXT    NOT NULL DEFAULT '',
    unidad_residencial TEXT    NOT NULL DEFAULT '',
    hora_inicio        INTEGER DEFAULT NULL,
    hora_fin           INTEGER DEFAULT NULL,
    created_at         INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  );
  CREATE TABLE IF NOT EXISTS subtasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  );
`);

/* ── Migrations for existing databases ─────────────────────────── */
[
  `ALTER TABLE tasks ADD COLUMN assignee           TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN unidad_residencial TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN hora_inicio        INTEGER DEFAULT NULL`,
  `ALTER TABLE tasks ADD COLUMN hora_fin           INTEGER DEFAULT NULL`,
].forEach(sql => { try { db.exec(sql); } catch (_) {} });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ── GET /tasks  (includes subtasks array per task) ────────────── */
app.get('/tasks', (req, res) => {
  const tasks    = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
  const allSubs  = db.prepare('SELECT * FROM subtasks ORDER BY created_at ASC').all();

  const subMap = {};
  for (const s of allSubs) {
    if (!subMap[s.task_id]) subMap[s.task_id] = [];
    subMap[s.task_id].push(s);
  }
  tasks.forEach(t => { t.subtasks = subMap[t.id] || []; });
  res.json(tasks);
});

/* ── POST /tasks ────────────────────────────────────────────────── */
app.post('/tasks', (req, res) => {
  const { title, status = 'todo', assignee = '', unidad_residencial = '' } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });

  const result = db
    .prepare('INSERT INTO tasks (title, status, assignee, unidad_residencial) VALUES (?, ?, ?, ?)')
    .run(title.trim(), status, assignee.trim(), unidad_residencial.trim());

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  task.subtasks = [];
  res.status(201).json(task);
});

/* ── PUT /tasks/:id ─────────────────────────────────────────────── */
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const ex = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });

  const title              = req.body.title              !== undefined ? req.body.title              : ex.title;
  const status             = req.body.status             !== undefined ? req.body.status             : ex.status;
  const assignee           = req.body.assignee           !== undefined ? req.body.assignee           : ex.assignee;
  const unidad_residencial = req.body.unidad_residencial !== undefined ? req.body.unidad_residencial : ex.unidad_residencial;

  let hora_inicio = ex.hora_inicio;
  let hora_fin    = ex.hora_fin;

  if (status === 'inprogress' && !hora_inicio) hora_inicio = Date.now();
  if (status === 'done')                        hora_fin    = Date.now();
  else if (ex.status === 'done')                hora_fin    = null;

  db.prepare(`
    UPDATE tasks
    SET title=?, status=?, assignee=?, unidad_residencial=?, hora_inicio=?, hora_fin=?
    WHERE id=?
  `).run(title, status, assignee, unidad_residencial, hora_inicio, hora_fin, id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  updated.subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(id);
  res.json(updated);
});

/* ── DELETE /tasks/:id  (also removes its subtasks) ────────────── */
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const ex = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });
  db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

/* ── POST /tasks/:id/subtasks ───────────────────────────────────── */
app.post('/tasks/:id/subtasks', (req, res) => {
  const taskId = Number(req.params.id);
  const task   = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });

  const result  = db.prepare('INSERT INTO subtasks (task_id, title) VALUES (?, ?)').run(taskId, title.trim());
  const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(subtask);
});

/* ── PUT /subtasks/:id ──────────────────────────────────────────── */
app.put('/subtasks/:id', (req, res) => {
  const id  = Number(req.params.id);
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Subtarea no encontrada' });

  const completed = req.body.completed !== undefined ? Number(req.body.completed) : sub.completed;
  const title     = req.body.title     !== undefined ? req.body.title             : sub.title;

  db.prepare('UPDATE subtasks SET completed=?, title=? WHERE id=?').run(completed, title, id);
  res.json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id));
});

/* ── DELETE /subtasks/:id ───────────────────────────────────────── */
app.delete('/subtasks/:id', (req, res) => {
  const id  = Number(req.params.id);
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Subtarea no encontrada' });
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  res.json({ success: true });
});

/* ── GET /asignaciones ──────────────────────────────────────────── */
app.get('/asignaciones', (req, res) => {
  const rows   = db.prepare(`SELECT * FROM tasks WHERE assignee != '' ORDER BY assignee ASC, created_at ASC`).all();
  const allSubs = db.prepare('SELECT * FROM subtasks ORDER BY created_at ASC').all();
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
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor Kanban corriendo en puerto ${PORT}`));
