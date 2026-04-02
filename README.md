# Kanban Residencial PH

Tablero Kanban para gestión contable de unidades residenciales. Permite crear, asignar y mover tareas por estado, con subtareas, prioridades, informes y actualizaciones en tiempo real via Socket.io.

---

## Tecnologías

- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Tiempo real:** Socket.io
- **Frontend:** HTML + CSS + JavaScript vanilla
- **Gráficas:** Chart.js

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [PostgreSQL](https://www.postgresql.org/) v14 o superior

---

## Instalación local

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd tablero_ph
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear la base de datos

```bash
createdb tablero_ph
```

> Si tu usuario de PostgreSQL es diferente al del sistema, usa:
> ```bash
> createdb -U <tu_usuario> tablero_ph
> ```

### 4. Iniciar el servidor

```bash
DATABASE_URL="postgresql://<usuario>@localhost/tablero_ph" PORT=3000 node server.js
```

Reemplaza `<usuario>` con tu usuario del sistema (en macOS suele ser el mismo que el de tu sesión).

El servidor quedará disponible en **http://localhost:3000**

> **Nota:** El puerto 5000 está ocupado por AirPlay en macOS. Se recomienda usar el puerto 3000.

---

## Pre-poblar la base de datos

Hay dos formas de poblar la BD con las unidades y tareas del proyecto:

### Opción A — Script de terminal

```bash
DATABASE_URL="postgresql://<usuario>@localhost/tablero_ph" node seed.js
```

Esto crea automáticamente todas las tareas y subtareas para cada unidad residencial definida en los archivos Excel de la carpeta `unidades/`.

### Opción B — Botón en la app

En la parte inferior de la aplicación hay un botón **📥 Poblar tareas**. Al hacer clic se solicita la clave de administrador y el servidor ejecuta el proceso de seed internamente.

---

## Estructura de archivos Excel (`/unidades`)

| Archivo | Descripción |
|---|---|
| `LISTA UNIDADES PH..xlsx` | Lista de unidades residenciales. La columna **NOMBRE** (col C) contiene los nombres. |
| `TAREAS.xlsx` | Tareas y subtareas. Columna A = nombre de la tarea, columna B = subtareas. |

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://user@localhost/tablero_ph` |
| `PORT` | Puerto del servidor (por defecto `5000`) | `3000` |
| `ADMIN_KEY` | Clave de administrador (por defecto interna) | `mi-clave-segura` |

---

## Despliegue en Railway

### 1. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea un nuevo proyecto
2. Agrega un plugin de **PostgreSQL**
3. Conecta tu repositorio de GitHub

### 2. Configurar variables de entorno en Railway

En el panel de Railway → tu servicio → **Variables**, agrega:

```
DATABASE_URL  →  (Railway lo inyecta automáticamente desde el plugin de PostgreSQL)
ADMIN_KEY     →  tu-clave-segura
```

> Railway inyecta `PORT` automáticamente — no es necesario configurarlo.

### 3. Desplegar

Railway desplegará automáticamente al hacer push a la rama principal. El servidor usará SSL automáticamente gracias a la detección de entorno incluida en el código.

### 4. Poblar la base de datos en Railway

Una vez desplegado, usa el botón **📥 Poblar tareas** en la app o ejecuta el seed desde la terminal de Railway:

```bash
node seed.js
```

---

## Funcionalidades principales

- **Tablero Kanban** con columnas: Pendiente · En Progreso · Completado
- **Subtareas** con barra de progreso — no se puede completar una tarea sin terminar sus subtareas
- **Asignación** de personas a tareas — no se puede pasar a "En Progreso" sin asignar
- **Unidades residenciales** — vista agrupada por unidad
- **Prioridad** — marcado visual de tareas prioritarias
- **Búsqueda** en tiempo real en el tablero
- **Gráficas** — resumen general (doughnut) y carga del equipo (stacked bar)
- **Informes completados** — registro de informes con filtro de búsqueda
- **Tiempo real** — todos los cambios se reflejan instantáneamente en todos los clientes conectados (Socket.io)
- **Validaciones:** no se pueden agregar tareas sin unidad residencial, ni tareas duplicadas (mismo nombre + misma unidad)

---

## Administración

En la parte inferior de la app hay dos botones de administración protegidos por clave:

| Botón | Acción |
|---|---|
| ⚠️ **Reiniciar todas las tareas** | Mueve todas las tareas a Pendiente, quita asignaciones, prioridades y marca todas las subtareas como no completadas |
| 📥 **Poblar tareas** | Crea todas las tareas y subtareas para cada unidad residencial según los archivos Excel |

La clave de administrador se configura con la variable de entorno `ADMIN_KEY`.
