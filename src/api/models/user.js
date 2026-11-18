const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: [true, 'El nombre de usuario es obligatorio'], trim: true, unique: true },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'El email no es válido']
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    image: { type: String, required: [true, 'La imagen es obligatoria'] },
    imagePublicId: { type: String }, // id del archivo en Cloudinary, necesario para borrarlo
    games: [{ type: mongoose.Types.ObjectId, ref: 'Game' }]
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      // Nunca se envían la contraseña (aunque esté cifrada) ni el id interno de Cloudinary
      transform: (doc, ret) => {
        delete ret.password
        delete ret.imagePublicId
        return ret
      }
    }
  }
)

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10)
})

module.exports = mongoose.model('User', userSchema, 'users')
