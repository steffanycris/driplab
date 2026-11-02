const state = {
  page: 'home',
  category: null,
  product: null,
  cart: JSON.parse(localStorage.getItem('driplab-cart') || '[]'),
  user: JSON.parse(localStorage.getItem('driplab-user') || 'null'),
  token: localStorage.getItem('driplab-token'),
  products: [],
  drops: [],
  orders: [],
  ordersLoaded: false,
};

const app = document.querySelector('#app');
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const asset = (name) => `/assets/${encodeURIComponent(name)}`;
const heroImage = asset('WhatsApp Image 2026-10-26 at 7.58.42 AM.jpeg');
const teamImage = asset('WhatsApp Image 2026-10-26 at 7.58.55 AM.jpeg');

async function fetchProducts(category) {
  const url = category && category !== 'imediato' ? `/api/products?category=${encodeURIComponent(category)}` : '/api/products';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível carregar os produtos.');
  state.products = await response.json();
}

function normalizeDrop(drop) {
  const startsAt = drop.starts_at || drop.startsAt;
  const parsedDate = startsAt ? new Date(startsAt) : null;
  return {
    ...drop,
    startsAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
    limit: Number(drop.item_limit ?? drop.limit ?? 0),
    accessLevel: Number(drop.access_level ?? drop.accessLevel ?? 1),
  };
}

function showFeedback(message, { title = 'DripLab', error = false } = {}) {
  const modal = document.querySelector('#feedbackModal');
  document.querySelector('#feedbackTitle').textContent = title;
  document.querySelector('#feedbackMessage').textContent = message;
  document.querySelector('#feedbackIcon').innerHTML = `<i class="fa-solid ${error ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>`;
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeFeedback() {
  document.querySelector('#feedbackModal').hidden = true;
  document.body.classList.remove('modal-open');
}

function saveCart() {
  localStorage.setItem('driplab-cart', JSON.stringify(state.cart));
  renderCart();
}

function productById(id) {
  return state.products.find((item) => item.id === Number(id)) || null;
}

function orderItemProduct(item) {
  const product = productById(item.productId ?? item.product_id);
  return {
    ...item,
    name: item.name || product?.name || 'Produto DripLab',
    image: item.image || product?.image || heroImage,
    size: item.size || 'Único',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice ?? item.unit_price ?? product?.price ?? 0),
  };
}

function navigate(page, data = null) {
  state.page = page;
  state.category = data?.category ?? (page === 'catalog' ? state.category : null);
  state.product = data?.product || null;
  window.scrollTo({ top: 0 });
  render();
}

function headerActive() {
  document.querySelectorAll('[data-page],[data-category]').forEach((button) => button.classList.remove('active'));
  const selector = state.category ? `[data-category="${state.category}"]` : `[data-page="${state.page}"]`;
  document.querySelector(selector)?.classList.add('active');
}

function footerlessProduct(product) {
  return `<article class="card"><button data-product="${product.id}"><img src="${product.image}" alt="${product.name}"><h3>${product.name}</h3><p>${money(product.price)}</p></button></article>`;
}

function home() {
  const drop = state.drops[0];
  return `<section class="hero"><img class="hero-image" src="${heroImage}" alt="DripLab nova linha de moletons"><p class="tagline">A LOJA DE ROUPA MAIS HYPADA DO BRASIL</p>${drop ? `<section class="drop" data-drop-date="${drop.startsAt || ''}"><div><small>DROP LIMITADO</small><h2>${drop.name}</h2><p>${drop.limit} peças. Acesso exclusivo nível ${drop.accessLevel}.</p></div><strong class="countdown">${drop.startsAt ? '--:--:--' : 'EM BREVE'}</strong><button class="secondary" data-category="roupas">EXPLORAR DROP</button></section>` : ''}<div class="catalog-meta"><h2>DROP EM DESTAQUE</h2><button class="secondary" data-category="roupas">VER COLEÇÃO</button></div><div class="grid">${state.products.slice(0, 3).map(footerlessProduct).join('')}</div><section class="vote"><div><small>COMUNIDADE DRIPLAB</small><h2>Qual coleção deve ser o próximo drop?</h2><p>Vote e ganhe 100 pontos na sua conta.</p></div><button class="primary" id="voteButton"><i class="fa-solid fa-check-to-slot"></i> VOTAR EM PINK REBELLION</button></section></section>`;
}

function catalog() {
  const title = state.category === 'imediato' ? 'ENVIO IMEDIATO' : state.category.toUpperCase().replace('ACESSORIOS', 'ACESSÓRIOS').replace('TENIS', 'TÊNIS');
  const products = state.category === 'imediato' ? state.products : state.products.filter((product) => product.category === state.category);
  return `<section><div class="catalog-meta"><div><h1>${title}</h1><span>${products.length} produtos</span></div></div><div class="grid">${products.map(footerlessProduct).join('') || '<p>Nenhum produto nesta coleção por enquanto.</p>'}</div></section>`;
}

function about() {
  return `<section class="about"><h1>SOBRE NÓS</h1><p>A <span class="pink">DripLab</span> é uma marca de streetwear digital-first criada para conectar moda, cultura urbana e inovação digital em uma experiência única. Mais do que oferecer produtos, buscamos construir uma comunidade em torno de estilo, identidade, exclusividade e pertencimento.</p><p>Nosso conceito parte da criação de drops limitados e coleções exclusivas, desenvolvidos para transformar cada lançamento em um momento de descoberta e interação.</p><div class="team">${[1, 2, 3, 4].map((number) => `<img src="${teamImage}" alt="Comunidade DripLab ${number}">`).join('')}</div></section>`;
}

function productPage(product) {
  if (!product) return home();
  return `<section><button class="back" data-page="${state.category ? 'catalog' : 'home'}"><i class="fa-solid fa-arrow-left"></i> Voltar</button><div class="product"><div class="product-media"><img src="${product.image}" alt="${product.name}"></div><div><p class="rating" id="productRating"><span class="stars-placeholder"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></span> <span>(carregando avaliações)</span></p><h1>${product.name}</h1><p class="price">${money(product.price)}</p><p class="installments"><i class="fa-regular fa-credit-card"></i> em até 6x de ${money(product.price / 6)}</p><strong>Tamanhos:</strong><div class="sizes">${product.sizes.map((size, index) => `<button class="${index === 0 ? 'selected' : ''}" data-size="${size}">${size}</button>`).join('')}</div><button class="primary" data-add="${product.id}"><i class="fa-solid fa-bag-shopping"></i> ADICIONAR AO CARRINHO</button></div></div><section class="reviews" data-review-product="${product.id}"><div class="reviews-heading"><h2>Avaliações</h2><span id="reviewSummary">Carregando...</span></div><div id="reviewList" class="review-list"></div>${state.user ? `<form id="reviewForm" class="review-form"><h3>Deixe sua avaliação</h3><div class="rating-input" role="radiogroup" aria-label="Nota"><label><input type="radio" name="rating" value="1" required><i class="fa-solid fa-star"></i></label><label><input type="radio" name="rating" value="2"><i class="fa-solid fa-star"></i></label><label><input type="radio" name="rating" value="3"><i class="fa-solid fa-star"></i></label><label><input type="radio" name="rating" value="4"><i class="fa-solid fa-star"></i></label><label><input type="radio" name="rating" value="5"><i class="fa-solid fa-star"></i></label></div><label class="field">Seu comentário<textarea name="body" minlength="3" maxlength="1000" required placeholder="Conte o que achou do produto"></textarea></label><button class="primary">PUBLICAR AVALIAÇÃO</button></form>` : '<p class="review-login">Faça login para avaliar este produto.</p>'}</section></section>`;
}

function auth(type) {
  const register = type === 'register';
  return `<section class="auth"><h1>${register ? 'Crie sua conta' : 'Fazer login'}</h1><p>${register ? 'Entre para a comunidade DripLab.' : 'Insira seu e-mail e senha.'}</p><form id="authForm">${register ? '<label class="field">Nome<input name="name" autocomplete="name" required></label>' : ''}<label class="field">E-mail<input name="email" type="email" autocomplete="email" required></label><label class="field">Senha<input name="password" type="password" minlength="6" autocomplete="${register ? 'new-password' : 'current-password'}" required></label><button class="primary">${register ? 'REGISTRAR' : 'CONTINUAR'}</button></form><button class="link" data-page="${register ? 'login' : 'register'}">${register ? 'Já tenho conta' : 'Registre-se já'}</button></section>`;
}

function profile() {
  const user = state.user;
  if (!user) return auth('login');
  const orders = state.orders;
  const orderMarkup = orders.length ? orders.map((order) => `<article class="order"><div class="order-head"><strong>Pedido #${order.id}</strong><span class="order-status">${order.status}</span></div><div class="order-items">${(order.items || []).map((rawItem) => { const item = orderItemProduct(rawItem); return `<div class="order-item"><img src="${item.image}" alt="${item.name}" onerror="this.onerror=null;this.src='${heroImage}'"><div><h4>${item.name}</h4><p>Tamanho: ${item.size} · Quantidade: ${item.quantity}</p><strong>${money(item.unitPrice * item.quantity)}</strong></div></div>`; }).join('')}</div><div class="order-footer"><span>${new Date(order.created_at).toLocaleDateString('pt-BR')}</span><strong>Total: ${money(order.total)}</strong></div></article>`).join('') : '<div class="empty account-empty"><i class="fa-solid fa-box-open"></i><p>Você ainda não fez nenhum pedido.</p><button class="secondary" data-page="home">EXPLORAR PRODUTOS</button></div>';
  return `<section class="profile"><aside class="identity"><img class="avatar" src="/assets/mascot.png" alt="Perfil de ${user.name}"><h2>${user.name}</h2><p>${user.email}</p><div class="stats"><span>${user.points || 0}<br><small>Pontos</small></span><span>${user.level || 1}<br><small>Nível</small></span><span><i class="fa-solid fa-star"></i><br><small>Drip</small></span></div><button class="secondary" id="logoutButton">Sair da Conta</button></aside><div><div class="catalog-meta"><h1>Meus pedidos</h1><span>${orders.length} pedido(s)</span></div>${orderMarkup}</div></section>`;
}

function checkout() {
  if (!state.cart.length) return `<section class="confirmation"><h1>Seu carrinho está vazio</h1><button class="primary" data-page="home">RETORNAR À LOJA</button></section>`;
  const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return `<section class="checkout"><div><small>${state.cart.length} item(ns) no carrinho</small><div class="checkout-items">${state.cart.map((item) => `<div class="checkout-product"><img src="${item.image}" alt="${item.name}"><div><h3>${item.name}</h3><strong>${money(item.price * item.quantity)}</strong><p>Tamanho: ${item.size} · Quantidade: ${item.quantity}</p></div></div>`).join('')}</div><h2>Total: ${money(total)}</h2><h2>Forma de Pagamento</h2><div class="payment-options"><label><input type="radio" name="payment" value="credit" checked> <i class="fa-regular fa-credit-card"></i> Cartão de crédito</label><label><input type="radio" name="payment" value="debit"> <i class="fa-solid fa-credit-card"></i> Cartão de débito</label><label><input type="radio" name="payment" value="pix"> <i class="fa-brands fa-pix"></i> Transferência via Pix</label></div></div><form id="checkoutForm"><h1>IDENTIFICAÇÃO</h1><label class="field">Nome completo<input name="name" value="${state.user?.name || ''}" required></label><label class="field">E-mail<input name="email" type="email" value="${state.user?.email || ''}" required></label><label class="field">CPF<input name="cpf" required></label><label class="field">Celular<input name="phone" required></label><label class="field">Endereço<input name="address" required></label><button class="primary"><i class="fa-solid fa-lock"></i> CONCLUIR PAGAMENTO</button></form></section>`;
}

function confirmation() {
  return `<section class="confirmation"><h1>PAGAMENTO CONFIRMADO</h1><p>Acompanhe o trajeto de seu pedido aqui</p><div class="tracker"><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot future"></i><i class="dot future"></i></div><p>Destino final da entrega</p><p class="address">${state.lastAddress || 'Endereço informado no checkout'}</p><button class="primary" data-page="home"><i class="fa-solid fa-house"></i> RETORNAR AO INÍCIO</button></section>`;
}

function render() {
  headerActive();
  if (state.page === 'catalog') app.innerHTML = catalog();
  else if (state.page === 'about') app.innerHTML = about();
  else if (state.page === 'product') app.innerHTML = productPage(state.product);
  else if (state.page === 'login' || state.page === 'register') app.innerHTML = auth(state.page);
  else if (state.page === 'account') app.innerHTML = profile();
  else if (state.page === 'checkout') app.innerHTML = checkout();
  else if (state.page === 'confirmation') app.innerHTML = confirmation();
  else app.innerHTML = home();
  bindPage();
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector('#cartCount').textContent = count;
  document.querySelector('#cartTotal').textContent = money(total);
  document.querySelector('#cartItems').innerHTML = state.cart.length ? state.cart.map((item, index) => `<article class="cart-row"><img src="${item.image}" alt="${item.name}"><div><h4>${item.name}</h4><p>${item.size} · ${money(item.price)}</p><div class="quantity"><button data-quantity="${index}" data-change="-1" aria-label="Diminuir quantidade"><i class="fa-solid fa-minus"></i></button><strong>${item.quantity}</strong><button data-quantity="${index}" data-change="1" aria-label="Aumentar quantidade"><i class="fa-solid fa-plus"></i></button></div></div><button class="remove-item" data-remove="${index}" aria-label="Remover ${item.name}"><i class="fa-solid fa-trash"></i></button></article>`).join('') : '<p class="empty">Seu carrinho está vazio.</p>';
}

function openCart(open = true) {
  document.querySelector('#cartDrawer').classList.toggle('open', open);
  document.querySelector('#scrim').classList.toggle('visible', open);
}

function bindPage() {
  app.querySelectorAll('[data-product]').forEach((button) => button.addEventListener('click', () => navigate('product', { product: productById(button.dataset.product), category: state.category })));
  app.querySelectorAll('[data-size]').forEach((button) => button.addEventListener('click', () => { app.querySelectorAll('[data-size]').forEach((item) => item.classList.remove('selected')); button.classList.add('selected'); }));
  app.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
    const product = productById(button.dataset.add);
    const size = app.querySelector('.sizes .selected')?.dataset.size || product.sizes[0];
    const found = state.cart.find((item) => item.id === product.id && item.size === size);
    if (found) found.quantity += 1;
    else state.cart.push({ ...product, size, quantity: 1 });
    saveCart();
    openCart();
  }));
  document.querySelector('#authForm')?.addEventListener('submit', submitAuth);
  document.querySelector('#checkoutForm')?.addEventListener('submit', submitCheckout);
  document.querySelector('#logoutButton')?.addEventListener('click', () => { state.user = null; state.token = null; state.orders = []; state.ordersLoaded = false; localStorage.removeItem('driplab-user'); localStorage.removeItem('driplab-token'); navigate('home'); });
  document.querySelector('#voteButton')?.addEventListener('click', vote);
  document.querySelector('#reviewForm')?.addEventListener('submit', submitReview);
  if (state.page === 'product' && state.product) loadReviews(state.product.id);
  if (state.page === 'account' && state.token && !state.ordersLoaded) loadOrders();
  startCountdown();
}

function stars(value) {
  return Array.from({ length: 5 }, (_, index) => `<i class="fa-solid fa-star ${index < Math.round(value) ? 'filled' : ''}"></i>`).join('');
}

async function loadReviews(productId) {
  const response = await fetch(`/api/products/${productId}/reviews`);
  if (!response.ok) return;
  const result = await response.json();
  const summary = document.querySelector('#reviewSummary');
  const list = document.querySelector('#reviewList');
  const rating = document.querySelector('#productRating');
  if (!summary || !list || !rating) return;
  summary.innerHTML = `${stars(result.average)} <strong>${result.average.toFixed(1)}</strong> · ${result.count} avaliação(ões)`;
  rating.innerHTML = `${stars(result.average)} <span>(${result.count} avaliação(ões))</span>`;
  list.innerHTML = result.reviews.length ? result.reviews.map((review) => `<article class="review"><div class="review-meta"><strong>${review.userName}</strong><span>${stars(review.rating)} ${new Date(review.createdAt).toLocaleDateString('pt-BR')}</span></div><p>${review.body}</p></article>`).join('') : '<p class="empty">Este produto ainda não tem avaliações.</p>';
}

async function submitReview(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const response = await fetch(`/api/products/${state.product.id}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
    body: JSON.stringify({ rating: Number(data.rating), body: data.body }),
  });
  const result = await response.json();
  if (!response.ok) return showFeedback(result.error, { title: 'Avaliação não publicada', error: true });
  showFeedback('Sua avaliação foi publicada com sucesso.', { title: 'Obrigado por avaliar!' });
  event.target.reset();
  loadReviews(state.product.id);
}

async function loadOrders() {
  const response = await fetch('/api/orders', { headers: { Authorization: `Bearer ${state.token}` } });
  if (!response.ok) {
    if (response.status === 401) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('driplab-user');
      localStorage.removeItem('driplab-token');
      return navigate('login');
    }
    return showFeedback('Não foi possível carregar seus pedidos.', { title: 'Erro ao carregar conta', error: true });
  }
  state.orders = await response.json();
  state.ordersLoaded = true;
  if (state.page === 'account') render();
}

async function submitAuth(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const endpoint = state.page === 'register' ? '/api/auth/register' : '/api/auth/login';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) return showFeedback(result.error, { title: 'Não foi possível continuar', error: true });
  if (state.page === 'register') { showFeedback('Sua conta foi criada. Agora faça login para continuar.', { title: 'Conta criada' }); return navigate('login'); }
  state.user = result.user;
  state.token = result.token;
  state.orders = [];
  state.ordersLoaded = false;
  localStorage.setItem('driplab-user', JSON.stringify(result.user));
  localStorage.setItem('driplab-token', result.token);
  navigate('account');
}

async function submitCheckout(event) {
  event.preventDefault();
  if (!state.token) return navigate('login');
  const data = Object.fromEntries(new FormData(event.target));
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
  const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` }, body: JSON.stringify({ items: state.cart.map(({ id, quantity, size }) => ({ productId: id, quantity, size })), paymentMethod, address: data.address }) });
  const result = await response.json();
  if (!response.ok) return showFeedback(result.error || 'Não foi possível concluir o pedido.', { title: 'Pagamento não concluído', error: true });
  state.lastAddress = result.address;
  state.cart = [];
  saveCart();
  navigate('confirmation');
}

async function vote() {
  if (!state.token) return navigate('login');
  const response = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` }, body: JSON.stringify({ collection: 'Pink Rebellion' }) });
  const result = await response.json();
  showFeedback(response.ok ? `Você ganhou 100 pontos. Total acumulado: ${result.points}.` : result.error, { title: response.ok ? 'Voto registrado!' : 'Voto não registrado', error: !response.ok });
}

function startCountdown() {
  const node = document.querySelector('[data-drop-date] .countdown');
  if (!node) return;
  const update = () => {
    const target = new Date(document.querySelector('[data-drop-date]').dataset.dropDate).getTime();
    if (!Number.isFinite(target)) return;
    const gap = Math.max(0, target - Date.now());
    node.textContent = `${String(Math.floor(gap / 3600000)).padStart(2, '0')}:${String(Math.floor(gap / 60000) % 60).padStart(2, '0')}:${String(Math.floor(gap / 1000) % 60).padStart(2, '0')}`;
  };
  update();
  clearInterval(window.dripTimer);
  window.dripTimer = setInterval(update, 1000);
}

document.addEventListener('click', (event) => {
  const page = event.target.closest('[data-page]')?.dataset.page;
  const category = event.target.closest('[data-category]')?.dataset.category;
  if (page) navigate(page === 'account' && !state.user ? 'login' : page);
  if (category) navigate('catalog', { category });
  if (event.target.closest('#cartButton')) openCart();
  if (event.target.closest('[data-close-cart],#scrim')) openCart(false);
  const remove = event.target.closest('[data-remove]');
  if (remove) { state.cart.splice(Number(remove.dataset.remove), 1); saveCart(); }
  const quantity = event.target.closest('[data-quantity]');
  if (quantity) {
    const item = state.cart[Number(quantity.dataset.quantity)];
    item.quantity = Math.max(1, item.quantity + Number(quantity.dataset.change));
    saveCart();
  }
  if (event.target.closest('#checkoutButton')) { openCart(false); navigate(state.token ? 'checkout' : 'login'); }
  if (event.target.closest('[data-close-modal]')) closeFeedback();
});
document.querySelector('#feedbackModal').addEventListener('click', (event) => {
  if (event.target.id === 'feedbackModal') closeFeedback();
});

document.querySelector('.search-toggle').addEventListener('click', async () => {
  const term = prompt('O que você está buscando?');
  if (!term) return;
  state.products = await fetch(`/api/products?search=${encodeURIComponent(term)}`).then((response) => response.json());
  navigate('catalog', { category: 'imediato' });
});

(async function init() {
  try {
    await Promise.all([fetchProducts(), fetch('/api/drops').then((response) => response.json()).then((data) => { state.drops = data.map(normalizeDrop); })]);
    render();
    renderCart();
  } catch (error) {
    app.innerHTML = `<section class="confirmation"><h1>Não foi possível carregar a loja</h1><p>${error.message}</p></section>`;
  }
})();
