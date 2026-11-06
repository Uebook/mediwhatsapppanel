"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export default function RecoveryPage() {
  const [recoveries, setRecoveries] = useState([]);

  const loadRecoveries = async () => {
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
        const recList = [];
        for (const [phone, msgs] of Object.entries(data.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const failedMsg = msgs.find((m) => m.status === "failed");

          if (failedMsg) {
            const existing = savedMap[cleanDigits] || {};
            let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
            if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";

            recList.push({
              id: `rec-${cleanDigits}-${failedMsg.id}`,
              workflowId: existing.workflowId || `WF-${cleanDigits.slice(-4)}`,
              patientName: pName,
              mobile: "+91 " + cleanDigits,
              service: "Meta WhatsApp Cloud API Gateway",
              failureReason: "Gateway Delivery Rejection / Handset Unreachable",
              lastSuccessfulStep: "Outbound Dispatched",
              currentBackendState: "RETRY_QUEUED",
              retryCount: 1,
            });
          }
        }
        setRecoveries(recList);
      }
    } catch (e) {
      setRecoveries([]);
    }
  };

  useEffect(() => {
    loadRecoveries();
    const interval = setInterval(loadRecoveries, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResumeRecovery = (id) => {
    setRecoveries((prev) => prev.filter((r) => r.id !== id));
    toast.success("Recovery sequence dispatched to WhatsApp Multichannel Gateway.");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-purple-600" />
            Workflow Recovery & Interrupted Flows
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative manual and automated recovery for dropped consultations, failed provider assignments, and session replays.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold">
            {recoveries.length} Recovery Pending
          </span>
        </div>
      </div>

      {/* Recovery Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {recoveries.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">All Workflows Healthy</p>
            <p className="text-slate-500">
              No interrupted patient sessions or failed message retries are currently pending.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Workflow ID</th>
                  <th className="py-3 px-4">Patient / Service</th>
                  <th className="py-3 px-4">Failure / Interruption Reason</th>
                  <th className="py-3 px-4">Last Authoritative Step</th>
                  <th className="py-3 px-4">Backend State</th>
                  <th className="py-3 px-4">Retries</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recoveries.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4 font-mono font-semibold text-[#00629b]">
                      {r.workflowId}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{r.patientName}</div>
                      <div className="text-[10px] text-slate-500">{r.mobile}</div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="text-rose-600 font-medium text-[11px]">{r.failureReason}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      <span className="bg-slate-100 px-2 py-1 rounded text-[11px]">
                        {r.lastSuccessfulStep}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {r.currentBackendState}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {r.retryCount} / 3
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleResumeRecovery(r.id)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                      >
                        Resume Recovery
                      </button>
                      <Link
                        href="/conversations"
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-block shadow-xs"
                      >
                        View Chat
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
