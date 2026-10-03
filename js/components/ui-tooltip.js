/*
   Tooltip — shadcn / Base UI style, dependency-free (no React, no npm, no Popper)

   Enhances any element carrying [data-tip] with a styled tooltip:
     <button data-tip="Export current view to Excel">Export</button>

   Optional placement hint (top is default, auto-flips near viewport edges):
     data-tip-pos="top|bottom|left|right"

   Behaviour (mirrors the shadcn Tooltip):
   - Appears on hover and keyboard focus, small delay before showing
   - Dark rounded card, small text, subtle border + shadow, fade+zoom animation
   - Auto-flips to the opposite side if it would overflow the viewport
   - Closes on mouse-leave, blur, Escape, or scroll
   - Accessible: content exposed via aria-describedby; respects reduced-motion
   - If the element has a native title= it is migrated to data-tip (no double tip)
   */
(function () {
    "use strict";

    const SHOW_DELAY = 200;   // ms before tooltip appears (shadcn-ish)
    const HIDE_DELAY = 60;
    const OFFSET = 8;         // gap between trigger and tooltip
    const VIEWPORT_PAD = 8;   // min distance from viewport edge

    let tipEl = null;         // singleton tooltip node
    let activeTrigger = null;
    let showTimer = null;
    let hideTimer = null;
    let idCounter = 0;

    function ensureTipEl() {
        if (tipEl) return tipEl;
        tipEl = document.createElement("div");
        tipEl.className = "ui-tooltip";
        tipEl.setAttribute("role", "tooltip");
        tipEl.hidden = true;
        tipEl.innerHTML = `<div class="ui-tooltip-content"></div><div class="ui-tooltip-arrow"></div>`;
        document.body.appendChild(tipEl);
        return tipEl;
    }

    // Migrate native title -> data-tip so we don't get the browser tooltip too.
    function migrate(el) {
        if (el.hasAttribute("data-tip")) return;
        const t = el.getAttribute("title");
        if (t) {
            el.setAttribute("data-tip", t);
            el.removeAttribute("title");
            // keep native title out of a11y tree duplication; store for restore
            el.setAttribute("data-tip-migrated", "");
        }
    }

    function getText(el) {
        return el.getAttribute("data-tip") || "";
    }

    function preferredPos(el) {
        const p = (el.getAttribute("data-tip-pos") || "top").toLowerCase();
        return ["top", "bottom", "left", "right"].includes(p) ? p : "top";
    }

    function position(trigger, pos) {
        const tip = ensureTipEl();
        const content = tip.querySelector(".ui-tooltip-content");
        // measure
        tip.style.visibility = "hidden";
        tip.hidden = false;
        const tr = trigger.getBoundingClientRect();
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const placements = [pos, opposite(pos), "top", "bottom", "left", "right"];
        let chosen = pos;
        let coords = null;
        for (const p of placements) {
            coords = compute(tr, tw, th, p);
            if (fits(coords, tw, th, vw, vh)) { chosen = p; break; }
        }
        // clamp horizontally/vertically inside the viewport
        let { x, y } = coords;
        x = Math.max(VIEWPORT_PAD, Math.min(x, vw - tw - VIEWPORT_PAD));
        y = Math.max(VIEWPORT_PAD, Math.min(y, vh - th - VIEWPORT_PAD));

        tip.style.left = x + "px";
        tip.style.top = y + "px";
        tip.dataset.side = chosen;
        tip.style.visibility = "";

        // arrow position: point back to the trigger centre
        const arrow = tip.querySelector(".ui-tooltip-arrow");
        const cx = tr.left + tr.width / 2;
        const cy = tr.top + tr.height / 2;
        if (chosen === "top" || chosen === "bottom") {
            arrow.style.left = Math.max(10, Math.min(cx - x, tw - 10)) + "px";
            arrow.style.top = chosen === "top" ? "100%" : "auto";
            arrow.style.bottom = chosen === "bottom" ? "100%" : "auto";
        } else {
            arrow.style.top = Math.max(10, Math.min(cy - y, th - 10)) + "px";
            arrow.style.left = chosen === "left" ? "100%" : "auto";
            arrow.style.right = chosen === "right" ? "100%" : "auto";
        }
        content.parentNode.dataset.placed = "true";
    }

    function opposite(p) {
        return { top: "bottom", bottom: "top", left: "right", right: "left" }[p];
    }

    function compute(tr, tw, th, pos) {
        switch (pos) {
            case "bottom": return { x: tr.left + tr.width / 2 - tw / 2, y: tr.bottom + OFFSET };
            case "left":   return { x: tr.left - tw - OFFSET, y: tr.top + tr.height / 2 - th / 2 };
            case "right":  return { x: tr.right + OFFSET, y: tr.top + tr.height / 2 - th / 2 };
            case "top":
            default:       return { x: tr.left + tr.width / 2 - tw / 2, y: tr.top - th - OFFSET };
        }
    }

    function fits(c, tw, th, vw, vh) {
        return c.x >= VIEWPORT_PAD && c.y >= VIEWPORT_PAD &&
               (c.x + tw) <= (vw - VIEWPORT_PAD) && (c.y + th) <= (vh - VIEWPORT_PAD);
    }

    function show(trigger) {
        const text = getText(trigger);
        if (!text) return;
        clearTimeout(hideTimer);
        activeTrigger = trigger;
        const tip = ensureTipEl();
        tip.querySelector(".ui-tooltip-content").textContent = text;
        if (!tip.id) tip.id = "ui-tooltip-" + (++idCounter);
        trigger.setAttribute("aria-describedby", tip.id);
        position(trigger, preferredPos(trigger));
        // animate in
        tip.classList.remove("ui-tooltip-open");
        // force reflow so the transition replays
        void tip.offsetWidth;
        tip.classList.add("ui-tooltip-open");
        tip.hidden = false;
    }

    function hide() {
        clearTimeout(showTimer);
        const tip = tipEl;
        if (!tip) return;
        tip.classList.remove("ui-tooltip-open");
        if (activeTrigger) activeTrigger.removeAttribute("aria-describedby");
        activeTrigger = null;
        // hide after the close transition
        hideTimer = setTimeout(() => { if (tipEl) tipEl.hidden = true; }, 120);
    }

    function scheduleShow(trigger) {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        showTimer = setTimeout(() => show(trigger), SHOW_DELAY);
    }
    function scheduleHide() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, HIDE_DELAY);
    }

    // Delegated events so it works for dynamically-added elements too.
    function onOver(e) {
        const t = e.target.closest && e.target.closest("[data-tip]");
        if (t) { migrate(t); if (t !== activeTrigger) scheduleShow(t); }
    }
    function onOut(e) {
        const t = e.target.closest && e.target.closest("[data-tip]");
        if (t && t === activeTrigger) scheduleHide();
    }
    function onFocus(e) {
        const t = e.target.closest && e.target.closest("[data-tip]");
        if (t) { migrate(t); show(t); }
    }
    function onBlur(e) {
        const t = e.target.closest && e.target.closest("[data-tip]");
        if (t && t === activeTrigger) hide();
    }
    function onKey(e) { if (e.key === "Escape") hide(); }
    function onScroll() { if (activeTrigger) hide(); }

    function init(root = document) {
        // Migrate any existing title attributes up-front
        root.querySelectorAll("[data-tip], [title]").forEach(migrate);

        if (init.__bound) return;
        init.__bound = true;
        document.addEventListener("mouseover", onOver, true);
        document.addEventListener("mouseout", onOut, true);
        document.addEventListener("focusin", onFocus, true);
        document.addEventListener("focusout", onBlur, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init());
    } else {
        init();
    }

    window.UITooltip = { init, show, hide };
})();
