/* ConfirmDialog — reusable confirmation dialog for the Packing Sheet app.
 *
 * Replaces browser-native window.confirm() calls with a custom dialog that
 * matches the app's iOS design system (16px cards, #007AFF accent, #FF3B30
 * danger, 13px/17px typography, backdrop-blur overlay).
 *
 * Two usage modes:
 *
 *   1. Imperative (promise-based) — easiest drop-in for window.confirm:
 *        const ok = await window.ConfirmDialog.confirm({
 *          title: 'Clear All Rows?',
 *          message: 'This will reset the form. This cannot be undone.',
 *          confirmLabel: 'Clear All',
 *          tone: 'danger',
 *          icon: Icon.Trash2,
 *        });
 *
 *      The promise resolves to `true` (confirmed) or `false` (cancelled /
 *      backdrop / X / Escape). Requires ONE `<ConfirmDialogHost/>` to be
 *      mounted in the tree (see App.js). If none is mounted, falls back to
 *      the native confirm as a safety net.
 *
 *   2. Declarative (controlled) component:
 *        h(window.ConfirmDialog, {
 *          isOpen, onClose, onConfirm, title, message,
 *          confirmLabel, cancelLabel, tone, icon,
 *        })
 *
 * Visual language — mirrors ConfirmVerifyModal / MasterLookupModal:
 *   overlay   fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm
 *   card      bg-white dark:bg-[#1C1C1E] rounded-[16px] shadow border-black/[0.06] dark:border-white/[0.08]
 *   header    40px icon badge (rounded-[12px]) + title text-[17px] font-semibold + optional subtitle text-[13px]
 *   body      text-[15px] leading-relaxed text-gray-500 dark:text-gray-400
 *   footer    right-aligned, ghost Cancel + tonal confirm (danger red / accent blue)
 */
(function () {
  const { useState, useEffect, useCallback, useRef } = React;

  const TONES = {
    danger: {
      // iOS red — used for destructive reset/clear actions
      badge: 'bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/15 dark:text-[#FF453A]',
      button: 'bg-[#FF3B30] hover:bg-[#FF3B30]/90 dark:bg-[#FF453A] dark:hover:bg-[#FF453A]/90',
      shadow: 'shadow-[0_1px_4px_rgba(255,59,48,0.3)]',
    },
    primary: {
      // iOS blue — used for non-destructive confirmations
      badge: 'bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]',
      button: 'bg-[#007AFF] hover:bg-[#007AFF]/90 dark:bg-[#0A84FF] dark:hover:bg-[#0A84FF]/90',
      shadow: 'shadow-[0_1px_4px_rgba(0,122,255,0.3)]',
    },
  };

  const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    subtitle,
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    icon,
  }) => {
    // A11y: move keyboard focus into the dialog on open (native confirm() did
    // this by default), then restore focus to the previously-focused element
    // on close so focus is never lost behind the overlay.
    const confirmBtnRef = useRef(null);
    const restoreFocusRef = useRef(null);

    useEffect(() => {
      if (!isOpen) return;
      restoreFocusRef.current = document.activeElement;
      // Defer to next frame so the dialog is painted before focusing
      const raf = requestAnimationFrame(() => confirmBtnRef.current && confirmBtnRef.current.focus());

      const onKey = (e) => {
        if (e.key === 'Escape') onClose && onClose();
      };
      window.addEventListener('keydown', onKey);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        const prev = restoreFocusRef.current;
        if (prev && typeof prev.focus === 'function') prev.focus();
        restoreFocusRef.current = null;
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const style = TONES[tone] || TONES.danger;
    const DialogIcon = icon || Icon.AlertTriangle;

    return h(
      'div',
      {
        className:
          'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm print:hidden',
        onClick: (e) => {
          if (e.target === e.currentTarget) onClose && onClose();
        },
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-label': title,
      },
      h(
        'div',
        {
          className:
            'bg-white dark:bg-[#1C1C1E] rounded-[16px] max-w-md w-full flex flex-col ' +
            'shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] dark:border-white/[0.08] ' +
            'overflow-hidden transition-colors',
        },
        // Header — icon badge + title (+optional subtitle) + close X
        h(
          'div',
          { className: 'px-6 pt-4 pb-4 flex items-center gap-3 shrink-0 border-b border-black/[0.06] dark:border-white/[0.08]' },
          h(
            'div',
            { className: `w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${style.badge}` },
            h(DialogIcon, { className: 'w-5 h-5', strokeWidth: 1.5 })
          ),
          h(
            'div',
            { className: 'flex-1 min-w-0' },
            h('h2', { className: 'text-[17px] font-semibold text-gray-900 dark:text-white' }, title),
            subtitle &&
              h('p', { className: 'text-[13px] text-gray-500 dark:text-gray-400' }, subtitle)
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] ' +
                'flex items-center justify-center text-gray-500 dark:text-gray-400 transition cursor-pointer shrink-0',
              'aria-label': 'Close',
            },
            h(Icon.X, { className: 'w-4 h-4', strokeWidth: 1.5 })
          )
        ),
        // Body
        h(
          'div',
          { className: 'px-6 py-5 text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-line' },
          message
        ),
        // Footer — right-aligned ghost Cancel + tonal Confirm
        h(
          'div',
          { className: 'px-6 py-4 bg-black/[0.02] dark:bg-white/[0.04] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end gap-2.5 shrink-0' },
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'px-4 py-2.5 bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/[0.1] dark:hover:bg-white/[0.15] ' +
                'text-gray-800 dark:text-gray-200 text-[13px] font-semibold rounded-[10px] transition cursor-pointer',
            },
            cancelLabel
          ),
          h(
            'button',
            {
              type: 'button',
              ref: confirmBtnRef,
              onClick: onConfirm,
              className: `px-4 py-2.5 text-white text-[13px] font-semibold rounded-[10px] transition cursor-pointer ${style.button} ${style.shadow}`,
            },
            confirmLabel
          )
        )
      )
    );
  };

  // ---------------------------------------------------------------
  // Imperative promise-based API driven by a single mounted host.
  // ---------------------------------------------------------------
  let hostApi = null; // set by ConfirmDialogHost when mounted
  let nativeFallbackWarned = false; // one-time console signal if fallback is ever used

  const confirm = (opts = {}) =>
    new Promise((resolve) => {
      // Safety net: if no host is mounted (e.g. called before render),
      // fall back to native confirm so behaviour never silently changes.
      if (!hostApi) {
        if (!nativeFallbackWarned) {
          nativeFallbackWarned = true;
          console.warn(
            'ConfirmDialog: no <ConfirmDialog.Host/> mounted — falling back to native window.confirm(). ' +
              'Mount <ConfirmDialog.Host/> once in the tree to get the styled dialog.'
          );
        }
        resolve(window.confirm(opts.message || 'Are you sure?'));
        return;
      }
      hostApi.show(opts, resolve);
    });

  const ConfirmDialogHost = () => {
    const [state, setState] = useState(null);

    const show = useCallback((opts, resolve) => {
      setState({ ...opts, resolve });
    }, []);

    useEffect(() => {
      hostApi = { show };
      return () => {
        hostApi = null;
      };
    }, [show]);

    const finish = (result) => {
      if (state && state.resolve) state.resolve(result);
      setState(null);
    };

    if (!state) return null;

    return h(ConfirmDialog, {
      isOpen: true,
      onClose: () => finish(false),
      onConfirm: () => finish(true),
      title: state.title || 'Confirm Action',
      subtitle: state.subtitle,
      message: state.message || 'Are you sure?',
      confirmLabel: state.confirmLabel || 'Confirm',
      cancelLabel: state.cancelLabel || 'Cancel',
      tone: state.tone || 'danger',
      icon: state.icon,
    });
  };

  // Expose component + imperative API + host
  window.ConfirmDialog = Object.assign(ConfirmDialog, {
    confirm,
    Host: ConfirmDialogHost,
  });
})();
