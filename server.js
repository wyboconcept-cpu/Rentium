import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4242);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PRICE_IDS = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL || '',
  pro: process.env.STRIPE_PRICE_PRO || ''
};

const DATA_DIR = path.join(process.cwd(), 'data');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

function readPlanStore() {
  try {
    const raw = fs.readFileSync(PLANS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writePlanStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PLANS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function getUserPlan(customerRef) {
  if (!customerRef) return 'free';
  const store = readPlanStore();
  return store[customerRef]?.plan || 'free';
}

function setUserPlan(customerRef, plan) {
  if (!customerRef) return;
  const store = readPlanStore();
  store[customerRef] = {
    plan,
    updatedAt: new Date().toISOString()
  };
  writePlanStore(store);
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
    const customerRef = session.client_reference_id || session.metadata?.customerRef;
    const plan = session.metadata?.plan;
    if (customerRef && ['essential', 'pro'].includes(plan)) {
      setUserPlan(customerRef, plan);
    }
  }

  return res.json({ received: true });
});

app.use(express.json());
app.use(express.static(process.cwd()));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, stripeConfigured: Boolean(stripe) });
});

app.get('/api/me/plan', (req, res) => {
  const customerRef = String(req.query.customerRef || '');
  const plan = getUserPlan(customerRef);
  res.json({ plan });
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe non configure' });

    const { plan, customerRef } = req.body || {};
    if (!['essential', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    if (!customerRef) {
      return res.status(400).json({ error: 'customerRef manquant' });
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return res.status(500).json({ error: `Price ID Stripe manquant pour ${plan}` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/index.html?checkout=success`,
      cancel_url: `${appUrl}/index.html?checkout=cancel`,
      client_reference_id: customerRef,
      metadata: { plan, customerRef }
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erreur checkout Stripe' });
  }
});

app.listen(port, () => {
  console.log(`Rentium server on ${appUrl}`);
  if (!stripeSecretKey) {
    console.warn('STRIPE_SECRET_KEY manquant: paiement desactive');
  }
});
