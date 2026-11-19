const clothingSizes = ['P', 'M', 'G', 'GG'];
const shoeSizes = ['38', '39', '40', '41', '42', '43'];
const oneSize = ['Único'];

const catalog = [
  {
    category: 'roupas',
    sizes: clothingSizes,
    products: [
      ['chaos-club', 'Camiseta DripLab x Chaos Club', 179.90, 'Camiseta preta com estampa rosa e branca do mascote DripLab.'],
      ['pink-rebellion', 'Camiseta DripLab x Pink Rebellion', 179.90, 'Camiseta preta com o logo branco em destaque.', true],
      ['toxic-era', 'Camiseta DripLab x Toxic Era', 179.90, 'Camiseta branca com estampa gráfica do mascote.'],
      ['no-signal', 'Bermuda DripLab x No Signal', 249.90, 'Bermuda preta com estampas rosa e branca nas pernas.', true],
      ['disturbia', 'Camiseta DripLab x Disturbia', 199.90, 'Camiseta preta com o logo DripLab no peito.'],
      ['midnight-club', 'Bermuda DripLab x Midnight Club', 199.90, 'Bermuda cargo preta com bolsos laterais e detalhes em rosa.'],
    ],
  },
  {
    category: 'tenis',
    sizes: shoeSizes,
    products: [
      ['pink-rush', 'Tênis DripLab Pink Rush', 349.90, 'Tênis de cano baixo branco com detalhes rosa.'],
      ['blackout', 'Tênis DripLab Blackout', 379.90, 'Tênis preto com solado preto e o mascote DripLab na lateral.', true],
      ['silverline', 'Tênis DripLab Silverline', 349.90, 'Tênis branco com acabamento prateado e logo lateral.'],
    ],
  },
  {
    category: 'acessorios',
    sizes: oneSize,
    products: [
      ['mini-hype-bag', 'DripLab Mini Hype Bag', 129.90, 'Bolsa transversal preta com alça e detalhe rosa.'],
      ['utility-sling', 'DripLab Utility Sling', 149.90, 'Bolsa tote preta com duas alças e estampa DripLab.'],
      ['essential-cuff', 'DripLab Essential Cuff', 89.90, 'Touca preta com barra dobrada, logo branco e coroa rosa.'],
      ['pink-venom-beanie', 'DripLab Pink Venom Beanie', 89.90, 'Touca rosa com etiqueta preta DripLab.'],
      ['rebel-knit', 'DripLab Rebel Knit', 169.90, 'Boné preto de aba curva com bordado DripLab.', true],
      ['shadow-touch', 'DripLab Shadow Touch', 129.90, 'Touca preta com barra dobrada e logo branco.'],
    ],
  },
  {
    category: 'imediato',
    sizes: clothingSizes,
    products: [
      ['rare-behavior', 'Moletom DripLab Rare Behavior', 229.90, 'Moletom preto de gola redonda, com logo no peito.'],
      ['villain-era', 'Touca DripLab Villain Era', 129.90, 'Touca preta com o mascote na barra dobrada.', false, oneSize],
      ['savage-theory', 'DripLab Savage Theory', 179.90, 'Camiseta preta com logo branco e estampa rosa em destaque.'],
    ],
  },
  {
    category: 'conjuntos',
    sizes: clothingSizes,
    products: [
      ['conjunto-moletom-calca', 'Conjunto DripLab Moletom + Calça', 399.90, 'Moletom preto com capuz e calça jogger preta com estampas DripLab.'],
    ],
  },
];

async function updateCatalog(db) {
  await db.exec('BEGIN IMMEDIATE');
  try {
    const columns = await db.all('PRAGMA table_info(products)');
    if (!columns.some((column) => column.name === 'limited_edition')) {
      await db.exec('ALTER TABLE products ADD COLUMN limited_edition INTEGER NOT NULL DEFAULT 0');
    }
    await db.run("INSERT OR IGNORE INTO categories (slug, name) VALUES ('imediato', 'Envio Imediato')");

    // Preserve os produtos antigos para os pedidos que ainda referenciam seus IDs.
    await db.run("UPDATE products SET active = 0 WHERE active = 1 AND image_url GLOB '/assets/WhatsApp Image 2026-10-26 at 7.58.* AM*.jpeg'");

    for (const group of catalog) {
      const category = await db.get('SELECT id FROM categories WHERE slug = ?', [group.category]);
      for (const [slug, name, price, description, limited = false, sizes = group.sizes] of group.products) {
        const image = `/assets/catalogo/${slug}.webp`;
        const existing = await db.get('SELECT id FROM products WHERE image_url = ?', [image]);
        if (existing) continue;
        const stockPerSize = 20;
        const product = await db.run(
          `INSERT INTO products (category_id, name, description, price, stock, image_url, limited_edition)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [category.id, name, description, price, sizes.length * stockPerSize, image, Number(limited)]
        );
        for (const size of sizes) {
          await db.run('INSERT INTO product_sizes (product_id, size, stock) VALUES (?, ?, ?)', [product.lastID, size, stockPerSize]);
        }
      }
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { updateCatalog };
