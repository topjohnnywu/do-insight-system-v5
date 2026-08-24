(function() {
    // 0. Immediately apply saved theme to prevent FOUC (Flash of Unstyled Content)
    const savedThemeForBoot = localStorage.getItem("AppThemeMode") || "linear";
    let themeToSetForBoot = "linear";
    if (savedThemeForBoot === "light") themeToSetForBoot = "light";
    else if (savedThemeForBoot === "dark" || savedThemeForBoot === "amoled") themeToSetForBoot = "amoled";
    else if (savedThemeForBoot === "terminal") themeToSetForBoot = "terminal";
    else if (savedThemeForBoot === "organic") themeToSetForBoot = "organic";
    else if (savedThemeForBoot === "cyber") themeToSetForBoot = "cyber";
    else if (savedThemeForBoot === "bitcoin") themeToSetForBoot = "bitcoin";
    else if (savedThemeForBoot === "github") themeToSetForBoot = "github";

    document.documentElement.setAttribute("data-theme", themeToSetForBoot);
    
    // 0.1 Immediately apply saved sidebar auto-hide mode (Zero FOUC)
    const savedAutoHideForBoot = localStorage.getItem("sidebar_autohide") === "true";
    if (savedAutoHideForBoot) {
        document.documentElement.setAttribute("data-sidebar-autohide", "true");
    }
    
    const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
            if (themeToSetForBoot === "light") {
                document.body.classList.add("light-mode");
            }
            obs.disconnect();
        }
    });
    observer.observe(document.documentElement, { childList: true });

    // 1. Immediately apply saved settings to prevent flicker
    const savedFont = localStorage.getItem('universalFontFamily') || 'Inter, system-ui, sans-serif';
    const savedZoom = localStorage.getItem('universalZoom') || '1';
    
    // Inject Google Fonts
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500&family=Poppins:wght@400;500;600&family=Roboto:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Inject CSS variable override
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        :root {
            --app-font-family: ${savedFont};
            --app-zoom: ${savedZoom};
        }
        body, h1, h2, h3, h4, h5, h6, input, button, select, textarea, div, span, p, a, td, th {
            font-family: var(--app-font-family) !important;
        }
        body {
            zoom: var(--app-zoom);
        }
        
        /* Settings Modal Styles */
        #universalSettingsModal {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(2px);
        }
        #universalSettingsModal .usm-content {
            background: var(--surface, #18181b);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border, #27272a);
            width: 340px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            color: var(--fg, #e4e4e7);
        }
        #universalSettingsModal h3 {
            margin-top: 0; margin-bottom: 16px; font-size: 18px;
        }
        .usm-group {
            margin-bottom: 16px;
        }
        .usm-group label {
            display: block; margin-bottom: 6px; font-size: 12px; color: var(--fg-muted, #a1a1aa);
        }
        .usm-group select, .usm-group input[type="range"] {
            width: 100%;
            background: var(--bg-elevated, var(--surface-solid, #18181b));
            border: 1px solid var(--border, #27272a);
            color: var(--fg, white);
            padding: 8px;
            border-radius: 6px;
            outline: none;
        }
        .usm-buttons {
            display: flex; gap: 8px; margin-top: 24px;
        }
        .usm-btn {
            flex: 1; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; text-align: center; border: none;
        }
        .usm-save {
            background: #8b5cf6; color: white;
        }
        .usm-reset {
            background: transparent; color: #ef4444; border: 1px solid #ef4444;
        }
        .usm-close {
            background: transparent; color: var(--fg-muted, #a1a1aa); border: 1px solid var(--border, #27272a);
        }
    `;
    document.head.appendChild(styleEl);

    // 2. Build the UI on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
        // Build the Modal
        const modalHtml = `
            <div id="universalSettingsModal">
                <div class="usm-content" style="width: 360px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--fg, #ffffff);">⚙️ Display & Font Settings</h3>
                        <button type="button" id="usmHeaderCloseBtn" style="background: none; border: none; color: var(--fg-muted, #a1a1aa); font-size: 16px; cursor: pointer; padding: 4px;">✕</button>
                    </div>
                    <div class="usm-group">
                        <label>Font Style</label>
                        <select id="usmFontSelect">
                            <option value="Inter, system-ui, sans-serif">Google Font: Inter (Sleek/Modern)</option>
                            <option value="Roboto, system-ui, sans-serif">Google Font: Roboto (Clean/Android)</option>
                            <option value="'Montserrat', system-ui, sans-serif">Google Font: Montserrat (Geometric/Bold)</option>
                            <option value="'Open Sans', system-ui, sans-serif">Google Font: Open Sans (Friendly/Readable)</option>
                            <option value="'Poppins', system-ui, sans-serif">Google Font: Poppins (Round/Playful)</option>
                            <option value="'Lato', system-ui, sans-serif">Google Font: Lato (Warm/Elegant)</option>
                            <option value="'Oswald', system-ui, sans-serif">Google Font: Oswald (Tall/Impactful)</option>
                            <option value="'JetBrains Mono', monospace">Google Font: JetBrains Mono (Developer/Code)</option>
                            <option value="Arial, sans-serif">System Font: Arial (Classic)</option>
                            <option value="Verdana, sans-serif">System Font: Verdana (Wide)</option>
                        </select>
                    </div>
                    <div class="usm-group">
                        <label>App Scale (Zoom) <span id="usmZoomLabel">100%</span></label>
                        <input type="range" id="usmZoomSlider" min="0.7" max="1.5" step="0.05" value="1">
                    </div>
                    <div class="usm-group" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface-solid, #141418); border: 1px solid var(--border, #27272a); border-radius: 8px; margin-top: 14px;">
                        <div>
                            <div style="font-weight: 600; font-size: 13px; color: var(--fg, #ffffff);">Auto-Hide Sidebar Menu</div>
                            <div style="font-size: 11px; color: var(--fg-muted, #a1a1aa); margin-top: 2px;">Collapse sidebar into compact 60px rail globally</div>
                        </div>
                        <button type="button" 
                                id="usmAutoHideToggle" 
                                class="sidebar-autohide-toggle" 
                                role="switch" 
                                aria-checked="${localStorage.getItem('sidebar_autohide') === 'true' ? 'true' : 'false'}" 
                                aria-label="Toggle Auto-Hide Sidebar Menu">
                            <span class="switch-thumb"></span>
                        </button>
                    </div>
                    <div class="usm-buttons">
                        <button class="usm-btn usm-reset" id="usmResetBtn">Reset</button>
                        <button class="usm-btn usm-close" id="usmCloseBtn">Cancel</button>
                        <button class="usm-btn usm-save" id="usmSaveBtn">Save & Apply</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('universalSettingsModal');
        const fontSelect = document.getElementById('usmFontSelect');
        const zoomSlider = document.getElementById('usmZoomSlider');
        const zoomLabel = document.getElementById('usmZoomLabel');
        const usmAutoHideToggle = document.getElementById('usmAutoHideToggle');
        
        // Sync inputs with current settings
        fontSelect.value = localStorage.getItem('universalFontFamily') || 'Inter, system-ui, sans-serif';
        const currentZoom = localStorage.getItem('universalZoom') || '1';
        zoomSlider.value = currentZoom;
        zoomLabel.innerText = Math.round(currentZoom * 100) + '%';
        
        zoomSlider.addEventListener('input', (e) => {
            zoomLabel.innerText = Math.round(e.target.value * 100) + '%';
            // Live preview
            document.body.style.zoom = e.target.value;
        });
        
        fontSelect.addEventListener('change', (e) => {
            document.documentElement.style.setProperty('--app-font-family', e.target.value);
        });

        // Global set and sync function for Auto-Hide state
        window.setGlobalSidebarAutoHide = function(enable, showToastFeedback = true) {
            const nextState = !!enable;
            if (nextState) {
                document.documentElement.setAttribute('data-sidebar-autohide', 'true');
                localStorage.setItem('sidebar_autohide', 'true');
            } else {
                document.documentElement.removeAttribute('data-sidebar-autohide');
                localStorage.setItem('sidebar_autohide', 'false');
                document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('is-hovered'));
            }

            document.querySelectorAll('.sidebar-autohide-toggle').forEach(btn => {
                btn.setAttribute('aria-checked', nextState ? 'true' : 'false');
            });

            if (showToastFeedback && typeof window.showToast === 'function') {
                window.showToast(nextState ? '⚡ Auto-Hide Sidebar enabled globally (hover to expand)' : '📌 Sidebar pinned in place globally', 'info', 2200);
            }

            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 260);
        };

        if (usmAutoHideToggle) {
            usmAutoHideToggle.addEventListener('click', () => {
                const isCurrently = usmAutoHideToggle.getAttribute('aria-checked') === 'true';
                window.setGlobalSidebarAutoHide(!isCurrently, false);
            });
        }

        document.getElementById('usmSaveBtn').addEventListener('click', () => {
            localStorage.setItem('universalFontFamily', fontSelect.value);
            localStorage.setItem('universalZoom', zoomSlider.value);
            document.documentElement.style.setProperty('--app-font-family', fontSelect.value);
            document.documentElement.style.setProperty('--app-zoom', zoomSlider.value);
            modal.style.display = 'none';
        });

        const closeModalFunc = () => {
            // Revert preview
            const savedZ = localStorage.getItem('universalZoom') || '1';
            const savedF = localStorage.getItem('universalFontFamily') || 'Inter, system-ui, sans-serif';
            document.body.style.zoom = savedZ;
            document.documentElement.style.setProperty('--app-font-family', savedF);
            
            // Reset inputs
            zoomSlider.value = savedZ;
            zoomLabel.innerText = Math.round(savedZ * 100) + '%';
            fontSelect.value = savedF;
            
            modal.style.display = 'none';
        };

        document.getElementById('usmCloseBtn').addEventListener('click', closeModalFunc);
        const headerCloseBtn = document.getElementById('usmHeaderCloseBtn');
        if (headerCloseBtn) headerCloseBtn.addEventListener('click', closeModalFunc);

        document.getElementById('usmResetBtn').addEventListener('click', () => {
            localStorage.removeItem('universalFontFamily');
            localStorage.removeItem('universalZoom');
            const defaultF = 'Inter, system-ui, sans-serif';
            const defaultZ = '1';
            document.documentElement.style.setProperty('--app-font-family', defaultF);
            document.documentElement.style.setProperty('--app-zoom', defaultZ);
            document.body.style.zoom = defaultZ;
            
            zoomSlider.value = defaultZ;
            zoomLabel.innerText = '100%';
            fontSelect.value = defaultF;
            
            modal.style.display = 'none';
        });

        // Insert Button in Sidebar
        const sidebarNavs = document.querySelectorAll('.sidebar-nav');
        const settingsLi = document.createElement('li');
        settingsLi.innerHTML = `
            <a href="javascript:void(0)" class="sidebar-nav-item" onclick="document.getElementById('universalSettingsModal').style.display='flex'">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span>Display & Font Settings</span>
            </a>
        `;
        
        if (sidebarNavs.length > 0) {
            // Append to every sidebar-nav just in case there are multiple
            sidebarNavs.forEach(nav => nav.appendChild(settingsLi.cloneNode(true)));
        } else {
            // Fallback floating button if no sidebar
            const floatBtn = document.createElement('button');
            floatBtn.innerHTML = "⚙️ Settings";
            floatBtn.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9998; padding:10px 16px; border-radius:30px; background:#8b5cf6; color:white; border:none; cursor:pointer; font-weight:600; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
            floatBtn.onclick = () => document.getElementById('universalSettingsModal').style.display='flex';
            document.body.appendChild(floatBtn);
        }

        // ==========================================================
        // Sidebar Auto-Hide Spacer, Hover Debounce & Toggle Controller
        // ==========================================================
        const sidebars = document.querySelectorAll('.sidebar');
        const appContainers = document.querySelectorAll('.app-container');

        // Ensure spacer for fixed sidebar alignment
        appContainers.forEach(container => {
            if (!container.querySelector('.sidebar-spacer') && container.querySelector('.sidebar')) {
                const spacer = document.createElement('div');
                spacer.className = 'sidebar-spacer';
                container.insertBefore(spacer, container.querySelector('.sidebar'));
            }
        });

        // Setup hover debounce and autohide toggle widget for every sidebar instance
        sidebars.forEach(sidebar => {
            let hoverTimer = null;
            sidebar.addEventListener('mouseenter', () => {
                if (document.documentElement.getAttribute('data-sidebar-autohide') === 'true') {
                    clearTimeout(hoverTimer);
                    hoverTimer = setTimeout(() => {
                        sidebar.classList.add('is-hovered');
                    }, 80);
                }
            });

            sidebar.addEventListener('mouseleave', () => {
                if (document.documentElement.getAttribute('data-sidebar-autohide') === 'true') {
                    clearTimeout(hoverTimer);
                    hoverTimer = setTimeout(() => {
                        sidebar.classList.remove('is-hovered');
                    }, 220);
                }
            });

            // Create Auto-Hide Toggle Switch Widget
            const widgetDiv = document.createElement('div');
            widgetDiv.className = 'sidebar-autohide-widget';
            widgetDiv.title = 'Toggle Auto-Hide Sidebar to maximize workspace across all dashboard pages';
            widgetDiv.innerHTML = `
                <div class="sidebar-autohide-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="9" y1="3" x2="9" y2="21"/>
                        <path d="M14 9l3 3-3 3"/>
                    </svg>
                    <span class="autohide-label-text">Auto-Hide Menu</span>
                </div>
                <button type="button" 
                        class="sidebar-autohide-toggle" 
                        role="switch" 
                        aria-checked="${localStorage.getItem('sidebar_autohide') === 'true' ? 'true' : 'false'}" 
                        aria-label="Toggle Auto-Hide Sidebar Menu">
                    <span class="switch-thumb"></span>
                </button>
            `;

            // Insert widget before the bottom footer text or at the end
            const footerEl = sidebar.lastElementChild;
            if (footerEl) {
                sidebar.insertBefore(widgetDiv, footerEl);
            } else {
                sidebar.appendChild(widgetDiv);
            }

            const toggleBtn = widgetDiv.querySelector('.sidebar-autohide-toggle');
            const handleToggle = (e) => {
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                const isCurrentlyAuto = document.documentElement.getAttribute('data-sidebar-autohide') === 'true';
                window.setGlobalSidebarAutoHide(!isCurrentlyAuto, true);
            };

            toggleBtn.addEventListener('click', handleToggle);
            widgetDiv.addEventListener('click', (e) => {
                if (e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                    handleToggle(e);
                }
            });
            toggleBtn.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    handleToggle(e);
                }
            });
        });
    });

    // ==========================================================
    // Universal Hub Toast & Async Confirmation Modal System
    // ==========================================================
    window.showToast = function(message, type = "info", duration = 3500) {
        let container = document.getElementById("hubToastContainer") || document.getElementById("dsgToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "hubToastContainer";
            container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 100000; display: flex; flex-direction: column; gap: 8px; pointer-events: none;";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border, rgba(255,255,255,0.1));
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
            max-width: 420px;
            line-height: 1.45;
            backdrop-filter: blur(12px);
            background: var(--surface-card, var(--bg-elevated, #18181b));
            color: var(--fg, #ffffff);
            font-family: var(--app-font-family, inherit);
        `;

        let icon = "ℹ️";
        let borderColor = "var(--accent, #3b82f6)";

        if (type === "success") {
            icon = "✅";
            borderColor = "#10b981";
        } else if (type === "error") {
            icon = "❌";
            borderColor = "#ef4444";
        } else if (type === "warning") {
            icon = "⚠️";
            borderColor = "#f59e0b";
        }

        toast.style.border = `1px solid ${borderColor}`;
        toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span style="flex:1;">${String(message).replace(/\n/g, '<br>')}</span><span style="font-size: 12px; opacity: 0.6; padding: 2px;">✕</span>`;

        toast.onclick = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-12px) scale(0.96)";
            setTimeout(() => toast.remove(), 250);
        };

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0) scale(1)";
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = "0";
                toast.style.transform = "translateY(-12px) scale(0.96)";
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    };

    window.showConfirmDialog = function({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", isDanger = true, icon = "⚠️" } = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById("hubConfirmModal");
            if (!modal) {
                const modalHtml = `
                    <div id="hubConfirmModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); z-index: 100000; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: var(--surface-card, var(--bg-elevated, #18181b)); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border, rgba(255,255,255,0.1)); overflow: hidden; display: flex; flex-direction: column; font-family: var(--app-font-family, inherit);">
                            <div style="padding: 18px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; align-items: center; gap: 12px; background: var(--surface-hover, transparent);">
                                <div id="hubConfirmIconBadge" style="width: 38px; height: 38px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; border: 1px solid rgba(239, 68, 68, 0.25);">
                                    <span id="hubConfirmIcon">⚠️</span>
                                </div>
                                <div style="flex: 1;">
                                    <h3 id="hubConfirmTitle" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--fg, #ffffff);">Confirm Action</h3>
                                    <div style="font-size: 11px; color: var(--fg-muted, #94a3b8); margin-top: 2px;">Review details before proceeding</div>
                                </div>
                                <button type="button" id="hubConfirmCloseX" style="background: none; border: none; color: var(--fg-muted, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
                            </div>
                            <div style="padding: 20px 22px; font-size: 13px; color: var(--fg-subtle, var(--fg, #ffffff)); line-height: 1.6;" id="hubConfirmMessage">
                                Are you sure you want to proceed?
                            </div>
                            <div style="padding: 14px 22px; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-hover, transparent);">
                                <button type="button" id="hubConfirmCancelBtn" style="font-size: 12px; font-weight: 600; padding: 8px 18px; border-radius: 8px; background: var(--surface, transparent); color: var(--fg, #ffffff); border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;">Cancel</button>
                                <button type="button" id="hubConfirmOkBtn" style="font-size: 12px; font-weight: 700; padding: 8px 20px; border-radius: 8px; background: #ef4444; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">Confirm</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML("beforeend", modalHtml);
                modal = document.getElementById("hubConfirmModal");
            }

            const elTitle = document.getElementById("hubConfirmTitle");
            const elMsg = document.getElementById("hubConfirmMessage");
            const elIcon = document.getElementById("hubConfirmIcon");
            const iconBadge = document.getElementById("hubConfirmIconBadge");
            const btnOk = document.getElementById("hubConfirmOkBtn");
            const btnCancel = document.getElementById("hubConfirmCancelBtn");
            const btnX = document.getElementById("hubConfirmCloseX");

            if (elTitle) elTitle.innerText = title;
            if (elMsg) elMsg.innerHTML = message.replace(/\n/g, "<br>");
            if (elIcon) elIcon.innerText = icon;
            if (btnCancel) btnCancel.innerText = cancelText;

            if (iconBadge) {
                if (isDanger) {
                    iconBadge.style.background = "rgba(239, 68, 68, 0.12)";
                    iconBadge.style.borderColor = "rgba(239, 68, 68, 0.25)";
                } else {
                    iconBadge.style.background = "rgba(59, 130, 246, 0.12)";
                    iconBadge.style.borderColor = "rgba(59, 130, 246, 0.25)";
                }
            }
            
            if (btnOk) {
                btnOk.innerText = confirmText;
                btnOk.style.background = isDanger ? "#ef4444" : "var(--accent, #2563eb)";
                btnOk.style.boxShadow = isDanger ? "0 4px 12px rgba(239, 68, 68, 0.3)" : "0 4px 12px rgba(37, 99, 235, 0.3)";
            }

            modal.style.display = "flex";

            const cleanup = () => {
                modal.style.display = "none";
                btnOk.onclick = null;
                btnCancel.onclick = null;
                if (btnX) btnX.onclick = null;
                modal.onclick = null;
            };

            btnOk.onclick = () => {
                cleanup();
                resolve(true);
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(false);
            };

            if (btnX) {
                btnX.onclick = () => {
                    cleanup();
                    resolve(false);
                };
            }

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    };
    window.showPromptDialog = function({ title = "Input Required", message = "Please enter a value:", placeholder = "", defaultValue = "", confirmText = "Submit", cancelText = "Cancel", icon = "✏️" } = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById("hubPromptModal");
            if (!modal) {
                const modalHtml = `
                    <div id="hubPromptModal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); z-index: 100000; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: var(--surface-card, var(--bg-elevated, #18181b)); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border, rgba(255,255,255,0.1)); overflow: hidden; display: flex; flex-direction: column; font-family: var(--app-font-family, inherit);">
                            <div style="padding: 18px 22px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; align-items: center; gap: 12px; background: var(--surface-hover, transparent);">
                                <div id="hubPromptIconBadge" style="width: 38px; height: 38px; border-radius: 10px; background: rgba(59, 130, 246, 0.12); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.25);">
                                    <span id="hubPromptIcon">✏️</span>
                                </div>
                                <div style="flex: 1;">
                                    <h3 id="hubPromptTitle" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--fg, #ffffff);">Input Required</h3>
                                </div>
                                <button type="button" id="hubPromptCloseX" style="background: none; border: none; color: var(--fg-muted, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
                            </div>
                            <div style="padding: 20px 22px; font-size: 13px; color: var(--fg-subtle, var(--fg, #ffffff)); line-height: 1.6;">
                                <div id="hubPromptMessage" style="margin-bottom: 12px;">Please enter a value:</div>
                                <input type="text" id="hubPromptInput" style="width: 100%; padding: 10px 14px; background: var(--bg, #09090b); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 8px; color: var(--fg, #ffffff); font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s;" />
                            </div>
                            <div style="padding: 14px 22px; border-top: 1px solid var(--border, rgba(255,255,255,0.1)); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-hover, transparent);">
                                <button type="button" id="hubPromptCancelBtn" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; border: 1px solid var(--border, rgba(255,255,255,0.1)); color: var(--fg, #ffffff); transition: background 0.2s;">Cancel</button>
                                <button type="button" id="hubPromptOkBtn" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #3b82f6; color: #ffffff; transition: opacity 0.2s;">Submit</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                modal = document.getElementById("hubPromptModal");
                
                const style = document.createElement("style");
                style.innerHTML = `
                    #hubPromptCancelBtn:hover { background: var(--surface-active, rgba(255,255,255,0.05)) !important; }
                    #hubPromptOkBtn:hover { opacity: 0.9; }
                    #hubPromptInput:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important; }
                `;
                document.head.appendChild(style);
            }

            document.getElementById("hubPromptTitle").innerText = title;
            document.getElementById("hubPromptMessage").innerHTML = message.replace(/\n/g, '<br>');
            document.getElementById("hubPromptIcon").innerText = icon;
            document.getElementById("hubPromptCancelBtn").innerText = cancelText;
            document.getElementById("hubPromptOkBtn").innerText = confirmText;
            
            const inputField = document.getElementById("hubPromptInput");
            inputField.placeholder = placeholder;
            inputField.value = defaultValue;

            modal.style.display = "flex";
            modal.style.opacity = "0";
            modal.style.transform = "scale(0.98)";
            modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            
            requestAnimationFrame(() => {
                modal.style.opacity = "1";
                modal.style.transform = "scale(1)";
                inputField.focus();
            });

            const btnOk = document.getElementById("hubPromptOkBtn");
            const btnCancel = document.getElementById("hubPromptCancelBtn");
            const btnX = document.getElementById("hubPromptCloseX");

            const cleanup = () => {
                modal.style.opacity = "0";
                modal.style.transform = "scale(0.98)";
                setTimeout(() => {
                    modal.style.display = "none";
                }, 200);
            };

            const submitValue = () => {
                cleanup();
                resolve(inputField.value);
            };

            btnOk.onclick = submitValue;
            
            inputField.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitValue();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    cleanup();
                    resolve(null);
                }
            };

            btnCancel.onclick = () => {
                cleanup();
                resolve(null);
            };

            if (btnX) {
                btnX.onclick = () => {
                    cleanup();
                    resolve(null);
                };
            }

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            };
        });
    };
})();
