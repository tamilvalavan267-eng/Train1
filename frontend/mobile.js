/**
 * RailGo Mobile Client Logic
 * Powers the modern commuter mobile app interface with real-time FastAPI integration.
 */

// 21 Suburban Corridor Stations
const STATIONS_METADATA = [
  { seq: 1, code: 'MMC', massCode: 'MASS', name: 'Chennai Central (MMC)', sub: 'Suburban Terminal · PF 12-14', pf: 4, dist: 0.0, lat: 13.0827, lng: 80.2754 },
  { seq: 2, code: 'BBQ', massCode: 'BBQ', name: 'Basin Bridge Junction', sub: 'Platform 1, 2, 3 or 4', pf: 4, dist: 2.2, lat: 13.0986, lng: 80.2691 },
  { seq: 3, code: 'VPY', massCode: 'VPY', name: 'Vyasarpadi Jeeva', sub: 'Platform 1 or 2', pf: 2, dist: 3.8, lat: 13.1097, lng: 80.2589 },
  { seq: 4, code: 'PER', massCode: 'PER', name: 'Perambur', sub: 'Major Suburban Hub · PF 1-4', pf: 4, dist: 5.6, lat: 13.1118, lng: 80.2441 },
  { seq: 5, code: 'PCW', massCode: 'PCW', name: 'Perambur Carriage Works', sub: 'Platform 1 or 2', pf: 2, dist: 6.7, lat: 13.1115, lng: 80.2335 },
  { seq: 6, code: 'PEW', massCode: 'PEW', name: 'Perambur Loco Works', sub: 'Platform 1 or 2', pf: 2, dist: 7.8, lat: 13.1108, lng: 80.2241 },
  { seq: 7, code: 'VLK', massCode: 'VLK', name: 'Villivakkam', sub: 'Platform 1, 2 or 3', pf: 3, dist: 9.8, lat: 13.1092, lng: 80.2078 },
  { seq: 8, code: 'KOTR', massCode: 'KOTR', name: 'Korattur', sub: 'Platform 1 or 2', pf: 2, dist: 12.1, lat: 13.1095, lng: 80.1837 },
  { seq: 9, code: 'PVM', massCode: 'PVM', name: 'Pattaravakkam', sub: 'Platform 1 or 2', pf: 2, dist: 13.9, lat: 13.1147, lng: 80.1692 },
  { seq: 10, code: 'ABU', massCode: 'ABU', name: 'Ambattur', sub: 'Platform 1, 2 or 3', pf: 3, dist: 15.5, lat: 13.1171, lng: 80.1554 },
  { seq: 11, code: 'TMVL', massCode: 'TMVL', name: 'Thirumullaivoyal', sub: 'Platform 1 or 2', pf: 2, dist: 17.1, lat: 13.1202, lng: 80.1378 },
  { seq: 12, code: 'ANNR', massCode: 'ANNR', name: 'Annanur', sub: 'Platform 1 or 2', pf: 2, dist: 18.3, lat: 13.1201, lng: 80.1235 },
  { seq: 13, code: 'AVD', massCode: 'AVD', name: 'Avadi', sub: 'Major EMU Terminal · PF 1-4', pf: 4, dist: 21.2, lat: 13.1192, lng: 80.1009 },
  { seq: 14, code: 'HC', massCode: 'HC', name: 'Hindu College', sub: 'Platform 1 or 2', pf: 2, dist: 23.9, lat: 13.1215, lng: 80.0825 },
  { seq: 15, code: 'PAB', massCode: 'PAB', name: 'Pattabiram', sub: 'Platform 1, 2 or 3', pf: 3, dist: 25.1, lat: 13.1242, lng: 80.0682 },
  { seq: 16, code: 'NEC', massCode: 'NEC', name: 'Nemilichery', sub: 'Platform 1 or 2', pf: 2, dist: 27.2, lat: 13.1234, lng: 80.0435 },
  { seq: 17, code: 'TI', massCode: 'TI', name: 'Thiruninravur', sub: 'Platform 1, 2 or 3', pf: 3, dist: 29.1, lat: 13.1221, lng: 80.0276 },
  { seq: 18, code: 'VEU', massCode: 'VEU', name: 'Veppampattu', sub: 'Platform 1 or 2', pf: 2, dist: 32.3, lat: 13.1294, lng: 79.9983 },
  { seq: 19, code: 'SVR', massCode: 'SVR', name: 'Sevvapet Road', sub: 'Platform 1 or 2', pf: 2, dist: 36.1, lat: 13.1362, lng: 79.9682 },
  { seq: 20, code: 'PUT', massCode: 'PUT', name: 'Putlur', sub: 'Platform 1 or 2', pf: 2, dist: 39.4, lat: 13.1398, lng: 79.9412 },
  { seq: 21, code: 'TRL', massCode: 'TRL', name: 'Tiruvallur (TRL)', sub: 'Platform 1, 2 or 3', pf: 4, dist: 41.8, lat: 13.1438, lng: 79.9079 }
];

const mobileState = {
  origin: STATIONS_METADATA[0], // MMC
  destination: STATIONS_METADATA[20], // TRL
  fastTrainsOnly: true,
  queryTime: '06:30 AM',
  currentTab: 'home',
  pickerTarget: 'origin', // 'origin' | 'dest'
  mobileMap: null,
  mobileMapMarkers: []
};

// Initialize Mobile Experience
document.addEventListener('DOMContentLoaded', () => {
  initMobileControls();
  renderMobileCommuteUI();
  setupFrequentCommutes();
  updateLiveClockDisplay();
  setInterval(updateLiveClockDisplay, 30000);
});

function initMobileControls() {
  // Swap button
  const swapBtn = document.getElementById('btn-swap-stations');
  if (swapBtn) {
    swapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const temp = mobileState.origin;
      mobileState.origin = mobileState.destination;
      mobileState.destination = temp;
      renderMobileCommuteUI();
      // Optional subtle haptic/visual cue
      swapBtn.style.transform = 'rotate(180deg)';
      setTimeout(() => { swapBtn.style.transform = ''; }, 300);
    });
  }

  // Station picker clicks
  document.getElementById('origin-station-box')?.addEventListener('click', () => {
    openStationPicker('origin');
  });

  document.getElementById('dest-station-box')?.addEventListener('click', () => {
    openStationPicker('dest');
  });

  // Fast Trains toggle
  const fastToggle = document.getElementById('toggle-fast-trains');
  if (fastToggle) {
    fastToggle.addEventListener('change', (e) => {
      mobileState.fastTrainsOnly = e.target.checked;
    });
  }

  // Search Button
  document.getElementById('btn-search-trains')?.addEventListener('click', () => {
    executeTrainSearch();
  });

  // Quick Action Buttons
  document.querySelectorAll('.quick-action-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });

  // View All Commutes
  document.getElementById('btn-view-all-commute')?.addEventListener('click', () => {
    executeTrainSearch();
  });

  // Bottom Navigation Tabs
  document.querySelectorAll('.m-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchMobileTab(targetTab);
    });
  });

  // Notification Bell
  document.getElementById('mobile-btn-bell')?.addEventListener('click', () => {
    openAlertsSheet();
  });

  // User Profile
  document.getElementById('mobile-btn-avatar')?.addEventListener('click', () => {
    switchMobileTab('profile');
  });

  // Station picker search filter
  document.getElementById('station-search-input')?.addEventListener('input', (e) => {
    filterStationList(e.target.value);
  });

  // Modal Sheet close buttons
  document.querySelectorAll('.sheet-close-btn, .modal-bottom-sheet-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el || el.classList.contains('sheet-close-btn')) {
        closeAllSheets();
      }
    });
  });

  // Time picker modal button
  document.getElementById('btn-datetime-picker')?.addEventListener('click', () => {
    openTimePickerSheet();
  });

  // View Switcher (Mobile App <-> Desktop Console)
  document.getElementById('btn-view-mobile-app')?.addEventListener('click', () => {
    setMainAppMode('mobile');
  });
  document.getElementById('btn-view-desktop-console')?.addEventListener('click', () => {
    setMainAppMode('desktop');
  });
}

function setMainAppMode(mode) {
  const mobileWrapper = document.getElementById('mobile-app-wrapper');
  const desktopLayout = document.getElementById('desktop-console-layout');
  const btnMobile = document.getElementById('btn-view-mobile-app');
  const btnDesktop = document.getElementById('btn-view-desktop-console');

  if (mode === 'mobile') {
    if (mobileWrapper) mobileWrapper.style.display = 'flex';
    if (desktopLayout) desktopLayout.style.display = 'none';
    btnMobile?.classList.add('active');
    btnDesktop?.classList.remove('active');
  } else {
    if (mobileWrapper) mobileWrapper.style.display = 'none';
    if (desktopLayout) desktopLayout.style.display = 'flex';
    btnDesktop?.classList.add('active');
    btnMobile?.classList.remove('active');
    // Trigger map invalidation if on map view
    if (window.dispatchEvent) {
      window.dispatchEvent(new Event('resize'));
    }
  }
}

function updateLiveClockDisplay() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `Today, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  const timeEl = document.getElementById('selected-time-text');
  if (timeEl && !mobileState.userSelectedCustomTime) {
    timeEl.textContent = timeStr;
    mobileState.queryTime = timeStr;
  }
}

function renderMobileCommuteUI() {
  // Origin display
  const orgNameEl = document.getElementById('selected-origin-name');
  const orgSubEl = document.getElementById('selected-origin-sub');
  const orgCodeEl = document.getElementById('selected-origin-code');

  if (orgNameEl) orgNameEl.textContent = mobileState.origin.name;
  if (orgSubEl) orgSubEl.textContent = mobileState.origin.sub;
  if (orgCodeEl) orgCodeEl.textContent = mobileState.origin.code;

  // Destination display
  const destNameEl = document.getElementById('selected-dest-name');
  const destSubEl = document.getElementById('selected-dest-sub');
  const destCodeEl = document.getElementById('selected-dest-code');

  if (destNameEl) destNameEl.textContent = mobileState.destination.name;
  if (destSubEl) destSubEl.textContent = mobileState.destination.sub;
  if (destCodeEl) destCodeEl.textContent = mobileState.destination.code;
}

function switchMobileTab(tabKey) {
  mobileState.currentTab = tabKey;

  // Update bottom nav tab active styles
  document.querySelectorAll('.m-nav-tab').forEach(tab => {
    if (tab.dataset.tab === tabKey) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Hide all subviews
  document.querySelectorAll('.m-subview').forEach(v => v.classList.remove('active'));

  // Switch according to tab
  const homeView = document.getElementById('m-subview-home');
  const searchView = document.getElementById('m-subview-search');
  const liveStatusView = document.getElementById('m-subview-livestatus');
  const savedView = document.getElementById('m-subview-saved');
  const profileView = document.getElementById('m-subview-profile');

  if (tabKey === 'home') {
    homeView?.classList.add('active');
  } else if (tabKey === 'search') {
    searchView?.classList.add('active');
    document.getElementById('mobile-quick-search-input')?.focus();
  } else if (tabKey === 'livestatus') {
    liveStatusView?.classList.add('active');
    renderMobileLiveStatus();
  } else if (tabKey === 'saved') {
    savedView?.classList.add('active');
  } else if (tabKey === 'profile') {
    profileView?.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleQuickAction(action) {
  document.querySelectorAll('.m-subview').forEach(v => v.classList.remove('active'));

  if (action === 'livetrack') {
    const liveView = document.getElementById('m-subview-livetrack');
    liveView?.classList.add('active');
    renderMobileLiveCorridor();
  } else if (action === 'timetable') {
    const ttView = document.getElementById('m-subview-timetable');
    ttView?.classList.add('active');
    renderMobileTimetable();
  } else if (action === 'routemap') {
    const mapSubView = document.getElementById('m-subview-routemap');
    mapSubView?.classList.add('active');
    initMobileLeafletMap();
  } else if (action === 'directory') {
    const dirView = document.getElementById('m-subview-directory');
    dirView?.classList.add('active');
    renderMobileStationDirectory();
  }
}

// Station Picker Bottom Sheet
function openStationPicker(target) {
  mobileState.pickerTarget = target;
  const overlay = document.getElementById('sheet-station-picker');
  const titleEl = document.getElementById('station-picker-title');
  const searchInput = document.getElementById('station-search-input');

  if (titleEl) {
    titleEl.textContent = target === 'origin' ? 'Select Origin Station' : 'Select Destination Station';
  }
  if (searchInput) {
    searchInput.value = '';
  }

  renderStationPickerItems(STATIONS_METADATA);
  overlay?.classList.add('open');
  searchInput?.focus();
}

function filterStationList(query) {
  const q = (query || '').toLowerCase().trim();
  const filtered = STATIONS_METADATA.filter(stn =>
    stn.name.toLowerCase().includes(q) ||
    stn.code.toLowerCase().includes(q) ||
    stn.sub.toLowerCase().includes(q)
  );
  renderStationPickerItems(filtered);
}

function renderStationPickerItems(stations) {
  const container = document.getElementById('station-select-list');
  if (!container) return;

  if (stations.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748B;">No stations found matching your query</div>';
    return;
  }

  container.innerHTML = stations.map(stn => `
    <div class="station-select-item" onclick="selectStationItem('${stn.code}')">
      <div class="stn-left">
        <div class="stn-name">${stn.name}</div>
        <div class="stn-desc">${stn.sub} · ${stn.dist} km from Chennai</div>
      </div>
      <span class="station-pill-badge ${stn.code === 'MMC' ? 'navy-pill' : 'green-pill'}">${stn.code}</span>
    </div>
  `).join('');
}

window.selectStationItem = function(code) {
  const stn = STATIONS_METADATA.find(s => s.code === code);
  if (!stn) return;

  if (mobileState.pickerTarget === 'origin') {
    mobileState.origin = stn;
  } else {
    mobileState.destination = stn;
  }

  renderMobileCommuteUI();
  closeAllSheets();
};

function closeAllSheets() {
  document.querySelectorAll('.modal-bottom-sheet-overlay').forEach(sheet => {
    sheet.classList.remove('open');
  });
}

// Search Local Trains
function executeTrainSearch() {
  const resultsView = document.getElementById('m-subview-search-results');
  document.querySelectorAll('.m-subview').forEach(v => v.classList.remove('active'));
  resultsView?.classList.add('active');

  const titleEl = document.getElementById('search-results-title');
  if (titleEl) {
    titleEl.textContent = `${mobileState.origin.code} → ${mobileState.destination.code} Trains`;
  }

  // Filter trains
  const trains = (state && state.trains && state.trains.length > 0) ? state.trains : generateDemoTrains();

  // If fast trains is toggled
  let filtered = trains;
  if (mobileState.fastTrainsOnly) {
    const fastSubset = trains.filter(t => t.train_type?.includes('Fast') || t.train_name?.includes('FAST'));
    if (fastSubset.length > 0) filtered = fastSubset;
  }

  renderSearchResultsList(filtered);
}

function renderSearchResultsList(trainList) {
  const container = document.getElementById('search-results-cards-container');
  const countBadge = document.getElementById('search-results-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${trainList.length} Trains Found`;

  container.innerHTML = trainList.map(t => {
    const isDelayed = (t.current_delay || 0) > 0;
    const statusPill = isDelayed
      ? `<span class="fc-status-pill delayed">+${t.current_delay} min Delay</span>`
      : `<span class="fc-status-pill on-time"><span class="view-switcher-bar" style="display:inline; padding:0; background:none;"><span class="live-pulse-dot" style="display:inline-block;"></span></span> On Time</span>`;

    return `
      <div class="fc-train-card" onclick="openTrainJourneySheet(${t.train_number})">
        <div class="fc-card-top">
          <div class="fc-badges-left">
            <span class="fc-line-pill">WEST LINE</span>
            <span class="fc-train-no">${t.train_type || 'EMU'} ${t.train_number}</span>
          </div>
          ${statusPill}
        </div>

        <div class="fc-route-name">${t.train_name || 'Suburban EMU Local'}</div>

        <div class="fc-times-row">
          <div class="fc-time-col">
            <span class="fc-time-label">Departs</span>
            <span class="fc-time-val">${t.scheduled_departure || '06:30 AM'}</span>
          </div>
          <div style="color: #94A3B8; font-size: 14px;"><i class="fa-solid fa-arrow-right"></i></div>
          <div class="fc-time-col">
            <span class="fc-time-label">Dynamic AI ETA</span>
            <span class="fc-time-val eta-highlight">${t.ai_predicted_eta || t.scheduled_arrival || '07:45 AM'}</span>
          </div>
          <span class="fc-pf-badge">PF ${t.platform || '1'}</span>
        </div>

        <div class="fc-card-footer">
          <span class="fc-footer-item"><i class="fa-solid fa-gauge"></i> ${t.current_speed || '45'} km/h</span>
          <span class="fc-footer-item" style="color: #2563EB; font-weight: 700;">Track Live Journey &rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

// Frequent Commute Setup
function setupFrequentCommutes() {
  const container = document.getElementById('frequent-commute-list');
  if (!container) return;

  const defaultCommutes = [
    {
      line: 'WEST LINE',
      no: 'EMU 43209',
      tag: 'Next in 8 min',
      route: 'Chennai Central (MMC) → Tiruvallur (TRL)',
      dep: '06:40 AM',
      arr: '07:55 AM',
      eta: '07:55 AM',
      pf: 'PF 13',
      speed: '45 km/h',
      status: 'On Time',
      isDelayed: false,
      trainNumber: 43209
    },
    {
      line: 'WEST LINE',
      no: 'MEMU 43205',
      tag: 'Next in 22 min',
      route: 'Chennai Central (MMC) → Tiruvallur (TRL)',
      dep: '06:55 AM',
      arr: '08:12 AM',
      eta: '08:18 AM',
      pf: 'PF 12',
      speed: '28 km/h',
      status: '+6 min (Signal)',
      isDelayed: true,
      trainNumber: 43205
    },
    {
      line: 'WEST LINE',
      no: 'FAST EMU 43217',
      tag: 'Next in 38 min',
      route: 'Chennai Central (MMC) → Tiruvallur (TRL)',
      dep: '07:10 AM',
      arr: '08:15 AM',
      eta: '08:15 AM',
      pf: 'PF 14',
      speed: '55 km/h',
      status: 'On Time',
      isDelayed: false,
      trainNumber: 43217
    }
  ];

  container.innerHTML = defaultCommutes.map(c => `
    <div class="fc-train-card" onclick="openTrainJourneySheet(${c.trainNumber})">
      <div class="fc-card-top">
        <div class="fc-badges-left">
          <span class="fc-line-pill">${c.line}</span>
          <span class="fc-train-no">${c.no}</span>
        </div>
        <span class="fc-status-pill ${c.isDelayed ? 'delayed' : 'on-time'}">
          ${c.isDelayed ? '' : '<span class="live-pulse-dot" style="display:inline-block; width:6px; height:6px;"></span>'}
          ${c.tag}
        </span>
      </div>

      <div class="fc-route-name">${c.route}</div>

      <div class="fc-times-row">
        <div class="fc-time-col">
          <span class="fc-time-label">Departs</span>
          <span class="fc-time-val">${c.dep}</span>
        </div>
        <div style="color: #94A3B8; font-size: 14px;"><i class="fa-solid fa-arrow-right"></i></div>
        <div class="fc-time-col">
          <span class="fc-time-label">Dynamic AI ETA</span>
          <span class="fc-time-val eta-highlight">${c.eta}</span>
        </div>
        <span class="fc-pf-badge">${c.pf}</span>
      </div>

      <div class="fc-card-footer">
        <span class="fc-footer-item"><i class="fa-regular fa-clock"></i> ${c.status}</span>
        <span class="fc-footer-item"><i class="fa-solid fa-gauge"></i> ${c.speed}</span>
        <span class="fc-footer-item" style="color:#2563EB; font-weight:700;">Details &rarr;</span>
      </div>
    </div>
  `).join('');
}

// Train Journey Detail Bottom Sheet
window.openTrainJourneySheet = function(trainNumber) {
  const train = (state && state.trains) ? state.trains.find(t => t.train_number === trainNumber) : null;
  const overlay = document.getElementById('sheet-train-journey');
  if (!overlay) return;

  const titleEl = document.getElementById('journey-sheet-train-name');
  const etaEl = document.getElementById('journey-sheet-eta');
  const delayEl = document.getElementById('journey-sheet-delay');
  const rangeEl = document.getElementById('journey-sheet-range');
  const stopsContainer = document.getElementById('journey-stops-timeline');

  const tName = train ? `${train.train_name} (${train.train_number})` : `EMU Local (${trainNumber})`;
  const tEta = train ? train.ai_predicted_eta : '07:55 AM';
  const tDelay = train ? (train.current_delay > 0 ? `+${train.current_delay} min` : 'On Time') : 'On Time';
  const tRange = train && train.prediction_range ? train.prediction_range : 'Confidence: 96.9%';

  if (titleEl) titleEl.textContent = tName;
  if (etaEl) etaEl.textContent = tEta;
  if (delayEl) delayEl.textContent = tDelay;
  if (rangeEl) rangeEl.textContent = tRange;

  if (stopsContainer) {
    const curSeq = train ? (train.station_sequence || 1) : 1;
    stopsContainer.innerHTML = STATIONS_METADATA.slice(0, 10).map((stn, idx) => {
      const isCurrent = (idx + 1) === curSeq;
      const isPassed = (idx + 1) < curSeq;
      const markerClass = isCurrent ? 'blue-solid' : (isPassed ? 'passed' : 'green-ring');

      return `
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; position: relative;">
          <div style="width: 14px; height: 14px; border-radius: 50%; margin-top: 2px; flex-shrink: 0;" class="route-dot ${markerClass}"></div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 13.5px; color: ${isCurrent ? '#1D4ED8' : '#0F172A'};">
                ${stn.name} ${isCurrent ? '📍 <span style="font-size:10px; background:#DBEAFE; color:#1E40AF; padding:2px 6px; border-radius:4px;">HERE</span>' : ''}
              </span>
              <span style="font-size: 12px; font-weight: 600; color: #475569;">PF ${stn.pf}</span>
            </div>
            <div style="font-size: 11.5px; color: #64748B;">${stn.dist} km · Scheduled Stop</div>
          </div>
        </div>
      `;
    }).join('');
  }

  overlay.classList.add('open');
};

// Route Map
function initMobileLeafletMap() {
  setTimeout(() => {
    const mapEl = document.getElementById('mobile-leaflet-map');
    if (!mapEl) return;

    if (!mobileState.mobileMap) {
      mobileState.mobileMap = L.map('mobile-leaflet-map').setView([13.1192, 80.1009], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(mobileState.mobileMap);

      // Plot stations
      const latlngs = STATIONS_METADATA.map(s => [s.lat, s.lng]);
      L.polyline(latlngs, { color: '#1E3A8A', weight: 4, opacity: 0.85 }).addTo(mobileState.mobileMap);

      STATIONS_METADATA.forEach(stn => {
        const marker = L.circleMarker([stn.lat, stn.lng], {
          radius: 5,
          fillColor: stn.code === 'MMC' || stn.code === 'TRL' ? '#1E3A8A' : '#10B981',
          color: '#FFFFFF',
          weight: 2,
          fillOpacity: 1
        }).addTo(mobileState.mobileMap);

        marker.bindPopup(`<b>${stn.name}</b><br>${stn.sub}<br>Platforms: ${stn.pf}`);
      });
    } else {
      mobileState.mobileMap.invalidateSize();
    }
  }, 200);
}

// Live Status View
function renderMobileLiveStatus() {
  const container = document.getElementById('mobile-livestatus-container');
  if (!container) return;

  const trains = (state && state.trains && state.trains.length > 0) ? state.trains.slice(0, 8) : generateDemoTrains();

  container.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <div style="flex:1; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:10px; text-align:center;">
        <div style="font-size:11px; color:#1E40AF; font-weight:700;">ACTIVE TRAINS</div>
        <div style="font-size:18px; font-weight:800; color:#1E3A8A;">61</div>
      </div>
      <div style="flex:1; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:12px; padding:10px; text-align:center;">
        <div style="font-size:11px; color:#065F46; font-weight:700;">ON TIME RATIO</div>
        <div style="font-size:18px; font-weight:800; color:#047857;">88.5%</div>
      </div>
      <div style="flex:1; background:#FEF3C7; border:1px solid #FDE68A; border-radius:12px; padding:10px; text-align:center;">
        <div style="font-size:11px; color:#92400E; font-weight:700;">AVG DELAY</div>
        <div style="font-size:18px; font-weight:800; color:#B45309;">+2.4m</div>
      </div>
    </div>

    <div style="font-size:14px; font-weight:700; margin-bottom: 8px; color:#0F172A;">Running Trains Telemetry</div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${trains.map(t => `
        <div class="fc-train-card" onclick="openTrainJourneySheet(${t.train_number})">
          <div class="fc-card-top">
            <span class="fc-train-no" style="color:#1E3A8A;">${t.train_name} (#${t.train_number})</span>
            <span class="fc-status-pill ${t.current_delay > 0 ? 'delayed' : 'on-time'}">
              ${t.current_delay > 0 ? `+${t.current_delay}m delay` : 'On Time'}
            </span>
          </div>
          <div style="font-size:12px; color:#475569;">
            Currently near: <b>${t.current_station || 'MMC'}</b> ➔ Next: <b>${t.next_station || 'TRL'}</b>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B; margin-top:4px;">
            <span>Speed: ${t.current_speed || 45} km/h</span>
            <span>Platform: ${t.platform || 1}</span>
            <span style="color:#2563EB; font-weight:700;">Dynamic ETA: ${t.ai_predicted_eta || t.scheduled_arrival}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Timetable View
function renderMobileTimetable() {
  const container = document.getElementById('mobile-timetable-container');
  if (!container) return;

  const trains = (state && state.trains && state.trains.length > 0) ? state.trains : generateDemoTrains();

  container.innerHTML = `
    <div class="m-table-card">
      <table class="m-table">
        <thead>
          <tr>
            <th>Train</th>
            <th>Type</th>
            <th>Dep</th>
            <th>Arr</th>
            <th>PF</th>
          </tr>
        </thead>
        <tbody>
          ${trains.map(t => `
            <tr onclick="openTrainJourneySheet(${t.train_number})" style="cursor:pointer;">
              <td style="font-weight:700; color:#1E3A8A;">${t.train_number}</td>
              <td>${t.train_type || 'EMU'}</td>
              <td>${t.scheduled_departure}</td>
              <td style="font-weight:600;">${t.scheduled_arrival}</td>
              <td>PF ${t.platform || 1}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Station Directory View
function renderMobileStationDirectory() {
  const container = document.getElementById('mobile-directory-container');
  if (!container) return;

  container.innerHTML = STATIONS_METADATA.map(stn => `
    <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:700; font-size:14.5px; color:#0F172A;">${stn.name}</div>
        <div style="font-size:12px; color:#64748B; margin-top:2px;">${stn.sub}</div>
        <div style="font-size:11px; color:#10B981; font-weight:600; margin-top:4px;">
          <i class="fa-solid fa-cloud-sun"></i> 29°C · Clear Sky · Traction: Optimal
        </div>
      </div>
      <div style="text-align:right;">
        <span class="station-pill-badge navy-pill">${stn.code}</span>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">${stn.dist} km</div>
      </div>
    </div>
  `).join('');
}

// Alerts Sheet
function openAlertsSheet() {
  const overlay = document.getElementById('sheet-alerts');
  if (overlay) overlay.classList.add('open');
}

// Time Picker Sheet
function openTimePickerSheet() {
  const overlay = document.getElementById('sheet-time-picker');
  if (overlay) overlay.classList.add('open');
}

window.selectPresetTime = function(label) {
  const timeEl = document.getElementById('selected-time-text');
  if (timeEl) timeEl.textContent = label;
  mobileState.queryTime = label;
  mobileState.userSelectedCustomTime = true;
  closeAllSheets();
};

// Fallback demo trains generator if backend data is loading
function generateDemoTrains() {
  return [
    { train_number: 43209, train_name: "MMC-TRL EMU LOCAL", train_type: "EMU Local", scheduled_departure: "06:40 AM", scheduled_arrival: "07:55 AM", ai_predicted_eta: "07:55 AM", current_delay: 0, platform: 13, current_speed: 45 },
    { train_number: 43205, train_name: "MMC-TRL MEMU FAST", train_type: "Fast Local", scheduled_departure: "06:55 AM", scheduled_arrival: "08:12 AM", ai_predicted_eta: "08:18 AM", current_delay: 6, platform: 12, current_speed: 28 },
    { train_number: 43217, train_name: "MMC-TRL FAST LOCAL", train_type: "Fast Local", scheduled_departure: "07:10 AM", scheduled_arrival: "08:15 AM", ai_predicted_eta: "08:15 AM", current_delay: 0, platform: 14, current_speed: 52 },
    { train_number: 43221, train_name: "MMC-TRL EMU LOCAL", train_type: "EMU Local", scheduled_departure: "07:25 AM", scheduled_arrival: "08:40 AM", ai_predicted_eta: "08:43 AM", current_delay: 3, platform: 13, current_speed: 40 }
  ];
}
