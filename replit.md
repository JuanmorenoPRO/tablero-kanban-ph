# Kanban Residencial

Shared Kanban board for "Contabilidad de Unidades Residenciales PH Financieramente al dia".
Built with Node.js/Express REST API, PostgreSQL database, and a neobrutalist Spanish UI.

## Architecture

- **Frontend**: Vanilla JS + HTML + CSS (neobrutalist design, full Spanish UI)
- **Backend**: Node.js + Express (`server.js`)
- **Database**: PostgreSQL via `pg` (node-postgres) — Replit built-in DB

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express server — REST API + serves static files |
| `index.html` | HTML structure |
| `style.css` | Neobrutalism CSS |
| `script.js` | Frontend logic (fetch-based, no localStorage) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (set automatically by Replit) |

## Database Schema

```sql
CREATE TABLE tasks (
  id                 SERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'todo',   -- 'todo' | 'inprogress' | 'done'
  assignee           TEXT NOT NULL DEFAULT '',
  unidad_residencial TEXT NOT NULL DEFAULT '',
  hora_inicio        BIGINT DEFAULT NULL,
  hora_fin           BIGINT DEFAULT NULL,
  priority           INTEGER NOT NULL DEFAULT 0,
  created_at         BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE subtasks (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  completed  INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);

CREATE TABLE informes (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  completed  INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
);
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | All tasks with their subtasks |
| POST | `/tasks` | Create task |
| PUT | `/tasks/:id` | Update task (status, assignee, priority, etc.) |
| DELETE | `/tasks/:id` | Delete task + its subtasks |
| POST | `/tasks/:id/subtasks` | Add subtask |
| PUT | `/subtasks/:id` | Update subtask |
| DELETE | `/subtasks/:id` | Delete subtask |
| GET | `/asignaciones` | Tasks grouped by assignee |
| GET | `/unidades` | Tasks grouped by unidad residencial |
| GET | `/informes` | All informes |
| POST | `/informes` | Create informe |
| PATCH | `/informes/:id/toggle` | Toggle informe completed |
| DELETE | `/informes/:id` | Delete informe |

## Features

- Shared board (PostgreSQL — all users see the same data)
- Three columns: Pendiente / En Progreso / Completado
- Subtasks with progress bar; blocks moving to Completado until all done
- Priority flag (bright red card, visible badge in asignaciones table)
- Assignee per card with scroll-to-person link
- Hora de inicio / hora de fin auto-tracked per task
- Asignaciones section: tasks grouped by person with filter
- Unidades section: tasks grouped by residential unit with filter
- Informes completados: checklist registry
- Charts: doughnut (overall status) + stacked bar (team workload by person)
- Real-time text search (client-side)

## Running

Workflow: `Start application` → `node server.js` (port 5000)

Schema is created automatically on startup via `initSchema()`.
