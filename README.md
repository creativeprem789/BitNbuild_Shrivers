# 🏢 Virtual Office

> **AI-powered multi-agent task orchestration system** that turns natural-language requests into coordinated workflows through specialized AI agents.

Built by **Team Shrivers** for **Bit N Build 2026 — Problem Statement 05**


Live Demo Link: https://bit-nbuild-shrivers-one.vercel.app/
---

## 🚀 Overview

Virtual Office is an interactive AI workspace where users can give tasks in natural language and let specialized AI agents handle them.

The system uses **LangGraph** to orchestrate agents, while a React-based virtual office provides an interactive interface for monitoring task execution.

Instead of manually deciding which service should handle a task, the system automatically classifies the request, routes it to the appropriate agent, executes the workflow, and returns the result.

---




## 🧠 AI Agents

| Agent | Responsibility |
|---|---|
| 📧 **Email Specialist** | Handles communication and email-related tasks |
| 📅 **Calendar Manager** | Handles scheduling and calendar-related tasks |
| 🔎 **Research Analyst** | Handles research and information-gathering tasks |
| 🧑‍💼 **Executive Resolver** | Handles general-purpose and fallback tasks |

---

## ⚙️ How It Works

    User Task
        ↓
    Task Classification
        ↓
    Dynamic Agent Routing
        ↓
    Specialized AI Agent
        ↓
    Task Execution
        ↓
    Final Result

### Example

    "Schedule a meeting with the design team tomorrow at 2 PM."
        ↓
    Task Classification
        ↓
    Calendar Agent
        ↓
    Execution
        ↓
    Result

---

## ✨ Key Features

- 🧠 **Multi-Agent Orchestration** — Specialized agents handle different task categories.
- 🔀 **Dynamic Agent Routing** — Tasks are automatically routed to the appropriate agent.
- 🔄 **Agent Handoffs** — Agents can pass tasks to another specialized agent when required.
- ⚡ **Real-Time Updates** — Task execution events are reflected in the frontend.
- 🏢 **Interactive Virtual Office** — Visual workspace for interacting with AI agents.
- 💬 **Natural Language Input** — Users can describe tasks using normal language.
- 📜 **Task History** — Previous tasks and their execution states can be viewed.
- 🎮 **Demo Mode** — Demonstrates agent orchestration through predefined workflows.

---

## 🏗️ System Architecture

    ┌───────────────────────┐
    │       User Task       │
    │   Natural Language    │
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │   React Frontend      │
    │  Interactive Office   │
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │    FastAPI Backend    │
    └───────────┬───────────┘
                ↓
    ┌───────────────────────┐
    │   LangGraph Workflow  │
    │  Agent Orchestration  │
    └───────────┬───────────┘
                ↓
       ┌────────┼────────┐
       ↓        ↓        ↓
    Email    Calendar  Research
    Agent     Agent     Agent
       │        │        │
       └────────┼────────┘
                ↓
    ┌───────────────────────┐
    │     Final Response     │
    └───────────────────────┘

---

## 🖥️ UI Screenshots

### Virtual Office


<img width="1600" height="816" alt="WhatsApp Image 2026-09-27 at 13 38 14" src="https://github.com/user-attachments/assets/6c835d57-e888-4562-b276-568b19d57c44" />

#Live Demo
<img width="1600" height="816" alt="WhatsApp Image 2026-09-27 at 13 38 13" src="https://github.com/user-attachments/assets/41d9c68d-7d96-4e0c-ae6e-c57c472101f6" />


## 🛠️ Tech Stack

### Frontend

- **React** — Interactive frontend
- **TypeScript** — Type-safe development
- **Vite** — Frontend build tooling
- **Tailwind CSS** — UI styling
- **Three.js** — 3D graphics
- **React Three Fiber** — React-based Three.js integration

### Backend & AI

- **Python** — Backend development
- **FastAPI** — API layer
- **LangGraph** — Multi-agent workflow orchestration
- **LangChain** — AI application framework
- **Google Gemini** — LLM powering the AI agents

---

## 📁 Project Structure

    BitNbuild_Shrivers/
    │
    ├── backend/
    │   └── app/
    │       ├── api/
    │       ├── db/
    │       ├── events/
    │       └── orchestration/
    │
    ├── frontend/
    │   └── src/
    │       ├── components/
    │       ├── hooks/
    │       ├── services/
    │       └── types/
    │
    ├── .env.example
    └── README.md

---

## ⚡ Getting Started

### 1. Clone the Repository

    git clone https://github.com/creativeprem789/BitNbuild_Shrivers.git

    cd BitNbuild_Shrivers

### 2. Backend Setup

    cd backend

    python -m venv .venv

#### Windows

    .venv\Scripts\activate

#### Install Dependencies

    pip install -r requirements.txt

Configure the required environment variables using `.env.example`.

#### Start the Backend

    uvicorn app.main:app --reload --port 8000

The backend will be available at:

    http://localhost:8000

### 3. Frontend Setup

Open a new terminal:

    cd frontend

    npm install

    npm run dev

The frontend will be available through the Vite development server.

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/tasks` | Create a new task |
| GET | `/tasks` | List tasks |
| GET | `/tasks/{id}` | Get task details |
| GET | `/health` | Check backend status |
| GET | `/orchestration/graph` | View orchestration workflow |
| WS | `/ws/tasks` | Receive task execution updates |

---

## 🔄 Task Flow

A typical task follows this workflow:

    User Input
        ↓
    Natural Language Task
        ↓
    Task Classification
        ↓
    Agent Selection
        ↓
    Agent Execution
        ↓
    Agent Handoff (if required)
        ↓
    Final Response
        ↓
    Frontend Update

---

## 🎯 Problem We Address

Traditional productivity tools often require users to manually switch between different applications and services for different tasks.

Virtual Office provides a unified interface where users can simply describe what they want to accomplish.

The system determines the appropriate agent and coordinates the task execution through an AI-driven workflow.

---

## 🔮 Future Scope

- Add more specialized AI agents
- Integrate real-world email and calendar services
- Support parallel agent execution
- Introduce human approval workflows
- Add advanced agent analytics
- Expand virtual office interactions

---

## 👥 Team Shrivers

| Member | Role |
|---|---|
| **Anushka Singh** | Team Leader — Frontend Implementation |
| **Aditya Soni** | UI/UX Designing |
| **Prem Kumar Rai** | Backend Logic, API Integration & Final Implementation |
| **Shubham Kumar** | FastAPI Handling & Documentation |

---

## ⭐ Built With

**React • TypeScript • Vite • Tailwind CSS • Three.js • FastAPI • LangGraph • LangChain • Google Gemini**

---

## 📄 Copyright

© 2026 **Team Shrivers**. All Rights Reserved.

This project and its source code, design, documentation, and associated assets are the intellectual property of **Team Shrivers**.

Unauthorized copying, reproduction, modification, distribution, or commercial use of this project or any substantial part of it is prohibited without prior permission from Team Shrivers.
