# Virtual Office UI — Interactive Multi-Agent Task Harness

> **Bit N Build Hackathon — Problem Statement 05**  
> Real-time spatial visualization and monitoring frontend for asynchronous multi-agent orchestration workflows.

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎯 Overview & Problem Statement

**Problem Statement 05** requires an interactive task harness where natural-language inputs are orchestrated across autonomous, specialized AI agents with dynamic routing, handoffs, and state recovery.

The **Virtual Office Frontend** translates complex agent states into an intuitive **spatial virtual office simulation**:

- 🏢 **Office Floor & Desks:** Each specialized agent (Email, Calendar, Search, Custom) has a physical station on the office floor.
- 🟡 **Task Token:** An active task is rendered as an animated physical token that navigates across desks in real time.
- 🔀 **Handoffs & Routing:** When a task moves between agents or escalates, the token visually glides between desks.
- ⏸️ **Block & Resume:** When an agent requires additional user parameters, the desk enters an alert state, allowing direct one-click intervention and task retry.
- ⚡ **Zero-Latency Event Stream:** Reconstructs the complete monotonic execution timeline using WebSockets with automatic fallback to a built-in simulation engine.

---

## 🏗️ System Architecture

```text
                  ┌──────────────────────────────────────────┐
                  │      Virtual Office UI (React + Vite)    │
                  │  ┌────────────┐ ┌──────────────────────┐ │
                  │  │ Office     │ │ Activity Feed        │ │
                  │  │ Floor (2D) │ │ & State Inspector    │ │
                  │  └────────────┘ └──────────────────────┘ │
                  └─────────────┬────────────────────────────┘
                                │
                 WebSocket Stream / REST API
            (ws://localhost:8000/ws/tasks?subscribe=all)
                                │
                  ┌─────────────▼────────────────────────────┐
                  │       FastAPI Orchestration Gateway      │
                  │  ┌────────────────────────────────────┐  │
                  │  │ Gemini Flash Classifier & Router   │  │
                  │  └────────────────────────────────────┘  │
                  │  ┌────────────────────────────────────┐  │
                  │  │ LangGraph StateGraph Workflow      │  │
                  │  └────────────────────────────────────┘  │
                  │  ┌────────────────────────────────────┐  │
                  │  │ Desks: Email | Calendar | Search   │  │
                  │  └────────────────────────────────────┘  │
                  └──────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. Spatial Virtual Office Floor
- **Visual Desks:** Dedicated stations for **Email Agent**, **Calendar Agent**, **Search Agent**, and **Custom Agent**.
- **Dynamic Desk Badges:** Desks actively reflect status (`IDLE`, `BUSY`, `ROUTING`, `HANDOFF`, `BLOCKED`, `COMPLETED`).
- **Kinetic Task Tokens:** Smooth CSS transitions convey task handoffs across coordinates on the office floor.

### 2. Dual-Mode Operation (Live Backend & Standalone Mock)
- **Live Mode:** Real-time bi-directional WebSocket connection to the FastAPI backend (`/ws/tasks?subscribe=all`) with automated reconnection logic.
- **Standalone Mock Engine:** Toggleable built-in simulation pipeline allowing complete offline evaluation and demonstration without database or LLM dependencies.

### 3. Stage Inspector & Recovery (Block/Resume)
- Inspect selected task parameters, confidence scores, sequence numbering, and error diagnostics.
- Direct **Retry Task** action to re-inject blocked tasks back into the orchestration graph with state preservation.

### 4. Ordered Activity Feed
- Monotonically ordered real-time event logs keyed by `sequence_no`.
- Distinct color-coded event pill badges for:
  - `task.created`
  - `task.routed`
  - `task.handoff`
  - `task.blocked`
  - `task.completed`

### 5. Interactive Graph Topology Modal
- Dynamic **Mermaid.js** visualization displaying the underlying LangGraph state machine, nodes, and transition pathways.

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Framework** | [React 19](https://react.dev/) | High-performance UI rendering |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strictly typed schemas and event contracts |
| **Build Tool** | [Vite 6](https://vitejs.dev/) | Ultra-fast HMR and bundling |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first styling with zero runtime |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent iconography across agents and stages |
| **Linter** | [Oxlint](https://oxc.rs/) | High-speed JavaScript/TypeScript linting |

---

## 📂 Project Structure

```text
frontend/
├── public/                 # Static assets and icons
├── src/
│   ├── assets/             # Brand logos and vector graphics
│   ├── components/         # Modular UI components
│   │   ├── ActivityFeed.tsx # Real-time chronological audit trail
│   │   ├── DeskAvatar.tsx   # Individual agent desk station & state
│   │   ├── Header.tsx       # Navigation bar & connection status
│   │   ├── MermaidModal.tsx # Graph topology visualizer
│   │   ├── OfficeFloor.tsx  # 2D spatial desk layout & floor canvas
│   │   ├── StatusPanel.tsx  # Selected task detail & resume inspector
│   │   ├── TaskInput.tsx    # Task dispatcher form & prompt presets
│   │   └── TaskToken.tsx    # Animated spatial token representing task
│   ├── hooks/
│   │   └── useTaskSocket.ts # WebSocket stream hook with auto-reconnect
│   ├── services/
│   │   ├── api.ts           # REST API client for dispatch & retry
│   │   └── mockEventSource.ts # Offline simulation event generator
│   ├── types/
│   │   └── task.ts          # Strongly-typed state and event models
│   ├── App.tsx             # Root application orchestrator
│   ├── index.css           # Global Tailwind stylesheet
│   └── main.tsx            # React application entry point
├── package.json            # Scripts & project dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

---

## 🔄 Real-Time Event Contract

The frontend ingests WebSocket events structured according to the following protocol:

| Event Type | Description |
|---|---|
| `task.created` | Initial task submission and ingestion |
| `task.routed` | Gemini Flash classification and agent assignment |
| `task.handoff` | Delegation from one specialized agent to another |
| `task.blocked` | Missing parameters / external dependencies awaiting input |
| `task.completed` | Successful execution and task finalization |

```json
{
  "event": "task.routed",
  "task_id": "8f4e2b01-...",
  "agent_id": "calendar_agent",
  "confidence": 0.96,
  "reason": "Request contains calendar scheduling parameters",
  "sequence_no": 2,
  "timestamp": "2026-09-26T22:00:00Z"
}
```

---

## ⚙️ Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm** / **yarn**

### 2. Navigate to Frontend Directory
```bash
cd frontend
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be live at:
```text
➜  Local:   http://localhost:5173/
```

### 5. Running with the Backend
To connect to the live multi-agent backend:
1. Ensure the backend FastAPI server is running on `http://localhost:8000`.
2. Toggle off the **"Mock Mode"** switch in the UI header/dispatcher.
3. The WebSocket connection indicator will display **LIVE (CONNECTED)**.

---

## 🧪 Evaluation & Demo Workflow

1. **Preset Dispatch:** Click any pre-configured task button (e.g., *"Schedule Meeting with Team"* or *"Search Competitor Analytics"*).
2. **Observe Spatial Movement:** Watch the **Task Token** navigate to the classified agent's desk.
3. **Simulate Block & Resume:** Dispatch an incomplete scheduling prompt to trigger a `task.blocked` state; click **Resume Task** to witness retry handling.
4. **Inspect Topology:** Click **"Workflow Topology"** in the top header to examine the LangGraph routing architecture in Mermaid diagram format.

---

## 👥 Contributors & Hackathon Team

- **Team:** Shrivers
- **Hackathon:** Bit N Build Hackathon
- **Problem Statement:** PS-05 (Interactive Multi-Agent Task Harness)
