# DigiReps Tracker

DigiReps Tracker is a comprehensive time and productivity tracking solution designed for modern teams. It combines a powerful desktop monitoring client, a feature-rich admin portal, and a robust backend integration with Supabase.

## 🏗️ Architecture

The project is divided into three main components:

- **Desktop Client (Root)**: An Electron-based application that runs in the background to track user activity, take screenshots, and monitor application/URL usage.
- **Admin Portal (`/admin-portal`)**: A React-based web interface for managers to oversee projects, members, budgets, and detailed productivity reports.
- **Backend (`/backend`)**: An Express server that handles data aggregation, member invitations, and complex business logic, sitting on top of a Supabase database.

---

## ✨ Key Features

- **Activity Tracking**: Real-time monitoring of active windows, URLs, and screenshots.
- **Project Management**: Detailed project configurations including budgets, billable hours, and team assignments.
- **Member Management**: Streamlined invite flow with custom roles, pay rates, and billing limits.
- **Favorites System**: Customizable sidebar navigation allowing users to star frequently used sections.
- **Detailed Reporting**: Comprehensive productivity reports, including session logs and activity percentages.
- **Calendar & Time Off**: Management of holidays and team time-off requests.

---

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Desktop**: Electron.
- **Backend**: Express, Node.js.
- **Database**: Supabase (PostgreSQL).
- **Authentication**: Supabase Auth.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase Project

### Installation

1.  **Clone the repository**
2.  **Setup Backend**:
    - `cd backend`
    - `npm install`
    - Create a `.env` file based on `.env.example` with your Supabase credentials.
    - `npm run dev`
3.  **Setup Admin Portal**:
    - `cd admin-portal`
    - `npm install`
    - Create a `.env` file with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL`.
    - `npm run dev`
4.  **Setup Desktop Client**:
    - `cd .. (back to root)`
    - `npm install`
    - Create a `.env` with Supabase credentials.
    - `npm run dev`

---

## 📝 Database Schema

The database schema is managed via Supabase. Key tables include:
- `projects`: Project details and budget settings.
- `members`: User profiles and compensation details.
- `sessions`: Recorded time tracking sessions.
- `activity_samples`: Sampled data for activity levels and idling.
- `project_teams` & `project_members`: Relationship mapping for access control.

Refer to `backend/supabase_schema.sql` for the full definition.
