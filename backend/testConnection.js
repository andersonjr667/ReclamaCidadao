const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB conectado com sucesso');
  mongoose.disconnect();
})
.catch(err => {
  console.error('Erro ao conectar no MongoDB:', err);
  mongoose.disconnect();
});
