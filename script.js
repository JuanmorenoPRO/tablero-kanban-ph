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

function createCardElement(task) {
  const col = task.col;

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = task.id;

  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = task.text;

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
  card.appendChild(text);
  card.appendChild(btnRight);
  card.appendChild(btnDelete);

  return card;
}

function renderAll() {
  const tasks = loadTasks();

  COLUMNS.forEach(col => {
    const container = document.querySelector(`.cards[data-col="${col}"]`);
    container.innerHTML = '';
    tasks
      .filter(t => t.col === col)
      .forEach(t => container.appendChild(createCardElement(t)));
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

renderAll();
