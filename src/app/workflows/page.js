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
          const serverTakeover = data.takeoverContacts ? data.takeoverContacts[cleanDigits] : null;
          let takeover = "ACTIVE_AUTOMATION";
          let assignedAgent = null;

          if (serverTakeover !== undefined && serverTakeover !== null) {
            takeover = serverTakeover.active ? "HUMAN_OWNERSHIP_ACTIVE" : "ACTIVE_AUTOMATION";
            assignedAgent = serverTakeover.agentName || null;
          } else {
            const sorted = (Array.isArray(msgs) ? [...msgs] : []).sort(
              (a, b) => Number(a.rawTimestamp || 0) - Number(b.rawTimestamp || 0)
            );
            for (let i = sorted.length - 1; i >= 0; i--) {
              const m = sorted[i];
              const txt = (m.text || "").toLowerCase();
              if (m.sender === "system" && (txt.includes("bot resumed") || txt.includes("released session"))) {
                takeover = "ACTIVE_AUTOMATION";
                break;
              }
              if (
                m.sender === "system" &&
                (txt.includes("human takeover active") ||
                  txt.includes("claimed conversation") ||
                  txt.includes("bot paused"))
              ) {
                takeover = "HUMAN_OWNERSHIP_ACTIVE";
                assignedAgent = m.agentName || "Support Desk";
                break;
              }
              const isBroadcast =
                txt.startsWith("[broadcast campaign") ||
                txt.includes("[template: navratri_post]") ||
                m.isBroadcast === true;
              if (!isBroadcast && (m.sender === "agent" || m.sender === "human")) {
                takeover = "HUMAN_OWNERSHIP_ACTIVE";
                assignedAgent = m.agentName || "Support Desk";
                break;
              }
            }
          }

          // Dynamic Service Domain Detection
          const allText = (Array.isArray(msgs) ? msgs : []).map((m) => (m.text || "").toLowerCase()).join(" ");
          let serviceDomain = "Doctor Consultation";
          if (/(lab|test|diagnostic|blood test|ecg|scan|sample collection|pathology|cholesterol|sugar|hba1c)/i.test(allText)) {
            serviceDomain = "Laboratory & Diagnostics";
          } else if (/(pharmacy|medicine|prescription|tablet|drug|dosage|medication|capsule|syrup)/i.test(allText)) {
            serviceDomain = "Pharmacy & Medicines";
          } else if (/(nursing|nurse|attendant|elderly care|home care|wound dressing|injection)/i.test(allText)) {
            serviceDomain = "Home Healthcare & Nursing";
          } else if (/(support|ticket|records|locker|helpdesk|feedback|refund)/i.test(allText)) {
            serviceDomain = "Support & Records";
          } else if (/(doctor|consult|telemedicine|video consult|physician|dr\.|specialist|cardiolog|dermatolog|pediatric|orthoped|gynecolog|ent|dentist|appointment)/i.test(allText)) {
            serviceDomain = "Doctor Consultation";
          }

          // Dynamic Backend Workflow State Detection
          const lastMsgObj = msgs && msgs.length > 0 ? msgs[msgs.length - 1] : null;
          const lastText = (lastMsgObj?.text || "").toLowerCase();
          let workflowState = "ACTIVE";
          if (/(receipt|appointment confirmed|booking confirmed|consultation completed|thank you for choosing mediconnect|call ended|mc-)/i.test(allText)) {
            workflowState = "COMPLETED";
          } else if (/(payment link|pay online|razorpay|upi id|pending payment|fee: ₹|consultation fee:)/i.test(lastText)) {
            workflowState = "WAITING_PAYMENT";
          } else if (
            takeover === "HUMAN_TAKEOVER_REQUESTED" ||
            takeover === "HUMAN_OWNERSHIP_ACTIVE" ||
            /(waiting for doctor|connecting to doctor|assigned to|please wait while we connect|doctor is ready|telemedicine link)/i.test(allText)
          ) {
            workflowState = "WAITING_PROVIDER";
          }

          liveList.push({
            id: "conv-" + cleanDigits,
            patientName: pName,
            mobile: "+91 " + cleanDigits,
            patientId: existing.patientId || `PT-${cleanDigits.slice(-5)}`,
            careEpisodeId: existing.careEpisodeId || `CE-${cleanDigits.slice(-5)}`,
            workflowId: existing.workflowId || `WF-${cleanDigits.slice(-4)}`,
            serviceType: serviceDomain,
            workflowState: workflowState,
            takeoverStatus: takeover,
            assignedAgent: assignedAgent || existing.assignedAgent || (takeover === "HUMAN_OWNERSHIP_ACTIVE" ? "Support Desk" : null),
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

    const matchService =
      serviceFilter === "ALL" ||
      c.serviceType === serviceFilter ||
      (c.serviceType || "").toLowerCase().includes(serviceFilter.toLowerCase());

    const matchState =
      stateFilter === "ALL" ||
      (c.workflowState || "ACTIVE") === stateFilter;

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
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-[#00629b] font-medium cursor-pointer"
          >
            <option value="ALL">All Services</option>
            <option value="Doctor Consultation">Doctor Consultation</option>
            <option value="Laboratory & Diagnostics">Laboratory & Diagnostics</option>
            <option value="Pharmacy & Medicines">Pharmacy & Medicines</option>
            <option value="Home Healthcare & Nursing">Home Healthcare & Nursing</option>
            <option value="Support & Records">Support & Records</option>
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-[#00629b] font-medium cursor-pointer"
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
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            row.serviceType === "Doctor Consultation"
                              ? "bg-blue-500"
                              : row.serviceType === "Laboratory & Diagnostics"
                              ? "bg-purple-500"
                              : row.serviceType === "Pharmacy & Medicines"
                              ? "bg-emerald-500"
                              : row.serviceType === "Home Healthcare & Nursing"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {row.serviceType || "Doctor Consultation"}
                      </span>
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
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          row.workflowState === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : row.workflowState === "WAITING_PROVIDER"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : row.workflowState === "WAITING_PAYMENT"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : row.workflowState === "COMPLETED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
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
