const translations = {
    en: {
        subtitle: "Automatic scraping of top events in Sonora, AZ & BC.",
        labelWhere: "Where?",
        labelWhat: "What?",
        labelWhen: "When?",
        cityAll: "Everywhere (All Cities)",
        catAll: "Everything (All Types)",
        catConcerts: "Concerts",
        catNightlife: "Nightlife",
        catCulture: "Culture",
        catSports: "Sports",
        btnToday: "Today",
        btn3Days: "Next 3 Days",
        btn7Days: "Next 7 Days",
        btn30Days: "Next 30 Days",
        loadingScan: "Scanning venues...",
        loadingConnect: "Connecting to sources...",
        footerDev: "EventSeeker v0.1 • Developed by @yepzhi",
        updatedAgo: "Updated {min} minutes ago",
        syncError: "Sync Error"
    },
    es: {
        subtitle: "Búsqueda automática de eventos en Sonora, AZ y BC.",
        labelWhere: "¿Dónde?",
        labelWhat: "¿Qué?",
        labelWhen: "¿Cuándo?",
        cityAll: "En todas partes (Todas)",
        catAll: "Todo (Todos los tipos)",
        catConcerts: "Conciertos",
        catNightlife: "Fiesta / Vida Nocturna",
        catCulture: "Cultura",
        catSports: "Deportes",
        btnToday: "Hoy",
        btn3Days: "Próx. 3 Días",
        btn7Days: "Esta Semana",
        btn30Days: "Este Mes",
        loadingScan: "Escaneando lugares...",
        loadingConnect: "Conectando con fuentes...",
        footerDev: "EventSeeker v0.1 • Desarrollado por @yepzhi",
        updatedAgo: "Actualizado hace {min} minutos",
        syncError: "Error de Sincronización"
    }
};

let currentLang = 'en';

document.addEventListener('DOMContentLoaded', () => {
    const langBtn = document.getElementById('langToggle');

    if (langBtn) {
        langBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLanguage();
        });
    }
});

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'es' : 'en';
    updateTexts();
    updateButton();
    // Re-render empty state or content if needed by forcing an update (optional)
    // For now just static texts
}

function updateTexts() {
    const t = translations[currentLang];

    // Header
    document.getElementById('subtitle').innerText = t.subtitle;

    // Dynamic Status Update
    if (window.updateServerStatus) {
        window.updateServerStatus();
    } else {
        // Fallback if app.js isn't fully loaded yet
        let text = t.updatedAgo;
        // Default to XX if not calculated
        text = text.replace('{min}', '23');
        document.getElementById('updateText').innerText = text;
    }

    // Labels
    document.getElementById('lblWhere').innerText = t.labelWhere;
    document.getElementById('lblWhat').innerText = t.labelWhat;
    document.getElementById('lblWhen').innerText = t.labelWhen;

    // City Options (Only the first one needs translation usually, others are proper names)
    // Ideally we iterate options or target specific value
    document.querySelector('#citySelect option[value="all"]').innerText = t.cityAll;

    // Category Options
    document.querySelector('#catSelect option[value="all"]').innerText = t.catAll;
    document.querySelector('#catSelect option[value="Conciertos"]').innerText = t.catConcerts;
    document.querySelector('#catSelect option[value="Fiestas"]').innerText = t.catNightlife;
    document.querySelector('#catSelect option[value="Cultura"]').innerText = t.catCulture;
    document.querySelector('#catSelect option[value="Deportes"]').innerText = t.catSports;

    // Date Buttons
    document.querySelector('[data-range="today"]').innerText = t.btnToday;
    document.querySelector('[data-range="3days"]').innerText = t.btn3Days;
    document.querySelector('[data-range="7days"]').innerText = t.btn7Days;
    document.querySelector('[data-range="30days"]').innerText = t.btn30Days;

    // Footer
    document.querySelector('.footer-btn').innerText = t.footerDev;
}

function updateButton() {
    const langBtn = document.getElementById('langToggle');
    if (currentLang === 'en') {
        langBtn.innerHTML = '<span class="lang-flag">🇲🇽</span><span class="lang-text">ES</span>';
        langBtn.title = "Cambiar a Español";
    } else {
        langBtn.innerHTML = '<span class="lang-flag">🇺🇸</span><span class="lang-text">EN</span>';
        langBtn.title = "Switch to English";
    }
}
