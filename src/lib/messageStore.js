import fs from "fs";
import path from "path";

// Supabase Cloud Database Configuration
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xskruftixchdbrsnitbh.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU";

const SUPABASE_BUCKET = "whatsapp-store";
const SUPABASE_FILE = "messages_history.json";

// Local Fallback Filesystem for offline/local environments
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_FILE = path.join(process.cwd(), "src/lib/messages_db.json");
const LOCAL_WRITABLE_FILE = IS_SERVERLESS ? path.join("/tmp", "messages_db.json") : BUNDLED_FILE;

if (!globalThis.__wa_messages_store) {
  globalThis.__wa_messages_store = new Map();
}

if (!globalThis.__wa_blocked_contacts) {
  globalThis.__wa_blocked_contacts = new Set();
}

if (!globalThis.__wa_reported_contacts) {
  globalThis.__wa_reported_contacts = new Map();
}

export function normalizeTimestampMs(ts) {
  if (!ts) return Date.now();
  const num = Number(ts);
  if (isNaN(num)) return Date.now();
  if (num < 10000000000) return num * 1000;
  return num;
}

export function formatISTTime(ts, fallback = "") {
  if (!ts && !fallback) return "";
  const num = Number(ts);
  if (!isNaN(num) && num > 0) {
    const ms = num < 10000000000 ? num * 1000 : num;
    try {
      return new Date(ms).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return fallback || "";
    }
  }
  return fallback || "";
}

/**
 * Fetch 100% Real Messages directly from Supabase whatsapp_messages Table
 */
async function fetchFromSupabaseTable() {
  try {
    const tableUrl = `${SUPABASE_URL}/rest/v1/whatsapp_messages?select=*&order=raw_timestamp.asc`;
    const res = await fetch(tableUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        const grouped = new Map();
        for (const row of rows) {
          const clean = String(row.phone_number).replace(/\D/g, "").slice(-10);
          if (!clean) continue;
          if (!grouped.has(clean)) grouped.set(clean, []);
          const rawMs = normalizeTimestampMs(row.raw_timestamp);
          const istTime = formatISTTime(rawMs, row.time);
          grouped.get(clean).push({
            id: row.id,
            sender: row.sender,
            agentName: row.agent_name,
            text: row.text,
            time: istTime,
            status: row.status,
            rawTimestamp: rawMs,
            apiResponse: row.api_response,
            media: row.api_response?.media || null,
            actionUrl: row.api_response?.actionUrl || null,
            actionTitle: row.api_response?.actionTitle || null,
            appUrl: row.api_response?.appUrl || null,
            appTitle: row.api_response?.appTitle || null,
            buttons: row.api_response?.buttons || null,
          });
        }
        // Ensure every conversation list is strictly sorted chronologically by rawTimestamp
        for (const [phone, list] of grouped.entries()) {
          list.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
        }
        globalThis.__wa_messages_store = grouped;
        return true;
      }
    }
  } catch (err) {
    console.warn("[messageStore] Supabase table query error, falling back:", err.message);
  }

  // Backup fallback: fetch from Supabase Cloud Storage
  try {
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${SUPABASE_FILE}?t=${Date.now()}`;
    const res = await fetch(fileUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const grouped = new Map();
      for (const [phone, msgs] of Object.entries(data)) {
        const clean = String(phone).replace(/\D/g, "").slice(-10);
        if (!clean) continue;
        grouped.set(clean, Array.isArray(msgs) ? msgs : []);
      }
      globalThis.__wa_messages_store = grouped;
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Insert or Update Message in Supabase Table & Cloud Store
 */
async function insertToSupabase(phoneNumber, message) {
  const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);

  // 1. Insert directly into Supabase whatsapp_messages Table
  try {
    const rawMs = normalizeTimestampMs(message.rawTimestamp);
    const istTime = formatISTTime(rawMs, message.time);
    const tableUrl = `${SUPABASE_URL}/rest/v1/whatsapp_messages`;
    await fetch(tableUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: message.id,
        phone_number: cleanNumber,
        sender: message.sender || "patient",
        agent_name: message.agentName || null,
        text: message.text || "",
        time: istTime,
        status: message.status || "delivered",
        raw_timestamp: rawMs,
        api_response: {
          ...(message.apiResponse || {}),
          media: message.media || undefined,
          actionUrl: message.actionUrl || undefined,
          actionTitle: message.actionTitle || undefined,
          appUrl: message.appUrl || undefined,
          appTitle: message.appTitle || undefined,
          buttons: message.buttons || undefined,
        },
      }),
    });
  } catch (e) {
    console.warn("[messageStore] Supabase table insert error:", e.message);
  }

  // 2. Also keep Supabase storage JSON file synchronized
  try {
    const all = {};
    for (const [k, v] of globalThis.__wa_messages_store.entries()) {
      if (k) all[k] = v;
    }
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_FILE}`;
    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(all, null, 2),
    });
  } catch (e) {}

  // 3. Keep local file in sync
  try {
    const all = {};
    for (const [k, v] of globalThis.__wa_messages_store.entries()) {
      if (k) all[k] = v;
    }
    fs.writeFileSync(LOCAL_WRITABLE_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (e) {}
}

// Initial bootstrap from Supabase Table
fetchFromSupabaseTable().catch(() => {});

export const messageStore = {
  async addMessage(phoneNumber, message) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return message;

    if (!globalThis.__wa_messages_store.has(cleanNumber)) {
      globalThis.__wa_messages_store.set(cleanNumber, []);
    }
    const list = globalThis.__wa_messages_store.get(cleanNumber);
    if (!list.some((m) => m.id === message.id)) {
      list.push(message);
    }

    await insertToSupabase(cleanNumber, message);
    return message;
  },

  async markAsRead(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return 0;

    let updatedCount = 0;
    const list = globalThis.__wa_messages_store.get(cleanNumber);
    if (Array.isArray(list)) {
      list.forEach((m) => {
        if (m.sender === "patient" && m.status !== "read") {
          m.status = "read";
          updatedCount++;
        }
      });
    }

    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/whatsapp_messages?phone_number=eq.${cleanNumber}&sender=eq.patient`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "read" }),
        }
      );
    } catch (e) {}

    return updatedCount;
  },

  async markAsRecovered(messageId) {
    if (!messageId) return false;
    for (const [phone, list] of globalThis.__wa_messages_store.entries()) {
      const msg = (list || []).find((m) => m.id === messageId || m.wamid === messageId);
      if (msg) {
        msg.status = "delivered";
        msg.recovered = true;
      }
    }

    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/whatsapp_messages?id=eq.${encodeURIComponent(messageId)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "delivered" }),
        }
      );
    } catch (e) {}

    return true;
  },

  async getMessages(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return [];

    await fetchFromSupabaseTable();
    return globalThis.__wa_messages_store.get(cleanNumber) || [];
  },

  async getAllMessages() {
    await fetchFromSupabaseTable();
    const all = {};
    for (const [key, value] of globalThis.__wa_messages_store.entries()) {
      all[key] = value;
    }
    return all;
  },

  async clear(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (cleanNumber) {
      globalThis.__wa_messages_store.delete(cleanNumber);
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_messages?phone_number=eq.${cleanNumber}`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
      } catch (e) {}
    } else {
      globalThis.__wa_messages_store.clear();
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_messages?id=neq.none`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
      } catch (e) {}
    }
  },

  async isContactBlocked(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return false;
    return globalThis.__wa_blocked_contacts.has(cleanNumber);
  },

  async toggleBlock(phoneNumber, blocked) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return false;
    if (blocked) {
      globalThis.__wa_blocked_contacts.add(cleanNumber);
    } else {
      globalThis.__wa_blocked_contacts.delete(cleanNumber);
    }
    return Boolean(blocked);
  },

  async getBlockedContacts() {
    return Array.from(globalThis.__wa_blocked_contacts);
  },

  async recordReport({ phoneNumber, reason, details, reportedBy, alsoBlock }) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return false;
    const reportEntry = {
      id: "rep-" + Date.now(),
      phoneNumber: cleanNumber,
      reason: reason || "Spam / Inappropriate behavior",
      details: details || "",
      reportedBy: reportedBy || "Admin Support",
      timestamp: Date.now(),
      alsoBlock: Boolean(alsoBlock),
    };
    const list = globalThis.__wa_reported_contacts.get(cleanNumber) || [];
    list.push(reportEntry);
    globalThis.__wa_reported_contacts.set(cleanNumber, list);

    if (alsoBlock) {
      globalThis.__wa_blocked_contacts.add(cleanNumber);
    }
    return reportEntry;
  },

  async getReportedContacts() {
    const reports = {};
    for (const [key, value] of globalThis.__wa_reported_contacts.entries()) {
      reports[key] = value;
    }
    return reports;
  },

  async isContactReported(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/\D/g, "").slice(-10);
    if (!cleanNumber) return false;
    const list = globalThis.__wa_reported_contacts.get(cleanNumber);
    return Array.isArray(list) && list.length > 0;
  },
};
