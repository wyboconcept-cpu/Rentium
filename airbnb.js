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
const recoArea = document.getElementById('recoArea');
const recoList = document.getElementById('recoList');
const proMetrics = document.getElementById('proMetrics');
const proArea = document.getElementById('proArea');
const lockNotice = document.getElementById('lockNotice');
const uncertaintyBox = document.getElementById('uncertaintyBox');
const projectionBody = document.getElementById('projectionBody');
const chartArea = document.getElementById('chartArea');
const airbnbChart = document.getElementById('airbnbChart');
const chartFocus = document.getElementById('chartFocus');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const saveScenarioBtn = document.getElementById('saveScenarioBtn');
const scenariosList = document.getElementById('scenariosList');
const compareScenariosBtn = document.getElementById('compareScenariosBtn');
const comparisonArea = document.getElementById('comparisonArea');
const cityPresetSelect = document.getElementById('cityPresetSelect');
const applyCityPresetBtn = document.getElementById('applyCityPresetBtn');
const cityDataInfo = document.getElementById('cityDataInfo');
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
const fiscalityEnabledToggle = document.getElementById('fiscalityEnabledToggle');
const fiscalVariablesWrap = document.getElementById('fiscalVariablesWrap');

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
let currentUser = null;
let currentPlan = 'free';
let lastReport = null;
const AIRBNB_SCENARIOS_KEY = 'rentium_airbnb_scenarios_v1';
let airbnbScenarios = readSavedAirbnbScenarios();
let chartRows = [];
let chartHoverIndex = null;
let chartLayout = null;
let selectedScenarioIds = new Set();

const CITY_OFFICIAL_PRESETS = {
  paris: {
    label: 'Paris',
    insee: { annualNights: 17800000, dailyNights: 48800, nightsPer1000: 23100, nonResidentShare: 0.61 },
    defaults: { nightlyRate: 185, occupancyRate: 74, openDays: 345, turnoversPerMonth: 17, fixedMonthlyCosts: 420, conciergeRate: 20, propertyTax: 2100 }
  },
  nice: {
    label: 'Nice',
    insee: { annualNights: 3770000, dailyNights: 10300, nightsPer1000: 30300, nonResidentShare: 0.45 },
    defaults: { nightlyRate: 145, occupancyRate: 70, openDays: 335, turnoversPerMonth: 13, fixedMonthlyCosts: 340, conciergeRate: 18, propertyTax: 1800 }
  },
  marseille: {
    label: 'Marseille',
    insee: { annualNights: 2490000, dailyNights: 6800, nightsPer1000: 7800, nonResidentShare: 0.39 },
    defaults: { nightlyRate: 110, occupancyRate: 63, openDays: 325, turnoversPerMonth: 11, fixedMonthlyCosts: 320, conciergeRate: 17, propertyTax: 1600 }
  },
  lyon: {
    label: 'Lyon',
    insee: { annualNights: 2390000, dailyNights: 6500, nightsPer1000: 12600, nonResidentShare: 0.53 },
    defaults: { nightlyRate: 118, occupancyRate: 64, openDays: 330, turnoversPerMonth: 12, fixedMonthlyCosts: 330, conciergeRate: 18, propertyTax: 1700 }
  },
  toulouse: {
    label: 'Toulouse',
    insee: { annualNights: 1300000, dailyNights: 3700, nightsPer1000: 7900, nonResidentShare: 0.40 },
    defaults: { nightlyRate: 98, occupancyRate: 59, openDays: 320, turnoversPerMonth: 10, fixedMonthlyCosts: 300, conciergeRate: 16, propertyTax: 1500 }
  }
};

const NEUTRAL_DEFAULTS = {
  nightlyRate: 115,
  occupancyRate: 65,
  openDays: 330,
  turnoversPerMonth: 11,
  fixedMonthlyCosts: 320,
  conciergeRate: 18,
  propertyTax: 1700
};

init();

function init() {
  form.addEventListener('input', render);
  [dynamicPricingUplift, seasonalityIndex, cityTaxRate, projectionYears, annualRevenueGrowth, annualCostGrowth]
    .forEach((el) => el && el.addEventListener('input', render));
  if (fiscalityEnabledToggle) fiscalityEnabledToggle.addEventListener('change', onFiscalityToggleChange);
  registerBtn.addEventListener('click', registerAccount);
  loginBtn.addEventListener('click', loginAccount);
  logoutBtn.addEventListener('click', logoutAccount);
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportPdfReport);
  if (saveScenarioBtn) saveScenarioBtn.addEventListener('click', saveScenario);
  if (openPricingBtn) openPricingBtn.addEventListener('click', openPricingModal);
  if (closePricingBtn) closePricingBtn.addEventListener('click', closePricingModal);
  if (pricingModal) pricingModal.addEventListener('click', onPricingModalClick);
  document.addEventListener('click', onPlanSelectClick);
  if (scenariosList) scenariosList.addEventListener('click', onScenariosClick);
  if (scenariosList) scenariosList.addEventListener('change', onScenariosChange);
  if (compareScenariosBtn) compareScenariosBtn.addEventListener('click', renderScenariosComparison);
  if (cityPresetSelect) cityPresetSelect.addEventListener('change', onCityPresetChange);
  if (applyCityPresetBtn) applyCityPresetBtn.addEventListener('click', onCityPresetApplyClick);
  if (airbnbChart) {
    airbnbChart.addEventListener('mousemove', onChartHoverMove);
    airbnbChart.addEventListener('mouseleave', onChartHoverLeave);
  }
  window.addEventListener('resize', onChartResize);
  syncAuthState().finally(render);
  applyInitialCityPreset();
  updateFiscalityState();
  renderScenarios();
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
  data.fiscalityEnabled = fiscalityEnabledToggle ? fiscalityEnabledToggle.checked : true;
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
  if (!data.fiscalityEnabled) {
    const net = base.annualNetBeforeTax;
    return {
      regimes: {
        'lmnp-micro': { taxable: 0, tax: 0, netAfterTax: net },
        'lmnp-reel': { taxable: 0, tax: 0, netAfterTax: net, carryForwardUsed: 0, carryForwardNext: 0 },
        'lmp-micro': { taxable: 0, tax: 0, netAfterTax: net },
        'lmp-reel': { taxable: 0, tax: 0, netAfterTax: net },
        'sci-is': { taxable: 0, tax: 0, netAfterTax: net }
      },
      selectedMode: 'no-tax',
      selectedTax: 0,
      selectedNetAfterTax: net,
      carryForwardNext: 0
    };
  }

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
  const baselineEval = evaluateScenario(data, {
    uplift: 0,
    seasonality: 1,
    cityTax: 0,
    years: 10,
    revenueGrowth: 0,
    costGrowth: 0
  });

  const hasEssential = currentPlan === 'essential' || currentPlan === 'pro';
  const hasPro = currentPlan === 'pro';
  if (exportPdfBtn) exportPdfBtn.disabled = !hasEssential;
  if (saveScenarioBtn) saveScenarioBtn.disabled = !hasEssential;

  planState.textContent = `Plan actif: ${labelPlan(currentPlan)}`;
  lockNotice.textContent = hasEssential
    ? 'Version Airbnb active: base + fiscalite court terme debloquees.'
    : 'Cette variante Airbnb est reservee aux plans Essentiel et Pro. Passe sur un plan payant pour debloquer les resultats.';

  metrics.innerHTML = '';
  fiscalCompare.innerHTML = '';
  if (recoList) recoList.innerHTML = '';
  proMetrics.innerHTML = '';
  projectionBody.innerHTML = '';
  fiscalArea.hidden = true;
  if (recoArea) recoArea.hidden = true;
  proArea.hidden = true;
  if (chartArea) chartArea.hidden = true;

  if (!hasEssential) {
    renderMetric('Acces', 'Plan payant requis');
    if (chartFocus) chartFocus.textContent = 'Graphique disponible a partir du plan Essentiel.';
    if (uncertaintyBox) uncertaintyBox.textContent = 'Marge d erreur estimee disponible a partir du plan Essentiel.';
    renderScenarios();
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

  if (recoArea && recoList) {
    const recos = generateInvestmentRecommendations(data, {
      uplift: 0,
      seasonality: 1,
      cityTax: 0,
      years: 10,
      revenueGrowth: 0,
      costGrowth: 0
    }, baselineEval, 5);
    recoArea.hidden = false;
    renderRecommendations(recos);
  }

  const chartControls = hasPro
    ? controls
    : { uplift: 0, seasonality: 1, cityTax: 0, years: 10, revenueGrowth: 0, costGrowth: 0 };
  const chartBase = computeBaseAirbnb(data, chartControls);
  const chartProjection = computeProjection(data, chartBase, chartControls);
  const baseUncertainty = computeAirbnbUncertaintyRange(data, chartControls);
  renderUncertainty(baseUncertainty);
  if (chartArea) chartArea.hidden = false;
  renderChart(chartProjection.rows);
  lastReport = {
    generatedAt: new Date().toISOString(),
    plan: currentPlan,
    base,
    fiscal,
    projection: chartProjection,
    controls: chartControls,
    uncertainty: baseUncertainty
  };

  if (!hasPro) return;

  proArea.hidden = false;
  const baseWithProControls = computeBaseAirbnb(data, controls);
  const projection = computeProjection(data, baseWithProControls, controls);
  const proUncertainty = computeAirbnbUncertaintyRange(data, controls);
  renderUncertainty(proUncertainty);

  renderProMetric('CA ajuste annee 1', formatCurrency(baseWithProControls.grossRevenue));
  renderProMetric('Taxe de sejour estimee', formatCurrency(baseWithProControls.cityTaxAnnual));
  renderProMetric('Net mensuel apres impot (annee 1)', formatCurrency(projection.rows[0]?.selectedNetAfterTax / 12 || 0));
  renderProMetric('Stress occupation -10 pts', formatCurrency(projection.stressOcc));
  renderProMetric('Stress ADR -15%', formatCurrency(projection.stressAdr));
  renderProMetric('Airbnb Score Pro', `${Math.round(projection.score)}/100`, scoreToneClass(projection.score));
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

  if (recoArea && recoList) {
    const proBaselineEval = evaluateScenario(data, controls);
    const proRecos = generateInvestmentRecommendations(data, controls, proBaselineEval, 8);
    renderRecommendations(proRecos);
  }
  lastReport = {
    generatedAt: new Date().toISOString(),
    plan: currentPlan,
    base: baseWithProControls,
    fiscal: computeFiscalComparison(data, baseWithProControls),
    projection,
    controls,
    uncertainty: proUncertainty
  };
  renderScenarios();
}

function renderChart(rows) {
  if (!airbnbChart) return;
  chartRows = rows || [];
  const canvas = resizeAirbnbChartCanvas();
  const ctx = canvas.ctx;
  const width = canvas.cssWidth;
  const height = canvas.cssHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111a20';
  ctx.fillRect(0, 0, width, height);
  if (!rows || !rows.length) return;

  const padLeft = 58;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const netSeries = rows.map((r) => r.selectedNetAfterTax);
  const cumSeries = rows.map((r) => r.cumulative);
  const taxSeries = rows.map((r) => r.selectedTax);
  const all = [...netSeries, ...cumSeries, ...taxSeries, 0];
  const minY = Math.min(...all);
  const maxY = Math.max(...all);
  const range = maxY - minY || 1;
  chartLayout = { width, height, padLeft, padRight, padTop, padBottom, minY, range, count: rows.length, plotW, plotH };

  for (let i = 0; i <= 5; i += 1) {
    const y = padTop + (plotH * i) / 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#36515b';
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, height - padBottom);
  ctx.lineTo(width - padRight, height - padBottom);
  ctx.stroke();

  drawBars(ctx, taxSeries, 'rgba(173, 137, 232, 0.45)', rows.length, { padLeft, padRight, padTop, padBottom, width, height, minY, range });
  drawSeries(ctx, netSeries, '#ff7a3d', rows.length, { padLeft, padRight, padTop, padBottom, width, height, minY, range });
  drawSeries(ctx, cumSeries, '#15b7aa', rows.length, { padLeft, padRight, padTop, padBottom, width, height, minY, range });

  const firstYear = rows[0]?.year || 1;
  const lastYear = rows[rows.length - 1]?.year || rows.length;
  ctx.fillStyle = '#8ca6b0';
  ctx.font = '11px Outfit';
  ctx.fillText(`An ${firstYear}`, padLeft, height - 12);
  ctx.fillText(`An ${lastYear}`, width - padRight - 38, height - 12);

  if (chartHoverIndex !== null && chartHoverIndex >= 0 && chartHoverIndex < rows.length) {
    const x = toChartX(chartHoverIndex, rows.length, width, padLeft, padRight);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, height - padBottom);
    ctx.stroke();
  }

  ctx.fillStyle = '#ff7a3d';
  ctx.font = '12px Outfit';
  ctx.fillText('Net apres impot', padLeft + 8, padTop + 12);
  ctx.fillStyle = '#15b7aa';
  ctx.fillText('Cumul', padLeft + 132, padTop + 12);
  ctx.fillStyle = '#ad89e8';
  ctx.fillText('Impot', padLeft + 200, padTop + 12);

  if (chartFocus && chartHoverIndex !== null && chartHoverIndex >= 0 && chartHoverIndex < rows.length) {
    const row = rows[chartHoverIndex];
    chartFocus.textContent = `Annee ${row.year}: CA ${formatCurrency(row.grossRevenue)} | Charges ${formatCurrency(row.operatingCashCosts)} | Impot ${formatCurrency(row.selectedTax)} | Net ${formatCurrency(row.selectedNetAfterTax)} | Cumul ${formatCurrency(row.cumulative)}`;
  } else if (chartFocus) {
    const last = rows[rows.length - 1];
    chartFocus.textContent = `Annee ${last.year}: CA ${formatCurrency(last.grossRevenue)} | Impot ${formatCurrency(last.selectedTax)} | Net ${formatCurrency(last.selectedNetAfterTax)} | Cumul ${formatCurrency(last.cumulative)}`;
  }
}

function drawSeries(ctx, values, color, count, layout) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, idx) => {
    const x = layout.padLeft + (count <= 1 ? 0 : (idx / (count - 1)) * (layout.width - layout.padLeft - layout.padRight));
    const y = layout.height - layout.padBottom - ((value - layout.minY) / layout.range) * (layout.height - layout.padTop - layout.padBottom);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBars(ctx, values, color, count, layout) {
  const barW = Math.max(4, ((layout.width - layout.padLeft - layout.padRight) / Math.max(count, 1)) * 0.45);
  values.forEach((value, idx) => {
    const x = toChartX(idx, count, layout.width, layout.padLeft, layout.padRight) - (barW / 2);
    const y = layout.height - layout.padBottom - ((value - layout.minY) / layout.range) * (layout.height - layout.padTop - layout.padBottom);
    const y0 = layout.height - layout.padBottom - ((0 - layout.minY) / layout.range) * (layout.height - layout.padTop - layout.padBottom);
    const top = Math.min(y, y0);
    const h = Math.abs(y0 - y);
    ctx.fillStyle = color;
    ctx.fillRect(x, top, barW, Math.max(h, 1));
  });
}

function onChartHoverMove(event) {
  if (!chartLayout || !chartRows.length) return;
  const rect = airbnbChart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const usable = chartLayout.plotW;
  const ratio = clamp((x - chartLayout.padLeft) / Math.max(usable, 1), 0, 1);
  chartHoverIndex = Math.round(ratio * (chartLayout.count - 1));
  renderChart(chartRows);
}

function onChartHoverLeave() {
  chartHoverIndex = null;
  renderChart(chartRows);
}

function toChartX(index, count, width, padLeft, padRight) {
  if (count <= 1) return padLeft;
  return padLeft + (index / (count - 1)) * (width - padLeft - padRight);
}

function resizeAirbnbChartCanvas() {
  const ctx = airbnbChart.getContext('2d');
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const cssWidth = Math.max(Math.round(airbnbChart.clientWidth || 960), 320);
  const cssHeight = Math.max(Number(airbnbChart.dataset.chartHeight || 460), 320);
  const internalWidth = Math.round(cssWidth * dpr);
  const internalHeight = Math.round(cssHeight * dpr);

  if (airbnbChart.width !== internalWidth || airbnbChart.height !== internalHeight) {
    airbnbChart.width = internalWidth;
    airbnbChart.height = internalHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, cssWidth, cssHeight };
}

function onChartResize() {
  if (!chartRows.length) return;
  renderChart(chartRows);
}

function exportPdfReport() {
  if (!lastReport) return;
  if (lastReport?.projection?.rows?.length) {
    renderChart(lastReport.projection.rows);
  }
  const chartImage = airbnbChart ? airbnbChart.toDataURL('image/png') : '';
  const rows = lastReport.projection?.rows || [];
  const win = window.open('', '_blank');
  if (!win) return;
  const html = `
<!doctype html><html><head><meta charset="utf-8"><title>Rapport Airbnb Rentium</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#111}
h1{margin:0 0 8px} h2{margin:16px 0 8px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #ddd;padding:6px;text-align:left}
.kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.box{border:1px solid #ddd;padding:8px;border-radius:8px}
</style></head><body>
<h1>Rentium Airbnb - Rapport</h1>
<p>Genere le ${new Date(lastReport.generatedAt).toLocaleString('fr-FR')}</p>
<div class="kpi">
  <div class="box"><strong>Plan</strong><br>${escapeHtml(labelPlan(lastReport.plan))}</div>
  <div class="box"><strong>Net mensuel apres impot</strong><br>${escapeHtml(formatCurrency((lastReport.fiscal?.selectedNetAfterTax || 0) / 12))}</div>
  <div class="box"><strong>Cumul projection</strong><br>${escapeHtml(formatCurrency(lastReport.projection?.totalAfterTax || 0))}</div>
</div>
${lastReport.uncertainty ? `<p><strong>Marge d erreur estimee:</strong> ${escapeHtml(lastReport.uncertainty.message)}</p>` : ''}
${chartImage ? `<h2>Graphique</h2><img src="${chartImage}" style="max-width:100%;border:1px solid #ddd;border-radius:8px;" />` : ''}
<h2>Projection</h2>
<table><thead><tr><th>Annee</th><th>CA</th><th>Charges</th><th>Impot</th><th>Net apres impot</th><th>Cumul</th></tr></thead>
<tbody>
${rows.map((row) => `<tr><td>${row.year}</td><td>${formatCurrency(row.grossRevenue)}</td><td>${formatCurrency(row.operatingCashCosts)}</td><td>${formatCurrency(row.selectedTax)}</td><td>${formatCurrency(row.selectedNetAfterTax)}</td><td>${formatCurrency(row.cumulative)}</td></tr>`).join('')}
</tbody></table>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function saveScenario() {
  const hasEssential = currentPlan === 'essential' || currentPlan === 'pro';
  if (!hasEssential) return;
  const data = readInputs();
  const controls = readProControls();
  const evalData = evaluateScenario(data, controls);
  const name = window.prompt('Nom du scenario Airbnb :', `Scenario ${airbnbScenarios.length + 1}`);
  if (!name) return;

  const scenario = {
    id: cryptoRandomId(),
    name: String(name).trim().slice(0, 100) || `Scenario ${airbnbScenarios.length + 1}`,
    createdAt: new Date().toISOString(),
    inputs: data,
    controls,
    previewMonthlyAfterTax: evalData.monthlyAfterTax,
    previewScore: evalData.score,
    previewMode: evalData.selectedMode
  };
  airbnbScenarios.unshift(scenario);
  airbnbScenarios = airbnbScenarios.slice(0, 100);
  persistAirbnbScenarios();
  renderScenarios();
}

function onScenariosClick(event) {
  if (!(event.target instanceof Element)) return;
  const loadBtn = event.target.closest('[data-load-scenario]');
  if (loadBtn) {
    loadScenario(String(loadBtn.getAttribute('data-load-scenario') || ''));
    return;
  }
  const delBtn = event.target.closest('[data-delete-scenario]');
  if (delBtn) {
    deleteScenario(String(delBtn.getAttribute('data-delete-scenario') || ''));
  }
}

function onScenariosChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== 'checkbox' || !target.hasAttribute('data-compare-scenario')) return;
  const scenarioId = String(target.getAttribute('data-compare-scenario') || '');
  if (!scenarioId) return;
  if (target.checked) {
    if (selectedScenarioIds.size >= 3) {
      target.checked = false;
      return;
    }
    selectedScenarioIds.add(scenarioId);
  } else {
    selectedScenarioIds.delete(scenarioId);
  }
  renderScenarios();
}

function loadScenario(id) {
  const scenario = airbnbScenarios.find((s) => s.id === id);
  if (!scenario || !form) return;
  Object.entries(scenario.inputs || {}).forEach(([key, value]) => {
    const el = form.elements.namedItem(key);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.value = String(value);
    }
  });
  if (dynamicPricingUplift) dynamicPricingUplift.value = String((scenario.controls?.uplift ?? 0) * 100);
  if (seasonalityIndex) seasonalityIndex.value = String(scenario.controls?.seasonality ?? seasonalityIndex.value);
  if (cityTaxRate) cityTaxRate.value = String((scenario.controls?.cityTax ?? 0) * 100);
  if (projectionYears) projectionYears.value = String(scenario.controls?.years ?? projectionYears.value);
  if (annualRevenueGrowth) annualRevenueGrowth.value = String((scenario.controls?.revenueGrowth ?? 0) * 100);
  if (annualCostGrowth) annualCostGrowth.value = String((scenario.controls?.costGrowth ?? 0) * 100);
  if (fiscalityEnabledToggle) {
    fiscalityEnabledToggle.checked = scenario.inputs?.fiscalityEnabled !== false;
    updateFiscalityState();
  }
  render();
}

function deleteScenario(id) {
  airbnbScenarios = airbnbScenarios.filter((s) => s.id !== id);
  selectedScenarioIds.delete(id);
  persistAirbnbScenarios();
  renderScenarios();
}

function renderScenarios() {
  if (!scenariosList) return;
  selectedScenarioIds = new Set([...selectedScenarioIds].filter((id) => airbnbScenarios.some((scenario) => scenario.id === id)));
  if (compareScenariosBtn) {
    const selectedCount = selectedScenarioIds.size;
    compareScenariosBtn.disabled = selectedCount < 2 || selectedCount > 3;
    compareScenariosBtn.textContent = selectedCount
      ? `Comparer (${selectedCount}/3)`
      : 'Comparer (2-3)';
  }
  if (!airbnbScenarios.length) {
    scenariosList.innerHTML = '<p class="note">Aucun scenario Airbnb sauvegarde.</p>';
    if (comparisonArea) comparisonArea.innerHTML = '';
    return;
  }

  scenariosList.innerHTML = airbnbScenarios.map((scenario) => `
    <article class="scenario-row">
      <div>
        <label class="scenario-compare">
          <input type="checkbox" data-compare-scenario="${escapeHtml(scenario.id)}" ${selectedScenarioIds.has(scenario.id) ? 'checked' : ''}>
          <span>Ajouter a la comparaison</span>
        </label>
        <h4>${escapeHtml(scenario.name)}</h4>
        <p>Cashflow net apercu: <strong>${escapeHtml(formatCurrency(scenario.previewMonthlyAfterTax || 0))} / mois</strong> | Score: <strong>${Math.round(Number(scenario.previewScore || 0))}/100</strong> | Regime: <strong>${escapeHtml(modeLabel(scenario.previewMode || 'auto'))}</strong> | ${new Date(scenario.createdAt).toLocaleString('fr-FR')}</p>
      </div>
      <div class="scenario-actions">
        <button type="button" class="ghost" data-load-scenario="${escapeHtml(scenario.id)}">Charger</button>
        <button type="button" class="ghost" data-delete-scenario="${escapeHtml(scenario.id)}">Supprimer</button>
      </div>
    </article>
  `).join('');

  renderScenariosComparison();
}

function renderScenariosComparison() {
  if (!comparisonArea) return;
  const selected = airbnbScenarios.filter((scenario) => selectedScenarioIds.has(scenario.id)).slice(0, 3);
  if (selected.length < 2) {
    comparisonArea.innerHTML = '<p class="note">Selectionne 2 a 3 scenarios pour afficher le comparateur.</p>';
    return;
  }

  const evaluated = selected.map((scenario) => {
    const data = scenario.inputs || {};
    const controls = scenario.controls || readProControls();
    const base = computeBaseAirbnb(data, controls);
    const fiscal = computeFiscalComparison(data, base);
    const projection = computeProjection(data, base, controls);
    return {
      name: scenario.name,
      annualRevenue: base.grossRevenue,
      annualCosts: base.operatingCashCosts,
      annualTax: fiscal.selectedTax,
      monthlyAfterTax: fiscal.selectedNetAfterTax / 12,
      score: projection.score,
      mode: fiscal.selectedMode
    };
  });

  comparisonArea.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Indicateur</th>
          ${evaluated.map((item) => `<th>${escapeHtml(item.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr><td>Cashflow net / mois</td>${evaluated.map((item) => `<td>${escapeHtml(formatCurrency(item.monthlyAfterTax))}</td>`).join('')}</tr>
        <tr><td>Revenus annuels</td>${evaluated.map((item) => `<td>${escapeHtml(formatCurrency(item.annualRevenue))}</td>`).join('')}</tr>
        <tr><td>Charges annuelles</td>${evaluated.map((item) => `<td>${escapeHtml(formatCurrency(item.annualCosts))}</td>`).join('')}</tr>
        <tr><td>Impot annuel</td>${evaluated.map((item) => `<td>${escapeHtml(formatCurrency(item.annualTax))}</td>`).join('')}</tr>
        <tr><td>Regime retenu</td>${evaluated.map((item) => `<td>${escapeHtml(modeLabel(item.mode))}</td>`).join('')}</tr>
        <tr><td>Airbnb Score Pro</td>${evaluated.map((item) => `<td>${Math.round(item.score)}/100</td>`).join('')}</tr>
      </tbody>
    </table>
  `;
}

function readSavedAirbnbScenarios() {
  try {
    const raw = localStorage.getItem(AIRBNB_SCENARIOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistAirbnbScenarios() {
  try {
    localStorage.setItem(AIRBNB_SCENARIOS_KEY, JSON.stringify(airbnbScenarios));
  } catch {
    // ignore storage failures
  }
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `scn_${Date.now()}_${Math.round(Math.random() * 1e8)}`;
}

function evaluateScenario(data, controls) {
  const base = computeBaseAirbnb(data, controls);
  const fiscal = computeFiscalComparison(data, base);
  const projection = computeProjection(data, base, controls);
  return {
    monthlyAfterTax: fiscal.selectedNetAfterTax / 12,
    score: projection.score,
    selectedMode: fiscal.selectedMode
  };
}

function computeMonthlyAfterTax(data, controls) {
  const base = computeBaseAirbnb(data, controls);
  const fiscal = computeFiscalComparison(data, base);
  return fiscal.selectedNetAfterTax / 12;
}

function computeAirbnbUncertaintyRange(data, controls) {
  const central = computeMonthlyAfterTax(data, controls);
  const prudentData = {
    ...data,
    occupancyRate: clamp(data.occupancyRate - 8, 0, 100),
    nightlyRate: data.nightlyRate * 0.9,
    platformFeeRate: clamp(data.platformFeeRate + 1.5, 0, 30),
    conciergeRate: clamp(data.conciergeRate + 2, 0, 40),
    fixedMonthlyCosts: data.fixedMonthlyCosts * 1.12,
    suppliesPerTurnover: data.suppliesPerTurnover * 1.15
  };
  const optimisticData = {
    ...data,
    occupancyRate: clamp(data.occupancyRate + 5, 0, 100),
    nightlyRate: data.nightlyRate * 1.06,
    platformFeeRate: clamp(data.platformFeeRate - 0.8, 0, 30),
    conciergeRate: clamp(data.conciergeRate - 1.5, 0, 40),
    fixedMonthlyCosts: data.fixedMonthlyCosts * 0.94,
    suppliesPerTurnover: data.suppliesPerTurnover * 0.92
  };

  const prudent = computeMonthlyAfterTax(prudentData, controls);
  const optimistic = computeMonthlyAfterTax(optimisticData, controls);
  const low = Math.min(prudent, optimistic, central);
  const high = Math.max(prudent, optimistic, central);
  const spread = high - low;
  const ref = Math.max(Math.abs(central), 1);
  const spreadRatio = spread / ref;
  const confidence = spreadRatio <= 0.2 ? 'elevee' : (spreadRatio <= 0.4 ? 'moyenne' : 'faible');

  return {
    low,
    high,
    central,
    spread,
    confidence,
    message: `${formatCurrency(low)} a ${formatCurrency(high)} / mois (estimation centrale: ${formatCurrency(central)} / mois, confiance ${confidence})`
  };
}

function renderUncertainty(range) {
  if (!uncertaintyBox || !range) return;
  uncertaintyBox.textContent = `Marge d erreur estimee (variantes de parametres): ${range.message}`;
}

function generateInvestmentRecommendations(data, controls, baseline, limit = 6) {
  const candidates = [
    {
      title: 'Ameliorer l occupation (+5 pts)',
      effort: 'Moyen',
      assumptions: 'Optimisation annonce + check-in',
      target: `${clamp(data.occupancyRate + 5, 0, 100).toFixed(1)} %`,
      apply: (d) => ({ ...d, occupancyRate: clamp(d.occupancyRate + 5, 0, 100) })
    },
    {
      title: 'Ajuster le prix nuit (+8%)',
      effort: 'Moyen',
      assumptions: 'Pricing dynamique et weekends',
      target: formatCurrency(data.nightlyRate * 1.08),
      apply: (d) => ({ ...d, nightlyRate: d.nightlyRate * 1.08 })
    },
    {
      title: 'Baisser la conciergerie (-2 pts)',
      effort: 'Moyen',
      assumptions: 'Renegociation mandat',
      target: `${Math.max(data.conciergeRate - 2, 0).toFixed(1)} %`,
      apply: (d) => ({ ...d, conciergeRate: Math.max(d.conciergeRate - 2, 0) })
    },
    {
      title: 'Reduire charges fixes (-10%)',
      effort: 'Moyen',
      assumptions: 'Optimisation contrats',
      target: formatCurrency(data.fixedMonthlyCosts * 0.9),
      apply: (d) => ({ ...d, fixedMonthlyCosts: d.fixedMonthlyCosts * 0.9 })
    },
    {
      title: 'Augmenter jours ouverts (+20)',
      effort: 'Faible',
      assumptions: 'Limiter indisponibilites',
      target: `${Math.min(data.openDays + 20, 365)} jours`,
      apply: (d) => ({ ...d, openDays: Math.min(d.openDays + 20, 365) })
    },
    {
      title: 'Fiscalite en mode Auto',
      effort: 'Faible',
      assumptions: 'Selection du meilleur net',
      target: 'Auto',
      apply: (d) => ({ ...d, fiscalMode: 'auto' })
    }
  ];

  const scored = candidates.map((candidate) => {
    const nextData = candidate.apply(data);
    const nextEval = evaluateScenario(nextData, controls);
    return {
      ...candidate,
      deltaScore: nextEval.score - baseline.score,
      deltaMonthlyAfterTax: nextEval.monthlyAfterTax - baseline.monthlyAfterTax,
      nextMode: modeLabel(nextEval.selectedMode)
    };
  }).filter((item) => item.deltaScore > 0.2 || item.deltaMonthlyAfterTax > 15);

  return scored
    .sort((a, b) => (b.deltaScore - a.deltaScore) || (b.deltaMonthlyAfterTax - a.deltaMonthlyAfterTax))
    .slice(0, limit);
}

function renderRecommendations(recos) {
  if (!recoList) return;
  if (!recos.length) {
    recoList.innerHTML = '<article class="reco-item"><h4>Aucune optimisation differenciante</h4><p>Les reglages actuels sont deja proches du meilleur compromis sur ce moteur.</p></article>';
    return;
  }

  recoList.innerHTML = recos.map((reco, index) => `
    <article class="reco-item">
      <h4>${index + 1}. ${escapeHtml(reco.title)} <span class="note">(${escapeHtml(reco.effort)})</span></h4>
      <p>Objectif: <strong>${escapeHtml(reco.target)}</strong> | Delta score: <strong>+${reco.deltaScore.toFixed(1)} pts</strong> | Delta net: <strong>${formatSignedCurrency(reco.deltaMonthlyAfterTax)} / mois</strong></p>
      <p>Hypothese: ${escapeHtml(reco.assumptions)} | Regime projete: ${escapeHtml(reco.nextMode)}</p>
    </article>
  `).join('');
}

function applyInitialCityPreset() {
  if (!cityPresetSelect) return;
  const key = String(cityPresetSelect.value || 'none');
  applyCityPreset(key, { silent: true });
}

function onCityPresetChange() {
  const key = String(cityPresetSelect?.value || 'none');
  updateCityInfoOnly(key);
}

function onCityPresetApplyClick() {
  const key = String(cityPresetSelect?.value || 'none');
  applyCityPreset(key);
}

function onFiscalityToggleChange() {
  updateFiscalityState();
  render();
}

function updateFiscalityState() {
  if (!fiscalVariablesWrap) return;
  const enabled = fiscalityEnabledToggle ? fiscalityEnabledToggle.checked : true;
  fiscalVariablesWrap.classList.toggle('fiscal-variables-disabled', !enabled);
  fiscalVariablesWrap.querySelectorAll('input, select').forEach((el) => {
    el.disabled = !enabled;
  });
}

async function applyCityPreset(key, options = {}) {
  if (!form) return;

  const preset = CITY_OFFICIAL_PRESETS[key];
  const defaults = key === 'none' ? NEUTRAL_DEFAULTS : preset?.defaults;
  if (!defaults) return;

  const pairs = Object.entries(defaults);
  pairs.forEach(([field, value]) => {
    const input = form.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.value = String(value);
  });

  await updateCityInfoOnly(key);
  if (!options.silent) render();
}

async function updateCityInfoOnly(key) {
  if (!cityDataInfo) return;
  if (key === 'none') {
    cityDataInfo.textContent = 'Mode neutre actif: aucune ville de reference appliquee.';
    return;
  }

  const preset = CITY_OFFICIAL_PRESETS[key];
  if (!preset) return;
  const population = await fetchCityPopulation(preset.label);
  const popText = population > 0
    ? `Population INSEE API: ${new Intl.NumberFormat('fr-FR').format(population)} hab.`
    : 'Population INSEE API: indisponible.';

  cityDataInfo.textContent = `${preset.label} - Source officielle Insee Premiere n°1879 (donnees 2019): `
    + `${new Intl.NumberFormat('fr-FR').format(preset.insee.annualNights)} nuitees annuelles, `
    + `${new Intl.NumberFormat('fr-FR').format(preset.insee.dailyNights)} nuitees/jour, `
    + `${new Intl.NumberFormat('fr-FR').format(preset.insee.nightsPer1000)} nuitees/jour/1000 hab, `
    + `${Math.round(preset.insee.nonResidentShare * 100)}% non-residents. `
    + `${popText}`;
}

async function fetchCityPopulation(cityName) {
  try {
    const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(cityName)}&boost=population&limit=1&fields=nom,population`;
    const response = await fetch(url);
    if (!response.ok) return 0;
    const payload = await response.json();
    if (!Array.isArray(payload) || !payload.length) return 0;
    return Number(payload[0]?.population || 0);
  } catch {
    return 0;
  }
}

function renderMetric(label, value) {
  const item = document.createElement('article');
  item.className = 'metric';
  item.innerHTML = `<h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p>`;
  metrics.appendChild(item);
}

function renderProMetric(label, value, extraClass = '') {
  const item = document.createElement('article');
  item.className = `metric ${extraClass}`.trim();
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
  if (mode === 'no-tax') return 'Fiscalite desactivee';
  if (mode === 'lmnp-micro') return 'LMNP Micro-BIC';
  if (mode === 'lmnp-reel') return 'LMNP Reel';
  if (mode === 'lmp-micro') return 'LMP Micro-BIC';
  if (mode === 'lmp-reel') return 'LMP Reel';
  if (mode === 'sci-is') return 'Societe (IS)';
  return 'Regime';
}

function scoreToneClass(score) {
  const value = Number(score || 0);
  if (value < 35) return 'score-tone-red';
  if (value < 55) return 'score-tone-orange';
  if (value < 75) return 'score-tone-yellow';
  return 'score-tone-green';
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

function formatSignedCurrency(value) {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
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
