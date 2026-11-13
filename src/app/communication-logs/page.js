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
  RotateCcw,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

export default function CommunicationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState(null);

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
                phone: phone,
                patientName: "User (" + phone.slice(-4) + ")",
                template: m.text?.slice(0, 45) || "Text Message",
                fullText: m.text || "",
                channel: "InsignSMS MultiChannel",
                rawTimestamp: m.rawTimestamp,
                timestamp: m.time || "Recently",
                status: m.status === "failed" ? "FAILED" : "DELIVERED",
                media: m.media || m.apiResponse?.media || null,
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

  const handleSendAgain = async (item) => {
    const cleanPhone = String(item.phone || item.to || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Invalid phone number for re-dispatch");
      return;
    }

    const actionKey = item.id || item.messageId || cleanPhone;
    setRetryingId(actionKey);

    try {
      const rawText = item.fullText || item.text || item.template || "";
      let templateName = null;
      let templateParams = [];
      let messageText = rawText;

      // Extract template name & params if this was a template dispatch
      const templateMatch = rawText.match(/\[Template:\s*([a-zA-Z0-9_-]+)\](?:\s*\(([^)]+)\))?/i);
      if (templateMatch) {
        templateName = templateMatch[1];
        if (templateMatch[2]) {
          templateParams = templateMatch[2].split(",").map((s) => s.trim());
        }
        messageText = null;
      }

      const payload = {
        to: cleanPhone,
        message: messageText,
        templateName: templateName,
        templateParams: templateParams,
        media: item.media || undefined,
        agentName: "Support Desk",
      };

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Message successfully re-sent to +91 ${cleanPhone}!`);
        // Mark as DELIVERED in table
        setLogs((prev) =>
          prev.map((l) =>
            l.id === item.id || l.messageId === item.messageId
              ? { ...l, status: "DELIVERED", timestamp: "Just now" }
              : l
          )
        );

        // Mark recovered in backend message store
        if (item.id || item.messageId) {
          fetch("/api/whatsapp/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "recover_workflow", id: item.id || item.messageId }),
          }).catch(() => {});
        }
      } else {
        const errMsg = data.error || data.message || "Failed to dispatch via WhatsApp Gateway";
        toast.error(`Re-send Failed: ${errMsg}`, { duration: 5000 });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

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
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l, idx) => (
                  <tr key={l.id || idx} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900">
                      {l.to || l.phone}
                    </td>
                    <td className="py-4 px-4 text-slate-700 max-w-xs truncate" title={l.fullText || l.template}>
                      {l.template || l.type || "Transactional Template"}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-600">
                      {l.channel || "InsignSMS API"}
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                      {l.timestamp}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          (l.status || "").toLowerCase() === "delivered" || (l.status || "").toLowerCase() === "read"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {(l.status || "").toLowerCase() === "delivered" || (l.status || "").toLowerCase() === "read" ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        )}
                        {l.status || "SENT"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {(l.status || "").toLowerCase() === "failed" ? (
                        <button
                          type="button"
                          onClick={() => handleSendAgain(l)}
                          disabled={retryingId === (l.id || l.messageId || l.phone || l.to)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
                          title="Re-send this message directly via Meta WhatsApp API"
                        >
                          {retryingId === (l.id || l.messageId || l.phone || l.to) ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Send Again</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Delivered
                        </span>
                      )}
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
