import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import BillingPage from './pages/BillingPage';
import AdminDashboard from './pages/AdminDashboard';
import NewFeaturesPage from './pages/NewFeaturesPage';
import AudioToTextPage from './pages/AudioToTextPage';
import VideoToTextPage from './pages/VideoToTextPage';
import PdfToTextPage from './pages/PdfToTextPage';
import TranslatePdfPage from './pages/TranslatePdfPage';
import ProfilePage from './pages/ProfilePage';
import type { User } from './types';
import './index.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('token') ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
  const raw = localStorage.getItem('user');
  if (!raw) return <Navigate to="/login" replace />;
  const user = JSON.parse(raw) as User;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"       element={<LandingPage />} />
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={<PrivateRoute><DashboardPage /></PrivateRoute>}
        />
        <Route
          path="/meeting/:id"
          element={<PrivateRoute><MeetingDetailPage /></PrivateRoute>}
        />
        <Route
          path="/billing"
          element={<PrivateRoute><BillingPage /></PrivateRoute>}
        />
        <Route
          path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/tools/new-features"
          element={<PrivateRoute><NewFeaturesPage /></PrivateRoute>}
        />
        <Route
          path="/tools/audio-to-text"
          element={<PrivateRoute><AudioToTextPage /></PrivateRoute>}
        />
        <Route
          path="/tools/video-to-text"
          element={<PrivateRoute><VideoToTextPage /></PrivateRoute>}
        />
        <Route
          path="/tools/pdf-to-text"
          element={<PrivateRoute><PdfToTextPage /></PrivateRoute>}
        />
        <Route
          path="/tools/translate-pdf"
          element={<PrivateRoute><TranslatePdfPage /></PrivateRoute>}
        />
        <Route
          path="/profile"
          element={<PrivateRoute><ProfilePage /></PrivateRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function App() {
  const isDark = useIsDark();
  const toastBg     = isDark ? '#0A0E18' : '#FFFFFF';
  const toastColor  = isDark ? '#EDF1FA' : '#0F1E45';
  const toastBorder = isDark ? '1px solid rgba(201,152,61,0.18)' : '1px solid rgba(217,119,6,0.2)';
  const toastShadow = isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(15,30,69,0.1)';
  const successIcon = isDark ? '#00D4A0' : '#059669';
  const errorIcon   = isDark ? '#FF5C5C' : '#DC2626';

  return (
    <Router>
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background: toastBg,
            color: toastColor,
            border: toastBorder,
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontFamily: 'Manrope, system-ui, sans-serif',
            boxShadow: toastShadow,
          },
          success: { iconTheme: { primary: successIcon, secondary: toastBg } },
          error:   { iconTheme: { primary: errorIcon,   secondary: toastBg } },
        }}
      />
      <AnimatedRoutes />
    </Router>
  );
}
