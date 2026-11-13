"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [currentUser, setCurrentUser] = useState({ name: "Super Admin", role: "Super Admin" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("wa_panel_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name) setCurrentUser(parsed);
      }
    } catch (e) {}
  }, []);

  const loadEscalations = async () => {
    try {
      const msgRes = await fetch("/api/whatsapp/messages");
      const msgData = await msgRes.json();

      const savedMap = {};
      try {
        const saved = localStorage.getItem("mediconnect_wa_live_conversations");
        if (saved) {
          const parsed = JSON.parse(saved) || [];
          parsed.forEach((c) => {
            const digits = (c.mobile || "").replace(/\D/g, "").slice(-10);
            if (digits) savedMap[digits] = c;
          });
        }
      } catch (e) {}

      if (msgData.success && msgData.allMessages) {
        const escList = [];
        for (const [phone, msgs] of Object.entries(msgData.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const existing = savedMap[cleanDigits] || {};
          const lastMsg = msgs[msgs.length - 1];

          // Identify real clinical & patient escalation triggers (patient keywords or explicit agent triage)
          const urgentMsg = msgs.slice(-5).find((m) =>
            m.sender === "patient" &&
            /(urgent|emergency|doctor|pain|help|delay|not working|panic|hospital|fever|serious)/i.test(m.text || "")
          );

          let priority = existing.escalationTag;
          if (!priority || priority === "NORMAL") {
            if (urgentMsg) priority = "HIGH";
          }

          if (priority === "HIGH" || priority === "MEDIUM" || priority === "P1 Critical" || priority === "Follow-up Required") {
            let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
            if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";

            escList.push({
              id: "esc-" + cleanDigits,
              patientName: pName,
              mobile: "+91 " + cleanDigits,
              patientId: existing.patientId || "PT-" + cleanDigits.slice(-5),
              careEpisodeId: existing.careEpisodeId || "CE-" + cleanDigits.slice(-5),
              service: "Live WhatsApp Consultation & Care SLA",
              escalationTag: priority,
              triggerReason: urgentMsg
                ? `Patient trigger keyword: "${urgentMsg.text?.slice(0, 45)}..."`
                : (existing.escalationTag ? `Agent tagged priority: ${existing.escalationTag}` : "Clinical SLA triage threshold exceeded"),
              lastMessage: lastMsg ? lastMsg.text : "Active Thread",
              lastActivity: lastMsg ? lastMsg.time : "Recently",
              assignedAgent: existing.assignedAgent || null,
              takeoverStatus: existing.takeoverStatus || "ACTIVE_AUTOMATION",
            });
          }
        }
        setEscalations(escList);
      }
    } catch (e) {
      setEscalations([]);
    }
  };

  useEffect(() => {
    loadEscalations();
    const interval = setInterval(loadEscalations, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = (mobile) => {
    try {
      const saved = localStorage.getItem("mediconnect_wa_live_conversations");
      if (saved) {
        const parsed = JSON.parse(saved) || [];
        const updated = parsed.map((c) => {
          if (c.mobile === mobile) {
            return {
              ...c,
              takeoverStatus: "HUMAN_OWNERSHIP_ACTIVE",
              assignedAgent: `${currentUser?.name || "Super Admin"} (You)`,
            };
          }
          return c;
        });
        localStorage.setItem("mediconnect_wa_live_conversations", JSON.stringify(updated));
        toast.success("Escalation claimed. Human takeover initiated.");
      }
    } catch (e) {}
  };

  const filtered = escalations.filter((item) => {
    const matchSearch =
      (item.patientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.mobile || "").includes(search) ||
      (item.lastMessage || "").toLowerCase().includes(search.toLowerCase());

    const matchPriority = priorityFilter === "ALL" || item.escalationTag === priorityFilter;
    return matchSearch && matchPriority;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            Clinical & Operational Escalations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Prioritized triage queue for missed consultation SLAs, doctor delays, and patient panic keywords.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
            {escalations.length} Active Escalation{escalations.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search phone number, patient, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setPriorityFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              priorityFilter === "ALL" ? "bg-[#00629b] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Priorities ({escalations.length})
          </button>
          <button
            onClick={() => setPriorityFilter("HIGH")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              priorityFilter === "HIGH" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            P1 Critical
          </button>
        </div>
      </div>

      {/* Escalations Grid */}
      {escalations.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-semibold text-slate-800 text-sm">All Escalations Resolved</p>
          <p className="text-xs text-slate-500">There are no pending clinical or SLA escalation tickets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((esc) => (
            <div
              key={esc.id}
              className="p-5 bg-white border border-rose-200/80 rounded-2xl flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-900">{esc.patientName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    P1 CRITICAL
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mb-2">{esc.mobile}</div>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {esc.lastMessage}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                  {esc.assignedAgent ? `Agent: ${esc.assignedAgent}` : "Unassigned"}
                </span>
                <div className="flex items-center gap-2">
                  {!esc.assignedAgent ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(esc.mobile)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Claim
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      ✓ Claimed
                    </span>
                  )}
                  <Link
                    href={`/conversations?phone=${(esc.mobile || "").replace(/\D/g, "").slice(-10)}`}
                    onClick={() => {
                      if (!esc.assignedAgent) handleClaim(esc.mobile);
                    }}
                    className="px-3 py-1.5 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Reply</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
