// Script para criar usuário inicial no MongoDB Atlas
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

async function createUser() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const hash = await bcrypt.hash('senha123', 10);
  const user = new User({
    name: 'Usuário Inicial',
    neighborhood: 'Centro',
    email: 'admin@teste.com',
    password: hash
  });
  await user.save();
  console.log('Usuário criado:', user.email);
  mongoose.disconnect();
}

createUser().catch(err => { console.error(err); mongoose.disconnect(); });
