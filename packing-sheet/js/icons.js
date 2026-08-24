/* Lucide-style inline SVG icon components (no lucide-react dependency).
   Each is a React component: (props: { className, strokeWidth }) => <svg>.
   Classic script; exposes window.Icon and window.h (React.createElement alias). */
(function () {
  const h = React.createElement;
  window.h = h;

  function makeIcon(children) {
    return function IconComponent(props) {
      props = props || {};
      const cls = props.className || '';
      const sw = props.strokeWidth != null ? props.strokeWidth : 2;
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: sw,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        className: cls, 'aria-hidden': 'true',
      }, ...children);
    };
  }

  const path = (d) => h('path', { d: d });
  const circle = (cx, cy, r) => h('circle', { cx: cx, cy: cy, r: r });
  const rect = (attrs) => h('rect', attrs);
  const line = (attrs) => h('line', attrs);
  const polyline = (points) => h('polyline', { points: points });
  const ellipse = (attrs) => h('ellipse', attrs);

  const Icon = {
    FileSpreadsheet: makeIcon([
      path('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
      path('M14 2v4a2 2 0 0 0 2 2h4'),
      path('M8 13h2'), path('M14 13h2'), path('M8 17h2'), path('M14 17h2'),
    ]),
    FileText: makeIcon([
      path('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
      path('M14 2v4a2 2 0 0 0 2 2h4'),
      path('M10 9H8'), path('M16 13H8'), path('M16 17H8'),
    ]),
    Printer: makeIcon([
      path('M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'),
      path('M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6'),
      rect({ x: 6, y: 14, width: 12, height: 8, rx: 1 }),
    ]),
    HelpCircle: makeIcon([
      circle(12, 12, 10),
      path('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'),
      path('M12 17h.01'),
    ]),
    PenTool: makeIcon([
      path('M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z'),
      path('m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18'),
      path('m2.3 2.3 7.286 7.286'),
      circle(11, 11, 2),
    ]),
    Sun: makeIcon([
      circle(12, 12, 4),
      path('M12 2v2'), path('M12 20v2'),
      path('m4.93 4.93 1.41 1.41'), path('m17.66 17.66 1.41 1.41'),
      path('M2 12h2'), path('M20 12h2'),
      path('m6.34 17.66-1.41 1.41'), path('m19.07 4.93-1.41 1.41'),
    ]),
    Moon: makeIcon([path('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z')]),
    Package: makeIcon([
      path('M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'),
      path('M12 22V12'),
      path('m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7'),
      path('m7.5 4.27 9 5.15'),
    ]),
    Layers: makeIcon([
      path('m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z'),
      path('m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65'),
      path('m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'),
    ]),
    Weight: makeIcon([
      circle(12, 5, 3),
      path('M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z'),
    ]),
    Maximize: makeIcon([
      path('M8 3H5a2 2 0 0 0-2 2v3'),
      path('M21 8V5a2 2 0 0 0-2-2h-3'),
      path('M3 16v3a2 2 0 0 0 2 2h3'),
      path('M16 21h3a2 2 0 0 0 2-2v-3'),
    ]),
    X: makeIcon([path('M18 6 6 18'), path('m6 6 12 12')]),
    Sparkles: makeIcon([
      path('M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'),
      path('M20 3v4'), path('M22 5h-4'), path('M4 17v2'), path('M5 18H3'),
    ]),
    Clipboard: makeIcon([
      rect({ width: 8, height: 4, x: 8, y: 2, rx: 1, ry: 1 }),
      path('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'),
    ]),
    CheckCircle2: makeIcon([
      path('M21.801 10A10 10 0 1 1 17 3.335'),
      path('m9 11 3 3L22 4'),
    ]),
    CheckCircle: makeIcon([
      circle(12, 12, 10),
      path('m9 12 2 2 4-4'),
    ]),
    AlertTriangle: makeIcon([
      path('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'),
      path('M12 9v4'), path('M12 17h.01'),
    ]),
    XCircle: makeIcon([
      circle(12, 12, 10),
      path('m15 9-6 6'), path('m9 9 6 6'),
    ]),
    PlusCircle: makeIcon([
      circle(12, 12, 10),
      path('M8 12h8'), path('M12 8v8'),
    ]),
    MinusCircle: makeIcon([
      circle(12, 12, 10),
      path('M8 12h8'),
    ]),
    ClipboardCheck: makeIcon([
      rect({ width: 8, height: 4, x: 8, y: 2, rx: 1, ry: 1 }),
      path('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'),
      path('m9 14 2 2 4-4'),
    ]),
    Plus: makeIcon([path('M5 12h14'), path('M12 5v14')]),
    ArrowUp: makeIcon([path('m5 12 7-7 7 7'), path('M12 19V5')]),
    ArrowDown: makeIcon([path('M12 5v14'), path('m19 12-7 7-7-7')]),
    Wand2: makeIcon([
      path('m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72'),
      path('m14 7 3 3'), path('M5 6v4'), path('M19 14v4'),
      path('M10 2v2'), path('M7 8H3'), path('M21 16h-4'), path('M11 3H9'),
    ]),
    Database: makeIcon([
      ellipse({ cx: 12, cy: 5, rx: 9, ry: 3 }),
      path('M3 5V19A9 3 0 0 0 21 19V5'),
      path('M3 12A9 3 0 0 0 21 12'),
    ]),
    Zap: makeIcon([
      path('M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'),
    ]),
    Trash2: makeIcon([
      path('M3 6h18'),
      path('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'),
      path('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'),
      line({ x1: 10, x2: 10, y1: 11, y2: 17 }),
      line({ x1: 14, x2: 14, y1: 11, y2: 17 }),
    ]),
    Upload: makeIcon([
      path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
      polyline('17 8 12 3 7 8'),
      line({ x1: 12, x2: 12, y1: 3, y2: 15 }),
    ]),
    Ship: makeIcon([
      path('M12 10.189V14'), path('M12 2v3'),
      path('M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6'),
      path('M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76'),
      path('M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'),
    ]),
    RotateCcw: makeIcon([
      path('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'),
      path('M3 3v5h5'),
    ]),
  };

  window.Icon = Icon;
})();
