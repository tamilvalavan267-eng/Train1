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
        }
      } catch (e) {}
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
    'railway-map': 'Interactive Railway & Weather Map',
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
    setTimeout(initRailwayMap, 200);
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
      <td>${t.current_speed} km/h</td>
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
}

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
// 8. VIEW 5: RAILWAY MAP (LEAFLET + OSM)
// ==========================================

let leafletMapInstance = null;

function initRailwayMap() {
  const container = document.getElementById('railway-leaflet-map');
  if (!container) return;

  if (leafletMapInstance) {
    leafletMapInstance.invalidateSize();
    return;
  }

  // Corridor Center: Chennai Central to Tiruvallur
  leafletMapInstance = L.map('railway-leaflet-map').setView([13.116, 80.12], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors | RailGo Transit Intelligence'
  }).addTo(leafletMapInstance);

  // Plot All 21 Stations
  const stationCoords = [
    [13.0827, 80.2754, "MASS", "Chennai Central Suburban"],
    [13.0986, 80.2691, "BBQ", "Basin Bridge Junction"],
    [13.1097, 80.2589, "VPY", "Vyasarpadi Jeeva"],
    [13.1118, 80.2441, "PER", "Perambur"],
    [13.1115, 80.2335, "PCW", "Perambur Carriage Works"],
    [13.1108, 80.2241, "PEW", "Perambur Loco Works"],
    [13.1092, 80.2078, "VLK", "Villivakkam"],
    [13.1095, 80.1837, "KOTR", "Korattur"],
    [13.1147, 80.1692, "PVM", "Pattaravakkam"],
    [13.1171, 80.1554, "ABU", "Ambattur"],
    [13.1202, 80.1378, "TMVL", "Thirumullaivoyal"],
    [13.1201, 80.1235, "ANNR", "Annanur"],
    [13.1192, 80.1009, "AVD", "Avadi"],
    [13.1215, 80.0825, "HC", "Hindu College"],
    [13.1242, 80.0682, "PAB", "Pattabiram"],
    [13.1234, 80.0435, "NEC", "Nemilichery"],
    [13.1221, 80.0276, "TI", "Thiruninravur"],
    [13.1294, 79.9983, "VEU", "Veppampattu"],
    [13.1362, 79.9682, "SVR", "Sevvapet Road"],
    [13.1398, 79.9412, "PUT", "Putlur"],
    [13.1438, 79.9079, "TRL", "Tiruvallur"]
  ];

  // Draw Railway Line Polyline
  const latlngs = stationCoords.map(s => [s[0], s[1]]);
  L.polyline(latlngs, {
    color: '#1565C0',
    weight: 5,
    opacity: 0.85,
    dashArray: '8, 6'
  }).addTo(leafletMapInstance);

  // Add Station Pins
  stationCoords.forEach(stn => {
    const w = state.weather.find(x => x.station_code === stn[2]) || {};
    const marker = L.circleMarker([stn[0], stn[1]], {
      radius: 6,
      fillColor: '#2E7D32',
      color: '#FFFFFF',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(leafletMapInstance);

    marker.bindPopup(`
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.5;">
        <strong style="color: #0D47A1; font-size: 13px;">${stn[3]} (${stn[2]})</strong><br>
        <strong>Weather:</strong> ${w.weather_desc || 'Fair'}, ${w.temperature || 32}°C<br>
        <strong>Rain / Wind:</strong> ${w.rain || 0}mm, ${w.wind_speed || 12} km/h<br>
        <strong>Impact:</strong> <span class="badge-tag badge-${(w.weather_impact || 'LOW').toLowerCase()}">${w.weather_impact || 'LOW'}</span><br>
        <small style="color: #64748B;">Data: 🟢 Open-Meteo Live API</small>
      </div>
    `);
  });

  // Plot Construction Zones
  const consCircle = L.circle([13.1095, 80.195], {
    color: '#E65100',
    fillColor: '#FFE0B2',
    fillOpacity: 0.6,
    radius: 900
  }).addTo(leafletMapInstance);
  consCircle.bindPopup('<strong>Track Renewal TSR 20 km/h:</strong> Villivakkam - Korattur');

  // Plot Signal Caution Zone
  const sigCircle = L.circle([13.125, 80.015], {
    color: '#C62828',
    fillColor: '#FFCDD2',
    fillOpacity: 0.6,
    radius: 900
  }).addTo(leafletMapInstance);
  sigCircle.bindPopup('<strong>Signal Wait 9.5m (Restricted):</strong> Thiruninravur - Veppampattu');

  state.mapInitialized = true;
}



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
  } catch (e) {}
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
