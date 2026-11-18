# 🎮 Proyecto 1 · Backend — API de usuarios y videojuegos

API REST hecha con **Node.js, Express y MongoDB Atlas**. Los usuarios se registran con una foto de perfil que se sube a **Cloudinary**, inician sesión con **JWT** y guardan su lista de videojuegos favoritos. Hay dos roles (`user` y `admin`) con permisos distintos.

---

## 📑 Índice

1. [Tecnologías](#-tecnologías)
2. [Requisitos del proyecto y dónde se cumplen](#-requisitos-del-proyecto-y-dónde-se-cumplen)
3. [Puesta en marcha](#-puesta-en-marcha)
4. [Variables de entorno](#-variables-de-entorno)
5. [Crear el primer administrador](#-crear-el-primer-administrador)
6. [Modelos de datos](#-modelos-de-datos)
7. [Autenticación](#-autenticación)
8. [Endpoints](#-endpoints)
9. [Permisos por rol](#-permisos-por-rol)
10. [Ejemplos de uso](#-ejemplos-de-uso)
11. [Errores](#-errores)
12. [Tests](#-tests)
13. [Estructura del proyecto](#-estructura-del-proyecto)
14. [Decisiones técnicas](#-decisiones-técnicas)

---

## 🛠 Tecnologías

| Tecnología | Uso |
|---|---|
| **Express 5** | Servidor y rutas. Los errores de las funciones `async` llegan solos al manejador de errores |
| **MongoDB Atlas + Mongoose 9** | Base de datos y modelos |
| **bcryptjs** | Cifrado de contraseñas |
| **jsonwebtoken** | Tokens de sesión (caducan en 1 día) |
| **Multer 2 + Cloudinary 2** | Subida de la imagen de perfil |
| **node:test + mongodb-memory-server-core** | Tests automáticos con una base de datos en memoria |

---

## ✅ Requisitos del proyecto y dónde se cumplen

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| Servidor con Express | API bajo `/api/v1` | `index.js`, `src/app.js` |
| Base de datos en MongoAtlas | Conexión con Mongoose usando `DB_URL` | `src/config/db.js` |
| Al menos 2 modelos | `User` y `Game` | `src/api/models/` |
| Usuario con array de otra colección | `User.games` guarda ids de `Game` y se devuelve con `populate` | `src/api/models/user.js` |
| Usuarios nuevos siempre con rol `user` | El registro nunca lee `role` del body | `register` en `src/api/controllers/user.js` |
| Primer admin a mano en Atlas | Paso a paso más abajo | [Crear el primer administrador](#-crear-el-primer-administrador) |
| Un admin puede hacer admin a otro usuario | `PATCH /users/:id/role` solo para admins | `src/api/routes/user.js` |
| Un `user` no puede cambiar roles | La ruta de rol exige admin y la edición de perfil rechaza `role` con un 403 | `isAdmin` y `updateUser` |
| Cada uno borra su cuenta, el admin cualquiera | Middleware `isOwnerOrAdmin` | `src/middlewares/auth.js` |
| Campo `image` subido desde el equipo | `multipart/form-data` → Multer → Cloudinary | `src/middlewares/upload.js` |
| Borrar la imagen al borrar el usuario | `cloudinary.uploader.destroy` antes de borrar el documento | `deleteUser` |
| Sin duplicados en el array y sin perder datos | `$addToSet` + `$each`: añade lo nuevo y conserva lo anterior | `addGames` |
| Semilla | `npm run seed` carga 15 videojuegos | `src/seeds/` |
| CRUD completo de todas las colecciones | Crear, leer, editar y borrar usuarios y juegos | [Endpoints](#-endpoints) |
| Middleware de autenticación | `isAuth`, `isAdmin`, `isOwnerOrAdmin` | `src/middlewares/auth.js` |
| `.env` subido | Incluido en el repositorio, como pide el enunciado | `.env` |

**Extras:**

- Si un registro o una edición falla después de subir la imagen (por ejemplo, email repetido), la imagen se borra de Cloudinary para no dejar archivos huérfanos.
- Al cambiar la foto de perfil se borra la antigua de Cloudinary.
- Al borrar un juego, se quita también de las listas de todos los usuarios.
- La contraseña nunca se devuelve en las respuestas.
- Solo se aceptan imágenes JPG, PNG, WEBP, GIF o AVIF de hasta 5 MB. Se comprueba el tipo del archivo y Cloudinary verifica además que sea una imagen de verdad.
- 13 tests automáticos que comprueban los roles, los permisos, los duplicados y el borrado de imágenes.

---

## 🚀 Puesta en marcha

**Requisitos:** Node.js 20.19 o superior. El `.env` del repositorio ya trae las claves de MongoDB Atlas y de Cloudinary del proyecto, así que no hace falta crear cuentas.

```bash
git clone https://github.com/angelmunizpedraza/proyecto1-backend.git
cd proyecto1-backend
npm install
npm run seed   # carga los videojuegos
npm run dev    # arranca en http://localhost:3000 y se reinicia al guardar cambios
```

| Script | Qué hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca el servidor y lo reinicia al guardar (`node --watch`) |
| `npm run seed` | Carga los 15 videojuegos de `src/seeds/games.js` |
| `npm test` | Lanza los tests (no necesita Atlas ni Cloudinary) |

La semilla se puede lanzar las veces que quieras: actualiza cada juego por su título, así que no crea duplicados ni cambia los `_id` de los juegos que ya tienen guardados los usuarios.

---

## 🔐 Variables de entorno

El archivo `.env` está en la raíz y se carga con `process.loadEnvFile()`, que trae Node de serie.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (3000 por defecto) |
| `DB_URL` | Cadena de conexión de MongoDB Atlas |
| `JWT_SECRET` | Clave para firmar los tokens |
| `CLOUDINARY_CLOUD_NAME` | Nombre de la cuenta de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |

> ⚠️ El `.env` se sube al repositorio solo porque lo pide el enunciado para facilitar la corrección. En un proyecto real va en `.gitignore`.

---

## 👑 Crear el primer administrador

Todos los usuarios se registran como `user`. El primer admin se crea a mano:

1. Registra un usuario con `POST /api/v1/users/register`.
2. En MongoDB Atlas entra en **Browse Collections → proyecto1-backend → users**.
3. Edita su documento y cambia `"role": "user"` por `"role": "admin"`.
4. Haz login con ese usuario: a partir de ahí puede convertir en admin a otros con `PATCH /api/v1/users/:id/role`.

---

## 🗂 Modelos de datos

### User (`users`)

| Campo | Tipo | Reglas |
|---|---|---|
| `userName` | String | Obligatorio y único |
| `email` | String | Obligatorio, único, se guarda en minúsculas y se valida el formato |
| `password` | String | Obligatoria, mínimo 8 caracteres, se guarda cifrada con bcrypt y nunca se devuelve |
| `role` | String | `user` o `admin`. Por defecto `user` |
| `image` | String | Obligatoria. URL de la imagen en Cloudinary |
| `imagePublicId` | String | Id de la imagen en Cloudinary para poder borrarla (no se devuelve) |
| `games` | [ObjectId → Game] | Videojuegos favoritos, sin duplicados |

### Game (`games`)

| Campo | Tipo | Reglas |
|---|---|---|
| `title` | String | Obligatorio y único |
| `developer` | String | Obligatorio |
| `genre` | String | Obligatorio |
| `platforms` | [String] | Opcional |
| `releaseYear` | Number | Entre 1950 y 2100 |

Los dos modelos guardan `createdAt` y `updatedAt`.

---

## 🔑 Autenticación

`POST /api/v1/users/login` devuelve un token. En las rutas protegidas hay que mandarlo en la cabecera:

```
Authorization: Bearer <token>
```

---

## 📡 Endpoints

URL base: `http://localhost:3000/api/v1`

### Usuarios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/users/register` | Público | Registro con `form-data`: `userName`, `email`, `password` e `image` (archivo). Siempre crea un `user` |
| POST | `/users/login` | Público | Body `{ "email", "password" }`. Devuelve `{ token, user }` |
| GET | `/users` | Admin | Lista todos los usuarios con sus juegos |
| GET | `/users/:id` | Dueño o admin | Un usuario con sus juegos |
| PUT | `/users/:id` | Dueño o admin | Edita `userName`, `email`, `password` y/o `image` (`form-data` o JSON). Rechaza `role` (403) y `games` (400) porque tienen sus propias rutas |
| PATCH | `/users/:id/role` | Admin | Body `{ "role": "admin" }` o `{ "role": "user" }` |
| PATCH | `/users/:id/games` | Dueño o admin | Body `{ "games": ["id1", "id2"] }` o `{ "games": "id" }`. Añade sin duplicar ni borrar los que ya tenía |
| DELETE | `/users/:id/games/:gameId` | Dueño o admin | Quita un juego de la lista |
| DELETE | `/users/:id` | Dueño o admin | Borra la cuenta y su imagen de Cloudinary |

### Videojuegos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/games` | Público | Lista todos los juegos por orden alfabético |
| GET | `/games/:id` | Público | Un juego |
| POST | `/games` | Admin | Crea un juego |
| PUT | `/games/:id` | Admin | Edita un juego |
| DELETE | `/games/:id` | Admin | Borra un juego y lo quita de las listas de los usuarios |

---

## 🛡 Permisos por rol

| Acción | Sin login | `user` | `admin` |
|---|:-:|:-:|:-:|
| Registrarse e iniciar sesión | ✅ | ✅ | ✅ |
| Ver juegos | ✅ | ✅ | ✅ |
| Crear, editar o borrar juegos | ❌ | ❌ | ✅ |
| Ver, editar o borrar su propia cuenta | ❌ | ✅ | ✅ |
| Gestionar su lista de juegos | ❌ | ✅ | ✅ |
| Ver la lista de todos los usuarios | ❌ | ❌ | ✅ |
| Ver, editar o borrar la cuenta de otro | ❌ | ❌ | ✅ |
| Cambiar roles (también el suyo) | ❌ | ❌ | ✅ |

---

## 🧪 Ejemplos de uso

### Registro (Postman)

`POST /api/v1/users/register` → **Body → form-data**:

| Key | Tipo | Valor |
|---|---|---|
| `userName` | Text | `ana` |
| `email` | Text | `ana@mail.com` |
| `password` | Text | `password123` |
| `image` | **File** | una imagen de tu equipo |

Con curl:

```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -F "userName=ana" -F "email=ana@mail.com" -F "password=password123" \
  -F "image=@./foto.jpg"
```

Respuesta `201`:

```json
{
  "_id": "6650f0c2a1b2c3d4e5f60718",
  "userName": "ana",
  "email": "ana@mail.com",
  "role": "user",
  "image": "https://res.cloudinary.com/<cloud>/image/upload/v1716.../proyecto1-backend/users/abc123.jpg",
  "games": [],
  "createdAt": "2026-11-18T18:00:00.000Z",
  "updatedAt": "2026-11-18T18:00:00.000Z"
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@mail.com","password":"password123"}'
```

### Añadir juegos favoritos

```bash
curl -X PATCH http://localhost:3000/api/v1/users/<id>/games \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"games":["<idJuego1>","<idJuego2>"]}'
```

Si un juego ya estaba en la lista no se repite, y los que ya tenía se conservan.

### Hacer admin a un usuario (solo admin)

```bash
curl -X PATCH http://localhost:3000/api/v1/users/<id>/role \
  -H "Authorization: Bearer <tokenAdmin>" -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

---

## ⚠️ Errores

Todas las respuestas de error tienen la forma `{ "message": "..." }`.

| Código | Cuándo |
|---|---|
| `400` | Datos no válidos, falta la imagen, el archivo no es una imagen, formulario mal formado o id con formato incorrecto |
| `401` | Falta el token, es falso o ha caducado, o email o contraseña incorrectos |
| `403` | El rol no tiene permiso, se intenta tocar la cuenta de otro usuario o se intenta cambiar el rol desde `PUT /users/:id` |
| `404` | Usuario, juego o ruta que no existe |
| `409` | `userName`, `email` o título de juego repetido |
| `413` | La imagen pesa más de 5 MB |
| `500` | Error inesperado del servidor |
| `502` | Cloudinary no responde |

---

## 🧪 Tests

```bash
npm test
```

Usan una base de datos MongoDB en memoria y simulan Cloudinary, así que no tocan Atlas ni necesitan claves. Comprueban:

- El registro siempre crea un `user`, aunque se envíe `role: "admin"`.
- La imagen es obligatoria y solo se aceptan imágenes.
- Si el registro falla, la imagen subida se borra.
- Un `user` no puede cambiar su rol ni el de otro; un admin sí.
- Un `user` no puede ver, editar ni borrar a otro; un admin sí.
- La lista de juegos no admite duplicados y no pierde los anteriores.
- Al borrar un usuario o cambiar su foto se borra la imagen de Cloudinary.
- Al borrar un juego desaparece de las listas de los usuarios.

> La primera vez se descarga MongoDB para la base de datos en memoria (unos 800 MB), así que tarda un poco.

---

## 📁 Estructura del proyecto

```
├── index.js                  # Arranque: carga .env, conecta Atlas y Cloudinary y levanta el servidor
├── src
│   ├── app.js                # Express: rutas, 404 y manejador de errores
│   ├── config
│   │   ├── db.js             # Conexión a MongoDB Atlas
│   │   └── cloudinary.js     # Configuración de Cloudinary
│   ├── api
│   │   ├── models            # User y Game
│   │   ├── controllers       # Lógica de cada endpoint
│   │   └── routes            # Rutas y middlewares de cada endpoint
│   ├── middlewares
│   │   ├── auth.js           # isAuth, isAdmin, isOwnerOrAdmin
│   │   ├── upload.js         # Multer + subida a Cloudinary
│   │   └── error.js          # Manejador central de errores
│   ├── seeds
│   │   ├── games.js          # Datos de la semilla
│   │   └── seed.js           # Script de la semilla
│   └── utils
│       ├── httpError.js      # Errores con código HTTP
│       └── jwt.js            # Crear y verificar tokens
├── tests
│   └── api.test.js
└── .env
```

---

## 💡 Decisiones técnicas

- **Subida a Cloudinary sin `multer-storage-cloudinary`:** ese paquete solo admite la versión 1 de Cloudinary, que tiene una vulnerabilidad conocida. El middleware propio guarda la imagen en memoria con Multer y la sube con el SDK oficial de Cloudinary 2. Deja la URL en `req.file.path` y el id en `req.file.filename`, igual que el paquete original. `npm audit` no muestra ninguna vulnerabilidad.
- **Array sin duplicados:** se añade con `$addToSet` y `$each` en una sola operación atómica de MongoDB. No hay que leer el usuario, mezclar arrays y volver a guardarlo, así que no se pierden datos aunque lleguen dos peticiones a la vez.
- **Rol protegido en dos capas:** el registro nunca lee `role`, la edición de perfil lo rechaza y la única ruta que lo cambia exige ser admin.
- **Manejador de errores central:** traduce los errores de Mongoose y Multer a códigos HTTP claros y, si la petición falla, borra la imagen que se acababa de subir.

---

## 👤 Autor

**Ángel Muñiz Pedraza**
