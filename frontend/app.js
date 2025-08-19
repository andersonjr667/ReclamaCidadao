// --- Autenticação e Usuário ---
function showLoginModal() {
  // Exemplo simples: prompt, substitua por modal real
  const email = prompt('E-mail:');
  const password = prompt('Senha:');
  login(email, password);
}

async function login(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.ok) {
    const data = await res.json();
    localStorage.setItem('token', data.token);
    alert('Login realizado!');
    fetchFeed();
  } else {
    alert('Login inválido!');
  }
}

function showRegisterModal() {
  const name = prompt('Nome:');
  const neighborhood = prompt('Bairro:');
  const email = prompt('E-mail:');
  const password = prompt('Senha:');
  register(name, neighborhood, email, password);
}

async function register(name, neighborhood, email, password) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, neighborhood, email, password })
  });
  if (res.ok) {
    alert('Cadastro realizado! Faça login.');
  } else {
    alert('Erro ao cadastrar!');
  }
}

async function forgotPassword() {
  const email = prompt('Digite seu e-mail para recuperar a senha:');
  const res = await fetch(`${API_URL}/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (res.ok) {
    alert('E-mail de recuperação enviado!');
  } else {
    alert('Erro ao enviar e-mail.');
  }
}

function logout() {
  localStorage.removeItem('token');
  alert('Logout realizado!');
  fetchFeed();
}

async function showDashboard() {
  const token = localStorage.getItem('token');
  if (!token) return alert('Faça login!');
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (res.ok) {
    const data = await res.json();
    alert(`Usuário: ${data.user.name}\nE-mail: ${data.user.email}\nPosts: ${data.user.posts.length}`);
  } else {
    alert('Erro ao carregar dashboard.');
  }
}

// --- Gerenciamento de Posts ---
async function editPost(postId) {
  const location = prompt('Nova localização:');
  const type = prompt('Novo tipo:');
  const waitTime = prompt('Novo tempo de espera:');
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, type, waitTime })
  });
  if (res.ok) {
    alert('Post editado!');
    fetchFeed();
  } else {
    alert('Erro ao editar post.');
  }
}

async function deletePost(postId) {
  const token = localStorage.getItem('token');
  if (!confirm('Tem certeza que deseja excluir?')) return;
  const res = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (res.ok) {
    alert('Post excluído!');
    fetchFeed();
  } else {
    alert('Erro ao excluir post.');
  }
}

// JS principal do ReclamaCidadão
// Swipe, feed, modais, interações

const API_URL = 'http://localhost:5000/api';
const feed = document.getElementById('feed');
const postBtn = document.getElementById('postBtn');
const profileBtn = document.getElementById('profileBtn');

let posts = [];
let current = 0;

async function fetchFeed() {
  const res = await fetch(`${API_URL}/posts`);
  posts = await res.json();
  current = 0;
  showCurrent();
}

function showCurrent() {
  feed.innerHTML = '';
  if (posts.length === 0) {
    feed.innerHTML = '<p>Nenhum post encontrado.</p>';
    return;
  }
  renderCard(posts[current]);
}

function nextCard() {
  current = (current + 1) % posts.length;
  showCurrent();
}

feed.addEventListener('click', e => {
  if (e.target.classList.contains('like')) {
    likePost(posts[current]._id);
    nextCard();
  } else if (e.target.classList.contains('pass')) {
    nextCard();
  } else if (e.target.classList.contains('comment')) {
    openCommentModal(posts[current]);
  } else if (e.target.classList.contains('share')) {
    sharePost(posts[current]);
  }
});

async function likePost(id) {
  await fetch(`${API_URL}/posts/${id}/like`, {
    method: 'POST',
    headers: authHeaders()
  });
}

function sharePost(post) {
  navigator.clipboard.writeText(`${location.origin}/?post=${post._id}`);
  alert('Link copiado!');
}

function openCommentModal(post) {
  // ... Implementar modal de comentários ...
}


const postModal = document.getElementById('postModal');
const postForm = document.getElementById('postForm');
const closePostModal = document.getElementById('closePostModal');

postBtn.onclick = () => {
  postModal.classList.remove('hidden');
};

closePostModal.onclick = () => {
  postModal.classList.add('hidden');
};

postForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('location', document.getElementById('locationInput').value);
  formData.append('type', document.getElementById('typeInput').value);
  formData.append('waitTime', document.getElementById('waitTimeInput').value);
  formData.append('image', document.getElementById('imageInput').files[0]);
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Faça login para postar!');
    return;
  }
  const res = await fetch(`${API_URL}/posts`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  });
  if (res.ok) {
    postModal.classList.add('hidden');
    fetchFeed();
    postForm.reset();
  } else {
    alert('Erro ao postar.');
  }
};

profileBtn.onclick = () => {
  showDashboard();
};

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function renderCard(post) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img src="${post.imageUrl}" alt="Foto do problema">
    <div class="info">
      <strong>${post.type}</strong> - ${post.location}<br>
      <span>Tempo de espera: ${post.waitTime}</span>
    </div>
    <div class="actions">
      <button class="like">👍</button>
      <button class="pass">👎</button>
      <button class="comment">💬</button>
      <button class="share">🔗</button>
    </div>
    <div class="counts">
      <span>${post.likes.length} curtidas</span> · <span>${post.comments.length} comentários</span>
    </div>
  `;
  feed.appendChild(card);
}

fetchFeed();
