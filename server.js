const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new Database('kanban.db');

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
  )
`);

[
  `ALTER TABLE tasks ADD COLUMN assignee           TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN unidad_residencial TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN hora_inicio        INTEGER DEFAULT NULL`,
  `ALTER TABLE tasks ADD COLUMN hora_fin           INTEGER DEFAULT NULL`,
].forEach(sql => { try { db.exec(sql); } catch (_) {} });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* GET /tasks */
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
  res.json(tasks);
});

/* POST /tasks  — body: { title, status?, assignee?, unidad_residencial? } */
app.post('/tasks', (req, res) => {
  const { title, status = 'todo', assignee = '', unidad_residencial = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  const result = db
    .prepare('INSERT INTO tasks (title, status, assignee, unidad_residencial) VALUES (?, ?, ?, ?)')
    .run(title.trim(), status, assignee.trim(), unidad_residencial.trim());
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

/* PUT /tasks/:id  — body: { title?, status?, assignee?, unidad_residencial? } */
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
  res.json(updated);
});

/* DELETE /tasks/:id */
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const ex = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

/* GET /asignaciones — tasks grouped by assignee */
app.get('/asignaciones', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM tasks WHERE assignee != '' ORDER BY assignee ASC, created_at ASC
  `).all();
  const grouped = {};
  for (const t of rows) {
    if (!grouped[t.assignee]) grouped[t.assignee] = [];
    grouped[t.assignee].push(t);
  }
  res.json(Object.entries(grouped).map(([assignee, tasks]) => ({ assignee, tasks })));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor Kanban corriendo en puerto ${PORT}`));
