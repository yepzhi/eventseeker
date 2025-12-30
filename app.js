// EventSeeker Frontend Logic
let allEvents = [];
let currentDateRange = '3days';
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Listeners

    // Category Pills
    document.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.getAttribute('data-category');
            filterEvents();
        });
    });

    // Date Buttons Logic
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentDateRange = e.target.getAttribute('data-range');
            filterEvents();
        });
    });

    // Auto-run
    filterEvents();
    // Init Status Text
    updateServerStatus();
});

// SIMULATE SERVER STATE 
let lastScrapeTime = null;
let lastWeatherData = null;

function updateServerStatus(isError = false) {
    const el = document.getElementById('statusText');
    const dot = document.querySelector('.status-dot');

    if (isError) {
        el.innerText = "Error de Conexión";
        if (dot) dot.className = 'status-dot error';
        return;
    }

    if (!lastScrapeTime || isNaN(lastScrapeTime.getTime())) {
        el.innerText = "Sistema: Esperando...";
        if (dot) dot.className = 'status-dot'; // Neutral
        return;
    }

    if (dot) dot.className = 'status-dot live';

    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    const formattedDate = lastScrapeTime.toLocaleString('es-MX', options);

    el.innerText = `Actualizado: ${formattedDate}`;
}

// --- WEATHER LOGIC ---
function updateWeather(dailyData) {
    const widget = document.getElementById('weatherWidget');
    if (!dailyData || dailyData.length === 0) return;

    let html = '';
    // Show next 5 days
    dailyData.slice(0, 5).forEach((day, i) => {
        const dateObj = new Date(day.date + 'T12:00:00'); // Fix TZ
        const dayName = i === 0 ? 'Hoy' : dateObj.toLocaleDateString('es-MX', { weekday: 'short' });

        html += `
            <div class="weather-day">
                <div class="w-dayname">${dayName}</div>
                <div class="w-icon">☀️</div>
                <div class="w-temp">
                    <span class="w-max">${day.max}°</span>
                    <span class="w-min">${day.min}°</span>
                </div>
            </div>
        `;
    });

    widget.innerHTML = html;
}

// --- API & FILTER LOGIC ---
const API_URL = 'https://yepzhi-eventseeker.hf.space';

async function filterEvents() {
    const grid = document.getElementById('resultsGrid');

    if (allEvents.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.5);">Conectando con Deep Research AI...</div>';
    }

    // Apply Local Filters
    applyLocalFilters(grid);

    // Ensure Stream is Active (Idempotent)
    startStream(grid);
}

function applyLocalFilters(container) {
    if (allEvents.length === 0) return;

    // Filter by Category
    let filtered = allEvents;
    if (currentCategory !== 'all') {
        filtered = filtered.filter(ev => {
            // Check tags or category field
            const cat = ev.venue.category || '';
            const tags = ev.tags || [];
            return cat.includes(currentCategory) || tags.some(t => t.includes(currentCategory));
        });
    }

    // Filter by Date
    filtered = filtered.filter(ev => checkDateRange(ev.date, currentDateRange));

    renderEvents(filtered, container);
}

let evtSource = null;
function startStream(grid) {
    if (evtSource && evtSource.readyState !== 2) return; // Already connected

    evtSource = new EventSource(`${API_URL}/scrape`);

    evtSource.onmessage = function (event) {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'log') {
                const el = document.getElementById('statusText');
                if (el) el.innerText = `Deep Research: ${data.message}`;
            }

            if (data.type === 'result') {
                allEvents = data.events || [];

                // Handle Weather
                if (data.weather) {
                    lastWeatherData = data.weather;
                    updateWeather(data.weather);
                }

                if (data.timestamp) {
                    lastScrapeTime = new Date(data.timestamp);
                    updateServerStatus();

                    const statusEl = document.getElementById('systemStatus');
                    if (statusEl) statusEl.innerHTML = `<span class="status-dot live"></span><span class="status-text">Live</span>`;
                }

                applyLocalFilters(grid);
            }

        } catch (e) {
            console.error("Parse Error", e);
        }
    };

    evtSource.onerror = function (err) {
        const statusEl = document.getElementById('systemStatus');
        if (statusEl) statusEl.innerHTML = `<span class="status-dot error"></span><span class="status-text">Error</span>`;
        if (evtSource) evtSource.close();
        evtSource = null;
        // Retry in 5s
        setTimeout(() => startStream(grid), 5000);
    };
}

function checkDateRange(eventDateIso, range) {
    const eventDate = new Date(eventDateIso);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const diffTime = eventDayStart - todayStart;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (range === 'today') return diffDays <= 1;
    if (range === '3days') return diffDays <= 3;
    if (range === '7days') return diffDays >= 0 && diffDays <= 7;
    if (range === '30days') return diffDays >= 0 && diffDays <= 30;
    return true;
}

function renderEvents(events, container) {
    container.innerHTML = '';

    // Sort by Date then Time
    events.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        return da - db;
    });

    if (events.length === 0) {
        container.innerHTML = `
        <div style="text-align:center; opacity:0.5; padding:40px; border:1px dashed rgba(255,255,255,0.1); border-radius:20px;">
            No hay eventos encontrados para <strong>${currentDateRange.toUpperCase()}</strong>.
        </div>`;
        return;
    }

    events.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'event-row';

        // Spanish Date
        const dateObj = new Date(ev.date + 'T12:00:00'); // Force Timezone neutrality
        const dayName = dateObj.toLocaleDateString('es-MX', { weekday: 'short' });
        const dayNum = dateObj.getDate();
        // Time
        const timeStr = ev.time || 'TBD';

        row.innerHTML = `
            <div class="row-date">
                <span class="row-month">${dayName}</span>
                <span class="row-day">${dayNum}</span>
            </div>
            
            <div class="row-info">
                <div class="row-title">
                    ${ev.title} 
                </div>
                <div class="row-meta">
                     📍 ${ev.venue.name || 'Hermosillo'} • ⏰ ${timeStr}
                </div>
                <div class="row-desc">${ev.description || ''}</div>
            </div>

            <a href="${ev.link}" target="_blank" class="row-btn" title="Ver Evento">
                Ver
            </a>
        `;
        container.appendChild(row);
    });
}
