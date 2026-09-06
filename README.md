# 📦 DO Insight System

A high-performance, multi-page web analytics platform and logistics planning tool designed for **Delivery Order (DO) management, truck load planning, batch analytics, volume calculation, and shipping insights**.

Built with pure **HTML5, modern CSS3, and vanilla JavaScript (ES6+)** — zero framework overhead, no build steps required, and runs 100% client-side with an optional Node.js Express server.

---

## 🌟 Key Highlights & Capabilities

- **🚀 100% Client-Side Processing**: Parse `.xlsx`, `.xlsm`, and `.csv` files entirely in your browser using **SheetJS** without uploading sensitive company data to external servers.
- **🚛 Interactive 3D Load Planners**: Real-time 3D truck and container cargo visualization powered by **Three.js (WebGL)** with orbit controls, dimension bounding, collision detection, and layer inspection.
- **🎨 13 Switchable UI Themes**: Live theme engine (Linear, Terminal, Cyberpunk, AMOLED, Bitcoin, Bauhaus, Retro, Dopamine, Premium, and more) with automatic Chart.js reskinning and persistent preferences (`localStorage`).
- **🔍 Real-Time KPI Recalculation**: Instant metric updates (Total DOs, Quantity, Volume m³, Gross Weight, Pallet Count) matching active search/filter queries.
- **⚡ Quick Actions & Remarks System**: Single-click bulk status assignment (`SELF COLLECT`, `HOLD`, `LOCAL DELIVERY`, `DIRECT DELIVERY`, `URGENT`, `CANCELLED`) and custom inline annotations.
- **📑 Multi-Format Exporting**: Export styled spreadsheets with formatted headers, auto-fit columns, summary rows, or download high-resolution chart snapshots.

---

## 📂 Modules & Feature Breakdown

### 1. 📊 Summary Analytics (`index.html`)
The main central command center for overall delivery performance and tracking.
- **Features**:
  - Drag-and-drop Excel/CSV file upload.
  - High-level KPIs: Total Orders, Delivered, Pending, In-Transit, and Exception counts.
  - Remarks breakdown charts, top consignee volume analysis, and route distributions.
- **How to Use**:
  1. Open the page or navigate to **Summary Analytics**.
  2. Drag and drop your daily DO tracking Excel file into the upload zone.
  3. Inspect the KPI cards and chart breakdowns. Use the filter controls to isolate specific statuses or routes.

---

### 2. 📝 DO Summary Generator (`do_summary_generator.html`)
Comprehensive tool for compiling, cleaning, annotating, and generating clean DO manifests.
- **Features**:
  - Dynamic KPI cards that adapt live to active search queries and column filters.
  - **Quick Remarks Side Panel**: 1-click batch assignment of status tags.
  - **Missing Info Updater**: Import secondary Excel/CSV files to patch missing addresses or routes without overwriting existing data.
  - Inline table editing, custom row insertions, and styled Excel exports.
- **How to Use**:
  1. Upload your primary DO summary file.
  2. Use the search bar to filter orders by customer, route, or DO number.
  3. Select rows using checkboxes and click any quick remark button in the right panel to tag them in bulk.
  4. Click **Export Formatted Excel** to download the clean report.

---

### 3. 🚚 Truck Planning & Daily Manifest (`truck_planning.html`)
Plan vehicle allocations, driver schedules, and trip manifests for the day.
- **Features**:
  - Vehicle capacity threshold indicators (weight kg and volume m³ tracking per truck).
  - Multi-tab management for planning different waves, shifts, or batches.
  - In-table manifest editor with live sum calculations and overload warnings.
- **How to Use**:
  1. Select or input truck specifications (e.g., 1-Ton, 3-Ton, 40ft Container).
  2. Assign DO records or pallets to specific trucks.
  3. Monitor the capacity meter to prevent exceeding maximum payload limits.
  4. Export the finalized truck manifest for drivers and warehouse dispatchers.

---

### 4. 📦 Volume & Capacity Planner (`volume_capacity_planner.html`)
Optimize bulk cargo space utilization with mathematical packing and 3D simulation.
- **Features**:
  - Interactive 3D truck cargo bay rendering with 360° orbit and zoom controls.
  - Multi-layer pallet stacking calculations and automatic dimension verification.
  - Overhang and space utilization efficiency percentages.
- **How to Use**:
  1. Configure truck body dimensions (Length, Width, Height) or select a preset.
  2. Input pallet/cargo quantities and dimensions.
  3. Click **Calculate & Simulate** to render the 3D packing layout.
  4. Rotate the camera to inspect gaps, layer distribution, and weight balance.

---

### 5. 🎯 DO Load Planner (`do_load_planner.html`)
Order-centric load planning tool mapping individual delivery orders into specific pallet spaces.
- **Features**:
  - Direct import of DO item lists with automatic volume (m³) calculation.
  - Split load handling for large DOs exceeding single truck capacity.
  - Interactive pallet grid showing exact order positions within the truck.
- **How to Use**:
  1. Upload the DO item list.
  2. Assign DOs into available pallet slots or auto-generate the optimal load sequence.
  3. Review the load summary report and export the loading sequence sheet for dock workers.

---

### 6. 📦 Loose Load Planner (`loose_load_planner.html`)
Designed for non-palletized, loose carton packing and complex mixed-dimension boxes.
- **Features**:
  - Mixed-item 3D box packing algorithms.
  - Color-coded carton groups by SKU or destination.
  - Step-by-step loading guide showing which items to place first (back-to-front, bottom-to-top).
- **How to Use**:
  1. Upload carton dimensions and quantities.
  2. Set vehicle dimensions and orientation constraints (e.g., "This Side Up").
  3. Generate the 3D loose packing preview and inspect placement order.

---

### 7. 🔎 DO Details Inspector (`do_details.html`)
Deep-dive inquiry into individual DO lifecycles and line-item details.
- **Features**:
  - Instant search by DO number, Customer Name, or Invoice ID.
  - Line-item breakdown table displaying SKUs, descriptions, quantities, weights, and unit volumes.
  - Printable single-order summary view.
- **How to Use**:
  1. Search for a DO number in the lookup field.
  2. View complete order metadata, status history, and itemized lines.

---

### 8. 📈 Shipping Insight (`shipping_insight.html`)
Analyze historical shipping trends, carrier SLA performance, and regional delivery metrics.
- **Features**:
  - Carrier volume distribution and delivery turnaround time charts.
  - On-time delivery (OTD) rate calculation.
  - Cost per cubic meter / cost per delivery order analytics.
- **How to Use**:
  1. Import historical shipping dataset.
  2. Filter by date range, carrier, or destination region.
  3. Review analytical charts and export summary insights.

---

### 9. 🏭 Batch Analytics (`batch_analytics.html`)
Warehouse picking efficiency and batch wave performance analytics.
- **Features**:
  - Wave pick analysis from `.xlsm` picking logs.
  - Picker productivity tracking, SKU velocity heatmaps, and batch completion timelines.
- **How to Use**:
  1. Upload the warehouse batch picking file (`.xlsm` / `.xlsx`).
  2. Inspect pick rates, bottleneck analysis, and wave completion statuses.

---

### 10. 📉 DO Activity Trend (`do_activity_trend.html`)
Time-series activity tracking comparing daily, weekly, and monthly DO volumes.
- **Features**:
  - Interactive timeline charts with multi-metric toggles (Order count vs. Volume vs. Weight).
  - Day-of-week and peak-hour heatmaps.
- **How to Use**:
  1. Upload date-stamped DO activity records.
  2. Toggle chart views to analyze volume spikes and recurring peak patterns.

---

### 11. 🏆 Challenger List (`challenger_list.html`)
Specialized tracking for high-priority, delayed, or problematic delivery orders requiring escalated intervention.
- **Features**:
  - Priority scoring based on aging days, customer tier, and delivery exceptions.
  - Filterable action list for operations and customer service teams.
- **How to Use**:
  1. Load current open orders.
  2. Filter by aging status or exception category to identify critical orders.
  3. Add follow-up remarks and export the action list.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Core**: Pure HTML5, Vanilla JavaScript (ES6 Modules), CSS3 Variables & Flex/Grid
- **Excel & Data Engine**: [SheetJS (xlsx)](https://sheetjs.com/), `xlsx-js-style`
- **Visualization & Charts**: [Chart.js](https://www.chartjs.org/) + `chartjs-plugin-datalabels`
- **3D Graphics Engine**: [Three.js (r128)](https://threejs.org/) with OrbitControls & WebGL
- **Backend (Optional Server)**: Node.js + [Express](https://expressjs.com/) (`server.js`)
- **Storage**: Client-side `localStorage` for theme, font preferences, and app configurations

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)

### 1. Installation & Running Locally
```bash
# 1. Clone or copy the project to your computer
cd remix-do-status-hub-

# 2. Install dependencies (Express server)
npm install

# 3. Start the server
npm start
```

### 2. Access the Application
Open your browser and navigate to:
```text
http://localhost:3000
```

> **Alternative (Zero-Dependency Option)**: You can also run the app using any static server:
> - **Python**: `python -m http.server 8000` (then open `http://localhost:8000`)
> - **VS Code**: Use the *Live Server* extension.
> - **Direct File**: Open `index.html` directly in any modern browser.

---

## 🎨 Theme Customization & Settings

Click the **Palette / Settings** icon in the sidebar or top navigation on any page to customize your experience:
- **Themes (13 variants)**:
  - *Linear* (Default sleek dark)
  - *Terminal* (Green monospace hacker style)
  - *Cyberpunk* (Neon cyan & purple)
  - *AMOLED* (True high-contrast black)
  - *Premium* (Ultra-dark corporate teal)
  - *Light / Organic / Retro / Dopamine / Bitcoin / Bauhaus / Mono / GitHub*
- **Universal Font Selector**: Choose between *Inter*, *Roboto*, *Fira Code*, *JetBrains Mono*, *System Default*, etc.
- **Interface Zoom**: Scale the UI between 80% and 130% for different screen resolutions and laptop displays.

---

## 📁 Repository Structure

```
├── server.js                    # Express static file server (port 3000)
├── package.json                 # Node dependencies & run scripts
├── README.md                    # Project documentation
│
├── index.html                   # 1. Summary Analytics Dashboard
├── do_summary_generator.html    # 2. DO Summary Generator
├── truck_planning.html          # 3. Truck Planning & Manifest
├── volume_capacity_planner.html # 4. Bulk Volume & Capacity Planner (3D)
├── do_load_planner.html         # 5. DO Load Planner
├── loose_load_planner.html      # 6. Loose Load Planner (3D)
├── do_details.html              # 7. DO Details Inspector
├── shipping_insight.html        # 8. Shipping Insight Analytics
├── batch_analytics.html         # 9. Batch Picking Analytics
├── do_activity_trend.html       # 10. DO Activity Trend
├── challenger_list.html         # 11. Challenger Exception Tracker
│
├── css/
│   └── styles.css               # Unified stylesheet & CSS theme variables
│
└── js/
    ├── app.js                   # Main application initialization & helpers
    ├── charts.js                # Chart.js engine & theme sync palettes
    ├── parsers.js               # Shared Excel/CSV parsing logic
    ├── settings.js              # Universal theme, font & zoom controller
    ├── batch_analytics.js       # Module script: Batch analytics
    ├── batch_charts.js          # Module script: Batch picking charts
    ├── challenger_list.js       # Module script: Challenger tracking
    ├── do_activity_trend.js     # Module script: Activity trend charts
    ├── do_load_planner.js       # Module script: DO pallet planner
    ├── do_summary_generator.js  # Module script: Summary generator & quick remarks
    ├── loose_load_planner.js    # Module script: Loose cargo 3D planner
    ├── truck_planning.js        # Module script: Truck manifest planner
    ├── volume_capacity_planner.js # Module script: 3D Truck volume simulator
    └── xlsx.bundle.js           # Client-side Excel engine bundle
```

---

## 🔒 Privacy & Security

- All data uploaded through Excel/CSV files is parsed **locally in your browser session**.
- No business records, customer information, or delivery orders are sent to external cloud APIs or third-party storage.

---

## 📄 License

Internal Enterprise Tool — All rights reserved.
