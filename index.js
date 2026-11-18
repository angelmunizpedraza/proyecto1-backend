process.loadEnvFile() // Node >= 20.12 lee el .env sin necesidad de dotenv

const app = require('./src/app')
const { connectDB } = require('./src/config/db')
const { connectCloudinary } = require('./src/config/cloudinary')

const PORT = process.env.PORT || 3000

connectCloudinary()
connectDB().then(() => {
  app.listen(PORT, (error) => {
    if (error) throw error // p. ej. el puerto ya está ocupado
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`)
  })
})
