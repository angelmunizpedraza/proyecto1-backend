const User = require('../api/models/user')
const { verifyToken } = require('../utils/jwt')
const { httpError } = require('../utils/httpError')

const isAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token) throw httpError(401, 'No autorizado: falta el token (Authorization: Bearer <token>)')

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw httpError(401, 'Token no válido o caducado')
  }

  req.user = await User.findById(payload.id)
  if (!req.user) throw httpError(401, 'El usuario de este token ya no existe')
  next()
}

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') throw httpError(403, 'Solo un administrador puede hacer esto')
  next()
}

// Para las rutas /:id de usuarios: pasa el dueño de la cuenta o un admin
const isOwnerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    throw httpError(403, 'Solo puedes gestionar tu propia cuenta')
  }
  next()
}

module.exports = { isAuth, isAdmin, isOwnerOrAdmin }
