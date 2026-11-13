"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function OperationsPage() {
  const [ops, setOps] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadOps = async () => {
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

        if (data.success && data.allMessages) {
          const liveOps = [];
          for (const [phone, msgs] of Object.entries(data.allMessages)) {
            const cleanDigits = phone.replace(/\D/g, "").slice(-10);
            if (!cleanDigits) continue;
            const existing = savedMap[cleanDigits] || {};
            const lastMsg = msgs[msgs.length - 1];

            let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
            if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";

            const hasAgentMsg = msgs.some((m) => m.sender === "agent");
            const isTakeover = existing.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" || hasAgentMsg;

            liveOps.push({
              id: `op-${cleanDigits}`,
              patientName: pName,
              mobile: "+91 " + cleanDigits,
              service: existing.serviceType || "Live WhatsApp Gateway",
              assignedProvider: existing.assignedAgent || (isTakeover ? "Human Agent" : "Automated WhatsApp Bot"),
              coordinationStatus: existing.workflowState || "ACTIVE",
              pendingDependency: isTakeover ? "Agent Response" : "Patient Response",
              escalationOwner: existing.assignedAgent || "Support Desk",
              followupResp: lastMsg ? lastMsg.time : "Live",
            });
          }
          setOps(liveOps);
        }
      } catch (e) {
        setOps([]);
      }
    };

    loadOps();
  }, []);

  const filtered = ops.filter(
    (o) =>
      o.patientName.toLowerCase().includes(search.toLowerCase()) ||
      o.assignedProvider.toLowerCase().includes(search.toLowerCase()) ||
      o.service.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-[#00629b]" />
            Operations & Provider Coordination Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live patient coordination, service tracking, and escalation monitoring.
          </p>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">No Active Operational Escalations</p>
            <p className="text-slate-500">Live conversations from WhatsApp will automatically reflect here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Assigned Doctor / Handler</th>
                  <th className="py-3 px-4">Coordination Status</th>
                  <th className="py-3 px-4">Pending Dependency (SLA)</th>
                  <th className="py-3 px-4">Escalation Owner</th>
                  <th className="py-3 px-4 text-right">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{item.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {item.service}
                    </td>
                    <td className="py-3.5 px-4 text-[#00629b] font-medium">
                      {item.assignedProvider}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.coordinationStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-amber-700 font-medium">
                      {item.pendingDependency}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {item.escalationOwner}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                      {item.followupResp}
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
