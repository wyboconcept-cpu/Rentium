const AUTH_TOKEN_KEY = 'rentium_auth_token_v1';

const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authState = document.getElementById('authState');
const planState = document.getElementById('planState');
const form = document.getElementById('airbnbForm');
const metrics = document.getElementById('metrics');
const proMetrics = document.getElementById('proMetrics');
const proArea = document.getElementById('proArea');
const lockNotice = document.getElementById('lockNotice');
const dynamicPricingUplift = document.getElementById('dynamicPricingUplift');
const seasonalityIndex = document.getElementById('seasonalityIndex');
const cityTaxRate = document.getElementById('cityTaxRate');

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
let currentUser = null;
let currentPlan = 'free';

init();

function init() {
  form.addEventListener('input', render);
  [dynamicPricingUplift, seasonalityIndex, cityTaxRate].forEach((el) => el && el.addEventListener('input', render));
  registerBtn.addEventListener('click', registerAccount);
  loginBtn.addEventListener('click', loginAccount);
  logoutBtn.addEventListener('click', logoutAccount);
  syncAuthState().finally(render);
}

function readInputs() {
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) data[k] = Number(v || 0);
  data.occupancyRate = clamp(data.occupancyRate, 0, 100);
  data.openDays = clamp(data.openDays, 1, 365);
  return data;
}

function computeAirbnb(data) {
  const loanAmount = Math.max(data.purchasePrice - data.downPayment, 0);
  const months = Math.max(data.loanYears * 12, 1);
  const monthlyRate = data.interestRate / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / months
    : (loanAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -months);

  const nightsBooked = data.openDays * (data.occupancyRate / 100);
  const annualRoomRevenue = nightsBooked * data.nightlyRate;
  const annualCleaningRevenue = data.turnoversPerMonth * 12 * data.cleaningFeeCharged;
  const grossRevenue = annualRoomRevenue + annualCleaningRevenue;

  const platformFees = grossRevenue * (data.platformFeeRate / 100);
  const conciergeFees = annualRoomRevenue * (data.conciergeRate / 100);
  const consumables = data.turnoversPerMonth * 12 * data.suppliesPerTurnover;
  const debtAnnual = monthlyPayment * 12 + ((loanAmount * data.insuranceRate / 100));
  const operatingCosts = (data.fixedMonthlyCosts * 12) + consumables + data.propertyTax + data.annualInsuranceFixed + platformFees + conciergeFees;
  const annualNet = grossRevenue - operatingCosts - debtAnnual;

  return {
    loanAmount,
    monthlyPayment,
    nightsBooked,
    annualRoomRevenue,
    annualCleaningRevenue,
    grossRevenue,
    platformFees,
    conciergeFees,
    operatingCosts,
    debtAnnual,
    annualNet,
    monthlyNet: annualNet / 12,
    netMargin: grossRevenue > 0 ? (annualNet / grossRevenue) * 100 : 0
  };
}

function computePro(base, data) {
  const uplift = Number(dynamicPricingUplift.value || 0) / 100;
  const season = Number(seasonalityIndex.value || 1);
  const cityTax = Number(cityTaxRate.value || 0) / 100;

  const adjustedRoomRevenue = base.annualRoomRevenue * (1 + uplift) * season;
  const adjustedGross = adjustedRoomRevenue + base.annualCleaningRevenue;
  const adjustedPlatform = adjustedGross * (data.platformFeeRate / 100);
  const adjustedConcierge = adjustedRoomRevenue * (data.conciergeRate / 100);
  const cityTaxAnnual = adjustedRoomRevenue * cityTax;
  const adjustedOperating = (data.fixedMonthlyCosts * 12)
    + (data.turnoversPerMonth * 12 * data.suppliesPerTurnover)
    + data.propertyTax
    + data.annualInsuranceFixed
    + adjustedPlatform
    + adjustedConcierge
    + cityTaxAnnual;

  const proAnnualNet = adjustedGross - adjustedOperating - base.debtAnnual;

  const stressOcc = computeAirbnb({ ...data, occupancyRate: clamp(data.occupancyRate - 10, 0, 100) }).monthlyNet;
  const stressAdr = computeAirbnb({ ...data, nightlyRate: data.nightlyRate * 0.85 }).monthlyNet;
  const score = computeProScore(proAnnualNet / 12, stressOcc, stressAdr);

  return {
    adjustedGross,
    cityTaxAnnual,
    proAnnualNet,
    proMonthlyNet: proAnnualNet / 12,
    stressOcc,
    stressAdr,
    score
  };
}

function computeProScore(monthlyNet, stressOcc, stressAdr) {
  const base = monthlyNet >= 400 ? 45 : (monthlyNet >= 0 ? 32 : 12);
  const occ = stressOcc >= 0 ? 30 : (stressOcc > -250 ? 18 : 6);
  const adr = stressAdr >= 0 ? 25 : (stressAdr > -250 ? 15 : 5);
  return clamp(base + occ + adr, 0, 100);
}

function render() {
  const data = readInputs();
  const base = computeAirbnb(data);
  const hasEssential = currentPlan === 'essential' || currentPlan === 'pro';
  const hasPro = currentPlan === 'pro';

  planState.textContent = `Plan actif: ${labelPlan(currentPlan)}`;
  lockNotice.textContent = hasEssential
    ? 'Version Airbnb active: calculs courte duree avec moteur dedie.'
    : 'Cette variante Airbnb est reservee aux plans Essentiel et Pro. Passe sur un plan payant pour debloquer les resultats.';

  metrics.innerHTML = '';
  if (!hasEssential) {
    metrics.innerHTML = `<article class="metric"><h4>Acces</h4><p>Plan payant requis</p></article>`;
    proArea.hidden = true;
    return;
  }

  renderMetric('Revenus annuels Airbnb', formatCurrency(base.grossRevenue));
  renderMetric('Charges exploitation annuelles', formatCurrency(base.operatingCosts));
  renderMetric('Service de la dette annuel', formatCurrency(base.debtAnnual));
  renderMetric('Cashflow net mensuel', formatCurrency(base.monthlyNet));
  renderMetric('Marge nette', formatPercent(base.netMargin));
  renderMetric('Nuits louees / an', `${Math.round(base.nightsBooked)} nuits`);

  proArea.hidden = !hasPro;
  if (!hasPro) return;

  const pro = computePro(base, data);
  proMetrics.innerHTML = '';
  renderProMetric('CA ajuste (pricing+saisonnalite)', formatCurrency(pro.adjustedGross));
  renderProMetric('Taxe de sejour estimee', formatCurrency(pro.cityTaxAnnual));
  renderProMetric('Cashflow net mensuel Pro', formatCurrency(pro.proMonthlyNet));
  renderProMetric('Stress test occupation -10 pts', formatCurrency(pro.stressOcc));
  renderProMetric('Stress test ADR -15%', formatCurrency(pro.stressAdr));
  renderProMetric('Airbnb Score Pro', `${Math.round(pro.score)}/100`);
}

function renderMetric(label, value) {
  const item = document.createElement('article');
  item.className = 'metric';
  item.innerHTML = `<h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p>`;
  metrics.appendChild(item);
}

function renderProMetric(label, value) {
  const item = document.createElement('article');
  item.className = 'metric';
  item.innerHTML = `<h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p>`;
  proMetrics.appendChild(item);
}

async function registerAccount() {
  try {
    const payload = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      includeAuth: false,
      body: JSON.stringify({
        email: authEmail.value.trim(),
        password: authPassword.value
      })
    });
    authToken = payload.token || '';
    currentUser = payload.user || null;
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    updateAuthUI();
    await syncPlan();
    render();
  } catch (error) {
    authState.textContent = error.message || 'Erreur inscription';
  }
}

async function loginAccount() {
  try {
    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      includeAuth: false,
      body: JSON.stringify({
        email: authEmail.value.trim(),
        password: authPassword.value
      })
    });
    authToken = payload.token || '';
    currentUser = payload.user || null;
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    updateAuthUI();
    await syncPlan();
    render();
  } catch (error) {
    authState.textContent = error.message || 'Erreur connexion';
  }
}

async function logoutAccount() {
  try {
    if (authToken) await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  authToken = '';
  currentUser = null;
  currentPlan = 'free';
  localStorage.removeItem(AUTH_TOKEN_KEY);
  updateAuthUI();
  render();
}

async function syncAuthState() {
  if (!authToken) {
    updateAuthUI();
    currentPlan = 'free';
    return;
  }
  try {
    const payload = await apiFetch('/api/auth/me', { method: 'GET' });
    currentUser = payload.user || null;
    await syncPlan();
  } catch {
    authToken = '';
    currentUser = null;
    currentPlan = 'free';
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  updateAuthUI();
}

async function syncPlan() {
  if (!authToken) {
    currentPlan = 'free';
    return;
  }
  try {
    const payload = await apiFetch('/api/me/plan', { method: 'GET' });
    currentPlan = ['free', 'essential', 'pro'].includes(payload?.plan) ? payload.plan : 'free';
  } catch {
    currentPlan = currentUser?.plan || 'free';
  }
}

function updateAuthUI() {
  const connected = Boolean(authToken && currentUser);
  authState.textContent = connected ? `Connecte: ${currentUser.email}` : 'Non connecte';
  loginBtn.hidden = connected;
  registerBtn.hidden = connected;
  logoutBtn.hidden = !connected;
  authEmail.disabled = connected;
  authPassword.disabled = connected;
}

async function apiFetch(url, options = {}) {
  const { includeAuth = true, headers = {}, ...rest } = options;
  const nextHeaders = { ...headers };
  if (includeAuth && authToken) nextHeaders.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { ...rest, headers: nextHeaders });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) throw new Error(payload?.error || text || 'Erreur API');
  return payload;
}

function labelPlan(plan) {
  if (plan === 'pro') return 'Pro';
  if (plan === 'essential') return 'Essentiel';
  return 'Gratuit';
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)} %`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
