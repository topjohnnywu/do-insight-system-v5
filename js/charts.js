// Chart Handles
let TopConsigneeChart = null;

const sunIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function updateThemeToggleButton(themeName) {
    const ToggleBtn = document.getElementById('themeToggleBtn');
    if (!ToggleBtn) return;
    const paletteIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>`;
    const label = ({ linear: "Linear", terminal: "Terminal", amoled: "AMOLED", light: "Light", organic: "Organic", cyber: "Cyberpunk", bitcoin: "Bitcoin", github: "GitHub" })[themeName] || "Themes";
    ToggleBtn.innerHTML = `${paletteIconSvg} <span>${label}</span>`;
    ToggleBtn.setAttribute("title", "Open Theme Settings");
}

function getCurrentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    return (t === "linear" || t === "terminal" || t === "amoled" || t === "light" || t === "organic" || t === "cyber" || t === "bitcoin" || t === "github") ? t : "linear";
}

function isLightTheme() {
    const t = getCurrentTheme();
    if (t === "github") return document.body.classList.contains('github-light');
    return t === "light" || t === "organic";
}

function updateThemeMenu(themeName) {
    document.querySelectorAll('.theme-option[data-theme-option]').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-theme-option') === themeName);
    });
    // For the newly injected theme sidebar grid
    document.querySelectorAll('#theme-grid-container .theme-card').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-theme-option') === themeName);
    });
}

// Live theme picker: per-theme palette dots (click commits)
let activeTheme = "linear";

const THEME_PALETTES = {
    linear:   ["#5E6AD2", "#6872D9", "#a78bfa", "#18181b"],
    amoled:   ["#10b981", "#34d399", "#000000", "#27272a"],
    light:    ["#3b82f6", "#2563eb", "#ffffff", "#e2e8f0"],
    terminal: ["#33ff00", "#66ff33", "#0a0a0a", "#1f521f"],
    organic:  ["#5D7052", "#6E8260", "#DED8CF", "#FDFCF8"],
    cyber:    ["#00ff88", "#4dffab", "#ff2a6d", "#0a0a0f"],
    bitcoin:  ["#F7931A", "#FFA93F", "#94A3B8", "#1E293B"],
    github:   ["#58a6ff", "#3fb950", "#f0f6fc", "#0d1117"]
};

function renderThemeSwatches() {
    document.querySelectorAll('.theme-chip[data-theme]').forEach(chip => {
        const palette = THEME_PALETTES[chip.getAttribute('data-theme')];
        const swatch = chip.querySelector('.tc-swatch');
        if (!palette || !swatch) return;
        swatch.innerHTML = "";
        palette.forEach(color => {
            const dot = document.createElement('span');
            dot.className = 'tc-dot';
            dot.style.backgroundColor = color;
            swatch.appendChild(dot);
        });
    });
}

function buildThemeSidebar() {
    if (document.getElementById('theme-settings-sidebar')) return;
    
    const sidebar = document.createElement('div');
    sidebar.id = 'theme-settings-sidebar';
    sidebar.className = 'theme-settings-sidebar';
    
    const header = document.createElement('div');
    header.className = 'theme-settings-header';
    header.innerHTML = `
        <h2>Theme Settings</h2>
        <button class="theme-settings-close" onclick="closeThemeSidebar()" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    
    const content = document.createElement('div');
    content.className = 'theme-settings-content';
    
    const grid = document.createElement('div');
    grid.className = 'theme-grid';
    grid.id = 'theme-grid-container';
    
    // Convert THEME_PALETTES to sidebar cards
    const themeNames = {
        linear: "Linear (Default)", amoled: "AMOLED Dark", light: "Light Mode",
        terminal: "Terminal", organic: "Organic",
        cyber: "Cyberpunk", bitcoin: "Bitcoin", github: "GitHub"
    };
    
    Object.keys(THEME_PALETTES).forEach(themeKey => {
        const card = document.createElement('a');
        card.href = "#";
        card.className = "theme-card theme-option";
        card.setAttribute("data-theme-option", themeKey);
        card.onclick = (e) => { e.preventDefault(); setTheme(themeKey); };
        
        const palette = THEME_PALETTES[themeKey];
        const swatch = document.createElement('div');
        swatch.className = 'theme-card-swatch';
        swatch.style.background = `conic-gradient(${palette[0]} 0deg 90deg, ${palette[1]} 90deg 180deg, ${palette[2]} 180deg 270deg, ${palette[3]} 270deg 360deg)`;
        
        const label = document.createElement('div');
        label.className = 'theme-card-name';
        label.innerText = themeNames[themeKey] || themeKey;
        
        card.appendChild(swatch);
        card.appendChild(label);
        grid.appendChild(card);
    });
    
    content.appendChild(grid);
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    document.body.appendChild(sidebar);

    // Close on click outside
    document.addEventListener('mousedown', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('#themeToggleBtn')) {
            closeThemeSidebar();
        }
    });
}

function openThemeSidebar() {
    buildThemeSidebar();
    const sidebar = document.getElementById('theme-settings-sidebar');
    if (sidebar) sidebar.classList.add('open');
}

function closeThemeSidebar() {
    const sidebar = document.getElementById('theme-settings-sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

function initThemePicker() {
    renderThemeSwatches();
}

function applyChartTheme(themeName) {
    if (!window.Chart) return;
    if (themeName === "light") {
        Chart.defaults.color = '#334155';
        Chart.defaults.borderColor = '#cbd5e1';
    } else if (themeName === "terminal") {
        Chart.defaults.color = '#33ff00';
        Chart.defaults.borderColor = '#1f521f';
    } else if (themeName === "organic") {
        Chart.defaults.color = '#78786C';
        Chart.defaults.borderColor = '#E6DCCD';
    } else if (themeName === "cyber") {
        Chart.defaults.color = '#00ff88';
        Chart.defaults.borderColor = '#1c1c2e';
    } else if (themeName === "bitcoin") {
        Chart.defaults.color = '#94A3B8';
        Chart.defaults.borderColor = '#1E293B';
    } else if (themeName === "github") {
        if (document.body.classList.contains('github-light')) {
            Chart.defaults.color = '#59636e';
            Chart.defaults.borderColor = '#d0d7de';
        } else {
            Chart.defaults.color = '#8d96a0';
            Chart.defaults.borderColor = '#30363d';
        }
    } else {
        Chart.defaults.color = '#a1a1aa';
        Chart.defaults.borderColor = '#18181b';
    }
}

// Apply a theme to the whole app. Valid themes: linear, terminal, amoled, light, organic, cyber, bitcoin, github.
function setTheme(themeName, persist) {
    const valid = ["linear", "terminal", "amoled", "light", "organic", "cyber", "bitcoin", "github"];
    if (!valid.includes(themeName)) themeName = "linear";
    if (persist === undefined) persist = true;

    const changed = themeName !== getCurrentTheme();
    document.documentElement.setAttribute("data-theme", themeName);
    document.body.classList.toggle('light-mode', themeName === "light");
    document.body.classList.remove('github-light');

    if (persist) {
        localStorage.setItem("AppThemeMode", themeName);
        activeTheme = themeName;
    }

    updateThemeToggleButton(themeName);
    updateThemeMenu(themeName);
    applyChartTheme(themeName);

    if (!changed) return;
    if (typeof refreshDashboard === 'function') refreshDashboard();
    if (typeof applyInsightFilter === 'function') applyInsightFilter();
    if (window.activityTrend && typeof window.activityTrend.renderUI === 'function') window.activityTrend.renderUI();
}

// Initialize theme state on page boot
function initTheme() {
    const saved = localStorage.getItem("AppThemeMode");
    let theme = "linear";
    if (saved === "light") theme = "light";
    else if (saved === "dark" || saved === "amoled") theme = "amoled";
    else if (saved === "terminal") theme = "terminal";
    else if (saved === "organic") theme = "organic";
    else if (saved === "cyber") theme = "cyber";
    else if (saved === "bitcoin") theme = "bitcoin";
    else if (saved === "github") theme = "github";
    else if (saved === "linear") theme = "linear";
    // removed themes (dopamine/retro/mono/bauhaus/premium/winxp/win7) fall back to linear via setTheme validation
    
    buildThemeSidebar(); // Ensure sidebar exists
    setTheme(theme, false);
    activeTheme = theme;
    initSpotlights();
    initThemePicker();
}

function toggleTheme() {
    openThemeSidebar();
}

// KPI card mouse-tracking spotlight (dashboard-tuned)
function initSpotlights() {
    document.querySelectorAll('.kpi-card, .chart-card, .table-card').forEach(card => {
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${e.clientX - r.left}px`);
            card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
    });
}

// Auto-execute theme initialization on script load & DOMContentLoaded so theme persists across ALL pages
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
} else {
    initTheme();
}

// Render Consignees Chart (> 5 m³ volume, ALL consignees included)
function renderCharts() {
    const consigneeChartElem = document.getElementById('consigneeChart');
    if (!consigneeChartElem) return;

    const consigneeVol = {};
    let courtsOriginalKey = null;
    let courtsHasSrWhse = false;

    DataHoarderArray.forEach(item => {
        const consigneeKey = (item.name && item.name.trim() !== "") ? item.name.trim() : "UNASSIGNED";
        if (consigneeKey !== "UNASSIGNED") {
            consigneeVol[consigneeKey] = (consigneeVol[consigneeKey] || 0) + item.vol;

            // Detect COURTS consignee + Tampines North SR/WHSE address (col F)
            if (consigneeKey.toUpperCase().includes("COURTS")) {
                courtsOriginalKey = consigneeKey;
                if ((item.addr || "").toUpperCase().includes("TAMPINES NORTH")) {
                    courtsHasSrWhse = true;
                }
            }
        }
    });

    // Relabel COURTS bar to flag SR/WHSE direct-delivery hub (merged total volume)
    if (courtsHasSrWhse && courtsOriginalKey && consigneeVol[courtsOriginalKey]) {
        consigneeVol["COURTS (SINGAPORE) PTE LTD (SR/WHSE)"] = consigneeVol[courtsOriginalKey];
        delete consigneeVol[courtsOriginalKey];
    }

    if (TopConsigneeChart) TopConsigneeChart.destroy();

    const sortedConsignees = Object.entries(consigneeVol)
        .filter(item => item[1] > 5)
        .sort((a, b) => b[1] - a[1]);

    const isLight = isLightTheme();
    const gridColor = isLight ? '#e2e8f0' : '#18181b';
    const textColor = isLight ? '#334155' : '#a1a1aa';

    const VibrantColors = [
        '#10b981', // Emerald Green
        '#8b5cf6', // Royal Purple
        '#3b82f6', // Electric Blue
        '#f59e0b', // Sunset Amber
        '#ec4899', // Neon Pink
        '#06b6d4', // Cyan Teal
        '#6366f1'  // Indigo
    ];

    const BorderColors = [
        '#34d399',
        '#a78bfa',
        '#60a5fa',
        '#fbbf24',
        '#f472b6',
        '#22d3ee',
        '#818cf8'
    ];

    const barColors = sortedConsignees.map((_, idx) => VibrantColors[idx % VibrantColors.length]);
    const barBorders = sortedConsignees.map((_, idx) => BorderColors[idx % BorderColors.length]);

    const finalVolData = sortedConsignees.map(item => parseFloat(item[1].toFixed(2)));

    TopConsigneeChart = new Chart(consigneeChartElem, {
        type: 'bar',
        data: {
            labels: sortedConsignees.map(item => item[0]),
            datasets: [{
                label: 'Volume (m³)',
                data: sortedConsignees.map(() => 0), // Start from 0 to trigger growth animation
                backgroundColor: barColors,
                borderColor: barBorders,
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            maxBarThickness: 28,
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isLight ? '#ffffff' : '#09090b',
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#059669' : '#34d399',
                    borderColor: isLight ? '#cbd5e1' : '#27272a',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ' Volume: ' + context.parsed.x + ' m³ (Direct Delivery Eligible)';
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { color: gridColor }, 
                    ticks: { 
                        color: textColor,
                        callback: function(val) { return val + ' m³'; }
                    } 
                },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { weight: '600' } } }
            }
        }
    });

    // Trigger smooth bar growth animation extending from 0 to full volume
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            TopConsigneeChart.data.datasets[0].data = finalVolData;
            TopConsigneeChart.update();
        });
    });
}

