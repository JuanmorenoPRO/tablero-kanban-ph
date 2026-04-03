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
  fetchUnidades();
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
    unidad.className   = 'card-unidad card-unidad-link';
    unidad.textContent = '🏢 ' + task.unidad_residencial;
    unidad.title       = `Ver unidad: ${task.unidad_residencial}`;
    unidad.addEventListener('click', e => {
      e.stopPropagation();
      scrollToUnidad(task.unidad_residencial);
    });
    textBlock.appendChild(unidad);
  }

  const assigneeRow = document.createElement('div');
  assigneeRow.className = 'card-assignee-row';
  if (task.assignee) {
    const badge = document.createElement('span');
    badge.className   = 'card-assignee card-assignee-link';
    badge.textContent = '👤 ' + task.assignee;
    badge.title       = `Ver asignaciones de ${task.assignee}`;
    badge.addEventListener('click', e => {
      e.stopPropagation();
      scrollToAssignee(task.assignee);
    });
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
  assignInput.placeholder = 'Nombre... (vacío = quitar asignación)';
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
function showCardWarning(taskId, msg) {
  const card = document.querySelector(`.card[data-id="${taskId}"]`);
  if (!card) return;
  let warn = card.querySelector('.card-warning');
  if (!warn) {
    warn = document.createElement('p');
    warn.className = 'card-warning';
    card.prepend(warn);
  }
  warn.textContent = msg;
  warn.hidden = false;
  clearTimeout(warn._t);
  warn._t = setTimeout(() => { warn.hidden = true; }, 3000);
}

function toggleAssignForm(card) {
  const form = card.querySelector('.assign-form');
  form.hidden = !form.hidden;
  if (!form.hidden) form.querySelector('.assign-input').focus();
}

/* ------------------------------------------------------------------
   Renderizado del tablero
------------------------------------------------------------------ */
const colFilters = { todo: { query: '', priority: false }, inprogress: { query: '', priority: false }, done: { query: '', priority: false } };

function getSearchQuery() {
  return document.getElementById('search-input').value.trim().toLowerCase();
}

function renderBoard() {
  const globalQuery = getSearchQuery();
  COLUMNS.forEach(col => {
    const container = document.querySelector(`.cards[data-col="${col}"]`);
    container.innerHTML = '';
    const { query: colQuery, priority: onlyPriority } = colFilters[col];
    const visible = tasks
      .filter(t => t.status === col)
      .filter(t => !globalQuery ||
        t.title.toLowerCase().includes(globalQuery) ||
        (t.unidad_residencial || '').toLowerCase().includes(globalQuery) ||
        (t.assignee || '').toLowerCase().includes(globalQuery))
      .filter(t => !colQuery ||
        t.title.toLowerCase().includes(colQuery) ||
        (t.unidad_residencial || '').toLowerCase().includes(colQuery) ||
        (t.assignee || '').toLowerCase().includes(colQuery))
      .filter(t => !onlyPriority || t.priority);

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
async function fetchUnidades() {
  try {
    renderUnidades(await apiFetch('/unidades'));
  } catch (e) { console.error('Error cargando unidades', e); }
}

function renderUnidades(data) {
  const container = document.getElementById('unidades-container');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="empty-message">Sin unidades residenciales registradas aún.</p>';
    return;
  }

  data.forEach(({ unidad, tasks: list }) => {
    const bloque = document.createElement('div');
    bloque.className = 'asignacion-bloque';
    bloque.dataset.unidad = unidad;

    const header = document.createElement('div');
    header.className = 'asignacion-header unidad-header';
    header.innerHTML =
      `<span class="asignacion-nombre">🏢 ${escapeHtml(unidad)}</span>` +
      `<span class="asignacion-count">${list.length} tarea${list.length !== 1 ? 's' : ''}</span>`;
    bloque.appendChild(header);

    const tabla = document.createElement('table');
    tabla.className = 'asignacion-tabla';
    tabla.innerHTML = `
      <thead><tr>
        <th>Tarea</th>
        <th>Persona Asignada</th>
        <th>Estado</th>
        <th>Subtareas</th>
      </tr></thead>`;

    const tbody = document.createElement('tbody');
    list.forEach(t => {
      const tr = document.createElement('tr');
      const subtasks  = t.subtasks || [];
      const completed = subtasks.filter(s => s.completed).length;
      const pct       = subtasks.length > 0 ? Math.round((completed / subtasks.length) * 100) : 0;
      const priorityBadge = t.priority ? ' <span class="priority-badge">⚠️ PRIORIDAD</span>' : '';

      const subtasksCell = subtasks.length === 0
        ? '<span class="sin-dato">—</span>'
        : `<div class="unidad-subtask-cell">
             <span class="unidad-subtask-count">${completed}/${subtasks.length}</span>
             <div class="subtasks-progress-bar unidad-progress-bar">
               <div class="subtasks-progress-fill" style="width:${pct}%"></div>
             </div>
           </div>`;

      tr.innerHTML = `
        <td>${escapeHtml(t.title)}${priorityBadge}</td>
        <td>${t.assignee ? `<span class="unidad-assignee">${escapeHtml(t.assignee)}</span>` : '<span class="sin-dato">—</span>'}</td>
        <td><span class="estado-badge estado-${t.status}">${COL_LABEL[t.status] || t.status}</span></td>
        <td>${subtasksCell}</td>`;

      tr.title = 'Ir a la tarea en el tablero';
      tr.addEventListener('click', () => scrollToCard(t.id));
      tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
    bloque.appendChild(tabla);
    container.appendChild(bloque);
  });
}

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
    bloque.dataset.assignee = assignee;

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
function showAddError(msg) {
  const el = document.getElementById('add-task-error');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showAddError._t);
  showAddError._t = setTimeout(() => { el.hidden = true; }, 4000);
}

async function addTask() {
  const taskInput   = document.getElementById('task-input');
  const unidadInput = document.getElementById('unidad-input');
  const title = taskInput.value.trim();
  if (!title) return;
  const unidad_residencial = unidadInput.value.trim();

  if (!unidad_residencial) {
    showAddError('⚠️ Debes indicar la unidad residencial antes de agregar la tarea.');
    unidadInput.focus();
    return;
  }

  const duplicate = tasks.find(t =>
    t.title.toLowerCase() === title.toLowerCase() &&
    t.unidad_residencial.toLowerCase() === unidad_residencial.toLowerCase()
  );
  if (duplicate) {
    showAddError(`⚠️ Ya existe una tarea "${title}" para la unidad "${unidad_residencial}".`);
    return;
  }

  document.getElementById('add-task-error').hidden = true;
  taskInput.value   = '';
  unidadInput.value = '';
  taskInput.focus();
  await apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, status: 'todo', unidad_residencial })
  });
}

async function moveTask(id, direction) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newIdx = COLUMNS.indexOf(task.status) + direction;
  if (newIdx < 0 || newIdx >= COLUMNS.length) return;
  const newStatus = COLUMNS[newIdx];

  // Block move to "inprogress" when task has no assignee
  if (newStatus === 'inprogress' && !task.assignee) {
    const card = document.querySelector(`.card[data-id="${id}"]`);
    if (card) {
      const btn = card.querySelector('.btn-asignar');
      if (btn) {
        toggleAssignForm(card);
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    showCardWarning(id, '⚠️ Asigna la tarea antes de pasarla a En Progreso.');
    return;
  }

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
}

async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

async function assignTask(id, assignee) {
  await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ assignee }) });
}

/* ------------------------------------------------------------------
   Acciones — subtareas
------------------------------------------------------------------ */
function scrollToUnidad(nombre) {
  const block = [...document.querySelectorAll('.asignacion-bloque')]
    .find(el => el.dataset.unidad === nombre);
  if (!block) {
    document.querySelector('.unidades-section').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  block.classList.remove('asignacion-highlight');
  void block.offsetWidth;
  block.classList.add('asignacion-highlight');
  setTimeout(() => block.classList.remove('asignacion-highlight'), 2200);
}

function scrollToAssignee(name) {
  const block = [...document.querySelectorAll('.asignacion-bloque')]
    .find(el => el.dataset.assignee === name);
  if (!block) {
    document.querySelector('.asignaciones-section').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  block.classList.remove('asignacion-highlight');
  void block.offsetWidth;
  block.classList.add('asignacion-highlight');
  setTimeout(() => block.classList.remove('asignacion-highlight'), 2200);
}

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
}

async function addSubtask(taskId, title) {
  await apiFetch(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

async function toggleSubtask(_taskId, subtaskId, completed) {
  await apiFetch(`/subtasks/${subtaskId}`, {
    method: 'PUT',
    body: JSON.stringify({ completed: completed ? 1 : 0 })
  });
}

async function deleteSubtask(_taskId, subtaskId) {
  await apiFetch(`/subtasks/${subtaskId}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------
   Init
------------------------------------------------------------------ */
document.getElementById('add-btn').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
document.getElementById('search-input').addEventListener('input', renderBoard);

document.querySelectorAll('.col-search').forEach(input => {
  input.addEventListener('input', () => {
    colFilters[input.dataset.col].query = input.value.trim().toLowerCase();
    renderBoard();
  });
});

document.querySelectorAll('.col-priority-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const col = btn.dataset.col;
    colFilters[col].priority = !colFilters[col].priority;
    btn.classList.toggle('col-priority-btn-active', colFilters[col].priority);
    renderBoard();
  });
});

/* --- section filters (client-side, no re-fetch needed) --- */
function applyFilter(inputId, container, attrName) {
  const q = document.getElementById(inputId).value.trim().toLowerCase();
  let anyVisible = false;
  container.querySelectorAll('.asignacion-bloque').forEach(bloque => {
    const val = (bloque.dataset[attrName] || '').toLowerCase();
    const show = !q || val.includes(q);
    bloque.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });
  let noResultMsg = container.querySelector('.filter-empty');
  if (!anyVisible && q) {
    if (!noResultMsg) {
      noResultMsg = document.createElement('p');
      noResultMsg.className = 'empty-message filter-empty';
      container.appendChild(noResultMsg);
    }
    noResultMsg.textContent = 'Sin resultados para "' + document.getElementById(inputId).value.trim() + '".';
    noResultMsg.style.display = '';
  } else if (noResultMsg) {
    noResultMsg.style.display = 'none';
  }
}

/* ------------------------------------------------------------------
   Gráficas — modales
------------------------------------------------------------------ */
let _teamChart   = null;
let _statusChart = null;

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

function openStatusChart() {
  const counts = { todo: 0, inprogress: 0, done: 0 };
  tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const total = tasks.length;

  if (_statusChart) { _statusChart.destroy(); _statusChart = null; }

  const modal = document.getElementById('modal-status');
  modal.hidden = false;

  const ctx = document.getElementById('chart-status').getContext('2d');
  _statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `Pendiente (${counts.todo})`,
        `En Progreso (${counts.inprogress})`,
        `Completado (${counts.done})`
      ],
      datasets: [{
        data: [counts.todo, counts.inprogress, counts.done],
        backgroundColor: ['#FFE600', '#3D5AFE', '#00E676'],
        borderColor: '#0a0a0a',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { weight: '700', size: 13 }, padding: 18 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
              return `  ${ctx.label}: ${pct}%`;
            }
          }
        }
      }
    }
  });
}

function openTeamLoadChart() {
  const people = {};
  tasks.forEach(t => {
    if (!t.assignee) return;
    if (!people[t.assignee]) people[t.assignee] = { todo: 0, inprogress: 0, done: 0 };
    if (people[t.assignee][t.status] !== undefined) people[t.assignee][t.status]++;
  });

  const labels = Object.keys(people);
  if (labels.length === 0) { alert('No hay personas asignadas aún.'); return; }

  if (_teamChart) { _teamChart.destroy(); _teamChart = null; }

  const modal = document.getElementById('modal-team-load');
  modal.hidden = false;

  const ctx = document.getElementById('chart-team-load').getContext('2d');
  _teamChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pendiente',
          data: labels.map(p => people[p].todo),
          backgroundColor: '#FFE600',
          borderColor: '#0a0a0a',
          borderWidth: 2
        },
        {
          label: 'En Progreso',
          data: labels.map(p => people[p].inprogress),
          backgroundColor: '#3D5AFE',
          borderColor: '#0a0a0a',
          borderWidth: 2
        },
        {
          label: 'Completado',
          data: labels.map(p => people[p].done),
          backgroundColor: '#00E676',
          borderColor: '#0a0a0a',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { stacked: true, ticks: { font: { weight: '700', size: 13 } } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { weight: '700' } } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { weight: '700', size: 13 }, padding: 18 } },
        tooltip: {
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      }
    }
  });
}

/* ------------------------------------------------------------------
   Informes completados
------------------------------------------------------------------ */
async function fetchInformes() {
  try {
    renderInformes(await apiFetch('/informes'));
  } catch (e) { console.error('Error cargando informes', e); }
}

function renderInformes(data) {
  const container = document.getElementById('informes-container');
  container.innerHTML = '';
  const filterQ = document.getElementById('filter-informes')?.value.trim().toLowerCase() || '';
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="empty-message">Sin informes registrados aún.</p>';
    return;
  }
  data.forEach(inf => {
    const item = document.createElement('div');
    item.className = 'informe-item' + (inf.completed ? ' informe-done' : '');

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = !!inf.completed;
    checkbox.className = 'informe-checkbox';
    checkbox.addEventListener('change', async () => {
      await apiFetch(`/informes/${inf.id}/toggle`, { method: 'PATCH' });
    });

    const label = document.createElement('span');
    label.className   = 'informe-title';
    label.textContent = inf.title;

    const meta = document.createElement('span');
    meta.className   = 'informe-meta';
    const d = new Date(inf.created_at);
    meta.textContent = d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });

    const delBtn = document.createElement('button');
    delBtn.className   = 'informe-delete';
    delBtn.textContent = '✕';
    delBtn.title       = 'Eliminar informe';
    delBtn.addEventListener('click', async () => {
      await apiFetch(`/informes/${inf.id}`, { method: 'DELETE' });
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(meta);
    item.appendChild(delBtn);
    if (filterQ && !inf.title.toLowerCase().includes(filterQ)) item.style.display = 'none';
    container.appendChild(item);
  });
}

async function addInforme() {
  const input = document.getElementById('informe-input');
  const title = input.value.trim();
  if (!title) return;
  await apiFetch('/informes', { method: 'POST', body: JSON.stringify({ title }) });
  input.value = '';
}

document.getElementById('filter-asignaciones').addEventListener('input', () => {
  applyFilter('filter-asignaciones', document.getElementById('asignaciones-container'), 'assignee');
});

document.getElementById('filter-unidades').addEventListener('input', () => {
  applyFilter('filter-unidades', document.getElementById('unidades-container'), 'unidad');
});

document.getElementById('filter-informes').addEventListener('input', () => {
  const q = document.getElementById('filter-informes').value.trim().toLowerCase();
  const container = document.getElementById('informes-container');
  let anyVisible = false;
  container.querySelectorAll('.informe-item').forEach(item => {
    const title = item.querySelector('.informe-title')?.textContent.toLowerCase() || '';
    const show = !q || title.includes(q);
    item.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });
  let noResultMsg = container.querySelector('.filter-empty');
  if (!anyVisible && q) {
    if (!noResultMsg) {
      noResultMsg = document.createElement('p');
      noResultMsg.className = 'empty-message filter-empty';
      container.appendChild(noResultMsg);
    }
    noResultMsg.textContent = `Sin resultados para "${document.getElementById('filter-informes').value.trim()}".`;
    noResultMsg.style.display = '';
  } else if (noResultMsg) {
    noResultMsg.style.display = 'none';
  }
});

document.getElementById('informe-add-btn').addEventListener('click', addInforme);
document.getElementById('informe-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addInforme();
});

/* ------------------------------------------------------------------
   Reinicio admin
------------------------------------------------------------------ */
function closeResetModal() {
  document.getElementById('modal-reset').hidden = true;
  document.getElementById('reset-admin-key').value = '';
  document.getElementById('reset-error').hidden = true;
}

document.getElementById('btn-reset-all').addEventListener('click', () => {
  document.getElementById('modal-reset').hidden = false;
  document.getElementById('reset-admin-key').focus();
});

document.getElementById('reset-admin-key').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-reset-confirm').click();
  if (e.key === 'Escape') closeResetModal();
});

document.getElementById('btn-reset-confirm').addEventListener('click', async () => {
  const key = document.getElementById('reset-admin-key').value;
  const errorEl = document.getElementById('reset-error');
  try {
    const res = await fetch('/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    if (res.status === 401) {
      errorEl.hidden = false;
      document.getElementById('reset-admin-key').select();
      return;
    }
    if (!res.ok) throw new Error('Server error');
    closeResetModal();
  } catch (e) {
    errorEl.textContent = 'Error al conectar con el servidor.';
    errorEl.hidden = false;
  }
});

/* ------------------------------------------------------------------
   Eliminar duplicados admin
------------------------------------------------------------------ */
function closeDedupModal() {
  document.getElementById('modal-dedup').hidden = true;
  document.getElementById('dedup-admin-key').value = '';
  document.getElementById('dedup-error').hidden = true;
  document.getElementById('dedup-success').hidden = true;
  document.getElementById('btn-dedup-confirm').disabled = false;
  document.getElementById('btn-dedup-confirm').textContent = 'Eliminar duplicados';
}

document.getElementById('btn-dedup').addEventListener('click', () => {
  document.getElementById('modal-dedup').hidden = false;
  document.getElementById('dedup-admin-key').focus();
});

document.getElementById('dedup-admin-key').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-dedup-confirm').click();
  if (e.key === 'Escape') closeDedupModal();
});

document.getElementById('btn-dedup-confirm').addEventListener('click', async () => {
  const key       = document.getElementById('dedup-admin-key').value;
  const errorEl   = document.getElementById('dedup-error');
  const successEl = document.getElementById('dedup-success');
  const confirmBtn = document.getElementById('btn-dedup-confirm');

  errorEl.hidden = true;
  successEl.hidden = true;
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Eliminando...';

  try {
    const res  = await fetch('/admin/dedup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (res.status === 401) {
      errorEl.textContent = 'Clave incorrecta. Intenta de nuevo.';
      errorEl.hidden = false;
      document.getElementById('dedup-admin-key').select();
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Eliminar duplicados';
      return;
    }
    if (!res.ok) throw new Error('Server error');
    successEl.textContent = data.deleted > 0
      ? `✓ ${data.deleted} tarea${data.deleted !== 1 ? 's' : ''} duplicada${data.deleted !== 1 ? 's' : ''} eliminada${data.deleted !== 1 ? 's' : ''}.`
      : '✓ No se encontraron duplicados.';
    successEl.hidden = false;
    confirmBtn.textContent = '✓ Listo';
    setTimeout(closeDedupModal, 2500);
  } catch (e) {
    errorEl.textContent = 'Error al conectar con el servidor.';
    errorEl.hidden = false;
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Eliminar duplicados';
  }
});

/* ------------------------------------------------------------------
   Poblar tareas admin
------------------------------------------------------------------ */
function closeSeedModal() {
  document.getElementById('modal-seed').hidden = true;
  document.getElementById('seed-admin-key').value = '';
  document.getElementById('seed-error').hidden = true;
  document.getElementById('seed-success').hidden = true;
  document.getElementById('btn-seed-confirm').disabled = false;
  document.getElementById('btn-seed-confirm').textContent = 'Poblar';
}

document.getElementById('btn-seed').addEventListener('click', () => {
  document.getElementById('modal-seed').hidden = false;
  document.getElementById('seed-admin-key').focus();
});

document.getElementById('seed-admin-key').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-seed-confirm').click();
  if (e.key === 'Escape') closeSeedModal();
});

document.getElementById('btn-seed-confirm').addEventListener('click', async () => {
  const key     = document.getElementById('seed-admin-key').value;
  const errorEl   = document.getElementById('seed-error');
  const successEl = document.getElementById('seed-success');
  const confirmBtn = document.getElementById('btn-seed-confirm');

  errorEl.hidden   = true;
  successEl.hidden = true;
  confirmBtn.disabled    = true;
  confirmBtn.textContent = 'Poblando...';

  try {
    const res = await fetch('/admin/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (res.status === 401) {
      errorEl.textContent = 'Clave incorrecta. Intenta de nuevo.';
      errorEl.hidden = false;
      document.getElementById('seed-admin-key').select();
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'Poblar';
      return;
    }
    if (!res.ok) throw new Error('Server error');
    successEl.textContent = `✓ ${data.unidades} unidades · ${data.tareas} tareas · ${data.subtareas} subtareas creadas.`;
    successEl.hidden = false;
    confirmBtn.textContent = '✓ Listo';
    setTimeout(closeSeedModal, 2500);
  } catch (e) {
    errorEl.textContent = 'Error al conectar con el servidor.';
    errorEl.hidden = false;
    confirmBtn.disabled    = false;
    confirmBtn.textContent = 'Poblar';
  }
});

const socket = io();
socket.on('refresh', () => {
  fetchAll();
  fetchInformes();
});

fetchAll();
fetchInformes();
