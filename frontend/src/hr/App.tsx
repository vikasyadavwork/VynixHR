import { useState, type FormEvent } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { api, json, useApi } from "./api";
import type { CurrentUser } from "./types";
import { Avatar, Button } from "./ui";

const links = [
  { to: "/dashboard", title: "Overview", icon: LayoutDashboard, end: true },
  { to: "/employees", title: "Employees", icon: Users },
  { to: "/attendance", title: "Attendance", icon: Activity },
  { to: "/leaves", title: "Time off", icon: CalendarDays },
  { to: "/recruitment", title: "Recruitment", icon: BriefcaseBusiness },
  { to: "/tasks", title: "My tasks", icon: CheckSquare2 },
  { to: "/announcements", title: "Announcements", icon: Bell },
];

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      vynix<span className="brand-hr">HR</span>
      <span className="brand-period">.</span>
    </span>
  );
}

export function Workspace() {
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  return loggedIn ? <WorkspaceContent /> : <Navigate to="/" replace />;
}

function WorkspaceContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data } = useApi<CurrentUser>("/hr/me");
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const title =
    links.find((link) => link.to === location.pathname)?.title ||
    (location.pathname === "/assistant" ? "Ask Vynix" : "Settings");

  function logout() {
    useAuthStore.getState().logout();
    cache.clear();
    navigate("/");
  }

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">V</span>
          <span>
            <strong>Vynix workspace</strong>
            <small>People & culture</small>
          </span>
          <ShieldCheck size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links
            .filter(
              (link) =>
                data?.user.role === "admin" || !["/dashboard", "/recruitment"].includes(link.to),
            )
            .map(({ to, title: label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {label === "Overview" && <span className="nav-dot" />}
              </NavLink>
            ))}
        </nav>
        <div className="nav-label tools-label">TOOLS & SUPPORT</div>
        <NavLink
          to="/assistant"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => setMobileOpen(false)}
        >
          <Sparkles size={19} />
          <span>Ask Vynix</span>
          <span className="tiny-label">AI</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => setMobileOpen(false)}
        >
          <Settings2 size={19} />
          <span>Settings</span>
        </NavLink>
        <div className="sidebar-bottom">
          <div className="sidebar-ai">
            <div className="ai-orbit">
              <Sparkles size={21} />
            </div>
            <strong>A little help. A lot of clarity.</strong>
            <p>Your HR questions, answered from our local knowledge base.</p>
            <button
              onClick={() => {
                navigate("/assistant");
                setMobileOpen(false);
              }}
            >
              Meet your AI assistant <ArrowRight size={15} />
            </button>
          </div>
          <button className="sidebar-user" onClick={() => navigate("/settings")}>
            <Avatar name={data?.user.name || "HR Admin"} size="small" />
            <span>
              <strong>{data?.user.name || "HR Admin"}</strong>
              <small>{data?.user.role === "admin" ? "Workspace admin" : "Team member"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="topbar-search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/employees?search=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search employees across the workspace"
                placeholder="Search your people…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-button"
              aria-label="Open help assistant"
              onClick={() => navigate("/assistant")}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="View announcements"
              onClick={() => navigate("/announcements")}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="topbar-divider" />
            <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="page-content" key={location.pathname}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Made for people. Built for what’s next.</span>
          <span>
            <i /> Local workspace <span className="footer-separator">·</span> VynixHR
          </span>
        </footer>
      </div>
    </div>
  );
}

export function Login() {
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const cache = useQueryClient();
  if (loggedIn) return <Navigate to="/dashboard" replace />;

  async function signIn(demo = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string }>(
        "/auth/sign-in",
        json("POST", {
          email: demo ? "admin@vynixhr.local" : email,
          password: demo ? "Welcome@123" : password,
        }),
      );
      cache.clear();
      useAuthStore.getState().signIn(result.token);
      toast.success("Welcome to your people workspace");
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div className="login-copy">
          <span className="login-pill">
            <Sparkles size={14} /> A better everyday for your people
          </span>
          <h1>
            Great teams.
            <br />
            Even greater
            <br />
            <em>possibilities.</em>
          </h1>
          <p>
            Your people, processes, and answers.
            <br />
            One thoughtfully connected workspace.
          </p>
          <div className="login-illustration">
            <div className="illustration-card">
              <span className="illustration-icon">
                <Users size={23} />
              </span>
              <small>YOUR PEOPLE, CONNECTED</small>
              <strong>A place to grow together.</strong>
              <div className="avatar-stack">
                {["AV", "SP", "RK", "NM"].map((name, index) => (
                  <span
                    key={name}
                    style={{ background: ["#efceb3", "#c5d9cc", "#d4c7ef", "#f2d4e5"][index] }}
                  >
                    {name}
                  </span>
                ))}
                <span className="stack-more">+you</span>
              </div>
              <div className="illustration-chart">
                {[30, 52, 44, 68, 61, 82, 100, 90, 115, 132].map((height, index) => (
                  <span key={index} style={{ height }} />
                ))}
              </div>
            </div>
            <div className="floating-note">
              <ShieldCheck size={18} />
              <span>Local AI. Thoughtful answers.</span>
            </div>
          </div>
        </div>
        <span className="login-copyright">
          © {new Date().getFullYear()} VynixHR · People come first.
        </span>
      </div>
      <div className="login-form-area">
        <span className="login-top-note">YOUR NEXT CHAPTER STARTS HERE</span>
        <div className="login-form-card">
          <span className="welcome-icon">✳</span>
          <h2>Good to see you.</h2>
          <p>Sign in and make great work happen.</p>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <label className="field">
              Work email
              <input
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <>
                  Sign in to your workspace <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <div className="login-or">
            <span />
            or take a look around
            <span />
          </div>
          <Button variant="secondary" disabled={busy} onClick={() => void signIn(true)}>
            <Sparkles size={17} /> Explore the demo workspace
          </Button>
          <div className="demo-note">
            <ShieldCheck size={17} />
            <div>
              <strong>Public demo · fictional employee data</strong>
              <p>admin@vynixhr.local / Welcome@123</p>
            </div>
          </div>
        </div>
        <p className="login-bottom-note">A happier workplace starts with a simpler workday.</p>
      </div>
    </div>
  );
}
