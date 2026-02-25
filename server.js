import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4242);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const adminApiKey = String(process.env.ADMIN_API_KEY || '').trim();
const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || 'wyboantoine@gmail.com');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PRICE_IDS = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL || '',
  pro: process.env.STRIPE_PRICE_PRO || ''
};

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USE_DATABASE = Boolean(DATABASE_URL);
const pool = USE_DATABASE
  ? new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSL_DISABLE === 'true' ? false : { rejectUnauthorized: false }
  })
  : null;

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readUsersFile() {
  return readJson(USERS_FILE, []);
}

function writeUsersFile(users) {
  writeJson(USERS_FILE, users);
}

function readSessionsFile() {
  const sessions = readJson(SESSIONS_FILE, []);
  const now = Date.now();
  const valid = sessions.filter((session) => session.expiresAt > now);
  if (valid.length !== sessions.length) writeJson(SESSIONS_FILE, valid);
  return valid;
}

function writeSessionsFile(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

async function initStorage() {
  if (!USE_DATABASE) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      scenarios JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    plan: row.plan || 'free',
    scenarios: Array.isArray(row.scenarios) ? row.scenarios : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function getUsersCount() {
  if (!USE_DATABASE) return readUsersFile().length;
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return result.rows[0]?.count || 0;
}

async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!USE_DATABASE) {
    return readUsersFile().find((user) => user.email === normalized) || null;
  }
  const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalized]);
  return rowToUser(result.rows[0]);
}

async function getUserById(userId) {
  if (!USE_DATABASE) {
    return readUsersFile().find((user) => user.id === userId) || null;
  }
  const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  return rowToUser(result.rows[0]);
}

async function createUser({ id, email, passwordSalt, passwordHash, plan = 'free', scenarios = [] }) {
  const normalized = normalizeEmail(email);
  if (!USE_DATABASE) {
    const users = readUsersFile();
    const now = new Date().toISOString();
    const user = { id, email: normalized, passwordSalt, passwordHash, plan, scenarios, createdAt: now, updatedAt: now };
    users.push(user);
    writeUsersFile(users);
    return user;
  }

  const result = await pool.query(
    `INSERT INTO users (id, email, password_salt, password_hash, plan, scenarios)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [id, normalized, passwordSalt, passwordHash, plan, JSON.stringify(scenarios)]
  );
  return rowToUser(result.rows[0]);
}

async function updateUser(userId, updater) {
  const current = await getUserById(userId);
  if (!current) return null;
  const next = updater(current);

  if (!USE_DATABASE) {
    const users = readUsersFile();
    const idx = users.findIndex((user) => user.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...next, updatedAt: new Date().toISOString() };
    writeUsersFile(users);
    return users[idx];
  }

  const result = await pool.query(
    `UPDATE users
       SET email = $2,
           password_salt = $3,
           password_hash = $4,
           plan = $5,
           scenarios = $6::jsonb,
           updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      userId,
      normalizeEmail(next.email),
      next.passwordSalt,
      next.passwordHash,
      next.plan || 'free',
      JSON.stringify(Array.isArray(next.scenarios) ? next.scenarios : [])
    ]
  );
  return rowToUser(result.rows[0]);
}

async function updateUserByEmail(email, updater) {
  const existing = await getUserByEmail(email);
  if (!existing) return null;
  return updateUser(existing.id, updater);
}

async function listUsers() {
  if (!USE_DATABASE) {
    return readUsersFile().map((user) => ({
      id: user.id,
      email: user.email,
      plan: user.plan || 'free',
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    }));
  }
  const result = await pool.query('SELECT id, email, plan, created_at, updated_at FROM users ORDER BY created_at ASC');
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    plan: row.plan || 'free',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  }));
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TTL_MS;

  if (!USE_DATABASE) {
    const sessions = readSessionsFile();
    sessions.push({ token, userId, createdAt, expiresAt });
    writeSessionsFile(sessions);
    return token;
  }

  await pool.query(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [token, userId, createdAt, expiresAt]
  );
  return token;
}

async function findSession(token) {
  if (!USE_DATABASE) {
    return readSessionsFile().find((session) => session.token === token) || null;
  }
  await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()]);
  const result = await pool.query('SELECT token, user_id, created_at, expires_at FROM sessions WHERE token = $1 LIMIT 1', [token]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at)
  };
}

async function removeSession(token) {
  if (!USE_DATABASE) {
    const sessions = readSessionsFile().filter((session) => session.token !== token);
    writeSessionsFile(sessions);
    return;
  }
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan || 'free',
    isAdmin: normalizeEmail(user.email) === adminEmail
  };
}

function sanitizeScenario(raw) {
  const id = String(raw?.id || crypto.randomUUID());
  const name = String(raw?.name || 'Scenario').slice(0, 120);
  const createdAt = raw?.createdAt && !Number.isNaN(Date.parse(raw.createdAt))
    ? raw.createdAt
    : new Date().toISOString();

  const entries = Object.entries(raw?.inputs || {}).slice(0, 80);
  const inputs = {};
  for (const [key, value] of entries) {
    const n = Number(value);
    if (Number.isFinite(n)) inputs[String(key)] = n;
  }

  return { id, name, createdAt, inputs };
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const authRequired = asyncHandler(async (req, res, next) => {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  const session = await findSession(token);
  if (!session) return res.status(401).json({ error: 'Session invalide' });

  const user = await getUserById(session.userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

  req.authToken = token;
  req.user = user;
  next();
});

const adminRequired = asyncHandler(async (req, res, next) => {
  if (normalizeEmail(req.user?.email) !== adminEmail) {
    return res.status(403).json({ error: 'Acces admin refuse' });
  }
  next();
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  if (!stripe || !webhookSecret) {
    return res.status(500).send('Stripe webhook non configure');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Signature manquante');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook invalide: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    const plan = session.metadata?.plan;

    if (userId && ['essential', 'pro'].includes(plan)) {
      await updateUser(userId, (user) => ({
        ...user,
        plan,
        updatedAt: new Date().toISOString()
      }));
    }
  }

  return res.json({ received: true });
}));

app.use(express.json());

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${appUrl}/sitemap.xml`
  ].join('\n'));
});

app.get('/sitemap.xml', (_req, res) => {
  const now = new Date().toISOString();
  const urls = [
    `${appUrl}/`,
    `${appUrl}/index.html`,
    `${appUrl}/payment.html`,
    `${appUrl}/simulateur-rentabilite-locative.html`,
    `${appUrl}/calcul-cashflow-immobilier.html`,
    `${appUrl}/lmnp-micro-bic-vs-reel.html`
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${now}</lastmod></url>`).join('\n')}
</urlset>`;

  res.type('application/xml').send(xml);
});

app.use(express.static(process.cwd()));

app.get('/api/health', asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripe),
    users: await getUsersCount(),
    storage: USE_DATABASE ? 'postgres' : 'file'
  });
}));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6+ caracteres)' });

  const existing = await getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email deja utilise' });

  const { salt, hash } = createPasswordHash(password);
  const user = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordSalt: salt,
    passwordHash: hash,
    plan: 'free',
    scenarios: []
  });

  const token = await createSession(user.id);
  return res.status(201).json({ token, user: publicUser(user) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = await getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const hash = hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = await createSession(user.id);
  return res.json({ token, user: publicUser(user) });
}));

app.post('/api/auth/check-email', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  const exists = Boolean(await getUserByEmail(email));
  return res.json({ exists });
}));

app.post('/api/auth/logout', authRequired, asyncHandler(async (req, res) => {
  await removeSession(req.authToken);
  res.json({ ok: true });
}));

app.get('/api/auth/me', authRequired, asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

// Legacy admin endpoint kept for manual scripts.
app.post('/api/admin/set-plan', asyncHandler(async (req, res) => {
  if (!adminApiKey) return res.status(503).json({ error: 'ADMIN_API_KEY manquant' });
  const provided = String(req.headers['x-admin-key'] || req.body?.adminKey || '').trim();
  if (!provided || provided !== adminApiKey) return res.status(401).json({ error: 'Acces refuse' });

  const email = normalizeEmail(req.body?.email);
  const plan = String(req.body?.plan || '').trim();
  if (!email) return res.status(400).json({ error: 'Email manquant' });
  if (!['free', 'essential', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });

  const updated = await updateUserByEmail(email, (user) => ({
    ...user,
    plan,
    updatedAt: new Date().toISOString()
  }));
  if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });

  return res.json({ ok: true, user: publicUser(updated) });
}));

app.get('/api/admin/users', authRequired, adminRequired, asyncHandler(async (_req, res) => {
  const users = await listUsers();
  return res.json({ users });
}));

app.put('/api/admin/users/:userId/plan', authRequired, adminRequired, asyncHandler(async (req, res) => {
  const userId = String(req.params.userId || '');
  const plan = String(req.body?.plan || '').trim();
  if (!userId) return res.status(400).json({ error: 'userId manquant' });
  if (!['free', 'essential', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });

  const updated = await updateUser(userId, (user) => ({
    ...user,
    plan,
    updatedAt: new Date().toISOString()
  }));
  if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json({ ok: true, user: publicUser(updated) });
}));

app.get('/api/me/plan', authRequired, asyncHandler(async (req, res) => {
  res.json({ plan: req.user.plan || 'free' });
}));

app.get('/api/me/scenarios', authRequired, asyncHandler(async (req, res) => {
  res.json({ scenarios: Array.isArray(req.user.scenarios) ? req.user.scenarios : [] });
}));

app.put('/api/me/scenarios', authRequired, asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body?.scenarios) ? req.body.scenarios : [];
  const scenarios = incoming.slice(0, 200).map(sanitizeScenario);

  const updated = await updateUser(req.user.id, (user) => ({
    ...user,
    scenarios,
    updatedAt: new Date().toISOString()
  }));

  if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json({ ok: true, scenarios: updated.scenarios });
}));

app.post('/api/create-checkout-session', authRequired, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe non configure' });

  const { plan } = req.body || {};
  if (!['essential', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });

  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.status(500).json({ error: `Price ID Stripe manquant pour ${plan}` });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/index.html?checkout=success`,
    cancel_url: `${appUrl}/index.html?checkout=cancel`,
    client_reference_id: req.user.id,
    customer_email: req.user.email,
    metadata: { plan, userId: req.user.id }
  });

  return res.json({ url: session.url });
}));

app.use((error, _req, res, _next) => {
  const message = error?.message || 'Erreur serveur';
  res.status(500).json({ error: message });
});

initStorage()
  .then(() => {
    app.listen(port, () => {
      console.log(`Rentium server on ${appUrl}`);
      console.log(`Storage mode: ${USE_DATABASE ? 'postgres' : 'file'}`);
      if (!stripeSecretKey) {
        console.warn('STRIPE_SECRET_KEY manquant: paiement desactive');
      }
    });
  })
  .catch((error) => {
    console.error('Storage initialization failed:', error);
    process.exit(1);
  });
