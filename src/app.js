const express = require('express')
const usersRouter = require('./api/routes/user')
const gamesRouter = require('./api/routes/game')
const { errorHandler } = require('./middlewares/error')

const app = express()

app.disable('x-powered-by')
app.use(express.json())
app.use((req, res, next) => {
  req.body ??= {} // Express 5 deja req.body undefined si la petición no trae cuerpo
  next()
})

app.use('/api/v1/users', usersRouter)
app.use('/api/v1/games', gamesRouter)

app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }))
app.use(errorHandler)

module.exports = app
