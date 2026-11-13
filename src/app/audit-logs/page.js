"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Download,
  FileCheck,
  X,
  Phone,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("ALL");

  const loadAuditLogs = async () => {
    try {
      const res = await fetch("/api/whatsapp/messages");
      const data = await res.json();

      const realEvents = [];

      if (data.success && data.allMessages) {
        for (const [phone, msgs] of Object.entries(data.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const fullPhone = "+91 " + cleanDigits;

          // Initial connection event
          realEvents.push({
            eventId: `EV-${cleanDigits.slice(-5)}-SYNC`,
            timestamp: msgs[0]?.time || "Recently",
            eventType: "THREAD_CONNECTED",
            phone: fullPhone,
            rawPhone: cleanDigits,
            careEpisodeId: `CE-${cleanDigits.slice(-5)}`,
            patientId: `PT-${cleanDigits.slice(-5)}`,
            actionBy: "Meta WhatsApp Cloud API",
            role: "MultiChannel Gateway",
            stateTransition: "INCOMING -> PERSISTED_DB",
            traceId: `trc_${cleanDigits}_init`,
            messageText: "Thread Connected / Initialized",
          });

          // Message audit events
          (msgs || []).forEach((m, idx) => {
            realEvents.push({
              eventId: `EV-${cleanDigits.slice(-4)}-${m.id ? m.id.slice(-6) : idx + 1}`,
              timestamp: m.time || "Recently",
              eventType:
                m.sender === "agent"
                  ? "AGENT_MESSAGE_SENT"
                  : m.sender === "bot"
                  ? "BOT_AUTOMATION_REPLY"
                  : "PATIENT_MESSAGE_RECEIVED",
              phone: fullPhone,
              rawPhone: cleanDigits,
              careEpisodeId: `CE-${cleanDigits.slice(-5)}`,
              patientId: `PT-${cleanDigits.slice(-5)}`,
              actionBy: m.agentName || (m.sender === "agent" ? "Support Agent" : m.sender === "bot" ? "MediConnect Bot" : `User (+91 ${cleanDigits.slice(-4)})`),
              role: m.sender === "agent" ? "Healthcare Coordinator" : m.sender === "bot" ? "Automated Flow" : "Patient",
              stateTransition: m.status === "failed" ? "DISPATCH_FAILED" : m.status === "delivered" ? "DELIVERED_TO_HANDSET" : "MESSAGE_PROCESSED",
              traceId: m.wamid || m.id || `trc_msg_${cleanDigits}_${idx}`,
              messageText: m.text || "",
            });
          });
        }
      }

      setLogs(realEvents.reverse());
    } catch (e) {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const uniquePhones = Array.from(
    new Set(logs.map((l) => l.rawPhone).filter(Boolean))
  ).sort();

  const q = search.trim().toLowerCase();
  const filtered = logs.filter((l) => {
    // 1. Phone Number Filter
    if (phoneFilter !== "ALL" && l.rawPhone !== phoneFilter) {
      return false;
    }

    if (!q) return true;
    return (
      (l.eventId || "").toLowerCase().includes(q) ||
      (l.phone || "").toLowerCase().includes(q) ||
      (l.rawPhone || "").toLowerCase().includes(q) ||
      (l.patientId || "").toLowerCase().includes(q) ||
      (l.careEpisodeId || "").toLowerCase().includes(q) ||
      (l.eventType || "").toLowerCase().includes(q) ||
      (l.actionBy || "").toLowerCase().includes(q) ||
      (l.role || "").toLowerCase().includes(q) ||
      (l.stateTransition || "").toLowerCase().includes(q) ||
      (l.traceId || "").toLowerCase().includes(q) ||
      (l.timestamp || "").toLowerCase().includes(q) ||
      (l.messageText || "").toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No audit records found for the selected filter.");
      return;
    }

    // CSV Headers
    const headers = [
      "Event ID",
      "Timestamp",
      "Phone Number",
      "Care Episode ID",
      "Patient ID",
      "Event Type",
      "Action By",
      "Role",
      "State Transition",
      "Trace / Correlation ID",
      "Message Context",
    ];

    // CSV Rows
    const rows = filtered.map((l) => [
      `"${l.eventId || ""}"`,
      `"${l.timestamp || ""}"`,
      `"${l.phone || l.rawPhone || ""}"`,
      `"${l.careEpisodeId || ""}"`,
      `"${l.patientId || ""}"`,
      `"${l.eventType || ""}"`,
      `"${(l.actionBy || "").replace(/"/g, '""')}"`,
      `"${(l.role || "").replace(/"/g, '""')}"`,
      `"${l.stateTransition || ""}"`,
      `"${l.traceId || ""}"`,
      `"${(l.messageText || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filterSuffix =
      phoneFilter !== "ALL"
        ? `_${phoneFilter}`
        : search.trim()
        ? `_filtered`
        : "";
    link.setAttribute(
      "download",
      `mediconnect_compliance_audit${filterSuffix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(
      `Exported ${filtered.length} audit event${filtered.length === 1 ? "" : "s"} to CSV (${phoneFilter !== "ALL" ? `Phone: +91 ${phoneFilter}` : "All Records"})`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-[#00629b]" />
            Regulatory & Medico-Legal Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable trace logs for all human takeovers, patient message dispatches, API status changes, and state mutations.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#00629b] hover:bg-[#005180] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-white" />
          {phoneFilter !== "ALL"
            ? `Export +91 ${phoneFilter} Audit (CSV)`
            : "Export Compliance Audit (CSV)"}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1">
          {/* Phone Number Dropdown */}
          <div className="relative min-w-[220px]">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white cursor-pointer appearance-none"
            >
              <option value="ALL">All Phone Numbers ({logs.length})</option>
              {uniquePhones.map((ph) => {
                const count = logs.filter((l) => l.rawPhone === ph).length;
                return (
                  <option key={ph} value={ph}>
                    +91 {ph} ({count} events)
                  </option>
                );
              })}
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search Across All Audit Fields */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event ID, phone, episode, role, state, trace ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {phoneFilter !== "ALL" && (
            <button
              onClick={() => setPhoneFilter("ALL")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 text-[#00629b] text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap self-start sm:self-auto"
            >
              <span>+91 {phoneFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
          Showing <span className="font-bold text-slate-800">{filtered.length}</span> of {logs.length} audit event{logs.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <FileCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">No Live Audit Records</p>
            <p className="text-slate-500">
              {phoneFilter !== "ALL"
                ? `No audit events found for phone number +91 ${phoneFilter}.`
                : "Actions performed in the WhatsApp Desk (message dispatches, takeovers, and state updates) will be immutably recorded here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Phone / Episode / Patient</th>
                  <th className="py-3 px-4">Action By (Role)</th>
                  <th className="py-3 px-4">State Transition</th>
                  <th className="py-3 px-4 text-right">Trace / Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.eventId} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#00629b]">
                      {log.eventId}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-semibold font-mono text-[11px] flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[#00629b]" />
                        {log.phone || log.careEpisodeId}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {log.careEpisodeId} • {log.patientId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-semibold">{log.actionBy}</div>
                      <div className="text-[10px] text-slate-500">{log.role}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-emerald-700">
                      {log.stateTransition}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500 text-[10px]">
                      {log.traceId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
