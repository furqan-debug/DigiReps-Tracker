import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Activity } from './pages/Activity';
import { Timesheets } from './pages/Timesheets';
import { Reports } from './pages/Reports';
import { ReportsLegacy } from './pages/ReportsLegacy';
import { DailyTotals } from './pages/DailyTotals';
import { AmountsOwed } from './pages/AmountsOwed';
import { PaymentsReport } from './pages/PaymentsReport';
import { AllReports } from './pages/AllReports';
import { CustomizedReports } from './pages/CustomizedReports';
import { People } from './pages/People';
import { Projects } from './pages/Projects';
import { Schedules } from './pages/Schedules';
import { UrlTracking } from './pages/UrlTracking';
import { Locations } from './pages/Locations';
import { JobSites } from './pages/JobSites';
import { Todos } from './pages/Todos';
import { Clients } from './pages/Clients';
import { Financials } from './pages/Financials';
import { Approvals } from './pages/Approvals';
import { AppUsage } from './pages/AppUsage';
import { Highlights } from './pages/Highlights';
import { Performance } from './pages/Performance';
import { SettingsPage } from './pages/Settings';
import { AcceptInvite } from './pages/AcceptInvite';
import { MemberTimeline } from './pages/MemberTimeline';
import { Teams } from './pages/Teams';
import { Calendar } from './pages/Calendar';
import { TimeOff } from './pages/TimeOff';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CreatePayments } from './pages/CreatePayments';
import { PastPayments } from './pages/PastPayments';
import { Invoices } from './pages/Invoices';
import { Expenses } from './pages/Expenses';

import { FavoritesProvider } from './context/FavoritesContext';

function App() {
  return (
    <FavoritesProvider>
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
                    <Route path="/financials" element={<Financials />} />
                    <Route path="/member-timeline" element={<MemberTimeline />} />
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* --- NEW FEATURES --- */}
                    <Route path="/timesheets/approvals" element={<Approvals />} />
                    <Route path="/activity/apps" element={<AppUsage />} />
                    <Route path="/insights/highlights" element={<Highlights />} />
                    <Route path="/insights/performance" element={<Performance />} />

                    {/* --- PLACEHOLDER ROUTES --- */}

                    <Route path="/insights/unusual" element={<PlaceholderPage title="Unusual Activity" />} />
                    <Route path="/insights/notifications" element={<PlaceholderPage title="Smart Notifications" />} />
                    <Route path="/insights/output" element={<PlaceholderPage title="Output" />} />

                    {/* --- NEW LOCATIONS FEATURE --- */}
                    <Route path="/locations" element={<Locations />} />
                    <Route path="/locations/job-sites" element={<JobSites />} />

                    <Route path="/projects/todos" element={<Todos />} />
                    <Route path="/projects/clients" element={<Clients />} />

                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/calendar/requests" element={<TimeOff />} />

                    <Route path="/reports" element={<Reports />} />
                    <Route path="/reports/legacy" element={<ReportsLegacy />} />
                    <Route path="/reports/daily" element={<DailyTotals />} />
                    <Route path="/reports/owed" element={<AmountsOwed />} />
                    <Route path="/reports/payments" element={<PaymentsReport />} />
                    <Route path="/reports/all" element={<AllReports />} />
                    <Route path="/reports/custom" element={<CustomizedReports />} />

                    <Route path="/people/teams" element={<Teams />} />

                    <Route path="/financials/create" element={<CreatePayments />} />
                    <Route path="/financials/past" element={<PastPayments />} />
                    <Route path="/financials/invoices" element={<Invoices />} />
                    <Route path="/financials/expenses" element={<Expenses />} />

                    <Route path="/silent/how-it-works" element={<PlaceholderPage title="Silent App: How it works" />} />

                    <Route path="/settings/tracking" element={<PlaceholderPage title="Activity & Tracking Settings" />} />
                    <Route path="/settings/integrations" element={<PlaceholderPage title="Integrations" />} />
                    <Route path="/settings/billing" element={<PlaceholderPage title="Billing" />} />
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
    </FavoritesProvider>
  );
}

export default App;
