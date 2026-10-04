# 📦 DO Insight System (v5)

[![Release](https://img.shields.io/badge/Release-v5.0.0-blue.svg)](https://github.com/topjohnnywu/do-insight-system-v5)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](https://github.com/topjohnnywu/do-insight-system-v5)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA-green.svg)](https://github.com/topjohnnywu/do-insight-system-v5)
[![Zero-Bundler](https://img.shields.io/badge/Architecture-Zero%20Build%20%7C%20Vanilla%20ES6-orange.svg)](https://github.com/topjohnnywu/do-insight-system-v5)
[![Privacy First](https://img.shields.io/badge/Data%20Privacy-100%25%20Client--Side-brightgreen.svg)](https://github.com/topjohnnywu/do-insight-system-v5)

> *A high-performance, enterprise-grade logistics analytics and operational planning platform for Delivery Order (DO) management, 3D cargo load simulation, direct delivery candidate analytics, multi-wave batch picking, and shipping intelligence. Zero build tools, 100% client-side privacy.*

---

## 📖 About The System

**DO Insight System (v5)** is a modern, privacy-first web application designed for supply chain coordinators, warehouse leads, and transport planners. It streamlines the entire delivery lifecycle—from raw daily spreadsheet ingestion and multi-wave batch picking analytics to 3D truck cargo container packing and shipping SLA monitoring.

Engineered with pure **HTML5, modern CSS3, and vanilla JavaScript (ES6 Modules)**, the system requires **zero build steps** and **zero external servers for core data operations**. Every spreadsheet parse, 3D calculation, and analytical visualization executes directly inside the user's browser, ensuring sensitive supply chain data never leaves the local machine.

---

## 🌟 Key Highlights & Capabilities

- **🚀 100% Client-Side Privacy**: Parse `.xlsx`, `.xlsm`, and `.csv` files directly in your browser using **SheetJS** and custom streaming parsers. Sensitive supply chain data never leaves your workstation.
- **🛡️ Pre-Flight Upload Safeguard**: Automated schema detection checks whether an uploaded spreadsheet matches the expected format (e.g. distinguishing DO Summary tabs from Batch Picking logs) and prompts an intelligent swap modal before modifying data.
- **📊 Direct Delivery Candidates (> 5 m³)**: Vertical grouped dual-bar visualization powered by **Chart.js** with independent dual Y-axes, comparing cubic volume ($m^3$) against DO count with modern Shadcn aesthetic tokens.
- **🚛 Interactive 3D Cargo Load Planners**: Real-time 3D truck cargo bay and mixed-carton visualization powered by **Three.js (WebGL)** with orbit controls, collision detection, layer slicing, dimension bounds, and loading sequence guidance.
- **🎨 13 Switchable UI Themes**: Live theme engine (Linear, Terminal, Cyberpunk, AMOLED, Premium, Bitcoin, Bauhaus, Retro, Dopamine, Light, and more) with automatic **Chart.js** palette reskinning and persistent `localStorage` settings.
- **🔍 Real-Time KPI Recalculation**: Live metric aggregation (Total DOs, Quantity, Volume m³, Gross Weight kg, Pallet Equivalents) reacting instantaneously to multi-column filters, search queries, and status toggles.
- **⚡ Quick Actions & Remarks Engine**: 1-click batch status tagging (`SELF COLLECT`, `HOLD`, `LOCAL DELIVERY`, `DIRECT DELIVERY`, `URGENT`, `CANCELLED`) with instant visual feedback and audit log preservation.
- **📑 Formatted Multi-Sheet Excel Exports**: Generates styled spreadsheets with customized headers, cell alignments, auto-fit column widths, freeze panes, and aggregate summary rows via `xlsx-js-style` and ExcelJS.
- **📱 PWA & Offline Support**: Built-in Service Worker caching (`sw.js` v86) and Web App Manifest (`manifest.json`) enabling installability on desktop or mobile and offline operation.
- **🧩 Shadcn-Inspired Design Tokens**: Clean, minimalist UI design system with unified buttons (`.btn-primary`, `.action-btn`, size variants `.sm`, `.xs`, `.lg`), standardized alert dialogs, and consistent typography.

---

## 📂 Modules & Feature Breakdown

The platform consists of **14 dedicated modules**, each engineered for specific logistics workflows:

### 1. 📊 Summary Analytics (`index.html`)
Central command center for delivery performance, carrier distribution, and daily dispatch tracking.
- **Features**:
  - Drag-and-drop or styled button upload for daily DO tracking spreadsheets (`.xlsx`, `.csv`) with smart file chip badge and date indicator sync.
  - **Pre-Flight File Safeguards**: Instant schema verification distinguishing DO Summary logs from Batch files, prompting auto-redirection when files are misplaced.
  - High-level KPI indicators: Total Orders, Delivered, Pending, In-Transit, and Exception rates with real-time recalculation.
  - **Direct Delivery Candidates (> 5 m³)**: Grouped dual-bar visualization comparing volume ($m^3$) and DO count across high-volume consignees with dual Y-axes, Shadcn pill caps, and threshold filtering.
  - Carrier breakdown charts, top consignee volume rankings, and regional routes.
  - Quick-filter bar for instant slice-and-dice of active delivery records.

### 2. 📝 DO Summary Generator (`do_summary_generator.html`)
Heavy-duty data cleaning, annotation, and formatted manifest generation engine.
- **Features**:
  - Spreadsheet-style table view with custom AutoFilter popup menus per column header (text search, multi-checkbox filtering, value sorting).
  - **Quick Remarks Side Panel**: 1-click bulk assignment of status tags across selected orders.
  - **Missing Info Updater**: Non-destructive secondary file merge to backfill missing consignee addresses, contact numbers, or vehicle types.
  - In-place cell editing, custom row additions, and export to styled Excel workbooks with formula summaries.

### 3. 🚚 Truck Planning & Daily Manifest (`truck_planning.html`)
Vehicle allocation and daily trip manifest builder for warehouse dispatch coordinators.
- **Features**:
  - Configurable truck profiles (1-Ton, 3-Ton, 5-Ton, 40ft Container) with maximum payload weight (kg) and volume (m³) thresholds.
  - Dynamic capacity gauges warning of overload or sub-optimal utilization before dispatch.
  - Multi-trip / multi-wave planning tabs with live load balancing.
  - Formatted driver trip sheet generation and print-ready manifests.

### 4. 🚛 Manual Truck Planning (`manual_truck_planning.html`)
Hands-on load allocation workspace for picking-list-driven vehicle composition.
- **Features**:
  - Dual-pane drag-and-drop or click-to-assign DO items into designated trucks.
  - Real-time aggregate tallies for item count, gross weight, and volume per planned truck.
  - Source item unassigned queue with quick search and customer grouping.

### 5. 📦 Bulk Volume & Capacity Planner (`volume_capacity_planner.html`)
Mathematical packing calculations and interactive 3D container simulation.
- **Features**:
  - Full 3D cargo bay rendering with 360° orbit, zoom, and pan controls via Three.js.
  - Pallet stack calculations with layer verification and max-height constraints.
  - Space utilization efficiency metrics, volumetric weight calculations, and visual center-of-gravity indicators.

### 6. 🎯 DO Load Planner (`do_load_planner.html`)
Order-centric load planning mapping specific delivery orders into pallet slots and truck zones.
- **Features**:
  - Line-item order ingestion with automatic cubic meter (m³) computation from raw box dimensions.
  - Split-shipment management for oversized DOs spanning multiple trucks.
  - Interactive pallet bay grid showing exact placement sequence for loading dock crews.

### 7. 📦 Loose Load Planner (`loose_load_planner.html`)
Non-palletized carton packing simulation for complex, mixed-dimension consignments.
- **Features**:
  - 3D container packing simulator for loose boxes of irregular dimensions.
  - Color-coded carton groups by SKU, customer, or destination drop.
  - Step-by-step loading guide illustrating back-to-front and bottom-to-top packing sequence.
  - Orientation rules enforcement (e.g., "This Side Up" vertical constraints).

### 8. 🔎 DO Details Inspector (`do_details.html`)
Deep-dive inquiry tool for inspecting single delivery orders and line-item lifecycles.
- **Features**:
  - Rapid search by DO Number, Customer Name, Invoice Number, or Tracking ID.
  - Complete line-item breakdown table displaying SKUs, descriptions, quantities, weights, and unit volumes.
  - Printable single-order summary sheets with barcode representation.

### 9. 📈 Shipping Insight (`shipping_insight.html`)
Historical delivery performance, carrier SLA compliance, and transit time analytics.
- **Features**:
  - Carrier volume distribution, transit duration averages, and on-time delivery (OTD) rates.
  - Cost per cubic meter and cost per delivery order analytics.
  - Regional route density analysis and destination heatmaps.

### 10. 🏭 Batch Picking Analytics (`batch_analytics.html`)
Warehouse picking efficiency, wave release tracking, and operational velocity analytics.
- **Features**:
  - Ingestion of warehouse picking logs (`.xlsm` / `.xlsx`).
  - Picker productivity tracking, SKU velocity heatmaps, and batch completion timelines.
  - Bottleneck diagnosis across warehouse zones and picking bins.

### 11. 📉 DO Activity Trend (`do_activity_trend.html`)
Time-series activity tracking comparing daily, weekly, and monthly delivery order volumes.
- **Features**:
  - Interactive multi-metric timeline charts (Order Count vs. Volume m³ vs. Weight kg).
  - Day-of-week and peak-hour distribution heatmaps.
  - Moving averages and trend forecasting for logistics capacity planning.

### 12. 🏆 Challenger List (`challenger_list.html`)
Dedicated extraction and manifest generator for **Challenger** consignee delivery orders from SONY outbound route logs.
- **Features**:
  - Automated scanning of `SONY - ROUTE OUTBOUND` files (`.xlsx`, `.csv`) to filter and extract all DO line items destined for **Challenger** consignee branches.
  - Extracts key operational fields: Sequence No (`Seq`), Consignee Name (`Consignee`), Item Code (`Item`), Item Description (`Item Desc`), and Quantity (`Ship_Qua`).
  - Multi-file batch upload support with automatic aggregation and real-time total quantity and DO counters.
  - Formatted Excel export (`.xlsx`) via `xlsx-js-style` preserving headers and table layouts for delivery dispatch teams.

### 13. 📋 Packing List (`packing_sheet.html`)
Comprehensive packing details sheet embedding a dedicated React-based packing management engine.
- **Features**:
  - Packing sheet form with master SKU lookup and quick import modals.
  - Case/carton numbering, tare/gross weight calculation, and dimension validation.
  - Two-way Excel import and export with strict template schema verification.

### 14. 🔠 OCR Document Scanner (`ocr_scanner.html`)
Browser-based document data extraction for scanned delivery order PDFs and images.
- **Features**:
  - Client-side OCR parsing of scanned DO documents and multi-page manifests.
  - Automatic pattern extraction for DO numbers, customer names, dates, and item lines.
  - Export of extracted records directly to CSV or Excel for downstream planning.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies | Purpose |
|---|---|---|
| **Core Frontend** | Pure HTML5, Vanilla JavaScript (ES6 Modules), CSS3 Variables | Maximum performance, zero bundlers, instant loading |
| **Styling & Design** | Custom CSS3 Design System (Shadcn-inspired tokens, CSS Flexbox/Grid) | Consistent typography, unified buttons, responsive cards |
| **Spreadsheet Engine** | [SheetJS (xlsx)](https://sheetjs.com/), `xlsx-js-style`, ExcelJS | Browser-based parsing, formatting, and multi-sheet exports |
| **Data Visualization** | [Chart.js](https://www.chartjs.org/) + `chartjs-plugin-datalabels` | Reactive, theme-aware analytical charts and distribution graphs |
| **3D Rendering Engine**| [Three.js (r128)](https://threejs.org/) with OrbitControls & WebGL | Interactive 3D truck cargo bays, pallet grids, and box packing |
| **Subsystems** | React 18 (Vendored, production build) in `packing-sheet/` | Embedded complex packing list management |
| **App Shell & PWA** | `manifest.json`, Service Worker (`sw.js` v86) | Offline caching, home-screen installation, fast reloads |
| **Web Server (Optional)**| Node.js + [Express](https://expressjs.com/) (`server.js`) | Optional local file server and static asset hosting |

---

## 🚀 Quick Start Guide

### Prerequisites
- Modern web browser (Chrome, Edge, Firefox, Safari)
- Optional: [Node.js](https://nodejs.org/) (v16+) or Python (v3+)

### Option A: Node.js Server (Recommended)
```bash
# 1. Clone the repository
git clone https://github.com/topjohnnywu/do-insight-system-v5.git
cd do-insight-system-v5

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```
Open your browser and navigate to:
```text
http://localhost:3000
```

### Option B: Zero-Dependency Static Server
Because all core processing runs client-side in the browser, you can host the project with any static web server:

- **Python 3**:
  ```bash
  python -m http.server 8000
  # Open http://localhost:8000
  ```
- **VS Code Live Server**: Right-click `index.html` and select **Open with Live Server**.
- **Direct File Access**: Double-click `index.html` to open directly in any modern browser.

---

## 🎨 Theme Engine & Customization

Click the **Palette / Settings** icon in the sidebar or navigation header on any page to open the universal settings modal:
- **13 Switchable Themes**:
  - *Linear* (Default sleek corporate dark)
  - *Terminal* (Monochrome green monospace hacker aesthetic)
  - *Cyberpunk* (Vibrant neon cyan & magenta)
  - *AMOLED* (Pure high-contrast true black)
  - *Premium* (Ultra-dark slate and cyan accents)
  - *Light*, *Organic*, *Retro*, *Dopamine*, *Bitcoin*, *Bauhaus*, *Mono*, and *GitHub*
- **Theme Sync Engine**: Dynamically updates CSS custom properties (`--bg-color`, `--card-bg`, `--text-primary`, `--accent`, etc.) and automatically recolors all active Chart.js instances without reloading the page.
- **Universal Font Selector**: Choose between *Inter*, *Roboto*, *Fira Code*, *JetBrains Mono*, or *System Default*.
- **Interface Zoom**: Scale the UI between 80% and 130% for high-DPI displays or laptop screens.

---

## 📁 Repository Structure

```
do-insight-system-v5/
├── server.js                      # Express static file server (port 3000)
├── package.json                   # Project metadata & dependencies
├── package-lock.json              # Locked dependency tree
├── manifest.json                  # PWA web app manifest
├── sw.js                          # Service Worker cache controller (v86)
├── metadata.json                  # Application metadata
├── README.md                      # Comprehensive system documentation
│
├── index.html                     # 1. Summary Analytics Dashboard
├── do_summary_generator.html      # 2. DO Summary Generator
├── truck_planning.html            # 3. Truck Planning & Manifest
├── manual_truck_planning.html     # 4. Manual Truck Planning
├── volume_capacity_planner.html   # 5. Bulk Volume & Capacity Planner (3D)
├── do_load_planner.html           # 6. DO Load Planner
├── loose_load_planner.html        # 7. Loose Load Planner (3D)
├── do_details.html                # 8. DO Details Inspector
├── shipping_insight.html          # 9. Shipping Insight Analytics
├── batch_analytics.html           # 10. Batch Picking Analytics
├── do_activity_trend.html         # 11. DO Activity Trend
├── challenger_list.html           # 12. Challenger List Generator (SONY Outbound)
├── packing_sheet.html             # 13. Packing List (React wrapper)
├── ocr_scanner.html               # 14. OCR Document Scanner
│
├── extract_do_numbers.py          # CLI utility: extract DO numbers from PDF/images
│
├── css/
│   └── styles.css                 # Unified stylesheet, design tokens & theme variables
│
├── icons/
│   └── icon.svg                   # Vector application icon
│
├── js/
│   ├── app.js                     # Main application initialization & utilities
│   ├── charts.js                  # Chart.js engine & theme synchronization palettes
│   ├── parsers.js                 # Shared Excel/CSV file parsing pipelines
│   ├── settings.js                # Universal theme, font, zoom & shadcn dialog engine
│   ├── batch_analytics.js         # Logic: Batch picking analytics
│   ├── batch_charts.js            # Visualizations: Batch wave performance
│   ├── challenger_list.js         # Logic: Challenger consignee DO extraction & export
│   ├── do_activity_trend.js       # Logic: Time-series activity trend analysis
│   ├── do_load_planner.js         # Logic: DO pallet allocation planner
│   ├── do_summary_generator.js    # Logic: Summary generator, filters & quick remarks
│   ├── loose_load_planner.js      # Logic: 3D loose box packing simulation
│   ├── manual_truck_planning.js   # Logic: Manual vehicle trip composition
│   ├── mtp_source_upload.js       # Logic: Source data ingestion for manual planning
│   ├── truck_planning.js          # Logic: Automated truck payload planning
│   ├── volume_capacity_planner.js # Logic: 3D truck container simulation
│   └── xlsx.bundle.js             # Client-side Excel parsing & styling bundle
│
├── packing-sheet/                 # Embedded React packing list application
│   ├── index.html
│   ├── css/main.css
│   └── js/
│       ├── App.js                 # Root React component
│       ├── components/            # Modal & form UI components
│       ├── utils/                 # Excel import/export helpers
│       └── vendor/                # Vendored React, Tailwind, ExcelJS, SheetJS
│
└── arkib/                         # Historical reference and archived scripts
```

---

## 🔒 Security & Data Privacy

- **Zero Cloud Uploads**: All data processing is performed directly in client memory via browser JavaScript APIs and Web Workers.
- **No Third-Party Tracking**: The system makes no telemetry calls, analytical tracking requests, or external database queries with your operational data.
- **Enterprise Compliant**: Suitable for environments with strict NDA, GDPR, and data residency requirements.

---

## 🆕 Recent Features & Changelog

### 1. Shadcn-Inspired Dialog System Unification
- **Standardized Alert Dialog Tokens**: Replaced ad-hoc confirmation prompts and legacy emoji headers (`⚠️`, `✏️`, `✕`) with a cohesive, professional shadcn-inspired dialog architecture in `js/settings.js`.
- **Global API (`window.showConfirmDialog` & `window.showPromptDialog`)**:
  - Modal backdrops with smooth blur transitions (`.alert-dialog-overlay`).
  - Structured card containers (`.alert-dialog-content`), headers (`.alert-dialog-title`, `.alert-dialog-description`), and standard action buttons (`.action-btn.outline`, `.action-btn.danger`, `.btn-primary`).
  - Seamlessly updated across operational modules including **Challenger List** (clearing and deleting records), **DO Activity Trend** (data resets), **Loose Load Planner** (plan clearing), and **MTP Source Upload** (bulk clear operations).

### 2. Unified Custom Upload Button Design System
- **Eliminated Native Browser File Inputs**: Replaced default browser "Choose File" / "Choose Files" grey rectangular buttons with sleek shadcn-style action buttons across:
  - `index.html` (Summary Analytics upload card)
  - `challenger_list.html` (Challenger file ingestion)
  - `do_activity_trend.html` (Activity trend file ingestion)
  - `shipping_insight.html` (Shipping dataset upload)
- **Standardized Tokens**: Implemented `.btn-primary.sm` with embedded vector icons, hidden native file inputs, keyboard accessibility, and dynamic filename badges displaying selected file names or upload status.

### 3. Layout Optimization in Summary Analytics (`index.html`)
- **Card Removal**: Removed the legacy and unused "DO Remarks Overview" card from the Summary Analytics dashboard.
- **Expanded Responsive Viewports**: Expanded the Direct Delivery analytical chart container to take full advantage of screen real estate, improving readability and data density across wide monitors and laptops.

### 4. AutoFilter Menu Floating Position Fix (`do_summary_generator.html`)
- **Containing Block Decoupling**: Fixed a critical positioning bug where clicking column filter triggers (`#dsgExcelFilterMenu`) caused the menu to appear far to the right or off-screen.
- **Direct Body Attachment**: Relocated the filter popup DOM node out of animated container cards (`.compact-wrapper`, `.table-card`) whose CSS `transform` animations created a shifted coordinate system. Attached directly to `document.body` with fixed viewport positioning, dynamic boundary clamping, and auto-dismissal on window scroll or escape key.

### 5. Progressive Web App (PWA) Cache Upgrade
- **Cache Increment**: Incremented Service Worker cache key to `planner-cache-v45` in `sw.js`.
- **Clean Invalidation**: Guarantees that clients instantly fetch the latest HTML structure, styles, and dialog scripts without manual hard-refreshing.

### 6. Shadcn Avatar & Dynamic User Profile System
- **Universal Top Bar Avatar**: Integrated an active user profile widget next to the theme switcher in the global header across all 14 pages.
- **Dynamic Profile & Role Switching**:
  - Configurable display name with real-time update and persistence via `localStorage`.
  - Role switcher with presets (*Administrator*, *Logistics Planner*, *Senior Dispatcher*, *Warehouse Lead*, *Operations Manager*) plus custom role input.
  - Active online status badge with pulsing green glow (`.status-online`).
- **Flexible Photo & Fallback Engine**:
  - Supports uploading local image files directly from the computer (auto-converted to base64 Data URLs).
  - Supports relative/local URL folder paths (e.g. `./icons/avatar.png`).
  - Graceful fallback initials (`AvatarFallback`) when no image is loaded (e.g., `AD` for Administrator).
- **Shadcn Design Tokens**: Full CSS support for `.shadcn-avatar` (sizes `.sm`, `.md`, `.lg`), `.shadcn-avatar-badge`, `.shadcn-avatar-group`, and `.shadcn-avatar-group-count`.

### 7. Direct Delivery Candidates (> 5 m³) Chart Upgrade
- **Dual-Metric Grouped Bar Chart**: Upgraded the high-volume consignee visualization in `index.html` to a vertical grouped bar chart comparing Volume ($m^3$) and DO Count side-by-side.
- **Independent Dual Y-Axes**: Left axis measures Volume ($m^3$) with primary brand color `#2563eb`; right axis measures DO Count with secondary accent `#60a5fa`, with independent gridline separation.
- **Shadcn Modern Aesthetics**: Enhanced bar elements with 4px pill top-border radii, custom interactive tooltips with badge indicators, and dynamic responsive height.

### 8. Pre-Flight File Ingestion Safeguards & Smart Date Sync
- **Intelligent Slot Detection**: Pre-flight inspection in `js/parsers.js` inspects workbook sheet structures (e.g. differentiating DO Summary sheets from "Batch 01" / "Insert Batch" tabs) to catch accidental mismatches before parsing.
- **Auto-Redirect Modal**: Triggers a non-destructive alert dialog offering to automatically redirect wrongly slotted spreadsheets to their intended module.
- **Smart File Date Synchronization**: Uploaded file date chips seamlessly synchronize with dashboard date filters and persist active session state.

### 9. Shipping Insight High-Density Layout Redesign
- **Slim Modern Shadcn KPI Cards**: Streamlined top statistics into 4 compact, high-density metric cards (~94px) with subtle tinted icon badges, crisp numbers, and integrated DO category subtitles, eliminating bulky empty card spaces.
- **Consolidated Progress Split Grid**: Replaced 4 massive donut gauge cards with a sleek two-column progress panel:
  - *Left*: Refined semi-circular Overall Completion meter with live percentage readout and scanned ratio.
  - *Right*: Category Progress Breakdown featuring horizontal animated progress bars for **BIG DO**, **SMALL DO**, and **MIX DO**, complete with counts and pending status badges.
- **Immediate Table Visibility**: Reclaimed over 300px of vertical viewport height, bringing the Detailed Status Manifest table directly above the fold on desktop and laptop displays.

---

## 📄 License

Internal Enterprise Tool — All rights reserved.
