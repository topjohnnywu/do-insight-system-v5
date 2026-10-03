(function() {
    // 0. Immediately apply saved theme to prevent FOUC (Flash of Unstyled Content)
    // dark is the default theme; Light stays. Legacy themes (shadcn, linear,
    // amoled) migrate to dark.
    const savedThemeForBoot = localStorage.getItem("AppThemeMode") || "dark";
    let themeToSetForBoot = "dark";
    if (savedThemeForBoot === "light") themeToSetForBoot = "light";
    else if (savedThemeForBoot === "dark") themeToSetForBoot = "dark";

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
    const savedFont = localStorage.getItem('universalFontFamily') || "'Optimistic', -apple-system, BlinkMacSystemFont, sans-serif";
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
            font-family: var(--app-font-family);
        }
        code, pre, .tabular-nums, .btn-manifest-do, .manifest-route-tag, .manifest-hub-chip, [data-mono="true"] {
            font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace !important;
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
                            <option value="'Optimistic', -apple-system, BlinkMacSystemFont, sans-serif">Optimistic (Muse AI / Meta / Modern)</option>
                            <option value="'Netflix Sans', sans-serif">Netflix Sans (Modern / Cinematic)</option>
                            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica Neue (Swiss / Clean)</option>
                            <option value="'YouTube Sans', sans-serif">YouTube Sans (Modern / Geometric)</option>
                            <option value="'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif">Apple: SF Pro Text (Native / Sleek)</option>
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
        fontSelect.value = localStorage.getItem('universalFontFamily') || "'Optimistic', -apple-system, BlinkMacSystemFont, sans-serif";
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

        // Shadcn Sidebar Keyboard Shortcut: Cmd+B (Mac) / Ctrl+B (Windows)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.target.matches('input, textarea, select, [contenteditable="true"]')) {
                e.preventDefault();
                const isCurrently = document.documentElement.getAttribute('data-sidebar-autohide') === 'true';
                window.setGlobalSidebarAutoHide(!isCurrently, true);
            }
        });

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

        // Insert Button in Sidebar Footer (Only Once Per Sidebar)
        const sidebars = document.querySelectorAll('.sidebar');
        if (sidebars.length > 0) {
            sidebars.forEach(sidebar => {
                if (sidebar.querySelector('.sidebar-footer-settings')) return;
                const settingsWrapper = document.createElement('div');
                settingsWrapper.className = 'sidebar-footer-settings';
                settingsWrapper.style.cssText = 'padding: 4px 0 2px 0; border-top: 1px solid var(--border); margin-top: auto;';
                settingsWrapper.innerHTML = `
                    <a href="javascript:void(0)" class="sidebar-nav-item" data-title="Display & Font Settings" onclick="document.getElementById('universalSettingsModal').style.display='flex'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        <span>Display & Font Settings</span>
                    </a>
                `;
                const footerEl = sidebar.lastElementChild;
                if (footerEl) {
                    sidebar.insertBefore(settingsWrapper, footerEl);
                } else {
                    sidebar.appendChild(settingsWrapper);
                }
            });
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
    // Clean Sonner-style toast (no type icon, no emoji). Title + description on
    // the left, optional action + close on the right.
    // Backward-compatible signature: showToast(message, type, duration)
    //   type: "info" | "success" | "error" | "warning" | "loading"
    // Rich form: showToast({ title, description, type, duration, action })
    const TOAST_TYPES = ["info", "success", "error", "warning", "loading"];
    const TOAST_CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    function _toastViewport() {
        let vp = document.getElementById("uiToastViewport");
        if (!vp) {
            vp = document.createElement("div");
            vp.id = "uiToastViewport";
            vp.className = "ui-toast-viewport";
            document.body.appendChild(vp);
        }
        return vp;
    }

    // Keep z-order sane (newest on top). Layout/stacking is handled by the
    // viewport's column-reverse flex; no manual transforms needed.
    function _restackToasts() {
        const vp = document.getElementById("uiToastViewport");
        if (!vp) return;
        const toasts = Array.from(vp.querySelectorAll(".ui-toast:not(.ui-toast-leaving)"));
        const n = toasts.length;
        toasts.forEach((t, i) => { t.style.zIndex = 1000 + i; });
    }

    window.showToast = function(message, type = "info", duration = 3500) {
        // Support rich object form: showToast({ title, description, type, duration, action })
        let title, description, action;
        if (message && typeof message === "object") {
            ({ title, description, type = "info", duration = 3500, action } = message);
        } else {
            title = message;
        }
        if (!TOAST_TYPES.includes(type)) type = "info";

        const viewport = _toastViewport();

        const toast = document.createElement("div");
        toast.className = "ui-toast";
        toast.dataset.type = type;
        toast.setAttribute("role", "status");
        toast.tabIndex = 0;

        // Clean Sonner layout: NO type icon. Title + description on the left,
        // optional action + close on the right (vertically centered).
        const body = document.createElement("div");
        body.className = "ui-toast-body";
        if (title) {
            const t = document.createElement("div");
            t.className = "ui-toast-title";
            t.innerHTML = String(title).replace(/\n/g, "<br>");
            body.appendChild(t);
        }
        if (description) {
            const d = document.createElement("div");
            d.className = "ui-toast-description";
            d.innerHTML = String(description).replace(/\n/g, "<br>");
            body.appendChild(d);
        }

        toast.appendChild(body);

        if (action && action.label && typeof action.onClick === "function") {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ui-toast-action";
            btn.textContent = action.label;
            btn.onclick = (e) => { e.stopPropagation(); action.onClick(); dismiss(); };
            toast.appendChild(btn);
        }

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "ui-toast-close";
        closeBtn.setAttribute("aria-label", "Close toast");
        closeBtn.innerHTML = TOAST_CLOSE_ICON;
        closeBtn.onclick = (e) => { e.stopPropagation(); dismiss(); };
        toast.appendChild(closeBtn);

        let removed = false;
        function dismiss() {
            if (removed) return;
            removed = true;
            toast.classList.remove("ui-toast-open");
            toast.classList.add("ui-toast-leaving");
            setTimeout(() => { if (toast.parentElement) toast.remove(); _restackToasts(); }, 400);
        }

        // Newest toast goes on top (append, then restack so it becomes frontmost)
        viewport.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.add("ui-toast-open");
            _restackToasts();
        });

        if (duration && duration > 0) setTimeout(dismiss, duration);
        return { dismiss };
    };

    window.showConfirmDialog = function({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", isDanger = true } = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById("hubConfirmModal");
            if (!modal) {
                const modalHtml = `
                    <div id="hubConfirmModal" class="alert-dialog-overlay" style="display: none; z-index: 100000;">
                        <div class="alert-dialog-content" role="alertdialog" aria-modal="true" aria-labelledby="hubConfirmTitle" aria-describedby="hubConfirmMessage">
                            <div class="alert-dialog-header">
                                <h3 id="hubConfirmTitle" class="alert-dialog-title">Confirm Action</h3>
                                <div id="hubConfirmMessage" class="alert-dialog-description">Are you sure you want to proceed?</div>
                            </div>
                            <div class="alert-dialog-footer">
                                <button type="button" id="hubConfirmCancelBtn" class="alert-dialog-cancel">Cancel</button>
                                <button type="button" id="hubConfirmOkBtn" class="alert-dialog-action action-destructive">Confirm</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML("beforeend", modalHtml);
                modal = document.getElementById("hubConfirmModal");
            }

            const elTitle = document.getElementById("hubConfirmTitle");
            const elMsg = document.getElementById("hubConfirmMessage");
            const btnOk = document.getElementById("hubConfirmOkBtn");
            const btnCancel = document.getElementById("hubConfirmCancelBtn");

            if (elTitle) elTitle.innerText = title;
            if (elMsg) elMsg.innerHTML = message.replace(/\n/g, "<br>");
            if (btnCancel) btnCancel.innerText = cancelText;

            if (btnOk) {
                btnOk.innerText = confirmText;
                btnOk.className = "alert-dialog-action " + (isDanger ? "action-destructive" : "action-primary");
            }

            modal.style.display = "flex";

            const onKeyDown = (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    cleanup();
                    resolve(false);
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    cleanup();
                    resolve(true);
                }
            };
            window.addEventListener("keydown", onKeyDown);

            const cleanup = () => {
                modal.style.display = "none";
                window.removeEventListener("keydown", onKeyDown);
                if (btnOk) btnOk.onclick = null;
                if (btnCancel) btnCancel.onclick = null;
                modal.onclick = null;
            };

            if (btnOk) {
                btnOk.onclick = () => {
                    cleanup();
                    resolve(true);
                };
            }

            if (btnCancel) {
                btnCancel.onclick = () => {
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

    window.showPromptDialog = function({ title = "Input Required", message = "Please enter a value:", placeholder = "", defaultValue = "", confirmText = "Submit", cancelText = "Cancel" } = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById("hubPromptModal");
            if (!modal) {
                const modalHtml = `
                    <div id="hubPromptModal" class="alert-dialog-overlay" style="display: none; z-index: 100000;">
                        <div class="alert-dialog-content" role="dialog" aria-modal="true" aria-labelledby="hubPromptTitle" aria-describedby="hubPromptMessage">
                            <div class="alert-dialog-header">
                                <h3 id="hubPromptTitle" class="alert-dialog-title">Input Required</h3>
                                <div id="hubPromptMessage" class="alert-dialog-description">Please enter a value:</div>
                            </div>
                            <div style="margin: 4px 0 8px;">
                                <input type="text" id="hubPromptInput" class="dsg-input" style="width: 100%; box-sizing: border-box; font-size: 13px; padding: 9px 12px;" />
                            </div>
                            <div class="alert-dialog-footer">
                                <button type="button" id="hubPromptCancelBtn" class="alert-dialog-cancel">Cancel</button>
                                <button type="button" id="hubPromptOkBtn" class="alert-dialog-action action-primary">Submit</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML("beforeend", modalHtml);
                modal = document.getElementById("hubPromptModal");
            }

            const elTitle = document.getElementById("hubPromptTitle");
            const elMsg = document.getElementById("hubPromptMessage");
            const elCancel = document.getElementById("hubPromptCancelBtn");
            const elOk = document.getElementById("hubPromptOkBtn");
            const inputField = document.getElementById("hubPromptInput");

            if (elTitle) elTitle.innerText = title;
            if (elMsg) elMsg.innerHTML = message.replace(/\n/g, "<br>");
            if (elCancel) elCancel.innerText = cancelText;
            if (elOk) elOk.innerText = confirmText;
            
            if (inputField) {
                inputField.placeholder = placeholder;
                inputField.value = defaultValue;
            }

            modal.style.display = "flex";
            
            requestAnimationFrame(() => {
                if (inputField) {
                    inputField.focus();
                    inputField.select();
                }
            });

            const cleanup = () => {
                modal.style.display = "none";
                window.removeEventListener("keydown", onKeyDown);
                if (elOk) elOk.onclick = null;
                if (elCancel) elCancel.onclick = null;
                modal.onclick = null;
            };

            const submitValue = () => {
                const val = inputField ? inputField.value : "";
                cleanup();
                resolve(val);
            };

            const cancelDialog = () => {
                cleanup();
                resolve(null);
            };

            if (elOk) elOk.onclick = submitValue;
            if (elCancel) elCancel.onclick = cancelDialog;

            const onKeyDown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitValue();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelDialog();
                }
            };
            window.addEventListener("keydown", onKeyDown);

            modal.onclick = (e) => {
                if (e.target === modal) {
                    cancelDialog();
                }
            };
        });
    };
})();
