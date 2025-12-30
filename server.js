const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Force Deploy Fix v2
const app = express();
const PORT = process.env.PORT || 3000;

// GEMINI CONFIG
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDDK0_8eokoXOOBF7EvgsiH2jKFoLMc7Wg';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Stable default
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SCRAPE_INTERVAL = 1000 * 60 * 60 * 24; // 24 Hours
const CACHE_FILE = 'events_db.json';
const KNOWLEDGE_BASE_FILE = 'knowledge_base_jan2026.txt';
const RESEARCH_CITY = 'Hermosillo, Sonora';
const fs = require('fs');

app.use(cors());
app.use(express.json());
// Serve static frontend files
app.use(express.static('.'));

// --- CACHE & STORAGE ---
let GLOBAL_CACHE = {
    events: [],
    logs: [],
    weather: [],
    timestamp: null,
    isScanning: false,
    validModels: []
};

let CLIENTS = [];

// --- PERSISTENCE HELPERS ---
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            const json = JSON.parse(data);
            GLOBAL_CACHE.events = json.events || [];
            GLOBAL_CACHE.timestamp = json.timestamp;
            GLOBAL_CACHE.nextScan = json.nextScan;
            GLOBAL_CACHE.weather = json.weather || []; // Load weather
            console.log(`[System] Loaded ${GLOBAL_CACHE.events.length} events from disk.`);
        }
    } catch (e) {
        console.error("Failed to load cache:", e.message);
    }
}

function saveCache() {
    try {
        cleanupOldEvents(); // Remove past events before saving
        fs.writeFileSync(CACHE_FILE, JSON.stringify({
            events: GLOBAL_CACHE.events,
            weather: GLOBAL_CACHE.weather, // Save weather
            timestamp: GLOBAL_CACHE.timestamp,
            nextScan: GLOBAL_CACHE.nextScan
        }, null, 2));
        console.log(`[System] Saved ${GLOBAL_CACHE.events.length} events to disk (Cleaned old ones).`);
    } catch (e) {
        console.error("Failed to save cache:", e.message);
    }
}

function cleanupOldEvents() {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const beforeCount = GLOBAL_CACHE.events.length;
    GLOBAL_CACHE.events = GLOBAL_CACHE.events.filter(evt => {
        if (!evt.date || evt.date === 'Upcoming') return true;
        try {
            const evtDate = new Date(evt.date);
            if (isNaN(evtDate.getTime())) return true; // Keep if weird format
            return evtDate >= now; // Keep if today or future
        } catch (e) {
            return true;
        }
    });

    const removedCount = beforeCount - GLOBAL_CACHE.events.length;
    if (removedCount > 0) console.log(`[System] Cleaned up ${removedCount} expired events.`);
}

// Load on startup
loadCache();

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
// --- DEEP RESEARCH CONFIG ---
// RESEARCH_CITY defined at top

const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=29.07&longitude=-110.95&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FHermosillo";

// --- CONFIGURATION ---
// No hardcoded venues. We search dynamically.

// --- WEATHER HELPER ---
async function getWeather() {
    try {
        const res = await fetch(WEATHER_API);
        const data = await res.json();
        // Return 7 days of forecast
        if (data.daily) {
            return data.daily.time.map((date, i) => ({
                date,
                max: Math.round(data.daily.temperature_2m_max[i]),
                min: Math.round(data.daily.temperature_2m_min[i])
            }));
        }
        return [];
    } catch (e) {
        console.error("[Weather] Failed to fetch:", e.message);
        return [];
    }
}

// --- DEEP RESEARCH ENGINE ---
async function performDeepResearch() {
    const log = (msg, type = 'info') => {
        console.log(`[DeepResearch] ${msg}`);
        const entry = { type: 'log', message: msg, level: type, time: Date.now() };
        GLOBAL_CACHE.logs.push(entry);
        CLIENTS.forEach(res => res.write(`data: ${JSON.stringify(entry)}\n\n`));
    };

    if (GLOBAL_CACHE.isScanning) return;
    GLOBAL_CACHE.isScanning = true;
    GLOBAL_CACHE.logs = [];

    // 1. Fetch Weather
    log("Fetching 7-day weather forecast...", 'info');
    const weather = await getWeather();
    GLOBAL_CACHE.weather = weather; // Store in cache

    log(`Starting Deep Research for ${RESEARCH_CITY}...`, 'info');

    let events = [];

    // 2. Try Gemini Search Grounding (Official Tool)
    try {
        log("Attempting Gemini Search Grounding...", 'warn');
        const tools = [{ googleSearchRetrieval: {} }];

        // Use a model that supports tools (usually gemini-1.5-flash or pro)
        // Note: Using a specific model known to support tools
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            tools: tools
        });

        const prompt = `
        Give a full list of parties, live music presentations at bars in Hermosillo Sonora the next 30 days.
        Take your time, no hurry. Focus on "Hermosillo" and deep check all available sources.
        
        Return a valid JSON object with an "events" array.
        Each event must verify:
        - title: String (Spanish)
        - date: String (YYYY-MM-DD or "Upcoming")
        - time: String (e.g. "8:00 PM")
        - location: String (Specific Venue Name, e.g. "Catedral", "Parque La Ruina", "Bar X". NEVER use "Hermosillo" or "Sonora" as location)
        - category: One of ["Deportes", "Cultura", "Familia", "Fiesta", "General"]
        - description: String (Max 100 chars, in Spanish, mention venue if known)
        - link: Source URL if available
        
        Focus on accuracy. If venue is unknown, use "Ubicación por definir".
        `;

        const result = await searchModel.generateContent(prompt);
        const response = await result.response;
        // console.log(response.candidates[0].content); // Debug

        const text = response.text();
        const jsonBlock = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonBlock);

        if (parsed.events && parsed.events.length > 0) {
            events = parsed.events;
            log(`Gemini Search found ${events.length} events directly!`, 'success');
        } else {
            throw new Error("Gemini returned empty list");
        }

    } catch (e) {
        log(`Standard Search Grounding failed (${e.message}). Switching to Web Scrape Fallback...`, 'warn');
        events = await scrapeGoogleFallback(log);
    }

    // 3. Process & Merge
    let addedCount = 0;
    if (events.length > 0) {
        addedCount = processAndMergeEvents(events, log);
        saveCache(); // Persist to disk

        log(`Scan Complete. Found ${events.length} candidates. Added ${addedCount} new uniquely. Merged Total: ${GLOBAL_CACHE.events.length}.`, 'success', 100);
        broadcast({
            type: 'result',
            events: GLOBAL_CACHE.events,
            weather: GLOBAL_CACHE.weather, // Send Weather
            timestamp: GLOBAL_CACHE.timestamp,
            nextScan: GLOBAL_CACHE.nextScan
        });
    } else {
        log(`Scan finished. No new events found.`, 'warn', 100);
        GLOBAL_CACHE.nextScan = Date.now() + SCRAPE_INTERVAL;
        saveCache(); // Even if no events, save the nextScan timestamp
        broadcast({
            type: 'result',
            events: GLOBAL_CACHE.events,
            weather: GLOBAL_CACHE.weather, // Send Weather
            timestamp: GLOBAL_CACHE.timestamp,
            nextScan: GLOBAL_CACHE.nextScan
        });
    }

    GLOBAL_CACHE.isScanning = false;
    GLOBAL_CACHE.nextScan = Date.now() + SCRAPE_INTERVAL;
    saveCache();
}

// Fallback: Manually visit Google/Eventbrite Search with Chromium
async function scrapeGoogleFallback(log) {
    let foundEvents = [];
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });

    try {
        const page = await browser.newPage();

        // Strategy: Go to a Google Search for "Eventos en Hermosillo"
        const query = encodeURIComponent(`eventos en ${RESEARCH_CITY} proximos dias`);
        const url = `https://www.google.com/search?q=${query}&ibp=htl;events`; // Event rich snippet view

        log(`Browsing Google Events view...`, 'info');
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Scroll to load more
        await page.evaluate(async () => {
            const container = document.querySelector('div[jsname="gE6ib"]'); // Common event container class (risky) or just body
            // Just scroll body
            for (let i = 0; i < 5; i++) {
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        // Get text content
        const bodyText = await page.evaluate(() => document.body.innerText);

        // Feed to Gemini (plain)
        log(`Analyzing raw search data with Gemini...`, 'info');
        const rawEvents = await analyzeWithGemini(bodyText, { city: RESEARCH_CITY, id: 'google_scrape' });
        foundEvents = rawEvents;

    } catch (e) {
        log(`Fallback scrape failed: ${e.message}`, 'error');
    } finally {
        await browser.close();
    }
    return foundEvents;
}

function processAndMergeEvents(newEvents, log) {
    let added = 0;
    const existingIds = new Set(GLOBAL_CACHE.events.map(e => (e.title + e.date).toLowerCase()));

    newEvents.forEach(evt => {
        const key = (evt.title + evt.date).toLowerCase();
        // Validate date
        if (!evt.date || evt.date === 'Upcoming') { /* Allow */ }
        else {
            const d = new Date(evt.date);
            if (isNaN(d.getTime())) return;
        }

        if (!existingIds.has(key)) {
            // Standardize structure
            GLOBAL_CACHE.events.push({
                id: 'gen_' + Date.now() + Math.random(),
                title: evt.title,
                date: evt.date,
                time: evt.time || 'TBD',
                venue: {
                    name: (evt.location && evt.location.toLowerCase() !== 'hermosillo') ? evt.location : 'Ubicación por definir',
                    city: 'Hermosillo',
                    category: evt.category || 'General',
                    url: evt.link || ''
                },
                description: evt.description,
                link: evt.link || '',
                aiVerified: true,
                tags: [evt.category || 'General']
            });
            added++;
        }
    });

    GLOBAL_CACHE.timestamp = new Date().toISOString();
    log(`Deep Research Complete. Added ${added} new events. Total: ${GLOBAL_CACHE.events.length}`, 'success');
}

// Trigger Scrape Endpoint (SSE Streaming)
// GLOBAL_CACHE and CLIENTS defined at top of file

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
        await performDeepResearch();
        // After scan, schedule next one for 24 hours later
        setInterval(performDeepResearch, 1000 * 60 * 60 * 24);
    }, msUntil5AM);
}

// ONE-TIME: Run immediately since today's 5AM already passed
// console.log(`[System] Running ONE immediate scan (today's 5AM window missed).`);
// setTimeout(() => performDeepResearch(), 5000);

// Then schedule future scans at 5AM GMT-7
scheduleScanAt5AM_GMT7();

// Helper: Serve Images (Screenshots)
app.use('/screenshots', express.static('screenshots'));
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
    Extract ALL upcoming events you find on the page.
    
    Text Snippet:
    ${text.substring(0, 50000)}
    `;

    // List of candidates 
    const candidates = (GLOBAL_CACHE.validModels && GLOBAL_CACHE.validModels.length > 0)
        ? GLOBAL_CACHE.validModels
        : ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro'];

    // --- FLASH EXCLUSIVE FOR QUOTA ---
    // User requested Flash primarily for quota (15 RPM vs 2 RPM for Pro/Experimental).
    // --- FLASH EXCLUSIVE FOR QUOTA ---
    // User requested Flash primarily for quota (15 RPM vs 2 RPM for Pro/Experimental).
    let targetModels = [];
    // Prioritize Lite / Free-Tier Friendly models
    const preferredOrder = ['gemini-2.0-flash-lite-preview-02-05', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];

    // Find first available from preferred list
    let flashModel = 'gemini-2.5-flash'; // Default fallback
    if (GLOBAL_CACHE.validModels && GLOBAL_CACHE.validModels.length > 0) {
        for (const pref of preferredOrder) {
            const found = GLOBAL_CACHE.validModels.find(m => m.includes(pref));
            if (found) {
                flashModel = found;
                break;
            }
        }
    }
    targetModels.push(flashModel);

    // Fallback to Pro only if desperate
    // targetModels.push('gemini-pro'); // Removed to avoid 404/Quota spam

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



// --- KNOWLEDGE BASE INGESTION ---
async function ingestKnowledgeBase() {
    if (!fs.existsSync(KNOWLEDGE_BASE_FILE)) return;

    console.log(`[System] Found Knowledge Base: ${KNOWLEDGE_BASE_FILE}. Ingesting...`);

    try {
        const text = fs.readFileSync(KNOWLEDGE_BASE_FILE, 'utf-8');
        // Reuse analyzeWithGemini but with a specific context
        const events = await analyzeWithGemini(text, { city: 'Hermosillo', id: 'knowledge_base_doc' });

        if (events.length > 0) {
            console.log(`[System] Extracted ${events.length} events from Knowledge Base.`);
            processAndMergeEvents(events, (msg) => console.log(`[Ingest] ${msg}`));
            saveCache();

            // Rename to avoid re-ingestion
            // Rename to avoid re-ingestion
            fs.renameSync(KNOWLEDGE_BASE_FILE, KNOWLEDGE_BASE_FILE + '.processed');
        }
    } catch (e) {
        console.error(`[System] Failed to ingest KB: ${e.message}`);
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
    res.write(`data: ${JSON.stringify({ type: 'result', events: filtered, weather: GLOBAL_CACHE.weather, timestamp: GLOBAL_CACHE.timestamp })}\n\n`);

    // res.write('event: close\ndata: close\n\n'); // Removed as clients are managed by CLIENTS array
    // res.end(); // Removed as clients are managed by CLIENTS array
});

app.listen(PORT, () => {
    console.log(`EventSeeker AI running on http://localhost:${PORT}`);
    console.log(`[System] Version 2.3 - Auto-Discovering Models...`);

    // Auto-discover models on startup
    ingestKnowledgeBase(); // Check for local docs

    // Quick Weather Refresh on Startup (Independent of Deep Research)
    getWeather().then(w => {
        if (w) {
            GLOBAL_CACHE.weather = w;
            saveCache();
            console.log("[System] Initial Weather Cached.");
        }
    });

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
