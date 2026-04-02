const XLSX   = require('xlsx');
const { Pool } = require('pg');
const pg = require('pg');

pg.types.setTypeParser(20, val => parseInt(val, 10));

const isLocal = (process.env.DATABASE_URL || '').includes('localhost');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

/* ── Leer unidades ── */
const wbU  = XLSX.readFile('./unidades/LISTA UNIDADES PH..xlsx');
const wsU  = wbU.Sheets[wbU.SheetNames[0]];
const rowsU = XLSX.utils.sheet_to_json(wsU, { header: 1 });

const unidades = rowsU
  .slice(1)                        // saltar encabezado
  .map(r => (r[2] || '').trim())   // columna NOMBRE
  .filter(Boolean);

/* ── Leer tareas y subtareas ── */
const wbT  = XLSX.readFile('./unidades/TAREAS.xlsx');
const wsT  = wbT.Sheets[wbT.SheetNames[0]];
const rowsT = XLSX.utils.sheet_to_json(wsT, { header: 1 });

const tareas = [];
let currentTask = null;
for (const row of rowsT) {
  const taskName = (row[0] || '').trim();
  const subName  = (row[1] || '').trim();
  if (taskName) {
    currentTask = { title: taskName, subtasks: [] };
    tareas.push(currentTask);
  }
  if (subName && currentTask) {
    currentTask.subtasks.push(subName);
  }
}

/* ── Insertar en BD ── */
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalTareas = 0;
    let totalSubs   = 0;

    for (const unidad of unidades) {
      for (const tarea of tareas) {
        const { rows } = await client.query(
          `INSERT INTO tasks (title, status, assignee, unidad_residencial, priority)
           VALUES ($1, 'todo', '', $2, 0) RETURNING id`,
          [tarea.title, unidad]
        );
        const taskId = rows[0].id;
        totalTareas++;

        for (const sub of tarea.subtasks) {
          await client.query(
            `INSERT INTO subtasks (task_id, title, completed) VALUES ($1, $2, 0)`,
            [taskId, sub]
          );
          totalSubs++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✓ ${unidades.length} unidades`);
    console.log(`✓ ${totalTareas} tareas creadas`);
    console.log(`✓ ${totalSubs} subtareas creadas`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error en seed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
