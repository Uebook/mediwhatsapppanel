"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Network,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  Radio,
  Send,
  FileCode2,
  CreditCard,
  ShieldAlert,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  Sparkles,
} from "lucide-react";

export default function Sidebar({ open, onToggle, mobileOpen, onCloseMobile }) {
  const pathname = usePathname();

  const [counts, setCounts] = useState({
    conversations: 0,
    takeovers: 0,
    escalations: 0,
    templates: 0,
    recovery: 0,
  });

  const syncRealCounts = async () => {
    try {
      const msgRes = await fetch("/api/whatsapp/messages");
      const msgData = await msgRes.json();
      if (msgData.success && msgData.allMessages) {
        // Read saved local conversations map to mirror takeovers and escalations screens
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

        const cleanPhonesSet = new Set();
        let takeoversCount = 0;
        let escalationsCount = 0;
        let recoveryCount = 0;

        for (const [phone, msgs] of Object.entries(msgData.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          cleanPhonesSet.add(cleanDigits);

          const existing = savedMap[cleanDigits] || {};
          const hasAgentMsg = msgs.some((m) => m.sender === "agent");
          const patientWantsHuman = msgs.some(
            (m) =>
              m.sender === "patient" &&
              /(human|agent|support|doctor|help|talk|person)/i.test(m.text || "")
          );

          // 1. Takeover Status calculation strictly matching takeovers/page.js
          const serverTakeover = msgData.takeoverContacts
            ? msgData.takeoverContacts[cleanDigits]
            : null;
          let takeoverStatus = existing.takeoverStatus;
          if (serverTakeover !== undefined && serverTakeover !== null) {
            takeoverStatus = serverTakeover.active
              ? "HUMAN_OWNERSHIP_ACTIVE"
              : "ACTIVE_AUTOMATION";
          } else if (!takeoverStatus) {
            if (hasAgentMsg) takeoverStatus = "HUMAN_OWNERSHIP_ACTIVE";
            else if (patientWantsHuman) takeoverStatus = "HUMAN_TAKEOVER_REQUESTED";
            else takeoverStatus = "ACTIVE_AUTOMATION";
          }

          if (
            takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" ||
            takeoverStatus === "HUMAN_TAKEOVER_REQUESTED"
          ) {
            takeoversCount++;
          }

          // 2. Escalations count strictly matching escalations/page.js
          const urgentMsg = msgs
            .slice(-5)
            .find(
              (m) =>
                m.sender === "patient" &&
                /(urgent|emergency|doctor|pain|help|delay|not working|panic|hospital|fever|serious)/i.test(
                  m.text || ""
                )
            );
          let priority = existing.escalationTag;
          if (!priority || priority === "NORMAL") {
            if (urgentMsg) priority = "HIGH";
          }
          if (
            priority === "HIGH" ||
            priority === "MEDIUM" ||
            priority === "P1 Critical" ||
            priority === "Follow-up Required"
          ) {
            escalationsCount++;
          }

          // 3. Workflow Recovery count strictly matching recovery/page.js
          if (msgs.some((m) => m.status === "failed")) {
            recoveryCount++;
          }
        }

        setCounts((prev) => ({
          ...prev,
          conversations: cleanPhonesSet.size,
          takeovers: takeoversCount,
          escalations: escalationsCount,
          recovery: recoveryCount,
        }));
      }
    } catch (e) {}

    // Fetch real templates count from Insign/Meta
    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json();
      if (data.success && data.templates) {
        setCounts((prev) => ({ ...prev, templates: data.templates.length }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    syncRealCounts();
    const interval = setInterval(syncRealCounts, 4000);
    return () => clearInterval(interval);
  }, []);

  const navSections = [
    {
      label: "LIVE DESK",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        {
          name: "Live Conversations",
          href: "/conversations",
          icon: MessageSquare,
          badge: counts.conversations > 0 ? String(counts.conversations) : null,
          badgeColor: "bg-emerald-500 text-white",
        },
        {
          name: "Human Takeovers",
          href: "/takeovers",
          icon: UserCheck,
          badge: counts.takeovers > 0 ? String(counts.takeovers) : null,
          badgeColor: "bg-amber-500 text-white",
        },
        {
          name: "Escalations",
          href: "/escalations",
          icon: AlertTriangle,
          badge: counts.escalations > 0 ? String(counts.escalations) : null,
          badgeColor: "bg-rose-500 text-white",
        },
      ],
    },
    {
      label: "WORKFLOWS & OPS",
      items: [
        { name: "Workflows Matrix", href: "/workflows", icon: Network },
        {
          name: "Workflow Recovery",
          href: "/recovery",
          icon: RotateCcw,
          badge: counts.recovery > 0 ? String(counts.recovery) : null,
          badgeColor: "bg-indigo-500 text-white",
        },
        { name: "Communication Logs", href: "/communication-logs", icon: Radio },
      ],
    },
    {
      label: "COMMUNICATIONS",
      items: [
        { name: "Broadcasts", href: "/broadcasts", icon: Send },
        {
          name: "WhatsApp Templates",
          href: "/templates",
          icon: FileCode2,
          badge: counts.templates > 0 ? String(counts.templates) : null,
          badgeColor: "bg-[#00629b] text-white",
        },
      ],
    },
    {
      label: "SYSTEM",
      items: [
        { name: "Audit Trail", href: "/audit-logs", icon: ShieldAlert },
        { name: "Team & Roles", href: "/users-roles", icon: Users },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200/90 text-slate-700 transition-all duration-300 flex flex-col ${
          open ? "w-64" : "w-20"
        } ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#00629b] flex items-center justify-center flex-shrink-0 shadow-xs">
              <span className="text-white font-bold text-sm tracking-tight">M</span>
            </div>
            {open && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 tracking-tight">MediConnect</span>
                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">WA</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  Operations Portal
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="hidden lg:flex w-7 h-7 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/80 items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-thin">
          {navSections.map((sec) => (
            <div key={sec.label} className="space-y-1">
              {open && (
                <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
                  {sec.label}
                </div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => mobileOpen && onCloseMobile()}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-sky-50 text-[#00629b] font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#00629b]" : "text-slate-400"}`} />
                      {open && <span className="truncate">{item.name}</span>}
                    </div>
                    {open && item.badge && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info */}
        {open && (
          <div className="p-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Multichannel
            </span>
            <span className="font-mono text-[10px]">v1.0</span>
          </div>
        )}
      </aside>
    </>
  );
}
