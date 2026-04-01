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
  card.className  = 'card';
  card.dataset.id = task.id;

  /* ---- Fila principal ---- */
  const row = document.createElement('div');
  row.className = 'card-row';

  const btnLeft = document.createElement('button');
  btnLeft.className = 'card-btn btn-left' + (col === 'todo' ? ' btn-hidden' : '');
  btnLeft.title = 'Mover a la izquierda';
  btnLeft.innerHTML = '&#8592;';
  btnLeft.addEventListener('click', () => moveTask(task.id, -1));

  /* bloque de texto */
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

  /* fila del asignado + botón */
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

  row.appendChild(btnLeft);
  row.appendChild(textBlock);
  row.appendChild(btnRight);
  row.appendChild(btnDelete);
  card.appendChild(row);

  /* ---- Formulario de asignación (oculto) ---- */
  const form = document.createElement('div');
  form.className = 'assign-form';
  form.hidden    = true;

  const assignInput = document.createElement('input');
  assignInput.type        = 'text';
  assignInput.className   = 'assign-input';
  assignInput.placeholder = 'Nombre de la persona...';
  assignInput.maxLength   = 60;
  if (task.assignee) assignInput.value = task.assignee;

  const confirmBtn = document.createElement('button');
  confirmBtn.className   = 'assign-confirm';
  confirmBtn.textContent = '✓';
  confirmBtn.title       = 'Guardar';
  confirmBtn.addEventListener('click', async () => {
    form.hidden = true;
    await assignTask(task.id, assignInput.value.trim());
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'assign-cancel';
  cancelBtn.textContent = '✕';
  cancelBtn.title       = 'Cancelar';
  cancelBtn.addEventListener('click', () => { form.hidden = true; });

  assignInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  form.appendChild(assignInput);
  form.appendChild(confirmBtn);
  form.appendChild(cancelBtn);
  card.appendChild(form);

  return card;
}

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
    const data = await apiFetch('/asignaciones');
    renderAsignaciones(data);
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
      tr.innerHTML = `
        <td>${escapeHtml(t.title)}</td>
        <td>${t.unidad_residencial ? escapeHtml(t.unidad_residencial) : '<span class="sin-dato">—</span>'}</td>
        <td><span class="estado-badge estado-${t.status}">${COL_LABEL[t.status] || t.status}</span></td>
        <td>${t.hora_inicio ? formatFecha(t.hora_inicio) : '<span class="sin-dato">—</span>'}</td>
        <td>${t.hora_fin    ? formatFecha(t.hora_fin)    : '<span class="sin-dato">—</span>'}</td>`;
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    bloque.appendChild(tabla);
    container.appendChild(bloque);
  });
}

/* ------------------------------------------------------------------
   Acciones
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
  await apiFetch(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: COLUMNS[newIdx] })
  });
  await fetchAll();
}

async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  await fetchAll();
}

async function assignTask(id, assignee) {
  await apiFetch(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ assignee })
  });
  await fetchAll();
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
