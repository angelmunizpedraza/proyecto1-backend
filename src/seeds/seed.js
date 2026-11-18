process.loadEnvFile()

const mongoose = require('mongoose')
const { connectDB } = require('../config/db')
const Game = require('../api/models/game')
const games = require('./games')

const seed = async () => {
  try {
    await connectDB()
    // Upsert por título: se puede lanzar varias veces sin duplicar juegos
    // ni cambiar sus _id, así no se rompen las listas de juegos de los usuarios
    const result = await Game.bulkWrite(
      games.map((game) => ({
        updateOne: { filter: { title: game.title }, update: { $set: game }, upsert: true }
      }))
    )
    console.log(`🌱 Semilla completada: ${result.upsertedCount} juegos nuevos y ${result.modifiedCount} actualizados`)
  } catch (error) {
    console.error('❌ Error al lanzar la semilla:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()
