// Backend principal do ReclamaCidadão
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const User = require('./backend/models/User');
const crypto = require('crypto');
let resetTokens = {};
const app = express();

require('dotenv').config({ path: './backend/.env' });
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));

const auth = require('./backend/middleware/auth');
const upload = require('./backend/middleware/upload');
const authController = require('./backend/controllers/authController');
const postController = require('./backend/controllers/postController');


// Rotas de autenticação
app.post('/api/register', authController.register);
app.post('/api/login', authController.login);
app.get('/api/profile', auth, authController.profile);

// Rotas de posts
app.post('/api/posts', auth, upload.single('image'), postController.createPost);
app.get('/api/posts', postController.getFeed);
app.get('/api/posts/:id', postController.getPost);
app.post('/api/posts/:id/like', auth, postController.likePost);
app.post('/api/posts/:id/comment', auth, postController.commentPost);

// Servir frontend (index.html, CSS, JS) na raiz
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));
// Rota fallback para SPA (opcional, se usar rotas no frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Recuperação de senha
app.post('/api/forgot', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const token = crypto.randomBytes(20).toString('hex');
  resetTokens[token] = user._id;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  const resetUrl = `http://localhost:5000/reset/${token}`;
  await transporter.sendMail({
    to: email,
    subject: 'Recuperação de senha',
    text: `Clique para redefinir sua senha: ${resetUrl}`
  });
  res.json({ message: 'E-mail de recuperação enviado!' });
});

app.post('/api/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const userId = resetTokens[token];
  if (!userId) return res.status(400).json({ error: 'Token inválido' });
  const hash = await require('bcrypt').hash(password, 10);
  await User.findByIdAndUpdate(userId, { password: hash });
  delete resetTokens[token];
  res.json({ message: 'Senha redefinida com sucesso!' });
});

// Editar post
app.put('/api/posts/:id', auth, upload.single('image'), async (req, res) => {
  const post = await require('./backend/models/Post').findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  if (post.user.toString() !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
  if (req.body.location) post.location = req.body.location;
  if (req.body.type) post.type = req.body.type;
  if (req.body.waitTime) post.waitTime = req.body.waitTime;
  if (req.file) post.imageUrl = req.file.path.replace('backend', '');
  await post.save();
  res.json(post);
});

// Excluir post
app.delete('/api/posts/:id', auth, async (req, res) => {
  const post = await require('./backend/models/Post').findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  if (post.user.toString() !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
  await post.deleteOne();
  res.json({ message: 'Post excluído' });
});

// Dashboard do usuário
app.get('/api/dashboard', auth, async (req, res) => {
  const user = await User.findById(req.userId).populate('posts');
  res.json({ user });
});



const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/reclamacidadao';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch(err => console.error('Erro ao conectar no MongoDB:', err));
