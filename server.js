import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4242);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const adminApiKey = String(process.env.ADMIN_API_KEY || '').trim();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PRICE_IDS = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL || '',
  pro: process.env.STRIPE_PRICE_PRO || ''
};

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

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

function readUsers() {
  return readJson(USERS_FILE, []);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function readSessions() {
  const sessions = readJson(SESSIONS_FILE, []);
  const now = Date.now();
  const valid = sessions.filter((session) => session.expiresAt > now);
  if (valid.length !== sessions.length) writeJson(SESSIONS_FILE, valid);
  return valid;
}

function writeSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

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

function createSession(userId) {
  const sessions = readSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.push({
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  writeSessions(sessions);
  return token;
}

function removeSession(token) {
  const sessions = readSessions().filter((session) => session.token !== token);
  writeSessions(sessions);
}

function authRequired(req, res, next) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  const sessions = readSessions();
  const session = sessions.find((item) => item.token === token);
  if (!session) return res.status(401).json({ error: 'Session invalide' });

  const users = readUsers();
  const user = users.find((item) => item.id === session.userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

  req.authToken = token;
  req.user = user;
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan || 'free'
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

function updateUser(userId, updater) {
  const users = readUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index === -1) return null;
  users[index] = updater(users[index]);
  writeUsers(users);
  return users[index];
}

function updateUserByEmail(email, updater) {
  const normalized = normalizeEmail(email);
  const users = readUsers();
  const index = users.findIndex((item) => item.email === normalized);
  if (index === -1) return null;
  users[index] = updater(users[index]);
  writeUsers(users);
  return users[index];
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
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
      updateUser(userId, (user) => ({
        ...user,
        plan,
        updatedAt: new Date().toISOString()
      }));
    }
  }

  return res.json({ received: true });
});

app.use(express.json());
app.use(express.static(process.cwd()));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripe),
    users: readUsers().length
  });
});

app.post('/api/auth/register', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6+ caracteres)' });

  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'Email deja utilise' });
  }

  const { salt, hash } = createPasswordHash(password);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordSalt: salt,
    passwordHash: hash,
    plan: 'free',
    scenarios: [],
    createdAt: now,
    updatedAt: now
  };

  users.push(user);
  writeUsers(users);

  const token = createSession(user.id);
  return res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const users = readUsers();
  const user = users.find((item) => item.email === email);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const hash = hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = createSession(user.id);
  return res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  removeSession(req.authToken);
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/admin/set-plan', (req, res) => {
  if (!adminApiKey) return res.status(503).json({ error: 'ADMIN_API_KEY manquant' });
  const provided = String(req.headers['x-admin-key'] || req.body?.adminKey || '').trim();
  if (!provided || provided !== adminApiKey) return res.status(401).json({ error: 'Acces refuse' });

  const email = normalizeEmail(req.body?.email);
  const plan = String(req.body?.plan || '').trim();
  if (!email) return res.status(400).json({ error: 'Email manquant' });
  if (!['free', 'essential', 'pro'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });

  const updated = updateUserByEmail(email, (user) => ({
    ...user,
    plan,
    updatedAt: new Date().toISOString()
  }));
  if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });

  return res.json({ ok: true, user: publicUser(updated) });
});

app.get('/api/me/plan', authRequired, (req, res) => {
  res.json({ plan: req.user.plan || 'free' });
});

app.get('/api/me/scenarios', authRequired, (req, res) => {
  res.json({ scenarios: Array.isArray(req.user.scenarios) ? req.user.scenarios : [] });
});

app.put('/api/me/scenarios', authRequired, (req, res) => {
  const incoming = Array.isArray(req.body?.scenarios) ? req.body.scenarios : [];
  const scenarios = incoming.slice(0, 200).map(sanitizeScenario);

  const updated = updateUser(req.user.id, (user) => ({
    ...user,
    scenarios,
    updatedAt: new Date().toISOString()
  }));

  if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json({ ok: true, scenarios: updated.scenarios });
});

app.post('/api/create-checkout-session', authRequired, async (req, res) => {
  try {
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
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erreur checkout Stripe' });
  }
});

app.listen(port, () => {
  console.log(`Rentium server on ${appUrl}`);
  if (!stripeSecretKey) {
    console.warn('STRIPE_SECRET_KEY manquant: paiement desactive');
  }
});
