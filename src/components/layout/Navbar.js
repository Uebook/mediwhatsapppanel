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
  X,
  MessageSquare,
  AlertTriangle,
  Check,
  Loader2,
  Radio,
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

  // Search State (Issue 1)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Notifications State (Issue 2)
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      title: "P1 Clinical Escalation",
      description: "Chest pain patient query requires immediate clinical review",
      time: "10m ago",
      type: "critical",
      unread: true,
      link: "/escalations",
    },
    {
      id: "notif-2",
      title: "Human Takeover Request",
      description: "Patient +91 98765 43210 requested live agent assistance",
      time: "25m ago",
      type: "takeover",
      unread: true,
      link: "/takeovers",
    },
    {
      id: "notif-3",
      title: "Campaign Dispatched",
      description: "Health Awareness WhatsApp Broadcast dispatched successfully",
      time: "1h ago",
      type: "broadcast",
      unread: false,
      link: "/broadcasts",
    },
    {
      id: "notif-4",
      title: "Gateway Connected",
      description: "Meta WhatsApp Cloud API & Database sync active",
      time: "2h ago",
      type: "system",
      unread: false,
      link: "/communication-logs",
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

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

    // Close dropdowns on click outside
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // Keyboard shortcut ⌘K / Ctrl+K
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Handle Search Input (Issue 1)
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/whatsapp/messages");
        const data = await res.json();
        const results = [];

        if (data.success && data.allMessages) {
          for (const [phone, msgs] of Object.entries(data.allMessages)) {
            const cleanDigits = phone.replace(/\D/g, "").slice(-10);
            const cleanPhone = "+91 " + cleanDigits;
            const lastMsg = msgs && msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const textMatch = (msgs || []).find((m) =>
              (m.text || "").toLowerCase().includes(q)
            );

            if (
              cleanDigits.includes(q) ||
              phone.toLowerCase().includes(q) ||
              textMatch ||
              `patient ${cleanDigits}`.includes(q)
            ) {
              results.push({
                phone: cleanDigits,
                displayPhone: cleanPhone,
                patientName: `Patient (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`,
                matchedSnippet: textMatch ? textMatch.text?.slice(0, 70) : lastMsg?.text?.slice(0, 70) || "Active WhatsApp Conversation",
                timestamp: lastMsg?.time || "Recently",
              });
            }
          }
        }
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (result) => {
    setSearchDropdownOpen(false);
    setSearchQuery("");
    router.push(`/conversations?phone=${result.phone}`);
    toast.success(`Opening conversation with ${result.displayPhone}`);
  };

  const handleNotificationClick = (item) => {
    // Mark notification as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    setNotifOpen(false);
    router.push(item.link);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success("All notifications marked as read");
  };

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

      {/* Center Search Bar (Issue 1 Resolved) */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-6 relative" ref={searchContainerRef}>
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
            placeholder="Search patient, phone, Care Episode..."
            className="w-full pl-8 pr-16 py-1.5 text-xs bg-slate-50/80 border border-slate-200/90 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:ring-1 focus:ring-[#00629b] focus:bg-white transition"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <kbd className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Live Search Results Dropdown */}
        {searchDropdownOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Search Results ({searchResults.length})</span>
              {isSearching && <Loader2 className="w-3 h-3 animate-spin text-[#00629b]" />}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {isSearching && searchResults.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00629b]" />
                  <span>Searching live patient database...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No matching conversations or patients found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={res.phone}
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full px-3 py-2.5 text-left hover:bg-sky-50/60 transition flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-[#00629b] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 group-hover:text-[#00629b]">
                          {res.displayPhone}
                        </span>
                        <span className="text-[10px] text-slate-400">{res.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{res.matchedSnippet}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Live Connection Status, Notifications & Profile */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/80 border border-emerald-200/80 text-[11px] font-medium text-emerald-800">
          <Database className="w-3 h-3 text-emerald-600" />
          <span>Database Connected</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50/80 border border-sky-200/80 text-[11px] font-medium text-sky-800">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
          <span>Meta API Connected</span>
        </div>

        {/* Notifications Popover (Issue 2 Resolved) */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-900 transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs">
              <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Notifications {unreadCount > 0 && `(${unreadCount})`}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-[#00629b] hover:underline font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 py-1">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg transition cursor-pointer flex items-start gap-2.5 hover:bg-slate-50 ${
                      item.unread ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {item.type === "critical" ? (
                        <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      ) : item.type === "takeover" ? (
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                          <UserCheck className="w-3.5 h-3.5" />
                        </div>
                      ) : item.type === "broadcast" ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Radio className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${item.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
                  className="text-[11px] text-[#00629b] font-medium hover:underline py-1 cursor-pointer flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  <span>Manage Roles</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-rose-600 font-medium hover:underline py-1 cursor-pointer flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}