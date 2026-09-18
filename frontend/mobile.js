/**
 * RailGo Mobile Client Logic
 * Powers the modern commuter mobile app interface with real-time FastAPI integration.
 */

// 20 Suburban Corridor Stations
const STATIONS_METADATA = [
  { seq: 1, code: 'MASS', name: 'Chennai Central', sub: 'Suburban Terminal · PF 12-14', pf: 4, dist: 0.0, lat: 13.0827, lng: 80.2754 },
  { seq: 2, code: 'BBQ', name: 'Basin Bridge Junction', sub: 'Platform 1, 2, 3 or 4', pf: 4, dist: 2.2, lat: 13.0986, lng: 80.2691 },
  { seq: 3, code: 'VPY', name: 'Vyasarpadi Jeeva', sub: 'Platform 1 or 2', pf: 2, dist: 3.8, lat: 13.1097, lng: 80.2589 },
  { seq: 4, code: 'PER', name: 'Perambur', sub: 'Major Suburban Hub · PF 1-4', pf: 4, dist: 5.6, lat: 13.1118, lng: 80.2441 },
  { seq: 5, code: 'PCW', name: 'Perambur Carriage Works', sub: 'Platform 1 or 2', pf: 2, dist: 6.7, lat: 13.1115, lng: 80.2335 },
  { seq: 6, code: 'VLK', name: 'Villivakkam', sub: 'Platform 1, 2 or 3', pf: 3, dist: 9.8, lat: 13.1092, lng: 80.2078 },
  { seq: 7, code: 'KOT', name: 'Korattur', sub: 'Platform 1 or 2', pf: 2, dist: 12.1, lat: 13.1095, lng: 80.1837 },
  { seq: 8, code: 'PVM', name: 'Pattaravakkam', sub: 'Platform 1 or 2', pf: 2, dist: 13.9, lat: 13.1147, lng: 80.1692 },
  { seq: 9, code: 'ABU', name: 'Ambattur', sub: 'Platform 1, 2 or 3', pf: 3, dist: 15.5, lat: 13.1171, lng: 80.1554 },
  { seq: 10, code: 'TMVL', name: 'Thirumullaivoyal', sub: 'Platform 1 or 2', pf: 2, dist: 17.1, lat: 13.1202, lng: 80.1378 },
  { seq: 11, code: 'ANNR', name: 'Annanur', sub: 'Platform 1 or 2', pf: 2, dist: 18.3, lat: 13.1201, lng: 80.1235 },
  { seq: 12, code: 'AVD', name: 'Avadi', sub: 'Major EMU Terminal · PF 1-4', pf: 4, dist: 21.2, lat: 13.1192, lng: 80.1009 },
  { seq: 13, code: 'HC', name: 'Hindu College', sub: 'Platform 1 or 2', pf: 2, dist: 23.9, lat: 13.1215, lng: 80.0825 },
  { seq: 14, code: 'PAB', name: 'Pattabiram', sub: 'Platform 1, 2 or 3', pf: 3, dist: 25.1, lat: 13.1242, lng: 80.0682 },
  { seq: 15, code: 'NEC', name: 'Nemilichery', sub: 'Platform 1 or 2', pf: 2, dist: 27.2, lat: 13.1234, lng: 80.0435 },
  { seq: 16, code: 'TI', name: 'Thiruninravur', sub: 'Platform 1, 2 or 3', pf: 3, dist: 29.1, lat: 13.1221, lng: 80.0276 },
  { seq: 17, code: 'VEU', name: 'Veppampattu', sub: 'Platform 1 or 2', pf: 2, dist: 32.3, lat: 13.1294, lng: 79.9983 },
  { seq: 18, code: 'SVR', name: 'Sevvapet Road', sub: 'Platform 1 or 2', pf: 2, dist: 36.1, lat: 13.1362, lng: 79.9682 },
  { seq: 19, code: 'PUT', name: 'Putlur', sub: 'Platform 1 or 2', pf: 2, dist: 39.4, lat: 13.1398, lng: 79.9412 },
  { seq: 20, code: 'TRL', name: 'Tiruvallur', sub: 'Platform 1, 2 or 3', pf: 4, dist: 41.8, lat: 13.1438, lng: 79.9079 }
];

// Helper for safe access to global application state across scripts
function getAppState() {
  if (typeof window !== 'undefined' && window.state) {
    return window.state;
  }
  return { trains: [], weather: [], signals: [], construction: [], alerts: [] };
}

function getLiveTrains() {
  const s = getAppState();
  if (Array.isArray(s.trains) && s.trains.length > 0) {
    return s.trains;
  }
  return [];
}

const mobileState = {
  origin: STATIONS_METADATA[0], // MASS
  destination: STATIONS_METADATA[19], // TRL
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
  updateMobileWeatherCard();
  setInterval(updateLiveClockDisplay, 30000);
  setInterval(updateMobileWeatherCard, 60000);
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
      updateMobileWeatherCard();
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
      const resultsView = document.getElementById('m-subview-search-results');
      if (resultsView && resultsView.classList.contains('active')) {
        executeTrainSearch();
      }
    });
  }

  // Quick Search Input Listener
  const quickInput = document.getElementById('mobile-quick-search-input');
  if (quickInput) {
    quickInput.addEventListener('input', (e) => {
      renderQuickSearchList(e.target.value);
    });
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeTrainSearch();
      }
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
      if (e.target === el || el.classList.contains('sheet-close-btn') || e.target.closest('.sheet-close-btn')) {
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
    renderQuickSearchList();
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
    const liveView = document.getElementById('m-subview-livestatus');
    liveView?.classList.add('active');
    renderMobileLiveStatus();
  } else if (action === 'timetable') {
    const ttView = document.getElementById('m-subview-timetable');
    ttView?.classList.add('active');
    renderMobileTimetable();
  } else if (action === 'routemap') {
    const mapSubView = document.getElementById('m-subview-routemap');
    mapSubView?.classList.add('active');
    if (typeof google !== 'undefined' && google.maps) {
      initMobileGoogleMap();
    } else {
      initMobileLeafletMap();
    }
  } else if (action === 'directory') {
    const dirView = document.getElementById('m-subview-directory');
    dirView?.classList.add('active');
    renderMobileStationDirectory();
  } else if (action === 'booking') {
    const bookView = document.getElementById('m-subview-booking');
    bookView?.classList.add('active');
    openMobileBookingView();
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
      <span class="station-pill-badge ${stn.code === 'MASS' ? 'navy-pill' : 'green-pill'}">${stn.code}</span>
    </div>
  `).join('');
}

window.selectStationItem = function(code) {
  const stn = STATIONS_METADATA.find(s => s.code === code);
  if (!stn) return;

  if (mobileState.pickerTarget === 'origin') {
    mobileState.origin = stn;
    updateMobileWeatherCard();
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

// Quick Search Dynamic Dropdown List in Search Tab
function renderQuickSearchList(query = '') {
  const container = document.getElementById('quick-search-results-list');
  if (!container) return;

  const q = (query || '').toLowerCase().trim();
  let trains = getLiveTrains();
  if (!trains || trains.length === 0) trains = generateDemoTrains();

  let matches = trains;
  if (q) {
    matches = trains.filter(t => 
      (t.train_number && t.train_number.toString().includes(q)) ||
      (t.train_name && t.train_name.toLowerCase().includes(q)) ||
      (t.current_station && t.current_station.toLowerCase().includes(q)) ||
      (t.route && t.route.toLowerCase().includes(q))
    );
  } else {
    matches = trains.slice(0, 8);
  }

  if (matches.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:24px; color:#64748B; font-size:13px; background:#FFF; border-radius:12px; border:1px dashed #CBD5E1;">No trains found matching "${query}".</div>`;
    return;
  }

  container.innerHTML = matches.map(t => {
    const isDelayed = (Number(t.current_delay) || 0) > 0;
    return `
      <div class="fc-train-card" onclick="openTrainJourneySheet(${t.train_number})" style="cursor:pointer; margin-bottom: 0;">
        <div class="fc-card-top">
          <div class="fc-badges-left">
            <span class="fc-line-pill">WEST LINE</span>
            <span class="fc-train-no">${t.train_type || 'EMU'} ${t.train_number}</span>
          </div>
          <span class="fc-status-pill ${isDelayed ? 'delayed' : 'on-time'}">
            ${isDelayed ? `+${t.current_delay}m Delay` : 'On Time'}
          </span>
        </div>
        <div class="fc-route-name">${t.train_name}</div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748B; margin-top:6px;">
          <span>Dep: <b>${t.scheduled_departure}</b></span>
          <span>PF <b>${t.platform || 1}</b></span>
          <span style="color:#2563EB; font-weight:700;">ETA: ${t.ai_predicted_eta || t.scheduled_arrival}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Search Local Trains
async function executeTrainSearch() {
  const resultsView = document.getElementById('m-subview-search-results');
  document.querySelectorAll('.m-subview').forEach(v => v.classList.remove('active'));
  resultsView?.classList.add('active');

  const titleEl = document.getElementById('search-results-title');
  if (titleEl) {
    titleEl.textContent = `${mobileState.origin.code} → ${mobileState.destination.code} Trains`;
  }

  const container = document.getElementById('search-results-cards-container');
  const countBadge = document.getElementById('search-results-count');
  if (countBadge) countBadge.textContent = 'Searching trains...';

  if (container) {
    container.innerHTML = `
      <div style="padding: 36px 16px; text-align: center; color: #64748B;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #1E3A8A; margin-bottom: 12px;"></i>
        <div style="font-size: 14.5px; font-weight: 700; color: #1E293B;">Loading live suburban trains...</div>
        <div style="font-size: 12.5px; color: #64748B; margin-top: 4px;">Synchronizing 21 stations with XGBoost AI ETA</div>
      </div>
    `;
  }

  // Get live trains from app state or fetch directly from FastAPI endpoint
  let trains = getLiveTrains();
  if (!trains || trains.length === 0) {
    try {
      const res = await fetch('/trains');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (typeof window !== 'undefined') {
            if (!window.state) window.state = {};
            window.state.trains = data;
          }
          trains = data;
        }
      }
    } catch (e) {
      console.warn('Live trains fetch fallback:', e);
    }
  }

  if (!trains || trains.length === 0) {
    trains = generateDemoTrains();
  }

  // Check if search query was set in the quick search input
  const quickInput = (document.getElementById('mobile-quick-search-input')?.value || '').toLowerCase().trim();
  let filtered = trains;
  if (quickInput) {
    const qMatches = trains.filter(t => 
      (t.train_number && t.train_number.toString().includes(quickInput)) ||
      (t.train_name && t.train_name.toLowerCase().includes(quickInput)) ||
      (t.current_station && t.current_station.toLowerCase().includes(quickInput)) ||
      (t.route && t.route.toLowerCase().includes(quickInput))
    );
    if (qMatches.length > 0) {
      filtered = qMatches;
    }
  }

  // If fast trains is toggled
  if (mobileState.fastTrainsOnly) {
    const fastSubset = filtered.filter(t => 
      (t.train_type && t.train_type.toLowerCase().includes('fast')) || 
      (t.train_name && t.train_name.toUpperCase().includes('FAST'))
    );
    if (fastSubset.length > 0) {
      filtered = fastSubset;
    }
  }

  renderSearchResultsList(filtered);
}

function renderSearchResultsList(trainList) {
  const container = document.getElementById('search-results-cards-container');
  const countBadge = document.getElementById('search-results-count');
  if (!container) return;

  if (!trainList || trainList.length === 0) {
    if (countBadge) countBadge.textContent = '0 Trains Found';
    container.innerHTML = `
      <div style="padding: 36px 20px; text-align: center; color: #64748B; background: #FFFFFF; border-radius: 16px; border: 1px dashed #CBD5E1; margin-top: 10px;">
        <i class="fa-solid fa-train-subway" style="font-size: 32px; color: #94A3B8; margin-bottom: 12px;"></i>
        <div style="font-size: 15px; font-weight: 700; color: #1E293B;">No matching trains found</div>
        <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Try turning off the Fast Trains filter to view all suburban trains.</div>
        <button onclick="mobileState.fastTrainsOnly = false; const tg = document.getElementById('toggle-fast-trains'); if(tg) tg.checked = false; executeTrainSearch();" style="margin-top: 14px; background: #1E3A8A; color: #FFF; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-list-check"></i> Show All 61 Trains
        </button>
      </div>
    `;
    return;
  }

  if (countBadge) countBadge.textContent = `${trainList.length} Trains Found`;

  container.innerHTML = trainList.map(t => {
    const isDelayed = (Number(t.current_delay) || 0) > 0;
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
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            ${statusPill}
            ${isDelayed ? `
              <div class="fc-delay-reason-badge">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Reason: <strong>${t.delay_reason || 'Operational Congestion'}</strong></span>
              </div>
            ` : ''}
          </div>
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

        ${isDelayed ? `
          <div class="fc-card-delay-banner">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Delay Reason: <strong>${t.delay_reason || 'Operational Congestion'}</strong></span>
          </div>
        ` : ''}

        <div class="fc-card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="fc-footer-item"><i class="fa-solid fa-gauge"></i> ${t.current_speed !== undefined ? t.current_speed : '48'} km/h</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-book-ticket-pill" onclick="event.stopPropagation(); openInAppBookingModal(${t.train_number}, '${mobileState.origin.code}', '${mobileState.destination.code}')">
              <i class="fa-solid fa-ticket"></i> Book Ticket
            </button>
            <span class="fc-footer-item" style="color: #2563EB; font-weight: 700;">Track Live &rarr;</span>
          </div>
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
      route: 'Chennai Central (MASS) → Tiruvallur (TRL)',
      dep: '06:40 AM',
      arr: '07:55 AM',
      eta: '07:55 AM',
      pf: 'PF 13',
      speed: '47.2 km/h',
      status: 'On Time',
      delayReason: '',
      isDelayed: false,
      trainNumber: 43209
    },
    {
      line: 'WEST LINE',
      no: 'MEMU 43205',
      tag: 'Next in 22 min · Delayed',
      route: 'Chennai Central (MASS) → Tiruvallur (TRL)',
      dep: '06:55 AM',
      arr: '08:12 AM',
      eta: '08:18 AM',
      pf: 'PF 12',
      speed: '27.4 km/h',
      status: '+6 min (Signal)',
      delayReason: 'Signal Clearance Delay at Basin Bridge Jn',
      isDelayed: true,
      trainNumber: 43205
    },
    {
      line: 'WEST LINE',
      no: 'FAST EMU 43217',
      tag: 'Next in 38 min',
      route: 'Chennai Central (MASS) → Tiruvallur (TRL)',
      dep: '07:10 AM',
      arr: '08:15 AM',
      eta: '08:15 AM',
      pf: 'PF 14',
      speed: '63.8 km/h',
      status: 'On Time',
      delayReason: '',
      isDelayed: false,
      trainNumber: 43217
    }
  ];

  // If live trains exist in state, sync dynamic live attributes
  const appTrains = getLiveTrains();
  const commutes = defaultCommutes.map(c => {
    if (appTrains && appTrains.length > 0) {
      const match = appTrains.find(t => Number(t.train_number) === Number(c.trainNumber));
      if (match) {
        const delayed = (Number(match.current_delay) || 0) > 0;
        return {
          ...c,
          eta: match.ai_predicted_eta || c.eta,
          speed: `${match.current_speed !== undefined ? match.current_speed : 48} km/h`,
          pf: `PF ${match.platform || 1}`,
          isDelayed: delayed,
          tag: delayed ? `+${match.current_delay} min Delay` : c.tag,
          status: delayed ? `+${match.current_delay}m (${match.running_status || 'Delayed'})` : 'On Time',
          delayReason: match.delay_reason || c.delayReason
        };
      }
    }
    return c;
  });

  container.innerHTML = commutes.map(c => `
    <div class="fc-train-card" onclick="openTrainJourneySheet(${c.trainNumber})">
      <div class="fc-card-top">
        <div class="fc-badges-left">
          <span class="fc-line-pill">${c.line}</span>
          <span class="fc-train-no">${c.no}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <span class="fc-status-pill ${c.isDelayed ? 'delayed' : 'on-time'}">
            ${c.isDelayed ? '' : '<span class="live-pulse-dot" style="display:inline-block; width:6px; height:6px;"></span>'}
            ${c.tag}
          </span>
          ${c.isDelayed ? `
            <div class="fc-delay-reason-badge">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Reason: <strong>${c.delayReason || 'Signal Delay'}</strong></span>
            </div>
          ` : ''}
        </div>
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

      ${c.isDelayed ? `
        <div class="fc-card-delay-banner">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Delay Reason: <strong>${c.delayReason || 'Signal Clearance Delay'}</strong></span>
        </div>
      ` : ''}

      <div class="fc-card-footer">
        <span class="fc-footer-item" style="${c.isDelayed ? 'color:#DC2626; font-weight:700;' : ''}">
          <i class="${c.isDelayed ? 'fa-solid fa-triangle-exclamation' : 'fa-regular fa-clock'}"></i> ${c.status}
        </span>
        <span class="fc-footer-item"><i class="fa-solid fa-gauge"></i> ${c.speed}</span>
        <span class="fc-footer-item" style="color:#2563EB; font-weight:700;">Details &rarr;</span>
      </div>
    </div>
  `).join('');
}
window.setupFrequentCommutes = setupFrequentCommutes;

// Train Journey Detail Bottom Sheet
window.openTrainJourneySheet = function(trainNumber) {
  const num = Number(trainNumber);
  let allTrains = getLiveTrains();
  if (!allTrains || allTrains.length === 0) allTrains = generateDemoTrains();

  let train = allTrains.find(t => Number(t.train_number) === num || String(t.train_number) === String(trainNumber));
  if (!train) {
    train = generateDemoTrains().find(t => Number(t.train_number) === num || String(t.train_number) === String(trainNumber));
  }

  const overlay = document.getElementById('sheet-train-journey');
  if (!overlay) return;

  const titleEl = document.getElementById('journey-sheet-train-name');
  const etaEl = document.getElementById('journey-sheet-eta');
  const delayEl = document.getElementById('journey-sheet-delay');
  const statusTag = document.getElementById('journey-sheet-status-tag');
  const rangeEl = document.getElementById('journey-sheet-range');
  const heroReasonBox = document.getElementById('journey-sheet-hero-reason-box');
  const heroReasonLabel = document.getElementById('journey-sheet-reason-label');
  const delayReasonEl = document.getElementById('journey-sheet-delay-reason');
  const heroReasonSub = document.getElementById('journey-sheet-reason-sub');
  const stopsContainer = document.getElementById('journey-stops-timeline');

  // Dedicated Delay Reason Card elements
  const delayCard = document.getElementById('journey-sheet-delay-card');
  const delayChip = document.getElementById('journey-delay-chip');
  const delayMainReason = document.getElementById('journey-sheet-delay-reason-main');
  const delayDesc = document.getElementById('journey-sheet-delay-desc');
  const impactSignal = document.getElementById('journey-impact-signal');
  const impactSpeed = document.getElementById('journey-impact-speed');
  const impactWeather = document.getElementById('journey-impact-weather');
  const ontimeCard = document.getElementById('journey-sheet-ontime-card');

  // Async fetch full train details if station_wise_eta is missing
  if ((!train || !train.station_wise_eta || train.station_wise_eta.length === 0) && num) {
    fetch(`/trains/${num}`)
      .then(res => (res.ok ? res.json() : null))
      .then(serverTrain => {
        if (serverTrain && serverTrain.train_number) {
          if (window.state && window.state.trains) {
            const idx = window.state.trains.findIndex(t => Number(t.train_number) === num);
            if (idx >= 0) window.state.trains[idx] = serverTrain;
            else window.state.trains.push(serverTrain);
          }
          if (overlay.classList.contains('open')) {
            openTrainJourneySheet(num);
          }
        }
      })
      .catch(err => console.warn('Async train fetch retry error:', err));
  }

  // Calculate Delay attributes
  const curDelay = train ? (Number(train.current_delay) || 0) : (num === 43205 || num === 43425 ? 6 : (num === 43435 ? 16 : 0));
  const isDelayed = curDelay > 0;
  const tDelay = isDelayed ? `+${Math.round(curDelay)} min` : 'On Time';
  
  let delayReasonText = 'Operational Congestion';
  if (train && train.delay_reason && train.delay_reason !== 'On Time' && train.delay_reason !== 'Normal') {
    delayReasonText = train.delay_reason;
  } else if (num === 43425) {
    delayReasonText = 'Signal issue near Avadi';
  } else if (num === 43205) {
    delayReasonText = 'Signal Clearance Delay at Basin Bridge Jn';
  } else if (num === 43435) {
    delayReasonText = 'Track Work';
  } else if (isDelayed) {
    delayReasonText = 'Track Work & Engineering Speed Restrictions';
  }

  const trainNameStr = train ? `${train.train_name} (${train.train_number})` : `EMU Local (${trainNumber})`;
  if (titleEl) titleEl.textContent = trainNameStr;
  if (etaEl) etaEl.textContent = train ? (train.ai_predicted_eta || '18:46:24') : '18:46:24';
  
  if (delayEl) {
    delayEl.textContent = tDelay;
    delayEl.className = `journey-hero-val ${isDelayed ? 'delay-red' : 'delay-green'}`;
    delayEl.style.color = isDelayed ? '#DC2626' : '#16A34A';
  }
  if (statusTag) {
    statusTag.textContent = isDelayed ? `⚠️ Delayed (+${Math.round(curDelay)} min)` : '🟢 On Time';
    statusTag.style.color = isDelayed ? '#DC2626' : '#16A34A';
    statusTag.style.display = 'block';
  }
  if (rangeEl) {
    rangeEl.textContent = (train && train.prediction_range)
      ? train.prediction_range
      : (isDelayed ? `+${Math.round(curDelay * 0.45 * 10) / 10} to +${Math.round(curDelay * 0.65 * 10) / 10} min` : 'Confidence: 96.9%');
  }

  // Populate Integrated Hero Delay Reason Box
  if (heroReasonBox) {
    if (isDelayed) {
      heroReasonBox.className = 'journey-hero-delay-reason';
      heroReasonBox.style.display = 'flex';
      if (heroReasonLabel) {
        heroReasonLabel.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>DELAY REASON & CAUSE:</span>';
      }
      if (delayReasonEl) {
        delayReasonEl.textContent = `${delayReasonText} (+${Math.round(curDelay)} min)`;
      }
      if (heroReasonSub) {
        heroReasonSub.textContent = (train && train.delay_description && train.delay_description.trim())
          ? train.delay_description
          : `Speed regulated under caution orders due to ${delayReasonText.toLowerCase()}. Dynamic AI ETA automatically factors headway recovery cushion.`;
      }
    } else {
      heroReasonBox.className = 'journey-hero-delay-reason ontime';
      heroReasonBox.style.display = 'flex';
      if (heroReasonLabel) {
        heroReasonLabel.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>SCHEDULE STATUS:</span>';
      }
      if (delayReasonEl) delayReasonEl.textContent = 'On-Time Corridor Service';
      if (heroReasonSub) heroReasonSub.textContent = 'Clear track signals across suburban block sections. Normal timetable pace maintained.';
    }
  }

  // Populate and show dedicated Delay Reason Card
  if (isDelayed) {
    if (delayCard) delayCard.style.display = 'block';
    if (ontimeCard) ontimeCard.style.display = 'none';
    if (delayChip) delayChip.textContent = `+${Math.round(curDelay)} min Delay`;
    if (delayMainReason) delayMainReason.textContent = delayReasonText;
    if (delayDesc) {
      if (train && train.delay_description && train.delay_description.trim()) {
        delayDesc.textContent = train.delay_description;
      } else if (delayReasonText.toLowerCase().includes('signal')) {
        delayDesc.textContent = 'Caution aspect enforced due to track block occupation ahead. Speed regulated for passenger safety while dynamic AI ETA factors headway recovery.';
      } else if (delayReasonText.toLowerCase().includes('track') || delayReasonText.toLowerCase().includes('work') || delayReasonText.toLowerCase().includes('tsr') || delayReasonText.toLowerCase().includes('maintenance')) {
        delayDesc.textContent = 'Authorized railway engineering maintenance / Temporary Speed Restriction (TSR) enforced along this section.';
      } else {
        delayDesc.textContent = 'Suburban corridor congestion and platform clearance regulation impacting timetable schedule.';
      }
    }
    if (impactSignal) {
      impactSignal.innerHTML = `<i class="fa-solid fa-traffic-light"></i> Signal: ${train && train.signal_status ? train.signal_status.split('•')[0] : 'Warning'}`;
    }
    if (impactSpeed) {
      impactSpeed.innerHTML = `<i class="fa-solid fa-gauge"></i> Speed: ${train && train.current_speed !== undefined ? train.current_speed : 48} km/h`;
    }
    if (impactWeather) {
      impactWeather.innerHTML = `<i class="fa-solid fa-cloud"></i> Weather: ${train && train.weather_condition ? train.weather_condition : 'Optimal'}`;
    }
  } else {
    if (delayCard) delayCard.style.display = 'none';
    if (ontimeCard) ontimeCard.style.display = 'block';
  }

  // Render Station Stops Timeline with Live Delay Tracking
  if (stopsContainer) {
    // Determine accurate current sequence
    let curSeq = 1;
    if (train) {
      if (train.station_sequence) {
        curSeq = Number(train.station_sequence);
      } else if (train.current_station) {
        const curNorm = String(train.current_station).trim().toLowerCase();
        const matchStn = STATIONS_METADATA.find(s =>
          s.code.toLowerCase() === curNorm ||
          s.massCode.toLowerCase() === curNorm ||
          s.name.toLowerCase().includes(curNorm)
        );
        if (matchStn) curSeq = matchStn.seq;
      } else if (train.station_wise_eta && train.station_wise_eta.length > 0) {
        const liveStop = train.station_wise_eta.find(s => s.running_status === 'Current Position');
        if (liveStop) curSeq = Number(liveStop.sequence);
      }
    }
    if (num === 43425 && curSeq === 1) {
      curSeq = 13; // Avadi
    }

    const stationEtas = (train && train.station_wise_eta && train.station_wise_eta.length > 0)
      ? train.station_wise_eta
      : null;

    // Generate accurate station data with station-level delays
    let stopsData;
    if (stationEtas) {
      stopsData = stationEtas.map((s, idx) => {
        const sSeq = s.sequence || (idx + 1);
        const isCurr = s.running_status === 'Current Position' || sSeq === curSeq;
        const isPass = s.running_status === 'Passed' || sSeq < curSeq;
        const sDelay = typeof s.delay_minutes === 'number'
          ? s.delay_minutes
          : (isPass ? Math.round(curDelay * 0.5) : (isCurr ? Math.round(curDelay) : Math.round(curDelay)));
        return {
          ...s,
          sequence: sSeq,
          running_status: isCurr ? 'Current Position' : (isPass ? 'Passed' : 'Upcoming'),
          delay_minutes: sDelay
        };
      });
    } else {
      // Synthesize realistic progression
      stopsData = STATIONS_METADATA.map((stn, idx) => {
        const sSeq = idx + 1;
        const isCurr = sSeq === curSeq;
        const isPass = sSeq < curSeq;
        const sDelay = isPass ? Math.round(curDelay * 0.5) : (isCurr ? Math.round(curDelay) : Math.round(curDelay + (idx > curSeq ? (idx - curSeq) * 0.2 : 0)));
        return {
          sequence: sSeq,
          station_name: stn.name,
          station_code: stn.code,
          distance_km: stn.dist,
          scheduled_eta: 'Scheduled Stop',
          ai_predicted_eta: train ? train.ai_predicted_eta : '--:--',
          platform: stn.pf,
          running_status: isCurr ? 'Current Position' : (isPass ? 'Passed' : 'Upcoming'),
          delay_minutes: sDelay
        };
      });
    }

    const currentStationName = train && train.current_station ? train.current_station : (STATIONS_METADATA[curSeq - 1]?.name || 'On Track');

    const delayHeaderHtml = isDelayed ? `
      <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; box-shadow: 0 2px 6px rgba(220,38,38,0.08);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; font-weight:800; color:#DC2626; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-triangle-exclamation"></i> TRAIN DELAY: +${Math.round(curDelay)} MIN LATE
          </span>
          <span style="font-size:11px; font-weight:700; color:#991B1B; background:#FEE2E2; padding:3px 9px; border-radius:6px; border:1px solid #FCA5A5;">
            📍 Near ${currentStationName}
          </span>
        </div>
        <div style="font-size:12.5px; font-weight:700; color:#991B1B; margin-top:6px;">
          Delay Reason: ${delayReasonText}
        </div>
        <div style="font-size:11px; color:#7F1D1D; margin-top:3px; line-height:1.4;">
          ${(train && train.delay_description && train.delay_description.trim()) ? train.delay_description : 'Speed regulated under caution orders due to operational congestion. Dynamic AI ETA automatically accounts for block headway.'}
        </div>
      </div>
    ` : `
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12.5px; font-weight:700; color:#15803D; display:flex; align-items:center; gap:6px;">
          <i class="fa-solid fa-circle-check"></i> On-Time Service (Corridor Normal)
        </span>
        <span style="font-size:11px; font-weight:700; color:#166534; background:#DCFCE7; padding:2px 8px; border-radius:6px;">
          ${currentStationName}
        </span>
      </div>
    `;

    const stopsListHtml = stopsData.map((s, idx) => {
      const seq = s.sequence || (idx + 1);
      const isCurrent = s.running_status === 'Current Position' || seq === curSeq;
      const isPassed = s.running_status === 'Passed' || seq < curSeq;
      const markerClass = isCurrent ? 'blue-solid' : (isPassed ? 'passed' : (isDelayed ? 'delayed-stop' : 'green-ring'));

      const stnDelay = typeof s.delay_minutes === 'number' ? Math.round(s.delay_minutes) : Math.round(curDelay);

      let etaBadge = '';
      if (isPassed) {
        etaBadge = isDelayed
          ? `<span style="color: #64748B; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-check"></i> Departed (+${stnDelay}m late)</span>`
          : '<span style="color: #94A3B8; font-size: 11px; font-weight: 500;"><i class="fa-solid fa-check"></i> Departed</span>';
      } else if (isCurrent) {
        etaBadge = isDelayed
          ? `<span style="color: #B91C1C; font-weight: 800; font-size: 11px; background: #FEE2E2; border: 1.5px solid #FCA5A5; padding: 3px 8px; border-radius: 6px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-location-dot"></i> CURRENT STOP: +${stnDelay}m DELAY</span>`
          : `<span style="color: #1E40AF; font-weight: 700; font-size: 11px; background: #DBEAFE; padding: 2px 7px; border-radius: 6px;">📍 Live Position (${s.ai_predicted_eta || ''})</span>`;
      } else if (isDelayed) {
        etaBadge = `<span style="color: #B91C1C; font-weight: 700; font-size: 11px; background: #FEE2E2; border: 1px solid #FECACA; padding: 2.5px 8px; border-radius: 6px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-clock"></i> ETA ${s.ai_predicted_eta || s.scheduled_eta} (+${stnDelay}m delay)</span>`;
      } else {
        etaBadge = `<span style="color: #15803D; font-weight: 600; font-size: 11px;">ETA: ${s.ai_predicted_eta || s.scheduled_eta}</span>`;
      }

      const schedTime = (s.scheduled_eta && s.scheduled_eta !== 'Scheduled' && s.scheduled_eta !== 'Scheduled Stop') ? s.scheduled_eta : null;
      const schedDisplay = isPassed ? 'Departed' : (schedTime ? `Sched: ${schedTime}` : `Platform ${s.platform || 1}`);

      return `
        <div id="journey-stop-seq-${seq}" style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; position: relative;">
          <div style="width: 14px; height: 14px; border-radius: 50%; margin-top: 2px; flex-shrink: 0;" class="route-dot ${markerClass}"></div>
          <div style="flex: 1; border-bottom: 1px dashed #F1F5F9; padding-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 13.5px; color: ${isCurrent ? '#1D4ED8' : (isPassed ? '#64748B' : '#0F172A')};">
                ${s.station_name} ${isCurrent ? '<span style="font-size:10px; background:#2563EB; color:#FFFFFF; padding:1px 6px; border-radius:4px; margin-left:4px; font-weight:800;">LIVE HERE</span>' : ''}
              </span>
              <span style="font-size: 12px; font-weight: 600; color: #475569;">PF ${s.platform || 2}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
              <span style="font-size: 11.5px; color: #64748B;">${s.distance_km || 0} km · ${schedDisplay}</span>
              ${etaBadge}
            </div>
            ${isDelayed && !isPassed ? `
              <div style="font-size: 11px; color: #B91C1C; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px; background: #FFF5F5; padding: 2px 7px; border-radius: 5px; width: fit-content; border: 1px solid #FED7D7;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 9.5px;"></i> Delay: +${stnDelay} min · Reason: ${delayReasonText}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const bookTicketBtnHtml = `
      <div style="margin-top: 14px; padding: 12px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 14px; text-align: center;">
        <div style="font-size: 11.5px; color: #1E40AF; font-weight: 700; margin-bottom: 6px;">
          <i class="fa-solid fa-shield-halved"></i> RailGo In-App Suburban Pass
        </div>
        <button class="btn-primary-search" style="margin: 0; background: linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%); width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="openInAppBookingModal(${train.train_number}, '${train.current_station || 'MASS'}', 'TRL')">
          <i class="fa-solid fa-ticket"></i>
          <span>Book Digital Ticket for #${train.train_number}</span>
        </button>
      </div>
    `;

    stopsContainer.innerHTML = delayHeaderHtml + stopsListHtml + bookTicketBtnHtml;

    // Auto-scroll to current station position if not at the start
    setTimeout(() => {
      const activeEl = document.getElementById(`journey-stop-seq-${curSeq}`);
      if (activeEl && stopsContainer) {
        const topOffset = activeEl.offsetTop - stopsContainer.offsetTop - 40;
        stopsContainer.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    }, 150);
  }

  overlay.classList.add('open');
};

// Route Map - Leaflet
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
          fillColor: stn.code === 'MASS' || stn.code === 'TRL' ? '#1E3A8A' : '#10B981',
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

// Route Map - Authentic Google Maps Tiles
let mobileGoogleMap = null;
let mobileMapTileLayers = {};

function initMobileGoogleMap(originStr, destStr) {
  setTimeout(() => {
    const mapEl = document.getElementById('mobile-google-map');
    if (!mapEl) return;

    if (mobileGoogleMap) {
      mobileGoogleMap.invalidateSize();
      return;
    }

    mobileMapTileLayers = {
      roadmap: L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      }),
      satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      })
    };

    mobileGoogleMap = L.map(mapEl, {
      center: [13.1192, 80.1009],
      zoom: 11,
      layers: [mobileMapTileLayers.roadmap],
      zoomControl: true
    });

    // Draw route polyline
    const path = STATIONS_METADATA.map(s => [s.lat, s.lng]);
    L.polyline(path, {
      color: '#1E3A8A',
      weight: 4.5,
      opacity: 0.88,
      dashArray: '6, 4'
    }).addTo(mobileGoogleMap);

    // Add Station Markers
    STATIONS_METADATA.forEach(stn => {
      const isTerminus = stn.code === 'MASS' || stn.code === 'TRL';
      const marker = L.circleMarker([stn.lat, stn.lng], {
        radius: isTerminus ? 7 : 5,
        fillColor: isTerminus ? '#1E3A8A' : '#10B981',
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      }).addTo(mobileGoogleMap);

      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif; font-size:12px; line-height:1.4; min-width: 170px;">
          <b style="color:#1E3A8A; font-size:13px;">${stn.name}</b><br>
          <span style="color:#64748B;">${stn.sub}</span><br>
          <div style="margin-top: 4px; font-size: 11px;">Station ${stn.seq} of 21 · PF ${stn.pf} · ${stn.dist} km</div>
          <div style="margin-top: 8px;">
            <button onclick="selectStationItem('${stn.code}'); switchMobileTab('home');" class="btn btn-primary" style="font-size: 11px; padding: 4px 8px; width: 100%;">
              Select Station
            </button>
          </div>
        </div>
      `);
    });
  }, 100);
}
window.initMobileGoogleMap = initMobileGoogleMap;

window.switchMobileMapLayer = function(layer) {
  if (!mobileGoogleMap || !mobileMapTileLayers[layer]) return;
  Object.values(mobileMapTileLayers).forEach(l => {
    if (mobileGoogleMap.hasLayer(l)) mobileGoogleMap.removeLayer(l);
  });
  mobileGoogleMap.addLayer(mobileMapTileLayers[layer]);

  ['google', 'satellite', 'leaflet'].forEach(id => {
    const btn = document.getElementById(`btn-m-map-${id}`);
    if (!btn) return;
    const isActive = (id === 'google' && layer === 'roadmap') ||
                     (id === 'satellite' && layer === 'satellite') ||
                     (id === 'leaflet' && layer === 'osm');
    btn.style.background = isActive ? '#1E3A8A' : 'transparent';
    btn.style.color = isActive ? '#FFF' : '#64748B';
  });
};

window.switchMobileMapEngine = function(engine) {
  window.switchMobileMapLayer(engine === 'leaflet' ? 'osm' : 'roadmap');
};

// Mobile Booking View Functions
window.openMobileBookingView = function() {
  const oName = document.getElementById('m-booking-origin-name');
  const oCode = document.getElementById('m-booking-origin-code');
  const dName = document.getElementById('m-booking-dest-name');
  const dCode = document.getElementById('m-booking-dest-code');
  const dateInput = document.getElementById('m-booking-date');

  if (oName) oName.textContent = mobileState.origin.name;
  if (oCode) oCode.textContent = mobileState.origin.code;
  if (dName) dName.textContent = mobileState.destination.name;
  if (dCode) dCode.textContent = mobileState.destination.code;

  if (dateInput && !dateInput.value) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    dateInput.min = todayStr;
  }

  executeMobileBookingSearch();
};

window.swapMobileBookingStations = function() {
  const temp = mobileState.origin;
  mobileState.origin = mobileState.destination;
  mobileState.destination = temp;
  openMobileBookingView();
};

window.executeMobileBookingSearch = async function() {
  const container = document.getElementById('m-booking-results-container');
  const countLabel = document.getElementById('m-booking-count-label');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding: 20px; color: #64748B;"><i class="fa-solid fa-spinner fa-spin"></i> Searching trains...</div>`;

  const fromCode = (mobileState.origin.code === 'MMC' || mobileState.origin.code === 'MASS') ? 'MASS' : mobileState.origin.code;
  const toCode = (mobileState.destination.code === 'MMC' || mobileState.destination.code === 'MASS') ? 'MASS' : mobileState.destination.code;
  const dateVal = document.getElementById('m-booking-date')?.value || new Date().toISOString().split('T')[0];

  try {
    const res = await fetch(`/timetable/booking-search?from_station=${fromCode}&to_station=${toCode}&journey_date=${dateVal}`);
    const data = await res.json();
    if (data.success && data.trains) {
      renderMobileBookingList(data.trains, data.indicative_fare, data.distance_km);
      if (countLabel) countLabel.textContent = `${data.total_trains} Trains · ${data.distance_km} km`;
      return;
    }
  } catch (e) {
    console.warn("Mobile booking search fallback:", e);
  }

  // Fallback
  const trains = (window.state && window.state.trains && window.state.trains.length > 0) ? window.state.trains : generateDemoTrains();
  const dist = Math.abs(mobileState.destination.dist - mobileState.origin.dist).toFixed(1);
  if (countLabel) countLabel.textContent = `${trains.length} Trains · ${dist} km`;
  renderMobileBookingList(trains, { second_class_unreserved: dist <= 20 ? '₹5' : '₹10', first_class: dist <= 20 ? '₹50' : '₹65' }, dist);
};

function renderMobileBookingList(trainList, fareObj, distKm) {
  const container = document.getElementById('m-booking-results-container');
  if (!container) return;

  if (trainList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 24px; color: #64748B;">No trains found for this route.</div>`;
    return;
  }

  container.innerHTML = trainList.map(t => {
    const isDelayed = (t.current_delay || 0) > 0;
    const depTime = t.scheduled_departure || '06:30 AM';
    const arrTime = t.ai_predicted_eta || t.scheduled_arrival || '07:45 AM';

    return `
      <div class="fc-train-card" style="margin-bottom: 0;">
        <div class="fc-card-top">
          <div class="fc-badges-left">
            <span class="fc-line-pill">WEST LINE</span>
            <span class="fc-train-no">${t.train_type || 'EMU'} ${t.train_number}</span>
          </div>
          <span class="fc-status-pill ${isDelayed ? 'delayed' : 'on-time'}">
            ${isDelayed ? `+${t.current_delay}m` : 'On Time'}
          </span>
        </div>

        <div class="fc-route-name">${t.train_name}</div>

        <div class="fc-times-row">
          <div class="fc-time-col">
            <span class="fc-time-label">Departs (${mobileState.origin.code})</span>
            <span class="fc-time-val">${depTime}</span>
          </div>
          <div style="color: #94A3B8; font-size: 14px;"><i class="fa-solid fa-arrow-right"></i></div>
          <div class="fc-time-col">
            <span class="fc-time-label">Dynamic ETA (${mobileState.destination.code})</span>
            <span class="fc-time-val eta-highlight">${arrTime}</span>
          </div>
          <span class="fc-pf-badge">PF ${t.platform || 1}</span>
        </div>

        <div class="fc-card-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #F1F5F9; margin-top: 6px;">
          <span style="font-size: 11.5px; color: #64748B;">
            <b>${distKm} km</b> · Fare: <b>${fareObj?.second_class_unreserved || '₹10'}</b>
          </span>
          <button class="btn-book-ticket-pill" onclick="event.stopPropagation(); openInAppBookingModal(${t.train_number}, '${mobileState.origin.code}', '${mobileState.destination.code}')">
            <i class="fa-solid fa-ticket"></i> Book Ticket
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.switchMobileBookingSubtab = function(tab) {
  const searchPane = document.getElementById('m-booking-search-pane');
  const myTicketsPane = document.getElementById('m-booking-mytickets-pane');
  const btnSearch = document.getElementById('m-btn-book-tab-search');
  const btnMy = document.getElementById('m-btn-book-tab-mytickets');

  if (tab === 'mytickets') {
    if (searchPane) searchPane.style.display = 'none';
    if (myTicketsPane) myTicketsPane.style.display = 'block';
    if (btnMy) { btnMy.style.background = '#1E3A8A'; btnMy.style.color = '#FFFFFF'; }
    if (btnSearch) { btnSearch.style.background = 'transparent'; btnSearch.style.color = '#64748B'; }
    loadMyBookedTicketsMobile();
  } else {
    if (searchPane) searchPane.style.display = 'block';
    if (myTicketsPane) myTicketsPane.style.display = 'none';
    if (btnSearch) { btnSearch.style.background = '#1E3A8A'; btnSearch.style.color = '#FFFFFF'; }
    if (btnMy) { btnMy.style.background = 'transparent'; btnMy.style.color = '#64748B'; }
  }
};

window.loadMyBookedTicketsMobile = async function() {
  const container = document.getElementById('m-booked-tickets-container');
  if (!container) return;

  try {
    const res = await fetch('/booking/my-tickets');
    if (!res.ok) return;
    const tickets = await res.json();

    const badge = document.getElementById('m-tab-ticket-count');
    if (badge) badge.textContent = tickets.length;

    if (tickets.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 25px; color: #64748B; font-size: 13px;">No booked tickets found. Search trains and book to view your active turnstile passes!</div>`;
      return;
    }

    container.innerHTML = tickets.map(t => {
      const qrSvg = typeof generateQrCodeSvg === 'function' ? generateQrCodeSvg(t.qr_code_data || t.ticket_id) : '';
      return `
        <div style="background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 16px; padding: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 10px;">
            <div>
              <span class="station-pill-badge navy-pill" style="font-size: 10px;">${t.ticket_id}</span>
              <strong style="margin-left: 6px; font-size: 13px; color: #0F172A;">Train #${t.train_number}</strong>
            </div>
            <span style="font-size: 10px; font-weight: 700; background: #DCFCE7; color: #15803D; padding: 2px 8px; border-radius: 12px;">ACTIVE PASS</span>
          </div>

          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px;">
            <div style="flex-shrink: 0; transform: scale(0.8); transform-origin: top left;">
              ${qrSvg}
            </div>
            <div style="flex: 1; font-size: 12px; line-height: 1.45;">
              <div style="font-weight: 800; color: #1E3A8A; font-size: 13px;">${t.from_station_code} ➔ ${t.to_station_code}</div>
              <div style="color: #64748B;">Dep: <b>${t.departure_time}</b> · PF ${t.platform}</div>
              <div style="color: #059669; font-weight: 600;">AI ETA: <b>${t.ai_predicted_eta || t.arrival_time}</b></div>
              <div style="color: #334155; margin-top: 2px;">Pax: <b>${t.passenger_name}</b></div>
              <div style="color: #1D4ED8; font-weight: 700;">₹${t.fare_amount.toFixed(2)} · ${t.ticket_class}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F1F5F9; padding-top: 8px; font-size: 11px; color: #64748B;">
            <span><i class="fa-regular fa-clock"></i> ${t.valid_until}</span>
            <button onclick="window.print()" class="btn btn-outline" style="font-size: 10px; padding: 2px 8px;">
              <i class="fa-solid fa-print"></i> Print
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn("Error loading mobile tickets:", err);
  }
};

// Live Status View
function renderMobileLiveStatus() {
  const container = document.getElementById('mobile-livestatus-container');
  if (!container) return;

  let trains = getLiveTrains();
  if (!trains || trains.length === 0) trains = generateDemoTrains();

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
      ${trains.slice(0, 15).map(t => `
        <div class="fc-train-card" onclick="openTrainJourneySheet(${t.train_number})">
          <div class="fc-card-top">
            <span class="fc-train-no" style="color:#1E3A8A;">${t.train_name} (#${t.train_number})</span>
            <div style="display: flex; flex-direction: column; align-items: flex-end;">
              <span class="fc-status-pill ${(Number(t.current_delay) || 0) > 0 ? 'delayed' : 'on-time'}">
                ${(Number(t.current_delay) || 0) > 0 ? `+${t.current_delay}m delay` : 'On Time'}
              </span>
              ${(Number(t.current_delay) || 0) > 0 ? `
                <div class="fc-delay-reason-badge" style="font-size: 10px; padding: 2px 6px;">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span>Reason: <strong>${t.delay_reason || 'Operational Delay'}</strong></span>
                </div>
              ` : ''}
            </div>
          </div>
          <div style="font-size:12px; color:#475569;">
            Currently near: <b>${t.current_station || 'MASS'}</b> ➔ Next: <b>${t.next_station || 'TRL'}</b>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B; margin-top:4px;">
            <span>Speed: ${t.current_speed !== undefined ? t.current_speed : 48} km/h</span>
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

  let trains = getLiveTrains();
  if (!trains || trains.length === 0) trains = generateDemoTrains();

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
    { train_number: 43209, train_name: "MASS-TRL EMU LOCAL", train_type: "EMU Local", scheduled_departure: "06:40 AM", scheduled_arrival: "07:55 AM", ai_predicted_eta: "07:55 AM", current_delay: 0, platform: 13, current_speed: 47.2, delay_reason: "On Time", current_station: "MASS", station_sequence: 1 },
    { train_number: 43205, train_name: "MASS-TRL MEMU FAST", train_type: "Fast Local", scheduled_departure: "06:55 AM", scheduled_arrival: "08:12 AM", ai_predicted_eta: "08:18 AM", current_delay: 6, platform: 12, current_speed: 27.4, delay_reason: "Signal Clearance Delay at Basin Bridge Jn", current_station: "BBQ", station_sequence: 2 },
    { train_number: 43425, train_name: "MASS-AJJ FAST LOCAL", train_type: "Fast Local", scheduled_departure: "17:45", scheduled_arrival: "18:32", ai_predicted_eta: "18:46:30", current_delay: 6, platform: 1, current_speed: 68.2, delay_reason: "Signal issue", delay_description: "Signal problem near Avadi is causing operational delay.", current_station: "AVD", station_sequence: 12 },
    { train_number: 43217, train_name: "MASS-TRL FAST LOCAL", train_type: "Fast Local", scheduled_departure: "07:10 AM", scheduled_arrival: "08:15 AM", ai_predicted_eta: "08:15 AM", current_delay: 0, platform: 14, current_speed: 63.8, delay_reason: "On Time", current_station: "MASS", station_sequence: 1 },
    { train_number: 43221, train_name: "MASS-TRL EMU LOCAL", train_type: "EMU Local", scheduled_departure: "07:25 AM", scheduled_arrival: "08:40 AM", ai_predicted_eta: "08:43 AM", current_delay: 3, platform: 13, current_speed: 38.6, delay_reason: "Slow speed over TSR section", current_station: "VLK", station_sequence: 6 }
  ];
}

// Live Mobile Weather & Temperature Card Manager
function updateMobileWeatherCard() {
  const tempEl = document.getElementById('m-weather-temp');
  const descEl = document.getElementById('m-weather-desc');
  const stnEl = document.getElementById('m-weather-station');
  const iconEl = document.getElementById('m-weather-icon');
  const humEl = document.getElementById('m-weather-humidity');
  const impactEl = document.getElementById('m-weather-impact-badge');
  if (!tempEl) return;

  const appState = getAppState();
  const weatherList = (Array.isArray(appState.weather) && appState.weather.length > 0) ? appState.weather : null;
  if (!weatherList) {
    // If weather is not populated yet, fetch directly from FastAPI endpoint
    fetch('/weather')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          if (typeof window !== 'undefined') {
            if (!window.state) window.state = {};
            window.state.weather = data;
          }
          updateMobileWeatherCard();
        }
      })
      .catch(err => {
        console.warn('Weather fetch retry:', err);
      });
    return;
  }

  // Find weather matching current selected origin station
  const orgCode = mobileState.origin ? (mobileState.origin.massCode || mobileState.origin.code) : 'MASS';
  let w = weatherList.find(item => item.station_code === orgCode || item.station_code === mobileState.origin.code);
  if (!w) w = weatherList[0];

  const tempVal = typeof w.temperature === 'number' ? (Math.round(w.temperature * 10) / 10) : 32.0;
  tempEl.textContent = `${tempVal}°C`;
  if (descEl) descEl.textContent = w.weather_desc || 'Clear sky';
  if (stnEl) stnEl.textContent = `${w.station || mobileState.origin.name} · Suburban Line`;
  if (humEl) humEl.textContent = `${Math.round(w.humidity || 68)}%`;

  // Dynamic Weather Icon based on WMO code
  let iconHtml = '<i class="fa-solid fa-cloud-sun" style="color: #FDE047;"></i>';
  const code = w.weather_code || 0;
  if (code === 0 || code === 1) {
    iconHtml = '<i class="fa-solid fa-sun" style="color: #FBBF24;"></i>';
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    iconHtml = '<i class="fa-solid fa-cloud-showers-heavy" style="color: #60A5FA;"></i>';
  } else if (code >= 95) {
    iconHtml = '<i class="fa-solid fa-cloud-bolt" style="color: #F59E0B;"></i>';
  } else if (code === 45 || code === 48) {
    iconHtml = '<i class="fa-solid fa-smog" style="color: #94A3B8;"></i>';
  } else if (code >= 2 && code <= 3) {
    iconHtml = '<i class="fa-solid fa-cloud" style="color: #E2E8F0;"></i>';
  }

  if (iconEl) iconEl.innerHTML = iconHtml;

  if (impactEl) {
    const isDry = (w.rain || 0) <= 1.0;
    impactEl.innerHTML = `<i class="fa-solid fa-droplet"></i> <span id="m-weather-humidity">${Math.round(w.humidity || 68)}%</span> · ${isDry ? 'Dry Track' : 'Wet Track Caution'}`;
  }
}

// Global Window Exports
window.updateMobileWeatherCard = updateMobileWeatherCard;
window.executeTrainSearch = executeTrainSearch;
window.renderSearchResultsList = renderSearchResultsList;
window.renderQuickSearchList = renderQuickSearchList;
window.renderMobileLiveStatus = renderMobileLiveStatus;
window.renderMobileTimetable = renderMobileTimetable;
window.getLiveTrains = getLiveTrains;

