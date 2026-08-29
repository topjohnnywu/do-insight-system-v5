# 📦 DO Insight System

*A logistics analytics platform that will absolutely transform your delivery operations. Probably. Please don't ask too many questions.*

A multi-page web app for **Delivery Order (DO) management, truck load planning, batch analytics, volume calculation, shipping insights**, and frankly anything else you can think of. Built with pure **HTML, CSS, and vanilla JavaScript** — because this organization didn't reach its current level of operational excellence by adopting things like "frameworks" or "build steps."

All data is processed **100% client-side**. Not because we're privacy visionaries — mostly because the backend doesn't exist.

---

## 🌟 Key "Highlights"

- **🚀 100% Client-Side Processing**: Your `.xlsx`, `.xlsm`, and `.csv` files never leave your browser. They also never touch a server, because there is no server. It's fine. It's a feature.
- **🚛 Interactive 3D Load Planners**: Real-time 3D truck visualization powered by Three.js. Because nothing says "serious logistics tool" like rotating a holographic pallet for fun.
- **🎨 13 Switchable UI Themes**: Linear, Terminal, Cyberpunk, AMOLED, Bitcoin, Bauhaus, Retro, Dopamine, Premium… You will spend more time switching themes than actually using the tool. We know. We built it that way.
- **🔍 Real-Time KPI Recalculation**: The numbers update the instant you search. Math, but with enthusiasm.
- **⚡ Quick Actions & Remarks System**: Bulk-tag orders as `SELF COLLECT`, `HOLD`, `URGENT`, or `CANCELLED` in one click, because manually editing 400 rows is beneath you.
- **📑 Multi-Format Exporting**: Export styled spreadsheets with auto-fit columns and summary rows. Excel, but *styled*. Your colleagues still won't open them.

---

## 📂 The Modules

### 1. 📊 Summary Analytics (`index.html`)
The "command center." A dashboard with so many charts you'll forget which number actually matters.
- Drag-and-drop file upload (the drag is optional; the upload is not).
- KPIs: Total Orders, Delivered, Pending, In-Transit, Exceptions. In other words: everything, some, a few, en route, and problems.
- Remarks breakdowns, top consignee analysis, route distributions. All the insight. All of it.

### 2. 📝 DO Summary Generator (`do_summary_generator.html`)
For when your DO list looks like it was drafted by a committee of pigeons.
- Live KPI cards that adapt to search queries (magic, but with arrays).
- **Quick Remarks Side Panel**: one click tags an entire pile of orders. `HOLD` them. `CANCEL` them. `URGENT` them.
- **Missing Info Updater**: import a second Excel file to fill in the blanks the first one left, because nobody exports a complete file on the first try.
- Styled Excel exports, because plain Excel is beneath you.

### 3. 🚚 Picking List Summary (`truck_planning.html`)
Vehicle allocation for people who enjoy watching progress bars enter the red zone.
- Capacity indicators for weight (kg) and volume (m³) per truck. Overload warnings included; frequently ignored.
- Multi-tab management for waves, shifts, or "I don't know, just put it on a truck."
- In-table manifest editor with live sum calculations. The sums are always right. The trucks disagree.

### 4. 🚛 Truck Planning (`manual_truck_planning.html`)
The other truck planning. Yes, there are two. No, we didn't consolidate them. Why would we?
- Drag-and-drop truck board with animated transit views. Trucks that drive across the screen by themselves. Mesmerizing. Productive? Look, it's about the journey.

### 5. 📦 Volume & Capacity Planner (`volume_capacity_planner.html`)
3D packing simulation, so you can see — in glorious WebGL — that your cargo does not fit.
- 360° orbit and zoom. Rotate the pallets. Admire the gaps.
- Multi-layer stacking calculations and dimension verification. The math is fine. The physical truck doesn't care.
- Overhang and utilization percentages, reported honestly, occasionally.

### 6. 🎯 DO Load Planner (`do_load_planner.html`)
Maps individual delivery orders into pallet spaces, because guessing worked so poorly last time.
- Automatic volume (m³) calculation. Yes, it's multiplication. We're proud of it.
- Split-load handling for DOs too big for one truck. The truck said no.
- Interactive pallet grid showing exactly where every order sits. Right up until the dock workers load it differently anyway.

### 7. 📦 Loose Load Planner (`loose_load_planner.html`)
For cartons that refuse to be palletized. Loose cargo. Loose standards.
- Mixed-item 3D packing algorithms that solve what Tetris could only dream of.
- Color-coded carton groups by SKU or destination, so at least the warehouse can tell them apart.
- Step-by-step loading guide: back-to-front, bottom-to-top. Directions included. Batteries not included.

### 8. 🔎 DO Details Inspector (`do_details.html`)
Deep-dive into individual DOs, for when "it's complicated" isn't specific enough.
- Search by DO number, customer name, or invoice ID.
- Line-item breakdown: SKUs, descriptions, quantities, weights, unit volumes.
- Printable single-order view, for the filing-cabinet enthusiasts.

### 9. 📈 Shipping Insight (`shipping_insight.html`)
Historical shipping analytics. Learn from the past so you can repeat it, slightly differently.
- Carrier volume distribution and turnaround-time charts.
- On-time delivery (OTD) rate. It's a number. We hope it's a good one.
- Cost per m³ / cost per delivery order. You'll wish you hadn't asked.

### 10. 🏭 Batch Analytics (`batch_analytics.html`)
Warehouse picking-wave analysis from `.xlsm` logs. Picking efficiency, quantified at last.
- Wave pick analysis, picker productivity tracking, SKU velocity heatmaps. Velocity — for boxes.
- Bottleneck analysis: find out exactly which shelf is ruining everything.

### 11. 📉 DO Activity Trend (`do_activity_trend.html`)
Time-series tracking of DO volumes. Trends, charts, and the quiet terror of month-end spikes.
- Multi-metric toggles (order count vs. volume vs. weight).
- Day-of-week and peak-hour heatmaps. Monday is not your friend.

### 12. 🏆 Challenger List (`challenger_list.html`)
For the orders that have gone rogue. High-priority, delayed, problematic — the cream of the crop, but in the bad way.
- Priority scoring based on aging days, customer tier, and delivery exceptions.
- A filterable action list, so you can decide who to apologize to first.

### 13. 📋 Packing List (`packing_sheet.html`)
Wraps the Packing Details Sheet in an iframe. A whole React app, embedded inside a vanilla-JS dashboard, because why commit to a stack when you can contain multitudes.
- Serves **SSEA** (LCL) and **MSCSJ** (AIR) customers.
- Bulk paste, master lookup, DO verification, multi-sheet Excel export. All React, all vendored, all fine.

---

## 🛠️ Tech Stack (such as it is)

- **Frontend**: HTML5, CSS3, vanilla JS. "Zero framework overhead" — we prefer to think of it as "zero modern engineering debt."
- **Excel Engine**: SheetJS, because the entire business runs on spreadsheets.
- **Charts**: Chart.js + `chartjs-plugin-datalabels`.
- **3D Graphics**: Three.js (r128), pinned like it's 2020. Because it is. The r, not the year.
- **Backend**: Node.js + Express — a whole server whose only job is to serve static files. Worth every one of its zero lines of business logic.
- **Storage**: `localStorage`. It's not a database. It's a "client-side data warehouse."
- **PWA**: `sw.js` + `manifest.json`, so the app can haunt your browser even while you're offline.

---

## 🚀 Quick Start (the exciting part)

### Prerequisites
- [Node.js](https://nodejs.org/) — any version. We're not picky.

### 1. Install & Run
```bash
npm install   # installs the one dependency
npm start     # a server, for static files
```

### 2. Access
Open your browser and navigate to:
```text
http://localhost:3000
```

Marvel. Repeat.

> **Zero-dependency alternative**: `python -m http.server 8000`, or just open `index.html` directly. The Express server would like to point out it's not "optional" — it's "very important and absolutely necessary." It's not.

---

## 🎨 Themes & Settings

Click the **Palette / Settings** icon and choose among **13 themes**: Linear, Terminal, Cyberpunk, AMOLED, Premium, Light, Organic, Retro, Dopamine, Bitcoin, Bauhaus, Mono, GitHub. Why 13? Because 12 wasn't enough and 14 would have been excessive. Also a universal font selector and UI zoom (80%–130%), so the dashboard can match the resolution of your laptop and the depth of your regret. All persisted in `localStorage`, so your questionable taste survives restarts. Good for you.

---

## 📁 Repository Structure

```
├── server.js                    # Static-file server (important. very important.)
├── package.json                 # Exactly one dependency
├── README.md                    # This masterpiece
│
├── index.html                   # Summary Analytics
├── do_summary_generator.html    # DO Summary Generator
├── truck_planning.html          # Picking List Summary
├── manual_truck_planning.html   # Truck Planning (the other one)
├── volume_capacity_planner.html # Volume & Capacity Planner
├── do_load_planner.html         # DO Load Planner
├── loose_load_planner.html      # Loose Load Planner
├── do_details.html              # DO Inspector
├── shipping_insight.html        # Shipping Insight
├── batch_analytics.html         # Batch Analytics
├── do_activity_trend.html       # DO Activity Trend
├── challenger_list.html         # Challenger List
├── packing_sheet.html           # Packing List (iframe wrapper)
│
├── css/
│   └── styles.css               # 13 themes. One file. Yes, really.
│
├── js/
│   ├── app.js                   # Main dashboard logic & storage vaults
│   ├── charts.js                # Chart engine + theme reskinning
│   ├── parsers.js               # Excel/CSV parsing & sanitization
│   ├── settings.js              # Theme / font / zoom controller
│   ├── *.js                     # One script per module, as God intended
│   └── xlsx.bundle.js           # Excel engine (vendored, naturally)
│
├── packing-sheet/               # A React app living in a vanilla world
│   └── js/App.js                # It's React. It works. We contain multitudes.
│
└── _backups/                    # Copies made before every "revise the code"
```

---

## 🔒 Privacy & Security

All data is parsed **locally in your browser session**. No business records, customer information, or delivery orders are ever sent to external servers. That would require a server, and — well — see the Tech Stack section.

---

## 📄 License

Internal Enterprise Tool — All rights reserved. Meaning: it's ours. You just use it.
