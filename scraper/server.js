const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'EventSeeker Scraper',
        version: '1.0.0',
        updated: new Date().toISOString()
    });
});

// Trigger Scrape Endpoint
app.get('/scrape', async (req, res) => {
    const { city, category } = req.query;
    console.log(`[Scraper] Received request for City: ${city}, Cat: ${category}`);

    try {
        // Launch Browser
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // TODO: Implement actual scraping logic for various venues
        // For now, we return empty structure as "Real Data" is not yet available
        // User requested NO MOCK DATA.

        const realData = []; // Waiting for scraper logic implementation

        await browser.close();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            events: realData
        });

    } catch (error) {
        console.error('Scrape Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`EventSeeker Scraper running on http://localhost:${PORT}`);
});
