# ✈️ Aviation Dashboard — Real-Time Flight Operations Frontend

A high-performance, real-time aviation operations dashboard built with **React 19**, **TypeScript**, and **Vite**. Features live flight tracking on an interactive map, turnaround management, fuel & cost analytics, and geofence alerting — all powered by WebSocket and REST APIs.

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)

---

## 🚀 Features

| Module | Description |
|---|---|
| **Live Map** | Real-time flight positions on Leaflet with rotated aircraft markers, `preferCanvas` for 1000+ flights |
| **Flight Intelligence** | Sidebar with per-flight cards showing altitude, speed, heading, progress, and financial insights |
| **Flights Table** | Virtualized (react-window) sortable/searchable table for large datasets |
| **Turnaround Management** | Gantt-timeline modal for ground turnaround tasks (refueling, cleaning, catering, baggage) with delay prediction |
| **Turnarounds Page** | Full-page view of all active turnarounds with progress tracking |
| **Fuel & Cost Analytics** | Paginated analytics dashboard with aggregate summary cards and per-flight cost/CO₂/fuel breakdown |
| **Alerts System** | Real-time geofence alerts via WebSocket with toast notifications and a full alerts table |
| **Financial Insights** | Per-flight live ticker showing fuel burn, CO₂ emissions, dollar cost, and CDFA sustainability badge |
| **METAR Weather** | Live METAR data displayed in the bottom stats bar |

## 🏗️ Tech Stack

- **Framework:** React 19.2 + TypeScript 5.9
- **Build Tool:** Vite 6.4
- **Styling:** Tailwind CSS 3.4 with custom aviation theme (`aviation-blue`, `aviation-amber`)
- **Animations:** Framer Motion 12.4
- **Maps:** Leaflet + React-Leaflet with `leaflet-rotatedmarker`
- **Virtualization:** react-window 2.x for large lists
- **Icons:** Lucide React
- **Font:** JetBrains Mono (monospace)

## 📁 Project Structure

```
src/
├── config.ts                  # Centralised env-based configuration
├── Dashboard.tsx              # Main layout — sidebar + content area
├── App.tsx / main.tsx         # App entry point
├── components/
│   ├── LiveMap.tsx            # Map wrapper with Suspense
│   ├── MapContent.tsx         # Leaflet MapContainer + markers
│   ├── FlightIntelligence.tsx # Right sidebar — flight card list
│   ├── FlightCard.tsx         # Individual flight card
│   ├── FinancialInsights.tsx  # Per-flight financial widget
│   ├── FlightsTable.tsx       # Virtualized flights table
│   ├── AlertsTable.tsx        # Virtualized alerts table
│   ├── AlertToast.tsx         # Real-time alert toast
│   ├── TurnaroundDashboard.tsx# Turnaround modal with Gantt
│   ├── TurnaroundsPage.tsx    # Full turnarounds page
│   ├── FuelAnalyticsPage.tsx  # Fuel & cost analytics page
│   ├── Sidebar.tsx            # Left navigation sidebar
│   ├── NavigationHeader.tsx   # Top header bar
│   ├── BottomStatsBar.tsx     # Bottom stats (flights, alerts, METAR)
│   └── UTCClock.tsx           # Live UTC clock
├── hooks/
│   ├── useFlightData.ts       # WebSocket flight data (2s throttle)
│   ├── useAlerts.ts           # REST + WS alerts
│   ├── useMetar.ts            # METAR polling
│   ├── useTurnaround.ts       # Turnaround state machine + API
│   ├── useTurnaroundAPI.ts    # Low-level turnaround API hook
│   ├── useFuelAnalyticsAPI.ts # On-demand analytics (detail + paginated)
│   ├── useFuelSummary.ts      # Lightweight summary polling (60s)
│   ├── useFinancialData.ts    # Per-flight financial ticker
│   ├── useFlightAPI.ts        # REST flight polling (fallback)
│   └── useInterval.ts         # Declarative setInterval hook
├── types/
│   ├── flight.ts              # Flight, Alert, METAR, Analytics types
│   └── turnaround.ts          # Turnaround state & API types
└── data/
    └── mockFlights.ts         # Mock flight data (Asia region)
```

## ⚡ Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (or yarn / pnpm)
- **Backend API** running (see [Backend Repo](#) for setup)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/aviation-dashboard.git
cd aviation-dashboard/aviation-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_FLIGHTS_URL=ws://localhost:8000/ws/flights
VITE_WS_ALERTS_URL=ws://localhost:8000/ws/alerts
VITE_DEFAULT_METAR_ICAO=VCBI
```

### 4. Start development server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

### 5. Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

## 🔌 Backend API Endpoints

The frontend connects to the following backend endpoints (configurable via `.env`):

| Endpoint | Method | Description |
|---|---|---|
| `/ws/flights` | WebSocket | Real-time flight position updates |
| `/ws/alerts` | WebSocket | Real-time geofence alert stream |
| `/api/flights` | GET | REST fallback for flight data |
| `/api/alerts` | GET | Historical alert list |
| `/api/metar/{icao}` | GET | METAR weather data |
| `/api/turnaround/{flight_id}` | GET | Turnaround state for a flight |
| `/api/turnaround/{flight_id}/update` | POST | Update turnaround task status |
| `/api/turnarounds` | GET | All active turnarounds |
| `/api/analytics/summary` | GET | Aggregate fuel/cost/CO₂ summary |
| `/api/analytics?limit=50&offset=0` | GET | Paginated per-flight analytics |
| `/api/analytics/{flight_id}` | GET | Single-flight analytics detail |

## 🔒 Environment Variables

All environment variables are prefixed with `VITE_` so they are exposed to the browser via Vite.

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend REST API base URL | `http://localhost:8000` |
| `VITE_WS_FLIGHTS_URL` | WebSocket URL for flight data | `ws://localhost:8000/ws/flights` |
| `VITE_WS_ALERTS_URL` | WebSocket URL for alerts | `ws://localhost:8000/ws/alerts` |
| `VITE_DEFAULT_METAR_ICAO` | Default METAR station ICAO code | `VCBI` |

> ⚠️ **Never commit `.env` to version control.** Only `.env.example` is tracked.

## 🧪 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on all files |

## 📊 Performance Optimizations

- **Canvas Renderer:** Leaflet uses `preferCanvas: true` for efficient rendering of 1000+ flight markers
- **Virtualized Lists:** `react-window` v2 virtualizes the flights table and alerts table
- **Data Throttle:** WebSocket data is buffered in a ref and flushed to React state every 2 seconds
- **Lazy Analytics:** Summary endpoint polled every 60s; per-flight detail fetched on-demand only
- **No Bulk Polling:** Analytics page uses paginated API instead of fetching all flights

## 📝 License

This project is for educational and demonstration purposes.

---

Built with ☕ and ✈️
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
