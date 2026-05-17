/* ============================================================
   Meshy Pricing — Interactions
   ============================================================ */

// ---------- Billing toggle ----------
(function () {
  const toggle = document.getElementById('billing-toggle');
  if (!toggle) return;
  const slider = toggle.querySelector('.slider');
  const buttons = toggle.querySelectorAll('button');
  let currentMode = 'monthly';

  function positionSlider() {
    const activeBtn = toggle.querySelector('button.active');
    if (!activeBtn) return;
    const rect = activeBtn.getBoundingClientRect();
    const parentRect = toggle.getBoundingClientRect();
    slider.style.left = (rect.left - parentRect.left) + 'px';
    slider.style.width = rect.width + 'px';
  }

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    buttons.forEach(b => b.classList.toggle('active', b.dataset.bill === mode));
    positionSlider();

    // Animate price digits
    document.querySelectorAll('.amount[data-monthly]').forEach(el => {
      const newVal = el.dataset[mode];
      if (el.textContent === newVal) return;
      el.classList.remove('is-changing');
      void el.offsetWidth;
      el.classList.add('is-changing');
      el.textContent = newVal;
    });
    document.querySelectorAll('.price-sub[data-monthly]').forEach(el => {
      el.innerHTML = el.dataset[mode];
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.bill));
  });

  window.addEventListener('load', positionSlider);
  window.addEventListener('resize', positionSlider);
  setTimeout(positionSlider, 50);
})();

// ---------- Credit Calculator ----------
(function () {
  const slider = document.getElementById('calc-slider');
  if (!slider) return;
  const readout = document.getElementById('calc-readout');
  const sub = document.getElementById('calc-sub');
  const recPanel = document.getElementById('calc-rec');
  const recTier = document.getElementById('rec-tier');
  const recWhy = document.getElementById('rec-why');
  const recCredits = document.getElementById('rec-credits');
  const recConcurrent = document.getElementById('rec-concurrent');
  const recPrice = document.getElementById('rec-price');
  const recSavings = document.getElementById('rec-savings');

  // ~10 credits per asset (matching prototype assumption)
  const tiers = [
    { id: 'free',       name: 'Free',       credits: 100,  concurrent: 1,  price: 0,    yearly: 0,   max: 10  },
    { id: 'pro',        name: 'Pro',        credits: 1000, concurrent: 10, price: 20,   yearly: 16,  max: 100 },
    { id: 'pro-plus',   name: 'Pro Plus',   credits: 2500, concurrent: 15, price: 35,   yearly: 28,  max: 250 },
    { id: 'studio',     name: 'Studio',     credits: 4000, concurrent: 20, price: 60,   yearly: 48,  max: 400 },
    { id: 'enterprise', name: 'Enterprise', credits: null, concurrent: null, price: null, yearly: null, max: Infinity },
  ];

  const whyCopy = {
    'free':       "100 credits/month is plenty if you're just trying things out — no card required.",
    'pro':        "Pro covers most solo workflows — high queue priority, commercial license, API access.",
    'pro-plus':   "Your output level is exactly where Pro Plus is designed to live — extra credits, concurrency, and privacy without paying for a team.",
    'studio':    "You're moving more than 250 assets/mo — Studio gives you team workspaces and shared credits at a per-seat rate.",
    'enterprise': "At this volume, Enterprise's custom credit balance, SSO, and dedicated support pay for themselves.",
  };

  function pickTier(assets) {
    if (assets <= 10) return tiers[0];
    if (assets <= 100) return tiers[1];
    if (assets <= 250) return tiers[2];
    if (assets <= 400) return tiers[3];
    return tiers[4];
  }

  function update() {
    const assets = +slider.value;
    readout.textContent = assets >= 500 ? '500+' : assets;
    sub.textContent = `~${assets * 10} credits/month`;

    const tier = pickTier(assets);
    recPanel.className = 'calc-rec is-' + tier.id;
    recTier.textContent = tier.name;
    recWhy.textContent = whyCopy[tier.id];

    if (tier.id === 'enterprise') {
      recCredits.textContent = 'Custom';
      recConcurrent.textContent = '50+';
      recPrice.textContent = 'Talk to us';
      recSavings.textContent = '—';
    } else {
      recCredits.textContent = tier.credits.toLocaleString();
      recConcurrent.textContent = tier.concurrent;
      recPrice.textContent = tier.price === 0 ? 'Free' : `$${tier.yearly}/mo`;
      recSavings.textContent = tier.price === 0 ? '—' : `Save $${(tier.price - tier.yearly) * 12}/yr`;
    }
  }

  slider.addEventListener('input', update);
  update();
})();

// ---------- FAQ accordion ----------
(function () {
  document.querySelectorAll('.faq-item .q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      // Close siblings for a tidier accordion
      document.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
})();

// ---------- Compare table — column highlight + tooltips ----------
(function () {
  const table = document.querySelector('.compare-table');
  if (!table) return;

  // Hover-highlight column when hovering a header cell
  const headers = table.querySelectorAll('thead th');
  headers.forEach((th, idx) => {
    if (idx === 0) return;
    th.style.cursor = 'pointer';
    th.addEventListener('mouseenter', () => highlightCol(idx, true));
    th.addEventListener('mouseleave', () => highlightCol(idx, false));
  });

  function highlightCol(idx, on) {
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells[idx]) {
        cells[idx].style.background = on ? 'rgba(255,255,255,0.04)' : '';
      }
    });
  }
})();

// ---------- Subtle reveal-on-scroll ----------
(function () {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
})();
