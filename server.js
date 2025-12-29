const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

    // BAJA CALIFORNIA (GENERAL/TIJUANA/ENSENADA/MEXICALI)
    { id: 'zona_turistica_bc', city: 'Baja California', category: 'Turismo', url: 'https://www.zonaturistica.com/eventos/baja-california' },
    { id: 'eventbrite_bc', city: 'Baja California', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--baja-california/events/' },
    { id: 'feverup_tijuana_venue', city: 'Tijuana', category: 'Conciertos', url: 'https://feverup.com/es/tijuana/venue/baja-california-center?srsltid=AfmBOopo9urcEqNNQTvkxnTvWjJPPNg6Vv74UQx4m3uvWabZ9v497cY7' },
    { id: 'rosarito_organizer', city: 'Rosarito', category: 'General', url: 'https://www.rosarito.org/eventos/' },
    { id: 'tijuana_eventos_ig', city: 'Tijuana', category: 'General', url: 'https://www.instagram.com/tijuanaeventos/?hl=es' },
    { id: 'tijuana_eventos_ensenada', city: 'Ensenada', category: 'General', url: 'https://tijuanaeventos.com/eventos-en-ensenada/' },
    { id: 'eventbrite_ensenada', city: 'Ensenada', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--baja-california/ensenada/' },
    { id: 'tijuana_eventos_mexicali', city: 'Mexicali', category: 'General', url: 'https://tijuanaeventos.com/eventos-en-mexicali/' },
    { id: 'eventbrite_mexicali', city: 'Mexicali', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--mexicali/events/' },

    // BAJA CALIFORNIA SUR
    { id: 'eventbrite_bcs', city: 'Baja California Sur', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--baja-california-sur/events/' },
    { id: 'zona_turistica_bcs', city: 'Baja California Sur', category: 'Turismo', url: 'https://www.zonaturistica.com/eventos-en/baja-california-sur' },

    // NOGALES
    { id: 'eventos_nogales_ig', city: 'Nogales', category: 'General', url: 'https://www.instagram.com/eventosociales.nogales/?hl=es' },
    { id: 'eventbrite_nogales', city: 'Nogales', category: 'General', url: 'https://www.eventbrite.com.mx/d/mexico--heroica-nogales/events/' },
    { id: 'bandsintown_nogales', city: 'Nogales', category: 'Conciertos', url: 'https://www.bandsintown.com/es/c/nogales-mexico' },
    { id: 'guia_de_hoy_nogales', city: 'Nogales', category: 'General', url: 'https://guiadehoy.com/nogales-sonora-11/eventos' },

    // ARIZONA (GENERAL/PHOENIX/TUCSON)
    { id: 'eventbrite_az', city: 'Arizona', category: 'General', url: 'https://www.eventbrite.com.mx/d/united-states--arizona/events/' },
    { id: 'visit_arizona', city: 'Arizona', category: 'Turismo', url: 'https://www.visitarizona.com/events' },
    { id: 'fb_group_az', city: 'Arizona', category: 'General', url: 'https://www.facebook.com/groups/1087676634907142/' },
    { id: 'local_first_az', city: 'Arizona', category: 'General', url: 'https://localfirstaz.com/events' },
    { id: 'my_events_center_az', city: 'Arizona', category: 'General', url: 'https://tu.myeventscenter.com/browseByState/AZ/1' },
    { id: 'visit_phoenix', city: 'Phoenix', category: 'Turismo', url: 'https://www.visitphoenix.com/events/next-30-days/' },
    { id: 'dtphx', city: 'Phoenix', category: 'General', url: 'https://dtphx.org/events/calendar' },
    { id: 'tucson_jazz_festival', city: 'Tucson', category: 'Conciertos', url: 'https://tucsonjazzfestival.org/get-jazz-festival-tickets/?gad_source=1&gad_campaignid=23053188849&gbraid=0AAAABBa1xjmymByVZewMv2ZP4JF-maHlj&gclid=Cj0KCQiA6sjKBhCSARIsAJvYcpOgwb-4R1ZVc6XctOu7RwQLZqwbdL11j1P_zvEY-VT2NUkvyT0CadUaApdJEALw_wcB' },
    { id: 'visit_tucson', city: 'Tucson', category: 'Turismo', url: 'https://www.visittucson.org/events/this-weekend/' },
];

// Trigger Scrape Endpoint (SSE Streaming)
// --- CACHE & STORAGE ---
let GLOBAL_CACHE = {
    events: [],
    logs: [],
    timestamp: null,
    isScanning: false
};

// Start Background Loop
const SCRAPE_INTERVAL = 1000 * 60 * 60; // 1 Hour
setTimeout(() => runBackgroundScrape(), 5000); // Run 5s after start
setInterval(runBackgroundScrape, SCRAPE_INTERVAL);

// Helper: Serve Images (Screenshots)
app.use('/screenshots', express.static('screenshots'));
const fs = require('fs');
if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

// --- BACKGROUND SCRAPER ---
async function runBackgroundScrape() {
    if (GLOBAL_CACHE.isScanning) return;
    GLOBAL_CACHE.isScanning = true;
    GLOBAL_CACHE.logs = []; // Clear logs for new run

    const log = (msg, type = 'info') => {
        console.log(`[Scraper] ${msg}`);
        GLOBAL_CACHE.logs.push({ message: msg, level: type, time: Date.now() });
    };

    log('Starting scheduled auto-scrape...');

    try {
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const page = await context.newPage();

        // Block heavy resources
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['font', 'stylesheet', 'media'].includes(type)) route.abort();
            else route.continue();
        });

        const newEvents = [];

        for (const [index, venue] of VENUES.entries()) {
            try {
                log(`[${index + 1}/${VENUES.length}] Visiting ${venue.id}...`);

                try {
                    await page.goto(venue.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForTimeout(1000); // Slight settle
                } catch (e) {
                    log(`Timeout/Error visiting ${venue.url}`, 'warn');
                    // Even if timeout, we might have content loaded? Try anyway.
                }

                // Metadata Extraction
                let title = await page.title();
                let ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => title);
                let ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => '');

                // SCREENSHOT FALLBACK (The "Image Scanning" solution)
                // If no good image found, or just as a robust detail, capture the visible area
                let screenshotUrl = ogImage;
                if (!ogImage || ogImage.length < 10) {
                    const filename = `${venue.id}_${Date.now()}.jpg`;
                    const path = `screenshots/${filename}`;
                    await page.screenshot({ path: path, quality: 60, type: 'jpeg' });
                    screenshotUrl = `/screenshots/${filename}`; // Relative URL served by express
                    log(`> Captured screenshot for ${venue.id}`, 'info');
                }

                if (ogTitle && ogTitle !== 'No Title') {
                    // FILTER GARBAGE
                    const BAD_PATTERNS = [/Cloudflare/i, /Attention Required/i, /Forbidden/i, /Just a moment/i, /Access Denied/i, /403/];
                    if (BAD_PATTERNS.some(p => p.test(ogTitle))) {
                        log(`> Skipping garbage title: ${ogTitle}`, 'warn', progressPct);
                    } else {
                        newEvents.push({
                            id: venue.id + '_' + Date.now(),
                            title: (ogTitle || title).replace(' | Facebook', '').replace(/[\n\r]/g, ' ').substring(0, 80),
                            venue: {
                                name: venue.id.replace(/_/g, ' ').toUpperCase(),
                                city: venue.city,
                                category: venue.category,
                                url: venue.url
                            },
                            date: new Date().toISOString(),
                            image: screenshotUrl,
                            link: venue.url
                        });
                        log(`> Found: ${ogTitle.substring(0, 15)}...`, 'success', progressPct);
                    }
                }

            } catch (err) {
                log(`Failed ${venue.id}: ${err.message}`, 'error');
            }
        }

        await browser.close();

        // Update Cache
        if (newEvents.length > 0) {
            GLOBAL_CACHE.events = newEvents;
            GLOBAL_CACHE.timestamp = new Date().toISOString();
            log(`Scrape Complete. ${newEvents.length} events cached.`, 'success');
        } else {
            log(`Scrape finished but no events found. Keeping old cache.`, 'warn');
        }

    } catch (e) {
        log(`CRITICAL SCRAPER ERROR: ${e.message}`, 'error');
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

    res.write(`data: ${JSON.stringify({ type: 'log', message: 'Connected to EventSeeker Cache.', level: 'info' })}\n\n`);

    if (GLOBAL_CACHE.isScanning) {
        res.write(`data: ${JSON.stringify({ type: 'log', message: 'System is currently scraping updates...', level: 'warn' })}\n\n`);
    } else if (GLOBAL_CACHE.timestamp) {
        const agos = Math.floor((Date.now() - new Date(GLOBAL_CACHE.timestamp)) / 60000);
        res.write(`data: ${JSON.stringify({ type: 'log', message: `Serving results from ${agos} mins ago.`, level: 'success' })}\n\n`);
    } else {
        res.write(`data: ${JSON.stringify({ type: 'log', message: 'First scrape pending... Please wait.', level: 'warn' })}\n\n`);
    }

    // Filter Cache
    let filtered = GLOBAL_CACHE.events || [];
    if (city && city !== 'all') filtered = filtered.filter(e => e.venue.city === city);
    if (category && category !== 'all') filtered = filtered.filter(e => e.venue.category === category);

    // Send Result
    res.write(`data: ${JSON.stringify({ type: 'result', events: filtered, timestamp: GLOBAL_CACHE.timestamp })}\n\n`);

    res.write('event: close\ndata: close\n\n');
    res.end();
});

app.listen(PORT, () => {
    console.log(`EventSeeker Scraper running on http://localhost:${PORT}`);
});
