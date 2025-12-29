const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// GEMINI CONFIG
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDDK0_8eokoXOOBF7EvgsiH2jKFoLMc7Wg';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Fallback to "gemini-pro" as 1.5-flash is returning 404s
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

app.use(cors());
app.use(express.json());
// Serve static frontend files
app.use(express.static('.'));

// Root endpoint (Now serves frontend, or API info if needed, but static takes precedence for index.html)
// Removing explicit root handler to let express.static serve index.html
// app.get('/', (req, res) => {
//     res.json({
//         status: 'online',
//         service: 'EventSeeker Scraper',
//         version: '1.0.0',
//         updated: new Date().toISOString()
//     });
// });

// --- CONFIGURATION ---
const VENUES = [
    // HERMOSILLO
    { id: 'parque_la_ruina', city: 'Hermosillo', category: 'General', url: 'https://www.instagram.com/parquelaruinahmo/?hl=es' },
    { id: 'gran_casona', city: 'Hermosillo', category: 'General', url: 'https://www.instagram.com/lagrancasonahmo/?hl=es' },
    { id: 'hermosillo_gob', city: 'Hermosillo', category: 'Cultura', url: 'https://www.instagram.com/hermosillogob/' },
    { id: 'hermochilo', city: 'Hermosillo', category: 'General', url: 'https://www.instagram.com/hermochilo.son/' },
    { id: 'eventbrite_hmo', city: 'Hermosillo', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--sonora/hermosillo/' },
    { id: 'guia_de_hoy_hmo', city: 'Hermosillo', category: 'General', url: 'https://guiadehoy.com/hermosillo/eventos' },
    { id: 'cada_evento_son', city: 'Hermosillo', category: 'General', url: 'https://www.facebook.com/cadaeventoson/?locale=es_LA' },
    { id: 'conciertos_hmo', city: 'Hermosillo', category: 'Conciertos', url: 'https://www.instagram.com/conciertoshermosillo/' },
    { id: 'bandsintown_hmo', city: 'Hermosillo', category: 'Conciertos', url: 'https://www.bandsintown.com/es/c/hermosillo-mexico' },
    { id: 'feverup_hmo', city: 'Hermosillo', category: 'General', url: 'https://feverup.com/es/hermosillo?srsltid=AfmBOorCm6uf0GE-QguGplb6K2wLHOcO8KpPj9pp0Dl8Dvqy7zc3K_w_ ' },
    { id: 'noro_mx', city: 'Hermosillo', category: 'Conciertos', url: 'https://noro.mx/hermosillo/agenda-conciertos-en-hermosillo-para-2025/' },

    // SONORA (GENERAL)
    { id: 'eventbrite_sonora', city: 'Sonora', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--sonora/events/' },
    { id: 'visit_sonora', city: 'Sonora', category: 'Turismo', url: 'https://www.visitsonora.mx/eventos.php' },
    { id: 'zona_turistica_son', city: 'Sonora', category: 'Turismo', url: 'https://www.zonaturistica.com/eventos-en/sonora' },

    // BAJA CALIFORNIA
    { id: 'zona_turistica_bc', city: 'Baja California', category: 'Turismo', url: 'https://www.zonaturistica.com/eventos/baja-california' },
    { id: 'eventbrite_bc', city: 'Baja California', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--baja-california/events/' },
    { id: 'feverup_tijuana_venue', city: 'Tijuana', category: 'Conciertos', url: 'https://feverup.com/es/tijuana/venue/baja-california-center?srsltid=AfmBOopo9urcEqNNNNQTvkxnTvWjJPPNg6Vv74UQx4m3uvWabZ9v497cY7' },
    { id: 'rosarito_organizer', city: 'Rosarito', category: 'General', url: 'https://www.rosarito.org/eventos/' },
    { id: 'tijuana_eventos_ig', city: 'Tijuana', category: 'General', url: 'https://www.instagram.com/tijuanaeventos/?hl=es' },
    { id: 'tijuana_eventos_ensenada', city: 'Ensenada', category: 'General', url: 'https://tijuanaeventos.com/eventos-en-ensenada/' },

    // ARIZONA
    { id: 'eventbrite_az', city: 'Arizona', category: 'General', url: 'https://www.eventbrite.com.mx/d/united-states--arizona/events/' },
    { id: 'visit_arizona', city: 'Arizona', category: 'Turismo', url: 'https://www.visitarizona.com/events' },
    { id: 'visit_phoenix', city: 'Phoenix', category: 'Turismo', url: 'https://www.visitphoenix.com/events/next-30-days/' },
    { id: 'dtphx', city: 'Phoenix', category: 'General', url: 'https://dtphx.org/events/calendar' }
];

// Trigger Scrape Endpoint (SSE Streaming)
// --- CACHE & STORAGE ---
let GLOBAL_CACHE = {
    events: [],
    logs: [],
    timestamp: null,
    isScanning: false
};

let CLIENTS = [];

// --- SCHEDULED SCAN AT 5AM GMT-7 (= 12:00 UTC) ---
function scheduleScanAt5AM_GMT7() {
    const now = new Date();
    const next5AM_UTC = new Date(now);
    // 5AM GMT-7 = 12:00 PM UTC (noon)
    next5AM_UTC.setUTCHours(12, 0, 0, 0);

    // If it's already past 12:00 UTC today, schedule for tomorrow
    if (now >= next5AM_UTC) {
        next5AM_UTC.setUTCDate(next5AM_UTC.getUTCDate() + 1);
    }

    const msUntil5AM = next5AM_UTC - now;
    const hoursUntil = Math.round(msUntil5AM / 3600000);
    console.log(`[System] Next scan scheduled at 5:00 AM GMT-7 (in ${hoursUntil} hours).`);

    setTimeout(async () => {
        await runBackgroundScrape();
        // After scan, schedule next one for 24 hours later
        setInterval(runBackgroundScrape, 1000 * 60 * 60 * 24);
    }, msUntil5AM);
}

// ONE-TIME: Run immediately since today's 5AM already passed
console.log(`[System] Running ONE immediate scan (today's 5AM window missed).`);
setTimeout(() => runBackgroundScrape(), 5000);

// Then schedule future scans at 5AM GMT-7
scheduleScanAt5AM_GMT7();

// Helper: Serve Images (Screenshots)
app.use('/screenshots', express.static('screenshots'));
const fs = require('fs');
if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

// --- AI HELPER (REST API) ---
// Using raw fetch with Fallback Loop (RichmondBot Strategy)
async function analyzeWithGemini(text, venueContext) {
    if (!text || text.length < 50) return [];


    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error("❌ Missing GEMINI_API_KEY in environment variables.");
        return [];
    }

    // Dynamic Discovery Logic (Cache results)
    if (GLOBAL_CACHE.validModels && GLOBAL_CACHE.validModels.length > 0) {
        // Use cached valid models
    } else {
        // Fallback or Initial List
    }

    // We will iterate GLOBAL_CACHE.validModels if available, else standard list
    const candidates = (GLOBAL_CACHE.validModels && GLOBAL_CACHE.validModels.length > 0)
        ? GLOBAL_CACHE.validModels
        : ['gemini-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-1.5-flash-8b'];

    // Generate Prompt ONCE
    const promptText = `
    You are an event scout for ${venueContext.city}.
    Read the following website text from "${venueContext.id}" and extract upcoming events.
    
    Return a JSON object with an "events" array.
    Each event must have:
    - title: String (Clean title)
    - date: String (YYYY-MM-DD or "Upcoming")
    - description: String (Short summary, max 100 chars)
    
    If it's a login page, error, or purely generic info, return {"events": []}.
    Limit to top 3 events.
    
    Text Snippet:
    ${text.substring(0, 15000)}
    `;

    // Filter for STABLE models (prefer 'pro' or 'flash' without 'exp' or 'preview' if possible)
    // But since the key seems to have access to EVERYTHING, let's pick the best 3.
    let targetModels = [];
    if (candidates.includes('gemini-1.5-flash')) targetModels.push('gemini-1.5-flash');
    if (candidates.includes('gemini-pro')) targetModels.push('gemini-pro');
    if (candidates.includes('gemini-1.5-pro')) targetModels.push('gemini-1.5-pro');
    // If we didn't find standard ones, just take the first 3 from the valid list
    if (targetModels.length === 0) targetModels = candidates.slice(0, 3);

    console.log(`[AI] Attempting extraction with: ${targetModels.join(', ')}`);

    for (const model of targetModels) {
        const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        try {
            // console.log(`Attempting model: ${model}...`);
            const response = await fetch(URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: promptText }]
                    }]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Gemini ${model} Failed (${response.status}): ${errText.substring(0, 200)}`);
                // if (response.status === 404 || response.status === 503) continue; // Disable silent skip for debug
                continue;
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) return [];

            const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return parsed.events || [];

        } catch (e) {
            console.warn(`Model ${model} failed:`, e.message);
            // Try next
        }
    }

    console.error("All Gemini models failed.");
    return [];
}

// --- BACKGROUND SCRAPER ---
async function runBackgroundScrape() {
    if (GLOBAL_CACHE.isScanning) return;
    GLOBAL_CACHE.isScanning = true;
    GLOBAL_CACHE.logs = []; // Clear logs for new run

    const broadcast = (data) => {
        CLIENTS.forEach(res => res.write(`data: ${JSON.stringify(data)}\n\n`));
    };

    const log = (msg, type = 'info', progress = null) => {
        console.log(`[Scraper] ${msg}`);
        const logEntry = { type: 'log', message: msg, level: type, time: Date.now() };
        if (progress !== null) logEntry.progress = progress;
        GLOBAL_CACHE.logs.push(logEntry);
        broadcast(logEntry);
    };

    log('Starting AI-Powered Scan...', 'info', 0);

    try {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage', // Critical for Docker/HF Spaces
                '--dns-result-order=ipv4first', // Fixes Node 17+ DNS issues
                '--disable-blink-features=AutomationControlled' // Evasion
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const targets = VENUES;
        const newEvents = [];

        for (const [index, venue] of targets.entries()) {
            let page = null;
            const progressPct = Math.round(((index + 1) / targets.length) * 100);

            try {
                log(`[${index + 1}/${targets.length}] scanning ${venue.id}...`, 'info', progressPct);

                page = await context.newPage();

                // Block heavy resources
                await page.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['font', 'stylesheet', 'media', 'image'].includes(type)) route.abort();
                    else route.continue();
                });

                let navSuccess = false;
                try {
                    await page.goto(venue.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    // await page.waitForTimeout(1000); // Slight settle
                    navSuccess = true;
                } catch (e) {
                    log(`Nav Error ${venue.id}: ${e.message}`, 'warn', progressPct);
                    // Even if timeout, we might have content loaded? Try anyway.
                }

                if (navSuccess) {
                    // 1. Get Text for AI (Better extraction strategy)
                    // We prioritize H1, H2, Article tags, then fallback to body
                    const bodyText = await page.evaluate(() => {
                        const important = Array.from(document.querySelectorAll('h1, h2, h3, article, .event-card, .post')).map(e => e.innerText).join('\n');
                        return important.length > 200 ? important : document.body.innerText;
                    });

                    // 2. Call Gemini
                    log(`> Analyzing...`, 'info', progressPct);
                    const aiEvents = await analyzeWithGemini(bodyText, venue);

                    if (aiEvents && aiEvents.length > 0) {
                        aiEvents.forEach(evt => {
                            newEvents.push({
                                id: venue.id + '_' + Date.now() + Math.random(),
                                title: evt.title,
                                venue: {
                                    name: venue.id.replace(/_/g, ' ').toUpperCase(),
                                    city: venue.city,
                                    category: venue.category,
                                    url: venue.url
                                },
                                date: evt.date === 'Upcoming' ? new Date().toISOString() : evt.date,
                                image: '',
                                link: venue.url,
                                aiVerified: true,
                                description: evt.description
                            });
                        });
                        log(`> AI Found: ${aiEvents.length} events!`, 'success', progressPct);
                    } else {
                        log(`> No specific events extracted.`, 'warn', progressPct);
                    }
                }

            } catch (err) {
                log(`Failed ${venue.id}: ${err.message}`, 'error', progressPct);
            } finally {
                if (page) await page.close().catch(() => { });
            }
        }

        await browser.close();

        // Update Cache
        // --- PERSISTENCE HELPERS ---
        const CACHE_FILE = 'events_db.json';
        function loadCache() {
            try {
                if (fs.existsSync(CACHE_FILE)) {
                    const data = fs.readFileSync(CACHE_FILE, 'utf8');
                    const json = JSON.parse(data);
                    GLOBAL_CACHE.events = json.events || [];
                    GLOBAL_CACHE.timestamp = json.timestamp;
                    GLOBAL_CACHE.nextScan = json.nextScan;
                    console.log(`[System] Loaded ${GLOBAL_CACHE.events.length} events from disk.`);
                }
            } catch (e) {
                console.error("Failed to load cache:", e.message);
            }
        }

        function saveCache() {
            try {
                fs.writeFileSync(CACHE_FILE, JSON.stringify({
                    events: GLOBAL_CACHE.events,
                    timestamp: GLOBAL_CACHE.timestamp,
                    nextScan: GLOBAL_CACHE.nextScan
                }, null, 2));
                console.log(`[System] Saved ${GLOBAL_CACHE.events.length} events to disk.`);
            } catch (e) {
                console.error("Failed to save cache:", e.message);
            }
        }

        // Load on startup
        loadCache();

        // ... inside runBackgroundScrape ...
        if (newEvents.length > 0) {
            // MERGE LOGIC (Prevent overwriting good data with partial scans)
            let addedCount = 0;
            const existingIds = new Set(GLOBAL_CACHE.events.map(e => e.title + e.date)); // Simple dedup key

            newEvents.forEach(evt => {
                const key = evt.title + evt.date;
                if (!existingIds.has(key)) {
                    GLOBAL_CACHE.events.push(evt);
                    addedCount++;
                }
            });

            GLOBAL_CACHE.timestamp = new Date().toISOString();
            GLOBAL_CACHE.nextScan = Date.now() + SCRAPE_INTERVAL;

            saveCache(); // Persist to disk

            log(`Scan Complete. Found ${newEvents.length} new. Merged Total: ${GLOBAL_CACHE.events.length}.`, 'success', 100);
            broadcast({ type: 'result', events: GLOBAL_CACHE.events, timestamp: GLOBAL_CACHE.timestamp, nextScan: GLOBAL_CACHE.nextScan });
        } else {
            log(`Scan finished. No new events found.`, 'warn', 100);
            GLOBAL_CACHE.nextScan = Date.now() + SCRAPE_INTERVAL;
            broadcast({ type: 'result', events: GLOBAL_CACHE.events, timestamp: GLOBAL_CACHE.timestamp, nextScan: GLOBAL_CACHE.nextScan });
        }

    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`, 'error');
    } finally {
        GLOBAL_CACHE.isScanning = false;
    }
}

// Client Endpoint: Returns CACHED data instantly (streaming logs if active)
app.get('/scrape', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { city, category } = req.query;

    CLIENTS.push(res);

    const pingId = setInterval(() => res.write(': keepalive\n\n'), 15000);

    req.on('close', () => {
        clearInterval(pingId);
        CLIENTS = CLIENTS.filter(c => c !== res);
    });

    res.write(`data: ${JSON.stringify({ type: 'log', message: 'Connected to AI Engine.', level: 'info' })}\n\n`);

    if (GLOBAL_CACHE.isScanning) {
        res.write(`data: ${JSON.stringify({ type: 'log', message: 'Gemini is analyzing sources...', level: 'warn' })}\n\n`);
    } else if (GLOBAL_CACHE.timestamp) {
        // const agos = Math.floor((Date.now() - new Date(GLOBAL_CACHE.timestamp)) / 60000);
        res.write(`data: ${JSON.stringify({ type: 'log', message: 'Serving AI-Verified Results.', level: 'success' })}\n\n`);
    } else {
        res.write(`data: ${JSON.stringify({ type: 'log', message: 'First scan pending... Please wait.', level: 'warn' })}\n\n`);
    }

    // Filter Cache
    let filtered = GLOBAL_CACHE.events || [];
    if (city && city !== 'all') filtered = filtered.filter(e => e.venue.city === city);
    if (category && category !== 'all') filtered = filtered.filter(e => e.venue.category === category);

    // Send Result
    res.write(`data: ${JSON.stringify({ type: 'result', events: filtered, timestamp: GLOBAL_CACHE.timestamp })}\n\n`);

    // res.write('event: close\ndata: close\n\n'); // Removed as clients are managed by CLIENTS array
    // res.end(); // Removed as clients are managed by CLIENTS array
});

app.listen(PORT, () => {
    console.log(`EventSeeker AI running on http://localhost:${PORT}`);
    console.log(`[System] Version 2.3 - Auto-Discovering Models...`);

    // Auto-discover models on startup
    const key = process.env.GEMINI_API_KEY;
    if (key) {
        fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
            .then(res => res.json())
            .then(data => {
                if (data.models) {
                    const valid = data.models
                        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => m.name.split('/').pop()); // remove 'models/' prefix

                    if (valid.length > 0) {
                        GLOBAL_CACHE.validModels = valid;
                        console.log(`[System] ✅ Discovered ${valid.length} functioning models:`, valid.join(', '));
                    } else {
                        console.error(`[System] ❌ Key valid but NO generation models found.`);
                    }
                } else {
                    console.error(`[System] ❌ Model Discovery Failed. API Response:`, JSON.stringify(data));
                }
            })
            .catch(e => console.error(`[System] Discovery Error:`, e.message));
    }
});
