const COLUMNS   = ['todo', 'inprogress', 'done'];
const COL_LABEL = { todo: 'Pendiente', inprogress: 'En Progreso', done: 'Completado' };
let tasks = [];

/* ------------------------------------------------------------------
   API
------------------------------------------------------------------ */
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`Error API ${res.status}`);
  return res.json();
}

async function fetchAll() {
  tasks = await apiFetch('/tasks');
  renderBoard();
  fetchAsignaciones();
}

/* ------------------------------------------------------------------
   Formatos de fecha (español)
------------------------------------------------------------------ */
function formatFecha(ts) {
  if (!ts) return null;
  const d    = new Date(ts);
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hora = h % 12 || 12;
  return `${dd}/${mm} ${hora}:${min} ${ampm}`;
}

function formatAge(ts) {
  const diffMins = Math.floor((Date.now() - ts) / 60000);
  if (diffMins < 1)  return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const d = new Date(ts);
  const n = new Date();
  const h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hora = h % 12 || 12;
  if (d.toDateString() === n.toDateString()) return `Hoy ${hora}:${min} ${ampm}`;
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ------------------------------------------------------------------
   Construcción de tarjeta
------------------------------------------------------------------ */
function createCardElement(task) {
  const col  = task.status;
  const card = document.createElement('div');
  card.className  = 'card' + (task.priority ? ' card-priority' : '');
  card.dataset.id = task.id;

  /* ── Fila principal ── */
  const row = document.createElement('div');
  row.className = 'card-row';

  // Priority toggle button
  const btnPriority = document.createElement('button');
  btnPriority.className = 'card-btn btn-priority' + (task.priority ? ' btn-priority-active' : '');
  btnPriority.title     = task.priority ? 'Quitar prioridad' : 'Marcar como prioritaria';
  btnPriority.textContent = '!';
  btnPriority.addEventListener('click', () => togglePriority(task.id, !task.priority));

  const btnLeft = document.createElement('button');
  btnLeft.className = 'card-btn btn-left' + (col === 'todo' ? ' btn-hidden' : '');
  btnLeft.title = 'Mover a la izquierda';
  btnLeft.innerHTML = '&#8592;';
  btnLeft.addEventListener('click', () => moveTask(task.id, -1));

  const textBlock = document.createElement('div');
  textBlock.className = 'card-text-block';

  const titleEl = document.createElement('span');
  titleEl.className   = 'card-text';
  titleEl.textContent = task.title;
  textBlock.appendChild(titleEl);

  if (task.unidad_residencial) {
    const unidad = document.createElement('span');
    unidad.className   = 'card-unidad';
    unidad.textContent = '🏢 ' + task.unidad_residencial;
    textBlock.appendChild(unidad);
  }

  const assigneeRow = document.createElement('div');
  assigneeRow.className = 'card-assignee-row';
  if (task.assignee) {
    const badge = document.createElement('span');
    badge.className   = 'card-assignee';
    badge.textContent = '👤 ' + task.assignee;
    assigneeRow.appendChild(badge);
  }
  const btnAsignar = document.createElement('button');
  btnAsignar.className   = 'btn-asignar';
  btnAsignar.textContent = task.assignee ? '✏️ Reasignar' : '+ Asignar';
  btnAsignar.addEventListener('click', () => toggleAssignForm(card));
  assigneeRow.appendChild(btnAsignar);
  textBlock.appendChild(assigneeRow);

  if (task.hora_inicio) {
    const el = document.createElement('span');
    el.className   = 'card-time inicio';
    el.textContent = '▶ En progreso: ' + formatFecha(task.hora_inicio);
    textBlock.appendChild(el);
  }
  if (task.hora_fin) {
    const el = document.createElement('span');
    el.className   = 'card-time fin';
    el.textContent = '✓ Completado: ' + formatFecha(task.hora_fin);
    textBlock.appendChild(el);
  }

  const ts = document.createElement('span');
  ts.className   = 'card-timestamp';
  ts.textContent = 'Creada: ' + formatAge(task.created_at);
  textBlock.appendChild(ts);

  const btnRight = document.createElement('button');
  btnRight.className = 'card-btn btn-right' + (col === 'done' ? ' btn-hidden' : '');
  btnRight.title = 'Mover a la derecha';
  btnRight.innerHTML = '&#8594;';
  btnRight.addEventListener('click', () => moveTask(task.id, 1));

  const btnDelete = document.createElement('button');
  btnDelete.className   = 'card-btn btn-delete';
  btnDelete.title       = 'Eliminar tarea';
  btnDelete.textContent = '\u00D7';
  btnDelete.addEventListener('click', () => deleteTask(task.id));

  row.appendChild(btnPriority);
  row.appendChild(btnLeft);
  row.appendChild(textBlock);
  row.appendChild(btnRight);
  row.appendChild(btnDelete);
  card.appendChild(row);

  /* ── Formulario de asignación (oculto) ── */
  const assignForm = document.createElement('div');
  assignForm.className = 'assign-form';
  assignForm.hidden    = true;

  const assignInput = document.createElement('input');
  assignInput.type        = 'text';
  assignInput.className   = 'assign-input';
  assignInput.placeholder = 'Nombre de la persona...';
  assignInput.maxLength   = 60;
  if (task.assignee) assignInput.value = task.assignee;

  const assignConfirm = document.createElement('button');
  assignConfirm.className   = 'assign-confirm';
  assignConfirm.textContent = '✓';
  assignConfirm.title       = 'Guardar';
  assignConfirm.addEventListener('click', async () => {
    assignForm.hidden = true;
    await assignTask(task.id, assignInput.value.trim());
  });

  const assignCancel = document.createElement('button');
  assignCancel.className   = 'assign-cancel';
  assignCancel.textContent = '✕';
  assignCancel.addEventListener('click', () => { assignForm.hidden = true; });

  assignInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  assignConfirm.click();
    if (e.key === 'Escape') assignCancel.click();
  });

  assignForm.appendChild(assignInput);
  assignForm.appendChild(assignConfirm);
  assignForm.appendChild(assignCancel);
  card.appendChild(assignForm);

  /* ── Sección de subtareas ── */
  const subtasks       = task.subtasks || [];
  const isDone         = col === 'done';
  const visibleSubs    = isDone ? subtasks.filter(s => s.completed) : subtasks;
  const completedCount = subtasks.filter(s => s.completed).length;

  // Only render the section if there is something to show
  if (!isDone || visibleSubs.length > 0) {
    const subtasksSection = document.createElement('div');
    subtasksSection.className = 'subtasks-section';

    // Header
    const subtasksHeader = document.createElement('div');
    subtasksHeader.className = 'subtasks-header';

    const subtasksTitle = document.createElement('span');
    subtasksTitle.className = 'subtasks-title';
    subtasksTitle.textContent = subtasks.length > 0
      ? `Subtareas ${completedCount}/${subtasks.length}`
      : 'Subtareas';
    subtasksHeader.appendChild(subtasksTitle);

    if (!isDone) {
      const btnAddSub = document.createElement('button');
      btnAddSub.className   = 'btn-add-subtask';
      btnAddSub.textContent = '+ Subtarea';
      btnAddSub.addEventListener('click', () => {
        const f = subtasksSection.querySelector('.subtask-form');
        f.hidden = !f.hidden;
        if (!f.hidden) f.querySelector('.subtask-input').focus();
      });
      subtasksHeader.appendChild(btnAddSub);
    }

    subtasksSection.appendChild(subtasksHeader);

    // Progress bar (only when not done — done tasks are already 100 %)
    if (!isDone && subtasks.length > 0) {
      const bar = document.createElement('div');
      bar.className = 'subtasks-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'subtasks-progress-fill';
      fill.style.width = Math.round((completedCount / subtasks.length) * 100) + '%';
      bar.appendChild(fill);
      subtasksSection.appendChild(bar);
    }

    // Blocked warning (hidden by default, only needed on non-done cards)
    if (!isDone) {
      const blockedMsg = document.createElement('p');
      blockedMsg.className   = 'subtasks-blocked-msg';
      blockedMsg.hidden      = true;
      blockedMsg.textContent = '⚠️ Completa todas las subtareas antes de marcar como Completado.';
      subtasksSection.appendChild(blockedMsg);
    }

    // List
    if (visibleSubs.length > 0) {
      const list = document.createElement('ul');
      list.className = 'subtasks-list';
      visibleSubs.forEach(sub => {
        const li = document.createElement('li');
        li.className = 'subtask-item' + (sub.completed ? ' subtask-done' : '');

        const chk = document.createElement('input');
        chk.type      = 'checkbox';
        chk.className = 'subtask-checkbox';
        chk.checked   = !!sub.completed;
        chk.disabled  = isDone;
        if (!isDone) chk.addEventListener('change', () => toggleSubtask(task.id, sub.id, chk.checked));

        const lbl = document.createElement('span');
        lbl.className   = 'subtask-label';
        lbl.textContent = sub.title;

        li.appendChild(chk);
        li.appendChild(lbl);

        if (!isDone) {
          const del = document.createElement('button');
          del.className   = 'subtask-delete';
          del.textContent = '×';
          del.title       = 'Eliminar subtarea';
          del.addEventListener('click', () => deleteSubtask(task.id, sub.id));
          li.appendChild(del);
        }

        list.appendChild(li);
      });
      subtasksSection.appendChild(list);
    }

    // Add subtask form (hidden, not shown for done tasks)
    if (!isDone) {
      const subtaskForm = document.createElement('div');
      subtaskForm.className = 'subtask-form';
      subtaskForm.hidden    = true;

      const subtaskInput = document.createElement('input');
      subtaskInput.type        = 'text';
      subtaskInput.className   = 'subtask-input';
      subtaskInput.placeholder = 'Descripción de la subtarea...';
      subtaskInput.maxLength   = 120;

      const subConfirm = document.createElement('button');
      subConfirm.className   = 'assign-confirm';
      subConfirm.textContent = '✓';
      subConfirm.addEventListener('click', async () => {
        const title = subtaskInput.value.trim();
        if (!title) return;
        subtaskForm.hidden = true;
        subtaskInput.value = '';
        await addSubtask(task.id, title);
      });

      const subCancel = document.createElement('button');
      subCancel.className   = 'assign-cancel';
      subCancel.textContent = '✕';
      subCancel.addEventListener('click', () => { subtaskForm.hidden = true; });

      subtaskInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  subConfirm.click();
        if (e.key === 'Escape') subCancel.click();
      });

      subtaskForm.appendChild(subtaskInput);
      subtaskForm.appendChild(subConfirm);
      subtaskForm.appendChild(subCancel);
      subtasksSection.appendChild(subtaskForm);
    }

    card.appendChild(subtasksSection);
  }

  return card;
}

/* ------------------------------------------------------------------
   Toggle formulario de asignación
------------------------------------------------------------------ */
function toggleAssignForm(card) {
  const form = card.querySelector('.assign-form');
  form.hidden = !form.hidden;
  if (!form.hidden) form.querySelector('.assign-input').focus();
}

/* ------------------------------------------------------------------
   Renderizado del tablero
------------------------------------------------------------------ */
function getSearchQuery() {
  return document.getElementById('search-input').value.trim().toLowerCase();
}

function renderBoard() {
  const query = getSearchQuery();
  COLUMNS.forEach(col => {
    const container = document.querySelector(`.cards[data-col="${col}"]`);
    container.innerHTML = '';
    const visible = tasks
      .filter(t => t.status === col)
      .filter(t => !query ||
        t.title.toLowerCase().includes(query) ||
        (t.unidad_residencial || '').toLowerCase().includes(query) ||
        (t.assignee || '').toLowerCase().includes(query));

    if (visible.length === 0) {
      const el = document.createElement('p');
      el.className   = 'empty-message';
      el.textContent = 'Sin tareas';
      container.appendChild(el);
    } else {
      visible.forEach(t => container.appendChild(createCardElement(t)));
    }
  });
}

/* ------------------------------------------------------------------
   Panel de asignaciones
------------------------------------------------------------------ */
async function fetchAsignaciones() {
  try {
    renderAsignaciones(await apiFetch('/asignaciones'));
  } catch (e) { console.error('Error cargando asignaciones', e); }
}

function renderAsignaciones(data) {
  const container = document.getElementById('asignaciones-container');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="empty-message">Sin asignaciones aún.</p>';
    return;
  }

  data.forEach(({ assignee, tasks: list }) => {
    const bloque = document.createElement('div');
    bloque.className = 'asignacion-bloque';

    const header = document.createElement('div');
    header.className = 'asignacion-header';
    header.innerHTML =
      `<span class="asignacion-nombre">👤 ${escapeHtml(assignee)}</span>` +
      `<span class="asignacion-count">${list.length} tarea${list.length !== 1 ? 's' : ''}</span>`;
    bloque.appendChild(header);

    const tabla = document.createElement('table');
    tabla.className = 'asignacion-tabla';
    tabla.innerHTML = `
      <thead><tr>
        <th>Tarea</th>
        <th>Unidad Residencial</th>
        <th>Estado</th>
        <th>Inicio en Progreso</th>
        <th>Fecha Completado</th>
      </tr></thead>`;
    const tbody = document.createElement('tbody');
    list.forEach(t => {
      const tr = document.createElement('tr');
      const priorityBadge = t.priority
        ? ' <span class="priority-badge">⚠️ PRIORIDAD</span>'
        : '';
      tr.innerHTML = `
        <td>${escapeHtml(t.title)}${priorityBadge}</td>
        <td>${t.unidad_residencial ? escapeHtml(t.unidad_residencial) : '<span class="sin-dato">—</span>'}</td>
        <td><span class="estado-badge estado-${t.status}">${COL_LABEL[t.status] || t.status}</span></td>
        <td>${t.hora_inicio ? formatFecha(t.hora_inicio) : '<span class="sin-dato">—</span>'}</td>
        <td>${t.hora_fin    ? formatFecha(t.hora_fin)    : '<span class="sin-dato">—</span>'}</td>`;
      tr.title = 'Ir a la tarea en el tablero';
      tr.addEventListener('click', () => scrollToCard(t.id));
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    bloque.appendChild(tabla);
    container.appendChild(bloque);
  });
}

/* ------------------------------------------------------------------
   Acciones — tareas
------------------------------------------------------------------ */
async function addTask() {
  const taskInput   = document.getElementById('task-input');
  const unidadInput = document.getElementById('unidad-input');
  const title = taskInput.value.trim();
  if (!title) return;
  const unidad_residencial = unidadInput.value.trim();
  taskInput.value   = '';
  unidadInput.value = '';
  taskInput.focus();
  await apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, status: 'todo', unidad_residencial })
  });
  await fetchAll();
}

async function moveTask(id, direction) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newIdx = COLUMNS.indexOf(task.status) + direction;
  if (newIdx < 0 || newIdx >= COLUMNS.length) return;
  const newStatus = COLUMNS[newIdx];

  // Block move to "done" when there are incomplete subtasks
  if (newStatus === 'done' && task.subtasks && task.subtasks.length > 0) {
    const incomplete = task.subtasks.filter(s => !s.completed);
    if (incomplete.length > 0) {
      const card = document.querySelector(`.card[data-id="${id}"]`);
      if (card) {
        const section = card.querySelector('.subtasks-section');
        const msg     = section && section.querySelector('.subtasks-blocked-msg');
        if (section) section.classList.add('subtasks-blocked');
        if (msg)     msg.hidden = false;
        setTimeout(() => {
          if (section) section.classList.remove('subtasks-blocked');
          if (msg)     msg.hidden = true;
        }, 2500);
      }
      return;
    }
  }

  await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
  await fetchAll();
}

async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  await fetchAll();
}

async function assignTask(id, assignee) {
  await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ assignee }) });
  await fetchAll();
}

/* ------------------------------------------------------------------
   Acciones — subtareas
------------------------------------------------------------------ */
function scrollToCard(taskId) {
  const card = document.querySelector(`.card[data-id="${taskId}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('card-highlight');
  void card.offsetWidth; // force reflow so animation restarts if triggered twice
  card.classList.add('card-highlight');
  setTimeout(() => card.classList.remove('card-highlight'), 2200);
}

async function togglePriority(id, priority) {
  await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ priority: priority ? 1 : 0 }) });
  const task = tasks.find(t => t.id === id);
  if (task) task.priority = priority ? 1 : 0;
  renderBoard();
  fetchAsignaciones();
}

async function addSubtask(taskId, title) {
  await apiFetch(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title })
  });
  await fetchAll();
}

async function toggleSubtask(taskId, subtaskId, completed) {
  await apiFetch(`/subtasks/${subtaskId}`, {
    method: 'PUT',
    body: JSON.stringify({ completed: completed ? 1 : 0 })
  });
  // Local update — no need to reload from server
  const task = tasks.find(t => t.id === taskId);
  if (task && task.subtasks) {
    const sub = task.subtasks.find(s => s.id === subtaskId);
    if (sub) sub.completed = completed ? 1 : 0;
  }
  renderBoard();
  fetchAsignaciones();
}

async function deleteSubtask(taskId, subtaskId) {
  await apiFetch(`/subtasks/${subtaskId}`, { method: 'DELETE' });
  const task = tasks.find(t => t.id === taskId);
  if (task && task.subtasks) {
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  }
  renderBoard();
  fetchAsignaciones();
}

/* ------------------------------------------------------------------
   Init
------------------------------------------------------------------ */
document.getElementById('add-btn').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
document.getElementById('search-input').addEventListener('input', renderBoard);

fetchAll();
