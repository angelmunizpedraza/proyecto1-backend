const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { httpError } = require('../utils/httpError')

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(httpError(400, 'La imagen debe ser JPG, PNG, WEBP, GIF o AVIF'))
  }
})

// Un formulario mal formado (sin boundary, cortado...) es culpa del cliente: 400, no 500
const parseImage = (req, res, next) => {
  multerUpload.single('image')(req, res, (err) => next(err && Object.assign(err, { status: err.status ?? 400 })))
}

// Sube la imagen a Cloudinary y deja la URL en req.file.path y su public_id en req.file.filename
// (los mismos campos que usa multer-storage-cloudinary, que no es compatible con cloudinary v2)
const uploadToCloudinary = async (req, res, next) => {
  if (!req.file) return next()
  const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  try {
    const { secure_url, public_id } = await cloudinary.uploader.upload(dataUri, { folder: 'proyecto1-backend/users' })
    req.file.path = secure_url
    req.file.filename = public_id
  } catch (error) {
    // Cloudinary rechaza con { message, http_code }: 400 si el archivo no es una imagen real
    throw error.http_code === 400
      ? httpError(400, 'El archivo no es una imagen válida')
      : httpError(502, 'No se pudo subir la imagen a Cloudinary')
  }
  next()
}

const uploadImage = [parseImage, uploadToCloudinary]

module.exports = { uploadImage }
