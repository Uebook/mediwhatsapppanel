"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  Clock,
  Radio,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  Users,
  Activity,
  ArrowRight,
  ChevronRight,
  FileCode2,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeConversations: 0,
    humanTakeovers: 0,
    openEscalations: 0,
    templatesCount: 0,
    messagesCount: 0,
    deliverySuccessRate: 100,
  });

  const [agents] = useState([
    { id: "ag-1", name: "Support Desk", role: "Primary Responder", status: "online", activeCases: 1, takeovers: 1, avatar: "SD" },
  ]);

  useEffect(() => {
    // 1. Calculate real live metrics from Supabase database
    fetch("/api/whatsapp/messages")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.allMessages) {
          const phones = Object.keys(data.allMessages);
          let totalMsgs = 0;
          let totalDelivered = 0;
          let takeoversCount = 0;
          let escalationsCount = 0;

          for (const msgs of Object.values(data.allMessages)) {
            totalMsgs += msgs.length;
            totalDelivered += msgs.filter((m) => m.status === "delivered" || m.status === "received").length;
            if (msgs.some((m) => m.sender === "agent")) takeoversCount++;
            if (msgs.some((m) => m.sender === "patient" && /(urgent|emergency|doctor|pain|help|delay|not working|panic|hospital|fever|serious)/i.test(m.text || ""))) escalationsCount++;
          }

          const successRate = totalMsgs > 0 ? Math.round((totalDelivered / totalMsgs) * 100) : 100;
          setStats((prev) => ({
            ...prev,
            activeConversations: phones.length,
            messagesCount: totalMsgs,
            humanTakeovers: takeoversCount,
            openEscalations: escalationsCount,
            deliverySuccessRate: successRate,
          }));
        }
      })
      .catch(() => {});

    // 2. Fetch live templates count from Insign/Meta API
    fetch("/api/whatsapp/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.templates) {
          setStats((prev) => ({ ...prev, templatesCount: data.templates.length }));
        }
      })
      .catch(() => {});
  }, []);

  const topCards = [
    {
      title: "Active Conversations",
      value: stats.activeConversations,
      change: "Live Cloud API",
      icon: MessageSquare,
      bg: "bg-sky-50",
      text: "text-[#00629b]",
      href: "/conversations",
    },
    {
      title: "Human Takeovers",
      value: stats.humanTakeovers,
      change: "Claimed by Agents",
      icon: UserCheck,
      bg: "bg-amber-50",
      text: "text-amber-600",
      href: "/takeovers",
    },
    {
      title: "Approved Templates",
      value: stats.templatesCount,
      change: "Live on Meta",
      icon: FileCode2,
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      href: "/templates",
    },
    {
      title: "Processed Messages",
      value: stats.messagesCount,
      change: "Recorded Live",
      icon: Radio,
      bg: "bg-purple-50",
      text: "text-purple-600",
      href: "/communication-logs",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#00629b]" />
            Operations & Support Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time patient communication monitoring, human takeover desk, and multichannel message routing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/conversations"
            className="flex items-center gap-2 px-3.5 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-lg shadow-subtle transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Live Chats</span>
          </Link>
        </div>
      </div>

      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {topCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle hover:border-slate-300 hover:shadow-card transition relative group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-slate-500 truncate">{card.title}</span>
                <div className={`p-1.5 rounded-md ${card.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${card.text}`} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{card.value}</div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>{card.change}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-[#00629b]" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Grid: Active Gateway & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Actions & Live Stream */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#00629b]" />
              <h2 className="text-sm font-bold text-slate-900">Live WhatsApp Stream</h2>
            </div>
            <Link
              href="/conversations"
              className="text-xs text-[#00629b] hover:text-[#004f7c] font-semibold flex items-center gap-1"
            >
              <span>View All Chats</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>WhatsApp Provider</span>
              <span className="text-emerald-700 font-mono">multichannel.insignsms.com</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>WABA ID</span>
              <span className="font-mono">2017846412282110 / 2427122974479832</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Verified Number</span>
              <span className="font-mono font-bold text-slate-900">+91 96670 19010</span>
            </div>
          </div>
        </div>

        {/* Right: Active Support Agent */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00629b]" />
              <h2 className="text-sm font-bold text-slate-900">Support Desk</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Online
            </span>
          </div>

          <div className="space-y-3">
            {agents.map((ag) => (
              <div key={ag.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#00629b] text-white font-bold flex items-center justify-center text-xs">
                    {ag.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">{ag.name}</h4>
                    <span className="text-[10px] text-slate-500">{ag.role}</span>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
