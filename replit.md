# Kanban Board Task Manager

A vanilla JS Kanban board with neobrutalist design.

## Files
- `index.html` — HTML structure
- `style.css` — Neobrutalism CSS (bold colors, thick borders, hard shadows)
- `script.js` — Task logic with localStorage persistence

## Features
- Three columns: To Do, In Progress, Done
- Add tasks via input field (Enter or button)
- Move cards left/right between columns
- Delete cards
- localStorage persistence across page refreshes
- Responsive (stacks on mobile)

## Running
Served by Python's built-in HTTP server on port 5000.
Workflow: `Start application` → `python3 -m http.server 5000`
