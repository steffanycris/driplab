// src/server.js
// Backend API para plataforma DripLab — e‑commerce streetwear
// Banco embutido SQLite (sem servidor externo).
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, initDatabase } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const secret = process.env.JWT_SECRET || 'driplab-dev-secret';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== Middleware JWT ====================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não informado.' });
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

// ==================== Health Check ====================
app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'sqlite-embutido' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ==================== Produtos ====================
app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category;
    const search = (req.query.search || '').toLowerCase();
    let sql = `
      SELECT p.id, p.name, c.slug AS category, p.price,
             p.image_url AS image, p.description
      FROM products p
      JOIN categories c ON p.category_id = c.id`;
    const params = [];
    if (category) {
      params.push(category);
      sql += ` WHERE c.slug = ?`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += category ? ` AND LOWER(p.name) LIKE ?` : ` WHERE LOWER(p.name) LIKE ?`;
    }
    const rows = await query(sql, params);
    for (const row of rows) {
      const sizes = await query('SELECT size FROM product_sizes WHERE product_id = ?', [row.id]);
      row.sizes = sizes.map(s => s.size);
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const rows = await query(`
      SELECT p.id, p.name, c.slug AS category, p.price,
             p.image_url AS image, p.description
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?`, [req.params.id]);
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    const sizes = await query('SELECT size FROM product_sizes WHERE product_id = ?', [product.id]);
    product.sizes = sizes.map(s => s.size);
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Drops ====================
app.get('/api/drops', async (_req, res) => {
  try {
    const drops = await query('SELECT * FROM drops');
    res.json(drops);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/drops', authMiddleware, async (req, res) => {
  try {
    const { name, startsAt, limit, accessLevel = 1 } = req.body;
    if (!name || !startsAt || !limit)
      return res.status(400).json({ error: 'Nome, data e limite são obrigatórios.' });
    const result = await query(
      `INSERT INTO drops (name, starts_at, ends_at, item_limit, access_level, active)
       VALUES (?, ?, NULL, ?, ?, 1)`,
      [name, startsAt, Number(limit), Number(accessLevel)]
    );
    const created = await query('SELECT * FROM drops WHERE id = ?', [result[0].id]);
    res.status(201).json(created[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/drops/:id', authMiddleware, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(req.body)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    values.push(req.params.id);
    await query(`UPDATE drops SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await query('SELECT * FROM drops WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/drops/:id', authMiddleware, async (req, res) => {
  try {
    await query('DELETE FROM drops WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Autenticação ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
    const exists = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ error: 'E-mail já cadastrado.' });
    const hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO users (name, email, password_hash, points, level) VALUES (?, ?, ?, 0, 1)',
      [name, email, hash]
    );
    res.status(201).json({ message: 'Conta criada com sucesso.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      secret,
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, points: user.points, level: user.level }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Pedidos ====================
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await query('SELECT * FROM orders WHERE user_id = ?', [req.user.id]);
    for (const order of orders) {
      order.items = await query(`
        SELECT oi.id, oi.product_id AS productId, oi.size, oi.quantity, oi.unit_price AS unitPrice,
               p.name, p.image_url AS image, c.slug AS category
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `, [order.id]);
    }
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { items, paymentMethod, address } = req.body;
    if (!items?.length || !paymentMethod || !address)
      return res.status(400).json({ error: 'Carrinho, endereço e pagamento são obrigatórios.' });
    let total = 0;
    for (const item of items) {
      if (!Number.isInteger(Number(item.productId)) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !item.size)
        return res.status(400).json({ error: 'Item de pedido inválido.' });
      const prodRows = await query('SELECT price FROM products WHERE id = ?', [item.productId]);
      if (!prodRows.length) return res.status(400).json({ error: 'Um dos produtos não está disponível.' });
      total += (prodRows[0]?.price || 0) * item.quantity;
    }
    const result = await query(
      `INSERT INTO orders (user_id, status, total, payment_method, address)
       VALUES (?, 'Em processamento', ?, ?, ?)`,
      [req.user.id, total, paymentMethod, address]
    );
    const orderId = result[0].id;
    for (const item of items) {
      const prodRows = await query('SELECT price FROM products WHERE id = ?', [item.productId]);
      await query(
        `INSERT INTO order_items (order_id, product_id, size, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.size, item.quantity, prodRows[0]?.price]
      );
    }
    const order = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    order[0].items = await query(`
      SELECT oi.id, oi.product_id AS productId, oi.size, oi.quantity, oi.unit_price AS unitPrice,
             p.name, p.image_url AS image, c.slug AS category
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `, [orderId]);
    res.status(201).json(order[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Comentários ====================
app.get('/api/products/:id/comments', async (req, res) => {
  try {
    const comments = await query(
      'SELECT c.*, u.name AS user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.product_id = ?',
      [req.params.id]
    );
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products/:id/comments', authMiddleware, async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Digite um comentário.' });
    const result = await query(
      'INSERT INTO comments (user_id, product_id, body) VALUES (?, ?, ?)',
      [req.user.id, req.params.id, body]
    );
    const created = await query('SELECT * FROM comments WHERE id = ?', [result[0].id]);
    // Dá pontos ao usuário por comentar
    await query('UPDATE users SET points = points + 50 WHERE id = ?', [req.user.id]);
    res.status(201).json(created[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await query(`
      SELECT r.id, r.rating, r.body, r.created_at AS createdAt, u.name AS userName
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    const summary = await query(
      'SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM product_reviews WHERE product_id = ?',
      [req.params.id]
    );
    res.json({ reviews, count: summary[0].count, average: Number(summary[0].average) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const body = String(req.body.body || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'A nota deve estar entre 1 e 5 estrelas.' });
    if (body.length < 3 || body.length > 1000)
      return res.status(400).json({ error: 'Escreva uma avaliação entre 3 e 1000 caracteres.' });
    const product = await query('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!product.length) return res.status(404).json({ error: 'Produto não encontrado.' });
    const existing = await query(
      'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?',
      [req.user.id, req.params.id]
    );
    if (existing.length) return res.status(409).json({ error: 'Você já avaliou este produto.' });
    const result = await query(
      'INSERT INTO product_reviews (user_id, product_id, rating, body) VALUES (?, ?, ?, ?)',
      [req.user.id, req.params.id, rating, body]
    );
    const created = await query(`
      SELECT r.id, r.rating, r.body, r.created_at AS createdAt, u.name AS userName
      FROM product_reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?
    `, [result[0].id]);
    res.status(201).json(created[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Votações ====================
app.get('/api/votes', async (_req, res) => {
  try {
    const votes = await query('SELECT * FROM votes');
    res.json(votes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/votes', authMiddleware, async (req, res) => {
  try {
    const collection = String(req.body.collection || '').trim();
    if (!collection) return res.status(400).json({ error: 'Informe a coleção.' });
    const exists = await query(
      'SELECT id FROM votes WHERE user_id = ? AND collection_name = ?',
      [req.user.id, collection]
    );
    if (exists.length) return res.status(409).json({ error: 'Você já votou nesta coleção.' });
    await query('INSERT INTO votes (user_id, collection_name) VALUES (?, ?)', [req.user.id, collection]);
    // Dá pontos ao usuário por votar
    await query('UPDATE users SET points = points + 100 WHERE id = ?', [req.user.id]);
    const pointsRow = await query('SELECT points FROM users WHERE id = ?', [req.user.id]);
    res.status(201).json({
      vote: { user_id: req.user.id, collection_name: collection },
      points: pointsRow[0].points
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Badges / Conquistas ====================
app.get('/api/badges', authMiddleware, async (req, res) => {
  try {
    const badges = await query('SELECT * FROM badges');
    const userBadges = await query(
      'SELECT badge_id FROM user_badges WHERE user_id = ?',
      [req.user.id]
    );
    const earnedIds = userBadges.map(b => b.badge_id);
    const pointsRow = await query('SELECT points, level FROM users WHERE id = ?', [req.user.id]);
    res.json({
      badges: badges.map(b => ({ ...b, earned: earnedIds.includes(b.id) })),
      points: pointsRow[0].points,
      level: pointsRow[0].level
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Categorias ====================
app.get('/api/categories', async (_req, res) => {
  try {
    const cats = await query('SELECT * FROM categories');
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Perfil ====================
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, email, points, level, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const user = rows[0];
    const orders = await query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.user.id]);
    const spent = await query('SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE user_id = ?', [req.user.id]);
    res.json({ ...user, totalOrders: orders[0].total, totalSpent: spent[0].total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Fallback SPA ====================
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

// ==================== Inicialização ====================
async function start() {
  try {
    await initDatabase();
    console.log('✓ Banco de dados SQLite inicializado.');
    app.listen(port, () => console.log(`DripLab em http://localhost:${port}`));
  } catch (e) {
    console.error('Erro ao iniciar:', e);
    process.exit(1);
  }
}

start();
