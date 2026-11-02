# DripLab — Plataforma de Streetwear

> **Projeto Integrador — Desenvolvimento de Sistemas (SENAI)**

Plataforma de e-commerce streetwear digital-first com drops limitados, votação de coleções, gamificação (pontos, badges, níveis) e comunidade.

## Publicação gratuita

O projeto está preparado para o [Render](https://render.com/) no plano Free por meio do arquivo [`render.yaml`](./render.yaml). O serviço executa a API Express e entrega o front-end no mesmo domínio.

### Deploy no Render

1. Crie um Web Service no Render conectado ao repositório `steffanycristina/driplab`.
2. Selecione **Node** e mantenha `Build Command` como `npm ci` e `Start Command` como `npm start`.
3. Configure `JWT_SECRET` com uma chave longa e aleatória. O `render.yaml` gera uma automaticamente quando o Blueprint é usado.
4. Faça o deploy e valide `https://SEU-SERVICO.onrender.com/api/health`.
5. Ative **Auto-Deploy: On Commit** nas configurações do serviço.

Depois disso, o fluxo para qualquer edição será:

```bash
git checkout main
git pull
# edite os arquivos
npm run check
git add .
git commit -m "feat: descreva a alteração"
git push origin main
```

O GitHub Actions executará a validação automaticamente. Se passar, o Render detectará o novo commit da `main`, executará `npm ci`, reiniciará o Node.js e publicará a versão atualizada. Não é necessário enviar arquivos manualmente ao Render nem colocar tokens no código.

O plano Free pode suspender o serviço após inatividade e o disco local do Render é efêmero. Portanto, o SQLite é adequado para demonstração e avaliação do projeto, mas os dados podem ser recriados após um novo deploy ou reinicialização. Para produção, substitua `SQLITE_DB_PATH` por um banco persistente (PostgreSQL ou MariaDB).

### Organização e versionamento

O repositório segue a separação exigida no briefing:

- `public/`: interface responsiva e assets.
- `src/`: API Express, autenticação e acesso ao banco.
- `database/`: schema SQL e modelagem física.
- `docs/`: contrato OpenAPI.
- `scripts/`: rotinas auxiliares.
- `work/`: materiais de referência do briefing e do design.

Fluxo sugerido:

```bash
git checkout -b feat/nome-da-tarefa
npm run check
git add .
git commit -m "feat: descreva a alteração"
git push -u origin feat/nome-da-tarefa
```

---

## 🚀 Como executar

### Pré-requisitos

- **Node.js** v18+ (recomendado v20)
- **npm** (vem junto com o Node.js)

### Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd ol

# 2. Instale as dependências
npm install

# 3. (Opcional) Copie o arquivo de ambiente
cp .env.example .env

# 4. Inicie o servidor
npm start
```

O servidor inicia em **http://localhost:3000**.

> **Não é necessário instalar nenhum banco de dados externo.**
> O SQLite é embutido no código — o arquivo `data/driplab.sqlite` é criado automaticamente na primeira execução, já com dados de exemplo.

### Modo desenvolvimento (auto-reload)

```bash
npm run dev
```

---

## 📂 Estrutura do Projeto

```
ol/
├── database/
│   └── schema.sql           # Script SQL para criação das tabelas (SQLite)
├── data/
│   └── driplab.sqlite        # Banco de dados (criado automaticamente)
├── docs/
│   └── openapi.yaml          # Documentação da API (Swagger/OpenAPI 3.0)
├── public/
│   ├── assets/               # Imagens dos produtos
│   ├── index.html            # HTML principal (SPA)
│   ├── styles.css            # Estilos globais
│   ├── community.css         # Estilos de drops e votação
│   └── app.js                # Front-end JavaScript (SPA client-side)
├── scripts/
│   └── init_sqlite.js        # Script auxiliar de inicialização do banco
├── src/
│   ├── db.js                 # Módulo de conexão SQLite (embutido)
│   └── server.js             # API Express + rotas + seed
├── work/
│   ├── brief/                # Briefing e capturas de tela do design
│   ├── assets_zip1/          # Fotos originais (1)
│   └── assets_zip2/          # Fotos originais (2)
├── .env.example              # Variáveis de ambiente de exemplo
├── .gitignore
├── package.json
└── README.md
```

---

## 🗄️ Banco de Dados

### Tecnologia

**SQLite** — banco de dados embutido que roda dentro do próprio código Node.js. Não requer instalação de servidor separado (diferente de MySQL, PostgreSQL ou MariaDB).

O arquivo do banco é gerado automaticamente em `data/driplab.sqlite` na primeira execução do servidor.

### Entidades (conforme diagrama ER do briefing)

| Tabela (EN)         | Tabela (PT-BR)          | Descrição                                 |
|---------------------|-------------------------|-------------------------------------------|
| `users`             | `usuarios`              | Cadastro de usuários                      |
| `categories`        | `categorias`            | Categorias de produtos                    |
| `products`          | `produtos`              | Catálogo de produtos                      |
| `product_sizes`     | `tamanhos_produtos`     | Tamanhos disponíveis por produto          |
| `drops`             | —                       | Lançamentos limitados                     |
| `orders`            | `pedidos`               | Pedidos dos usuários                      |
| `order_items`       | `itens_pedidos`         | Itens de cada pedido                      |
| `votes`             | `votos`                 | Votações em coleções                      |
| `comments`          | `comentarios`           | Comentários em produtos                   |
| `badges`            | `conquistas`            | Sistema de badges/conquistas              |
| `user_badges`       | `usuarios_conquistas`   | Badges conquistadas por cada usuário      |

### Diagrama ER

O diagrama entidade-relacionamento (conceitual e lógico) está nas imagens do briefing em `work/brief/`.

---

## 🔌 API RESTful

### Endpoints

| Método | Rota                          | Auth | Descrição                          |
|--------|-------------------------------|------|------------------------------------|
| GET    | `/api/health`                 | ✗    | Status do servidor                 |
| GET    | `/api/products`               | ✗    | Listar produtos (filtro por `?category=` ou `?search=`) |
| GET    | `/api/products/:id`           | ✗    | Detalhe de um produto              |
| GET    | `/api/products/:id/comments`  | ✗    | Listar comentários de um produto   |
| POST   | `/api/products/:id/comments`  | ✓    | Criar comentário                   |
| GET    | `/api/categories`             | ✗    | Listar categorias                  |
| GET    | `/api/drops`                  | ✗    | Listar drops                       |
| POST   | `/api/drops`                  | ✓    | Criar drop                         |
| PUT    | `/api/drops/:id`              | ✓    | Atualizar drop                     |
| DELETE | `/api/drops/:id`              | ✓    | Remover drop                       |
| POST   | `/api/auth/register`          | ✗    | Cadastrar usuário                  |
| POST   | `/api/auth/login`             | ✗    | Login (retorna JWT)                |
| GET    | `/api/orders`                 | ✓    | Listar pedidos do usuário          |
| POST   | `/api/orders`                 | ✓    | Criar pedido                       |
| GET    | `/api/votes`                  | ✗    | Listar votos                       |
| POST   | `/api/votes`                  | ✓    | Votar em coleção (+100 pontos)     |
| GET    | `/api/badges`                 | ✓    | Listar badges e pontos do usuário  |
| GET    | `/api/profile`                | ✓    | Perfil do usuário logado           |

### Autenticação

A API usa **JWT (JSON Web Token)**. Após o login, envie o token no header:

```
Authorization: Bearer <token>
```

### Documentação Swagger

O arquivo `docs/openapi.yaml` pode ser visualizado em ferramentas como [Swagger Editor](https://editor.swagger.io/) ou importado no Postman/Insomnia.

---

## 🎮 Funcionalidades

### Front-end
- ✅ Telas: Home, Sobre Nós, Catálogo por categoria, Detalhe do produto, Carrinho, Checkout, Confirmação, Login, Registro, Perfil
- ✅ Layout responsivo (desktop, tablet, mobile)
- ✅ Navegação SPA (Single Page Application)
- ✅ Busca de produtos
- ✅ Seleção de tamanhos
- ✅ Carrinho persistente (localStorage)
- ✅ Ícones sociais (Font Awesome): Facebook, Google, Instagram, Twitter

### Back-end
- ✅ API RESTful com Express.js
- ✅ CRUD completo para todas as entidades
- ✅ Autenticação JWT
- ✅ Hash de senhas (bcrypt)
- ✅ Validações de entrada

### Regras de negócio
- ✅ **Drops limitados** com contagem regressiva e limite de peças
- ✅ **Votação de coleções** com ganho de pontos
- ✅ **Gamificação**: pontos por votar (+100) e comentar (+50)
- ✅ **Badges/Conquistas**: 8 badges disponíveis
- ✅ **Níveis de acesso** por drop

### Banco de Dados
- ✅ SQLite embutido (sem dependência externa)
- ✅ Tabelas normalizadas com chaves primárias e estrangeiras
- ✅ Seed automático com dados iniciais (categorias, produtos, tamanhos, drop, badges)
- ✅ Dupla nomenclatura: EN (API) + PT-BR (diagrama ER do briefing)

---

## 🛠️ Tecnologias

| Camada       | Tecnologia                         |
|--------------|-------------------------------------|
| Front-end    | HTML5, CSS3, JavaScript (vanilla)   |
| Back-end     | Node.js, Express.js                 |
| Banco        | SQLite (embutido via `sqlite3`)     |
| Auth         | JWT (`jsonwebtoken`) + bcrypt       |
| Ícones       | Font Awesome 6                      |
| Fontes       | Google Fonts (DM Sans, Fredoka)     |

---

## 📝 Variáveis de Ambiente

| Variável          | Padrão                  | Descrição                          |
|-------------------|-------------------------|------------------------------------|
| `PORT`            | `3000`                  | Porta do servidor                  |
| `JWT_SECRET`      | `driplab-dev-secret`    | Chave secreta para assinar tokens  |
| `SQLITE_DB_PATH`  | `data/driplab.sqlite`   | Caminho do arquivo SQLite          |

---

## 👤 Autor

Projeto desenvolvido como trabalho integrador do curso de **Desenvolvimento de Sistemas** do **SENAI**.
