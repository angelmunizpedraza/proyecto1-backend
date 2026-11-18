const router = require('express').Router()
const { isAuth, isAdmin } = require('../../middlewares/auth')
const { getGames, getGameById, createGame, updateGame, deleteGame } = require('../controllers/game')

router.get('/', getGames)
router.get('/:id', getGameById)
router.post('/', isAuth, isAdmin, createGame)
router.put('/:id', isAuth, isAdmin, updateGame)
router.delete('/:id', isAuth, isAdmin, deleteGame)

module.exports = router
