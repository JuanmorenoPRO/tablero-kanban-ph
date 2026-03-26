const COLUMNS = ['todo', 'inprogress', 'done'];

function loadTasks() {
  try {
    return JSON.parse(sessionStorage.getItem('kanban-tasks')) || [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  sessionStorage.setItem('kanban-tasks', JSON.stringify(tasks));
}

function formatAge(timestamp) {
  const now = Date.now();
  const created = Number(timestamp);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1)  return 'Added just now';
  if (diffMins < 60) return `Added ${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const createdDate = new Date(created);
  const nowDate = new Date(now);
  const sameDay =
    createdDate.getFullYear() === nowDate.getFullYear() &&
    createdDate.getMonth()    === nowDate.getMonth() &&
    createdDate.getDate()     === nowDate.getDate();

  if (sameDay) {
    const h = createdDate.getHours();
    const m = String(createdDate.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `Added at ${hour}:${m} ${ampm}`;
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `Added ${months[createdDate.getMonth()]} ${createdDate.getDate()}`;
}

function createCardElement(task) {
  const col = task.col;

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = task.id;

  const textBlock = document.createElement('div');
  textBlock.className = 'card-text-block';

  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = task.text;

  const timestamp = document.createElement('span');
  timestamp.className = 'card-timestamp';
  timestamp.textContent = formatAge(task.id);

  textBlock.appendChild(text);
  textBlock.appendChild(timestamp);

  const btnLeft = document.createElement('button');
  btnLeft.className = 'card-btn btn-left' + (col === 'todo' ? ' btn-hidden' : '');
  btnLeft.title = 'Move left';
  btnLeft.innerHTML = '&#8592;';
  btnLeft.addEventListener('click', () => moveTask(task.id, -1));

  const btnRight = document.createElement('button');
  btnRight.className = 'card-btn btn-right' + (col === 'done' ? ' btn-hidden' : '');
  btnRight.title = 'Move right';
  btnRight.innerHTML = '&#8594;';
  btnRight.addEventListener('click', () => moveTask(task.id, 1));

  const btnDelete = document.createElement('button');
  btnDelete.className = 'card-btn btn-delete';
  btnDelete.title = 'Delete task';
  btnDelete.textContent = '\u00D7';
  btnDelete.addEventListener('click', () => deleteTask(task.id));

  card.appendChild(btnLeft);
  card.appendChild(textBlock);
  card.appendChild(btnRight);
  card.appendChild(btnDelete);

  return card;
}

function getSearchQuery() {
  return document.getElementById('search-input').value.trim().toLowerCase();
}

function renderAll() {
  const tasks = loadTasks();
  const query = getSearchQuery();

  COLUMNS.forEach(col => {
    const container = document.querySelector(`.cards[data-col="${col}"]`);
    container.innerHTML = '';
    const visible = tasks
      .filter(t => t.col === col)
      .filter(t => !query || t.text.toLowerCase().includes(query));

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No tasks yet';
      container.appendChild(empty);
    } else {
      visible.forEach(t => container.appendChild(createCardElement(t)));
    }
  });
}

function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  const tasks = loadTasks();
  tasks.push({ id: Date.now().toString(), text, col: 'todo' });
  saveTasks(tasks);
  renderAll();

  input.value = '';
  input.focus();
}

function moveTask(id, direction) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const idx = COLUMNS.indexOf(task.col);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= COLUMNS.length) return;

  task.col = COLUMNS[newIdx];
  saveTasks(tasks);
  renderAll();
}

function deleteTask(id) {
  const tasks = loadTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  renderAll();
}

document.getElementById('add-btn').addEventListener('click', addTask);

document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

document.getElementById('search-input').addEventListener('input', renderAll);

renderAll();
