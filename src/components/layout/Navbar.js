"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  Menu,
  Search,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Database,
  ChevronDown,
  UserCheck,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Navbar({ onMenuClick, sidebarOpen }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState({
    name: "Super Admin",
    role: "Super Admin",
    initials: "SA",
    email: "admin@mediconnect.fit",
  });
  const [availableAgents, setAvailableAgents] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getPageTitle = () => {
    if (pathname.includes("/conversations")) return "Live Conversations";
    if (pathname.includes("/takeovers")) return "Human Takeover Desk";
    if (pathname.includes("/escalations")) return "Escalation Queue";
    if (pathname.includes("/workflows")) return "Workflows & Patient Episodes";
    if (pathname.includes("/recovery")) return "Workflow Recovery";
    if (pathname.includes("/communication-logs")) return "Communication Logs";
    if (pathname.includes("/broadcasts")) return "Broadcast Campaigns";
    if (pathname.includes("/templates")) return "WhatsApp Template Library";
    if (pathname.includes("/audit-logs")) return "System Audit Trail";
    if (pathname.includes("/users-roles")) return "Users & Role Permissions";
    return "Operations Dashboard";
  };

  const syncCurrentUser = () => {
    try {
      const stored = localStorage.getItem("wa_panel_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name) {
          setCurrentUser({
            name: parsed.name,
            role: parsed.role || "Support Agent",
            email: parsed.email || "",
            initials: parsed.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase(),
          });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    syncCurrentUser();

    // Fetch live agents from DB
    fetch("/api/users-roles")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setAvailableAgents(data.users.filter((u) => u.status === "Active"));
        }
      })
      .catch(() => {});

    // Listen for storage events across tabs or local updates
    const handleStorage = () => syncCurrentUser();
    window.addEventListener("storage", handleStorage);

    // Close dropdown on click outside
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectAgent = (agent) => {
    const userObj = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      email: agent.email,
    };
    try {
      localStorage.setItem("wa_panel_user", JSON.stringify(userObj));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}
    setCurrentUser({
      name: agent.name,
      role: agent.role,
      email: agent.email,
      initials: agent.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase(),
    });
    setDropdownOpen(false);
    toast.success(`Switched active agent to ${agent.name} (${agent.role})`);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("wa_panel_user");
    } catch (e) {}
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between shadow-subtle">
      {/* Left: Mobile menu toggle + Page Title & Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {getPageTitle()}
          </h2>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-6">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, phone, Care Episode..."
            className="w-full pl-8 pr-12 py-1.5 text-xs bg-slate-50/80 border border-slate-200/90 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:ring-1 focus:ring-[#00629b] focus:bg-white transition"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Live Connection Status, Notifications & Profile */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/80 border border-emerald-200/80 text-[11px] font-medium text-emerald-800">
          <Database className="w-3 h-3 text-emerald-600" />
          <span>Supabase DB</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50/80 border border-sky-200/80 text-[11px] font-medium text-sky-800">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
          <span>Meta API Connected</span>
        </div>

        <button
          className="relative p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-900 transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>

        {/* Dynamic Agent Profile & Switcher */}
        <div className="relative pl-2.5 border-l border-slate-200" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition cursor-pointer text-left"
            title="Click to switch active agent"
          >
            <div className="w-7 h-7 rounded-lg bg-[#e0f2fe] border border-[#bae6fd] text-[#00629b] flex items-center justify-center font-bold text-xs flex-shrink-0">
              {currentUser.initials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                {currentUser.role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 text-xs animate-in fade-in slide-in-from-top-1">
              <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Active Agent
                </span>
                <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  DB Connected
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                {availableAgents.length === 0 ? (
                  <div className="p-2 text-center text-slate-400 text-xs">
                    Loading agents...
                  </div>
                ) : (
                  availableAgents.map((ag) => {
                    const isSelected = ag.name === currentUser.name;
                    return (
                      <button
                        key={ag.id}
                        onClick={() => handleSelectAgent(ag)}
                        className={`w-full px-2.5 py-2 text-left rounded-lg flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                          isSelected ? "bg-blue-50/70 font-semibold text-[#00629b]" : "text-slate-700"
                        }`}
                      >
                        <div className="truncate">
                          <div className="text-xs truncate">{ag.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{ag.role}</div>
                        </div>
                        {isSelected && <UserCheck className="w-3.5 h-3.5 text-[#00629b] flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-1 border-t border-slate-100 flex items-center justify-between px-2">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push("/users-roles");
                  }}
                  className="text-[11px] text-[#00629b] hover:underline font-medium py-1"
                >
                  Manage Users & Roles →
                </button>
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 py-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
