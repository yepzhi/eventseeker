---
title: EventSeeker API
emoji: 🎟️
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# EventSeeker Backend Scraper

This is the backend API for the EventSeeker application.
It uses **Playwright** (Headless Browser) to scrape curated event venues in Sonora, AZ, and BC.

## Endpoints

- `GET /`: Status check.
- `GET /scrape?city=Hermosillo&category=Conciertos`: Triggers a scrape (or fetch) for specific filters.

## Deployment

This space is configured to use the **Docker** SDK to support headless browser dependencies.
