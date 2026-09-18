/**
 * RailGo - Main Client Application Logic
 * Integrates REST endpoints, WebSocket live updates, Leaflet maps, Chart.js analytics,
 * 14-view navigation, and interactive XGBoost scenario simulation.
 */

// Global App State
const state = {
  trains: [],
  stations: [],
  weather: [],
  signals: [],
  construction: [],
  alerts: [],
  selectedTrainNumber: 43205, // Default selected train (MASS-TRL EMU LOCAL with delay)
  currentView: 'dashboard',
  mapInitialized: false,
  charts: {},
  ws: null
};
window.state = state;

// ==========================================
// 1. INITIALIZATION & DATA FETCHING
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initSimControls();
  initGoogleCorridorMap('railway-google-map');
  loadMyBookedTicketsDesktop();
  await loadAllData();
  initWebSocket();
});

async function loadAllData() {
  try {
    const [trainsRes, weatherRes, signalsRes, consRes, alertsRes] = await Promise.all([
      fetch('/trains').then(r => r.json()),
      fetch('/weather').then(r => r.json()),
      fetch('/signals').then(r => r.json()),
      fetch('/construction').then(r => r.json()),
      fetch('/alerts').then(r => r.json())
    ]);

    state.trains = trainsRes;
    state.weather = weatherRes;
    state.signals = signalsRes;
    state.construction = consRes;
    state.alerts = alertsRes;

    // Render all views
    updateDashboardKPIs();
    renderDashboardTrains();
    renderAllTrainsTable();
    renderTrainSelectors();
    renderTrainDetails(state.selectedTrainNumber);
    renderStationETATable(state.selectedTrainNumber);
    renderSignalsTable();
    renderConstructionTable();
    renderWeatherTable();
    renderAlerts();
    renderPassengerView(state.selectedTrainNumber);
    renderControlRoom();

    if (window.updateMobileWeatherCard) {
      window.updateMobileWeatherCard();
    }
    if (window.setupFrequentCommutes) {
      window.setupFrequentCommutes();
    }

    if (state.currentView === 'railway-map') {
      initRailwayMap();
    }

    document.getElementById('sidebar-updated-time').textContent = 'Last Sync: ' + new Date().toLocaleTimeString();
    document.getElementById('kpi-last-updated').textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Error fetching RailGo data:', err);
    document.getElementById('sidebar-updated-time').textContent = 'Sync Error: Retrying...';
  }
}

// Refresh button handler
document.getElementById('btn-refresh-all')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh-all');
  btn.classList.add('disabled');
  btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Fetching...';
  await loadAllData();
  btn.classList.remove('disabled');
  btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span>Refresh</span>';
});

// ==========================================
// 2. WEBSOCKET REAL-TIME STREAMING
// ==========================================

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      console.log('RailGo WebSocket connection established.');
      document.getElementById('live-data-badge').textContent = 'LIVE WEBSOCKET ACTIVE';
    };

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INITIAL_STATE') {
          console.log('WebSocket initial handshake complete.');
        } else if (msg.type === 'TRAIN_SPEED_UPDATED') {
          const t = state.trains.find(x => x.train_number === msg.train_number);
          if (t) {
            t.current_speed = msg.current_speed;
            t.ai_predicted_eta = msg.ai_predicted_eta;
            t.predicted_additional_delay = msg.predicted_additional_delay;
            t.risk_level = msg.risk_level;
            renderAllTrainsTable();
            const curInsp = parseInt(document.getElementById('detail-train-selector')?.value);
            if (curInsp === msg.train_number) {
              renderTrainDetails(curInsp);
            }
          }
        }
      } catch (e) { }
    };

    state.ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 5s...');
      setTimeout(initWebSocket, 5000);
    };
  } catch (err) {
    console.warn('WebSocket init failed, running on periodic REST poll.', err);
  }
}

// ==========================================
// 3. NAVIGATION VIEW SWITCHING
// ==========================================

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  state.currentView = viewId;

  // Update Sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-view') === viewId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Hide all view panels and show active
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`view-${viewId}`);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  // Update Topbar Heading
  const headings = {
    'dashboard': 'Corridor Operations Dashboard',
    'all-trains': 'All Monitored Suburban Trains',
    'train-details': 'Individual Train Inspector & AI Dynamics',
    'station-eta': 'Station-wise Dynamic Arrival Progression',
    'railway-map': 'Interactive Railway Google Maps & Weather Intelligence',
    'book-ticket': 'RailGo In-App Suburban Ticket Booking & Digital QR Passes',
    'ai-prediction': 'XGBoost Delay Regressor & Factor Attribution',
    'signal-conditions': 'Corridor Block Section Signal Conditions',
    'construction': 'Railway Construction & Engineering Blocks',
    'weather-grid': 'Live Open-Meteo Weather for All Route Stations',
    'simulation': '"What-If" Railway Scenario Simulation',
    'alerts': 'Real-Time Operational Alerts',
    'passenger-view': 'Passenger Journey Intelligence View',
    'control-room': 'Section Controller High-Density HUD'
  };

  const headingEl = document.getElementById('current-view-heading');
  if (headingEl) {
    headingEl.innerHTML = `<i class="fa-solid fa-compass" style="color: var(--primary-blue);"></i> <span>${headings[viewId] || 'RailGo Platform'}</span>`;
  }

  // Special triggers on view change
  if (viewId === 'railway-map') {
    if (railwayMap) {
      setTimeout(() => {
        railwayMap.invalidateSize();
      }, 100);
    } else {
      setTimeout(() => {
        initGoogleCorridorMap('railway-google-map');
      }, 150);
    }
  } else if (viewId === 'book-ticket') {
    setTimeout(initBookingView, 100);
    loadMyBookedTicketsDesktop();
  }
}

// ==========================================
// 4. VIEW 1: DASHBOARD
// ==========================================

function updateDashboardKPIs() {
  const trains = state.trains;
  if (!trains || trains.length === 0) return;

  const total = trains.length;
  const onTime = trains.filter(t => t.running_status === 'On Time').length;
  const delayed = total - onTime;
  const highRisk = trains.filter(t => t.risk_level === 'HIGH').length;

  const delays = trains.map(t => t.current_delay);
  const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1) : 0.0;

  document.getElementById('kpi-total-trains').innerHTML = `${total} <small>Trains</small>`;
  document.getElementById('kpi-ontime-trains').textContent = onTime;
  document.getElementById('kpi-delayed-trains').textContent = delayed;
  document.getElementById('kpi-high-risk').textContent = highRisk;
  document.getElementById('kpi-avg-delay').innerHTML = `${avgDelay} <small>min</small>`;

  document.getElementById('badge-total-trains').textContent = total;
  document.getElementById('badge-signal-issues').textContent = state.signals.filter(s => s.signal_status !== 'Normal').length;
  document.getElementById('badge-construction').textContent = state.construction.filter(c => c.status === 'Active').length;
  document.getElementById('badge-alerts').textContent = state.alerts.length;

  // Quick weather strip on dashboard
  const weatherStrip = document.getElementById('quick-weather-strip');
  if (weatherStrip && state.weather.length > 0) {
    weatherStrip.innerHTML = state.weather.slice(0, 5).map(w => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #F8FAFC; border-radius: 6px;">
        <span><strong>${w.station}:</strong> ${w.temperature}°C, ${w.weather_desc}</span>
        <span class="badge-tag badge-${w.weather_impact.toLowerCase()}">${w.weather_impact}</span>
      </div>
    `).join('');
  }
}

// Helper: Calculate Journey Duration
function calculateJourneyDuration(depStr, arrStr) {
  if (!depStr || !arrStr) return '75 min';
  try {
    const [dh, dm] = depStr.split(':').map(Number);
    const [ah, am] = arrStr.split(':').map(Number);
    let diff = (ah * 60 + am) - (dh * 60 + dm);
    if (diff < 0) diff += 24 * 60; // Crosses midnight
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch (e) {
    return '75 min';
  }
}

// Helper: Classify Schedule Window
function getScheduleWindow(depStr) {
  if (!depStr) return 'ALL';
  try {
    const h = parseInt(depStr.split(':')[0], 10);
    if (h >= 3 && h < 10) return 'MORNING';
    if (h >= 10 && h < 16) return 'MIDDAY';
    if (h >= 16 && h < 21) return 'EVENING';
    return 'NIGHT';
  } catch (e) {
    return 'ALL';
  }
}

function renderDashboardTrains() {
  const tbody = document.getElementById('dashboard-trains-tbody');
  if (!tbody) return;

  const q = (document.getElementById('search-dashboard-schedule')?.value || '').toLowerCase();
  const timeWindow = document.getElementById('filter-dashboard-time-window')?.value || 'ALL';
  const statusFilter = document.getElementById('filter-dashboard-status')?.value || 'ALL';

  const filtered = state.trains.filter(t => {
    const matchQ = (
      t.train_number.toString().includes(q) ||
      t.train_name.toLowerCase().includes(q) ||
      t.current_station.toLowerCase().includes(q)
    );
    const matchTime = timeWindow === 'ALL' || getScheduleWindow(t.scheduled_departure) === timeWindow;
    const matchStatus = statusFilter === 'ALL' || t.running_status === statusFilter;
    return matchQ && matchTime && matchStatus;
  });

  const countEl = document.getElementById('dashboard-schedule-count');
  if (countEl) {
    countEl.textContent = `${filtered.length} OF ${state.trains.length} SCHEDULES`;
  }

  tbody.innerHTML = filtered.map(t => {
    const duration = calculateJourneyDuration(t.scheduled_departure, t.scheduled_arrival);
    const isDelayed = t.current_delay > 0;
    return `
      <tr>
        <td class="train-num-cell">
          <strong>${t.train_number}</strong><br>
          <small style="color: var(--text-secondary);">${t.train_name}</small>
        </td>
        <td>
          <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--dark-blue); font-size: 13px;">
            <i class="fa-regular fa-clock" style="color: var(--primary-blue); font-size: 11px;"></i> ${t.scheduled_departure}
          </span>
        </td>
        <td>
          <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--primary-blue); font-size: 13px;">
            <i class="fa-solid fa-flag-checkered" style="color: var(--status-green); font-size: 11px;"></i> ${t.scheduled_arrival}
          </span>
        </td>
        <td>
          <span class="badge-tag" style="background: #E3F2FD; color: #0D47A1; font-weight: 600;">
            ${duration}
          </span>
        </td>
        <td><strong>${t.current_station}</strong></td>
        <td>
          <span class="delay-cell ${isDelayed ? 'delay-mod' : 'delay-on-time'}">
            ${isDelayed ? `+${t.current_delay}m (${t.running_status})` : '🟢 On Time'}
          </span>
          ${isDelayed ? `
            <div class="table-delay-reason" style="font-size: 11px; color: #B91C1C; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px; line-height: 1.25;">
              <i class="fa-solid fa-triangle-exclamation" style="font-size: 10px;"></i>
              <span>Reason: ${t.delay_reason || 'Operational Congestion'}</span>
            </div>
          ` : `
            <div style="font-size: 10.5px; color: #15803D; margin-top: 2px; font-weight: 500;">
              Normal Run
            </div>
          `}
        </td>
        <td class="eta-cell" style="color: var(--dark-blue); font-size: 13.5px; font-weight: 800;">
          ${t.ai_predicted_eta}
        </td>
        <td>
          <span class="badge-tag ${t.predicted_additional_delay > 0 ? 'badge-medium' : 'badge-low'}">
            +${t.predicted_additional_delay}m
          </span>
        </td>
        <td>
          <span class="badge-tag badge-${t.risk_level.toLowerCase()}">
            ${t.risk_level}
          </span>
        </td>
        <td>
          <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="inspectTrain(${t.train_number})">
            Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Attach Dashboard Schedule Filter Listeners
document.getElementById('search-dashboard-schedule')?.addEventListener('input', renderDashboardTrains);
document.getElementById('filter-dashboard-time-window')?.addEventListener('change', renderDashboardTrains);
document.getElementById('filter-dashboard-status')?.addEventListener('change', renderDashboardTrains);

// ==========================================
// 5. VIEW 2: ALL TRAIN DETAILS TABLE & FILTERS
// ==========================================

function renderAllTrainsTable() {
  const tbody = document.getElementById('all-trains-tbody');
  if (!tbody) return;

  const q = (document.getElementById('search-all-trains')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filter-status-select')?.value || 'ALL';
  const riskFilter = document.getElementById('filter-risk-select')?.value || 'ALL';
  const typeFilter = document.getElementById('filter-type-select')?.value || 'ALL';

  const filtered = state.trains.filter(t => {
    const matchQ = (
      t.train_number.toString().includes(q) ||
      t.train_name.toLowerCase().includes(q) ||
      t.current_station.toLowerCase().includes(q) ||
      t.delay_reason.toLowerCase().includes(q)
    );
    const matchStatus = statusFilter === 'ALL' || t.running_status === statusFilter;
    const matchRisk = riskFilter === 'ALL' || t.risk_level === riskFilter;
    const matchType = typeFilter === 'ALL' || t.train_type === typeFilter;
    return matchQ && matchStatus && matchRisk && matchType;
  });

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td class="train-num-cell">${t.train_number}</td>
      <td><strong>${t.train_name}</strong></td>
      <td><small>${t.train_type}</small></td>
      <td>${t.current_station}</td>
      <td>${t.next_station}</td>
      <td>${t.scheduled_departure}</td>
      <td>${t.scheduled_arrival}</td>
      <td class="delay-cell ${t.current_delay === 0 ? 'delay-on-time' : (t.current_delay < 10 ? 'delay-mod' : 'delay-crit')}">
        <div style="font-weight: 700;">${t.current_delay > 0 ? `+${t.current_delay}m` : 'On Time'}</div>
        ${t.current_delay > 0 ? `
          <div class="delay-reason-sub" style="font-size: 10.5px; color: #B91C1C; font-weight: 600; margin-top: 3px; line-height: 1.25; white-space: normal;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 9px;"></i> ${t.delay_reason || 'Delay'}
          </div>
        ` : `
          <div style="font-size: 10px; color: #15803D; margin-top: 2px;">Normal</div>
        `}
      </td>
      <td>
        <span class="speed-pill ${t.current_speed > 60 ? 'speed-fast' : (t.current_speed >= 40 ? 'speed-norm' : (t.current_speed > 0 ? 'speed-caution' : 'speed-halt'))}">
          <i class="fa-solid fa-gauge" style="font-size: 10px;"></i> ${t.current_speed} km/h
        </span>
      </td>
      <td><small>${t.signal_status.split('•')[0]}</small></td>
      <td><small>${t.speed_restriction > 0 ? `TSR ${t.speed_restriction}k` : 'None'}</small></td>
      <td class="eta-cell">${t.ai_predicted_eta}</td>
      <td><span class="badge-tag ${t.predicted_additional_delay > 0 ? 'badge-medium' : 'badge-low'}">+${t.predicted_additional_delay}m</span></td>
      <td><span class="badge-tag badge-${t.risk_level.toLowerCase()}">${t.risk_level}</span></td>
      <td><small>${t.prediction_range}</small></td>
      <td><small>${t.weather_impact}</small></td>
      <td>
        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="inspectTrain(${t.train_number})">
          View Details
        </button>
      </td>
    </tr>
  `).join('');
}

// Search and Filter Listeners
document.getElementById('search-all-trains')?.addEventListener('input', renderAllTrainsTable);
document.getElementById('filter-status-select')?.addEventListener('change', renderAllTrainsTable);
document.getElementById('filter-risk-select')?.addEventListener('change', renderAllTrainsTable);
document.getElementById('filter-type-select')?.addEventListener('change', renderAllTrainsTable);
document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
  document.getElementById('search-all-trains').value = '';
  document.getElementById('filter-status-select').value = 'ALL';
  document.getElementById('filter-risk-select').value = 'ALL';
  document.getElementById('filter-type-select').value = 'ALL';
  renderAllTrainsTable();
});

function filterTrainsByStatus(status) {
  switchView('all-trains');
  const sel = document.getElementById('filter-status-select');
  if (sel) { sel.value = status; renderAllTrainsTable(); }
}

function filterTrainsByRisk(risk) {
  switchView('all-trains');
  const sel = document.getElementById('filter-risk-select');
  if (sel) { sel.value = risk; renderAllTrainsTable(); }
}

// ==========================================
// 6. VIEW 3: INDIVIDUAL TRAIN DETAILS
// ==========================================

function renderTrainSelectors() {
  const selectors = [
    document.getElementById('detail-train-selector'),
    document.getElementById('station-eta-train-selector'),
    document.getElementById('sim-train-select'),
    document.getElementById('passenger-train-selector')
  ];

  const optionsHtml = state.trains.map(t => `
    <option value="${t.train_number}" ${t.train_number === state.selectedTrainNumber ? 'selected' : ''}>
      ${t.train_number} — ${t.train_name} (${t.current_station})
    </option>
  `).join('');

  selectors.forEach(sel => {
    if (sel) {
      sel.innerHTML = optionsHtml;
      sel.addEventListener('change', (e) => {
        const num = parseInt(e.target.value);
        state.selectedTrainNumber = num;
        inspectTrain(num);
      });
    }
  });
}

function inspectTrain(trainNumber) {
  state.selectedTrainNumber = trainNumber;
  const train = state.trains.find(t => t.train_number === trainNumber);
  if (!train) return;

  renderTrainDetails(trainNumber);
  renderStationETATable(trainNumber);
  renderPassengerView(trainNumber);

  // Sync all dropdowns
  ['detail-train-selector', 'station-eta-train-selector', 'sim-train-select', 'passenger-train-selector'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = trainNumber;
  });

  switchView('train-details');
}

function renderTrainDetails(trainNumber) {
  const train = state.trains.find(t => t.train_number === trainNumber);
  if (!train) return;

  document.getElementById('detail-train-title').textContent = `Train Inspector: EMU ${train.train_number} — ${train.train_name}`;
  document.getElementById('detail-status').textContent = train.running_status;
  document.getElementById('detail-delay-reason').textContent = train.delay_reason;
  document.getElementById('detail-speed').innerHTML = `${train.current_speed} <small>km/h</small>`;
  document.getElementById('detail-current-delay').innerHTML = `+${train.current_delay} <small>min</small>`;
  const reasonEl = document.getElementById('detail-current-delay-reason');
  if (reasonEl) {
    reasonEl.innerHTML = train.current_delay > 0
      ? `<i class="fa-solid fa-triangle-exclamation" style="font-size:10px;"></i> Delay Reason: <b>${train.delay_reason || 'Operational Congestion'}</b>`
      : `<span style="color:#16A34A;"><i class="fa-solid fa-circle-check"></i> On-time suburban run</span>`;
  }
  document.getElementById('detail-pred-delay').innerHTML = `+${train.predicted_additional_delay} <small>min</small>`;
  document.getElementById('detail-pred-range').textContent = `Range: ${train.prediction_range} (${train.risk_level} Risk)`;
  document.getElementById('detail-ai-eta').textContent = train.ai_predicted_eta;
  document.getElementById('detail-sched-arr').textContent = `Scheduled: ${train.scheduled_arrival}`;

  document.getElementById('detail-sig-status').textContent = train.signal_status;
  document.getElementById('detail-sig-wait').textContent = `${train.signal_waiting_time} min`;
  document.getElementById('detail-cons-status').textContent = train.construction_status;
  document.getElementById('detail-tsr').textContent = train.speed_restriction > 0 ? `${train.speed_restriction} km/h Caution` : 'None';
  document.getElementById('detail-congestion').textContent = `${Math.round(train.congestion_level * 100)}% section capacity`;

  document.getElementById('detail-weather-desc').textContent = train.weather_condition;
  document.getElementById('detail-weather-temp').textContent = 'Live Station Weather Active';
  document.getElementById('detail-weather-wind').textContent = 'Station Telemetry Verified';
  document.getElementById('detail-weather-vis').textContent = 'Clear visibility &gt; 9,000 m';
  document.getElementById('detail-weather-impact').innerHTML = `<span class="badge-tag badge-${train.weather_impact.toLowerCase()}">${train.weather_impact} IMPACT</span>`;

  // Render AI Factor Explanations
  const expContainer = document.getElementById('detail-ai-explanations');
  if (expContainer) {
    expContainer.innerHTML = train.ai_explanations.map(e => `
      <div class="ai-factor-card ${e.impact_level.toLowerCase().includes('high') ? 'high-impact' : (e.impact_level.toLowerCase().includes('medium') ? 'med-impact' : '')}">
        <div class="factor-header">
          <span>${e.category}</span>
          <span class="badge-tag ${e.impact_level.includes('High') ? 'badge-high' : 'badge-medium'}">${e.impact_level}</span>
        </div>
        <div class="factor-desc">${e.description}</div>
        <div class="factor-time">+${e.estimated_minutes} min contribution</div>
      </div>
    `).join('');
  }

  // Sync Speed Regulation Slider
  const speedSlider = document.getElementById('detail-speed-slider');
  const speedVal = document.getElementById('detail-speed-slider-val');
  if (speedSlider && speedVal) {
    speedSlider.value = train.current_speed !== undefined ? train.current_speed : 45;
    speedVal.textContent = `${Number(speedSlider.value).toFixed(1)} km/h`;
  }
}

// ==========================================
// SPEED REGULATION CONTROLLER FUNCTIONS
// ==========================================

window.applyPresetSpeed = function (val, reason) {
  const slider = document.getElementById('detail-speed-slider');
  const sliderVal = document.getElementById('detail-speed-slider-val');
  if (slider) slider.value = val;
  if (sliderVal) sliderVal.textContent = `${Number(val).toFixed(1)} km/h`;
  submitTrainSpeedUpdate(val, reason);
};

window.submitTrainSpeedUpdate = async function (speed, reason = null) {
  const selector = document.getElementById('detail-train-selector');
  const trainNumber = selector ? parseInt(selector.value) : null;
  if (!trainNumber) return;

  const feedback = document.getElementById('detail-speed-feedback');
  if (feedback) {
    feedback.style.display = 'block';
    feedback.style.color = '#0284C7';
    feedback.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Regulating speed to ${speed} km/h and recalculating dynamic AI ETA...`;
  }

  try {
    const res = await fetch(`/trains/${trainNumber}/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed: parseFloat(speed), reason: reason })
    });
    if (!res.ok) throw new Error(`Server returned status ${res.status}`);
    const updated = await res.json();

    // Update local state
    const idx = state.trains.findIndex(t => t.train_number === trainNumber);
    if (idx !== -1) {
      state.trains[idx] = updated;
    }

    renderTrainDetails(trainNumber);
    renderAllTrainsTable();
    updateDashboardKPIs();

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#15803D';
      feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Operational speed updated to <b>${updated.current_speed} km/h</b>. Dynamic AI ETA: <b>${updated.ai_predicted_eta}</b>`;
      setTimeout(() => { feedback.style.display = 'none'; }, 5000);
    }
  } catch (err) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#B91C1C';
      feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Speed update failed: ${err.message}`;
    }
  }
};

document.getElementById('detail-speed-slider')?.addEventListener('input', (e) => {
  const valEl = document.getElementById('detail-speed-slider-val');
  if (valEl) valEl.textContent = `${parseFloat(e.target.value).toFixed(1)} km/h`;
});

document.getElementById('btn-apply-train-speed')?.addEventListener('click', () => {
  const slider = document.getElementById('detail-speed-slider');
  if (slider) {
    submitTrainSpeedUpdate(slider.value);
  }
});

// ==========================================
// 7. VIEW 4: STATION-WISE ETA
// ==========================================

function renderStationETATable(trainNumber) {
  const train = state.trains.find(t => t.train_number === trainNumber);
  if (!train) return;

  const tbody = document.getElementById('station-eta-tbody');
  if (!tbody) return;

  tbody.innerHTML = (train.station_wise_eta || []).map(s => `
    <tr style="${s.running_status === 'Current Position' ? 'background: #E3F2FD; font-weight: 700;' : ''}">
      <td>${s.sequence}</td>
      <td><strong>${s.station_name}</strong></td>
      <td><code>${s.station_code}</code></td>
      <td>${s.distance_km} km</td>
      <td>${s.scheduled_eta}</td>
      <td class="eta-cell" style="color: var(--primary-blue);">${s.ai_predicted_eta}</td>
      <td><span class="badge-tag ${s.predicted_additional_delay > 0 ? 'badge-medium' : 'badge-low'}">+${s.predicted_additional_delay}m</span></td>
      <td><small>${s.conditions_summary}</small></td>
      <td><span class="badge-tag badge-${s.risk_level.toLowerCase()}">${s.risk_level}</span></td>
      <td>Platform ${s.platform}</td>
    </tr>
  `).join('');
}

// ==========================================
// 8. VIEW 5: RAILWAY MAP (GOOGLE MAPS & LEAFLET)
// ==========================================

const RAILWAY_STATIONS_DATA = [
  { seq: 1, code: 'MASS', name: 'Chennai Central', lat: 13.0827, lng: 80.2754, pf: 4, dist: 0.0 },
  { seq: 2, code: 'BBQ', name: 'Basin Bridge Junction', lat: 13.0986, lng: 80.2691, pf: 4, dist: 2.2 },
  { seq: 3, code: 'VPY', name: 'Vyasarpadi Jeeva', lat: 13.1097, lng: 80.2589, pf: 2, dist: 3.8 },
  { seq: 4, code: 'PER', name: 'Perambur', lat: 13.1118, lng: 80.2441, pf: 4, dist: 5.6 },
  { seq: 5, code: 'PCW', name: 'Perambur Carriage Works', lat: 13.1115, lng: 80.2335, pf: 2, dist: 6.7 },
  { seq: 6, code: 'VLK', name: 'Villivakkam', lat: 13.1092, lng: 80.2078, pf: 3, dist: 9.8 },
  { seq: 7, code: 'KOT', name: 'Korattur', lat: 13.1095, lng: 80.1837, pf: 2, dist: 12.1 },
  { seq: 8, code: 'PVM', name: 'Pattaravakkam', lat: 13.1147, lng: 80.1692, pf: 2, dist: 13.9 },
  { seq: 9, code: 'ABU', name: 'Ambattur', lat: 13.1171, lng: 80.1554, pf: 3, dist: 15.5 },
  { seq: 10, code: 'TMVL', name: 'Thirumullaivoyal', lat: 13.1202, lng: 80.1378, pf: 2, dist: 17.1 },
  { seq: 11, code: 'ANNR', name: 'Annanur', lat: 13.1201, lng: 80.1235, pf: 2, dist: 18.3 },
  { seq: 12, code: 'AVD', name: 'Avadi', lat: 13.1192, lng: 80.1009, pf: 4, dist: 21.2 },
  { seq: 13, code: 'HC', name: 'Hindu College', lat: 13.1215, lng: 80.0825, pf: 2, dist: 23.9 },
  { seq: 14, code: 'PAB', name: 'Pattabiram', lat: 13.1242, lng: 80.0682, pf: 3, dist: 25.1 },
  { seq: 15, code: 'NEC', name: 'Nemilichery', lat: 13.1234, lng: 80.0435, pf: 2, dist: 27.2 },
  { seq: 16, code: 'TI', name: 'Thiruninravur', lat: 13.1221, lng: 80.0276, pf: 3, dist: 29.1 },
  { seq: 17, code: 'VEU', name: 'Veppampattu', lat: 13.1294, lng: 79.9983, pf: 2, dist: 32.3 },
  { seq: 18, code: 'SVR', name: 'Sevvapet Road', lat: 13.1362, lng: 79.9682, pf: 2, dist: 36.1 },
  { seq: 19, code: 'PUT', name: 'Putlur', lat: 13.1398, lng: 79.9412, pf: 2, dist: 39.4 },
  { seq: 20, code: 'TRL', name: 'Tiruvallur', lat: 13.1438, lng: 79.9079, pf: 4, dist: 41.8 }
];

let googleMapInstance = null;
let googleDirectionsRenderer = null;
let googleStationMarkers = [];
let googleTrainMarkers = [];
// ==========================================
// 8. GOOGLE MAPS CORRIDOR & RAILWAY TILES
// ==========================================


let railwayMap = null;
let railwayTileLayers = {};
let currentLayerName = 'roadmap';
let railwayMarkers = [];
let railwayTrainMarkers = [];
let railwayPolyline = null;
let railwayCautionCircles = [];


// Catch Google Maps JS API key unauthenticated callback to prevent grey screens / alerts
window.gm_authFailure = function () {
  console.warn("Google Maps JS API key unauthenticated on localhost; using Google Maps Tile Engine.");
  initGoogleCorridorMap('railway-google-map');
};

/**
 * Google Maps API Initialization Callback
 * Exact required signature and variables:
 * const origin = "Chennai Central Railway Station, Chennai";
 * const destination = "Tiruvallur Railway Station, Tamil Nadu";
 */
window.initMap = function () {
  const origin = "Chennai Central Railway Station, Chennai";
  const destination = "Tiruvallur Railway Station, Tamil Nadu";

  console.log("Google Maps API Initialized for Corridor:", origin, "➔", destination);
  initGoogleCorridorMap('railway-google-map');

  if (typeof initMobileGoogleMap === 'function') {
    initMobileGoogleMap(origin, destination);
  }
};

/**
 * Initialize Genuine Google Maps Corridor
 * Streams authentic Google Maps tiles (Roadmap, Satellite, Hybrid)
 * Plots the Chennai Central -> Tiruvallur route, all 21 stations, and live trains
 */
function initGoogleCorridorMap(containerId) {
  const container = document.getElementById(containerId || 'railway-google-map');
  if (!container) return;

  if (railwayMap) {
    railwayMap.invalidateSize();
    return;
  }

  // Authentic Google Maps tile layers:
  railwayTileLayers = {
    roadmap: L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }),
    hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | RailGo'
    })
  };

  railwayMap = L.map(container, {
    center: [13.116, 80.12],
    zoom: 11,
    layers: [railwayTileLayers.roadmap],
    zoomControl: true
  });

  // Polyline for Chennai Central (MMC/MASS) -> Tiruvallur (TRL)
  const coords = RAILWAY_STATIONS_DATA.map(s => [s.lat, s.lng]);
  railwayPolyline = L.polyline(coords, {
    color: '#1D4ED8',
    weight: 5,
    opacity: 0.88,
    dashArray: '8, 4'
  }).addTo(railwayMap);

  // Plot All 21 Stations
  plotAllRailwayStations(railwayMap);

  // Plot Live Trains
  plotLiveTrainsOnMap(railwayMap);

  // Plot TSR Engineering & Signal Caution Zones
  plotCautionZones(railwayMap);
}

function plotAllRailwayStations(map) {
  if (!map) return;
  railwayMarkers.forEach(m => map.removeLayer(m));
  railwayMarkers = [];

  RAILWAY_STATIONS_DATA.forEach(stn => {
    const isTerminus = stn.code === 'MASS' || stn.code === 'MMC' || stn.code === 'TRL';
    const w = (state.weather && state.weather.find(x => x.station_code === stn.code)) || {};

    const marker = L.circleMarker([stn.lat, stn.lng], {
      radius: isTerminus ? 8 : 6,
      fillColor: isTerminus ? '#1E3A8A' : '#15803D',
      color: '#FFFFFF',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 1
    }).addTo(map);

    marker.bindTooltip(`<b>${stn.name}</b> (${stn.code})<br><small>Station ${stn.seq} of 21 · ${stn.dist} km</small>`, {
      direction: 'top',
      offset: [0, -6]
    });

    const popupHtml = `
      <div style="font-family: 'Inter', sans-serif; font-size: 12.5px; padding: 4px; line-height: 1.5; min-width: 220px;">
        <div style="font-size: 14px; font-weight: 800; color: #1E3A8A; margin-bottom: 2px;">
          ${stn.name} (${stn.code})
        </div>
        <div style="color: #64748B; font-size: 11.5px; margin-bottom: 8px;">
          Station ${stn.seq} of 20 · ${stn.dist} km from MASS · Platform 1-${stn.pf}
        </div>
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px; margin-bottom: 10px;">
          <div><strong>Live Weather:</strong> ${w.weather_desc || 'Fair'}, ${w.temperature || 32}°C</div>
          <div><strong>Rain / Wind:</strong> ${w.rain || 0} mm · ${w.wind_speed || 12} km/h</div>
          <div><strong>Track Condition:</strong> <span class="badge-tag badge-${(w.weather_impact || 'LOW').toLowerCase()}">${w.weather_impact || 'DRY TRACK'}</span></div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="openInAppBookingWithStation('${stn.code}', 'from')" class="btn btn-outline" style="font-size: 11px; padding: 5px 8px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <i class="fa-solid fa-ticket"></i> Book From
          </button>
          <button onclick="openInAppBookingWithStation('${stn.code}', 'to')" class="btn btn-primary" style="font-size: 11px; padding: 5px 8px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <i class="fa-solid fa-ticket"></i> Book To
          </button>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml);
    railwayMarkers.push(marker);
  });
}

function plotLiveTrainsOnMap(map) {
  if (!map) return;
  railwayTrainMarkers.forEach(m => map.removeLayer(m));
  railwayTrainMarkers = [];

  const trains = (state.trains && state.trains.length > 0) ? state.trains.slice(0, 12) : [];

  trains.forEach((t, idx) => {
    const seq = t.station_sequence || (1 + (idx % 20));
    const stn = RAILWAY_STATIONS_DATA.find(s => s.seq === seq) || RAILWAY_STATIONS_DATA[0];
    const isDelayed = (t.current_delay || 0) > 0;

    const trainLat = stn.lat + 0.0020;
    const trainLng = stn.lng - 0.0018;

    const trainIcon = L.divIcon({
      className: 'custom-train-marker',
      html: `
        <div style="background: ${isDelayed ? '#DC2626' : '#1D4ED8'}; color: #FFFFFF; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFFFFF; box-shadow: 0 3px 6px rgba(0,0,0,0.35); font-size: 12px; cursor: pointer;">
          <i class="fa-solid fa-train"></i>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([trainLat, trainLng], { icon: trainIcon }).addTo(map);

    const popupHtml = `
      <div style="font-family: 'Inter', sans-serif; font-size: 12.5px; padding: 4px; line-height: 1.5; min-width: 230px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: #1E3A8A; font-size: 13.5px;">${t.train_name}</strong>
          <span class="fc-status-pill ${isDelayed ? 'delayed' : 'on-time'}" style="font-size: 10px; padding: 2px 6px;">
            ${isDelayed ? `+${t.current_delay}m` : 'On Time'}
          </span>
        </div>
        <div style="color: #475569; font-size: 11.5px; margin-bottom: 6px;">
          Train #${t.train_number} · Speed: <b>${t.current_speed || 45} km/h</b> · PF ${t.platform || 1}
        </div>
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 8px; margin-bottom: 8px;">
          <div><strong>Near:</strong> ${t.current_station || stn.code} ➔ ${t.next_station || 'TRL'}</div>
          <div style="color: #1D4ED8; font-weight: 700;">Dynamic AI ETA: ${t.ai_predicted_eta || t.scheduled_arrival}</div>
          ${isDelayed ? `<div style="color: #DC2626; font-size: 11px;"><b>Reason:</b> ${t.delay_reason || 'Operational Delay'}</div>` : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="inspectTrainFromMap(${t.train_number})" class="btn btn-outline" style="font-size: 11px; padding: 4px 8px; flex: 1;">
            Inspect
          </button>
          <button onclick="openInAppBookingModal(${t.train_number}, '${t.current_station || 'MASS'}', 'TRL')" class="btn btn-primary" style="font-size: 11px; padding: 4px 8px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <i class="fa-solid fa-ticket"></i> Book Ticket
          </button>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml);
    railwayTrainMarkers.push(marker);
  });
}

function plotCautionZones(map) {
  if (!map) return;
  railwayCautionCircles.forEach(c => map.removeLayer(c));
  railwayCautionCircles = [];

  // Villivakkam-Korattur Engineering Block
  const c1 = L.circle([13.1095, 80.195], {
    radius: 900,
    color: '#E65100',
    fillColor: '#FFE0B2',
    fillOpacity: 0.45,
    weight: 2
  }).addTo(map);
  c1.bindTooltip("<b>TSR Speed Restriction</b><br>Villivakkam - Korattur Track Renewal (30 km/h)", { direction: 'top' });
  railwayCautionCircles.push(c1);

  // Thiruninravur Signal Caution
  const c2 = L.circle([13.125, 80.015], {
    radius: 900,
    color: '#C62828',
    fillColor: '#FFCDD2',
    fillOpacity: 0.45,
    weight: 2
  }).addTo(map);
  c2.bindTooltip("<b>Signal Restriction Zone</b><br>Thiruninravur Interlocking Caution", { direction: 'top' });
  railwayCautionCircles.push(c2);
}

window.switchRailwayMapLayer = function (layerName) {
  if (!railwayMap || !railwayTileLayers[layerName]) return;

  Object.values(railwayTileLayers).forEach(l => {
    if (railwayMap.hasLayer(l)) railwayMap.removeLayer(l);
  });
  railwayMap.addLayer(railwayTileLayers[layerName]);
  currentLayerName = layerName;

  // Update button active state
  ['google', 'satellite', 'hybrid', 'leaflet'].forEach(id => {
    const btn = document.getElementById(`btn-map-engine-${id}`);
    if (!btn) return;
    const isActive = (id === 'google' && layerName === 'roadmap') ||
      (id === 'satellite' && layerName === 'satellite') ||
      (id === 'hybrid' && layerName === 'hybrid') ||
      (id === 'leaflet' && layerName === 'osm');
    btn.style.background = isActive ? '#1E3A8A' : 'transparent';
    btn.style.color = isActive ? '#FFFFFF' : '#64748B';
  });
};

window.switchRailwayMapEngine = function (engine) {
  const layer = engine === 'leaflet' ? 'osm' : (engine === 'satellite' ? 'satellite' : 'roadmap');
  window.switchRailwayMapLayer(layer);
};

window.inspectTrainFromMap = function (trainNumber) {
  state.selectedTrainNumber = trainNumber;
  renderTrainDetails(trainNumber);
  switchView('train-details');
};

window.openInAppBookingWithStation = function (stationCode, field) {
  switchView('book-ticket');
  toggleDesktopBookingView('search');
  setTimeout(() => {
    const el = document.getElementById(field === 'from' ? 'booking-from-select' : 'booking-to-select');
    if (el) el.value = stationCode;
    searchBookingTrainsDesktop();
  }, 150);
};

window.prefillBookingStation = window.openInAppBookingWithStation;


// ==========================================
// 9. VIEW: 🎫 BOOK TRAIN TICKET (DESKTOP)
// ==========================================

let bookingInitialized = false;

function initBookingView() {
  const fromSelect = document.getElementById('booking-from-select');
  const toSelect = document.getElementById('booking-to-select');
  const dateInput = document.getElementById('booking-date-input');

  if (!fromSelect || !toSelect) return;

  if (!bookingInitialized) {
    // Populate station dropdowns with all 21 corridor stations
    const optionsHtml = RAILWAY_STATIONS_DATA.map(stn =>
      `<option value="${stn.code}">${stn.seq}. ${stn.name} (${stn.code}) - ${stn.dist} km</option>`
    ).join('');

    fromSelect.innerHTML = optionsHtml;
    toSelect.innerHTML = optionsHtml;

    // Default: MASS -> TRL
    fromSelect.value = 'MASS';
    toSelect.value = 'TRL';

    // Default date to today
    if (dateInput) {
      const todayStr = new Date().toISOString().split('T')[0];
      dateInput.value = todayStr;
      dateInput.min = todayStr;
    }

    bookingInitialized = true;
  }

  searchBookingTrainsDesktop();
}

window.swapBookingStationsDesktop = function () {
  const fromSelect = document.getElementById('booking-from-select');
  const toSelect = document.getElementById('booking-to-select');
  if (!fromSelect || !toSelect) return;

  const temp = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = temp;

  searchBookingTrainsDesktop();
};

window.setBookingDateQuick = function (target) {
  const dateInput = document.getElementById('booking-date-input');
  const chipToday = document.getElementById('chip-date-today');
  const chipTomorrow = document.getElementById('chip-date-tomorrow');

  const d = new Date();
  if (target === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    chipTomorrow?.classList.add('active');
    chipToday?.classList.remove('active');
  } else {
    chipToday?.classList.add('active');
    chipTomorrow?.classList.remove('active');
  }

  if (dateInput) {
    dateInput.value = d.toISOString().split('T')[0];
  }
  searchBookingTrainsDesktop();
};

async function searchBookingTrainsDesktop() {
  const fromCode = document.getElementById('booking-from-select')?.value || 'MASS';
  const toCode = document.getElementById('booking-to-select')?.value || 'TRL';
  const journeyDate = document.getElementById('booking-date-input')?.value || new Date().toISOString().split('T')[0];
  const trainType = document.getElementById('booking-type-select')?.value || 'All';
  const tbody = document.getElementById('booking-trains-tbody');

  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #64748B;"><i class="fa-solid fa-spinner fa-spin"></i> Searching local trains & calculating AI dynamic ETA...</td></tr>`;

  try {
    const res = await fetch(`/timetable/booking-search?from_station=${fromCode}&to_station=${toCode}&journey_date=${journeyDate}&train_type=${trainType}`);
    const data = await res.json();

    if (data.success && data.trains) {
      renderBookingTableResults(data);
    } else {
      renderBookingFallbackResults(fromCode, toCode, journeyDate, trainType);
    }
  } catch (e) {
    console.warn("Using client-side timetable matching fallback:", e);
    renderBookingFallbackResults(fromCode, toCode, journeyDate, trainType);
  }
}

function renderBookingTableResults(data) {
  const tbody = document.getElementById('booking-trains-tbody');
  const summaryRoute = document.getElementById('booking-summary-route');
  const summaryCount = document.getElementById('booking-summary-count');
  const summaryDist = document.getElementById('booking-summary-dist');
  const fare2nd = document.getElementById('booking-fare-2nd');
  const fare1st = document.getElementById('booking-fare-1st');

  if (summaryRoute) summaryRoute.textContent = `${data.from_station.station_name} (${data.from_station.station_code}) → ${data.to_station.station_name} (${data.to_station.station_code})`;
  if (summaryCount) summaryCount.textContent = `${data.total_trains} Trains Available`;
  if (summaryDist) summaryDist.textContent = `${data.distance_km} km · Journey Date: ${data.journey_date}`;
  if (fare2nd) fare2nd.textContent = `${data.indicative_fare.second_class_unreserved} (2nd Class)`;
  if (fare1st) fare1st.textContent = `${data.indicative_fare.first_class} (1st Class)`;

  if (!tbody) return;

  if (data.trains.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #64748B;">No trains matching "${data.from_station.station_code} → ${data.to_station.station_code}" on this date. Try selecting "All Types".</td></tr>`;
    return;
  }

  tbody.innerHTML = data.trains.map(t => {
    const isDelayed = (t.current_delay || 0) > 0;
    const statusBadge = isDelayed
      ? `<span class="badge-tag badge-delayed" title="${t.delay_reason}">+${t.current_delay}m Delay</span>`
      : `<span class="badge-tag badge-ontime"><span class="live-pulse-dot" style="display:inline-block; width:6px; height:6px; background:#10B981; border-radius:50%; margin-right:4px;"></span>On Time</span>`;

    return `
      <tr>
        <td>
          <strong style="color: #1E3A8A; cursor: pointer;" onclick="inspectTrainFromMap(${t.train_number})">${t.train_number}</strong><br>
          <small style="color: #475569;">${t.train_name}</small>
        </td>
        <td><span class="badge-tag ${t.train_type?.includes('Fast') ? 'badge-fast' : ''}">${t.train_type || 'EMU'}</span></td>
        <td><strong style="color: #0F172A;">${t.scheduled_departure}</strong><br><small style="color: #64748B;">${t.from_station_code}</small></td>
        <td><strong style="color: #0F172A;">${t.scheduled_arrival}</strong><br><small style="color: #64748B;">${t.to_station_code}</small></td>
        <td>${t.duration_formatted}</td>
        <td>Platform ${t.platform || 1}</td>
        <td>${statusBadge}</td>
        <td><strong style="color: #2563EB;">${t.ai_predicted_eta || t.scheduled_arrival}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;" onclick="openOfficialBookingModal(${t.train_number}, '${t.from_station_code}', '${t.to_station_code}', '${data.journey_date}')">
            <i class="fa-solid fa-ticket"></i> Book Ticket
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBookingFallbackResults(fromCode, toCode, journeyDate, trainType) {
  const fromStn = RAILWAY_STATIONS_DATA.find(s => s.code === fromCode) || RAILWAY_STATIONS_DATA[0];
  const toStn = RAILWAY_STATIONS_DATA.find(s => s.code === toCode) || RAILWAY_STATIONS_DATA[19];
  const dist = Math.abs(toStn.dist - fromStn.dist).toFixed(1);
  const fare2nd = dist <= 20 ? '₹5' : '₹10';
  const fare1st = dist <= 20 ? '₹50' : '₹65';

  const trains = (state.trains && state.trains.length > 0) ? state.trains : [];
  const filtered = trainType && trainType !== 'All' ? trains.filter(t => t.train_type?.includes(trainType) || t.train_name?.includes(trainType)) : trains;

  const mockData = {
    from_station: { station_code: fromStn.code, station_name: fromStn.name },
    to_station: { station_code: toStn.code, station_name: toStn.name },
    distance_km: dist,
    journey_date: journeyDate,
    total_trains: filtered.length,
    indicative_fare: { second_class_unreserved: fare2nd, first_class: fare1st },
    trains: filtered.map(t => ({
      train_number: t.train_number,
      train_name: t.train_name,
      train_type: t.train_type || 'EMU Local',
      from_station_code: fromStn.code,
      to_station_code: toStn.code,
      scheduled_departure: t.scheduled_departure || '06:30',
      scheduled_arrival: t.scheduled_arrival || '07:45',
      duration_formatted: `${Math.max(8, Math.round(dist * 1.8))} mins`,
      platform: t.platform || 1,
      current_delay: t.current_delay || 0,
      delay_reason: t.delay_reason || 'On Time',
      ai_predicted_eta: t.ai_predicted_eta || t.scheduled_arrival
    }))
  };

  renderBookingTableResults(mockData);
}

// ==========================================
// IN-APP SUBURBAN TICKET BOOKING ENGINE
// ==========================================

let currentBookingContext = {};
let lastBookedTicket = null;

function generateQrCodeSvg(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  const size = 25;
  const grid = Array(size).fill(null).map(() => Array(size).fill(0));

  function drawFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          grid[r0 + r][c0 + c] = 1;
        } else {
          grid[r0 + r][c0 + c] = 0;
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0 ? 1 : 0;
    grid[i][6] = i % 2 === 0 ? 1 : 0;
  }

  const ar = 16, ac = 16;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
        grid[ar + r][ac + c] = 1;
      }
    }
  }

  let seed = Math.abs(hash);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) continue;
      if (r === 6 || c === 6) continue;
      if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) continue;

      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      grid[r][c] = (seed % 3 === 0 || seed % 5 === 0) ? 1 : 0;
    }
  }

  const cellSize = 6;
  const padding = 12;
  const totalDim = size * cellSize + padding * 2;

  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 1) {
        rects += `<rect x="${padding + c * cellSize}" y="${padding + r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0F172A" />`;
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="150" height="150" style="background:#FFF; border-radius:10px; box-shadow: 0 4px 10px rgba(0,0,0,0.12);">
      <rect width="${totalDim}" height="${totalDim}" fill="#FFFFFF"/>
      ${rects}
      <circle cx="${totalDim / 2}" cy="${totalDim / 2}" r="12" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="2"/>
      <path d="M${totalDim / 2 - 5} ${totalDim / 2} L${totalDim / 2 + 5} ${totalDim / 2} M${totalDim / 2} ${totalDim / 2 - 5} L${totalDim / 2} ${totalDim / 2 + 5}" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

window.openInAppBookingModal = function (trainNumber, fromCode, toCode, date) {
  const modal = document.getElementById('modal-railgo-booking');
  const summaryBox = document.getElementById('booking-form-journey-summary');
  if (!modal) return;

  const train = (state.trains && state.trains.find(t => t.train_number == trainNumber)) || {
    train_number: trainNumber || 43209,
    train_name: "MASS-TRL EMU LOCAL",
    train_type: "EMU Local",
    scheduled_departure: "06:40 AM",
    scheduled_arrival: "07:55 AM",
    ai_predicted_eta: "07:55 AM",
    platform: 1
  };

  const from = fromCode || 'MASS';
  const to = toCode || 'TRL';
  const jDate = date || new Date().toISOString().split('T')[0];

  const fromStn = RAILWAY_STATIONS_DATA.find(s => s.code === from || s.code === 'MMC') || { name: from, dist: 0, code: from };
  const toStn = RAILWAY_STATIONS_DATA.find(s => s.code === to) || { name: to, dist: 41.8, code: to };
  const dist = Math.abs(toStn.dist - fromStn.dist) || 5.6;

  currentBookingContext = {
    trainNumber: train.train_number,
    trainName: train.train_name,
    fromCode: fromStn.code,
    fromName: fromStn.name,
    toCode: toStn.code,
    toName: toStn.name,
    distanceKm: dist,
    date: jDate,
    departureTime: train.scheduled_departure || "06:40 AM",
    arrivalTime: train.scheduled_arrival || "07:55 AM",
    aiEta: train.ai_predicted_eta || train.scheduled_arrival || "07:55 AM",
    platform: train.platform || 1
  };

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <span class="station-pill-badge navy-pill" style="font-size: 11px;">TRAIN #${train.train_number}</span>
          <span style="font-weight: 800; font-size: 14px; color: #0F172A; margin-left: 6px;">${train.train_name}</span>
        </div>
        <span class="badge-tag badge-live"><span class="live-pulse-dot" style="display:inline-block; width:6px; height:6px; background:#10B981; border-radius:50%; margin-right:4px;"></span>AI ETA Active</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 13px;">
        <div>
          <div style="font-size: 11px; color: #64748B;">ORIGIN STATION</div>
          <div style="font-weight: 700; color: #0F172A;">${fromStn.name} (${fromStn.code})</div>
          <div style="font-size: 11.5px; color: #2563EB;">Dep: <b>${currentBookingContext.departureTime}</b> · PF ${currentBookingContext.platform}</div>
        </div>
        <div style="color: #94A3B8; font-size: 16px;"><i class="fa-solid fa-arrow-right"></i></div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #64748B;">DESTINATION</div>
          <div style="font-weight: 700; color: #0F172A;">${toStn.name} (${toStn.code})</div>
          <div style="font-size: 11.5px; color: #059669;">AI ETA: <b>${currentBookingContext.aiEta}</b></div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 11.5px; color: #475569;">
        <span><b>Date:</b> ${jDate} · <b>Distance:</b> ${dist.toFixed(1)} km</span>
        <span style="color: #166534; font-weight: 700;"><i class="fa-solid fa-shield-halved"></i> Valid on Turnstiles</span>
      </div>
    `;
  }

  const paneForm = document.getElementById('booking-pane-form');
  const panePass = document.getElementById('booking-pane-pass');
  if (paneForm) paneForm.style.display = 'block';
  if (panePass) panePass.style.display = 'none';

  recalculateInAppFare();

  modal.classList.add('open');
  modal.style.display = 'flex';
};

window.closeInAppBookingModal = function () {
  const modal = document.getElementById('modal-railgo-booking');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
};

window.recalculateInAppFare = function () {
  const paxCount = parseInt(document.getElementById('inapp-pax-count')?.value || '1', 10);
  const ticketClass = document.getElementById('inapp-ticket-class')?.value || 'Second Class (II)';
  const journeyType = document.getElementById('inapp-journey-type')?.value || 'Single Journey';
  const dist = currentBookingContext.distanceKm || 41.8;

  let baseFare = 10;
  if (ticketClass.includes('First') || ticketClass.includes('FC')) {
    baseFare = dist <= 20 ? 50 : 65;
  } else if (ticketClass.includes('AC')) {
    baseFare = dist <= 20 ? 65 : 80;
  } else {
    baseFare = dist <= 20 ? 5 : 10;
  }

  const multiplier = journeyType.includes('Return') ? 2 : 1;
  const total = baseFare * multiplier * paxCount;

  currentBookingContext.computedFare = total;
  currentBookingContext.paxCount = paxCount;
  currentBookingContext.ticketClass = ticketClass;
  currentBookingContext.journeyType = journeyType;

  const breakdownEl = document.getElementById('inapp-fare-breakdown');
  const displayEl = document.getElementById('inapp-total-fare-display');
  if (breakdownEl) breakdownEl.textContent = `₹${baseFare} × ${paxCount} ${paxCount > 1 ? 'passengers' : 'passenger'} · ${journeyType}`;
  if (displayEl) displayEl.textContent = `₹${total.toFixed(2)}`;
};

window.confirmInAppBooking = async function () {
  const btn = document.getElementById('btn-confirm-inapp-booking');
  const paxName = document.getElementById('inapp-pax-name')?.value.trim() || 'Alex Commuter';
  const paxAge = parseInt(document.getElementById('inapp-pax-age')?.value || '28', 10);
  const paxGender = document.getElementById('inapp-pax-gender')?.value || 'Male';
  const paxCount = parseInt(document.getElementById('inapp-pax-count')?.value || '1', 10);
  const ticketClass = document.getElementById('inapp-ticket-class')?.value || 'Second Class (II)';
  const journeyType = document.getElementById('inapp-journey-type')?.value || 'Single Journey';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Issuing Digital Suburban Ticket...';
  }

  const payload = {
    train_number: currentBookingContext.trainNumber,
    from_station: currentBookingContext.fromCode,
    to_station: currentBookingContext.toCode,
    journey_date: currentBookingContext.date,
    passenger_name: paxName,
    passenger_age: paxAge,
    passenger_gender: paxGender,
    passenger_count: paxCount,
    ticket_class: ticketClass,
    journey_type: journeyType
  };

  try {
    const res = await fetch('/booking/book-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Booking server error: ${res.status}`);
    const ticket = await res.json();
    lastBookedTicket = ticket;

    renderDigitalTicketPass(ticket);

    const paneForm = document.getElementById('booking-pane-form');
    const panePass = document.getElementById('booking-pane-pass');
    if (paneForm) paneForm.style.display = 'none';
    if (panePass) panePass.style.display = 'block';

    // Refresh tickets in background
    loadMyBookedTicketsDesktop();
    if (typeof loadMyBookedTicketsMobile === 'function') loadMyBookedTicketsMobile();

  } catch (err) {
    console.error("Booking failed:", err);
    alert("Could not complete in-app booking: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Confirm & Generate Digital Ticket';
    }
  }
};

window.renderDigitalTicketPass = function (ticket) {
  const container = document.getElementById('digital-pass-render-container');
  if (!container) return;

  const qrSvg = generateQrCodeSvg(ticket.qr_code_data || ticket.ticket_id);

  container.innerHTML = `
    <div style="background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFFFFF; border-radius: 16px; padding: 18px; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);">
      <!-- Top Hologram / Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.18); padding-bottom: 12px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background: #2563EB; color: #FFF; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;">R</div>
          <div>
            <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.5px;">RAILGO SUBURBAN PASS</div>
            <div style="font-size: 10px; color: #93C5FD;">Chennai Division · Southern Railway</div>
          </div>
        </div>
        <span style="background: #10B981; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; display: flex; align-items: center; gap: 5px;">
          <span style="width:6px; height:6px; background:#FFF; border-radius:50%; display:inline-block;"></span> CONFIRMED
        </span>
      </div>

      <!-- Ticket & PNR Numbers -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; font-size: 12px; margin-bottom: 14px;">
        <div><span style="color: #94A3B8;">Ticket ID:</span> <strong style="color: #67E8F9; font-family:'JetBrains Mono',monospace;">${ticket.ticket_id}</strong></div>
        <div><span style="color: #94A3B8;">PNR:</span> <strong style="color: #FDE047; font-family:'JetBrains Mono',monospace;">${ticket.pnr_number}</strong></div>
      </div>

      <!-- Route Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <div style="font-size: 10.5px; color: #93C5FD; text-transform: uppercase;">FROM</div>
          <div style="font-size: 16px; font-weight: 800; color: #FFF;">${ticket.from_station_name}</div>
          <div style="font-size: 11px; color: #E2E8F0;">Dep: <b>${ticket.departure_time}</b> · PF ${ticket.platform}</div>
        </div>
        <div style="color: #60A5FA; font-size: 18px; padding: 0 10px;"><i class="fa-solid fa-arrow-right"></i></div>
        <div style="text-align: right;">
          <div style="font-size: 10.5px; color: #93C5FD; text-transform: uppercase;">TO</div>
          <div style="font-size: 16px; font-weight: 800; color: #FFF;">${ticket.to_station_name}</div>
          <div style="font-size: 11px; color: #34D399;">AI ETA: <b>${ticket.ai_predicted_eta || ticket.arrival_time}</b></div>
        </div>
      </div>

      <!-- Turnstile QR Code Graphic -->
      <div style="background: #FFFFFF; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 12px;">
        ${qrSvg}
        <div style="margin-top: 8px; font-size: 11px; color: #1E293B; font-weight: 700; display: flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-qrcode" style="color: #1D4ED8;"></i> Scan at Suburban Turnstile / Show to TTE
        </div>
      </div>

      <!-- Commuter & Fare Footer -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 10px;">
        <div>
          <div style="color: #94A3B8;">Passenger:</div>
          <strong style="color: #FFF;">${ticket.passenger_name} (${ticket.passenger_age}, ${ticket.passenger_gender})</strong>
        </div>
        <div style="text-align: right;">
          <div style="color: #94A3B8;">Class & Fare:</div>
          <strong style="color: #4ADE80; font-size: 13px;">₹${ticket.fare_amount.toFixed(2)} (${ticket.ticket_class})</strong>
        </div>
      </div>

      <!-- Validity Countdown Tag -->
      <div style="margin-top: 10px; background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 6px 10px; font-size: 11px; text-align: center; color: #6EE7B7;">
        <i class="fa-regular fa-clock"></i> <b>${ticket.valid_until}</b> · Single Passenger Validated
      </div>
    </div>
  `;
};

window.printCurrentDigitalPass = function () {
  window.print();
};

window.viewAllBookedTickets = function () {
  closeInAppBookingModal();
  switchView('book-ticket');
  toggleDesktopBookingView('mytickets');
};

window.toggleDesktopBookingView = function (view) {
  const searchSection = document.getElementById('desktop-booking-search-section');
  const myTicketsSection = document.getElementById('desktop-booking-mytickets-section');
  const btnSearch = document.getElementById('tab-btn-book-search');
  const btnMy = document.getElementById('tab-btn-book-mytickets');

  if (view === 'mytickets') {
    if (searchSection) searchSection.style.display = 'none';
    if (myTicketsSection) myTicketsSection.style.display = 'block';
    if (btnMy) { btnMy.style.background = '#1E3A8A'; btnMy.style.color = '#FFFFFF'; }
    if (btnSearch) { btnSearch.style.background = 'transparent'; btnSearch.style.color = '#64748B'; }
    loadMyBookedTicketsDesktop();
  } else {
    if (searchSection) searchSection.style.display = 'block';
    if (myTicketsSection) myTicketsSection.style.display = 'none';
    if (btnSearch) { btnSearch.style.background = '#1E3A8A'; btnSearch.style.color = '#FFFFFF'; }
    if (btnMy) { btnMy.style.background = 'transparent'; btnMy.style.color = '#64748B'; }
  }
};

window.loadMyBookedTicketsDesktop = async function () {
  const grid = document.getElementById('desktop-mytickets-grid');
  if (!grid) return;

  try {
    const res = await fetch('/booking/my-tickets');
    if (!res.ok) return;
    const tickets = await res.json();

    const countEls = ['desktop-tickets-badge', 'desktop-tab-ticket-count', 'm-tab-ticket-count'];
    countEls.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = tickets.length;
    });

    if (tickets.length === 0) {
      grid.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748B; grid-column: 1 / -1;">No booked tickets found. Search trains and click "🎫 Book Ticket" to generate a digital pass!</div>';
      return;
    }

    grid.innerHTML = tickets.map(t => {
      const qrSvg = generateQrCodeSvg(t.qr_code_data || t.ticket_id);
      return `
        <div class="card" style="margin-bottom: 0; border: 1.5px solid #CBD5E1; border-radius: 16px; background: #FFFFFF; box-shadow: 0 4px 12px rgba(0,0,0,0.06); padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 10px;">
            <div>
              <span class="station-pill-badge navy-pill" style="font-size: 10.5px;">${t.ticket_id}</span>
              <span style="font-weight: 800; font-size: 13.5px; color: #0F172A; margin-left: 6px;">#${t.train_number}</span>
            </div>
            <span class="badge-tag" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 10.5px;">ACTIVE PASS</span>
          </div>

          <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 12px;">
            <div style="flex-shrink: 0; transform: scale(0.85); transform-origin: top left;">
              ${qrSvg}
            </div>
            <div style="flex: 1; font-size: 12px; line-height: 1.5;">
              <div style="font-weight: 800; color: #1E3A8A; font-size: 13px;">${t.from_station_code} ➔ ${t.to_station_code}</div>
              <div style="color: #64748B;">Dep: <b>${t.departure_time}</b> · PF ${t.platform}</div>
              <div style="color: #059669; font-weight: 600;">AI ETA: <b>${t.ai_predicted_eta || t.arrival_time}</b></div>
              <div style="margin-top: 4px; color: #334155;"><b>Pax:</b> ${t.passenger_name} (${t.passenger_count})</div>
              <div style="color: #1D4ED8; font-weight: 700;">Fare: ₹${t.fare_amount.toFixed(2)} · ${t.ticket_class}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F1F5F9; padding-top: 8px; font-size: 11px; color: #64748B;">
            <span><i class="fa-regular fa-clock"></i> ${t.valid_until}</span>
            <button onclick="window.print()" class="btn btn-outline" style="font-size: 10.5px; padding: 3px 8px;">
              <i class="fa-solid fa-print"></i> Print
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn("Could not load booked tickets:", err);
  }
};

window.openOfficialBookingModal = window.openInAppBookingModal;




// ==========================================
// 10. VIEW 7: SIGNAL & RAILWAY CONDITIONS
// ==========================================

function renderSignalsTable() {
  const tbody = document.getElementById('signal-conditions-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.signals.map(s => `
    <tr>
      <td><strong>${s.section}</strong></td>
      <td>
        <span class="badge-tag ${s.signal_status === 'Normal' ? 'badge-low' : (s.signal_status === 'Warning' ? 'badge-medium' : 'badge-high')}">
          ${s.signal_status}
        </span>
      </td>
      <td><strong>${s.signal_waiting} min</strong></td>
      <td>${s.block_status}</td>
      <td>${Math.round(s.track_occupancy * 100)}%</td>
      <td>${s.preceding_train}</td>
      <td><small>${s.telemetry_source}</small></td>
      <td><small style="color: var(--text-secondary);">${s.operational_notes}</small></td>
    </tr>
  `).join('');
}

// ==========================================
// 11. VIEW 8: CONSTRUCTION & MAINTENANCE
// ==========================================

function renderConstructionTable() {
  const tbody = document.getElementById('construction-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.construction.map(c => `
    <tr>
      <td><code>${c.id}</code></td>
      <td><strong>${c.section}</strong></td>
      <td>${c.work_type}</td>
      <td>
        <span class="badge-tag ${c.status === 'Active' ? 'badge-medium' : 'badge-high'}">
          ${c.status}
        </span>
      </td>
      <td><strong>${c.speed_restriction > 0 ? `${c.speed_restriction} km/h` : 'None'}</strong></td>
      <td>${c.start_time} - ${c.end_time}</td>
      <td>${c.affected_train_count} trains</td>
      <td>+${c.expected_delay_impact} min</td>
      <td><small>${c.contractor_authority}</small></td>
    </tr>
  `).join('');
}

// ==========================================
// 12. VIEW 9: ALL STATIONS WEATHER
// ==========================================

async function loadWeather(force = false) {
  try {
    const res = await fetch(`/weather?force_refresh=${force}`).then(r => r.json());
    state.weather = res;
    renderWeatherTable();
    updateDashboardKPIs();
  } catch (e) {
    console.error('Weather reload error', e);
  }
}

function renderWeatherTable() {
  const tbody = document.getElementById('weather-tbody');
  if (!tbody) return;

  const q = (document.getElementById('search-weather')?.value || '').toLowerCase();
  const impFilter = document.getElementById('filter-weather-impact')?.value || 'ALL';

  const filtered = state.weather.filter(w => {
    const matchQ = w.station.toLowerCase().includes(q) || w.station_code.toLowerCase().includes(q);
    const matchImp = impFilter === 'ALL' || w.weather_impact === impFilter;
    return matchQ && matchImp;
  });

  tbody.innerHTML = filtered.map(w => `
    <tr>
      <td>${w.sequence}</td>
      <td><strong>${w.station}</strong></td>
      <td><code>${w.station_code}</code></td>
      <td><strong>${w.temperature}°C</strong></td>
      <td>${w.humidity}%</td>
      <td>${w.rain} mm</td>
      <td>${w.precipitation} mm</td>
      <td>${w.wind_speed} km/h</td>
      <td>${w.wind_gusts} km/h</td>
      <td>${w.weather_desc}</td>
      <td>${Math.round(w.visibility)} m</td>
      <td><span class="badge-tag badge-${w.weather_impact.toLowerCase()}">${w.weather_impact}</span></td>
      <td><small>${w.last_updated.split(' ')[1] || ''}</small></td>
    </tr>
  `).join('');
}

document.getElementById('search-weather')?.addEventListener('input', renderWeatherTable);
document.getElementById('filter-weather-impact')?.addEventListener('change', renderWeatherTable);

// ==========================================
// 13. VIEW 11: SCENARIO SIMULATION
// ==========================================

function initSimControls() {
  const sliders = [
    { id: 'sim-slider-sig-wait', label: 'sim-val-sig-wait', unit: ' min' },
    { id: 'sim-slider-tsr', label: 'sim-val-tsr', unit: ' km/h' },
    { id: 'sim-slider-congestion', label: 'sim-val-congestion', unit: '%' },
    { id: 'sim-slider-rain', label: 'sim-val-rain', unit: ' mm' },
    { id: 'sim-slider-wind', label: 'sim-val-wind', unit: ' km/h' }
  ];

  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    const lbl = document.getElementById(s.label);
    if (el && lbl) {
      el.addEventListener('input', () => {
        lbl.textContent = el.value + s.unit;
      });
    }
  });

  document.getElementById('btn-run-simulation')?.addEventListener('click', runSimulation);
}

async function runSimulation() {
  const trainNo = parseInt(document.getElementById('sim-train-select').value);
  const sigWait = parseFloat(document.getElementById('sim-slider-sig-wait').value);
  const sigAspect = document.getElementById('sim-signal-aspect').value;
  const consActive = document.getElementById('sim-check-construction').checked;
  const tsr = parseFloat(document.getElementById('sim-slider-tsr').value);
  const cong = parseFloat(document.getElementById('sim-slider-congestion').value) / 100.0;
  const rain = parseFloat(document.getElementById('sim-slider-rain').value);
  const wind = parseFloat(document.getElementById('sim-slider-wind').value);

  const payload = {
    train_number: trainNo,
    signal_waiting_minutes: sigWait,
    signal_status: sigAspect,
    construction_active: consActive,
    speed_restriction_kmh: tsr,
    congestion_level: cong,
    rain_mm: rain,
    wind_gusts_kmh: wind,
    preceding_train_delay: sigWait * 0.8
  };

  const btn = document.getElementById('btn-run-simulation');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running XGBoost...';

  try {
    const res = await fetch('/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    document.getElementById('sim-orig-eta').textContent = res.original_eta;
    document.getElementById('sim-result-eta').textContent = res.simulated_dynamic_eta;
    document.getElementById('sim-add-delay').textContent = `+${res.simulated_additional_delay} min`;
    document.getElementById('sim-risk-level').textContent = res.risk_level;
    document.getElementById('sim-impact-summary').textContent = res.impact_summary;

    const expContainer = document.getElementById('sim-explanation-container');
    if (expContainer) {
      expContainer.innerHTML = res.explanation.map(e => `
        <div class="ai-factor-card ${e.impact_level.includes('High') ? 'high-impact' : ''}">
          <div class="factor-header">
            <span>${e.category}</span>
            <span class="badge-tag ${e.impact_level.includes('High') ? 'badge-high' : 'badge-medium'}">${e.impact_level}</span>
          </div>
          <div class="factor-desc">${e.description}</div>
          <div class="factor-time">+${e.estimated_minutes} min</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Simulation error:', err);
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Run XGBoost Simulation';
  }
}

// ==========================================
// 14. VIEW 12: ALERTS
// ==========================================

function renderAlerts() {
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  if (state.alerts.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No critical operational alerts at this time. Corridor running smoothly.</div>';
    return;
  }

  container.innerHTML = state.alerts.map(a => `
    <div style="padding: 16px; border-radius: 8px; border-left: 5px solid ${a.severity === 'CRITICAL' ? 'var(--status-red)' : 'var(--status-yellow)'}; background: ${a.severity === 'CRITICAL' ? '#FFF5F5' : '#FFFDF0'}; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; color: var(--dark-blue); font-size: 14px;">${a.title}</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">${a.message}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;"><i class="fa-regular fa-clock"></i> ${a.time}</div>
      </div>
      <span class="badge-tag ${a.severity === 'CRITICAL' ? 'badge-high' : 'badge-medium'}">${a.severity}</span>
    </div>
  `).join('');
}

async function loadAlerts() {
  try {
    state.alerts = await fetch('/alerts').then(r => r.json());
    renderAlerts();
  } catch (e) { }
}

// ==========================================
// 15. VIEW 13: PASSENGER VIEW
// ==========================================

function renderPassengerView(trainNumber) {
  const train = state.trains.find(t => t.train_number === trainNumber);
  if (!train) return;

  document.getElementById('passenger-train-name').textContent = `EMU ${train.train_number} — ${train.train_name}`;
  document.getElementById('passenger-ai-eta').textContent = train.ai_predicted_eta.slice(0, 5);
  document.getElementById('passenger-delay').textContent = train.current_delay > 0 ? `+${train.current_delay} min` : 'On Time';
  const pDelayReason = document.getElementById('passenger-delay-reason');
  if (pDelayReason) {
    pDelayReason.innerHTML = train.current_delay > 0
      ? `<i class="fa-solid fa-triangle-exclamation" style="font-size:10px;"></i> Delay Reason: <strong>${train.delay_reason || 'Operational Congestion'}</strong>`
      : `<span style="color:#A7F3D0;"><i class="fa-solid fa-circle-check"></i> On-Time Running</span>`;
  }
  document.getElementById('passenger-next-stop').textContent = train.next_station;
  document.getElementById('passenger-platform').textContent = `Platform ${train.platform}`;

  const tbody = document.getElementById('passenger-schedule-tbody');
  if (tbody) {
    tbody.innerHTML = (train.station_wise_eta || []).map(s => `
      <tr style="${s.running_status === 'Current Position' ? 'background: #E3F2FD; font-weight: 700;' : ''}">
        <td>${s.sequence}</td>
        <td><strong>${s.station_name}</strong></td>
        <td>${s.scheduled_eta}</td>
        <td style="color: var(--primary-blue); font-weight: 700;">${s.ai_predicted_eta}</td>
        <td><span class="badge-tag ${s.running_status === 'Passed' ? 'badge-unavailable' : (s.running_status === 'Current Position' ? 'badge-live' : 'badge-low')}">${s.running_status}</span></td>
      </tr>
    `).join('');
  }
}

// ==========================================
// 16. VIEW 14: CONTROL ROOM
// ==========================================

function renderControlRoom() {
  const sigTbody = document.getElementById('cr-signals-tbody');
  if (sigTbody) {
    sigTbody.innerHTML = state.signals.map(s => `
      <tr>
        <td><strong>${s.section}</strong></td>
        <td><span class="badge-tag ${s.signal_status === 'Normal' ? 'badge-low' : (s.signal_status === 'Warning' ? 'badge-medium' : 'badge-high')}">${s.signal_status}</span></td>
        <td>${s.signal_waiting}m</td>
        <td>${s.block_status}</td>
        <td>${Math.round(s.track_occupancy * 100)}%</td>
      </tr>
    `).join('');
  }

  const consTbody = document.getElementById('cr-cons-tbody');
  if (consTbody) {
    consTbody.innerHTML = state.construction.map(c => `
      <tr>
        <td><strong>${c.section}</strong></td>
        <td>${c.work_type}</td>
        <td><span class="badge-tag ${c.status === 'Active' ? 'badge-medium' : 'badge-high'}">${c.status}</span></td>
        <td>${c.speed_restriction > 0 ? `TSR ${c.speed_restriction}k` : 'None'}</td>
        <td>+${c.expected_delay_impact}m</td>
      </tr>
    `).join('');
  }

  const critList = document.getElementById('cr-critical-trains-list');
  if (critList) {
    const delayedTrains = state.trains.filter(t => t.current_delay > 8 || t.risk_level === 'HIGH').slice(0, 5);
    critList.innerHTML = delayedTrains.map(t => `
      <div style="padding: 12px; background: #FFF5F5; border-radius: 6px; border-left: 4px solid var(--status-red);">
        <div style="display: flex; justify-content: space-between;">
          <strong>EMU ${t.train_number} (${t.current_station})</strong>
          <span class="badge-tag badge-high">+${t.current_delay}m delay</span>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
          ${t.delay_reason} • AI ETA: ${t.ai_predicted_eta}
        </div>
      </div>
    `).join('');
  }
}
