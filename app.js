
const form = document.getElementById('simulatorForm');
const metricsContainer = document.getElementById('metrics');
const metricTemplate = document.getElementById('metricTemplate');
const cashflowBanner = document.getElementById('cashflowBanner');
const errorBox = document.getElementById('errorBox');
const statusText = document.getElementById('statusText');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const saveScenarioBtn = document.getElementById('saveScenarioBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const prefillRatesBtn = document.getElementById('prefillRatesBtn');
const scenariosList = document.getElementById('scenariosList');
const compareBtn = document.getElementById('compareBtn');
const comparisonArea = document.getElementById('comparisonArea');
const planSelect = document.getElementById('planSelect');
const upgradeMessage = document.getElementById('upgradeMessage');
const upgradeCtaBtn = document.getElementById('upgradeCtaBtn');
const openPricingBtn = document.getElementById('openPricingBtn');
const pricingModal = document.getElementById('pricingModal');
const closePricingBtn = document.getElementById('closePricingBtn');
const planTagline = document.getElementById('planTagline');
const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authState = document.getElementById('authState');
const onboardingEmailInput = document.getElementById('onboardingEmail');
const onboardingPasswordInput = document.getElementById('onboardingPassword');
const onboardingLoginBtn = document.getElementById('onboardingLoginBtn');
const onboardingStatus = document.getElementById('onboardingStatus');
const adminCard = document.getElementById('adminCard');
const adminUsersBody = document.getElementById('adminUsersBody');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');

const proCard = document.getElementById('proCard');
const proPaneTax = document.getElementById('proPaneTax');
const proPaneProjection = document.getElementById('proPaneProjection');
const proPaneCompare = document.getElementById('proPaneCompare');
const proPaneChart = document.getElementById('proPaneChart');
const proPaneScore = document.getElementById('proPaneScore');
const proChart = document.getElementById('proChart');
const chartFocus = document.getElementById('chartFocus');
const chartSeriesToggles = [...document.querySelectorAll('.chart-series-toggle')];
const proPrintReport = document.getElementById('proPrintReport');

const taxMode = document.getElementById('taxMode');
const marginalTaxRate = document.getElementById('marginalTaxRate');
const socialTaxRate = document.getElementById('socialTaxRate');
const annualDepreciation = document.getElementById('annualDepreciation');
const projectionYears = document.getElementById('projectionYears');
const annualRentGrowth = document.getElementById('annualRentGrowth');
const annualChargeGrowth = document.getElementById('annualChargeGrowth');
const annualPropertyGrowth = document.getElementById('annualPropertyGrowth');
const exitCostRate = document.getElementById('exitCostRate');

const STORAGE_KEY = 'rentium_scenarios_v1';
const AUTH_TOKEN_KEY = 'rentium_auth_token_v1';
const UNKNOWN_FIELD_DEFAULTS = {
  vacancyRate: { value: 8, label: 'Vacance locative', unit: '%' },
  managementRate: { value: 7, label: 'Gestion locative', unit: '%' },
  monthlyCharges: { value: 110, label: 'Charges non recuperables', unit: 'EUR/mois' },
  propertyTax: { value: 1300, label: 'Taxe fonciere', unit: 'EUR/an' },
  annualMaintenance: { value: 1000, label: 'Entretien', unit: 'EUR/an' }
};
const metricConfig = [
  ['loanAmount', 'Emprunt estime'],
  ['monthlyPayment', 'Mensualite credit (hors assurance)'],
  ['monthlyInsurance', 'Assurance mensuelle'],
  ['annualCollectedRent', 'Loyer annuel encaisse'],
  ['annualCharges', 'Charges annuelles'],
  ['monthlyCashflow', 'Cashflow mensuel'],
  ['grossYield', 'Rendement brut'],
  ['netYield', 'Rendement net']
];

let lastProAnalysis = null;
let lastChartRows = [];
let chartHoverIndex = null;
let chartLayout = null;
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
let currentUser = null;
let scenariosCache = readLocalScenarios();
let adminUsersCache = [];
let lastInputMeta = { unknownFields: [], confidence: 'elevee', assumptionsText: '' };

bootstrap();

function bootstrap() {
  bindPlanSelectionButtons();
  init();
}

function bindPlanSelectionButtons() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-select-plan]');
    if (!button) return;
    selectPlanFromModal(button.dataset.selectPlan);
  });
}

function init() {
  const requiredElements = [
    form, prefillRatesBtn, copyLinkBtn, saveScenarioBtn, exportPdfBtn, compareBtn,
    upgradeCtaBtn, planSelect, scenariosList, comparisonArea, metricsContainer,
    metricTemplate, cashflowBanner, errorBox
  ];
  if (requiredElements.some((el) => !el)) {
    console.warn('Init partielle: certains elements UI sont manquants.');
    return;
  }

  hydrateFromQuery();
  handleCheckoutStatusFromQuery();

  form.addEventListener('input', computeAndRender);
  prefillRatesBtn.addEventListener('click', applyAverageRates2026);
  copyLinkBtn.addEventListener('click', copyShareLink);
  saveScenarioBtn.addEventListener('click', saveScenario);
  exportPdfBtn.addEventListener('click', exportPdf);
  compareBtn.addEventListener('click', renderComparison);
  upgradeCtaBtn.addEventListener('click', openPricingModal);
  if (openPricingBtn) openPricingBtn.addEventListener('click', openPricingModal);
  if (closePricingBtn) closePricingBtn.addEventListener('click', closePricingModal);
  if (pricingModal) pricingModal.addEventListener('click', onPricingModalClick);
  if (registerBtn) registerBtn.addEventListener('click', () => { registerAccount(false); });
  if (loginBtn) loginBtn.addEventListener('click', () => { loginAccount(false); });
  if (logoutBtn) logoutBtn.addEventListener('click', logoutAccount);
  if (onboardingLoginBtn) onboardingLoginBtn.addEventListener('click', loginAccountFromOnboarding);
  if (onboardingPasswordInput) {
    onboardingPasswordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loginAccountFromOnboarding();
      }
    });
  }
  if (refreshAdminBtn) refreshAdminBtn.addEventListener('click', loadAdminUsers);
  if (adminUsersBody) adminUsersBody.addEventListener('click', onAdminUsersTableClick);

  [
    taxMode, marginalTaxRate, socialTaxRate, annualDepreciation, projectionYears,
    annualRentGrowth, annualChargeGrowth, annualPropertyGrowth, exitCostRate
  ].forEach((el) => el && el.addEventListener('input', computeAndRender));

  planSelect.addEventListener('change', () => {
    updatePremiumState();
    computeAndRender();
  });

  document.querySelectorAll('.pro-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchProTab(tab.dataset.tab));
  });

  chartSeriesToggles.forEach((toggle) => {
    toggle.addEventListener('change', () => renderProChart(lastChartRows));
  });

  if (proChart) {
    proChart.addEventListener('mousemove', onChartHoverMove);
    proChart.addEventListener('mouseleave', onChartHoverLeave);
    window.addEventListener('resize', () => {
      if (isProPlan() && lastChartRows.length) renderProChart(lastChartRows);
    });
  }

  updatePremiumState();
  renderScenarios();
  computeAndRender();
  syncAuthState();
}

function readInputs() {
  const fd = new FormData(form);
  const data = {};
  for (const [key, value] of fd.entries()) data[key] = Number(value || 0);

  const unknownFields = [];
  Object.entries(UNKNOWN_FIELD_DEFAULTS).forEach(([field, cfg]) => {
    const checkbox = document.querySelector(`[data-unknown-field="${field}"]`);
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;
    data[field] = cfg.value;
    unknownFields.push(field);
  });

  data.vacancyRate = clamp(data.vacancyRate, 0, 50);
  data.managementRate = clamp(data.managementRate, 0, 20);

  const assumptionsText = unknownFields.length
    ? unknownFields.map((field) => {
      const cfg = UNKNOWN_FIELD_DEFAULTS[field];
      return `${cfg.label}: ${cfg.value} ${cfg.unit}`;
    }).join(' | ')
    : '';

  let confidence = 'elevee';
  if (unknownFields.length >= 3) confidence = 'faible';
  else if (unknownFields.length >= 1) confidence = 'moyenne';

  lastInputMeta = { unknownFields, assumptionsText, confidence };
  return data;
}

function readProSettings() {
  const tmiRaw = marginalTaxRate ? marginalTaxRate.value : 'unknown';
  return {
    taxMode: normalizeTaxMode(taxMode ? taxMode.value : 'lmnp-micro'),
    marginalTaxRate: tmiRaw === 'unknown' ? null : Number(tmiRaw),
    socialTaxRate: Number(socialTaxRate ? socialTaxRate.value : 17.2) || 0,
    annualDepreciation: Number(annualDepreciation ? annualDepreciation.value : 0) || 0,
    projectionYears: clamp(Number(projectionYears ? projectionYears.value : 20) || 20, 1, 35),
    annualRentGrowth: Number(annualRentGrowth ? annualRentGrowth.value : 0) || 0,
    annualChargeGrowth: Number(annualChargeGrowth ? annualChargeGrowth.value : 0) || 0,
    annualPropertyGrowth: Number(annualPropertyGrowth ? annualPropertyGrowth.value : 0) || 0,
    exitCostRate: clamp(Number(exitCostRate ? exitCostRate.value : 0) || 0, 0, 30)
  };
}

function computeResults(data) {
  const totalCost = data.purchasePrice + data.notaryFees + data.works;
  const loanAmount = Math.max(totalCost - data.downPayment, 0);
  const months = Math.max(data.loanYears * 12, 1);
  const monthlyRate = data.interestRate / 100 / 12;

  let monthlyPayment = 0;
  if (loanAmount > 0) {
    monthlyPayment = monthlyRate === 0
      ? loanAmount / months
      : (loanAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
  }

  const monthlyInsurance = (loanAmount * (data.insuranceRate / 100)) / 12;
  const annualCollectedRent = data.monthlyRent * 12 * (1 - data.vacancyRate / 100);
  const annualOperatingCharges = data.monthlyCharges * 12 + data.propertyTax + data.annualMaintenance + annualCollectedRent * (data.managementRate / 100);
  const annualInsurance = monthlyInsurance * 12;
  const annualCharges = annualOperatingCharges + annualInsurance;
  const annualDebtService = (monthlyPayment + monthlyInsurance) * 12;
  const annualCashflow = annualCollectedRent - annualOperatingCharges - annualDebtService;
  const monthlyCashflow = annualCashflow / 12;

  return {
    totalCost,
    loanAmount,
    monthlyPayment,
    monthlyInsurance,
    annualInsurance,
    annualCollectedRent,
    annualOperatingCharges,
    annualCharges,
    annualDebtService,
    annualCashflow,
    monthlyCashflow,
    grossYield: totalCost > 0 ? ((data.monthlyRent * 12) / totalCost) * 100 : 0,
    netYield: totalCost > 0 ? ((annualCollectedRent - annualCharges) / totalCost) * 100 : 0,
    noiAnnual: annualCollectedRent - annualOperatingCharges,
    dscr: annualDebtService > 0 ? (annualCollectedRent - annualOperatingCharges) / annualDebtService : 999,
    ltv: totalCost > 0 ? loanAmount / totalCost : 0,
    cashOnCash: data.downPayment > 0 ? (annualCashflow / data.downPayment) * 100 : null
  };
}

function computeAndRender() {
  const inputs = readInputs();
  const results = computeResults(inputs);
  const settings = readProSettings();

  let cashflowValue = results.monthlyCashflow;
  let cashflowAfterTax = false;
  if (isProPlan()) {
    const fiscal = computeFiscalAnalysis(inputs, results, settings);
    cashflowValue = fiscal.annualCashflowAfterTax / 12;
    cashflowAfterTax = true;
  }

  renderMetrics(results);
  renderCashflow(cashflowValue, cashflowAfterTax);
  renderUncertainty(computeUncertaintyRange(inputs, lastInputMeta), lastInputMeta);
  renderUpgradePrompt(results);

  if (isProPlan()) renderProAnalysis(inputs, results);
}

function renderMetrics(results) {
  metricsContainer.innerHTML = '';
  metricConfig.forEach(([key, label]) => {
    const node = metricTemplate.content.cloneNode(true);
    node.querySelector('h3').textContent = label;
    node.querySelector('p').textContent = key.includes('Yield') ? formatPercent(results[key]) : formatCurrency(results[key]);
    metricsContainer.appendChild(node);
  });
}

function renderCashflow(value, afterTax = false) {
  const positive = value >= 0;
  cashflowBanner.classList.toggle('positive', positive);
  cashflowBanner.classList.toggle('negative', !positive);
  const suffix = afterTax ? ' apres impot' : '';
  cashflowBanner.textContent = `${positive ? 'Cashflow positif' : 'Cashflow negatif'}${suffix}: ${formatCurrency(value)} / mois`;
}

function computeUncertaintyRange(data, meta = { unknownFields: [] }) {
  const unknownCount = Array.isArray(meta.unknownFields) ? meta.unknownFields.length : 0;
  const spread = 1 + (unknownCount * 0.25);

  const prudent = {
    ...data,
    monthlyRent: data.monthlyRent * (1 - (0.03 * spread)),
    vacancyRate: clamp(data.vacancyRate + (3 * spread), 0, 50),
    monthlyCharges: data.monthlyCharges * (1 + (0.1 * spread)),
    annualMaintenance: data.annualMaintenance * (1 + (0.15 * spread)),
    managementRate: clamp(data.managementRate + (1 * spread), 0, 20)
  };
  const optimistic = {
    ...data,
    monthlyRent: data.monthlyRent * (1 + (0.02 * spread)),
    vacancyRate: clamp(data.vacancyRate - (2 * spread), 0, 50),
    monthlyCharges: data.monthlyCharges * (1 - (0.05 * spread)),
    annualMaintenance: data.annualMaintenance * (1 - (0.1 * spread)),
    managementRate: clamp(data.managementRate - (1 * spread), 0, 20)
  };
  const a = computeResults(prudent);
  const b = computeResults(optimistic);
  return {
    minCashflow: Math.min(a.monthlyCashflow, b.monthlyCashflow),
    maxCashflow: Math.max(a.monthlyCashflow, b.monthlyCashflow),
    minNetYield: Math.min(a.netYield, b.netYield),
    maxNetYield: Math.max(a.netYield, b.netYield)
  };
}

function renderUncertainty(range, meta = { unknownFields: [], confidence: 'elevee', assumptionsText: '' }) {
  const assumptionsLine = meta.assumptionsText
    ? `<p><strong>Hypotheses auto:</strong> ${escapeHtml(meta.assumptionsText)}</p>`
    : '<p><strong>Hypotheses auto:</strong> aucune (toutes les donnees sont renseignees).</p>';

  errorBox.innerHTML = `
    <h3>Marge d'erreur estimee</h3>
    <p>Fourchette selon hypotheses prudentes/optimistes sur loyer, vacance, charges, entretien et gestion.</p>
    <p><strong>Niveau de confiance:</strong> ${escapeHtml(meta.confidence)}</p>
    ${assumptionsLine}
    <p>Cashflow mensuel probable: <strong>${formatCurrency(range.minCashflow)}</strong> a <strong>${formatCurrency(range.maxCashflow)}</strong></p>
    <p>Rendement net probable: <strong>${formatPercent(range.minNetYield)}</strong> a <strong>${formatPercent(range.maxNetYield)}</strong></p>
  `;
}

function applyAverageRates2026() {
  form.elements.namedItem('interestRate').value = 3.1;
  form.elements.namedItem('insuranceRate').value = 0.34;
  computeAndRender();
  setStatus('Taux moyens 2026 appliques: credit 3.10% et assurance 0.34% (modifiables).');
}

function renderUpgradePrompt(results) {
  if (planSelect.value === 'free') {
    upgradeMessage.textContent = `Passe en Essentiel pour sauvegarder, comparer et exporter. Une variation de ${formatCurrency(Math.abs(results.monthlyCashflow))} de cashflow mensuel peut changer ta decision.`;
    upgradeCtaBtn.textContent = 'Passer a Essentiel (29 EUR)';
    upgradeCtaBtn.disabled = false;
  } else if (planSelect.value === 'essential') {
    upgradeMessage.textContent = 'Passe en Pro pour obtenir scoring, recommandations actionnables, projection avancee et graphique complet des flux pour optimiser ton investissement.';
    upgradeCtaBtn.textContent = 'Passer a Pro (59 EUR)';
    upgradeCtaBtn.disabled = false;
  } else {
    upgradeMessage.textContent = 'Plan Pro actif: utilise les recommendations pour optimiser le score et le cashflow.';
    upgradeCtaBtn.textContent = 'Plan Pro actif';
    upgradeCtaBtn.disabled = true;
  }
}
function renderProAnalysis(inputs, results) {
  const settings = readProSettings();
  const fiscal = computeFiscalAnalysis(inputs, results, settings);
  const projection = computeProjection(inputs, results, settings);
  const score = computeScore(inputs, results, settings, fiscal);
  const recommendations = generateRecommendations(inputs, settings, results, score);

  lastProAnalysis = { inputs, results, settings, fiscal, projection, score, recommendations };

  renderProTax(fiscal, results);
  renderProProjection(projection);
  renderProCompare(settings, inputs);
  renderProChart(projection.rows);
  renderProScore(score, recommendations, results);
}

function computeFiscalAnalysis(inputs, results, settings) {
  const hasTaxProfile = settings.marginalTaxRate !== null;
  const taxRate = hasTaxProfile ? (settings.marginalTaxRate + settings.socialTaxRate) / 100 : 0;
  const schedule = generateLoanSchedule(results.loanAmount, inputs.interestRate, inputs.loanYears, results.monthlyPayment);
  const interestYear1 = schedule.length ? schedule[0].interest : 0;

  const taxableLmnpMicro = Math.max(results.annualCollectedRent * 0.5, 0);
  const taxableLmnpReal = Math.max(
    results.annualCollectedRent - results.annualOperatingCharges - interestYear1 - settings.annualDepreciation,
    0
  );
  const taxableNueMicroFoncier = Math.max(results.annualCollectedRent * 0.7, 0);
  const taxableNueReelFoncier = Math.max(results.annualCollectedRent - results.annualOperatingCharges - interestYear1, 0);

  const taxableByMode = {
    'lmnp-micro': taxableLmnpMicro,
    'lmnp-real': taxableLmnpReal,
    'nue-micro-foncier': taxableNueMicroFoncier,
    'nue-reel-foncier': taxableNueReelFoncier
  };

  const mode = normalizeTaxMode(settings.taxMode);
  let selectedTaxableBase = taxableByMode[mode] ?? taxableLmnpMicro;
  let selectedTax = selectedTaxableBase * taxRate;
  if (!hasTaxProfile) selectedTax = 0;

  return {
    mode,
    taxRate,
    hasTaxProfile,
    taxableLmnpMicro,
    taxableLmnpReal,
    taxableNueMicroFoncier,
    taxableNueReelFoncier,
    selectedTax,
    selectedTaxableBase,
    annualCashflowAfterTax: results.annualCashflow - selectedTax
  };
}

function computeProjection(inputs, results, settings) {
  const years = settings.projectionYears;
  const rentGrowth = settings.annualRentGrowth / 100;
  const chargeGrowth = settings.annualChargeGrowth / 100;
  const propertyGrowth = settings.annualPropertyGrowth / 100;
  const saleCost = settings.exitCostRate / 100;

  const taxRate = settings.marginalTaxRate === null ? 0 : (settings.marginalTaxRate + settings.socialTaxRate) / 100;
  const schedule = generateLoanSchedule(results.loanAmount, inputs.interestRate, inputs.loanYears, results.monthlyPayment);

  let cumulativeCashflow = 0;
  const rows = [];

  for (let year = 1; year <= years; year += 1) {
    const rent = results.annualCollectedRent * (1 + rentGrowth) ** (year - 1);
    const charges = results.annualOperatingCharges * (1 + chargeGrowth) ** (year - 1);
    const payment = year <= schedule.length ? schedule[year - 1].payment : 0;
    const interest = year <= schedule.length ? schedule[year - 1].interest : 0;
    const remainingBalance = year <= schedule.length ? schedule[year - 1].balance : 0;
    const credit = payment + results.annualInsurance;

    const mode = normalizeTaxMode(settings.taxMode);
    let taxable = Math.max(rent * 0.5, 0); // LMNP micro-BIC
    if (mode === 'lmnp-real') taxable = Math.max(rent - charges - interest - settings.annualDepreciation, 0);
    if (mode === 'nue-micro-foncier') taxable = Math.max(rent * 0.7, 0);
    if (mode === 'nue-reel-foncier') taxable = Math.max(rent - charges - interest, 0);

    const tax = taxable * taxRate;
    const cashflowAfterTax = rent - charges - credit - tax;
    cumulativeCashflow += cashflowAfterTax;

    const propertyValue = results.totalCost * (1 + propertyGrowth) ** year;
    const netSaleValue = propertyValue * (1 - saleCost) - remainingBalance;

    rows.push({
      year,
      rent,
      charges,
      credit,
      tax,
      cashflowAfterTax,
      cumulativeCashflow,
      remainingBalance,
      netSaleValue,
      totalWithExit: cumulativeCashflow + netSaleValue
    });
  }

  const last = rows[rows.length - 1];
  return {
    rows,
    totalCashflow: last ? last.cumulativeCashflow : 0,
    totalWithExit: last ? last.totalWithExit : 0,
    horizon: years
  };
}

function computeScore(inputs, results, settings, fiscal) {
  const cashflowPts = mapCashflowPoints(results.monthlyCashflow, inputs.monthlyRent);
  const yieldPts = mapYieldPoints(results.netYield);
  const debtPts = mapDebtPoints(results.dscr, results.ltv);
  const stress = mapStressPoints(inputs);
  const costPts = mapCostPoints(results.annualOperatingCharges, results.annualCollectedRent);
  const taxPts = mapTaxPoints(results, fiscal, settings);

  const total = clamp(cashflowPts + yieldPts + debtPts + stress.total + costPts + taxPts, 0, 100);
  return {
    cashflowPts,
    yieldPts,
    debtPts,
    stressPts: stress.total,
    stressA: stress.a,
    stressB: stress.b,
    costPts,
    taxPts,
    total,
    label: scoreLabel(total)
  };
}

function mapCashflowPoints(cfm, rentMonthly) {
  let pts = 2;
  if (cfm >= 200) pts = 30;
  else if (cfm >= 100) pts = 26;
  else if (cfm >= 0) pts = 22;
  else if (cfm >= -99) pts = 14;
  else if (cfm >= -199) pts = 8;
  if (rentMonthly > 0 && (cfm / rentMonthly) >= 0.1) pts += 2;
  return clamp(pts, 0, 30);
}

function mapYieldPoints(rn) {
  if (rn >= 7) return 20;
  if (rn >= 6) return 17;
  if (rn >= 5) return 14;
  if (rn >= 4) return 10;
  if (rn >= 3) return 6;
  return 2;
}

function mapDebtPoints(dscr, ltv) {
  let a = 1;
  if (dscr >= 1.4) a = 14;
  else if (dscr >= 1.25) a = 12;
  else if (dscr >= 1.1) a = 9;
  else if (dscr >= 1.0) a = 6;

  const ltvPct = ltv * 100;
  let b = 0;
  if (ltvPct <= 60) b = 6;
  else if (ltvPct <= 70) b = 5;
  else if (ltvPct <= 80) b = 4;
  else if (ltvPct <= 90) b = 2;

  return clamp(a + b, 0, 20);
}

function mapStressPoints(inputs) {
  const cfa = computeResults({ ...inputs, vacancyRate: clamp(inputs.vacancyRate + 5, 0, 50) }).monthlyCashflow;
  const cfb = computeResults({ ...inputs, interestRate: inputs.interestRate + 1 }).monthlyCashflow;
  const pts = (v) => (v >= 0 ? 7.5 : (v <= -200 ? 0 : ((v + 200) / 200) * 7.5));
  return { a: cfa, b: cfb, total: pts(cfa) + pts(cfb) };
}

function mapCostPoints(charges, rent) {
  if (rent <= 0) return 1;
  const ratio = (charges / rent) * 100;
  if (ratio <= 20) return 10;
  if (ratio <= 30) return 8;
  if (ratio <= 40) return 6;
  if (ratio <= 50) return 3;
  return 1;
}

function mapTaxPoints(results, fiscal, settings) {
  if (settings.marginalTaxRate === null) return 3;
  return (fiscal.annualCashflowAfterTax / 12) >= (results.monthlyCashflow - 20) ? 5 : 2;
}

function scoreLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Bon';
  if (score >= 55) return 'Moyen';
  if (score >= 40) return 'Fragile';
  return 'Risque eleve';
}
function generateRecommendations(inputs, settings, baseResults, baseScore) {
  const recos = [];

  const addReco = (id, title, effort, assumptions, targetValue, nextInput, nextSettings = settings) => {
    const r = computeResults(nextInput);
    const f = computeFiscalAnalysis(nextInput, r, nextSettings);
    const s = computeScore(nextInput, r, nextSettings, f);
    recos.push({
      id,
      title,
      effort,
      assumptions,
      targetValue,
      deltaCashflowMonthly: r.monthlyCashflow - baseResults.monthlyCashflow,
      deltaScore: s.total - baseScore.total,
      message: `${title} -> ${formatSignedCurrency(r.monthlyCashflow - baseResults.monthlyCashflow)} / mois, ${formatSignedNumber(s.total - baseScore.total)} pts`
    });
  };

  [1, 3, 5].forEach((pct) => {
    const newPrice = inputs.purchasePrice * (1 - pct / 100);
    const newNotary = inputs.purchasePrice > 0 ? inputs.notaryFees * (newPrice / inputs.purchasePrice) : inputs.notaryFees;
    addReco(`price-${pct}`, `Negocier le prix (-${pct}%)`, 'Med', 'Nouveau prix + notaire proportionnel', formatCurrency(newPrice), { ...inputs, purchasePrice: newPrice, notaryFees: newNotary });
  });

  [25, 50, 75].forEach((delta) => {
    const cap = inputs.monthlyRent * 1.1;
    const next = Math.min(cap, inputs.monthlyRent + delta);
    if (next > inputs.monthlyRent) addReco(`rent-${delta}`, `Augmenter le loyer (+${Math.round(next - inputs.monthlyRent)} EUR)`, 'Med', 'Cap +10%', formatCurrency(next), { ...inputs, monthlyRent: next });
  });

  [2, 5].forEach((v) => {
    const next = clamp(inputs.vacancyRate - v, 0, 50);
    if (next < inputs.vacancyRate) addReco(`vac-${v}`, `Reduire la vacance (-${v} pts)`, 'Med', 'Optimisation remplissage', `${next.toFixed(1)} %`, { ...inputs, vacancyRate: next });
  });

  [0.25, 0.5].forEach((v) => {
    if (inputs.interestRate > 0) {
      const next = Math.max(inputs.interestRate - v, 0);
      addReco(`rate-${v}`, `Optimiser le taux (-${v.toFixed(2)} pt)`, 'Med', 'Renegociation/courtier', `${next.toFixed(2)} %`, { ...inputs, interestRate: next });
    }
  });

  [2, 5].forEach((v) => {
    const next = clamp(inputs.loanYears + v, 1, 35);
    addReco(`dur-${v}`, `Allonger la duree (+${v} ans)`, 'Low', 'Attention au cout total du credit', `${next} ans`, { ...inputs, loanYears: next });
  });

  [5000, 10000, 20000].forEach((v) => {
    addReco(`apport-${v}`, `Augmenter l'apport (+${formatCurrency(v)})`, 'High', 'Mobilisation de tresorerie', formatCurrency(inputs.downPayment + v), { ...inputs, downPayment: inputs.downPayment + v });
  });

  [10, 20].forEach((v) => {
    const next = inputs.monthlyCharges * (1 - v / 100);
    addReco(`charges-${v}`, `Reduire charges non recuperables (-${v}%)`, 'Med', 'Optimisation exploitation', formatCurrency(next), { ...inputs, monthlyCharges: next });
  });

  if (inputs.managementRate > 0) {
    addReco('gestion-2', 'Reduire la gestion (-2 pts)', 'Med', 'Renegociation mandat', `${Math.max(inputs.managementRate - 2, 0).toFixed(1)} %`, { ...inputs, managementRate: Math.max(inputs.managementRate - 2, 0) });
    addReco('autogestion', 'Passer en autogestion', 'High', 'Temps de gestion supplementaire', '0 %', { ...inputs, managementRate: 0 });
  }

  const normalizedMode = normalizeTaxMode(settings.taxMode);
  if (normalizedMode === 'lmnp-micro') {
    addReco('tax-lmnp-real', 'Basculer LMNP Micro-BIC -> LMNP Reel', 'Med', 'Si amortissement pertinent', 'LMNP Reel', { ...inputs }, { ...settings, taxMode: 'lmnp-real' });
  }
  if (normalizedMode === 'nue-micro-foncier') {
    addReco('tax-nue-reel', 'Basculer Micro-foncier -> Reel foncier', 'Med', 'Si charges et interets eleves', 'Reel foncier', { ...inputs }, { ...settings, taxMode: 'nue-reel-foncier' });
  }

  if (baseResults.monthlyCashflow < 0) {
    const rentReco = buildNeutralCashflowRentReco(inputs, baseResults.monthlyCashflow);
    if (rentReco) recos.push(rentReco);
    const priceReco = buildNeutralCashflowPriceReco(inputs);
    if (priceReco) recos.push(priceReco);
  }

  return recos.sort((a, b) => (b.deltaScore - a.deltaScore) || (b.deltaCashflowMonthly - a.deltaCashflowMonthly)).slice(0, 8);
}

function buildNeutralCashflowRentReco(inputs, cashflow) {
  const effective = (1 - inputs.vacancyRate / 100) * (1 - inputs.managementRate / 100);
  if (effective <= 0.05) return null;
  const target = inputs.monthlyRent + (-cashflow / effective);
  if (!Number.isFinite(target) || target <= inputs.monthlyRent) return null;
  return {
    id: 'neutral-rent',
    title: 'Objectif cashflow neutre via loyer',
    effort: 'High',
    assumptions: 'Approximation vacance + gestion',
    targetValue: formatCurrency(target),
    deltaCashflowMonthly: -cashflow,
    deltaScore: 0,
    message: `Loyer cible estime: ${formatCurrency(target)} / mois.`
  };
}

function buildNeutralCashflowPriceReco(inputs) {
  if (inputs.purchasePrice <= 0) return null;
  const notaryRatio = inputs.purchasePrice > 0 ? inputs.notaryFees / inputs.purchasePrice : 0;
  const cf = (price) => computeResults({ ...inputs, purchasePrice: price, notaryFees: price * notaryRatio }).monthlyCashflow;

  let low = inputs.purchasePrice * 0.5;
  let high = inputs.purchasePrice;
  if (cf(low) < 0) return null;

  for (let i = 0; i < 32; i += 1) {
    const mid = (low + high) / 2;
    if (cf(mid) >= 0) low = mid;
    else high = mid;
  }

  const targetPrice = Math.round(low);
  if (targetPrice >= inputs.purchasePrice) return null;

  return {
    id: 'neutral-price',
    title: 'Objectif cashflow neutre via prix',
    effort: 'High',
    assumptions: 'Recherche dichotomique',
    targetValue: formatCurrency(targetPrice),
    deltaCashflowMonthly: 0,
    deltaScore: 0,
    message: `Prix cible estime: ${formatCurrency(targetPrice)}.`
  };
}

function renderProTax(fiscal, results) {
  const modeLabel = getTaxModeLabel(fiscal.mode);
  proPaneTax.innerHTML = `
    <div class="pro-metrics">
      <article><h3>Regime fiscal</h3><p>${escapeHtml(modeLabel)}</p></article>
      <article><h3>NOI annuel</h3><p>${formatCurrency(results.noiAnnual)}</p></article>
      <article><h3>Debt Service annuel</h3><p>${formatCurrency(results.annualDebtService)}</p></article>
      <article><h3>DSCR</h3><p>${results.dscr.toFixed(2)}</p></article>
      <article><h3>LTV</h3><p>${formatPercent(results.ltv * 100)}</p></article>
      <article><h3>Cash-on-cash</h3><p>${results.cashOnCash === null ? 'N/A' : formatPercent(results.cashOnCash)}</p></article>
      <article><h3>Base imposable estimee</h3><p>${formatCurrency(fiscal.selectedTaxableBase)}</p></article>
      <article><h3>Impot annuel estime</h3><p>${formatCurrency(fiscal.selectedTax)}</p></article>
      <article><h3>Cashflow annuel apres impot</h3><p>${formatCurrency(fiscal.annualCashflowAfterTax)}</p></article>
    </div>
  `;
}

function renderProProjection(projection) {
  const rows = projection.rows.slice(0, 8).map((row) => `
    <tr><td>Annee ${row.year}</td><td>${formatCurrency(row.cashflowAfterTax)}</td><td>${formatCurrency(row.cumulativeCashflow)}</td><td>${formatCurrency(row.netSaleValue)}</td><td>${formatCurrency(row.totalWithExit)}</td></tr>
  `).join('');

  proPaneProjection.innerHTML = `
    <div class="pro-summary-grid">
      <article><h3>Horizon</h3><p>${projection.horizon} ans</p></article>
      <article><h3>Cumul cashflow apres impot</h3><p>${formatCurrency(projection.totalCashflow)}</p></article>
      <article><h3>Valeur totale avec sortie</h3><p>${formatCurrency(projection.totalWithExit)}</p></article>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Periode</th><th>Cashflow net</th><th>Cumul net</th><th>Valeur nette revente</th><th>Total theorique</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="pro-hint">Stress tests score: Vacance +5 pts et Taux +1.00 pt.</p>
    </div>
  `;
}

function buildProCompareRows(settings, currentInputs) {
  const checked = [...document.querySelectorAll('.compare-check:checked')].map((el) => el.value);
  const saved = getScenarios().filter((s) => checked.includes(s.id));
  const compared = [{ name: 'Scenario actuel', inputs: currentInputs }, ...saved].slice(0, 3);
  if (compared.length < 2) return [];

  return compared.map((item) => {
    const r = computeResults(item.inputs);
    const f = computeFiscalAnalysis(item.inputs, r, settings);
    const p = computeProjection(item.inputs, r, { ...settings, projectionYears: Math.min(settings.projectionYears, 10) });
    return { name: item.name, monthlyCashflow: r.monthlyCashflow, netYield: r.netYield, annualTax: f.selectedTax, cashflow10y: p.totalCashflow };
  });
}

function renderProCompare(settings, currentInputs) {
  const rows = buildProCompareRows(settings, currentInputs);
  if (!rows.length) {
    proPaneCompare.innerHTML = '<p class="empty">Coche 1 a 2 scenarios dans la liste pour comparer avec le scenario actuel.</p>';
    return;
  }

  const best = [...rows].sort((a, b) => b.cashflow10y - a.cashflow10y)[0];
  proPaneCompare.innerHTML = `
    <p class="pro-hint">Meilleur scenario sur 10 ans: <strong>${escapeHtml(best.name)}</strong></p>
    <div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Cashflow mensuel</th><th>Rendement net</th><th>Impot annuel</th><th>Cumul 10 ans</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${formatCurrency(r.monthlyCashflow)}</td><td>${formatPercent(r.netYield)}</td><td>${formatCurrency(r.annualTax)}</td><td>${formatCurrency(r.cashflow10y)}</td></tr>`).join('')}
    </tbody></table></div>
  `;
}

function renderProScore(score, recommendations, results) {
  const lines = [
    ['Cashflow & resilience', score.cashflowPts, 30],
    ['Rendement & revenus', score.yieldPts, 20],
    ['Risque dette', score.debtPts, 20],
    ['Sensibilite', score.stressPts, 15],
    ['Efficience charges', score.costPts, 10],
    ['Coherence fiscale', score.taxPts, 5]
  ];

  const recos = recommendations.length
    ? recommendations.map((r, i) => `<article class="reco-item"><h4>${i + 1}. ${escapeHtml(r.title)} <span>${escapeHtml(r.effort)}</span></h4><p>${escapeHtml(r.message)}</p><p>Objectif: <strong>${escapeHtml(r.targetValue || '-')}</strong> | Delta score: <strong>${formatSignedNumber(r.deltaScore)} pts</strong> | Delta cashflow: <strong>${formatSignedCurrency(r.deltaCashflowMonthly)}</strong></p><p class="pro-hint">Hypothese: ${escapeHtml(r.assumptions || 'Simulation interne')}</p></article>`).join('')
    : '<p class="empty">Aucune recommandation differenciante.</p>';

  const diag = score.total >= 70 ? 'Ca respire' : (score.total >= 55 ? 'Profil limite' : 'Profil risque');

  proPaneScore.innerHTML = `
    <div class="score-head"><div class="score-circle">${Math.round(score.total)}<small>/100</small></div><div><h3>Rentium Score: ${score.label}</h3><p class="pro-hint">Diagnostic: ${diag}</p><p class="pro-hint">Cashflow: ${formatCurrency(results.monthlyCashflow)} / mois | DSCR: ${results.dscr.toFixed(2)} | LTV: ${formatPercent(results.ltv * 100)}</p></div></div>
    <div class="score-grid">${lines.map(([l, p, c]) => `<article><h4>${l}</h4><p>${Number(p).toFixed(1)} / ${c}</p></article>`).join('')}</div>
    <p class="pro-hint">Hypotheses stress tests: Vacance +5 pts, Taux +1.00 pt.</p>
    <div class="reco-list">${recos}</div>
  `;
}
function renderProChart(rows) {
  if (!proChart) return;
  lastChartRows = rows;

  const size = resizeChartCanvas();
  const ctx = proChart.getContext('2d');

  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = '#181511';
  ctx.fillRect(0, 0, size.width, size.height);

  if (!rows.length) {
    chartLayout = null;
    chartFocus.textContent = 'Survole le graphique pour voir le detail par annee.';
    return;
  }

  const padLeft = 62;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 36;

  const seriesDefs = [
    { id: 'annualNet', label: 'Cashflow net annuel', color: '#d6b37a', values: rows.map((r) => r.cashflowAfterTax) },
    { id: 'cumulativeNet', label: 'Cashflow net cumule', color: '#7bcf9a', values: rows.map((r) => r.cumulativeCashflow) },
    { id: 'netSaleValue', label: 'Valeur nette revente', color: '#8bb8ff', values: rows.map((r) => r.netSaleValue) },
    { id: 'totalWithExit', label: 'Total avec sortie', color: '#f08bb4', values: rows.map((r) => r.totalWithExit) }
  ];

  const checkedIds = new Set(chartSeriesToggles.filter((t) => t.checked).map((t) => t.value));
  let visible = seriesDefs.filter((s) => checkedIds.has(s.id));
  if (!visible.length) {
    visible = [seriesDefs[0]];
    const fallback = chartSeriesToggles.find((t) => t.value === 'annualNet');
    if (fallback) fallback.checked = true;
  }

  const all = [...visible.flatMap((s) => s.values), 0];
  const minY = Math.min(...all);
  const maxY = Math.max(...all);
  const rangeY = maxY - minY || 1;

  chartLayout = { width: size.width, height: size.height, padLeft, padRight, padTop, padBottom, minY, rangeY, count: rows.length };

  drawChartGrid(ctx, { w: size.width, h: size.height, padLeft, padRight, padTop, padBottom, minY, maxY });

  const zeroY = toY(0, size.height, padTop, padBottom, minY, rangeY);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(padLeft, zeroY);
  ctx.lineTo(size.width - padRight, zeroY);
  ctx.stroke();

  visible.forEach((s) => drawLine(ctx, rows, s.values, { ...chartLayout, color: s.color }));

  if (chartHoverIndex !== null && chartHoverIndex >= 0 && chartHoverIndex < rows.length) {
    const x = toX(chartHoverIndex, rows.length, size.width, padLeft, padRight);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, size.height - padBottom);
    ctx.stroke();
  }

  ctx.fillStyle = '#c9bda9';
  ctx.font = '12px Outfit';
  ctx.fillText('Annee 1', padLeft, size.height - 10);
  ctx.fillText(`Annee ${rows.length}`, size.width - 86, size.height - 10);

  if (chartHoverIndex === null || chartHoverIndex < 0 || chartHoverIndex >= rows.length) {
    chartFocus.textContent = `Series visibles: ${visible.map((s) => s.label).join(' | ')}. Survole le graphique pour lire les valeurs par annee.`;
  } else {
    const year = rows[chartHoverIndex].year;
    chartFocus.textContent = `Annee ${year} - ${visible.map((s) => `${s.label}: ${formatCurrency(s.values[chartHoverIndex])}`).join(' | ')}`;
  }
}

function resizeChartCanvas() {
  const rect = proChart.getBoundingClientRect();
  const cssWidth = Math.max(320, Math.round(rect.width || 880));
  const cssHeight = Math.round(cssWidth * (280 / 880));
  const dpr = window.devicePixelRatio || 1;

  proChart.width = Math.round(cssWidth * dpr);
  proChart.height = Math.round(cssHeight * dpr);
  proChart.style.height = `${cssHeight}px`;

  const ctx = proChart.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { width: cssWidth, height: cssHeight };
}

function drawChartGrid(ctx, cfg) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i <= 5; i += 1) {
    const ratio = i / 5;
    const y = cfg.padTop + ratio * (cfg.h - cfg.padTop - cfg.padBottom);
    ctx.beginPath();
    ctx.moveTo(cfg.padLeft, y);
    ctx.lineTo(cfg.w - cfg.padRight, y);
    ctx.stroke();
    const value = cfg.maxY - ratio * (cfg.maxY - cfg.minY);
    ctx.fillStyle = '#8f8577';
    ctx.font = '11px Outfit';
    ctx.fillText(formatCompactCurrency(value), 8, y + 3);
  }

  ctx.strokeStyle = '#3a3127';
  ctx.beginPath();
  ctx.moveTo(cfg.padLeft, cfg.padTop);
  ctx.lineTo(cfg.padLeft, cfg.h - cfg.padBottom);
  ctx.lineTo(cfg.w - cfg.padRight, cfg.h - cfg.padBottom);
  ctx.stroke();
}

function drawLine(ctx, rows, values, cfg) {
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = toX(i, rows.length, cfg.width, cfg.padLeft, cfg.padRight);
    const y = toY(v, cfg.height, cfg.padTop, cfg.padBottom, cfg.minY, cfg.rangeY);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  values.forEach((v, i) => {
    const x = toX(i, rows.length, cfg.width, cfg.padLeft, cfg.padRight);
    const y = toY(v, cfg.height, cfg.padTop, cfg.padBottom, cfg.minY, cfg.rangeY);
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function onChartHoverMove(event) {
  if (!chartLayout || !lastChartRows.length) return;
  const rect = proChart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const usable = chartLayout.width - chartLayout.padLeft - chartLayout.padRight;
  const ratio = clamp((x - chartLayout.padLeft) / usable, 0, 1);
  chartHoverIndex = Math.round(ratio * (chartLayout.count - 1));
  renderProChart(lastChartRows);
}

function onChartHoverLeave() {
  chartHoverIndex = null;
  renderProChart(lastChartRows);
}

function toX(index, count, width, padLeft, padRight) {
  if (count <= 1) return padLeft;
  return padLeft + (index / (count - 1)) * (width - padLeft - padRight);
}

function toY(value, height, padTop, padBottom, minY, rangeY) {
  return height - padBottom - ((value - minY) / rangeY) * (height - padTop - padBottom);
}

function renderScenarios() {
  const scenarios = getScenarios();
  scenariosList.innerHTML = '';
  if (!scenarios.length) {
    scenariosList.innerHTML = '<p class="empty">Aucun scenario sauvegarde.</p>';
    return;
  }

  scenarios.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'scenario-row';
    row.innerHTML = `
      <label><input type="checkbox" class="compare-check" value="${s.id}"><span>${escapeHtml(s.name)}</span></label>
      <div class="row-actions"><button type="button" data-load="${s.id}">Charger</button><button type="button" data-delete="${s.id}">Supprimer</button></div>
    `;
    scenariosList.appendChild(row);
  });

  scenariosList.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => loadScenario(b.dataset.load)));
  scenariosList.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteScenario(b.dataset.delete)));
}

function loadScenario(id) {
  const s = getScenarios().find((x) => x.id === id);
  if (!s) return;
  Object.entries(s.inputs).forEach(([k, v]) => {
    const f = form.elements.namedItem(k);
    if (f) f.value = v;
  });
  computeAndRender();
  setStatus(`Scenario "${s.name}" charge.`);
}

function deleteScenario(id) {
  setScenarios(getScenarios().filter((x) => x.id !== id));
  renderScenarios();
  comparisonArea.innerHTML = '';
  setStatus('Scenario supprime.');
}

function saveScenario() {
  if (!authToken) {
    setStatus('Connecte-toi pour sauvegarder des scenarios dans ton compte.');
    return;
  }
  if (!isPremiumPlan()) {
    setStatus('Sauvegarde illimitee disponible en plan Essentiel ou Pro.');
    return;
  }
  const name = window.prompt('Nom du scenario ?');
  if (!name) return;
  const scenarios = getScenarios();
  scenarios.push({ id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), inputs: readInputs() });
  setScenarios(scenarios);
  renderScenarios();
  setStatus('Scenario sauvegarde.');
}

function renderComparison() {
  if (!isPremiumPlan()) {
    setStatus('Comparaison disponible en plan Essentiel ou Pro.');
    return;
  }

  const checked = [...document.querySelectorAll('.compare-check:checked')].map((el) => el.value);
  if (checked.length < 2 || checked.length > 3) {
    setStatus('Selectionne 2 ou 3 scenarios pour comparer.');
    return;
  }

  const rows = getScenarios().filter((s) => checked.includes(s.id)).map((s) => ({ name: s.name, results: computeResults(s.inputs) }));
  const headers = ['Indicateur', ...rows.map((r) => escapeHtml(r.name))];
  const body = metricConfig.map(([k, label]) => `<tr><td>${label}</td>${rows.map((r) => `<td>${k.includes('Yield') ? formatPercent(r.results[k]) : formatCurrency(r.results[k])}</td>`).join('')}</tr>`).join('');

  comparisonArea.innerHTML = `<h3>Comparaison</h3><div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  setStatus('Comparaison generee.');
}
function exportPdf() {
  if (!isPremiumPlan()) {
    setStatus('Export PDF disponible en plan Essentiel ou Pro.');
    return;
  }

  if (isProPlan()) {
    prepareProPrintReport();
    document.body.classList.add('print-pro');
    window.addEventListener('afterprint', cleanupProPrintReport, { once: true });
  }

  window.print();
}

function prepareProPrintReport() {
  if (!lastProAnalysis) return;
  const { settings, score, recommendations, fiscal, projection, results } = lastProAnalysis;
  const chartDataUrl = proChart ? proChart.toDataURL('image/png') : '';
  const projectionRows = (projection?.rows || []).slice(0, 10);
  const taxModeLabel = getTaxModeLabel(settings.taxMode);
  const scoreLines = [
    ['Cashflow & resilience', score.cashflowPts, 30],
    ['Rendement & revenus', score.yieldPts, 20],
    ['Risque dette', score.debtPts, 20],
    ['Sensibilite', score.stressPts, 15],
    ['Efficience charges', score.costPts, 10],
    ['Coherence fiscale', score.taxPts, 5]
  ];

  proPrintReport.innerHTML = `
    <h3>Rapport Pro - Analyse avancee</h3>
    <p>Plan Pro (59 EUR) | Regime fiscal: ${escapeHtml(taxModeLabel)} | Horizon: ${settings.projectionYears} ans</p>

    <h4>Rentium Score</h4>
    <p><strong>${Math.round(score.total)}/100 - ${score.label}</strong></p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Composant</th><th>Score</th></tr></thead>
        <tbody>
          ${scoreLines.map(([label, value, cap]) => `<tr><td>${escapeHtml(label)}</td><td>${Number(value).toFixed(1)} / ${cap}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p><strong>Cashflow mensuel:</strong> ${formatCurrency(results.monthlyCashflow)} | <strong>DSCR:</strong> ${results.dscr.toFixed(2)} | <strong>LTV:</strong> ${formatPercent(results.ltv * 100)}</p>

    <h4>Fiscalite</h4>
    <p><strong>Regime:</strong> ${taxModeLabel} | <strong>Taux fiscal total:</strong> ${formatPercent(fiscal.taxRate * 100)}</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead>
        <tbody>
          <tr><td>Base imposable selectionnee</td><td>${formatCurrency(fiscal.selectedTaxableBase)}</td></tr>
          <tr><td>Impot annuel estime</td><td>${formatCurrency(fiscal.selectedTax)}</td></tr>
          <tr><td>Cashflow annuel apres impot</td><td>${formatCurrency(fiscal.annualCashflowAfterTax)}</td></tr>
        </tbody>
      </table>
    </div>

    <h4>Projection long terme</h4>
    <p><strong>Cashflow cumule (${projection.horizon} ans):</strong> ${formatCurrency(projection.totalCashflow)} | <strong>Total avec sortie:</strong> ${formatCurrency(projection.totalWithExit)}</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Annee</th>
            <th>Cashflow net</th>
            <th>Cumule</th>
            <th>Valeur nette revente</th>
            <th>Total avec sortie</th>
          </tr>
        </thead>
        <tbody>
          ${projectionRows.map((row) => `
            <tr>
              <td>${row.year}</td>
              <td>${formatCurrency(row.cashflowAfterTax)}</td>
              <td>${formatCurrency(row.cumulativeCashflow)}</td>
              <td>${formatCurrency(row.netSaleValue)}</td>
              <td>${formatCurrency(row.totalWithExit)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <h4>Recommandations prioritaires</h4>
    <ul>${recommendations.slice(0, 8).map((r) => `<li>${escapeHtml(r.title)} (${formatSignedNumber(r.deltaScore)} pts, ${formatSignedCurrency(r.deltaCashflowMonthly)}/mois)</li>`).join('') || '<li>Aucune recommandation differenciante.</li>'}</ul>

    ${chartDataUrl ? `<h4>Graphique des flux</h4><img src="${chartDataUrl}" alt="Graphique Pro" />` : ''}
  `;
}

function cleanupProPrintReport() {
  document.body.classList.remove('print-pro');
  proPrintReport.innerHTML = '';
}

function copyShareLink() {
  const params = new URLSearchParams();
  Object.entries(readInputs()).forEach(([k, v]) => params.set(k, String(v)));

  if (isProPlan()) {
    const pro = readProSettings();
    Object.entries(pro).forEach(([k, v]) => params.set(k, v === null ? 'unknown' : String(v)));
  }

  params.set('plan', planSelect.value);

  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  navigator.clipboard.writeText(url)
    .then(() => setStatus('Lien de simulation copie.'))
    .catch(() => setStatus('Impossible de copier le lien.'));
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.toString()) return;

  for (const [k, v] of params.entries()) {
    const field = form.elements.namedItem(k);
    if (field) field.value = v;
  }

  if (params.get('plan')) planSelect.value = params.get('plan');
  if (params.get('taxMode')) taxMode.value = normalizeTaxMode(params.get('taxMode'));
  if (params.get('marginalTaxRate')) marginalTaxRate.value = params.get('marginalTaxRate');
  if (params.get('socialTaxRate')) socialTaxRate.value = params.get('socialTaxRate');
  if (params.get('annualDepreciation')) annualDepreciation.value = params.get('annualDepreciation');
  if (params.get('projectionYears')) projectionYears.value = params.get('projectionYears');
  if (params.get('annualRentGrowth')) annualRentGrowth.value = params.get('annualRentGrowth');
  if (params.get('annualChargeGrowth')) annualChargeGrowth.value = params.get('annualChargeGrowth');
  if (params.get('annualPropertyGrowth')) annualPropertyGrowth.value = params.get('annualPropertyGrowth');
  if (params.get('exitCostRate')) exitCostRate.value = params.get('exitCostRate');
}

function openPricingModal() {
  if (!pricingModal) return;
  pricingModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closePricingModal() {
  if (!pricingModal) return;
  if (!authToken) return;
  pricingModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function onPricingModalClick(event) {
  if (!authToken) return;
  if (event.target instanceof HTMLElement && event.target.dataset.closePricing === 'true') {
    closePricingModal();
  }
}

async function selectPlanFromModal(plan) {
  if (!['free', 'essential', 'pro'].includes(plan)) return;
  if (!authToken) {
    const ready = await ensureAuthenticatedFromOnboarding();
    if (!ready) return;
  }

  if (plan === 'free') {
    planSelect.value = 'free';
    if (currentUser) {
      currentUser = { ...currentUser, plan: 'free' };
      setAuthUI();
    }
    closePricingModal();
    updatePremiumState();
    computeAndRender();
    setStatus('Plan Gratuit active.');
    return;
  }

  startStripeCheckout(plan);
}

function isPremiumPlan() {
  return planSelect.value === 'essential' || planSelect.value === 'pro';
}

function isProPlan() {
  return planSelect.value === 'pro';
}

function updatePremiumState() {
  document.querySelectorAll('[data-premium="true"]').forEach((btn) => {
    btn.disabled = !isPremiumPlan();
  });

  proCard.hidden = !isProPlan();
  updatePlanTagline();

  if (planSelect.value === 'free') setStatus('Plan Gratuit actif: export/sauvegarde/comparaison reserves aux plans payants.');
  else if (planSelect.value === 'essential') setStatus('Plan Essentiel actif. Active le plan Pro pour le score et recommandations.');
  else setStatus('Plan Pro actif: score, recommandations et analyses avancees disponibles.');
}

function updatePlanTagline() {
  if (!planTagline) return;
  const plan = planSelect?.value || 'free';
  const label = plan === 'pro' ? 'Pro' : (plan === 'essential' ? 'Essentiel' : 'Gratuit');
  planTagline.textContent = `Simulateur de rentabilite locative - Version ${label}`;
}

function setStatus(message) {
  if (!statusText) return;
  statusText.textContent = message;
}

function setOnboardingStatus(message) {
  if (!onboardingStatus) return;
  onboardingStatus.textContent = message || '';
}

async function startStripeCheckout(plan) {
  try {
    if (!authToken) {
      setStatus('Connecte-toi avant de lancer le paiement.');
      return;
    }

    setStatus('Redirection vers paiement securise Stripe...');
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ plan })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Erreur creation session');
    }

    const data = await response.json();
    if (!data.url) throw new Error('URL checkout manquante');
    window.location.href = data.url;
  } catch (error) {
    setStatus('Paiement indisponible: verifie la config Stripe backend.');
  }
}

async function syncPlanFromServer() {
  try {
    if (!authToken) {
      planSelect.value = 'free';
      updatePremiumState();
      computeAndRender();
      return;
    }

    const data = await apiFetch('/api/me/plan', { method: 'GET' });
    if (!data || !['free', 'essential', 'pro'].includes(data.plan)) return;

    planSelect.value = data.plan;
    if (currentUser) {
      currentUser = { ...currentUser, plan: data.plan };
      setAuthUI();
    }
    updatePremiumState();
    computeAndRender();
  } catch {
    // Backend absent: fonctionnement local conserve
  }
}

function handleCheckoutStatusFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get('checkout');
  if (!checkoutState) return;

  if (checkoutState === 'success') {
    setStatus('Paiement confirme. Mise a jour du plan en cours...');
    syncPlanFromServer();
  } else if (checkoutState === 'cancel') {
    setStatus('Paiement annule. Aucun changement de plan.');
  }
}

function readLocalScenarios() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function getScenarios() {
  return scenariosCache;
}

function setScenarios(scenarios, options = {}) {
  const { skipServerSync = false } = options;
  scenariosCache = Array.isArray(scenarios) ? scenarios : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenariosCache));
  if (!skipServerSync) saveScenariosToServer();
}

async function saveScenariosToServer() {
  if (!authToken) return;
  try {
    await apiFetch('/api/me/scenarios', {
      method: 'PUT',
      body: JSON.stringify({ scenarios: scenariosCache })
    });
  } catch {
    setStatus('Sauvegarde cloud indisponible, scenarios conserves localement.');
  }
}

async function loadScenariosFromServer() {
  if (!authToken) return;
  try {
    const data = await apiFetch('/api/me/scenarios', { method: 'GET' });
    if (!data || !Array.isArray(data.scenarios)) return;
    if (!data.scenarios.length && scenariosCache.length) {
      await saveScenariosToServer();
      return;
    }
    setScenarios(data.scenarios, { skipServerSync: true });
    renderScenarios();
  } catch {
    // fallback local
  }
}

function getAuthCredentials(preferOnboarding = false) {
  const emailRaw = preferOnboarding
    ? (onboardingEmailInput?.value || authEmailInput?.value || '')
    : (authEmailInput?.value || onboardingEmailInput?.value || '');
  const passwordRaw = preferOnboarding
    ? (onboardingPasswordInput?.value || authPasswordInput?.value || '')
    : (authPasswordInput?.value || onboardingPasswordInput?.value || '');

  return {
    email: String(emailRaw).trim().toLowerCase(),
    password: String(passwordRaw || '')
  };
}

function mirrorAuthInputs(email, clearPassword = false) {
  if (authEmailInput) authEmailInput.value = email;
  if (onboardingEmailInput) onboardingEmailInput.value = email;
  if (clearPassword) {
    if (authPasswordInput) authPasswordInput.value = '';
    if (onboardingPasswordInput) onboardingPasswordInput.value = '';
  }
}

async function applyAuthSession(data) {
  authToken = data?.token || '';
  if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
  currentUser = data?.user || null;
  setAuthUI();
  await loadScenariosFromServer();
  await syncPlanFromServer();
  await loadAdminUsers();
}

async function registerAccount(preferOnboarding = false) {
  const { email, password } = getAuthCredentials(preferOnboarding);
  if (!email || !password) {
    setStatus('Renseigne email et mot de passe.');
    return false;
  }

  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      includeAuth: false
    });
    await applyAuthSession(data);
    mirrorAuthInputs(email, true);
    setStatus('Compte cree et connecte.');
    return true;
  } catch (error) {
    setStatus(error.message || 'Impossible de creer le compte.');
    return false;
  }
}

async function loginAccount(preferOnboarding = false) {
  const { email, password } = getAuthCredentials(preferOnboarding);
  if (!email || !password) {
    setStatus('Renseigne email et mot de passe.');
    return false;
  }

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      includeAuth: false
    });
    await applyAuthSession(data);
    mirrorAuthInputs(email, true);
    setStatus('Connexion reussie.');
    return true;
  } catch (error) {
    setStatus(error.message || 'Connexion impossible.');
    return false;
  }
}

async function loginAccountFromOnboarding() {
  const { email, password } = getAuthCredentials(true);
  if (!email || !password) {
    setOnboardingStatus('Renseigne email et mot de passe.');
    return;
  }

  try {
    const check = await apiFetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      includeAuth: false
    });

    if (!check?.exists) {
      setOnboardingStatus('Compte introuvable. Cree un compte via un plan.');
      return;
    }

    const ok = await loginAccount(true);
    if (!ok) {
      setOnboardingStatus('Compte trouve, mot de passe incorrect.');
      return;
    }

    setOnboardingStatus('');
    closePricingModal();
    updatePremiumState();
    computeAndRender();
    window.location.replace('/index.html');
  } catch (error) {
    setOnboardingStatus(error.message || 'Connexion impossible.');
  }
}

async function ensureAuthenticatedFromOnboarding() {
  if (authToken && currentUser) return true;
  const { email, password } = getAuthCredentials(true);
  if (!email || !password) {
    setStatus('Pour continuer, renseigne email + mot de passe puis choisis un plan.');
    return false;
  }

  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      includeAuth: false
    });
    await applyAuthSession(data);
    mirrorAuthInputs(email, true);
    setStatus('Compte cree. Tu peux continuer.');
    return true;
  } catch (error) {
    if (!String(error.message || '').includes('deja utilise')) {
      setStatus(error.message || 'Creation de compte impossible.');
      return false;
    }
  }

  const logged = await loginAccount(true);
  if (!logged) {
    setStatus('Compte existant detecte: utilise le bon mot de passe puis clique "J ai deja un compte".');
    return false;
  }
  return true;
}

async function logoutAccount() {
  try {
    if (authToken) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
  } catch {
    // ignore logout network errors
  }

  authToken = '';
  currentUser = null;
  adminUsersCache = [];
  localStorage.removeItem(AUTH_TOKEN_KEY);
  setAuthUI();
  await syncPlanFromServer();
  setStatus('Deconnecte.');
}

async function syncAuthState() {
  if (!authToken) {
    setAuthUI();
    openPricingModal();
    setStatus('Choisis un plan pour creer ton compte et acceder au simulateur.');
    return;
  }

  try {
    const data = await apiFetch('/api/auth/me', { method: 'GET' });
    currentUser = data.user || null;
    setAuthUI();
    await loadScenariosFromServer();
    await syncPlanFromServer();
    closePricingModal();
  } catch {
    authToken = '';
    currentUser = null;
    adminUsersCache = [];
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthUI();
    openPricingModal();
  }
}

function setAuthUI() {
  const connected = Boolean(currentUser && authToken);
  const displayPlan = connected
    ? (currentUser?.plan || planSelect?.value || 'free')
    : 'free';
  if (authState) {
    authState.textContent = connected
      ? `Connecte: ${currentUser.email} (${displayPlan})`
      : 'Non connecte';
  }
  if (logoutBtn) logoutBtn.hidden = !connected;
  if (loginBtn) loginBtn.hidden = connected;
  if (registerBtn) registerBtn.hidden = connected;
  if (authEmailInput) authEmailInput.disabled = connected;
  if (authPasswordInput) authPasswordInput.disabled = connected;
  if (closePricingBtn) closePricingBtn.hidden = !connected;
  if (onboardingLoginBtn) onboardingLoginBtn.hidden = connected;
  if (onboardingEmailInput) onboardingEmailInput.disabled = connected;
  if (onboardingPasswordInput) onboardingPasswordInput.disabled = connected;
  if (connected) setOnboardingStatus('');
  if (adminCard) adminCard.hidden = !(connected && currentUser?.isAdmin === true);
  if (adminCard && adminCard.hidden) renderAdminUsersTable([]);
}

async function loadAdminUsers() {
  if (!authToken || !currentUser?.isAdmin) {
    adminUsersCache = [];
    renderAdminUsersTable([]);
    return;
  }

  try {
    const data = await apiFetch('/api/admin/users', { method: 'GET' });
    adminUsersCache = Array.isArray(data?.users) ? data.users : [];
    renderAdminUsersTable(adminUsersCache);
  } catch (error) {
    setStatus(error.message || 'Impossible de charger les utilisateurs admin.');
  }
}

function renderAdminUsersTable(users) {
  if (!adminUsersBody) return;
  if (!Array.isArray(users) || !users.length) {
    adminUsersBody.innerHTML = '<tr><td colspan="4">Aucun utilisateur charge.</td></tr>';
    return;
  }

  adminUsersBody.innerHTML = users.map((user) => `
    <tr data-user-id="${escapeHtml(user.id)}">
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.plan || 'free')}</td>
      <td>
        <select class="admin-plan-select">
          <option value="free" ${user.plan === 'free' ? 'selected' : ''}>free</option>
          <option value="essential" ${user.plan === 'essential' ? 'selected' : ''}>essential</option>
          <option value="pro" ${user.plan === 'pro' ? 'selected' : ''}>pro</option>
        </select>
      </td>
      <td><button type="button" class="admin-save-plan-btn">Enregistrer</button></td>
    </tr>
  `).join('');
}

async function onAdminUsersTableClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (!event.target.classList.contains('admin-save-plan-btn')) return;

  const row = event.target.closest('tr[data-user-id]');
  if (!(row instanceof HTMLElement)) return;
  const userId = row.dataset.userId;
  const select = row.querySelector('.admin-plan-select');
  if (!(select instanceof HTMLSelectElement)) return;
  const plan = select.value;
  if (!userId || !['free', 'essential', 'pro'].includes(plan)) return;

  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    setStatus(`Plan utilisateur mis a jour: ${plan}`);
    await loadAdminUsers();
  } catch (error) {
    setStatus(error.message || 'Mise a jour du plan impossible.');
  }
}

async function apiFetch(url, options = {}) {
  const {
    includeAuth = true,
    headers = {},
    ...rest
  } = options;

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

  if (!response.ok) {
    const message = payload?.error || text || 'Erreur API';
    throw new Error(message);
  }

  return payload;
}

function generateLoanSchedule(loanAmount, interestRate, loanYears, monthlyPayment) {
  const months = Math.max(loanYears * 12, 0);
  if (!loanAmount || !months) return [];

  const monthlyRate = interestRate / 100 / 12;
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

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function formatPercent(value) {
  return `${(value || 0).toFixed(2)} %`;
}

function formatSignedCurrency(value) {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
}

function formatSignedNumber(value) {
  return `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(1)}`;
}

function normalizeTaxMode(rawMode) {
  const mode = String(rawMode || '').trim();
  if (mode === 'micro') return 'lmnp-micro';
  if (mode === 'real') return 'lmnp-real';
  if (mode === 'bare') return 'nue-reel-foncier';

  const allowed = new Set(['lmnp-micro', 'lmnp-real', 'nue-micro-foncier', 'nue-reel-foncier']);
  return allowed.has(mode) ? mode : 'lmnp-micro';
}

function getTaxModeLabel(rawMode) {
  const mode = normalizeTaxMode(rawMode);
  if (mode === 'lmnp-micro') return 'LMNP Micro-BIC';
  if (mode === 'lmnp-real') return 'LMNP Reel';
  if (mode === 'nue-micro-foncier') return 'Location nue Micro-foncier';
  return 'Location nue Reel foncier';
}

function escapeHtml(input) {
  return String(input).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function switchProTab(tab) {
  document.querySelectorAll('.pro-tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  proPaneTax.classList.toggle('active', tab === 'tax');
  proPaneProjection.classList.toggle('active', tab === 'projection');
  proPaneCompare.classList.toggle('active', tab === 'compare');
  proPaneChart.classList.toggle('active', tab === 'chart');
  proPaneScore.classList.toggle('active', tab === 'score');
}
