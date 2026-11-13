"use client";

import { useState, useEffect } from "react";
import {
  FileCode2,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Send,
  Phone,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Form State for Creating New Template
  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    headerFormat: "NONE",
    headerText: "",
    bodyText: "",
    footerText: "",
    buttonType: "NONE",
    buttonTitle: "",
    buttonUrl: "",
    buttonPhone: "",
  });

  // Form State for Editing Template
  const [editForm, setEditForm] = useState({
    category: "UTILITY",
    bodyText: "",
  });

  const fetchTemplates = async (isManual = false) => {
    if (isManual) setSyncing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json();

      if (data.success && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        if (isManual) toast.success(`Synced ${data.templates.length} templates successfully`);
      } else {
        toast.error(data.error || "Failed to load templates");
      }
    } catch (err) {
      toast.error("Network error while fetching templates");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success("Template text copied to clipboard");
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Create Template Handler
  // ─────────────────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bodyText.trim()) {
      toast.error("Template name and body text are required");
      return;
    }

    const cleanName = form.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");

    const components = [];

    // Header Component
    if (form.headerFormat !== "NONE") {
      if (form.headerFormat === "TEXT" && form.headerText.trim()) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: form.headerText.trim(),
        });
      } else if (form.headerFormat !== "TEXT") {
        components.push({
          type: "HEADER",
          format: form.headerFormat,
        });
      }
    }

    // Body Component
    components.push({
      type: "BODY",
      text: form.bodyText.trim(),
    });

    // Footer Component
    if (form.footerText.trim()) {
      components.push({
        type: "FOOTER",
        text: form.footerText.trim(),
      });
    }

    // Button Component
    if (form.buttonType === "URL" && form.buttonTitle && form.buttonUrl) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: form.buttonTitle.trim(),
            url: form.buttonUrl.trim(),
          },
        ],
      });
    } else if (form.buttonType === "PHONE_NUMBER" && form.buttonTitle && form.buttonPhone) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "PHONE_NUMBER",
            text: form.buttonTitle.trim(),
            phone_number: form.buttonPhone.trim(),
          },
        ],
      });
    } else if (form.buttonType === "QUICK_REPLY" && form.buttonTitle) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: form.buttonTitle.trim(),
          },
        ],
      });
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          category: form.category,
          language: form.language,
          components,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Template "${cleanName}" submitted for approval!`);
        setShowCreateModal(false);
        setForm({
          name: "",
          category: "UTILITY",
          language: "en_US",
          headerFormat: "NONE",
          headerText: "",
          bodyText: "",
          footerText: "",
          buttonType: "NONE",
          buttonTitle: "",
          buttonUrl: "",
          buttonPhone: "",
        });
        fetchTemplates();
      } else {
        toast.error(data.error || "Failed to create template");
      }
    } catch (err) {
      toast.error("Network error submitting template");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. Edit Template Handler
  // ─────────────────────────────────────────────────────────────
  const openEditModal = (tmpl) => {
    setSelectedTemplate(tmpl);
    setEditForm({
      category: tmpl.category || "UTILITY",
      bodyText: tmpl.content || "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          category: editForm.category,
          components: [
            {
              type: "BODY",
              text: editForm.bodyText.trim(),
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Template "${selectedTemplate.name}" updated successfully!`);
        setShowEditModal(false);
        fetchTemplates();
      } else {
        toast.error(data.error || "Failed to update template");
      }
    } catch (err) {
      toast.error("Network error updating template");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. Delete Template Handler
  // ─────────────────────────────────────────────────────────────
  const handleDelete = async (tmpl) => {
    if (!confirm(`Are you sure you want to delete template "${tmpl.name}" (ID: ${tmpl.id})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/whatsapp/templates?name=${encodeURIComponent(tmpl.name)}&id=${encodeURIComponent(tmpl.id)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Template "${tmpl.name}" deleted successfully!`);
        setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
      } else {
        toast.error(data.error || "Failed to delete template");
      }
    } catch (err) {
      toast.error("Network error deleting template");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileCode2 className="w-6 h-6 text-[#00629b]" />
            Meta WhatsApp Templates Library
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time approved templates fetched directly from Meta Cloud API for WABA <span className="font-mono text-slate-700 font-semibold">2017846412282110</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
          <button
            onClick={() => fetchTemplates(true)}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#00629b] ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Meta"}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <Loader2 className="w-8 h-8 text-[#00629b] animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading templates directly from Meta Graph API...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No Templates Found</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">Click "Create Template" to submit a new template to Meta for approval.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            + Create First Template
          </button>
        </div>
      ) : (
        /* Templates Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-[#00629b] transition shadow-xs group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-[#00629b] truncate max-w-[180px]">
                    {tmpl.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      tmpl.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {tmpl.status === "APPROVED" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {tmpl.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                  <span className="font-semibold text-slate-700">{tmpl.category}</span>
                  <span>•</span>
                  <span className="uppercase">{tmpl.language}</span>
                  {tmpl.header && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        Header: {tmpl.header}
                      </span>
                    </>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {tmpl.content}
                </div>

                {tmpl.buttons && tmpl.buttons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tmpl.buttons.map((btn, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700"
                      >
                        🔘 {btn.text} ({btn.type})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons: Copy, Edit, Delete */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-mono">ID: {tmpl.id}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(tmpl.content)}
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-[11px] font-medium p-1 hover:bg-slate-100 rounded-md cursor-pointer"
                    title="Copy Text"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>

                  <button
                    onClick={() => openEditModal(tmpl)}
                    className="flex items-center gap-1 text-[#00629b] hover:text-[#004f7c] text-[11px] font-semibold p-1 hover:bg-sky-50 rounded-md cursor-pointer"
                    title="Edit Template"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(tmpl)}
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-800 text-[11px] font-semibold p-1 hover:bg-rose-50 rounded-md cursor-pointer"
                    title="Delete Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CREATE TEMPLATE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#00629b]" />
                Create New WhatsApp Template
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Submit a new template to Meta for instant approval. Use <span className="font-mono font-bold text-slate-700">{"{{1}}"}</span>, <span className="font-mono font-bold text-slate-700">{"{{2}}"}</span> for dynamic parameters.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Template Name (e.g. appointment_reminder_v2) *
                </label>
                <input
                  type="text"
                  placeholder="lowercase_with_underscores_only"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-[#00629b] focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                  >
                    <option value="UTILITY">UTILITY (Notifications & Reminders)</option>
                    <option value="MARKETING">MARKETING (Promotions & Offers)</option>
                    <option value="AUTHENTICATION">AUTHENTICATION (OTP Codes)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Language *</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                  >
                    <option value="en_US">English (US)</option>
                    <option value="en_IN">English (India)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              {/* Header */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Header Format (Optional)</label>
                <select
                  value={form.headerFormat}
                  onChange={(e) => setForm({ ...form, headerFormat: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                >
                  <option value="NONE">None (No Header)</option>
                  <option value="TEXT">Text Header</option>
                  <option value="IMAGE">Image Header</option>
                  <option value="DOCUMENT">Document Header</option>
                  <option value="LOCATION">Location Header</option>
                </select>
              </div>

              {form.headerFormat === "TEXT" && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Header Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Appointment Confirmation"
                    value={form.headerText}
                    onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Body Text Content *</label>
                <textarea
                  rows={4}
                  placeholder="Hello {{1}}, your consultation with Dr. {{2}} is confirmed for {{3}} at {{4}}. Link: {{5}}"
                  value={form.bodyText}
                  onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-[#00629b] focus:bg-white"
                  required
                />
              </div>

              {/* Footer */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Footer Text (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Thank you - Team MediConnect.fit"
                  value={form.footerText}
                  onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                />
              </div>

              {/* Buttons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-semibold text-slate-700 block">Interactive Button (Optional)</label>
                <select
                  value={form.buttonType}
                  onChange={(e) => setForm({ ...form, buttonType: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                >
                  <option value="NONE">No Button</option>
                  <option value="URL">Call to Action (Website URL)</option>
                  <option value="PHONE_NUMBER">Call Phone Number</option>
                  <option value="QUICK_REPLY">Quick Reply Button</option>
                </select>

                {form.buttonType !== "NONE" && (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      placeholder="Button Title (e.g. View Prescription / Call Support)"
                      value={form.buttonTitle}
                      onChange={(e) => setForm({ ...form, buttonTitle: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                    {form.buttonType === "URL" && (
                      <input
                        type="url"
                        placeholder="https://mediconnect.fit/portal"
                        value={form.buttonUrl}
                        onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                      />
                    )}
                    {form.buttonType === "PHONE_NUMBER" && (
                      <input
                        type="tel"
                        placeholder="+919667019010"
                        value={form.buttonPhone}
                        onChange={(e) => setForm({ ...form, buttonPhone: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Submitting to Meta..." : "Submit for Approval"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* EDIT TEMPLATE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showEditModal && selectedTemplate && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setShowEditModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[92vh] overflow-y-auto my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#00629b]" />
                Edit Template: {selectedTemplate.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00629b]"
                >
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Body Text Content</label>
                <textarea
                  rows={5}
                  value={editForm.bodyText}
                  onChange={(e) => setEditForm({ ...editForm, bodyText: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:border-[#00629b] focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#00629b] hover:bg-[#004f7c] text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
