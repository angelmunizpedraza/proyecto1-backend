const router = require('express').Router()
const { isAuth, isAdmin, isOwnerOrAdmin } = require('../../middlewares/auth')
const { uploadImage } = require('../../middlewares/upload')
const {
  register,
  login,
  getUsers,
  getUserById,
  updateUser,
  changeRole,
  addGames,
  removeGame,
  deleteUser
} = require('../controllers/user')

router.post('/register', uploadImage, register)
router.post('/login', login)

router.get('/', isAuth, isAdmin, getUsers)
router.get('/:id', isAuth, isOwnerOrAdmin, getUserById)
router.put('/:id', isAuth, isOwnerOrAdmin, uploadImage, updateUser)
router.patch('/:id/role', isAuth, isAdmin, changeRole)
router.patch('/:id/games', isAuth, isOwnerOrAdmin, addGames)
router.delete('/:id/games/:gameId', isAuth, isOwnerOrAdmin, removeGame)
router.delete('/:id', isAuth, isOwnerOrAdmin, deleteUser)

module.exports = router
