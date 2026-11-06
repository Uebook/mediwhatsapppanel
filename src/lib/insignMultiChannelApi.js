/**
 * Official InsignSMS MultiChannel WhatsApp & Email API Client
 * Built from the official Postman Collection & Developer Documentation
 * Base URL: https://multichannel.insignsms.com
 */

const BASE_URL = process.env.INSIGN_BASE_URL || "https://multichannel.insignsms.com";

export const INSIGN_CONFIG = {
  baseUrl: BASE_URL,
  apiToken:
    process.env.INSIGN_WHATSAPP_TOKEN ||
    process.env.WHATSAPP_API_TOKEN ||
    "361|qvSlohCNI5loBq7eumrBLvPI68wuTFsSddLe3Mugd7463735",
  wabaId:
    process.env.INSIGN_WABA_ID ||
    process.env.WHATSAPP_WABA_ID ||
    "1405858647820082",
  phoneNumberId:
    process.env.INSIGN_WHATSAPP_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    "1355499557651351",
  username: process.env.INSIGN_USERNAME || "mediconnect",
  password: process.env.INSIGN_PASSWORD || "",
};

// Helper for standard JSON headers
function getHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${INSIGN_CONFIG.apiToken}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────
// 1. TEMPLATE MANAGEMENT APIs
// ─────────────────────────────────────────────────────────────

/**
 * List all WhatsApp Templates for the account
 * GET /api/v1/whatsapp/{waba_id}/message_templates
 */
export async function getAllTemplates(wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates?limit=100`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
    cache: "no-store",
  });
  return res.json();
}

/**
 * Get Specific Template by ID
 * GET /api/v1/whatsapp/{waba_id}/message_templates/id/{template_id}
 */
export async function getTemplateById(templateId, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates/id/${templateId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });
  return res.json();
}

/**
 * Create WhatsApp Template (Text, Media, Location, Catalog, Flow, Carousel, Coupon, etc.)
 * POST /api/v1/whatsapp/{waba_id}/message_templates
 */
export async function createTemplate(templatePayload, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(templatePayload),
  });
  return res.json();
}

/**
 * Edit Template Category (MARKETING / UTILITY)
 * POST /api/v1/whatsapp/{waba_id}/message_templates/id/{template_id}
 */
export async function editTemplateCategory(templateId, category, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates/id/${templateId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ category }),
  });
  return res.json();
}

/**
 * Edit Template Components (Header, Body, Footer, Buttons)
 * POST /api/v1/whatsapp/{waba_id}/message_templates/id/{template_id}
 */
export async function editTemplateComponents(templateId, components, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates/id/${templateId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ components }),
  });
  return res.json();
}

/**
 * Delete Template by Name or HSM ID
 * DELETE /api/v1/whatsapp/{waba_id}/message_templates?name=...&hsm_id=...
 */
export async function deleteTemplate({ name, hsm_id }, wabaId = INSIGN_CONFIG.wabaId) {
  const params = new URLSearchParams();
  if (name) params.append("name", name);
  if (hsm_id) params.append("hsm_id", hsm_id);

  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/message_templates?${params.toString()}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// 2. SEND SESSION & TEMPLATE MESSAGES (POST)
// ─────────────────────────────────────────────────────────────

/**
 * Send WhatsApp Message (Session Text, Media, Interactive, or Template)
 * POST /api/v1/whatsapp/{phone_number_id}/messages
 */
export async function sendMessage(payload, phoneNumberId = INSIGN_CONFIG.phoneNumberId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Mark Message as Read
 * POST /api/v1/whatsapp/{phone_number_id}/messages
 */
export async function markMessageRead(messageId, phoneNumberId = INSIGN_CONFIG.phoneNumberId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// 3. SIMPLE GET API
// ─────────────────────────────────────────────────────────────

/**
 * Send via Simple GET API
 * GET /api/v1/{phoneNumberId}/messages?...
 */
export async function sendSimpleGetMessage(params, phoneNumberId = INSIGN_CONFIG.phoneNumberId) {
  const query = new URLSearchParams({
    username: params.username || INSIGN_CONFIG.username,
    password: params.password || INSIGN_CONFIG.password,
    to: params.to,
    ...params,
  });

  const url = `${BASE_URL}/api/v1/${phoneNumberId}/messages?${query.toString()}`;
  const res = await fetch(url, { method: "GET" });
  return res.text(); // Simple GET API returns XML
}

// ─────────────────────────────────────────────────────────────
// 4. DELIVERY REPORTS
// ─────────────────────────────────────────────────────────────

/**
 * Get Delivery Reports
 * GET /api/v1/whatsapp/report (or /report/{messageId})
 */
export async function getDeliveryReport({ messageId, from, to, status } = {}) {
  const path = messageId
    ? `${BASE_URL}/api/v1/whatsapp/report/${messageId}`
    : `${BASE_URL}/api/v1/whatsapp/report`;

  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  if (status) params.append("status", status);

  const fullUrl = params.toString() ? `${path}?${params.toString()}` : path;
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: getHeaders(),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// 5. MEDIA APIs
// ─────────────────────────────────────────────────────────────

/**
 * Get Media Metadata by ID
 * GET /api/v1/whatsapp/{waba_id}/media/{media_id}
 */
export async function getMediaById(mediaId, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/media/${mediaId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });
  return res.json();
}

/**
 * Upload Media File
 * POST /api/v1/whatsapp/{waba_id}/media
 */
export async function uploadMedia(formData, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSIGN_CONFIG.apiToken}`,
    },
    body: formData,
  });
  return res.json();
}

/**
 * Create Media Handle for Template Creation
 * POST /api/v1/whatsapp/{waba_id}/media_handle
 */
export async function createMediaHandle(formData, wabaId = INSIGN_CONFIG.wabaId) {
  const url = `${BASE_URL}/api/v1/whatsapp/${wabaId}/media_handle`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSIGN_CONFIG.apiToken}`,
    },
    body: formData,
  });
  return res.json();
}
