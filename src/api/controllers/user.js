const bcrypt = require('bcryptjs')
const cloudinary = require('cloudinary').v2
const User = require('../models/user')
const Game = require('../models/game')
const { generateToken } = require('../../utils/jwt')
const { httpError } = require('../../utils/httpError')

const ROLES = User.schema.path('role').enumValues

const register = async (req, res) => {
  const { userName, email, password } = req.body
  // El rol nunca se lee del body: todo usuario nuevo se crea como "user"
  const user = await User.create({
    userName,
    email,
    password,
    image: req.file?.path,
    imagePublicId: req.file?.filename
  })
  res.status(201).json(user)
}

const login = async (req, res) => {
  const { email, password } = req.body
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw httpError(400, 'Email y contraseña son obligatorios')
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw httpError(401, 'Email o contraseña incorrectos')
  }
  res.json({ token: generateToken(user._id), user })
}

const getUsers = async (req, res) => {
  res.json(await User.find().populate('games'))
}

const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).populate('games')
  if (!user) throw httpError(404, 'Usuario no encontrado')
  res.json(user)
}

const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw httpError(404, 'Usuario no encontrado')

  // El rol y los juegos tienen sus propias rutas con sus propios permisos
  if (req.body.role !== undefined) {
    throw httpError(403, 'El rol no se cambia aquí: solo un admin puede hacerlo con PATCH /users/:id/role')
  }
  if (req.body.games !== undefined) throw httpError(400, 'Los juegos se añaden con PATCH /users/:id/games')

  for (const field of ['userName', 'email', 'password']) {
    if (req.body[field] !== undefined) user[field] = req.body[field]
  }
  const oldImageId = req.file && user.imagePublicId
  if (req.file) {
    user.image = req.file.path
    user.imagePublicId = req.file.filename
  }

  await user.save() // save() vuelve a validar y cifra la contraseña si ha cambiado
  if (oldImageId) await cloudinary.uploader.destroy(oldImageId).catch(console.error)
  res.json(await user.populate('games'))
}

const changeRole = async (req, res) => {
  const { role } = req.body
  if (!ROLES.includes(role)) throw httpError(400, `El rol debe ser uno de: ${ROLES.join(', ')}`)

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' })
  if (!user) throw httpError(404, 'Usuario no encontrado')
  res.json(user)
}

const addGames = async (req, res) => {
  // Acepta { "games": "id" } o { "games": ["id1", "id2"] }
  const ids = [...new Set([].concat(req.body.games ?? []).map((id) => String(id).toLowerCase()))]
  if (!ids.length) throw httpError(400, 'Envía al menos un id de juego en "games"')
  if ((await Game.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw httpError(404, 'Alguno de los juegos no existe')
  }

  // $addToSet + $each: añade los juegos nuevos sin duplicar y sin perder los que ya tenía
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { games: { $each: ids } } },
    { returnDocument: 'after' }
  ).populate('games')
  if (!user) throw httpError(404, 'Usuario no encontrado')
  res.json(user)
}

const removeGame = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $pull: { games: req.params.gameId } },
    { returnDocument: 'after' }
  ).populate('games')
  if (!user) throw httpError(404, 'Usuario no encontrado')
  res.json(user)
}

const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw httpError(404, 'Usuario no encontrado')

  // Primero la imagen: si Cloudinary falla no se borra nada y se puede reintentar
  if (user.imagePublicId) await cloudinary.uploader.destroy(user.imagePublicId)
  await user.deleteOne()
  res.json({ message: 'Usuario e imagen eliminados', user })
}

module.exports = { register, login, getUsers, getUserById, updateUser, changeRole, addGames, removeGame, deleteUser }
