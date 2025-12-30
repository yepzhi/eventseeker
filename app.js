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

// Backend runs on Hugging Face, frontend may be served from yepzhi.com
const API_URL = 'https://yepzhi-eventseeker.hf.space/scrape';

async function filterEvents() {
    const citySelect = document.getElementById('citySelect');
    const catSelect = document.getElementById('catSelect');

    const city = citySelect ? citySelect.value : 'all';
    const Category = catSelect ? catSelect.value : 'all';
    // Current Date Range is tracked by global variable or we can read DOM
    // Global 'currentDateRange' is updated by button clicks

    const grid = document.getElementById('resultsGrid');
    // Show Loading
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.5);">Scanning sources...</div>';

    let eventsToDisplay = [];

    // 1. Try Fetching from Backend (STREAMING)
    const evtSource = new EventSource(`${API_URL}/scrape?city=${city}&category=${Category}`);

    evtSource.onmessage = function (event) {
        // Keep stream open for live updates
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'log') {
                // Badge progress update only (visor removed)
                if (data.progress !== undefined && data.progress !== null) {
                    const el = document.getElementById('updateText');
                    const dot = document.querySelector('.pulse-dot');
                    if (el) el.innerText = `AI Scan: ${data.progress}%`;
                    if (dot) dot.style.backgroundColor = '#eab308'; // Yellow
                }
            }

            if (data.type === 'result') {
                // Final Data
                eventsToDisplay = data.events || [];

                if (data.timestamp) {
                    lastScrapeTime = new Date(data.timestamp);
                    if (data.nextScan) window.nextScanTime = data.nextScan;
                    // Only update text to "Time ago" if NOT currently scanning
                    if (!data.events || data.events.length > 0) updateServerStatus();

                    // Restore System Status to Live
                    const statusEl = document.getElementById('systemStatus');
                    if (statusEl) {
                        statusEl.innerHTML = `
                            <span class="status-dot live"></span>
                            <span class="status-text">Live</span>
                        `;
                    }
                }

                // Handle Weather Data
                if (data.weather && data.weather.length > 0) {
                    lastWeatherData = data.weather;
                    updateWeatherUI();
                }

                // Render Logic
                const filtered = eventsToDisplay.filter(ev => checkDateRange(ev.date, currentDateRange));
                renderEvents(filtered, grid);
            }

        } catch (e) {
            console.error("Parse Error", e);
        }
    };

    // ... error handling ...
    evtSource.onerror = function (err) {
        console.error("EventSource failed:", err);
        evtSource.close();
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) statusEl.innerHTML = `<span class="status-dot error"></span><span class="status-text">Error</span>`;
    };
}

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

function checkDateRange(eventDateIso, range) {
    const eventDate = new Date(eventDateIso);
    const now = new Date();

    // Normalize "Today" to start of day for comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const diffTime = eventDayStart - todayStart;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (range === 'today') {
        return diffDays <= 1; // Allow 24h window
    }
    if (range === '3days') {
        return diffDays <= 3;
    }
    if (range === '7days') {
        return diffDays >= 0 && diffDays <= 7;
    }
    if (range === '30days') {
        // Extended to 60 days to cover full next month view
        return diffDays >= 0 && diffDays <= 60;
    }
    return true;
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

        const dateObj = new Date(ev.date);
        const month = dateObj.toLocaleString('default', { month: 'short' });
        const day = dateObj.getDate();

        // Ensure link is never null/undefined
        const linkHref = ev.link ? ev.link : '#';

        row.innerHTML = `
            <div class="row-date">
                <span class="row-month">${month}</span>
                <span class="row-day">${day}</span>
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
