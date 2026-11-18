const mongoose = require('mongoose')

const gameSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true, unique: true },
    developer: { type: String, required: [true, 'El estudio es obligatorio'], trim: true },
    genre: { type: String, required: [true, 'El género es obligatorio'], trim: true },
    platforms: [{ type: String, trim: true }],
    releaseYear: { type: Number, min: [1950, 'Año no válido'], max: [2100, 'Año no válido'] }
  },
  { timestamps: true, versionKey: false }
)

module.exports = mongoose.model('Game', gameSchema, 'games')
