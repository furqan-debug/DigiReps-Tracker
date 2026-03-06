import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Activity } from './pages/Activity';
import { Timesheets } from './pages/Timesheets';
import { Reports } from './pages/Reports';
import { People } from './pages/People';
import { Projects } from './pages/Projects';
import { Schedules } from './pages/Schedules';
import { UrlTracking } from './pages/UrlTracking';
import { Locations } from './pages/Locations';
import { Financials } from './pages/Financials';
import { SettingsPage } from './pages/Settings';
import { AcceptInvite } from './pages/AcceptInvite';

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Standalone invite-acceptance page (no sidebar/header) ── */}
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* ── Main admin shell ── */}
        <Route path="*" element={
          <div className="flex h-screen bg-background overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/timesheets" element={<Timesheets />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/people" element={<People />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/schedules" element={<Schedules />} />
                  <Route path="/url-tracking" element={<UrlTracking />} />
                  <Route path="/locations" element={<Locations />} />
                  <Route path="/financials" element={<Financials />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={
                    <div className="p-8 text-slate-500 flex flex-col items-center justify-center h-full gap-3">
                      <span className="text-4xl">🚧</span>
                      <p className="font-medium">This page is under construction.</p>
                      <p className="text-sm">Select a page from the sidebar to get started.</p>
                    </div>
                  } />
                </Routes>
              </main>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
