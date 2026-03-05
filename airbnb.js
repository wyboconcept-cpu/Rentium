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
const fiscalArea = document.getElementById('fiscalArea');
const fiscalCompare = document.getElementById('fiscalCompare');
const proMetrics = document.getElementById('proMetrics');
const proArea = document.getElementById('proArea');
const lockNotice = document.getElementById('lockNotice');
const projectionBody = document.getElementById('projectionBody');
const openPricingBtn = document.getElementById('openPricingBtn');
const pricingModal = document.getElementById('pricingModal');
const closePricingBtn = document.getElementById('closePricingBtn');
const pricingStatus = document.getElementById('pricingStatus');

const dynamicPricingUplift = document.getElementById('dynamicPricingUplift');
const seasonalityIndex = document.getElementById('seasonalityIndex');
const cityTaxRate = document.getElementById('cityTaxRate');
const projectionYears = document.getElementById('projectionYears');
const annualRevenueGrowth = document.getElementById('annualRevenueGrowth');
const annualCostGrowth = document.getElementById('annualCostGrowth');

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
let currentUser = null;
let currentPlan = 'free';

init();

function init() {
  form.addEventListener('input', render);
  [dynamicPricingUplift, seasonalityIndex, cityTaxRate, projectionYears, annualRevenueGrowth, annualCostGrowth]
    .forEach((el) => el && el.addEventListener('input', render));
  registerBtn.addEventListener('click', registerAccount);
  loginBtn.addEventListener('click', loginAccount);
  logoutBtn.addEventListener('click', logoutAccount);
  if (openPricingBtn) openPricingBtn.addEventListener('click', openPricingModal);
  if (closePricingBtn) closePricingBtn.addEventListener('click', closePricingModal);
  if (pricingModal) pricingModal.addEventListener('click', onPricingModalClick);
  document.addEventListener('click', onPlanSelectClick);
  syncAuthState().finally(render);
}

function readInputs() {
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) data[k] = Number(v || 0);

  data.fiscalMode = normalizeFiscalMode(fd.get('fiscalMode'));
  data.occupancyRate = clamp(data.occupancyRate, 0, 100);
  data.openDays = clamp(data.openDays, 1, 365);
  data.socialTaxRate = clamp(data.socialTaxRate, 0, 30);
  data.marginalTaxRate = clamp(data.marginalTaxRate, 0, 45);
  data.lmpSocialRate = clamp(data.lmpSocialRate, 0, 60);
  data.corporateTaxRate = clamp(data.corporateTaxRate, 0, 40);
  return data;
}

function readProControls() {
  return {
    uplift: Number(dynamicPricingUplift?.value || 0) / 100,
    seasonality: clamp(Number(seasonalityIndex?.value || 1), 0.6, 1.4),
    cityTax: clamp(Number(cityTaxRate?.value || 0), 0, 20) / 100,
    years: clamp(Number(projectionYears?.value || 10), 3, 20),
    revenueGrowth: Number(annualRevenueGrowth?.value || 0) / 100,
    costGrowth: Number(annualCostGrowth?.value || 0) / 100
  };
}

function computeBaseAirbnb(data, mod = { uplift: 0, seasonality: 1, cityTax: 0 }) {
  const loanAmount = Math.max(data.purchasePrice - data.downPayment, 0);
  const schedule = generateLoanSchedule(loanAmount, data.interestRate, data.loanYears);
  const firstYear = schedule[0] || { payment: 0, interest: 0, balance: loanAmount };

  const monthlyPayment = firstYear.payment / 12;
  const annualLoanInsurance = loanAmount * (data.insuranceRate / 100);
  const debtAnnual = firstYear.payment + annualLoanInsurance;

  const nightsBooked = data.openDays * (data.occupancyRate / 100);
  const roomRevenueBase = nightsBooked * data.nightlyRate;
  const annualRoomRevenue = roomRevenueBase * (1 + mod.uplift) * mod.seasonality;
  const annualCleaningRevenue = data.turnoversPerMonth * 12 * data.cleaningFeeCharged;
  const grossRevenue = annualRoomRevenue + annualCleaningRevenue;

  const platformFees = grossRevenue * (data.platformFeeRate / 100);
  const conciergeFees = annualRoomRevenue * (data.conciergeRate / 100);
  const consumables = data.turnoversPerMonth * 12 * data.suppliesPerTurnover;
  const cityTaxAnnual = annualRoomRevenue * mod.cityTax;

  const operatingCashCosts = (data.fixedMonthlyCosts * 12)
    + consumables
    + data.propertyTax
    + data.annualInsuranceFixed
    + data.annualCfe
    + data.annualAccountingFees
    + data.annualDeductibleWorks
    + platformFees
    + conciergeFees
    + cityTaxAnnual;

  const annualNetBeforeTax = grossRevenue - operatingCashCosts - debtAnnual;
  const netMargin = grossRevenue > 0 ? (annualNetBeforeTax / grossRevenue) * 100 : 0;

  return {
    loanAmount,
    schedule,
    monthlyPayment,
    annualLoanInsurance,
    nightsBooked,
    annualRoomRevenue,
    annualCleaningRevenue,
    grossRevenue,
    platformFees,
    conciergeFees,
    consumables,
    cityTaxAnnual,
    operatingCashCosts,
    debtAnnual,
    annualInterest: firstYear.interest,
    annualNetBeforeTax,
    monthlyNetBeforeTax: annualNetBeforeTax / 12,
    netMargin
  };
}

function computeFiscalComparison(data, base, carryForwardReel = 0) {
  const taxRate = (data.marginalTaxRate + data.socialTaxRate) / 100;
  const lmpRate = (data.marginalTaxRate + data.lmpSocialRate) / 100;
  const corpRate = data.corporateTaxRate / 100;
  const amortization = data.annualBuildingAmortization + data.annualFurnitureAmortization;
  
  const lmnpMicroTaxable = Math.max(base.grossRevenue * 0.5, 0);
  const lmnpMicroTax = lmnpMicroTaxable * taxRate;
  const lmnpMicroNetAfterTax = base.annualNetBeforeTax - lmnpMicroTax;

  const lmnpReelRawTaxable = base.grossRevenue
    - base.operatingCashCosts
    - base.annualInterest
    - base.annualLoanInsurance
    - amortization;
  const lmnpReelAfterCarry = lmnpReelRawTaxable - carryForwardReel;
  const lmnpReelTaxable = Math.max(lmnpReelAfterCarry, 0);
  const lmnpReelCarryForwardNext = lmnpReelAfterCarry < 0 ? Math.abs(lmnpReelAfterCarry) : 0;
  const lmnpReelTax = lmnpReelTaxable * taxRate;
  const lmnpReelNetAfterTax = base.annualNetBeforeTax - lmnpReelTax;

  const lmpMicroTaxable = Math.max(base.grossRevenue * 0.5, 0);
  const lmpMicroTax = lmpMicroTaxable * lmpRate;
  const lmpMicroNetAfterTax = base.annualNetBeforeTax - lmpMicroTax;

  const lmpReelRawTaxable = base.grossRevenue
    - base.operatingCashCosts
    - base.annualInterest
    - base.annualLoanInsurance
    - amortization;
  const lmpReelTaxable = Math.max(lmpReelRawTaxable, 0);
  const lmpReelTax = lmpReelTaxable * lmpRate;
  const lmpReelNetAfterTax = base.annualNetBeforeTax - lmpReelTax;

  const sciIsRawTaxable = base.grossRevenue
    - base.operatingCashCosts
    - base.annualInterest
    - base.annualLoanInsurance
    - amortization;
  const sciIsTaxable = Math.max(sciIsRawTaxable, 0);
  const sciIsTax = sciIsTaxable * corpRate;
  const sciIsNetAfterTax = base.annualNetBeforeTax - sciIsTax;

  const regimes = {
    'lmnp-micro': { taxable: lmnpMicroTaxable, tax: lmnpMicroTax, netAfterTax: lmnpMicroNetAfterTax },
    'lmnp-reel': {
      taxable: lmnpReelTaxable,
      rawTaxable: lmnpReelRawTaxable,
      tax: lmnpReelTax,
      netAfterTax: lmnpReelNetAfterTax,
      carryForwardUsed: carryForwardReel,
      carryForwardNext: lmnpReelCarryForwardNext
    },
    'lmp-micro': { taxable: lmpMicroTaxable, tax: lmpMicroTax, netAfterTax: lmpMicroNetAfterTax },
    'lmp-reel': { taxable: lmpReelTaxable, rawTaxable: lmpReelRawTaxable, tax: lmpReelTax, netAfterTax: lmpReelNetAfterTax },
    'sci-is': { taxable: sciIsTaxable, rawTaxable: sciIsRawTaxable, tax: sciIsTax, netAfterTax: sciIsNetAfterTax }
  };

  const preferred = data.fiscalMode === 'auto'
    ? Object.entries(regimes).sort((a, b) => b[1].netAfterTax - a[1].netAfterTax)[0][0]
    : data.fiscalMode;

  const selectedTax = regimes[preferred].tax;
  const selectedNetAfterTax = regimes[preferred].netAfterTax;

  return {
    regimes,
    selectedMode: preferred,
    selectedTax,
    selectedNetAfterTax,
    carryForwardNext: lmnpReelCarryForwardNext
  };
}

function computeProjection(data, base, controls) {
  const rows = [];
  let carryForwardReel = 0;
  let cumulative = 0;

  for (let year = 1; year <= controls.years; year += 1) {
    const growthRevenueFactor = (1 + controls.revenueGrowth) ** (year - 1);
    const growthCostFactor = (1 + controls.costGrowth) ** (year - 1);
    const debt = base.schedule[year - 1]
      ? (base.schedule[year - 1].payment + base.annualLoanInsurance)
      : 0;
    const interest = base.schedule[year - 1] ? base.schedule[year - 1].interest : 0;

    const grossRevenue = (base.annualRoomRevenue + base.annualCleaningRevenue) * growthRevenueFactor;
    const operatingCashCosts = base.operatingCashCosts * growthCostFactor;
    const annualNetBeforeTax = grossRevenue - operatingCashCosts - debt;

    const yearBase = {
      ...base,
      grossRevenue,
      operatingCashCosts,
      annualInterest: interest,
      annualLoanInsurance: base.annualLoanInsurance,
      annualNetBeforeTax,
      annualRoomRevenue: base.annualRoomRevenue * growthRevenueFactor,
      annualCleaningRevenue: base.annualCleaningRevenue * growthRevenueFactor
    };
    const yearFiscal = computeFiscalComparison(data, yearBase, carryForwardReel);
    const selectedMode = yearFiscal.selectedMode;
    const selectedTax = yearFiscal.selectedTax;
    const selectedNetAfterTax = yearFiscal.selectedNetAfterTax;

    carryForwardReel = yearFiscal.carryForwardNext || 0;
    cumulative += selectedNetAfterTax;

    rows.push({
      year,
      grossRevenue,
      operatingCashCosts,
      selectedTax,
      selectedNetAfterTax,
      cumulative,
      selectedMode
    });
  }

  const stressOcc = computeBaseAirbnb({ ...data, occupancyRate: clamp(data.occupancyRate - 10, 0, 100) }, controls).monthlyNetBeforeTax;
  const stressAdr = computeBaseAirbnb({ ...data, nightlyRate: data.nightlyRate * 0.85 }, controls).monthlyNetBeforeTax;
  const score = computeProScore(rows[0]?.selectedNetAfterTax / 12 || 0, stressOcc, stressAdr);

  return {
    rows,
    totalAfterTax: rows.reduce((acc, r) => acc + r.selectedNetAfterTax, 0),
    score,
    stressOcc,
    stressAdr
  };
}

function computeProScore(monthlyNetAfterTax, stressOcc, stressAdr) {
  const base = monthlyNetAfterTax >= 500 ? 45 : (monthlyNetAfterTax >= 100 ? 34 : (monthlyNetAfterTax >= 0 ? 24 : 10));
  const occ = stressOcc >= 0 ? 30 : (stressOcc > -300 ? 18 : 7);
  const adr = stressAdr >= 0 ? 25 : (stressAdr > -300 ? 15 : 5);
  return clamp(base + occ + adr, 0, 100);
}

function render() {
  const data = readInputs();
  const controls = readProControls();
  const base = computeBaseAirbnb(data);
  const fiscal = computeFiscalComparison(data, base);

  const hasEssential = currentPlan === 'essential' || currentPlan === 'pro';
  const hasPro = currentPlan === 'pro';

  planState.textContent = `Plan actif: ${labelPlan(currentPlan)}`;
  lockNotice.textContent = hasEssential
    ? 'Version Airbnb active: base + fiscalite court terme debloquees.'
    : 'Cette variante Airbnb est reservee aux plans Essentiel et Pro. Passe sur un plan payant pour debloquer les resultats.';

  metrics.innerHTML = '';
  fiscalCompare.innerHTML = '';
  proMetrics.innerHTML = '';
  projectionBody.innerHTML = '';
  fiscalArea.hidden = true;
  proArea.hidden = true;

  if (!hasEssential) {
    renderMetric('Acces', 'Plan payant requis');
    return;
  }

  renderMetric('Revenus annuels Airbnb', formatCurrency(base.grossRevenue));
  renderMetric('Charges exploitation annuelles', formatCurrency(base.operatingCashCosts));
  renderMetric('Interets annuels (annee 1)', formatCurrency(base.annualInterest));
  renderMetric('Cashflow mensuel avant impot', formatCurrency(base.monthlyNetBeforeTax));
  renderMetric(`Net mensuel apres impot (${modeLabel(fiscal.selectedMode)})`, formatCurrency(fiscal.selectedNetAfterTax / 12));
  renderMetric('Marge avant impot', formatPercent(base.netMargin));
  renderMetric('Nuits louees / an', `${Math.round(base.nightsBooked)} nuits`);

  fiscalArea.hidden = false;
  ['lmnp-micro', 'lmnp-reel', 'lmp-micro', 'lmp-reel', 'sci-is'].forEach((key) => {
    const item = fiscal.regimes[key];
    if (!item) return;
    renderCompareCard(modeLabel(key), item.taxable, item.tax, item.netAfterTax, fiscal.selectedMode === key);
  });

  if (!hasPro) return;

  proArea.hidden = false;
  const baseWithProControls = computeBaseAirbnb(data, controls);
  const projection = computeProjection(data, baseWithProControls, controls);

  renderProMetric('CA ajuste annee 1', formatCurrency(baseWithProControls.grossRevenue));
  renderProMetric('Taxe de sejour estimee', formatCurrency(baseWithProControls.cityTaxAnnual));
  renderProMetric('Net mensuel apres impot (annee 1)', formatCurrency(projection.rows[0]?.selectedNetAfterTax / 12 || 0));
  renderProMetric('Stress occupation -10 pts', formatCurrency(projection.stressOcc));
  renderProMetric('Stress ADR -15%', formatCurrency(projection.stressAdr));
  renderProMetric('Airbnb Score Pro', `${Math.round(projection.score)}/100`);
  renderProMetric(`Cumul ${controls.years} ans apres impot`, formatCurrency(projection.totalAfterTax));

  projectionBody.innerHTML = projection.rows.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${formatCurrency(row.grossRevenue)}</td>
      <td>${formatCurrency(row.operatingCashCosts)}</td>
      <td>${formatCurrency(row.selectedTax)}</td>
      <td>${formatCurrency(row.selectedNetAfterTax)}</td>
      <td>${formatCurrency(row.cumulative)}</td>
    </tr>
  `).join('');
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

function renderCompareCard(title, taxable, tax, net, selected) {
  const item = document.createElement('article');
  item.className = 'metric';
  item.innerHTML = `
    <h4>${escapeHtml(title)}${selected ? ' (selectionne)' : ''}</h4>
    <p>${escapeHtml(formatCurrency(net / 12))} / mois net</p>
    <p class="status">Base imposable: ${escapeHtml(formatCurrency(taxable))} | Impot: ${escapeHtml(formatCurrency(tax))}</p>
  `;
  fiscalCompare.appendChild(item);
}

function generateLoanSchedule(loanAmount, annualRate, loanYears) {
  const months = Math.max(loanYears * 12, 0);
  if (!loanAmount || !months) return [];
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / months
    : (loanAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -months);

  let balance = loanAmount;
  const yearly = [];
  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance = Math.max(balance - principal, 0);
    const yearIndex = Math.ceil(month / 12) - 1;
    if (!yearly[yearIndex]) yearly[yearIndex] = { payment: 0, interest: 0, balance: 0 };
    yearly[yearIndex].payment += monthlyPayment;
    yearly[yearIndex].interest += interest;
    yearly[yearIndex].balance = balance;
  }
  return yearly;
}

async function registerAccount() {
  try {
    const payload = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      includeAuth: false,
      body: JSON.stringify({ email: authEmail.value.trim(), password: authPassword.value })
    });
    authToken = payload.token || '';
    currentUser = payload.user || null;
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    updateAuthUI();
    await syncPlan();
    setPricingStatus('');
    render();
  } catch (error) {
    authState.textContent = error.message || 'Erreur inscription';
    setPricingStatus(error.message || 'Erreur inscription');
  }
}

async function loginAccount() {
  try {
    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      includeAuth: false,
      body: JSON.stringify({ email: authEmail.value.trim(), password: authPassword.value })
    });
    authToken = payload.token || '';
    currentUser = payload.user || null;
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    updateAuthUI();
    await syncPlan();
    setPricingStatus('');
    render();
  } catch (error) {
    authState.textContent = error.message || 'Erreur connexion';
    setPricingStatus(error.message || 'Erreur connexion');
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
  setPricingStatus('');
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

function openPricingModal() {
  if (!pricingModal) return;
  pricingModal.hidden = false;
  setPricingStatus('');
}

function closePricingModal() {
  if (!pricingModal) return;
  pricingModal.hidden = true;
}

function onPricingModalClick(event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-close-pricing="true"]')) closePricingModal();
}

function onPlanSelectClick(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-select-plan]');
  if (!button) return;
  selectPlan(button.getAttribute('data-select-plan') || '');
}

async function selectPlan(plan) {
  if (!['free', 'essential', 'pro'].includes(plan)) return;

  if (plan === 'free') {
    setPricingStatus('Plan Gratuit conserve.');
    closePricingModal();
    return;
  }

  if (!authToken || !currentUser) {
    setPricingStatus('Connecte-toi (ou cree un compte) sur cette page puis reessaie.');
    return;
  }

  try {
    setPricingStatus('Redirection vers le paiement Stripe...');
    const payload = await apiFetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    if (payload?.url) {
      window.location.href = payload.url;
      return;
    }
    throw new Error('URL de paiement introuvable.');
  } catch (error) {
    setPricingStatus(error.message || 'Paiement indisponible.');
  }
}

function setPricingStatus(message) {
  if (!pricingStatus) return;
  pricingStatus.textContent = message || '';
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

function modeLabel(mode) {
  if (mode === 'lmnp-micro') return 'LMNP Micro-BIC';
  if (mode === 'lmnp-reel') return 'LMNP Reel';
  if (mode === 'lmp-micro') return 'LMP Micro-BIC';
  if (mode === 'lmp-reel') return 'LMP Reel';
  if (mode === 'sci-is') return 'Societe (IS)';
  return 'Regime';
}

function normalizeFiscalMode(mode) {
  const raw = String(mode || '').trim();
  const allowed = new Set(['auto', 'lmnp-micro', 'lmnp-reel', 'lmp-micro', 'lmp-reel', 'sci-is']);
  if (allowed.has(raw)) return raw;
  if (raw === 'micro-bic') return 'lmnp-micro';
  return 'auto';
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
