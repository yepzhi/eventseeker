// EventSeeker Frontend Logic
// Simulates the "Headless Browser" results for the demo

// INLINED DATA TO AVOID FILE:// CORS ISSUES
const INLINED_VENUES = [
    {
        "id": "parque_la_ruina",
        "name": "Parque La Ruina",
        "city": "Hermosillo",
        "state": "Sonora",
        "category": "General",
        "url": "https://www.facebook.com/ParqueLaRuinaHMO"
    },
    // ... (rest of venues if needed, but we rely on backend mainly)
];

let venues = INLINED_VENUES;
let allEvents = [];
let currentDateRange = '30days';

document.addEventListener('DOMContentLoaded', async () => {
    // 2. Setup Listeners
    // Auto-update on filter change
    const citySelect = document.getElementById('citySelect');
    const catSelect = document.getElementById('catSelect');

    if (citySelect) citySelect.addEventListener('change', filterEvents);
    if (catSelect) catSelect.addEventListener('change', filterEvents);

    // Date Buttons Logic
    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active from all
            document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');
            // Update state
            currentDateRange = e.target.getAttribute('data-range');
            // Re-run filter using new logic
            filterEvents();
        });
    });

    // Auto-run for demo effect
    filterEvents();

    // Init Status Text (Simulated Server Time)
    updateServerStatus();
    // Update every minute (UI only)
    setInterval(updateServerStatus, 60000);

    // Modal Open/Close
    const btnAddEvent = document.getElementById('btnAddEvent');
    const modalOverlay = document.getElementById('eventModalOverlay');
    const btnModalClose = document.getElementById('btnModalClose');
    const addEventForm = document.getElementById('addEventForm');

    if (btnAddEvent && modalOverlay) {
        btnAddEvent.addEventListener('click', () => {
            modalOverlay.classList.add('open');
            const todayStr = new Date().toISOString().split('T')[0];
            document.getElementById('formStartDate').value = todayStr;
        });
    }

    if (btnModalClose && modalOverlay) {
        btnModalClose.addEventListener('click', () => {
            modalOverlay.classList.remove('open');
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('open');
            }
        });
    }

    if (addEventForm) {
        addEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btnFormSubmit');
            if (submitBtn) submitBtn.disabled = true;

            const t = translations[currentLang];

            const payload = {
                title: document.getElementById('formTitle').value,
                date: document.getElementById('formStartDate').value,
                endDate: document.getElementById('formEndDate').value || null,
                time: document.getElementById('formTime').value,
                venueName: document.getElementById('formVenue').value,
                venueCity: document.getElementById('formCity').value,
                venueCategory: document.getElementById('formCategory').value,
                description: document.getElementById('formDesc').value,
                link: document.getElementById('formLink').value
            };

            try {
                const res = await fetch(`${API_BASE}/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Server error');
                }

                alert(t.alertSuccess || 'Event saved successfully!');
                addEventForm.reset();
                modalOverlay.classList.remove('open');
                filterEvents();
            } catch (err) {
                alert((t.alertError || 'Error saving event: ') + err.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});

// SIMULATE SERVER STATE (To be replaced by real fetch to HuggingFace)
let lastScrapeTime = null;

function updateServerStatus(isError = false) {
    // Global variable for currentLang is in translations.js
    if (typeof translations === 'undefined') return;

    const el = document.getElementById('updateText');
    const dot = document.querySelector('.pulse-dot');
    const badge = document.querySelector('.update-info');

    if (isError) {
        // Error State
        el.innerText = translations[currentLang].syncError;
        if (dot) dot.style.backgroundColor = '#ef4444'; // Red
        if (badge) badge.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        return;
    }

    // Checking if we have valid data yet
    if (!lastScrapeTime || isNaN(lastScrapeTime.getTime())) {
        el.innerText = "Next scan: 5AM";
        if (dot) dot.style.backgroundColor = '#eab308'; // Yellow
        return;
    }

    // Success State - Show "Last: Date, Time • Next: 5AM"
    if (dot) dot.style.backgroundColor = '#22c55e'; // Green
    if (badge) badge.style.borderColor = 'rgba(255, 255, 255, 0.05)';

    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    const formattedDate = lastScrapeTime.toLocaleString('en-US', options);

    if (el) el.innerText = `Last: ${formattedDate} • Next: 5AM`;
}
// Export for translations.js to call if language changes
window.updateServerStatus = updateServerStatus;

// --- FILTER & API LOGIC ---

// Backend API detection
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
    ? 'http://localhost:3000'
    : 'https://yepzhi-eventseeker.hf.space';

const API_URL = `${API_BASE}/events`;

async function filterEvents() {
    const citySelect = document.getElementById('citySelect');
    const catSelect = document.getElementById('catSelect');

    const city = citySelect ? citySelect.value : 'all';
    const Category = catSelect ? catSelect.value : 'all';

    const grid = document.getElementById('resultsGrid');
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.5);">Loading events...</div>';

    try {
        const res = await fetch(`${API_URL}?city=${city}&category=${Category}`);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();

        const events = data.events || [];

        // Update status
        if (data.timestamp) {
            lastScrapeTime = new Date(data.timestamp);
            updateServerStatus();
        }

        // Next scan info
        if (data.nextScan) {
            const hrsLeft = Math.round((data.nextScan - Date.now()) / 3600000);
            const el = document.getElementById('updateText');
            if (el && hrsLeft > 0) el.innerText = `Last AI Scan: ${lastScrapeTime ? lastScrapeTime.toLocaleDateString() : '—'} • Próx scan: ${hrsLeft}h`;
        }

        // System status dot
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) {
            statusEl.innerHTML = events.length > 0
                ? `<span class="status-dot live"></span><span class="status-text">Live</span>`
                : `<span class="status-dot"></span><span class="status-text">No data</span>`;
        }

        // Weather
        if (data.weather && data.weather.length > 0) {
            lastWeatherData = data.weather;
            updateWeatherUI();
        }

        // Render filtered by date range
        const filtered = events.filter(ev => checkDateRange(ev.date, currentDateRange, ev.endDate));
        renderEvents(filtered, grid);

    } catch (err) {
        console.error('EventSeeker fetch error:', err);
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444;">⚠️ Could not connect to the AI engine. Retrying...</div>`;
        updateServerStatus(true);
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) statusEl.innerHTML = `<span class="status-dot error"></span><span class="status-text">Error</span>`;
    }
}

// Poll every 5 minutes for fresh data (no token cost, just reads cache)
setInterval(filterEvents, 5 * 60 * 1000);

// --- WEATHER LOGIC ---
let lastWeatherData = null;

function updateWeatherUI() {
    const pill = document.getElementById('weatherPill');
    const textEl = document.getElementById('weatherText');

    if (!lastWeatherData || lastWeatherData.length === 0) return;

    // Show pill
    pill.style.display = 'inline-flex';

    // Calculate 7-Day Min/Max (Centigrade)
    // We assume data passed is next 7 days from backend
    const next7 = lastWeatherData.slice(0, 7);
    const allMins = next7.map(d => d.min);
    const allMaxs = next7.map(d => d.max);

    const minC = Math.min(...allMins);
    const maxC = Math.max(...allMaxs);

    // Determine Unit based on Lang
    // Access global currentLang from translations.js
    const isEnglish = (typeof currentLang !== 'undefined' && currentLang === 'en');

    let displayMin = minC;
    let displayMax = maxC;
    let unit = '°C';
    let label = 'Próx 7 Días';

    if (isEnglish) {
        // Convert to F
        displayMin = Math.round((minC * 9 / 5) + 32);
        displayMax = Math.round((maxC * 9 / 5) + 32);
        unit = '°F';
        label = 'Next 7 Days';
    }

    textEl.innerText = `${label}: ${displayMin}-${displayMax}${unit}`;
}
// Export for translations.js to update on toggle
window.updateWeatherUI = updateWeatherUI;

function checkDateRange(startDateIso, range, endDateIso) {
    const start = new Date(startDateIso);
    if (isNaN(start.getTime())) return false;

    const end = endDateIso ? new Date(endDateIso) : start;
    const now = new Date();

    // todayStart constructed in UTC using local year/month/date
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const eventStart = start;
    const eventEnd = end;

    let windowEndDays = 30;
    if (range === 'today') windowEndDays = 1;
    else if (range === '3days') windowEndDays = 3;
    else if (range === '7days') windowEndDays = 7;
    else if (range === '30days') windowEndDays = 60; // cover full next month view

    const windowEnd = new Date(todayStart.getTime() + windowEndDays * 24 * 60 * 60 * 1000);

    // Event overlaps with search window if:
    // Event starts before the window ends, and ends after the window starts
    return eventStart < windowEnd && eventEnd >= todayStart;
}

function formatEventDate(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return `<span class="row-month">TBD</span><span class="row-day">—</span>`;
    
    if (!endDateStr) {
        const month = start.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const day = start.getUTCDate();
        return `<span class="row-month">${month}</span><span class="row-day">${day}</span>`;
    }
    
    const end = new Date(endDateStr);
    if (isNaN(end.getTime()) || start.getTime() === end.getTime()) {
        const month = start.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const day = start.getUTCDate();
        return `<span class="row-month">${month}</span><span class="row-day">${day}</span>`;
    }
    
    const startMonthStr = start.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const endMonthStr = end.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();
    
    if (startMonthStr === endMonthStr) {
        return `
            <span class="row-month">${startMonthStr}</span>
            <span class="row-day" style="font-size: 1.1em; line-height: 1.1;">${startDay}-${endDay}</span>
        `;
    } else {
        return `
            <span class="row-month" style="font-size:0.6em; line-height: 1;">${startMonthStr}-${endMonthStr}</span>
            <span class="row-day" style="font-size: 0.9em; line-height: 1.1;">${startDay}-${endDay}</span>
        `;
    }
}

function renderEvents(events, container) {
    container.innerHTML = '';
    container.className = 'events-list'; // Switch to List View

    if (events.length === 0) {
        container.innerHTML = `
        <div style="text-align:center; opacity:0.5; padding:40px; border:1px dashed rgba(255,255,255,0.1); border-radius:20px;">
            No real events found for <strong>${currentDateRange.toUpperCase()}</strong>.
        </div>`;
        return;
    }

    events.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'event-row';

        const dateHtml = formatEventDate(ev.date, ev.endDate);

        // Ensure link is never null/undefined
        const linkHref = ev.link ? ev.link : '#';

        row.innerHTML = `
            <div class="row-date">
                ${dateHtml}
            </div>
            
            <div class="row-info">
                <div class="row-title">
                    ${ev.title} 
                    ${ev.aiVerified ? '<span style="font-size:0.6em; background:#22c55e; color:black; padding:2px 4px; border-radius:4px; margin-left:6px;">AI Verified ✨</span>' : ''}
                </div>
                <div class="row-venue">
                    <span style="color:#facc15; font-weight:700; margin-right:4px;">${ev.time || 'TBD'}</span> • 
                    ${ev.venue.name} ${ev.venue.name.toLowerCase() === ev.venue.city.toLowerCase() ? '' : '• ' + ev.venue.city}
                </div>
            </div>

            <a href="${linkHref}" target="_blank" class="row-btn" title="View Details">
                ➜
            </a>
        `;
        container.appendChild(row);
    });
}
