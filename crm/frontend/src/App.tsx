import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Pipeline from './pages/Pipeline';
import TasksPage from './pages/Tasks';
import Imports from './pages/Imports';
import Dashboard from './pages/Dashboard';
import SettingsUsers from './pages/SettingsUsers';
import SettingsCannedResponses from './pages/SettingsCannedResponses';
import SettingsLeadSources from './pages/SettingsLeadSources';
import AcceptInvite from './pages/AcceptInvite';
import PwaTest from './pages/PwaTest';

function SettingsHome() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Settings</h1>
      <ul className="space-y-2 text-sm">
        <li>
          <a href="/settings/users" className="text-brand-700 hover:underline">
            Users
          </a>
        </li>
        <li>
          <a href="/settings/canned-responses" className="text-brand-700 hover:underline">
            Canned SMS responses
          </a>
        </li>
        <li>
          <a href="/settings/lead-sources" className="text-brand-700 hover:underline">
            Lead sources
          </a>
        </li>
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/imports" element={<Imports />} />
            <Route path="/settings" element={<SettingsHome />} />
            <Route path="/settings/users" element={<SettingsUsers />} />
            <Route path="/settings/canned-responses" element={<SettingsCannedResponses />} />
            <Route path="/settings/lead-sources" element={<SettingsLeadSources />} />
            <Route path="/pwa-test" element={<PwaTest />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
