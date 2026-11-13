"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Plus,
  Search,
  X,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Eye,
  Trash2,
  Sparkles,
  Radio,
  FileText,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kpiFilter, setKpiFilter] = useState("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [totalActiveAudience, setTotalActiveAudience] = useState(5);

  const [form, setForm] = useState({
    campaignName: "",
    audience: "All Active Patients",
    customPhones: "",
    template: "mediconnect_test_message",
    sendImmediately: true,
  });

  // Fetch broadcasts from live Supabase Cloud DB
  const loadBroadcastsFromDb = async () => {
    try {
      setLoadingBroadcasts(true);
      const res = await fetch("/api/whatsapp/broadcasts", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.broadcasts)) {
        setBroadcasts(data.broadcasts);
        if (data.totalActivePatients) {
          setTotalActiveAudience(data.totalActivePatients);
        }
      }
    } catch (err) {
      console.warn("Failed to load broadcasts from DB:", err.message);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const VERIFIED_APPROVED_TEMPLATES = [
    {
      id: "tmpl_mediconnect_test",
      name: "mediconnect_test_message",
      category: "UTILITY",
      language: "en_US",
      status: "APPROVED",
      content:
        "Hello {{1}}, this is a test message from MediConnect. Your reference number is {{2}}. Thank you for choosing MediConnect.fit.",
      lastUpdated: "Meta / Insign (Live Approved)",
    },
    {
      id: "tmpl_navratri_post",
      name: "navratri_post",
      category: "MARKETING",
      language: "en_US",
      status: "APPROVED",
      content:
        "Wishing everyone a very Happy Navratri! May Maa Durga bless you with happiness, good health, success and prosperity.",
      header: "IMAGE",
      lastUpdated: "Meta / Insign (Live Approved)",
    },
  ];

  // Fetch live Meta approved templates
  const loadLiveTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch("/api/whatsapp/templates", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
        const map = new Map();
        VERIFIED_APPROVED_TEMPLATES.forEach((t) => map.set(t.name, t));
        data.templates.forEach((t) => map.set(t.name, t));
        const merged = Array.from(map.values());
        setTemplates(merged);
        if (!form.template) {
          setForm((prev) => ({ ...prev, template: merged[0].name }));
        }
      } else {
        setTemplates(VERIFIED_APPROVED_TEMPLATES);
        if (!form.template) {
          setForm((prev) => ({ ...prev, template: VERIFIED_APPROVED_TEMPLATES[0].name }));
        }
      }
    } catch (err) {
      setTemplates(VERIFIED_APPROVED_TEMPLATES);
      if (!form.template) {
        setForm((prev) => ({ ...prev, template: VERIFIED_APPROVED_TEMPLATES[0].name }));
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadBroadcastsFromDb();
    loadLiveTemplates();
  }, []);

  // Handle campaign creation and live dispatch
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    if (!form.template) {
      toast.error("Please select a live approved template");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      form.sendImmediately
        ? "Dispatching broadcast via Meta Cloud API..."
        : "Scheduling broadcast in Database..."
    );

    try {
      let customNumbersArray = [];
      if (form.audience === "Custom Test Batch" && form.customPhones.trim()) {
        customNumbersArray = form.customPhones
          .split(/[,;\n]/)
          .map((s) => s.replace(/\D/g, "").slice(-10))
          .filter(Boolean);
      }

      const res = await fetch("/api/whatsapp/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: form.campaignName.trim(),
          template: form.template,
          audience: form.audience,
          customPhones: customNumbersArray,
          sendImmediately: form.sendImmediately,
          agentName: "Super Admin",
        }),
      });

      const result = await res.json();
      if (result.success && result.broadcast) {
        setBroadcasts((prev) => [result.broadcast, ...prev]);
        setShowModal(false);
        setForm({
          campaignName: "",
          audience: "All Active Patients",
          customPhones: "",
          template: templates[0]?.name || "mediconnect_test_message",
          sendImmediately: true,
        });

        if (form.sendImmediately) {
          if (result.sentCount > 0) {
            toast.success(
              `🚀 Broadcast dispatched live! Sent to ${result.sentCount} verified recipient(s).`,
              { id: toastId }
            );
          } else {
            toast.error(
              `Broadcast failed: ${result.error || "Meta rejected template or no valid numbers"}`,
              { id: toastId, duration: 6000 }
            );
          }
        } else {
          toast.success("Broadcast scheduled and synced with Database.", {
            id: toastId,
          });
        }
      } else {
        toast.error(result.error || "Failed to create campaign", { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete campaign from DB
  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this broadcast campaign from the database?")) {
      return;
    }

    try {
      const res = await fetch(`/api/whatsapp/broadcasts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setBroadcasts((prev) => prev.filter((b) => b.id !== id));
        if (selectedCampaign?.id === id) setSelectedCampaign(null);
        toast.success("Campaign deleted from database.");
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (err) {
      toast.error(`Error deleting: ${err.message}`);
    }
  };

  // Filtered broadcast campaigns
  const filteredBroadcasts = broadcasts.filter((b) => {
    const matchesSearch =
      b.campaignName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.template?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.audience?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || b.status?.toUpperCase() === statusFilter;

    let matchesKpi = true;
    if (kpiFilter === "DISPATCHED") {
      matchesKpi = (b.sent || 0) > 0 || b.status?.toUpperCase() === "COMPLETED";
    } else if (kpiFilter === "HIGH_DELIVERY") {
      const rate = b.sent > 0 ? (b.delivered / b.sent) * 100 : 100;
      matchesKpi = rate >= 80;
    } else if (kpiFilter === "TARGET_AUDIENCE") {
      matchesKpi = (b.targetAudienceCount || b.target_count || 0) > 0 || b.status?.toUpperCase() === "QUEUED" || b.status?.toUpperCase() === "COMPLETED";
    }

    return matchesSearch && matchesStatus && matchesKpi;
  });

  // Calculate live KPI metrics
  const totalSent = broadcasts.reduce((acc, b) => acc + (b.sent || 0), 0);
  const totalDelivered = broadcasts.reduce((acc, b) => acc + (b.delivered || 0), 0);
  const totalRead = broadcasts.reduce((acc, b) => acc + (b.read || 0), 0);
  const avgDeliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100;
  const avgReadRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 85;

  const activeTemplateObj = templates.find((t) => t.name === form.template);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Send className="w-6 h-6 text-[#00629b]" />
            WhatsApp Broadcasts & Patient Engagement
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Meta Business outbound healthcare announcements, health camp alerts, and preventive reminders synced with Cloud DB.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadBroadcastsFromDb();
              loadLiveTemplates();
              toast.success("Refreshed live data from Database.");
            }}
            disabled={loadingBroadcasts}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBroadcasts ? "animate-spin" : ""}`} />
            Sync DB
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Live Broadcast
          </button>
        </div>
      </div>

      {/* KPI Cards (Issue 21: Made All 4 Clickable with Active Filter State) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setKpiFilter("ALL");
            setStatusFilter("ALL");
            toast.success("Showing all broadcast campaigns");
          }}
          className={`bg-white p-4 rounded-2xl border text-left transition cursor-pointer shadow-2xs ${
            kpiFilter === "ALL" && statusFilter === "ALL"
              ? "border-[#00629b] ring-2 ring-[#00629b]/20"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Campaigns</span>
            <Radio className="w-4 h-4 text-[#00629b]" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{broadcasts.length}</div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Live in Database
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setKpiFilter("DISPATCHED");
            toast.success("Filtered to dispatched campaigns");
          }}
          className={`bg-white p-4 rounded-2xl border text-left transition cursor-pointer shadow-2xs ${
            kpiFilter === "DISPATCHED"
              ? "border-emerald-600 ring-2 ring-emerald-600/20"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Messages Dispatched</span>
            <Send className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalSent.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500 mt-1">Across verified patient base</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setKpiFilter("HIGH_DELIVERY");
            toast.success("Filtered to high delivery rate campaigns (>=80%)");
          }}
          className={`bg-white p-4 rounded-2xl border text-left transition cursor-pointer shadow-2xs ${
            kpiFilter === "HIGH_DELIVERY"
              ? "border-teal-600 ring-2 ring-teal-600/20"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Delivery Rate</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{avgDeliveryRate}%</div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            {totalDelivered} messages delivered
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setKpiFilter("TARGET_AUDIENCE");
            toast.success("Filtered to active audience campaigns");
          }}
          className={`bg-white p-4 rounded-2xl border text-left transition cursor-pointer shadow-2xs ${
            kpiFilter === "TARGET_AUDIENCE"
              ? "border-purple-600 ring-2 ring-purple-600/20"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Target Audience</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalActiveAudience}</div>
          <p className="text-[11px] text-slate-500 mt-1">Verified patient phones in DB</p>
        </button>
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search campaigns, templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#00629b] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {["ALL", "COMPLETED", "QUEUED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                statusFilter === st
                  ? "bg-[#00629b] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Broadcasts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loadingBroadcasts ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-[#00629b] animate-spin" />
            <span>Loading live broadcast campaigns from database...</span>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <p className="text-sm font-semibold text-slate-700">No broadcast campaigns found</p>
            <p className="max-w-md mx-auto text-slate-500">
              Create an outbound broadcast campaign to send verified announcements, appointment reminders, or health camps to active patients.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#00629b] font-semibold hover:underline cursor-pointer inline-flex items-center gap-1.5 text-xs pt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create your first broadcast campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-bold">Campaign Name</th>
                  <th className="py-3 px-4 font-bold">Audience Segment</th>
                  <th className="py-3 px-4 font-bold">Live Meta Template</th>
                  <th className="py-3 px-4 font-bold">Scheduled / Dispatched</th>
                  <th className="py-3 px-4 font-bold text-center">Sent</th>
                  <th className="py-3 px-4 font-bold text-center">Delivered</th>
                  <th className="py-3 px-4 font-bold text-center">Read Rate</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBroadcasts.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedCampaign(b)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <td className="py-4 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400 font-normal">
                          {b.id}
                        </span>
                        <span className="truncate max-w-[240px]">{b.campaignName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        {b.audience}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[#00629b] text-[11px]">
                      <span className="bg-[#00629b]/10 text-[#00629b] px-2 py-0.5 rounded font-semibold">
                        {b.template}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                      {b.scheduledTime}
                    </td>
                    <td className="py-4 px-4 text-slate-900 font-bold text-center">
                      {b.sent || 0}
                    </td>
                    <td className="py-4 px-4 text-slate-900 font-bold text-center">
                      {b.delivered || 0}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {b.sent > 0 ? `${Math.round((b.read / b.sent) * 100)}%` : "0%"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          b.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : b.status === "FAILED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : b.status === "IN_PROGRESS"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaign(b);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#00629b] hover:bg-slate-100 transition"
                          title="View Campaign Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(b.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Live Broadcast */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00629b]" />
                  Create Live WhatsApp Broadcast
                </h3>
                <p className="text-[11px] text-slate-500">
                  Outbound campaign sent via Meta Cloud API and saved to Database.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Campaign Title */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Campaign Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Free Oral Health Checkup Drive"
                  value={form.campaignName}
                  onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-[#00629b] focus:bg-white transition"
                  required
                />
              </div>

              {/* Template Selection */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Live Approved Meta Template <span className="text-rose-500">*</span>
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-[#00629b]" />
                    <span>Loading Meta templates...</span>
                  </div>
                ) : (
                  <select
                    value={form.template}
                    onChange={(e) => setForm({ ...form, template: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-[#00629b] focus:bg-white cursor-pointer"
                  >
                    {templates.map((t) => (
                      <option key={t.id || t.name} value={t.name}>
                        {t.name} ({t.category || "UTILITY"} - {t.status || "APPROVED"})
                      </option>
                    ))}
                  </select>
                )}

                {/* Template Content Preview Box */}
                {activeTemplateObj && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/90 text-slate-700 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Template Message Preview:
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-800 italic font-mono bg-white p-2 rounded-lg border border-slate-200">
                      "{activeTemplateObj.content || activeTemplateObj.name}"
                    </p>
                  </div>
                )}
              </div>

              {/* Audience Segment Selection */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Target Audience Segment
                </label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-[#00629b] focus:bg-white cursor-pointer"
                >
                  <option value="All Active Patients">
                    All Active Patients ({totalActiveAudience} verified contacts in DB)
                  </option>
                  <option value="Consultation Follow-ups">
                    Consultation Follow-ups (Recent booked patients)
                  </option>
                  <option value="Chronic Care Cohort">
                    Chronic Care Cohort (Preventive reminders)
                  </option>
                  <option value="Custom Test Batch">
                    Custom Phone Numbers (Test instant delivery)
                  </option>
                </select>
              </div>

              {/* Custom Numbers input if selected */}
              {form.audience === "Custom Test Batch" && (
                <div className="animate-in fade-in duration-150">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Enter Target Phone Numbers (comma-separated):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="918439993033, 917808455740"
                    value={form.customPhones}
                    onChange={(e) => setForm({ ...form, customPhones: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-[#00629b] focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Enter test 10-digit or international format numbers to verify live delivery.
                  </p>
                </div>
              )}

              {/* Dispatch Timing Toggle */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.sendImmediately}
                    onChange={(e) => setForm({ ...form, sendImmediately: e.target.checked })}
                    className="rounded text-[#00629b] focus:ring-0 cursor-pointer w-4 h-4"
                  />
                  <span>Dispatch Immediately via Live Meta WhatsApp Cloud API</span>
                </label>
                <p className="text-[10px] text-slate-600 pl-6">
                  {form.sendImmediately
                    ? "Messages will be dispatched in real-time through the Insign/Meta WhatsApp gateway and tracked in database."
                    : "Campaign will be stored in database with QUEUED status to be triggered on demand."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{form.sendImmediately ? "Launch Live Broadcast" : "Schedule Campaign"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Details Drawer / Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                  {selectedCampaign.id}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedCampaign.campaignName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Live Template</span>
                <p className="font-mono text-[#00629b] font-semibold">{selectedCampaign.template}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Sent</span>
                  <span className="text-base font-bold text-slate-900">{selectedCampaign.sent || 0}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block">Delivered</span>
                  <span className="text-base font-bold text-emerald-800">{selectedCampaign.delivered || 0}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Audience Segment:</span>
                  <span className="font-semibold text-slate-800">{selectedCampaign.audience}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled:</span>
                  <span className="font-semibold text-slate-800">{selectedCampaign.scheduledTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`font-bold ${
                      selectedCampaign.status === "COMPLETED"
                        ? "text-emerald-700"
                        : selectedCampaign.status === "FAILED"
                        ? "text-rose-700"
                        : "text-amber-700"
                    }`}
                  >
                    {selectedCampaign.status}
                  </span>
                </div>
              </div>

              {selectedCampaign.failureReason && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] space-y-1">
                  <span className="font-bold block uppercase tracking-wider text-[10px] text-rose-600">
                    Gateway Error Details:
                  </span>
                  <p className="font-mono">{selectedCampaign.failureReason}</p>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDelete(selectedCampaign.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete from DB
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCampaign(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
