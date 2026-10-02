/* ==========================================================================
   UI Select — Base UI / shadcn design, dependency-free (no React, no npm)
   --------------------------------------------------------------------------
   Enhances a native <select> into an accessible, theme-aware dropdown that
   matches the @base-ui/react Select look. The original <select> stays in the
   DOM (visually hidden) and its value + change events stay in sync, so all
   existing onchange handlers and form logic keep working untouched.

   Usage:
     import { enhanceSelects, UISelect } from './components/ui-select.js';
     enhanceSelects(document);            // upgrade every <select> in scope
     // or
     const s = new UISelect(selectEl);    // upgrade one
   ========================================================================== */

const SVG_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const SVG_CHEVRON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

let _uid = 0;
const _openInstances = new Set();

export class UISelect {
    constructor(select, options = {}) {
        if (!select || select.tagName !== 'SELECT') {
            throw new Error('UISelect requires a native <select> element');
        }
        if (select._uiSelect) return select._uiSelect; // idempotent

        this.select = select;
        this.options = options;
        this.id = `ui-select-${++_uid}`;
        this.isOpen = false;
        this.highlightedIndex = -1;

        this._build();
        this._bind();
        this.syncFromNative();

        select._uiSelect = this;
    }

    /* ---------- DOM construction ---------- */
    _build() {
        const s = this.select;

        // Trigger button (replaces the visible native control)
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'ui-select-trigger';
        this.trigger.id = this.id;
        this.trigger.setAttribute('aria-haspopup', 'listbox');
        this.trigger.setAttribute('aria-expanded', 'false');
        if (s.dataset.size) this.trigger.dataset.size = s.dataset.size;
        if (s.disabled) this.trigger.setAttribute('aria-disabled', 'true');

        this.valueEl = document.createElement('span');
        this.valueEl.className = 'ui-select-value';
        this.trigger.appendChild(this.valueEl);

        this.iconEl = document.createElement('span');
        this.iconEl.className = 'ui-select-icon';
        this.iconEl.innerHTML = SVG_CHEVRON_DOWN;
        this.trigger.appendChild(this.iconEl);

        // Visually hide the native select but keep it focusable-in-DOM & in sync
        s.classList.add('ui-select-native');
        s.style.position = 'absolute';
        s.style.opacity = '0';
        s.style.pointerEvents = 'none';
        s.style.width = '1px';
        s.style.height = '1px';
        s.style.margin = '0';
        s.tabIndex = -1;
        s.setAttribute('aria-hidden', 'true');

        // Insert trigger right after the native select
        s.parentNode.insertBefore(this.trigger, s.nextSibling);

        // Content (popover) — created lazily on open so it can portal to <body>
        this.content = null;
    }

    _buildContent() {
        const list = document.createElement('div');
        list.className = 'ui-select-content';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-labelledby', this.id);
        list.dataset.side = 'bottom';

        const opts = Array.from(this.select.options);
        this.items = opts.map((opt, i) => {
            const item = document.createElement('div');
            item.className = 'ui-select-item';
            item.setAttribute('role', 'option');
            item.dataset.index = i;
            item.dataset.value = opt.value;
            if (opt.disabled) item.dataset.disabled = '';

            const text = document.createElement('span');
            text.className = 'ui-select-item-text';
            text.textContent = opt.textContent;
            item.appendChild(text);

            const indicator = document.createElement('span');
            indicator.className = 'ui-select-item-indicator';
            indicator.innerHTML = SVG_CHECK;
            item.appendChild(indicator);

            list.appendChild(item);
            return item;
        });

        this.content = list;
        return list;
    }

    /* ---------- Event wiring ---------- */
    _bind() {
        this.trigger.addEventListener('click', () => this.toggle());
        this.trigger.addEventListener('keydown', (e) => this._onTriggerKeydown(e));

        // Keep in sync if something else changes the native value
        this.select.addEventListener('change', () => this.syncFromNative());

        // Close on outside pointer down
        this._onDocPointerDown = (e) => {
            if (!this.isOpen) return;
            if (this.trigger.contains(e.target)) return;
            if (this.content && this.content.contains(e.target)) return;
            this.close();
        };
        document.addEventListener('pointerdown', this._onDocPointerDown, true);

        // Reposition / close on scroll & resize
        this._onWindowChange = () => { if (this.isOpen) this._position(); };
        window.addEventListener('resize', this._onWindowChange);
        window.addEventListener('scroll', this._onWindowChange, true);
    }

    _onTriggerKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp':
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (!this.isOpen) this.open();
                else this._moveHighlight(e.key === 'ArrowUp' ? -1 : 1);
                break;
        }
    }

    _onContentKeydown(e) {
        switch (e.key) {
            case 'Escape': e.preventDefault(); this.close(true); break;
            case 'ArrowDown': e.preventDefault(); this._moveHighlight(1); break;
            case 'ArrowUp': e.preventDefault(); this._moveHighlight(-1); break;
            case 'Home': e.preventDefault(); this._setHighlight(0); break;
            case 'End': e.preventDefault(); this._setHighlight(this.items.length - 1); break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (this.highlightedIndex >= 0) this._selectIndex(this.highlightedIndex);
                break;
            case 'Tab': this.close(); break;
            default:
                if (e.key.length === 1 && /\S/.test(e.key)) this._typeahead(e.key);
        }
    }

    _typeahead(char) {
        const q = char.toLowerCase();
        const start = this.highlightedIndex + 1;
        const opts = Array.from(this.select.options);
        for (let i = 0; i < opts.length; i++) {
            const idx = (start + i) % opts.length;
            const opt = opts[idx];
            if (!opt.disabled && opt.textContent.trim().toLowerCase().startsWith(q)) {
                this._setHighlight(idx);
                break;
            }
        }
    }

    /* ---------- Open / close ---------- */
    toggle() {
        if (this.select.disabled) return;
        this.isOpen ? this.close(true) : this.open();
    }

    open() {
        if (this.isOpen || this.select.disabled) return;
        // Close any other open selects
        _openInstances.forEach(inst => inst !== this && inst.close());

        if (!this.content) this._buildContent();
        else this._refreshItems();

        document.body.appendChild(this.content);
        this.isOpen = true;
        _openInstances.add(this);
        this.trigger.setAttribute('aria-expanded', 'true');

        this._position();

        // Highlight current selection
        const sel = this.select.selectedIndex;
        this._setHighlight(sel >= 0 ? sel : 0, false);

        this.content.addEventListener('keydown', (e) => this._onContentKeydown(e));
        this.content.tabIndex = -1;
        this.content.focus({ preventScroll: true });

        // Item interactions
        this.items.forEach((item, i) => {
            item.addEventListener('pointermove', () => this._setHighlight(i, false));
            item.addEventListener('click', (e) => { e.stopPropagation(); this._selectIndex(i); });
        });
    }

    close(refocus = false) {
        if (!this.isOpen) return;
        this.isOpen = false;
        _openInstances.delete(this);
        this.trigger.setAttribute('aria-expanded', 'false');
        if (this.content && this.content.parentNode) {
            const c = this.content;
            c.classList.add('closing');
            setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); c.classList.remove('closing'); }, 100);
        }
        if (refocus) this.trigger.focus();
    }

    /* ---------- Positioning (flip + clamp, like Base UI Positioner) ---------- */
    _position() {
        const r = this.trigger.getBoundingClientRect();
        const c = this.content;
        const offset = 4;
        c.style.minWidth = `${Math.max(r.width, 144)}px`;

        // Measure after it's in the DOM
        const ch = c.offsetHeight;
        const cw = c.offsetWidth;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const spaceBelow = vh - r.bottom;
        const spaceAbove = r.top;
        let side = 'bottom';
        let top;
        if (spaceBelow < ch + offset && spaceAbove > spaceBelow) {
            side = 'top';
            top = r.top - ch - offset;
        } else {
            top = r.bottom + offset;
        }
        c.dataset.side = side;

        let left = r.left;
        left = Math.max(8, Math.min(left, vw - cw - 8));

        c.style.top = `${top + window.scrollY}px`;
        c.style.left = `${left + window.scrollX}px`;
        c.style.maxHeight = `${Math.min(280, (side === 'bottom' ? spaceBelow : spaceAbove) - 12)}px`;
    }

    /* ---------- Selection ---------- */
    _setHighlight(i, scroll = true) {
        if (!this.items || !this.items.length) return;
        // skip disabled
        const opts = Array.from(this.select.options);
        if (i < 0) i = 0;
        if (i >= this.items.length) i = this.items.length - 1;
        this.highlightedIndex = i;
        this.items.forEach((item, idx) => {
            if (idx === i) item.setAttribute('data-highlighted', '');
            else item.removeAttribute('data-highlighted');
        });
        if (scroll && this.items[i]) {
            this.items[i].scrollIntoView({ block: 'nearest' });
        }
    }

    _moveHighlight(delta) {
        if (!this.items || !this.items.length) return;
        const opts = Array.from(this.select.options);
        let i = this.highlightedIndex;
        for (let step = 0; step < this.items.length; step++) {
            i = (i + delta + this.items.length) % this.items.length;
            if (!opts[i].disabled) break;
        }
        this._setHighlight(i);
    }

    _selectIndex(i) {
        const opt = this.select.options[i];
        if (!opt || opt.disabled) return;
        if (this.select.selectedIndex !== i) {
            this.select.selectedIndex = i;
            // Fire a native change so existing handlers run
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.syncFromNative();
        this.close(true);
    }

    /* ---------- Sync native -> UI ---------- */
    syncFromNative() {
        const opt = this.select.options[this.select.selectedIndex];
        const label = opt ? opt.textContent : (this.select.dataset.placeholder || 'Select…');
        this.valueEl.textContent = label;
        if (!opt) this.trigger.setAttribute('data-placeholder', '');
        else this.trigger.removeAttribute('data-placeholder');

        if (this.items) {
            this.items.forEach((item, idx) => {
                if (idx === this.select.selectedIndex) item.setAttribute('data-selected', '');
                else item.removeAttribute('data-selected');
            });
        }
        if (this.select.disabled) this.trigger.setAttribute('aria-disabled', 'true');
        else this.trigger.removeAttribute('aria-disabled');
    }

    _refreshItems() {
        // Rebuild items if options changed
        this._buildContent();
        if (this.isOpen) {
            const old = this.content;
            if (old && old.parentNode) old.parentNode.replaceChild(this.content, old);
        }
        this.syncFromNative();
    }

    /* ---------- Teardown ---------- */
    destroy() {
        this.close();
        document.removeEventListener('pointerdown', this._onDocPointerDown, true);
        window.removeEventListener('resize', this._onWindowChange);
        window.removeEventListener('scroll', this._onWindowChange, true);
        if (this.trigger && this.trigger.parentNode) this.trigger.parentNode.removeChild(this.trigger);
        const s = this.select;
        s.classList.remove('ui-select-native');
        s.style.cssText = '';
        s.removeAttribute('aria-hidden');
        s.tabIndex = 0;
        delete s._uiSelect;
    }
}

/* ---------- Bulk enhance ---------- */
export function enhanceSelects(root = document, filter) {
    const selects = root.querySelectorAll('select:not([data-no-ui-select])');
    const out = [];
    selects.forEach(s => {
        if (s._uiSelect) { out.push(s._uiSelect); return; }
        if (filter && !filter(s)) return;
        try { out.push(new UISelect(s)); } catch (e) { console.warn('[ui-select] skip', s, e); }
    });
    return out;
}

/* Auto-enhance on DOMContentLoaded for any <select> not opted out. */
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => enhanceSelects());
    } else {
        enhanceSelects();
    }
    // Re-enhance when new selects are added dynamically
    const mo = new MutationObserver((muts) => {
        for (const m of muts) {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.tagName === 'SELECT' && !node._uiSelect && !node.hasAttribute('data-no-ui-select')) {
                    try { new UISelect(node); } catch (e) {}
                } else if (node.querySelectorAll) {
                    enhanceSelects(node);
                }
            });
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
}
