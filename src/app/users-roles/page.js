"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  ShieldCheck,
  X,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Database,
  Lock,
  UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";

export default function UsersRolesPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAgentEmail, setActiveAgentEmail] = useState("");
  const [statsFilter, setStatsFilter] = useState("ALL");
  const [dbSource, setDbSource] = useState("supabase_db");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "Customer Support",
    employeeCode: "",
    password: "admin123",
    role: "Support Agent",
  });

  const syncActiveAgent = () => {
    try {
      const stored = localStorage.getItem("wa_panel_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) setActiveAgentEmail(parsed.email.toLowerCase());
      }
    } catch (e) {}
  };

  const loadUsers = async (forceSync = false) => {
    if (forceSync) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/users-roles${forceSync ? "?sync=true" : ""}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setDbSource(data.source || "supabase_db");
        if (forceSync) {
          toast.success("Synchronized users with MediConnect Database!");
        }
        try {
          localStorage.setItem("mediconnect_team_users", JSON.stringify(data.users));
        } catch (e) {}
      } else {
        throw new Error(data.error || "Failed to fetch from DB");
      }
    } catch (err) {
      console.warn("[users-roles] API load error, falling back to cache:", err.message);
      try {
        const stored = localStorage.getItem("mediconnect_team_users");
        if (stored) {
          setUsers(JSON.parse(stored) || []);
        }
      } catch (e) {}
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncActiveAgent();
    loadUsers();

    const handleStorage = () => syncActiveAgent();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSetActiveAgent = (user) => {
    try {
      const userObj = {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      };
      localStorage.setItem("wa_panel_user", JSON.stringify(userObj));
      setActiveAgentEmail((user.email || "").toLowerCase());
      window.dispatchEvent(new Event("storage"));
      toast.success(`You are now acting as ${user.name} (${user.role})!`);
    } catch (e) {}
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please enter both agent name and email");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/users-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success && data.user) {
        setUsers(data.users || [...users, data.user]);
        setShowModal(false);
        setForm({
          name: "",
          email: "",
          phone: "",
          department: "Customer Support",
          employeeCode: "",
          password: "admin123",
          role: "Support Agent",
        });
        toast.success(`Agent ${data.user.name} added to Database!`);
      } else {
        toast.error(data.error || "Failed to add agent");
      }
    } catch (err) {
      toast.error("Network error adding agent: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.id === "u-admin") {
      toast.error("Primary Super Admin must remain Active");
      return;
    }

    const nextStatus = user.status === "Active" ? "Suspended" : "Active";
    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
    );

    try {
      const res = await fetch("/api/users-roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${user.name} is now ${nextStatus}`);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      toast.error("Failed to update status in DB: " + err.message);
      loadUsers(); // rollback
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === "u-admin") {
      toast.error("Cannot delete the primary Super Admin account");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${user.name} (${user.email})?`)) {
      return;
    }

    // Optimistic UI update
    setUsers((prev) => prev.filter((u) => u.id !== user.id));

    try {
      const res = await fetch(`/api/users-roles?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Removed ${user.name} from Database`);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      toast.error("Failed to delete from DB: " + err.message);
      loadUsers(); // rollback
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q);

    let matchStats = true;
    if (statsFilter === "ACTIVE") {
      matchStats = u.status === "Active";
    } else if (statsFilter === "ADMINS") {
      matchStats = (u.role || "").toLowerCase().includes("admin");
    } else if (statsFilter === "SUPPORT") {
      matchStats = (u.role || "").toLowerCase().includes("support");
    }

    return matchSearch && matchStats;
  });

  return (
    <div className="space-y-6">
      {/* Header (Issue 23: Responsive Alignment on Mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-[#00629b]" />
              Support Users & Role-Based Access Control (RBAC)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
              <Database className="w-3 h-3 text-emerald-600" />
              Database Connected
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage permissions for Live Takeovers, Patient Medical Record Access, Broadcasts, and Audit Logs directly from database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUsers(true)}
            disabled={isLoading || isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl shadow-2xs transition cursor-pointer"
            title="Sync staff from MediConnect Database"
          >
            <Database className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing DB..." : "Sync DB Staff"}</span>
          </button>
          <button
            onClick={() => loadUsers(false)}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            title="Refresh from Database"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#00629b]" : ""}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Support Agent
          </button>
        </div>
      </div>

      {/* Quick Stats & Search Filter (Issue 23: Made All 4 Clickable Filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatsFilter("ALL");
            toast.success("Showing all support agents");
          }}
          className={`p-3.5 bg-white border rounded-xl flex items-center justify-between text-left transition cursor-pointer shadow-2xs ${
            statsFilter === "ALL"
              ? "border-[#00629b] ring-2 ring-[#00629b]/20"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Agents</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{users.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00629b] flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatsFilter("ACTIVE");
            toast.success("Filtered to active agents");
          }}
          className={`p-3.5 bg-white border rounded-xl flex items-center justify-between text-left transition cursor-pointer shadow-2xs ${
            statsFilter === "ACTIVE"
              ? "border-emerald-600 ring-2 ring-emerald-600/20"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Staff</div>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">
              {users.filter((u) => u.status === "Active").length}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatsFilter("ADMINS");
            toast.success("Filtered to Super Admins & Admins");
          }}
          className={`p-3.5 bg-white border rounded-xl flex items-center justify-between text-left transition cursor-pointer shadow-2xs ${
            statsFilter === "ADMINS"
              ? "border-purple-600 ring-2 ring-purple-600/20"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Super Admins</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {users.filter((u) => (u.role || "").toLowerCase().includes("admin")).length}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </button>

        <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 ml-1 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search agents or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">User Name</th>
                <th className="py-3 px-4 font-semibold">Assigned Role</th>
                <th className="py-3 px-4 font-semibold">Permissions Scope</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-center font-semibold">Last Login</th>
                <th className="py-3 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#00629b] mb-2" />
                    <span>Loading agents from database...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No users matching "{searchQuery}" found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                    const isPrimaryAdmin = u.id === "u-admin";
                    const isCurrentActive =
                      activeAgentEmail && (u.email || "").toLowerCase() === activeAgentEmail;

                    return (
                      <tr key={u.id} className={`transition ${isCurrentActive ? "bg-blue-50/40" : "hover:bg-slate-50/80"}`}>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{u.name}</span>
                            {isPrimaryAdmin && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded font-normal">
                                Primary
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                                u.source === "MediConnect Main DB"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {u.source || "Database"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {u.email}
                            {u.phone && <span className="text-slate-400 ml-1.5">| {u.phone}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.role === "Super Admin"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : u.role === "Medical Operations" || u.role?.includes("Staff")
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-[#00629b] border-blue-200"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {(u.permissions || []).map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] text-slate-700 font-mono border border-slate-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isPrimaryAdmin}
                            title={isPrimaryAdmin ? "Primary admin cannot be suspended" : "Click to toggle Active / Suspended"}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer select-none transition ${
                              u.status === "Active"
                                ? "text-emerald-700 hover:text-emerald-800"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === "Active" ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            {u.status}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {u.lastLogin || "Never"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isCurrentActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                Active (You)
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSetActiveAgent(u)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-600 hover:text-[#00629b] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition cursor-pointer"
                                title="Switch to act as this agent across WhatsApp Panel"
                              >
                                Switch
                              </button>
                            )}

                            {!isPrimaryAdmin && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title={`Delete ${u.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) setShowModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[92vh] overflow-y-auto my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00629b] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Support Agent / Admin</h3>
                  <p className="text-[10px] text-slate-500">Saves directly to Cloud Database</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAgent} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Verma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="name@mediconnect.fit"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Password *</label>
                  <input
                    type="text"
                    placeholder="Initial Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Operations, Support"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role & Access Scope</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                >
                  <option value="Support Agent">Support Agent (Live Chat & Human Takeovers)</option>
                  <option value="Super Admin">Super Admin (Full Platform & Database Control)</option>
                  <option value="Medical Operations">Medical Operations Specialist (Records & Rx)</option>
                </select>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-semibold text-slate-700 block">Database Synchronization:</span>
                <p>User will be provisioned with full metadata in Cloud Database and given active sign-in credentials.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-[#00629b] hover:bg-[#004f7c] text-white font-semibold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
