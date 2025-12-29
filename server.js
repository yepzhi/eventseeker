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

// Start Background Loop
const SCRAPE_INTERVAL = 1000 * 60 * 60; // 1 Hour
setTimeout(() => runBackgroundScrape(), 5000); // Run 5s after start
setInterval(runBackgroundScrape, SCRAPE_INTERVAL);

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
    // Reordered: prioritized gemini-pro (stable) over 1.5-flash (beta/404 prone)
    const MODELS = ['gemini-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-1.5-flash-8b'];

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

    for (const model of MODELS) {
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
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
        if (newEvents.length > 0) {
            GLOBAL_CACHE.events = newEvents;
            GLOBAL_CACHE.timestamp = new Date().toISOString();
            log(`Scan Complete. ${newEvents.length} events found.`, 'success', 100);
            broadcast({ type: 'result', events: newEvents, timestamp: GLOBAL_CACHE.timestamp });
        } else {
            log(`Scan finished. No events found.`, 'warn', 100);
            broadcast({ type: 'result', events: GLOBAL_CACHE.events, timestamp: GLOBAL_CACHE.timestamp });
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
    console.log(`[System] Version 2.1 - Loaded with API Key Fix`);
});
