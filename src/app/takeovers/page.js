"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  UserCheck,
  RotateCcw,
  Clock,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";

export default function TakeoversPage() {
  const [takeovers, setTakeovers] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const loadTakeovers = async () => {
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
        const list = [];
        for (const [phone, msgs] of Object.entries(msgData.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const lastMsg = msgs[msgs.length - 1];
          const existing = savedMap[cleanDigits] || {};

          let takeoverStatus = "ACTIVE_AUTOMATION";
          let activeAgentName = null;

          const serverTakeover = msgData.takeoverContacts ? msgData.takeoverContacts[cleanDigits] : null;
          if (serverTakeover !== undefined && serverTakeover !== null) {
            takeoverStatus = serverTakeover.active ? "HUMAN_OWNERSHIP_ACTIVE" : "ACTIVE_AUTOMATION";
            activeAgentName = serverTakeover.agentName || null;
          } else {
            // Strictly inspect chronological events from newest to oldest
            const sorted = (Array.isArray(msgs) ? [...msgs] : []).sort(
              (a, b) => Number(a.rawTimestamp || 0) - Number(b.rawTimestamp || 0)
            );
            for (let i = sorted.length - 1; i >= 0; i--) {
              const m = sorted[i];
              const txt = (m.text || "").toLowerCase();
              if (m.sender === "system" && (txt.includes("bot resumed") || txt.includes("released session"))) {
                takeoverStatus = "ACTIVE_AUTOMATION";
                break;
              }
              if (
                m.sender === "system" &&
                (txt.includes("human takeover active") ||
                  txt.includes("claimed conversation") ||
                  txt.includes("bot paused"))
              ) {
                takeoverStatus = "HUMAN_OWNERSHIP_ACTIVE";
                activeAgentName = m.agentName || "Support Desk";
                break;
              }
              const isBroadcast =
                txt.startsWith("[broadcast campaign") ||
                txt.includes("[template: navratri_post]") ||
                m.isBroadcast === true;
              if (!isBroadcast && (m.sender === "agent" || m.sender === "human")) {
                takeoverStatus = "HUMAN_OWNERSHIP_ACTIVE";
                activeAgentName = m.agentName || "Support Desk";
                break;
              }
            }

            if (takeoverStatus === "ACTIVE_AUTOMATION") {
              const patientWantsHuman = sorted.some(
                (m) =>
                  m.sender === "patient" &&
                  /(human|agent|support|doctor|help|talk|person)/i.test(m.text || "")
              );
              if (patientWantsHuman) {
                takeoverStatus = "HUMAN_TAKEOVER_REQUESTED";
              }
            }
          }

          if (takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" || takeoverStatus === "HUMAN_TAKEOVER_REQUESTED") {
            let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
            if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";

            list.push({
              id: "conv-" + cleanDigits,
              patientName: pName,
              mobile: "+91 " + cleanDigits,
              patientId: existing.patientId || "PT-" + cleanDigits.slice(-5),
              serviceType: "Meta WhatsApp Cloud API Desk",
              workflowState: "ACTIVE",
              takeoverStatus: takeoverStatus,
              assignedAgent: activeAgentName || serverTakeover?.agentName || existing.assignedAgent || (takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" ? "Muskan Sharma" : "Unassigned"),
              lastMessage: lastMsg ? lastMsg.text : "Active Thread",
              lastActivity: lastMsg ? lastMsg.time : "Live",
              messages: msgs,
            });
          }
        }
        setTakeovers(list);
      }
    } catch (e) {
      setTakeovers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTakeovers();
    const interval = setInterval(loadTakeovers, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleReturnToBot = async (mobile) => {
    try {
      const cleanDigits = (mobile || "").replace(/\D/g, "").slice(-10);
      await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_takeover",
          mobile: cleanDigits,
          active: false,
        }),
      });

      const saved = localStorage.getItem("mediconnect_wa_live_conversations");
      if (saved) {
        const parsed = JSON.parse(saved) || [];
        const updated = parsed.map((c) => {
          if ((c.mobile || "").replace(/\D/g, "").slice(-10) === cleanDigits) {
            return {
              ...c,
              takeoverStatus: "ACTIVE_AUTOMATION",
              assignedAgent: null,
            };
          }
          return c;
        });
        localStorage.setItem("mediconnect_wa_live_conversations", JSON.stringify(updated));
        setTakeovers(updated.filter((c) => c.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE"));
        toast.success(`Takeover released for ${mobile}. Automated bot resumed.`);
      }
    } catch (e) {}
  };

  const filtered = takeovers.filter((t) => {
    if (activeTab === "ACTIVE") return t.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE";
    if (activeTab === "REQUESTED") return t.takeoverStatus === "HUMAN_TAKEOVER_REQUESTED";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-amber-600" />
            Human Takeover Lifecycle Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time human agent interventions, paused bot sessions, and safe releases back to automation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold">
            {takeovers.length} Active Takeover{takeovers.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Lifecycle Status Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            activeTab === "ALL" ? "border-[#00629b] text-[#00629b]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          All Cases ({takeovers.length})
        </button>
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "ACTIVE" ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Active with Agent ({takeovers.filter((c) => c.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE").length})
        </button>
      </div>

      {/* Takeover Cases Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {takeovers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">No Active Human Takeovers</p>
            <p className="text-slate-500">All live WhatsApp conversations are currently handled by the automated bot.</p>
            <Link
              href="/conversations"
              className="inline-block mt-3 px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white font-semibold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              Open Live Conversations Desk
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Patient / Contact</th>
                  <th className="py-3 px-4">Channel / Context</th>
                  <th className="py-3 px-4">Last Interaction</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4">Lifecycle State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{t.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.mobile}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-slate-700 text-[11px]">{t.serviceType || "WhatsApp Live"}</span>
                    </td>
                    <td className="py-4 px-4 max-w-xs truncate text-slate-700">
                      {t.lastMessage}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800">
                      {t.assignedAgent || "Support Agent"}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {t.takeoverStatus}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleReturnToBot(t.mobile)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                      >
                        Return to Bot
                      </button>
                      <Link
                        href={`/conversations?phone=${(t.mobile || "").replace(/\D/g, "").slice(-10)}`}
                        className="px-3 py-1 bg-[#00629b] hover:bg-[#004f7c] text-white rounded-lg text-xs font-semibold cursor-pointer transition inline-flex items-center gap-1"
                      >
                        <span>Reply</span>
                        <ArrowRight className="w-3 h-3" />
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
