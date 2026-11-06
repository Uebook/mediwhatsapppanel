"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Network,
  Search,
  ArrowRight,
  Plus,
  Bot,
  UserCheck,
} from "lucide-react";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const loadWorkflows = async () => {
    try {
      const res = await fetch("/api/whatsapp/messages");
      const data = await res.json();

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

      const liveList = [];
      if (data.success && data.allMessages) {
        for (const [phone, msgs] of Object.entries(data.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const existing = savedMap[cleanDigits] || {};
          const lastMsg = msgs[msgs.length - 1];

          let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
          if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";

          const hasAgentMsg = msgs.some((m) => m.sender === "agent");
          const takeover = existing.takeoverStatus || (hasAgentMsg ? "HUMAN_OWNERSHIP_ACTIVE" : "ACTIVE_AUTOMATION");

          liveList.push({
            id: "conv-" + cleanDigits,
            patientName: pName,
            mobile: "+91 " + cleanDigits,
            patientId: existing.patientId || `PT-${cleanDigits.slice(-5)}`,
            careEpisodeId: existing.careEpisodeId || `CE-${cleanDigits.slice(-5)}`,
            workflowId: existing.workflowId || `WF-${cleanDigits.slice(-4)}`,
            serviceType: existing.serviceType || "Meta WhatsApp Cloud API Desk",
            workflowState: existing.workflowState || "ACTIVE",
            takeoverStatus: takeover,
            assignedAgent: existing.assignedAgent || (takeover === "HUMAN_OWNERSHIP_ACTIVE" ? "Support Desk" : null),
            lastMessage: lastMsg ? lastMsg.text : "Active Thread",
            lastActivity: lastMsg ? lastMsg.time : "Recently",
          });
        }
      }

      setWorkflows(liveList);
    } catch (e) {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
    const interval = setInterval(loadWorkflows, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredWorkflows = workflows.filter((c) => {
    const matchSearch =
      (c.patientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile || "").includes(search) ||
      (c.careEpisodeId && c.careEpisodeId.toLowerCase().includes(search.toLowerCase())) ||
      (c.workflowId && c.workflowId.toLowerCase().includes(search.toLowerCase()));

    const matchService = serviceFilter === "ALL" || (c.serviceType || "").includes(serviceFilter);
    const matchState = stateFilter === "ALL" || (c.workflowState || "ACTIVE") === stateFilter;

    return matchSearch && matchService && matchState;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Network className="w-6 h-6 text-[#00629b]" />
            Patients & Active Workflows
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative registry of real running healthcare care episodes, workflow states, and service routing.
          </p>
        </div>

        <Link
          href="/conversations"
          className="flex items-center gap-2 px-3.5 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Start New Patient Workflow
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, mobile, Care Episode (CE-...), or Workflow..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-[#00629b]"
          >
            <option value="ALL">All Services</option>
            <option value="Meta WhatsApp">Live WhatsApp Desk</option>
            <option value="SP-01">SP-01: Consultation</option>
            <option value="SP-02">SP-02: Pharmacy</option>
            <option value="SP-03">SP-03: Laboratory</option>
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-[#00629b]"
          >
            <option value="ALL">All States</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="WAITING_PROVIDER">WAITING_PROVIDER</option>
            <option value="WAITING_PAYMENT">WAITING_PAYMENT</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {filteredWorkflows.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-700 text-sm">No Active Patient Workflows Found</p>
            <p className="text-slate-500">Live conversations started from the WhatsApp Desk will automatically appear here.</p>
            <Link
              href="/conversations"
              className="inline-flex items-center gap-1.5 mt-2 text-[#00629b] hover:underline font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Start a live chat now
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Patient / Mobile</th>
                  <th className="py-3 px-4">Service Domain</th>
                  <th className="py-3 px-4">Care Episode ID</th>
                  <th className="py-3 px-4">Workflow ID</th>
                  <th className="py-3 px-4">Backend State</th>
                  <th className="py-3 px-4">Current Owner</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkflows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{row.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-medium">{row.serviceType || "Live WhatsApp Gateway"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[#00629b] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {row.careEpisodeId || `CE-${row.mobile?.slice(-5) || "LIVE"}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-700">{row.workflowId || `WF-${row.mobile?.slice(-4) || "01"}`}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.workflowState === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : row.workflowState === "WAITING_PROVIDER"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.workflowState || "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 font-medium">
                        {row.assignedAgent || (row.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" ? "Human Agent" : "🤖 WhatsApp Bot")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{row.lastActivity || "Recently"}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href="/conversations"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-[#e0f2fe] hover:border-blue-200 border border-slate-200 text-slate-700 hover:text-[#00629b] rounded-lg text-xs font-semibold transition shadow-xs"
                      >
                        Open Chat <ArrowRight className="w-3 h-3" />
                      </Link>
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
