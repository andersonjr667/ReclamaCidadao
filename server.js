// Backend principal do ReclamaCidadão

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
const User = require('./backend/models/User');
const auth = require('./backend/middleware/auth');
const crypto = require('crypto');
let mongoose;
let useJsonDb = false;
let jsonDb = {};
let resetTokens = {};
const dbPath = path.join(__dirname, 'db');
const app = express();


require('dotenv').config();
app.use(cors());
app.use(express.json());
// Corrige o caminho para servir uploads corretamente, mesmo se rodar de diferentes diretórios
const uploadsPath = path.resolve(__dirname, 'backend', 'uploads');
app.use('/uploads', express.static(uploadsPath));


// Função para garantir que a pasta db existe
function ensureDbDir() {
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);
}

// Função para carregar coleção JSON
function loadJsonCollection(name) {
  ensureDbDir();
  try {
    const file = path.join(dbPath, name + '.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Função para salvar coleção JSON
function saveJsonCollection(name, data) {
  ensureDbDir();
  fs.writeFileSync(path.join(dbPath, name + '.json'), JSON.stringify(data, null, 2));
}

// Tenta conectar ao MongoDB, senão usa JSON
async function tryConnectMongo() {
  try {
    mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conectado ao MongoDB!');
  } catch (err) {
    console.log('Não foi possível conectar ao MongoDB. Usando banco de dados local em JSON.');
    useJsonDb = true;
    // Carrega coleções básicas
    jsonDb.users = loadJsonCollection('users');
    jsonDb.posts = loadJsonCollection('posts');
    jsonDb.comments = loadJsonCollection('comments');
  }
}

tryConnectMongo();

const upload = require('./backend/middleware/upload');
const authController = require('./backend/controllers/authController');
const postController = require('./backend/controllers/postController');



// Rotas de autenticação

// Rotas de registro, login e perfil SEMPRE funcionam com JSON local como fallback
const bcrypt = require('bcrypt');
app.post('/api/register', async (req, res) => {
  const { name, neighborhood, email, password } = req.body;
  // Tenta MongoDB
  let mongoError = false;
  if (!useJsonDb) {
    try {
      const User = require('./backend/models/User');
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ error: 'Usuário já existe' });
      const hash = await bcrypt.hash(password, 10);
      user = new User({ name, neighborhood, email, password: hash });
      await user.save();
      return res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (err) {
      mongoError = true;
    }
  }
  // Fallback JSON local
  if (!jsonDb.users) jsonDb.users = loadJsonCollection('users');
  if (jsonDb.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString() + Math.random().toString(36).slice(2), name, neighborhood, email, password: hash };
  jsonDb.users.push(user);
  saveJsonCollection('users', jsonDb.users);
  res.status(201).json({ message: 'Usuário registrado com sucesso!' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // Tenta MongoDB
  let mongoError = false;
  if (!useJsonDb) {
    try {
      const User = require('./backend/models/User');
      const user = await User.findOne({ email });
      if (user && await bcrypt.compare(password, user.password)) {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { name: user.name, neighborhood: user.neighborhood, email: user.email, photo: user.photo } });
      }
    } catch (err) {
      mongoError = true;
    }
  }
  // Fallback JSON local
  if (!jsonDb.users) jsonDb.users = loadJsonCollection('users');
  const user = jsonDb.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Senha incorreta' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { name: user.name, neighborhood: user.neighborhood, email: user.email, photo: user.photo } });
});

app.get('/api/profile', async (req, res) => {
  // Tenta MongoDB
  let mongoError = false;
  let userId = null;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Token não fornecido');
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  if (!useJsonDb) {
    try {
      const User = require('./backend/models/User');
      const user = await User.findById(userId);
      if (user) {
        return res.json(user);
      }
    } catch (err) {
      mongoError = true;
    }
  }
  // Fallback JSON local
  if (!jsonDb.users) jsonDb.users = loadJsonCollection('users');
  const user = jsonDb.users.find(u => u.id === userId || u.email === userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

// Servir frontend (index.html, CSS, JS) na raiz
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));
// Rota fallback para SPA (opcional, se usar rotas no frontend)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
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


// Criar post (MongoDB ou JSON local)
app.post('/api/posts', auth, upload.single('image'), async (req, res) => {
  const { location, type, waitTime } = req.body;
  let imageUrl = '';
  if (req.file) {
    // Garante que o caminho seja sempre /uploads/NOMEARQUIVO.jpg
    const fileName = req.file.filename || (req.file.path ? req.file.path.split(/[/\\]/).pop() : '');
    imageUrl = '/uploads/' + fileName;
  }
  // MongoDB
  if (!useJsonDb) {
    try {
      const Post = require('./backend/models/Post');
      const post = new Post({
        user: req.userId,
        location,
        type,
        waitTime,
        imageUrl
      });
      await post.save();
      return res.status(201).json(post);
    } catch (err) {}
  }
  // JSON local
  if (!jsonDb.posts) jsonDb.posts = loadJsonCollection('posts');
  const post = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    user: req.userId,
    location,
    type,
    waitTime,
    imageUrl,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };
  jsonDb.posts.push(post);
  saveJsonCollection('posts', jsonDb.posts);
  res.status(201).json(post);
});

// Listar feed de posts (MongoDB ou JSON local)
app.get('/api/posts', async (req, res) => {
  if (!useJsonDb) {
    try {
      const Post = require('./backend/models/Post');
      const posts = await Post.find().sort({ createdAt: -1 }).populate('user likes comments');
      return res.json(posts);
    } catch (err) {}
  }
  if (!jsonDb.posts) jsonDb.posts = loadJsonCollection('posts');
  // Ordena por data decrescente
  const posts = [...jsonDb.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

// Curtir post (MongoDB ou JSON local)
app.post('/api/posts/:id/like', auth, async (req, res) => {
  if (!useJsonDb) {
    try {
      const Post = require('./backend/models/Post');
      const post = await Post.findById(req.params.id);
      if (!post.likes.includes(req.userId)) {
        post.likes.push(req.userId);
        await post.save();
      }
      return res.json(post);
    } catch (err) {}
  }
  if (!jsonDb.posts) jsonDb.posts = loadJsonCollection('posts');
  const post = jsonDb.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  if (!post.likes.includes(req.userId)) post.likes.push(req.userId);
  saveJsonCollection('posts', jsonDb.posts);
  res.json(post);
});

// Comentar post (MongoDB ou JSON local)
app.post('/api/posts/:id/comment', auth, async (req, res) => {
  const { text } = req.body;
  if (!useJsonDb) {
    try {
      const Comment = require('./backend/models/Comment');
      const Post = require('./backend/models/Post');
      const comment = new Comment({
        user: req.userId,
        post: req.params.id,
        text
      });
      await comment.save();
      const post = await Post.findById(req.params.id);
      post.comments.push(comment._id);
      await post.save();
      return res.status(201).json(comment);
    } catch (err) {}
  }
  if (!jsonDb.posts) jsonDb.posts = loadJsonCollection('posts');
  const post = jsonDb.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  if (!post.comments) post.comments = [];
  const comment = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    user: req.userId,
    post: req.params.id,
    text,
    createdAt: new Date().toISOString()
  };
  post.comments.push(comment);
  saveJsonCollection('posts', jsonDb.posts);
  res.status(201).json(comment);
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



// Criação automática dos usuários Anderson e admin em ambos os bancos
async function createDefaultUsers() {
  try {
    const bcrypt = require('bcrypt');
    const User = require('./backend/models/User');
    const users = [
      { name: 'Anderson', neighborhood: 'Centro', email: 'alsj1520@gmail.com', password: '152070an' },
      { name: 'admin', neighborhood: 'Centro', email: 'admin@teste.com', password: 'admin123' }
    ];
    // MongoDB
    for (const u of users) {
      let user = null;
      try {
        user = await User.findOne({ email: u.email });
      } catch (e) {}
      if (!user) {
        const hash = await bcrypt.hash(u.password, 10);
        user = new User({ name: u.name, neighborhood: u.neighborhood, email: u.email, password: hash });
        try {
          await user.save();
          console.log('Usuário padrão criado no MongoDB:', u.email);
        } catch (e) {}
      }
    }
    // JSON local SEMPRE
    if (!jsonDb.users) jsonDb.users = loadJsonCollection('users');
    let changed = false;
    for (const u of users) {
      if (!jsonDb.users.find(j => j.email === u.email)) {
        const hash = await bcrypt.hash(u.password, 10);
        jsonDb.users.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          name: u.name,
          neighborhood: u.neighborhood,
          email: u.email,
          password: hash
        });
        changed = true;
        console.log('Usuário padrão criado no JSON local:', u.email);
      }
    }
    if (changed) saveJsonCollection('users', jsonDb.users);
  } catch (err) {
    console.error('Erro ao criar usuários padrão:', err);
  }
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    await createDefaultUsers();
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch(err => console.error('Erro ao conectar no MongoDB:', err));
