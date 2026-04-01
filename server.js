const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new Database('kanban.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'todo',
    assignee   TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  )
`);

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN assignee TEXT NOT NULL DEFAULT ''`);
} catch (_) {}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ------------------------------------------------------------------
   GET /tasks  →  return all tasks ordered by creation time
------------------------------------------------------------------ */
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
  res.json(tasks);
});

/* ------------------------------------------------------------------
   POST /tasks  →  create a new task
   Body: { title, status? }
------------------------------------------------------------------ */
app.post('/tasks', (req, res) => {
  const { title, status = 'todo', assignee = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const result = db
    .prepare('INSERT INTO tasks (title, status, assignee) VALUES (?, ?, ?)')
    .run(title.trim(), status, assignee.trim());
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(task);
});

/* ------------------------------------------------------------------
   PUT /tasks/:id  →  update title and/or status
   Body: { title?, status? }
------------------------------------------------------------------ */
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const title    = req.body.title    !== undefined ? req.body.title    : existing.title;
  const status   = req.body.status   !== undefined ? req.body.status   : existing.status;
  const assignee = req.body.assignee !== undefined ? req.body.assignee : existing.assignee;

  db.prepare('UPDATE tasks SET title = ?, status = ?, assignee = ? WHERE id = ?')
    .run(title, status, assignee, id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updated);
});

/* ------------------------------------------------------------------
   DELETE /tasks/:id  →  remove a task
------------------------------------------------------------------ */
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

/* ------------------------------------------------------------------
   Example fetch() calls (for reference):

   // Load all tasks
   const tasks = await fetch('/tasks').then(r => r.json());

   // Create a task
   await fetch('/tasks', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ title: 'My task', status: 'todo' })
   });

   // Update task status
   await fetch('/tasks/1', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ status: 'inprogress' })
   });

   // Delete a task
   await fetch('/tasks/1', { method: 'DELETE' });
------------------------------------------------------------------ */

const PORT = 5000;
app.listen(PORT, () => console.log(`Kanban server running on port ${PORT}`));
