"use client";

import { useState, useEffect } from "react";
import {
  Radio,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";

export default function CommunicationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const getNormalizedTime = (item) => {
    if (item.rawTimestamp) {
      const num = Number(item.rawTimestamp);
      if (!isNaN(num) && num > 0) return num < 10000000000 ? num * 1000 : num;
    }
    if (item.created_at) {
      const d = new Date(item.created_at).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
    if (item.timestamp) {
      const num = Number(item.timestamp);
      if (!isNaN(num) && num > 0) return num < 10000000000 ? num * 1000 : num;
      const d = new Date(item.timestamp).getTime();
      if (!isNaN(d) && d > 0) return d;
    }
    return 0;
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/reports");
      const data = await res.json();

      let records = [];
      if (data.data && Array.isArray(data.data)) {
        records = data.data;
      } else {
        // Fallback to recorded messages
        const msgRes = await fetch("/api/whatsapp/messages");
        const msgData = await msgRes.json();
        if (msgData.success && msgData.allMessages) {
          for (const [phone, msgs] of Object.entries(msgData.allMessages)) {
            msgs.forEach((m) => {
              records.push({
                id: m.id,
                messageId: m.wamid || m.id,
                to: "+91 " + phone,
                patientName: "User (" + phone.slice(-4) + ")",
                template: m.text?.slice(0, 40) || "Text Message",
                channel: "InsignSMS MultiChannel",
                rawTimestamp: m.rawTimestamp,
                timestamp: m.time || "Recently",
                status: m.status === "failed" ? "FAILED" : "DELIVERED",
              });
            });
          }
        }
      }

      // Chronological descending sort (newest first - Issue 20)
      records.sort((a, b) => getNormalizedTime(b) - getNormalizedTime(a));
      setLogs(records);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const matchSearch =
      (l.patientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.to || l.phone || "").includes(search) ||
      (l.template || l.type || "").toLowerCase().includes(search.toLowerCase());

    const matchFilter = filter === "ALL" || (l.status || "").toUpperCase() === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-emerald-600" />
            InsignSMS Live Delivery & Communication Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time delivery receipts, message statuses, and report monitoring from multichannel.insignsms.com.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[#00629b] ${loading ? "animate-spin" : ""}`} />
          Refresh Reports
        </button>
      </div>

      {/* Filter and Search */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search phone number or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              filter === "ALL" ? "bg-[#00629b] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Logs ({logs.length})
          </button>
          <button
            onClick={() => setFilter("DELIVERED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              filter === "DELIVERED" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Delivered
          </button>
          <button
            onClick={() => setFilter("FAILED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              filter === "FAILED" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 text-[#00629b] animate-spin" />
            <span>Fetching live report from InsignSMS API...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No communication logs found yet. Sent messages and delivery receipts will appear here in real-time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Recipient Phone</th>
                  <th className="py-3 px-4">Message / Template</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l, idx) => (
                  <tr key={l.id || idx} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900">
                      {l.to || l.phone}
                    </td>
                    <td className="py-4 px-4 text-slate-700 max-w-xs truncate">
                      {l.template || l.type || "Transactional Template"}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-600">
                      {l.channel || "InsignSMS API"}
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                      {l.timestamp}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          (l.status || "").toLowerCase() === "delivered" || (l.status || "").toLowerCase() === "read"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {(l.status || "").toLowerCase() === "delivered" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {l.status || "SENT"}
                      </span>
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
