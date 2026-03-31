# Kanban Board Task Manager

A shared Kanban board backed by a Node.js/Express REST API and SQLite database.

## Architecture

- **Frontend**: Vanilla JS + HTML + CSS (neobrutalist design)
- **Backend**: Node.js + Express (`server.js`)
- **Database**: SQLite via `better-sqlite3` (`kanban.db`)

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express server — REST API + serves static files |
| `index.html` | HTML structure |
| `style.css` | Neobrutalism CSS |
| `script.js` | Frontend logic (fetch-based, no localStorage/sessionStorage) |
| `kanban.db` | SQLite database (auto-created on first run) |

## Database Schema

```sql
CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'todo',  -- 'todo' | 'inprogress' | 'done'
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
)
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | Return all tasks |
| POST | `/tasks` | Create task — body: `{ title, status? }` |
| PUT | `/tasks/:id` | Update task — body: `{ title?, status? }` |
| DELETE | `/tasks/:id` | Delete task |

## Running

Workflow: `Start application` → `node server.js` (port 5000)

The Express server serves both the static frontend files and the `/tasks` API from the same origin, so no cross-origin issues.

## Features

- Shared board: all users see the same tasks (SQLite persistence)
- Three columns: To Do / In Progress / Done
- Move cards left/right with arrow buttons
- Delete cards
- Real-time text search (client-side filter)
- "No tasks yet" empty state per column
- "Added X minutes ago" / "Added at H:MM AM/PM" / "Added Mon DD" timestamps
