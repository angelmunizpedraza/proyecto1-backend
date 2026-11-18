const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL)
    console.log('✅ Conectado a MongoDB Atlas')
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message)
    process.exit(1)
  }
}

module.exports = { connectDB }
