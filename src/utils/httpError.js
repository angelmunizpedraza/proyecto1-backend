// Error con código HTTP: el manejador central (middlewares/error.js) lo convierte en respuesta
const httpError = (status, message) => Object.assign(new Error(message), { status })

module.exports = { httpError }
