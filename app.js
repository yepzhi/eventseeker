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
    {
        "id": "auditorio_civico",
        "name": "Auditorio Cívico del Estado",
        "city": "Hermosillo",
        "state": "Sonora",
        "category": "Conciertos",
        "url": "https://www.facebook.com/AuditorioCivicoSonora"
    },
    {
        "id": "london_pub",
        "name": "London Pub",
        "city": "Hermosillo",
        "state": "Sonora",
        "category": "Fiestas",
        "url": "https://www.facebook.com/LondonPubHmo"
    },
    {
        "id": "light_club",
        "name": "Light",
        "city": "Hermosillo",
        "state": "Sonora",
        "category": "Fiestas",
        "url": "https://www.facebook.com/LightClubHmo"
    },
    {
        "id": "el_foro",
        "name": "El Foro",
        "city": "Tijuana",
        "state": "Baja California",
        "category": "Conciertos",
        "url": "https://www.facebook.com/ElForoTijuana"
    },
    {
        "id": "black_box",
        "name": "Black Box",
        "city": "Tijuana",
        "state": "Baja California",
        "category": "Conciertos",
        "url": "https://www.facebook.com/BlackBoxTijuana"
    },
    {
        "id": "rialto_theatre",
        "name": "Rialto Theatre",
        "city": "Tucson",
        "state": "Arizona",
        "category": "Conciertos",
        "url": "https://www.facebook.com/RialtoTheatreTucson"
    },
    {
        "id": "hotel_congress",
        "name": "Hotel Congress",
        "city": "Tucson",
        "state": "Arizona",
        "category": "Cultura",
        "url": "https://www.facebook.com/hotelcongress"
    },
    {
        "id": "van_buren",
        "name": "The Van Buren",
        "city": "Phoenix",
        "state": "Arizona",
        "category": "Conciertos",
        "url": "https://www.facebook.com/TheVanBurenPHX"
    },
    {
        "id": "chase_field",
        "name": "Chase Field",
        "city": "Phoenix",
        "state": "Arizona",
        "category": "Deportes",
        "url": "https://www.facebook.com/ChaseField"
    }
];

let venues = INLINED_VENUES;
let allEvents = [];
let currentDateRange = '3days';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Data Already Loaded (Inlined)
    console.log(`Loaded ${venues.length} venues.`);

    // 2. Setup Listeners
    // Auto-update on filter change
    document.getElementById('citySelect').addEventListener('change', filterEvents);
    document.getElementById('catSelect').addEventListener('change', filterEvents);

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
// We set it to 23 minutes ago for the demo
// Initial State: Null until we get data
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

function runMockScrape() {
    const grid = document.getElementById('resultsGrid');

    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;">Scanning venues... <br><span style="font-size:0.8em; opacity:0.6;">Connecting to sources...</span></div>';

    // SIMULATE DELAY
    setTimeout(() => {
        allEvents = generateMockEvents(venues);
        applyFilters();
    }, 800);
}

// --- FILTER & API LOGIC ---

const API_URL = 'https://yepzhi-eventseeker.hf.space'; // Backend on Hugging Face

async function filterEvents() {
    const citySelect = document.getElementById('citySelect');
    const catSelect = document.getElementById('catSelect');

    const city = citySelect.value;
    const Category = catSelect.value;
    // Current Date Range is tracked by global variable or we can read DOM
    // Global 'currentDateRange' is updated by button clicks

    const grid = document.getElementById('resultsGrid');
    // Show Loading
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.5);">Scanning sources...</div>';

    let eventsToDisplay = [];

    // 1. Try Fetching from Backend (STREAMING)
    // Log visor removed - status shown in badge only

    // Clear previous results temporarily or show them as "old"
    // grid.innerHTML = ... (Already showing loading)

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
                // Don't close immediately if we want to keep stream open for updates, 
                // BUT for user experience, stopping matching the behavior is fine.
                // We keep it open if backend stays open.

                eventsToDisplay = data.events || [];

                if (data.timestamp) {
                    lastScrapeTime = new Date(data.timestamp);
                    if (data.nextScan) window.nextScanTime = data.nextScan;
                    // Only update text to "Time ago" if NOT currently scanning
                    // We let the 'log' messages drive the "Working%" status
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

                // Render Logic
                // If "Today" has 0 events, but we have data, switch to 30days automatically so user sees something
                const todayEvents = eventsToDisplay.filter(ev => checkDateRange(ev.date, 'today'));
                if (todayEvents.length === 0 && eventsToDisplay.length > 0 && currentDateRange === 'today') {
                    currentDateRange = '30days';
                    // Update Buttons UI
                    document.querySelectorAll('.segment-btn').forEach(b => {
                        b.classList.remove('active');
                        if (b.dataset.range === '30days') b.classList.add('active');
                    });
                }

                const filtered = eventsToDisplay.filter(ev => checkDateRange(ev.date, currentDateRange));

                if (eventsToDisplay.length > 0) {
                    renderEvents(filtered, grid);
                } else {
                    grid.innerHTML = `
                        <div style="grid-column:1/-1; text-align:center; opacity:0.5; padding:40px;">
                            No events found in cache. System will retry in background.
                        </div>`;
                }
            }

        } catch (e) {
            console.error("Parse Error", e);
        }
    };

    evtSource.onerror = function (err) {
        console.error("EventSource failed:", err);
        evtSource.close();

        // Update System Status to Error (stays red, no auto-retry)
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="status-dot error"></span>
                <span class="status-text">Error</span>
            `;
        }
        console.log("EventSource disconnected. Refresh page to retry.");
    };

    // 2. Filter by Date (Only if we have events, otherwise empty)
    const filtered = eventsToDisplay.filter(ev => checkDateRange(ev.date, dateRange));

    // 3. Render
    if (eventsToDisplay.length > 0) {
        renderEvents(filtered, grid);
    }
}

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
        return diffDays >= 0 && diffDays <= 30;
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
                <div class="row-venue">${ev.venue.name} • ${ev.venue.city}</div>
            </div>

            <a href="${ev.link}" target="_blank" class="row-btn" title="View Details">
                ➜
            </a>
        `;
        container.appendChild(row);
    });
}

