const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server-core')
const cloudinary = require('cloudinary').v2

// Cloudinary simulado: los tests no necesitan cuenta ni conexión
let uploads = 0
let rejectNextUpload = false
const destroyed = []
cloudinary.uploader.upload = async () => {
  if (rejectNextUpload) {
    rejectNextUpload = false
    throw { message: 'Invalid image file', http_code: 400 } // así rechaza Cloudinary un archivo que no es imagen
  }
  uploads++
  return {
    secure_url: `https://res.cloudinary.com/demo/image/upload/v1/test/img${uploads}.png`,
    public_id: `test/img${uploads}`
  }
}
cloudinary.uploader.destroy = async (publicId) => {
  destroyed.push(publicId)
  return { result: 'ok' }
}
const publicIdOf = (url) => url.match(/test\/img\d+/)[0]

process.env.JWT_SECRET = 'secreto-de-test'
const app = require('../src/app')
const User = require('../src/api/models/user')

let mongo, server, baseUrl

before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await mongoose.connection.syncIndexes() // índices unique listos antes de empezar
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://localhost:${server.address().port}/api/v1`
})

after(async () => {
  server.close()
  await mongoose.disconnect()
  await mongo.stop()
})

const api = async (method, path, { token, json, form } = {}) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (json) headers['Content-Type'] = 'application/json'
  const res = await fetch(baseUrl + path, { method, headers, body: json ? JSON.stringify(json) : form })
  return { status: res.status, body: await res.json() }
}

const buildForm = (fields, withImage = true) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  if (withImage) form.append('image', new Blob(['png-falso'], { type: 'image/png' }), 'avatar.png')
  return form
}

const register = (name, extra = {}, withImage = true) =>
  api('POST', '/users/register', {
    form: buildForm({ userName: name, email: `${name}@test.com`, password: 'password123', ...extra }, withImage)
  })

const login = async (name) =>
  (await api('POST', '/users/login', { json: { email: `${name}@test.com`, password: 'password123' } })).body.token

let ana, bea, admin, anaToken, beaToken, adminToken, games

test('registro: nace con rol "user" aunque envíe role "admin", sube la imagen y cifra la contraseña', async () => {
  const res = await register('ana', { role: 'admin' })
  assert.equal(res.status, 201)
  assert.equal(res.body.role, 'user')
  assert.match(res.body.image, /^https:\/\/res\.cloudinary\.com\//)
  assert.equal(res.body.password, undefined)
  assert.notEqual((await User.findById(res.body._id)).password, 'password123')

  ana = res.body
  bea = (await register('bea')).body
  admin = (await register('admin')).body
  await User.updateOne({ _id: admin._id }, { role: 'admin' }) // igual que el primer admin hecho a mano en Atlas
  ;[anaToken, beaToken, adminToken] = await Promise.all(['ana', 'bea', 'admin'].map(login))
  assert.ok(anaToken && beaToken && adminToken)
})

test('registro: la imagen es obligatoria y solo se aceptan imágenes', async () => {
  assert.equal((await register('sinfoto', {}, false)).status, 400)

  const form = buildForm({ userName: 'pdf', email: 'pdf@test.com', password: 'password123' }, false)
  form.append('image', new Blob(['%PDF'], { type: 'application/pdf' }), 'doc.pdf')
  assert.equal((await api('POST', '/users/register', { form })).status, 400)

  rejectNextUpload = true // dice ser PNG pero Cloudinary ve que no es una imagen
  assert.equal((await register('falso')).status, 400)
})

test('registro fallido (email repetido): 409 y se borra la imagen que ya se había subido', async () => {
  const res = await register('ana')
  assert.equal(res.status, 409)
  assert.ok(destroyed.includes(`test/img${uploads}`))
})

test('auth: contraseña incorrecta da 401 y sin token válido las rutas protegidas dan 401', async () => {
  const bad = await api('POST', '/users/login', { json: { email: 'ana@test.com', password: 'otraclave1' } })
  assert.equal(bad.status, 401)
  assert.equal((await api('GET', `/users/${ana._id}`)).status, 401)
  assert.equal((await api('GET', `/users/${ana._id}`, { token: 'token-falso' })).status, 401)
})

test('lectura y edición: un user solo ve y edita su cuenta; un admin, cualquiera; id no válido da 400', async () => {
  assert.equal((await api('GET', '/users', { token: anaToken })).status, 403)
  assert.equal((await api('GET', '/users', { token: adminToken })).body.length, 3)
  assert.equal((await api('GET', `/users/${ana._id}`, { token: anaToken })).status, 200)
  assert.equal((await api('GET', `/users/${bea._id}`, { token: anaToken })).status, 403)
  assert.equal((await api('GET', `/users/${bea._id}`, { token: adminToken })).status, 200)
  assert.equal((await api('GET', '/users/no-es-un-id', { token: adminToken })).status, 400)

  assert.equal((await api('PUT', `/users/${bea._id}`, { token: anaToken, json: { userName: 'pirata' } })).status, 403)
  const edited = await api('PUT', `/users/${bea._id}`, { token: adminToken, json: { userName: 'bea2' } })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.userName, 'bea2')
})

test('roles: un "user" no puede cambiar su rol ni el de otro (ni colándolo al editar su perfil)', async () => {
  assert.equal((await api('PATCH', `/users/${ana._id}/role`, { token: anaToken, json: { role: 'admin' } })).status, 403)
  assert.equal((await api('PATCH', `/users/${bea._id}/role`, { token: anaToken, json: { role: 'admin' } })).status, 403)
  assert.equal((await api('PUT', `/users/${ana._id}`, { token: anaToken, json: { role: 'admin' } })).status, 403)
  assert.equal((await User.findById(ana._id)).role, 'user')
})

test('roles: un admin puede convertir a un user en admin; un rol inventado da 400', async () => {
  const res = await api('PATCH', `/users/${bea._id}/role`, { token: adminToken, json: { role: 'admin' } })
  assert.equal(res.status, 200)
  assert.equal(res.body.role, 'admin')
  assert.equal((await api('PATCH', `/users/${bea._id}/role`, { token: adminToken, json: { role: 'jefe' } })).status, 400)
  await api('PATCH', `/users/${bea._id}/role`, { token: adminToken, json: { role: 'user' } })
})

test('juegos: lectura pública; solo un admin crea, edita y borra', async () => {
  const newGame = { title: 'Juego A', developer: 'Estudio', genre: 'RPG' }
  assert.equal((await api('POST', '/games', { token: anaToken, json: newGame })).status, 403)

  const created = await Promise.all(
    ['Juego A', 'Juego B', 'Juego C'].map((title) => api('POST', '/games', { token: adminToken, json: { ...newGame, title } }))
  )
  assert.ok(created.every((r) => r.status === 201))
  games = created.map((r) => r.body)

  assert.equal((await api('GET', '/games')).body.length, 3)
  const edited = await api('PUT', `/games/${games[0]._id}`, { token: adminToken, json: { genre: 'Aventura' } })
  assert.equal(edited.body.genre, 'Aventura')
  assert.equal((await api('PUT', `/games/${games[0]._id}`, { token: anaToken, json: { genre: 'X' } })).status, 403)
})

test('favoritos: no se duplican, no se pierden los anteriores y nadie toca la lista de otro', async () => {
  const [g1, g2, g3] = games.map((g) => g._id)
  const addGames = (ids, token = anaToken) => api('PATCH', `/users/${ana._id}/games`, { token, json: { games: ids } })

  let res = await addGames([g1, g1])
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.games.map((g) => g._id), [g1])

  res = await addGames([g2, g1])
  assert.deepEqual(res.body.games.map((g) => g._id), [g1, g2])

  res = await addGames(g3) // también acepta un solo id
  assert.deepEqual(res.body.games.map((g) => g._id), [g1, g2, g3])

  assert.equal((await addGames([g1], beaToken)).status, 403)
  assert.equal((await addGames([new mongoose.Types.ObjectId().toString()])).status, 404)
  assert.equal((await addGames([])).status, 400)
  assert.equal((await api('PUT', `/users/${ana._id}`, { token: anaToken, json: { games: [] } })).status, 400) // el PUT no pisa la lista

  res = await api('DELETE', `/users/${ana._id}/games/${g3}`, { token: anaToken })
  assert.deepEqual(res.body.games.map((g) => g._id), [g1, g2])
})

test('borrar un juego lo quita también de las listas de los usuarios', async () => {
  assert.equal((await api('DELETE', `/games/${games[1]._id}`, { token: adminToken })).status, 200)
  const res = await api('GET', `/users/${ana._id}`, { token: anaToken })
  assert.deepEqual(res.body.games.map((g) => g._id), [games[0]._id])
})

test('editar perfil con imagen nueva borra la anterior de Cloudinary y conserva los juegos', async () => {
  const res = await api('PUT', `/users/${ana._id}`, { token: anaToken, form: buildForm({ userName: 'ana2' }) })
  assert.equal(res.status, 200)
  assert.equal(res.body.userName, 'ana2')
  assert.notEqual(res.body.image, ana.image)
  assert.ok(destroyed.includes(publicIdOf(ana.image)))
  assert.equal(res.body.games.length, 1)
  ana = res.body
})

test('borrado: un user no puede borrar a otro; sí a sí mismo, y se borra su imagen', async () => {
  assert.equal((await api('DELETE', `/users/${bea._id}`, { token: anaToken })).status, 403)

  const res = await api('DELETE', `/users/${ana._id}`, { token: anaToken })
  assert.equal(res.status, 200)
  assert.ok(destroyed.includes(publicIdOf(ana.image)))
  assert.equal(await User.exists({ _id: ana._id }), null)
  assert.equal((await api('GET', `/users/${ana._id}`, { token: anaToken })).status, 401) // su token ya no sirve
})

test('borrado: un admin puede borrar a cualquier usuario, y se borra su imagen', async () => {
  const res = await api('DELETE', `/users/${bea._id}`, { token: adminToken })
  assert.equal(res.status, 200)
  assert.ok(destroyed.includes(publicIdOf(bea.image)))
})
