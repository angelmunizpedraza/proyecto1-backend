const Game = require('../models/game')
const User = require('../models/user')
const { httpError } = require('../../utils/httpError')

const getGames = async (req, res) => {
  res.json(await Game.find().sort({ title: 1 }))
}

const getGameById = async (req, res) => {
  const game = await Game.findById(req.params.id)
  if (!game) throw httpError(404, 'Juego no encontrado')
  res.json(game)
}

const createGame = async (req, res) => {
  res.status(201).json(await Game.create(req.body))
}

const updateGame = async (req, res) => {
  const game = await Game.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
  if (!game) throw httpError(404, 'Juego no encontrado')
  res.json(game)
}

const deleteGame = async (req, res) => {
  const game = await Game.findByIdAndDelete(req.params.id)
  if (!game) throw httpError(404, 'Juego no encontrado')

  // Se quita de las listas de los usuarios para no dejar referencias rotas
  await User.updateMany({ games: game._id }, { $pull: { games: game._id } })
  res.json({ message: 'Juego eliminado', game })
}

module.exports = { getGames, getGameById, createGame, updateGame, deleteGame }
