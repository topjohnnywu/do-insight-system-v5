// Chart Handles
let TopConsigneeChart = null;

const sunIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function updateThemeToggleButton(themeName) {
    const ToggleBtn = document.getElementById('themeToggleBtn');
    if (!ToggleBtn) return;
    const isLight = themeName === "light";
    // Sun icon in dark mode (click to go light), moon icon in light mode (click to go dark)
    const icon = isLight ? moonIconSvg : sunIconSvg;
    const label = isLight ? "Light" : "Dark";
    const nextLabel = isLight ? "Dark" : "Light";
    ToggleBtn.innerHTML = `${icon} <span>${label}</span>`;
    ToggleBtn.setAttribute("title", `Switch to ${nextLabel} theme`);
}

function getCurrentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    return (t === "light" || t === "dark") ? t : "dark";
}

function isLightTheme() {
    const t = getCurrentTheme();
    return t === "light";
}

function updateThemeMenu(themeName) {
    // Theme options are managed directly via toggleTheme and data-theme attribute
}

function applyChartTheme(themeName) {
    if (!window.Chart) return;
    if (themeName === "light") {
        Chart.defaults.color = '#334155';
        Chart.defaults.borderColor = '#cbd5e1';
    } else if (themeName === "dark") {
        Chart.defaults.color = '#a1a1aa';   /* zinc-400 */
        Chart.defaults.borderColor = '#262626'; /* zinc-800 hairline */
    } else {
        Chart.defaults.color = '#a1a1aa';
        Chart.defaults.borderColor = '#18181b';
    }
}

// Track active view transition to prevent overlapping animations
let isThemeTransitioning = false;

// Apply a theme to the whole app. Valid themes: dark (default), light.
function setTheme(themeName, persist, clickEvent) {
    const valid = ["dark", "light"];
    if (!valid.includes(themeName)) themeName = "dark";
    if (persist === undefined) persist = true;

    const changed = themeName !== getCurrentTheme();

    if (persist) {
        localStorage.setItem("AppThemeMode", themeName);
        activeTheme = themeName;
    }

    const applyThemeDOM = () => {
        document.documentElement.setAttribute("data-theme", themeName);
        document.body.classList.toggle('light-mode', themeName === "light");

        updateThemeToggleButton(themeName);
        updateThemeMenu(themeName);
        applyChartTheme(themeName);

        if (!changed) return;
        if (typeof refreshDashboard === 'function') refreshDashboard();
        if (typeof applyInsightFilter === 'function') applyInsightFilter();
        if (window.activityTrend && typeof window.activityTrend.renderUI === 'function') window.activityTrend.renderUI();
    };

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canAnimate = clickEvent && typeof document.startViewTransition === 'function' && !prefersReducedMotion && !isThemeTransitioning;

    if (!canAnimate) {
        applyThemeDOM();
        return;
    }

    // Determine coordinate origin from click or trigger element
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let cx = vw / 2;
    let cy = vh / 2;

    if (clickEvent) {
        if (typeof clickEvent.clientX === 'number' && typeof clickEvent.clientY === 'number' && (clickEvent.clientX !== 0 || clickEvent.clientY !== 0)) {
            cx = clickEvent.clientX;
            cy = clickEvent.clientY;
        } else if (clickEvent.currentTarget && typeof clickEvent.currentTarget.getBoundingClientRect === 'function') {
            const rect = clickEvent.currentTarget.getBoundingClientRect();
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
        }
    }

    // Radius to reach furthest viewport corner
    const maxRadius = Math.hypot(
        Math.max(cx, vw - cx),
        Math.max(cy, vh - cy)
    );

    const toX = (x) => `${(x / vw) * 100}%`;
    const toY = (y) => `${(y / vh) * 100}%`;
    const toRadius = (r) => `${(r / (Math.hypot(vw, vh) / Math.SQRT2)) * 100}%`;

    const clipPath = [
        `circle(0% at ${toX(cx)} ${toY(cy)})`,
        `circle(${toRadius(maxRadius)} at ${toX(cx)} ${toY(cy)})`
    ];

    const root = document.documentElement;
    root.dataset.themeVt = "active";
    root.style.setProperty("--theme-toggle-vt-duration", "420ms");
    isThemeTransitioning = true;

    const cleanup = () => {
        isThemeTransitioning = false;
        delete root.dataset.themeVt;
        root.style.removeProperty("--theme-toggle-vt-duration");
    };

    try {
        const transition = document.startViewTransition(() => {
            applyThemeDOM();
        });

        if (transition && typeof transition.finished?.finally === 'function') {
            transition.finished.finally(cleanup).catch(() => {});
        } else {
            setTimeout(cleanup, 450);
        }

        if (transition && transition.ready && typeof transition.ready.then === 'function') {
            transition.ready.then(() => {
                document.documentElement.animate(
                    { clipPath },
                    {
                        duration: 420,
                        easing: "ease-in-out",
                        fill: "forwards",
                        pseudoElement: "::view-transition-new(root)"
                    }
                );
            }).catch(() => {});
        }
    } catch (err) {
        cleanup();
        applyThemeDOM();
    }
}

// Initialize theme state on page boot
function initTheme() {
    const saved = localStorage.getItem("AppThemeMode");
    // dark is the default theme. Light stays. Any legacy/removed theme
    // (shadcn, linear, amoled, etc.) migrates to dark.
    let theme = "dark";
    if (saved === "light") theme = "light";
    else if (saved === "dark") theme = "dark";
    
    setTheme(theme, false);
    activeTheme = theme;
    initSpotlights();
}

// With only two themes (dark + light), the button toggles directly
// instead of opening the theme sidebar. Uses the click event (or window.event
// from inline onclick handlers) as the view-transition animation origin.
function toggleTheme(clickEvent) {
    const evt = clickEvent || (typeof window !== "undefined" ? window.event : null);
    const next = getCurrentTheme() === "light" ? "dark" : "light";
    setTheme(next, true, evt);
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
// Upgraded to shadcn grouped dual-bar design (Volume m³ vs DO Count)
function renderCharts() {
    const consigneeChartElem = document.getElementById('consigneeChart');
    if (!consigneeChartElem) return;

    const consigneeStats = {};
    let courtsOriginalKey = null;
    let courtsHasSrWhse = false;

    DataHoarderArray.forEach(item => {
        const consigneeKey = (item.name && item.name.trim() !== "") ? item.name.trim() : "UNASSIGNED";
        if (consigneeKey !== "UNASSIGNED") {
            const hasSgBros = /SG\s*BROS/i.test(item.remark || "");
            const hasSpx = /SPX/i.test(item.remark || "");
            // Rule: Exclude DOs with "SG BROS", "SGBROS", or "SPX" remark from direct delivery
            if (hasSgBros || hasSpx) {
                return;
            }

            const isCourts = consigneeKey.toUpperCase().includes("COURTS");
            const routeStr = (item.route && item.route.trim() !== "") ? item.route.trim().toUpperCase() : "";

            // Rule: For COURTS, Direct Delivery only applies if ROUTE is LEA
            if (isCourts && routeStr !== "LEA") {
                return;
            }

            if (!consigneeStats[consigneeKey]) {
                consigneeStats[consigneeKey] = { vol: 0, doCount: 0 };
            }
            consigneeStats[consigneeKey].vol += item.vol;
            consigneeStats[consigneeKey].doCount += 1;

            // Detect COURTS consignee + Tampines North SR/WHSE address (col F)
            if (isCourts) {
                courtsOriginalKey = consigneeKey;
                if ((item.addr || "").toUpperCase().includes("TAMPINES NORTH")) {
                    courtsHasSrWhse = true;
                }
            }
        }
    });

    // Relabel COURTS bar to flag SR/WHSE direct-delivery hub (merged total volume)
    if (courtsHasSrWhse && courtsOriginalKey && consigneeStats[courtsOriginalKey]) {
        consigneeStats["COURTS (SINGAPORE) PTE LTD (SR/WHSE)"] = consigneeStats[courtsOriginalKey];
        delete consigneeStats[courtsOriginalKey];
    }

    if (TopConsigneeChart) {
        TopConsigneeChart.destroy();
        TopConsigneeChart = null;
    }

    const sortedConsignees = Object.entries(consigneeStats)
        .filter(item => item[1].vol > 5)
        .sort((a, b) => b[1].vol - a[1].vol);

    const emptyElem = document.getElementById('consigneeChartEmpty');
    const emptyTitle = document.getElementById('consigneeEmptyTitle');
    const emptyDesc = document.getElementById('consigneeEmptyDesc');

    if (sortedConsignees.length === 0) {
        consigneeChartElem.style.display = 'none';
        if (emptyElem) {
            emptyElem.style.display = 'flex';
            if (emptyTitle && emptyDesc) {
                if (!Array.isArray(DataHoarderArray) || DataHoarderArray.length === 0) {
                    emptyTitle.textContent = "No Manifest Data Loaded";
                    emptyDesc.textContent = "Upload or select a Delivery Order manifest to view direct delivery candidates.";
                } else {
                    emptyTitle.textContent = "No Direct Delivery Candidates";
                    emptyDesc.textContent = "All consignees in this manifest have total volume \u2264 5.0 m\u00B3. Orders qualify for standard hub dispatch.";
                }
            }
        }
        return;
    }

    consigneeChartElem.style.display = 'block';
    if (emptyElem) {
        emptyElem.style.display = 'none';
    }

    const isLight = isLightTheme();
    const gridColor = isLight ? '#f4f4f5' : '#18181b';
    const textColor = isLight ? '#71717a' : '#a1a1aa';
    const tooltipBg = isLight ? '#ffffff' : '#09090b';
    const tooltipBorder = isLight ? '#e4e4e7' : '#27272a';
    const tooltipTitle = isLight ? '#09090b' : '#f4f4f5';
    const tooltipBody = isLight ? '#27272a' : '#d4d4d8';

    const COLOR_VOLUME = '#2563eb';  // shadcn primary royal blue
    const COLOR_DO_COUNT = '#60a5fa'; // shadcn secondary sky blue

    const fullLabels = sortedConsignees.map(item => item[0]);
    const finalVolData = sortedConsignees.map(item => parseFloat(item[1].vol.toFixed(2)));
    const finalDoData = sortedConsignees.map(item => item[1].doCount);

    TopConsigneeChart = new Chart(consigneeChartElem, {
        type: 'bar',
        data: {
            labels: fullLabels,
            datasets: [
                {
                    label: 'Volume (m³)',
                    data: finalVolData,
                    backgroundColor: COLOR_VOLUME,
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false,
                    barPercentage: 0.8,
                    categoryPercentage: 0.65,
                    yAxisID: 'y'
                },
                {
                    label: 'DO Count',
                    data: finalDoData,
                    backgroundColor: COLOR_DO_COUNT,
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false,
                    barPercentage: 0.8,
                    categoryPercentage: 0.65,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const elemIndex = elements[0].index;
                    const clickedLabel = fullLabels[elemIndex];
                    let searchName = clickedLabel;
                    if (searchName && searchName.includes("COURTS")) {
                        searchName = "COURTS";
                    }
                    if (typeof filterByConsigneeFromChart === 'function') {
                        filterByConsigneeFromChart(searchName);
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Using custom shadcn legend badges in card header
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        title: function(items) {
                            if (!items || !items.length) return '';
                            return fullLabels[items[0].dataIndex] || '';
                        },
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return ` Volume: ${context.parsed.y} m³`;
                            } else {
                                return ` DO Count: ${context.parsed.y} DO`;
                            }
                        },
                        afterBody: function() {
                            return '\n💡 Direct Delivery Eligible • Click to Filter Manifest';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 11, weight: '600' },
                        maxRotation: 30,
                        minRotation: 0,
                        callback: function(val, index) {
                            const name = fullLabels[index] || '';
                            if (name.length > 22) {
                                return name.substring(0, 20) + '...';
                            }
                            return name;
                        }
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: COLOR_VOLUME,
                        font: { size: 11, weight: '600' },
                        callback: function(val) { return val + ' m³'; }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        color: COLOR_DO_COUNT,
                        font: { size: 11, weight: '600' },
                        precision: 0,
                        callback: function(val) { return val + ' DO'; }
                    }
                }
            }
        }
    });
}


/* ==========================================================
   Shared Empty-state builder (shadcn "Empty" design)
   Returns the inner HTML for an .empty card. Wrap it in your table cell:
     tbody.innerHTML = `<tr><td colspan="N" style="padding:0;border:none;">${buildEmptyHTML({...})}</td></tr>`;
   opts: { icon, title, description, ctaLabel, ctaOnclick, ctaTip }
   - icon: "inbox" | "cloud" | "box" | "file" (defaults to inbox)
   - ctaLabel/ctaOnclick optional; omit for a static (no-button) empty state
   ========================================================== */
function buildEmptyHTML(opts) {
    opts = opts || {};
    const icons = {
        inbox: `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
        cloud: `<path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 19h10.5z"/>`,
        box: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
        file: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`
    };
    const iconPath = icons[opts.icon] || icons.inbox;
    const title = opts.title || "Nothing here yet";
    const description = opts.description || "";
    let cta = "";
    if (opts.ctaLabel && opts.ctaOnclick) {
        const tip = opts.ctaTip ? ` data-tip="${opts.ctaTip}"` : "";
        cta = `<div class="empty-content">
            <button type="button" class="action-btn outline" onclick="${opts.ctaOnclick}"${tip}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                ${opts.ctaLabel}
            </button>
        </div>`;
    }
    return `<div class="empty">
        <div class="empty-header">
            <div class="empty-media">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
            </div>
            <p class="empty-title">${title}</p>
            <p class="empty-description">${description}</p>
        </div>
        ${cta}
    </div>`;
}