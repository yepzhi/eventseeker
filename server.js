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
app.get('/scrape', async (req, res) => {
    const { city, category } = req.query;
    console.log(`[Scraper] Starting scrape for City: ${city}, Cat: ${category}`);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (msg, type = 'info') => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: msg, level: type })}\n\n`);
    };

    try {
        sendLog(`Initializing Headless Browser...`);

        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });

        const realData = [];
        const page = await context.newPage();

        // 1. Filter sources
        const targets = VENUES.filter(v => {
            return (city === 'all' || v.city === city) &&
                (category === 'all' || v.category === category);
        });

        sendLog(`Found ${targets.length} targets matching filters.`);

        // 2. Scrape each target
        for (const [index, venue] of targets.entries()) {
            try {
                // Progress update
                sendLog(`[${index + 1}/${targets.length}] Scanning ${venue.id}...`);

                // Increased timeout to 25s for slower sites / HF network
                try {
                    await page.goto(venue.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                } catch (e) {
                    sendLog(`Timeout visiting ${venue.url}, skipping...`, 'warn');
                    continue;
                }

                const pageTitle = await page.title();
                const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => pageTitle) || pageTitle;
                const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => '').then(res => res || '');

                if (ogTitle) {
                    realData.push({
                        id: venue.id + '_' + Date.now(),
                        title: ogTitle.replace(' | Facebook', '').substring(0, 60),
                        venue: {
                            name: venue.id.replace(/_/g, ' ').toUpperCase(),
                            city: venue.city,
                            category: venue.category,
                            url: venue.url
                        },
                        date: new Date().toISOString(),
                        image: ogImage,
                        link: venue.url
                    });
                    sendLog(`> Found: ${ogTitle.substring(0, 20)}...`, 'success');
                }

            } catch (err) {
                sendLog(`Error scanning ${venue.id}: ${err.message}`, 'error');
            }
        }

        await browser.close();

        // Final payload
        res.write(`data: ${JSON.stringify({ type: 'result', events: realData, timestamp: new Date().toISOString() })}\n\n`);

        // Close Stream
        res.write('event: close\ndata: close\n\n');
        res.end();

    } catch (error) {
        console.error('Global Scrape Error:', error);
        sendLog(`CRITICAL ERROR: ${error.message}`, 'error');
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`EventSeeker Scraper running on http://localhost:${PORT}`);
});
