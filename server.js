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
    { id: 'parque_la_ruina', city: 'Hermosillo', category: 'General', url: 'https://www.facebook.com/ParqueLaRuinaHMO' },
    { id: 'el_foro', city: 'Tijuana', category: 'Conciertos', url: 'https://www.facebook.com/ElForoTijuana' },
    { id: 'rialto', city: 'Tucson', category: 'Conciertos', url: 'https://www.rialto.com' } // Example real site
];

// Trigger Scrape Endpoint
app.get('/scrape', async (req, res) => {
    const { city, category } = req.query;
    console.log(`[Scraper] Starting scrape for City: ${city}, Cat: ${category}`);

    try {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const realData = [];
        const page = await context.newPage();

        // 1. Filter sources based on request to save resources
        const targets = VENUES.filter(v => {
            return (city === 'all' || v.city === city) &&
                (category === 'all' || v.category === category);
        });

        // 2. Scrape each target
        for (const venue of targets) {
            try {
                console.log(`Visiting: ${venue.url}`);
                await page.goto(venue.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                // Generic Metadata Extraction (OpenGraph / Title)
                // This is a "Heuristic" scraper. For specific sites, we'd need specific selectors.
                const pageTitle = await page.title();
                const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => pageTitle) || pageTitle;
                const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => '').then(res => res || '');

                // For now, we assume the "Latest Post" or the Page itself represents an event opportunity
                // In a production scraper, we would parse specific post elements.

                realData.push({
                    id: venue.id + '_' + Date.now(),
                    title: ogTitle.replace(' | Facebook', '').substring(0, 60), // Clean up title
                    venue: {
                        name: venue.id.replace(/_/g, ' ').toUpperCase(),
                        city: venue.city,
                        category: venue.category,
                        url: venue.url
                    },
                    date: new Date().toISOString(), // Default to "Now" if no date found
                    image: ogImage,
                    link: venue.url
                });

            } catch (err) {
                console.error(`Failed to scrape ${venue.url}:`, err.message);
                // Continue to next venue
            }
        }

        await browser.close();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            events: realData // Now returns actual info found on the pages
        });

    } catch (error) {
        console.error('Global Scrape Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`EventSeeker Scraper running on http://localhost:${PORT}`);
});
