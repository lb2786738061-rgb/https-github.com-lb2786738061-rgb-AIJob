import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import ResumeWorkbench from "./pages/ResumeWorkbench";
import MockInterview from "./pages/MockInterview";
import InterviewReport from "./pages/InterviewReport";
import WeakQuestionDrill from "./pages/WeakQuestionDrill";
import GuestDiagnose from "./pages/GuestDiagnose";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Pricing from "./pages/Pricing";
import Enterprise from "./pages/Enterprise";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function AppHeader() {
  const { user, quota, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-md shadow-brand-700/25 group-hover:shadow-brand-700/40 transition-shadow">
            <span className="text-white text-sm font-bold font-display">赢</span>
          </div>
          <span className="font-display font-bold text-lg text-ink tracking-tight">职赢AI</span>
        </NavLink>

        <div className="flex items-center gap-2 md:gap-4">
          {user && quota?.planTier === "free" && (
            <NavLink
              to="/pricing"
              className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-accent-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              ✦ 升级会员
            </NavLink>
          )}

          <nav className="flex gap-0.5">
            {[
              { to: "/resume", label: "简历" },
              { to: "/interview", label: "面试" },
              { to: "/practice", label: "弱题复盘" },
              { to: "/enterprise", label: "名企" },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-pill ${isActive ? "nav-pill-active" : ""}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `text-xs font-semibold px-2 py-1 rounded transition-colors ${
                    isActive ? "text-brand-600 bg-brand-50" : "text-ink hover:text-brand-600"
                  }`
                }
              >
                {user.displayName}
              </NavLink>
              <button onClick={logout} className="btn-ghost">
                退出
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink to="/guest" className="text-xs text-brand-600 hover:underline px-2 py-1">
                免登录体检
              </NavLink>
              <NavLink to="/login" className="btn-primary text-sm !py-2 !px-4">
                登录
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AppContent() {
  return (
    <div className="app-bg min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/guest" element={<GuestDiagnose />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/resume" element={<ProtectedRoute><ResumeWorkbench /></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><MockInterview /></ProtectedRoute>} />
          <Route path="/interview/:sessionId/report" element={<ProtectedRoute><InterviewReport /></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute><WeakQuestionDrill /></ProtectedRoute>} />
          <Route path="/enterprise" element={<ProtectedRoute><Enterprise /></ProtectedRoute>} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p>简历一键精修高过筛 · 全真 AI 面试助你拿下心仪录取通知</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
