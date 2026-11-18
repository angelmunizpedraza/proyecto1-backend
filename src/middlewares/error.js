const cloudinary = require('cloudinary').v2

const errorHandler = (err, req, res, next) => {
  // Si la petición falla después de subir la imagen (email repetido, datos no válidos...), se borra de Cloudinary
  if (req.file?.filename) cloudinary.uploader.destroy(req.file.filename).catch(console.error)

  if (err.name === 'CastError') return res.status(400).json({ message: `Valor no válido en "${err.path}"` })
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join('. ') })
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ') || 'valor'
    return res.status(409).json({ message: `Ya existe un registro con ese ${fields}` })
  }
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'La imagen no puede pesar más de 5 MB' })
    return res.status(400).json({ message: 'Envía una sola imagen en el campo "image"' })
  }

  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ message: status === 500 ? 'Error interno del servidor' : err.message })
}

module.exports = { errorHandler }
