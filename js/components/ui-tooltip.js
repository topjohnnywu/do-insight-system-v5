/*
   Minimalist Tooltip — shadcn / Radix style, dependency-free
   Focused only on explicit [data-tip], [data-tooltip], or [title] elements with hover intent.
   Automatically intercepts and removes native browser title attributes to eliminate OS browser tooltips.
*/
(function () {
    "use strict";

    const SHOW_DELAY = 180;   // ms deliberate hover intent (snappy, modern feel)
    const HIDE_DELAY = 60;    // ms grace period before hiding
    const OFFSET = 6;         // gap between trigger and tooltip
    const VIEWPORT_PAD = 8;   // min distance from viewport edge

    let tipEl = null;         // singleton tooltip node
    let activeTrigger = null;
    let pendingTrigger = null;
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

    // Intercept native title and convert to data-tip so the browser OS tooltip never appears
    function convertTitleAttr(el) {
        if (!el || !el.getAttribute) return el;
        const target = el.closest ? el.closest("[data-tip], [data-tooltip], [title]") : el;
        if (target && target.hasAttribute && target.hasAttribute("title") && target.tagName !== "TITLE") {
            const rawTitle = target.getAttribute("title");
            if (rawTitle && rawTitle.trim() && !target.getAttribute("data-tip")) {
                target.setAttribute("data-tip", rawTitle.trim());
            }
            target.removeAttribute("title");
        }
        return target;
    }

    // Get tooltip text from data-tip, data-tooltip, or converted title.
    // Suppress if empty or if it merely duplicates visible button text.
    function getText(el) {
        if (!el || !el.getAttribute) return "";
        convertTitleAttr(el);
        const raw = el.getAttribute("data-tip") || el.getAttribute("data-tooltip") || "";
        const trimmed = raw.trim();
        if (!trimmed) return "";

        // Filter out redundant tooltips where the button/link text already explains itself
        const visibleText = (el.innerText || el.textContent || "").trim();
        if (visibleText && visibleText.toLowerCase() === trimmed.toLowerCase()) {
            return "";
        }
        return trimmed;
    }

    function preferredPos(el) {
        const p = (el.getAttribute("data-tip-pos") || "top").toLowerCase();
        return ["top", "bottom", "left", "right"].includes(p) ? p : "top";
    }

    function position(trigger, pos) {
        const tip = ensureTipEl();
        const content = tip.querySelector(".ui-tooltip-content");
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
        let { x, y } = coords;
        x = Math.max(VIEWPORT_PAD, Math.min(x, vw - tw - VIEWPORT_PAD));
        y = Math.max(VIEWPORT_PAD, Math.min(y, vh - th - VIEWPORT_PAD));

        tip.style.left = x + "px";
        tip.style.top = y + "px";
        tip.dataset.side = chosen;
        tip.style.visibility = "";

        const arrow = tip.querySelector(".ui-tooltip-arrow");
        const cx = tr.left + tr.width / 2;
        const cy = tr.top + tr.height / 2;
        if (chosen === "top" || chosen === "bottom") {
            arrow.style.left = Math.max(8, Math.min(cx - x, tw - 8)) + "px";
            arrow.style.top = chosen === "top" ? "100%" : "auto";
            arrow.style.bottom = chosen === "bottom" ? "100%" : "auto";
        } else {
            arrow.style.top = Math.max(8, Math.min(cy - y, th - 8)) + "px";
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
        if (!trigger || !document.contains(trigger)) {
            cancelPending();
            return;
        }
        const text = getText(trigger);
        if (!text) {
            cancelPending();
            return;
        }
        clearTimeout(hideTimer);
        cancelPending();
        activeTrigger = trigger;
        const tip = ensureTipEl();
        tip.querySelector(".ui-tooltip-content").textContent = text;
        if (!tip.id) tip.id = "ui-tooltip-" + (++idCounter);
        trigger.setAttribute("aria-describedby", tip.id);
        position(trigger, preferredPos(trigger));
        tip.classList.remove("ui-tooltip-open");
        void tip.offsetWidth;
        tip.classList.add("ui-tooltip-open");
        tip.hidden = false;
    }

    function cancelPending() {
        if (showTimer) {
            clearTimeout(showTimer);
            showTimer = null;
        }
        pendingTrigger = null;
    }

    function hide() {
        cancelPending();
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        const tip = tipEl;
        if (!tip) return;
        tip.classList.remove("ui-tooltip-open");
        if (activeTrigger) activeTrigger.removeAttribute("aria-describedby");
        activeTrigger = null;
        hideTimer = setTimeout(() => {
            if (tipEl && !activeTrigger) tipEl.hidden = true;
        }, 120);
    }

    function scheduleShow(trigger) {
        cancelPending();
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        pendingTrigger = trigger;
        showTimer = setTimeout(() => {
            if (pendingTrigger === trigger && document.contains(trigger)) {
                show(trigger);
            }
        }, SHOW_DELAY);
    }

    function scheduleHide() {
        cancelPending();
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        hideTimer = setTimeout(hide, HIDE_DELAY);
    }

    function onOver(e) {
        const rawTarget = e.target.closest && e.target.closest("[data-tip], [data-tooltip], [title]");
        const t = convertTitleAttr(rawTarget);

        // Moving within current active trigger
        if (t && t === activeTrigger) {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            return;
        }
        // Hovering a new trigger
        if (t) {
            if (t !== pendingTrigger) {
                scheduleShow(t);
            }
            return;
        }
        // Mouse moved over an element without tooltip
        if (pendingTrigger) {
            cancelPending();
        }
        if (activeTrigger) {
            scheduleHide();
        }
    }

    function onOut(e) {
        const rawTarget = e.target.closest && e.target.closest("[data-tip], [data-tooltip], [title]");
        const t = convertTitleAttr(rawTarget);
        if (!t) return;

        // Ignore transitions between child nodes of the same trigger
        const related = e.relatedTarget;
        if (related && t.contains(related)) {
            return;
        }

        // Mouse genuinely exited the trigger
        if (t === pendingTrigger) {
            cancelPending();
        }
        if (t === activeTrigger) {
            scheduleHide();
        }
    }

    function onPointerDown() {
        // Dismiss tooltip immediately when clicking/pressing anywhere
        cancelPending();
        if (activeTrigger) hide();
    }

    function onDocMouseLeave() {
        // Cursor left the browser window
        cancelPending();
        if (activeTrigger) hide();
    }

    function onFocus(e) {
        const rawTarget = e.target.closest && e.target.closest("[data-tip], [data-tooltip], [title]");
        const t = convertTitleAttr(rawTarget);
        if (t) show(t);
    }

    function onBlur(e) {
        const rawTarget = e.target.closest && e.target.closest("[data-tip], [data-tooltip], [title]");
        const t = convertTitleAttr(rawTarget);
        if (t && (t === activeTrigger || t === pendingTrigger)) hide();
    }

    function onKey(e) {
        if (e.key === "Escape") {
            cancelPending();
            hide();
        }
    }

    function onScroll() {
        cancelPending();
        if (activeTrigger) hide();
    }

    // Proactively scrub any existing title attributes to data-tip so browser tooltips never show
    function scrubTitles(root) {
        const base = root || document;
        if (!base.querySelectorAll) return;
        try {
            const els = base.querySelectorAll("[title]");
            els.forEach(el => {
                if (el.tagName === "TITLE") return;
                const raw = el.getAttribute("title");
                if (raw && raw.trim() && !el.getAttribute("data-tip")) {
                    el.setAttribute("data-tip", raw.trim());
                }
                el.removeAttribute("title");
            });
        } catch (_) {}
    }

    function init() {
        if (init.__bound) return;
        init.__bound = true;
        scrubTitles(document);

        document.addEventListener("mouseover", onOver, true);
        document.addEventListener("mouseout", onOut, true);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("focusin", onFocus, true);
        document.addEventListener("focusout", onBlur, true);
        document.addEventListener("keydown", onKey, true);
        document.documentElement.addEventListener("mouseleave", onDocMouseLeave);
        window.addEventListener("blur", onDocMouseLeave);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll, true);

        // Continuous DOM observer to catch dynamic templates or client re-renders
        if (typeof MutationObserver !== "undefined") {
            const observer = new MutationObserver(mutations => {
                for (const m of mutations) {
                    if (m.type === "childList") {
                        m.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.hasAttribute && node.hasAttribute("title") && node.tagName !== "TITLE") {
                                    const raw = node.getAttribute("title");
                                    if (raw && raw.trim() && !node.getAttribute("data-tip")) {
                                        node.setAttribute("data-tip", raw.trim());
                                    }
                                    node.removeAttribute("title");
                                }
                                scrubTitles(node);
                            }
                        });
                    } else if (m.type === "attributes" && m.attributeName === "title") {
                        const target = m.target;
                        if (target && target.hasAttribute && target.hasAttribute("title") && target.tagName !== "TITLE") {
                            const raw = target.getAttribute("title");
                            if (raw && raw.trim() && !target.getAttribute("data-tip")) {
                                target.setAttribute("data-tip", raw.trim());
                            }
                            target.removeAttribute("title");
                        }
                    }
                }
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["title"]
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init());
    } else {
        init();
    }

    window.UITooltip = { init, show, hide, scrubTitles };
})();
