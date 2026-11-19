// src/db.js
// Conexão SQLite embutida — roda dentro do próprio código, sem servidor externo.
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { updateCatalog } = require('./catalog');

// Caminho do arquivo SQLite.
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'driplab.sqlite');

// Garante que o diretório data/ exista.
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

async function getConnection() {
  if (!dbInstance) {
    dbInstance = await open({
      filename: DB_FILE,
      driver: sqlite3.Database,
    });
    // Habilita foreign keys no SQLite.
    await dbInstance.run('PRAGMA foreign_keys = ON');
    await dbInstance.run('PRAGMA journal_mode = WAL');
  }
  return dbInstance;
}

// Converte placeholders PostgreSQL ($1, $2 ...) para ? do SQLite.
function convertPlaceholders(sql) {
  return sql.replace(/\$\d+/g, '?');
}

// Executa uma query e retorna as linhas (SELECT) ou resultado (INSERT/UPDATE/DELETE).
async function query(text, params = []) {
  const db = await getConnection();
  const sql = convertPlaceholders(text);
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    return db.all(sql, params);
  }

  // Para INSERT/UPDATE/DELETE
  const result = await db.run(sql, params);
  return [{ id: result.lastID, changes: result.changes }];
}

// Inicializa as tabelas e os dados de seed.
async function initDatabase() {
  const db = await getConnection();

  // ========== CRIAÇÃO DAS TABELAS ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id_produto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_categoria INTEGER NOT NULL,
      id_drop INTEGER,
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      descricao TEXT,
      FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
      FOREIGN KEY (id_drop) REFERENCES drops(id_drop)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS tamanhos_produtos (
      id_tamanho_produto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_produto INTEGER NOT NULL,
      tamanho TEXT NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (id_produto) REFERENCES produtos(id_produto)
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, size),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      starts_at DATETIME,
      ends_at DATETIME,
      item_limit INTEGER NOT NULL DEFAULT 0,
      access_level INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      pontos INTEGER NOT NULL DEFAULT 0,
      nivel INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Em processamento',
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Em processamento',
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS itens_pedidos (
      id_item_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
      id_pedido INTEGER NOT NULL,
      id_tamanho_produto INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL,
      FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
      FOREIGN KEY (id_tamanho_produto) REFERENCES tamanhos_produtos(id_tamanho_produto)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      collection_name TEXT NOT NULL,
      UNIQUE(user_id, collection_name),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS votos (
      id_voto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      id_produto INTEGER NOT NULL,
      data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
      FOREIGN KEY (id_produto) REFERENCES produtos(id_produto)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS comentarios (
      id_comentario INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      id_produto INTEGER NOT NULL,
      conteudo TEXT NOT NULL,
      data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
      FOREIGN KEY (id_produto) REFERENCES produtos(id_produto)
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conquistas (
      id_conquista INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      pontos_necessarios INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      user_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, badge_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (badge_id) REFERENCES badges(id)
    );

    CREATE TABLE IF NOT EXISTS usuarios_conquistas (
      id_usuario_conquista INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      id_conquista INTEGER NOT NULL,
      data_conquista DATE NOT NULL DEFAULT CURRENT_DATE,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
      FOREIGN KEY (id_conquista) REFERENCES conquistas(id_conquista)
    );
  `);

  // ========== SEED: só popula se estiver vazio ==========
  const existingCategories = await db.all('SELECT COUNT(*) AS c FROM categories');
  if (existingCategories[0].c === 0) {
    // Categorias
    await db.run("INSERT INTO categories (slug, name) VALUES ('roupas', 'Roupas')");
    await db.run("INSERT INTO categories (slug, name) VALUES ('tenis', 'Tênis')");
    await db.run("INSERT INTO categories (slug, name) VALUES ('acessorios', 'Acessórios')");
    await db.run("INSERT INTO categories (slug, name) VALUES ('conjuntos', 'Conjuntos')");

    // Categorias (tabela pt-br para o diagrama ER)
    await db.run("INSERT INTO categorias (nome, descricao) VALUES ('Roupas', 'Camisetas, moletons e jaquetas streetwear')");
    await db.run("INSERT INTO categorias (nome, descricao) VALUES ('Tênis', 'Sneakers e calçados exclusivos')");
    await db.run("INSERT INTO categorias (nome, descricao) VALUES ('Acessórios', 'Bonés, relógios e correntes')");
    await db.run("INSERT INTO categorias (nome, descricao) VALUES ('Conjuntos', 'Looks completos DripLab')");

    // Drop inicial
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
    await db.run(
      'INSERT INTO drops (name, starts_at, ends_at, item_limit, access_level, active) VALUES (?, ?, ?, ?, ?, ?)',
      ['Pink Rebellion', tomorrow, nextWeek, 50, 1, 1]
    );

    // Badges / Conquistas
    const badgeList = [
      ['Primeiro Login',     'Faça login pela primeira vez na plataforma.'],
      ['Primeira Compra',    'Realize sua primeira compra na DripLab.'],
      ['Votante',            'Vote em uma coleção pela primeira vez.'],
      ['Comentarista',       'Deixe um comentário em um produto.'],
      ['Colecionador',       'Compre 5 produtos diferentes.'],
      ['Nível 5',            'Alcance o nível 5 na plataforma.'],
      ['Drop Hunter',        'Participe de 3 drops limitados.'],
      ['DripLab OG',         'Esteja entre os 100 primeiros cadastrados.'],
    ];
    for (const [name, desc] of badgeList) {
      await db.run('INSERT INTO badges (name, description) VALUES (?, ?)', [name, desc]);
    }
    for (const [name, desc] of badgeList) {
      await db.run('INSERT INTO conquistas (nome, descricao, pontos_necessarios) VALUES (?, ?, ?)',
        [name, desc, 0]);
    }

    console.log('✓ Banco de dados populado com dados iniciais.');
  }

  await updateCatalog(db);
}

module.exports = {
  getConnection,
  query,
  initDatabase,
};
