/*
   Date Picker — shadcn / Base UI style, dependency-free (no React, no npm, no date-fns)

   A popover "Pick a date" trigger that opens a single-month calendar grid,
   mirroring the DatePickerSimple reference: a Button + Popover + Calendar
   (mode="single"). Value is stored as an ISO "YYYY-MM-DD" string, exactly like
   a native <input type="date">, so it can drop in as a replacement.

   Enhances any element carrying [data-date-picker]. Two ways to use it:

   1) Progressive enhancement of a hidden native input (keeps existing JS that
      reads/writes `input.value` working unchanged):
        <input type="date" id="headerDatePicker" data-date-picker
               data-placeholder="Pick a date" onchange="app.onDate(this.value)">
      The original input becomes type="hidden"; the picker mirrors the value
      into it and fires "input" + "change" on every selection.

   2) Pure JS:
        const dp = new UIDatePicker(container, { value: "2026-10-03", onChange: (iso) => {} });

   Theming: inherits the app's [data-theme] design tokens (dark / light).
   */
(function () {
    "use strict";

    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const CAL_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
    const CHEV_L = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    const CHEV_R = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    // ---- date helpers (local-time, no UTC shifting) ----
    function parseISO(str) {
        if (!str || typeof str !== "string") return null;
        const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const y = +m[1], mo = +m[2] - 1, d = +m[3];
        const dt = new Date(y, mo, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
        return dt;
    }
    function toISO(d) {
        if (!(d instanceof Date) || isNaN(d)) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }
    function sameDay(a, b) {
        return !!a && !!b &&
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }
    // Format like date-fns "PPP": e.g. "October 3rd, 2026"
    function ordinal(n) {
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function formatLong(d) {
        if (!(d instanceof Date) || isNaN(d)) return "";
        return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
    }

    let openInstance = null; // only one popover open at a time

    class UIDatePicker {
        /**
         * @param {HTMLElement} host  an <input> to enhance, or a container <div>
         * @param {object} opts  { value, placeholder, onChange, align }
         */
        constructor(host, opts = {}) {
            if (!host) throw new Error("UIDatePicker: host element required");
            this.opts = opts;
            this.isInputEnhancement = host.tagName === "INPUT";
            this.input = this.isInputEnhancement ? host : null;

            const initial = opts.value !== undefined
                ? opts.value
                : (this.isInputEnhancement ? host.value : "");
            this.valueDate = parseISO(initial);
            this.placeholder = opts.placeholder || host.getAttribute("data-placeholder") || "Pick a date";
            this.align = opts.align || host.getAttribute("data-align") || "start";

            // view month = selected date's month, else today
            const base = this.valueDate || new Date();
            this.viewYear = base.getFullYear();
            this.viewMonth = base.getMonth();

            this._build(host);
            this._bind();
            this._renderTrigger();
        }

        _build(host) {
            // Root wrapper
            this.root = document.createElement("div");
            this.root.className = "ui-date-picker";
            if (this.opts.className) this.root.className += " " + this.opts.className;

            // Trigger button (the "Pick a date" outline button)
            this.trigger = document.createElement("button");
            this.trigger.type = "button";
            this.trigger.className = "ui-date-picker-trigger";
            this.trigger.setAttribute("aria-haspopup", "dialog");
            this.trigger.setAttribute("aria-expanded", "false");
            if (host.id) this.trigger.id = host.id + "__trigger";

            // Popover (calendar panel)
            this.popover = document.createElement("div");
            this.popover.className = "ui-date-picker-popover";
            this.popover.setAttribute("role", "dialog");
            this.popover.setAttribute("aria-label", "Choose date");
            this.popover.hidden = true;

            this.root.appendChild(this.trigger);
            this.root.appendChild(this.popover);

            // Swap the host in the DOM
            if (this.isInputEnhancement) {
                // Keep the original input in the form but hide it; it remains the
                // source of truth for `.value` that legacy code reads/writes.
                this.input.type = "hidden";
                this.input.removeAttribute("data-date-picker");
                this.input.classList.add("ui-date-picker-hidden-input");
                host.parentNode.insertBefore(this.root, host);
                this.root.appendChild(host); // keep input inside the component
            } else {
                host.appendChild(this.root);
            }
        }

        _bind() {
            this._onTriggerClick = (e) => {
                e.stopPropagation();
                this.toggle();
            };
            this._onDocClick = (e) => {
                if (!this.root.contains(e.target)) this.close();
            };
            this._onKey = (e) => {
                if (e.key === "Escape") { this.close(); this.trigger.focus(); }
            };
            this._onInputExternal = () => {
                // Legacy code wrote input.value directly -> reflect it.
                const d = parseISO(this.input.value);
                this.setValue(d, { silent: true });
            };

            this.trigger.addEventListener("click", this._onTriggerClick);
            document.addEventListener("click", this._onDocClick);
            document.addEventListener("keydown", this._onKey);

            if (this.isInputEnhancement) {
                const self = this;
                const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
                Object.defineProperty(this.input, "value", {
                    configurable: true,
                    get() { return desc.get.call(this); },
                    set(v) {
                        desc.set.call(this, v);
                        // reflect programmatic writes (e.g. picker.value = "2026-10-03")
                        if (self._settingFromPicker) return;
                        self.setValue(parseISO(v), { silent: true });
                    }
                });
            }
        }

        // ---- public API ----
        get value() { return toISO(this.valueDate); }
        get date() { return this.valueDate; }

        setValue(dateOrISO, { silent = false, fireNative = false } = {}) {
            const d = (dateOrISO instanceof Date) ? dateOrISO : parseISO(dateOrISO);
            const changed = !sameDay(d, this.valueDate);
            this.valueDate = d;
            if (d) { this.viewYear = d.getFullYear(); this.viewMonth = d.getMonth(); }
            this._renderTrigger();
            if (!this.popover.hidden) this._renderCalendar();

            if (this.isInputEnhancement) {
                const iso = toISO(d);
                this._settingFromPicker = true;
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
                    .set.call(this.input, iso);
                this._settingFromPicker = false;
                if (fireNative) {
                    this.input.dispatchEvent(new Event("input", { bubbles: true }));
                    this.input.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }
            if (!silent && typeof this.opts.onChange === "function") {
                this.opts.onChange(toISO(d), d);
            }
        }

        toggle() { this.popover.hidden ? this.open() : this.close(); }

        open() {
            if (openInstance && openInstance !== this) openInstance.close();
            openInstance = this;
            // sync view month to current selection on open
            const base = this.valueDate || new Date();
            this.viewYear = base.getFullYear();
            this.viewMonth = base.getMonth();
            this._renderCalendar();
            this.popover.hidden = false;
            this.trigger.setAttribute("aria-expanded", "true");
            this.popover.dataset.align = this.align;
            this._position();
        }

        close() {
            if (this.popover.hidden) return;
            this.popover.hidden = true;
            this.trigger.setAttribute("aria-expanded", "false");
            if (openInstance === this) openInstance = null;
        }

        _position() {
            // keep popover within the viewport horizontally
            this.popover.style.visibility = "hidden";
            this.popover.style.display = "block";
            const rect = this.popover.getBoundingClientRect();
            const vw = window.innerWidth;
            let offset = 0;
            if (rect.right > vw - 8) offset = (vw - 8) - rect.right;
            if (rect.left + offset < 8) offset = 8 - rect.left;
            this.popover.style.setProperty("--dp-shift", offset + "px");
            this.popover.style.visibility = "";
            this.popover.style.display = "";
        }

        _renderTrigger() {
            const has = !!this.valueDate;
            this.trigger.innerHTML =
                `${CAL_ICON}<span class="ui-date-picker-label${has ? "" : " is-placeholder"}">` +
                (has ? formatLong(this.valueDate) : this.placeholder) +
                `</span>`;
            this.trigger.classList.toggle("has-value", has);
        }

        _renderCalendar() {
            const today = new Date();
            const first = new Date(this.viewYear, this.viewMonth, 1);
            const startWeekday = first.getDay(); // 0 = Sunday
            const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
            const daysInPrev = new Date(this.viewYear, this.viewMonth, 0).getDate();

            let cells = "";

            // leading days from previous month (greyed, outside current month)
            for (let i = startWeekday - 1; i >= 0; i--) {
                const dayNum = daysInPrev - i;
                cells += `<button type="button" class="ui-dp-day is-outside" data-delta-month="-1" data-day="${dayNum}" tabindex="-1">${dayNum}</button>`;
            }
            // current month days
            for (let d = 1; d <= daysInMonth; d++) {
                const thisDate = new Date(this.viewYear, this.viewMonth, d);
                const isToday = sameDay(thisDate, today);
                const isSel = sameDay(thisDate, this.valueDate);
                cells += `<button type="button" class="ui-dp-day${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}" data-day="${d}"` +
                    `${isSel ? ' aria-pressed="true"' : ""}>${d}</button>`;
            }
            // trailing days to fill the last row
            const totalCells = startWeekday + daysInMonth;
            const trailing = (7 - (totalCells % 7)) % 7;
            for (let d = 1; d <= trailing; d++) {
                cells += `<button type="button" class="ui-dp-day is-outside" data-delta-month="1" data-day="${d}" tabindex="-1">${d}</button>`;
            }

            this.popover.innerHTML =
                `<div class="ui-dp-header">` +
                    `<button type="button" class="ui-dp-nav" data-nav="prev" aria-label="Previous month">${CHEV_L}</button>` +
                    `<div class="ui-dp-caption" aria-live="polite">${MONTHS[this.viewMonth]} ${this.viewYear}</div>` +
                    `<button type="button" class="ui-dp-nav" data-nav="next" aria-label="Next month">${CHEV_R}</button>` +
                `</div>` +
                `<div class="ui-dp-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join("")}</div>` +
                `<div class="ui-dp-grid">${cells}</div>`;

            // wire events
            this.popover.querySelector('[data-nav="prev"]').addEventListener("click", () => this._shiftMonth(-1));
            this.popover.querySelector('[data-nav="next"]').addEventListener("click", () => this._shiftMonth(1));
            this.popover.querySelectorAll(".ui-dp-day").forEach(btn => {
                btn.addEventListener("click", () => {
                    const delta = parseInt(btn.getAttribute("data-delta-month") || "0", 10);
                    const day = parseInt(btn.getAttribute("data-day"), 10);
                    let y = this.viewYear, m = this.viewMonth + delta;
                    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
                    const chosen = new Date(y, m, day);
                    this.setValue(chosen, { silent: false, fireNative: true });
                    this.close();
                    this.trigger.focus();
                });
            });
        }

        _shiftMonth(delta) {
            let m = this.viewMonth + delta, y = this.viewYear;
            if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
            this.viewMonth = m; this.viewYear = y;
            this._renderCalendar();
        }

        destroy() {
            this.trigger.removeEventListener("click", this._onTriggerClick);
            document.removeEventListener("click", this._onDocClick);
            document.removeEventListener("keydown", this._onKey);
            if (this.isInputEnhancement) {
                this.input.removeEventListener("input", this._onInputExternal);
                this.root.parentNode && this.root.parentNode.insertBefore(this.input, this.root);
                this.input.type = "date";
                this.input.classList.remove("ui-date-picker-hidden-input");
            }
            this.root.remove();
        }
    }

    // Auto-enhance all [data-date-picker] elements
    function init(root = document) {
        const found = root.querySelectorAll("[data-date-picker]");
        found.forEach(el => {
            if (el.__uiDatePicker) return;
            el.__uiDatePicker = new UIDatePicker(el, {
                onChange: (iso) => {
                    // fire the host's original inline handler if present
                    if (typeof el.onchange === "function") el.onchange.call(el, iso);
                }
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init());
    } else {
        init();
    }

    window.UIDatePicker = UIDatePicker;
    window.initUIDatePickers = init;
})();
