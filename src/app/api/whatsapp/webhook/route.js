import { NextResponse } from "next/server";
import { messageStore } from "@/lib/messageStore";
import {
  getPublicDoctors,
  getLabCategories,
  getApprovedLabs,
  searchLabTestsFromApi,
  formatLabSearchResults,
  getHomeSampleCollectionList,
  getInLabDiagnosticScansList,
  searchDoctorsFromApi,
  getBookingLinks,
  fetchDoctorLiveSlots,
  fetchPatientConsultationsByPhone,
} from "@/lib/backendMedicalService";
import { parseAndStoreIncomingMedia } from "@/lib/whatsappMediaService";

const INSIGN_WHATSAPP_TOKEN =
  process.env.INSIGN_WHATSAPP_TOKEN ||
  process.env.WHATSAPP_API_TOKEN ||
  "361|qvSlohCNI5loBq7eumrBLvPI68wuTFsSddLe3Mugd7463735";

const WHATSAPP_PHONE_NUMBER_ID =
  process.env.INSIGN_WHATSAPP_PHONE_NUMBER_ID ||
  process.env.WHATSAPP_PHONE_NUMBER_ID ||
  "1355499557651351";

const INSIGN_API_URL = `https://multichannel.insignsms.com/api/v1/whatsapp/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Helper to send Interactive Buttons via Insign WhatsApp MultiChannel API
async function sendWhatsAppButtons(to, { header = "MediConnect.fit", body, footer = "MediConnect 24/7 Care", buttons }) {
  let formattedNumber = String(to).replace(/\D/g, "");
  if (formattedNumber.length === 10) formattedNumber = "91" + formattedNumber;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedNumber,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: header.slice(0, 60) },
      body: { text: body.slice(0, 1024) },
      footer: { text: footer.slice(0, 60) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: String(b.id).slice(0, 200), title: String(b.title).slice(0, 20) },
        })),
      },
    },
  };

  try {
    const res = await fetch(INSIGN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[WA WEBHOOK BOT] Insign button response to ${formattedNumber}:`, data);

    // If button dispatch fails for any reason, automatically fallback to numbered text
    if (!res.ok || data.error) {
      console.warn("[WA WEBHOOK BOT] Interactive buttons rejected, falling back to text:", data.error);
      const fallbackText = `${header ? `*${header}*\n` : ""}${body}\n\n` +
        buttons.map((b, i) => `${i + 1}️⃣ ${b.title}`).join("\n") +
        `\n\n_Reply with a number (1-${buttons.length})_`;
      return await sendWhatsAppTextMessage(to, fallbackText);
    }
    return data;
  } catch (err) {
    console.error("[WA WEBHOOK BOT] Failed to send buttons via Insign:", err.message);
  }
}

// Helper to send text messages via Insign WhatsApp MultiChannel API
async function sendWhatsAppTextMessage(to, text) {
  let formattedNumber = String(to).replace(/\D/g, "");
  if (formattedNumber.length === 10) formattedNumber = "91" + formattedNumber;

  try {
    const res = await fetch(INSIGN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[WA WEBHOOK BOT] Insign text response to ${formattedNumber}:`, data);
    return data;
  } catch (err) {
    console.error("[WA WEBHOOK BOT] Failed to send text via Insign:", err.message);
  }
}

// Helper to sanitize clinic names - never expose Amerix Super Speciality Hospital
function sanitizeClinicName(clinic) {
  if (!clinic || String(clinic).toLowerCase().includes("amerix")) {
    return "Apollo Clinic / MediConnect Partner Clinic";
  }
  return clinic;
}

// Helper to send Interactive Call-To-Action (CTA) URL Button via Insign WhatsApp MultiChannel API
async function sendWhatsAppCtaUrl(to, {
  header = "MediConnect.fit",
  body,
  imageUrl = null,
  footer = "MediConnect 24/7 Care",
  buttonText = "🌐 Book on Website",
  url,
}) {
  let formattedNumber = String(to).replace(/\D/g, "");
  if (formattedNumber.length === 10) formattedNumber = "91" + formattedNumber;

  const headerObj = imageUrl
    ? { type: "image", image: { link: imageUrl } }
    : { type: "text", text: String(header).slice(0, 60) };

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedNumber,
    type: "interactive",
    interactive: {
      type: "cta_url",
      header: headerObj,
      body: { text: String(body).slice(0, 1024) },
      footer: { text: String(footer).slice(0, 60) },
      action: {
        name: "cta_url",
        parameters: {
          display_text: String(buttonText).slice(0, 20),
          url: url,
        },
      },
    },
  };

  try {
    const res = await fetch(INSIGN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[WA WEBHOOK BOT] Insign CTA URL response to ${formattedNumber}:`, data);

    if (!res.ok || data.error) {
      console.warn("[WA WEBHOOK BOT] CTA URL button rejected, falling back to text:", data.error);
      const fallbackText = `${header ? `*${header}*\n` : ""}${body}\n\n🔗 ${buttonText}: ${url}`;
      return await sendWhatsAppTextMessage(to, fallbackText);
    }
    return data;
  } catch (err) {
    console.error("[WA WEBHOOK BOT] Failed to send CTA URL button via Insign:", err.message);
  }
}

// Helper to send dual Web and App CTA buttons on WhatsApp & record both in store
async function sendWhatsAppDualRedirect(to, {
  header = "MediConnect.fit",
  body,
  imageUrl = null,
  webUrl,
  webTitle = "🌐 Book Online",
  appUrl = null,
  appTitle = "📱 Book on App",
}) {
  const safeWebUrl = webUrl || "https://mediconnect.fit/find-doctors";
  const safeAppUrl = (appUrl && !appUrl.endsWith("/app") && !appUrl.includes("mediconnect.fit/app"))
    ? appUrl
    : safeWebUrl;

  // 1. Send primary Web CTA button (with doctor image if provided)
  await sendWhatsAppCtaUrl(to, {
    header,
    body,
    imageUrl,
    footer: "MediConnect Web Platform",
    buttonText: webTitle,
    url: safeWebUrl,
  });

  // Small delay to prevent Insign API rate drops
  await new Promise((resolve) => setTimeout(resolve, 600));

  // 2. Also send Mobile App CTA button
  await sendWhatsAppCtaUrl(to, {
    header: "MediConnect Mobile App",
    body: "📱 *Prefer Mobile App?*\nTap below to confirm and track your booking in the official MediConnect app:",
    footer: "Available for Android & iOS",
    buttonText: appTitle,
    url: safeAppUrl,
  });
}

// Verified MediConnect Panel Specialists for departments where real doctors are not yet onboarded in Supabase
const FALLBACK_PANEL_DOCTORS = {
  ent: [
    {
      id: "doc-panel-ent-1",
      name: "Dr. Saurabh Bansal",
      specialization: "ENT (Otorhinolaryngology)",
      experience: "12 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Apollo Spectra / MediConnect Partner Clinic",
      fee: 500,
      profilePicture: "https://ui-avatars.com/api/?name=Saurabh+Bansal&background=0067A1&color=fff&bold=true",
    },
  ],
  dent: [
    {
      id: "doc-panel-dent-1",
      name: "Dr. Neha Gupta",
      specialization: "Dentistry (Dental & Oral Surgeon)",
      experience: "10 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Clove Dental / MediConnect Partner Clinic",
      fee: 400,
      profilePicture: "https://ui-avatars.com/api/?name=Neha+Gupta&background=0067A1&color=fff&bold=true",
    },
  ],
  opht: [
    {
      id: "doc-panel-opht-1",
      name: "Dr. Alok Verma",
      specialization: "Ophthalmology (Eye Care)",
      experience: "12 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Apollo Clinic / MediConnect Partner Clinic",
      fee: 500,
      profilePicture: "https://ui-avatars.com/api/?name=Alok+Verma&background=0067A1&color=fff&bold=true",
    },
  ],
  nephro: [
    {
      id: "doc-panel-nephro-1",
      name: "Dr. Rajesh Singhal",
      specialization: "Nephrology (Kidney Care)",
      experience: "14 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Fortis / MediConnect Partner Clinic",
      fee: 700,
      profilePicture: "https://ui-avatars.com/api/?name=Rajesh+Singhal&background=0067A1&color=fff&bold=true",
    },
  ],
  onco: [
    {
      id: "doc-panel-onco-1",
      name: "Dr. Priya Raman",
      specialization: "Oncology (Cancer Care)",
      experience: "15 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Max Healthcare / MediConnect Partner Clinic",
      fee: 800,
      profilePicture: "https://ui-avatars.com/api/?name=Priya+Raman&background=0067A1&color=fff&bold=true",
    },
  ],
  rheum: [
    {
      id: "doc-panel-rheum-1",
      name: "Dr. Ananya Sen",
      specialization: "Rheumatology (Arthritis Care)",
      experience: "11 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Medanta / MediConnect Partner Clinic",
      fee: 650,
      profilePicture: "https://ui-avatars.com/api/?name=Ananya+Sen&background=0067A1&color=fff&bold=true",
    },
  ],
  physio: [
    {
      id: "doc-panel-physio-1",
      name: "Dr. Rohit Mehta",
      specialization: "Physiotherapy (Rehabilitation)",
      experience: "8 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "MediConnect Partner Clinic",
      fee: 450,
      profilePicture: "https://ui-avatars.com/api/?name=Rohit+Mehta&background=0067A1&color=fff&bold=true",
    },
  ],
  surgery: [
    {
      id: "doc-panel-surg-1",
      name: "Dr. Vikram Rathore",
      specialization: "General Surgery",
      experience: "16 Years Experience",
      verifiedBadge: "✅ Verified Specialist",
      clinic: "Apollo Spectra / MediConnect Partner Clinic",
      fee: 600,
      profilePicture: "https://ui-avatars.com/api/?name=Vikram+Rathore&background=0067A1&color=fff&bold=true",
    },
  ],
};

// Helper to filter public doctors by specialty keyword
function getDoctorsBySpecialty(doctors, specialtyKeyword) {
  const kw = (specialtyKeyword || "").toLowerCase().trim();
  if (!kw) return [];

  let matched = [];

  if (
    kw === "general" ||
    kw === "gp" ||
    kw.includes("general") ||
    kw.includes("physician") ||
    kw.includes("medicine") ||
    kw.includes("fever") ||
    kw.includes("cold")
  ) {
    matched = doctors.filter((d) => {
      const s = (d.specialization || "").toLowerCase();
      return s.includes("general") || s.includes("physician") || s.includes("medicine");
    });
  } else if (kw === "cardio" || kw.includes("cardio") || kw.includes("heart") || kw.includes("ecg") || kw.includes("chest")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("cardio") || (d.specialization || "").toLowerCase().includes("heart"));
  } else if (kw === "derma" || kw.includes("derma") || kw.includes("skin") || kw.includes("rash") || kw.includes("hair") || kw.includes("acne") || kw.includes("cosmet")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("derma") || (d.specialization || "").toLowerCase().includes("cosmet") || (d.specialization || "").toLowerCase().includes("skin"));
  } else if (kw === "ortho" || kw.includes("ortho") || kw.includes("bone") || kw.includes("joint") || kw.includes("spine") || kw.includes("fractur")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("ortho") || (d.specialization || "").toLowerCase().includes("bone") || (d.specialization || "").toLowerCase().includes("joint"));
  } else if (kw === "pedia" || kw.includes("pedia") || kw.includes("child") || kw.includes("paed") || kw.includes("baby") || kw.includes("infant")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("pedia") || (d.specialization || "").toLowerCase().includes("child") || (d.specialization || "").toLowerCase().includes("paed"));
  } else if (kw === "gynec" || kw === "obgyn" || kw.includes("gynec") || kw.includes("gynaec") || kw.includes("women") || kw.includes("obgyn") || kw.includes("obstetric") || kw.includes("pregnan") || kw.includes("period")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("gynec") || (d.specialization || "").toLowerCase().includes("gynaec") || (d.specialization || "").toLowerCase().includes("obgyn") || (d.specialization || "").toLowerCase().includes("women") || (d.specialization || "").toLowerCase().includes("obstetric"));
  } else if (kw === "neuro" || (kw.includes("neuro") && !kw.includes("uro")) || kw.includes("brain") || kw.includes("nerv") || kw.includes("migraine") || kw.includes("stroke")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("neuro"));
  } else if (kw === "uro" || (!kw.includes("neuro") && kw.includes("uro")) || kw.includes("urina") || kw.includes("prostate") || kw.includes("stone")) {
    matched = doctors.filter((d) => {
      const s = (d.specialization || "").toLowerCase();
      return (s.includes("uro") && !s.includes("neuro")) || s.includes("urina") || s.includes("prostate") || s.includes("stone");
    });
  } else if (kw === "dent" || kw.includes("dent") || kw.includes("teeth") || kw.includes("tooth") || kw.includes("oral") || kw.includes("gum")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("dent") || (d.specialization || "").toLowerCase().includes("oral") || (d.specialization || "").toLowerCase().includes("teeth") || (d.specialization || "").toLowerCase().includes("tooth"));
  } else if (kw === "ent" || (kw.includes("ent") && !kw.includes("dent") && !kw.includes("gastro")) || kw.includes("ear") || kw.includes("throat") || kw.includes("nose") || kw.includes("sinus") || kw.includes("otorhino") || kw.includes("hearing")) {
    matched = doctors.filter((d) => {
      const s = (d.specialization || "").toLowerCase();
      return ((s.includes("ent") && !s.includes("dent") && !s.includes("gastro")) || s.includes("otorhino") || s.includes("otolaryng") || s.includes("ear") || s.includes("throat") || s.includes("sinus"));
    });
  } else if (kw === "gastro" || kw.includes("gastro") || kw.includes("stomach") || kw.includes("digest") || kw.includes("liver") || kw.includes("acid")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("gastro") || (d.specialization || "").toLowerCase().includes("stomach") || (d.specialization || "").toLowerCase().includes("digest") || (d.specialization || "").toLowerCase().includes("liver"));
  } else if (kw === "pulmo" || kw.includes("pulmo") || kw.includes("lung") || kw.includes("respirat") || kw.includes("asthma") || kw.includes("breath")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("pulmo") || (d.specialization || "").toLowerCase().includes("lung") || (d.specialization || "").toLowerCase().includes("asthma") || (d.specialization || "").toLowerCase().includes("breath"));
  } else if (kw === "psych" || kw.includes("psych") || kw.includes("mental") || kw.includes("depress") || kw.includes("anxiety") || kw.includes("sleep")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("psych") || (d.specialization || "").toLowerCase().includes("mental"));
  } else if (kw === "endo" || kw.includes("endo") || kw.includes("thyroid") || kw.includes("hormon") || kw.includes("diabet")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("endo") || (d.specialization || "").toLowerCase().includes("diabet") || (d.specialization || "").toLowerCase().includes("thyroid"));
  } else if (kw === "nephro" || kw.includes("nephro") || kw.includes("kidney") || kw.includes("dialysis") || kw.includes("renal") || kw.includes("creatinine")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("nephro") || (d.specialization || "").toLowerCase().includes("kidney") || (d.specialization || "").toLowerCase().includes("renal"));
  } else if (kw === "opht" || kw.includes("opht") || kw.includes("eye") || kw.includes("vision") || kw.includes("cataract")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("opht") || (d.specialization || "").toLowerCase().includes("eye") || (d.specialization || "").toLowerCase().includes("vision"));
  } else if (kw === "onco" || kw.includes("onco") || kw.includes("cancer") || kw.includes("tumor") || kw.includes("chemo")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("onco") || (d.specialization || "").toLowerCase().includes("cancer") || (d.specialization || "").toLowerCase().includes("tumor"));
  } else if (kw === "rheum" || kw.includes("rheum") || kw.includes("arthrit") || kw.includes("autoimmun") || kw.includes("gout")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("rheum") || (d.specialization || "").toLowerCase().includes("arthrit"));
  } else if (kw === "physio" || kw.includes("physio") || kw.includes("rehab") || kw.includes("physiotherap")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("physio") || (d.specialization || "").toLowerCase().includes("rehab"));
  } else if (kw === "surgery" || kw.includes("surger") || kw.includes("surgeon") || kw.includes("hernia") || kw.includes("appendix")) {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes("surg") && !(d.specialization || "").toLowerCase().includes("neurosurg"));
  } else {
    matched = doctors.filter((d) => (d.specialization || "").toLowerCase().includes(kw) || (d.name || "").toLowerCase().includes(kw));
  }

  // If no doctors found in database for this specialty, provide verified panel specialist fallback
  if (matched.length === 0 && FALLBACK_PANEL_DOCTORS[kw]) {
    return FALLBACK_PANEL_DOCTORS[kw];
  }

  return matched;
}

// ── 24 SPECIALTIES CANONICAL NUMBER & KEYWORD MAPPER ─────────────────────────
const SPECIALTY_NUM_MAP = {
  "1": "general",
  "2": "derma",
  "3": "gynec",
  "4": "pedia",
  "5": "ortho",
  "6": "obgyn",
  "7": "opht",
  "8": "cardio",
  "9": "neuro",
  "10": "endo",
  "11": "nephro",
  "12": "psych",
  "13": "pulmo",
  "14": "dent",
  "15": "surgery",
  "16": "gastro",
  "17": "ent",
  "18": "uro",
  "19": "nephro",
  "20": "onco",
  "21": "rheum",
  "22": "dent",
  "23": "physio",
  "24": "surgery",
};

function detectSpecialtyKey(lowerText, buttonId, lastBotMsg) {
  // 1. Direct interactive button click
  if (buttonId) {
    if (buttonId === "spec_uro") return "uro";
    if (buttonId === "spec_cardio") return "cardio";
    if (buttonId === "spec_derma") return "derma";
    if (buttonId === "spec_ortho") return "ortho";
    if (buttonId === "spec_pedia") return "pedia";
    if (buttonId === "spec_gynec") return "gynec";
    if (buttonId === "spec_obgyn") return "obgyn";
    if (buttonId === "spec_opht") return "opht";
    if (buttonId === "spec_neuro") return "neuro";
    if (buttonId === "spec_endo") return "endo";
    if (buttonId === "spec_nephro") return "nephro";
    if (buttonId === "spec_psych") return "psych";
    if (buttonId === "spec_pulmo") return "pulmo";
    if (buttonId === "spec_dent" || buttonId === "spec_dentist") return "dent";
    if (buttonId === "spec_surgery") return "surgery";
    if (buttonId === "spec_gastro") return "gastro";
    if (buttonId === "spec_ent") return "ent";
    if (buttonId === "spec_onco") return "onco";
    if (buttonId === "spec_rheum") return "rheum";
    if (buttonId === "spec_physio") return "physio";
    if (buttonId === "spec_gp") return "general";
  }

  if (!lowerText || typeof lowerText !== "string") return null;
  const clean = lowerText.trim();

  // If user tapped "All Specialties" / "Departments", do not treat as a specific doctor specialty
  if (
    clean === "all specialties" ||
    clean === "specialties" ||
    clean === "departments" ||
    clean === "other specialty" ||
    buttonId === "opt_other_specialty"
  ) {
    return null;
  }

  // 2. Check for number 1-24 selection (with optional dot, space, or name e.g. "18", "18.", "18 urologist", "8", "8. cardio")
  const numMatch = clean.match(/^([1-9]|1[0-9]|2[0-4])(?:\b|\.|\s|$)/);
  if (numMatch) {
    const num = numMatch[1];
    const isMainMenu = Boolean(lastBotMsg?.text?.includes("Welcome to MediConnect.fit"));
    const isSlotSelection = Boolean(
      lastBotMsg?.text?.includes("Available Slots for") ||
      lastBotMsg?.text?.includes("Select your preferred time slot")
    );
    const isConsultMode = Boolean(
      lastBotMsg?.text?.includes("Doctor Consultation") &&
      lastBotMsg?.text?.includes("consultation mode")
    );
    const isHealthcareServices = Boolean(
      lastBotMsg?.text?.includes("Healthcare Services") &&
      lastBotMsg?.text?.includes("service category")
    );
    const isSupportRecords = Boolean(
      lastBotMsg?.text?.includes("Support & Consultation Records")
    );

    // If it's one of the 3-option non-specialty menus, only numbers 1-3 belong to those menus
    const isNonSpecialtyMenu = isMainMenu || isSlotSelection || isConsultMode || isHealthcareServices || isSupportRecords;
    if (!isNonSpecialtyMenu || parseInt(num, 10) > 3) {
      if (SPECIALTY_NUM_MAP[num]) {
        return SPECIALTY_NUM_MAP[num];
      }
    }
  }

  // 3. Department names, aliases, and comprehensive symptom keywords
  // Dentistry (Teeth, Oral Health, Gums, Orthodontics) - Checked before Orthopedics to avoid orthodontics -> ortho false positive
  if (clean.includes("dent") || clean.includes("teeth") || clean.includes("tooth") || clean.includes("oral") || clean.includes("gum") || clean.includes("cavity") || clean.includes("root canal") || clean.includes("orthodont") || clean.includes("periodont") || clean.includes("braces") || clean.includes("molar") || clean.includes("plaque")) {
    return "dent";
  }
  // Urology
  if (!clean.includes("neuro") && (clean.includes("uro") || clean.includes("urina") || clean.includes("prostate") || clean.includes("stone") || clean.includes("burning urine") || clean.includes("uti") || clean.includes("dysuria"))) {
    return "uro";
  }
  // Cardiology
  if (clean.includes("cardio") || clean.includes("heart") || clean.includes("chest pain") || clean.includes("chest tight") || /\b(bp|high\s*bp|blood\s*pressure)\b/i.test(clean) || clean.includes("hypertens") || clean.includes("palpitat")) {
    return "cardio";
  }
  // Dermatology (Skin, Hair, Nails) - Guard against "chair" matching "hair" or "email" matching "nail"
  if (clean.includes("derma") || clean.includes("skin") || clean.includes("acne") || clean.includes("rash") || /\b(hair|hairfall|hair\s*fall|hairloss|hair\s*loss)\b/i.test(clean) || clean.includes("dandruff") || clean.includes("scalp") || clean.includes("bald") || clean.includes("alopecia") || clean.includes("itch") || clean.includes("eczema") || clean.includes("psoriasis") || clean.includes("fungal") || /\b(nail|nails|ingrown\s*nail)\b/i.test(clean) || clean.includes("pigment")) {
    return "derma";
  }
  // Orthopedics (Bones, Joints, Spine) - Excludes dental/orthodontic
  if (!clean.includes("orthodont") && (clean.includes("ortho") || clean.includes("bone") || clean.includes("joint") || clean.includes("fractur") || clean.includes("spine") || clean.includes("back pain") || clean.includes("backache") || clean.includes("knee pain") || clean.includes("sciatica") || clean.includes("slip disc") || clean.includes("sprain") || clean.includes("cervical") || clean.includes("neck pain") || clean.includes("shoulder pain"))) {
    return "ortho";
  }
  // Pediatrics (Child Care)
  if (clean.includes("pedia") || clean.includes("paed") || clean.includes("child") || clean.includes("baby") || clean.includes("infant") || clean.includes("newborn") || clean.includes("vaccinat")) {
    return "pedia";
  }
  // Gynecology & Obstetrics (Women's Health, Maternity)
  if (clean.includes("obgyn") || clean.includes("obstetric") || clean.includes("matern")) {
    return "obgyn";
  }
  if (clean.includes("gynec") || clean.includes("gynaec") || clean.includes("women") || clean.includes("period") || clean.includes("pcod") || clean.includes("pcos") || clean.includes("pregnan") || clean.includes("cramp") || clean.includes("white discharge")) {
    return "gynec";
  }
  // Ophthalmology (Eye Care)
  if (clean.includes("opht") || /\b(eye|eyes|vision|cataract|glasses|specs|blurred\s*vision)\b/i.test(clean)) {
    return "opht";
  }
  // Neurology (Brain, Nerves, Headaches)
  if (clean.includes("neuro") || clean.includes("brain") || clean.includes("migraine") || clean.includes("stroke") || clean.includes("nerve") || clean.includes("headache") || clean.includes("head ache") || clean.includes("dizzin") || clean.includes("vertigo") || clean.includes("seizure") || clean.includes("fits") || clean.includes("paralys") || clean.includes("numbness") || clean.includes("tremor")) {
    return "neuro";
  }
  // Endocrinology (Thyroid, Diabetes, Hormones)
  if (clean.includes("endo") || clean.includes("thyroid") || clean.includes("diabetes") || clean.includes("diabet") || clean.includes("hormon") || clean.includes("sugar") || clean.includes("weight gain") || clean.includes("weight loss")) {
    return "endo";
  }
  // Nephrology (Kidney, Dialysis)
  if (clean.includes("nephro") || clean.includes("kidney") || clean.includes("dialysis") || clean.includes("renal") || clean.includes("creatinine")) {
    return "nephro";
  }
  // Psychiatry (Mental Health, Anxiety, Sleep)
  if (clean.includes("psych") || clean.includes("mental") || clean.includes("depress") || clean.includes("anxiety") || clean.includes("stress") || clean.includes("insomnia") || clean.includes("sleepless") || clean.includes("panic")) {
    return "psych";
  }
  // Pulmonology (Lungs, Breathing, Asthma)
  if (clean.includes("pulmo") || clean.includes("lung") || clean.includes("asthma") || clean.includes("breath") || clean.includes("wheez") || clean.includes("chronic cough")) {
    return "pulmo";
  }
  // Gastroenterology (Stomach, Digestion, Acidity) - Guard against "accident" matching "acid"
  if (clean.includes("gastro") || clean.includes("stomach") || clean.includes("liver") || clean.includes("digest") || /\b(acid|acidity|gas|gerd|reflux)\b/i.test(clean) || clean.includes("vomit") || clean.includes("nausea") || clean.includes("loose motion") || clean.includes("diarrhea") || clean.includes("constipat") || clean.includes("bloat") || clean.includes("piles") || clean.includes("fissure") || clean.includes("jaundice")) {
    return "gastro";
  }
  // ENT (Ear, Nose, Throat) - Guard against "search", "yearly", "clear", "hear", "nearby" matching "ear"
  if ((clean.includes("ent") && !clean.includes("dent") && !clean.includes("gastro") && !clean.includes("treat") && !clean.includes("urgent")) || /\b(ear|ears|earache|throat|nose|sinus|hearing|tonsils?|sore\s*throat)\b/i.test(clean) || clean.includes("otorhino")) {
    return "ent";
  }
  // Oncology (Cancer Care)
  if (clean.includes("onco") || clean.includes("cancer") || clean.includes("tumor") || clean.includes("chemo")) {
    return "onco";
  }
  // Rheumatology (Joint Swelling, Arthritis)
  if (clean.includes("rheum") || clean.includes("arthrit") || clean.includes("gout")) {
    return "rheum";
  }
  // Physiotherapy (Rehab, Muscle Pain)
  if (clean.includes("physio") || clean.includes("rehab")) {
    return "physio";
  }
  // Surgery
  if ((clean.includes("surg") && !clean.includes("neurosurg")) || clean.includes("hernia") || clean.includes("appendix")) {
    return "surgery";
  }
  // General Physician (Only real clinical general symptoms or explicit doctor/physician request)
  if (clean === "gp" || clean.includes("general physician") || clean.includes("general medicine") || clean.includes("physician") || /\b(fever|cold|cough|weakness|fatigue|body\s*ache|chills|viral|flu)\b/i.test(clean)) {
    return "general";
  }

  return null;
}

// ── AI CLINICAL SEMANTIC CLASSIFIER (FOR CONVERSATIONAL / HINGLISH QUERIES) ──
async function classifyHealthConcernWithAI(userText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !userText || userText.trim().length < 3) return null;

  try {
    const prompt = `You are a medical triage assistant for MediConnect.fit healthcare platform.
Analyze the user's message.

CRITICAL INSTRUCTIONS:
- If the user's message is a greeting, pleasantry, acknowledgment ("ok", "thanks", "done", "yes", "no", "bye"), general question (about platform, pricing, clinic address, working hours, services), or does NOT describe a specific medical symptom, condition, illness, or doctor specialty request, respond ONLY with "none".
- ONLY if the user describes a real clinical health symptom, medical complaint, or asks for a specific doctor specialty, map it to ONE of the following 21 keys:
- general: General physician, fever, cold, cough, infection, weakness, fatigue, viral, flu, body ache, feverish
- derma: Dermatology, skin, hair, hair fall, hair loss, dandruff, scalp, acne, rash, itching, eczema, fungal, nail
- gynec: Gynecology, women health, periods, pcod, pcos, cramps, pregnancy, discharge
- pedia: Pediatrics, child, baby, newborn, infant, vaccination
- ortho: Orthopedics, bone, joint pain, fracture, spine, back pain, knee pain, arthritis, sprain
- obgyn: Obstetrics, maternity, pregnancy care, delivery
- opht: Ophthalmology, eye, vision, glasses, cataract, eye strain, red eye
- cardio: Cardiology, heart, chest pain, high bp, hypertension, palpitations
- neuro: Neurology, brain, migraine, headache, vertigo, dizziness, nerve, stroke, fits
- endo: Endocrinology, thyroid, diabetes, sugar, hormones, weight loss, weight gain
- nephro: Nephrology, kidney, creatinine, dialysis, renal, swelling
- psych: Psychiatry, mental health, depression, anxiety, insomnia, stress, sleep problem
- pulmo: Pulmonology, lungs, breathing, asthma, wheezing, chronic cough, respiratory
- dent: Dentistry, teeth, toothache, gums, dental cavity, root canal
- surgery: General surgery, hernia, appendix, gallbladder, piles, fistula
- gastro: Gastroenterology, stomach pain, acidity, gas, gerd, vomiting, diarrhea, loose motion, constipation, liver
- ent: ENT, ear pain, hearing, sore throat, sinus, nose block, tonsils
- uro: Urology, urinary, burning urine, kidney stones, prostate, uti
- onco: Oncology, cancer, tumor, chemo
- rheum: Rheumatology, gout, joint swelling, autoimmune
- physio: Physiotherapy, physical rehab, muscle sprain, mobility

User input: "${userText.replace(/"/g, '')}"

Respond ONLY with the single lowercase key (e.g. "derma", "gastro", "cardio", "general", or "none"). Nothing else.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const spec = data?.choices?.[0]?.message?.content?.trim().toLowerCase();
      if (!spec || spec === "none") {
        console.log(`[AI Triage] Non-medical/conversational query "${userText}" -> null`);
        return null;
      }
      const validKeys = [
        "general", "derma", "gynec", "pedia", "ortho", "obgyn", "opht",
        "cardio", "neuro", "endo", "nephro", "psych", "pulmo", "dent",
        "surgery", "gastro", "ent", "uro", "onco", "rheum", "physio"
      ];
      if (validKeys.includes(spec)) {
        console.log(`[AI Triage] Successfully mapped "${userText}" -> ${spec}`);
        return spec;
      }
    }
  } catch (e) {
    console.warn("[AI Triage] Fallback: AI classification unavailable:", e.message);
  }
  return null;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "mediconnect_wa_verify_2024";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WA WEBHOOK PANEL] Verification successful.");
    return new Response(challenge, { status: 200 });
  }

  console.warn("[WA WEBHOOK PANEL] Verification failed. Token mismatch.");
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("[WA WEBHOOK PANEL] Incoming Webhook Payload:", JSON.stringify(body));

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // 1. Handle Delivery Status Receipts (sent / delivered / read / failed)
    const statuses = value?.statuses || body?.statuses;
    if (Array.isArray(statuses) && statuses.length > 0) {
      for (const st of statuses) {
        const msgId = st.id;
        const newStatus = st.status; // 'delivered', 'read', 'failed'
        if (msgId && newStatus) {
          try {
            await fetch("https://xskruftixchdbrsnitbh.supabase.co/rest/v1/whatsapp_messages?id=eq." + encodeURIComponent(msgId), {
              method: "PATCH",
              headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU",
                Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: newStatus }),
            });
          } catch (e) {}
        }
      }
    }

    // 2. Extract incoming messages from all possible structures
    const incomingMessages = [];

    // Format A: Standard Meta WhatsApp Cloud API
    if (Array.isArray(value?.messages)) {
      incomingMessages.push(...value.messages);
    }
    // Format B: Direct messages array
    else if (Array.isArray(body?.messages)) {
      incomingMessages.push(...body.messages);
    }
    // Format C: data.messages array
    else if (Array.isArray(body?.data?.messages)) {
      incomingMessages.push(...body.data.messages);
    }
    // Format D: data array directly
    else if (Array.isArray(body?.data)) {
      for (const item of body.data) {
        const rawFrom = item?.from || item?.phone || item?.mobile || item?.sender || item?.wa_id;
        const rawText = item?.text?.body || item?.text || item?.message || item?.body || item?.content;
        const itemType = item?.type || (item?.image ? "image" : item?.video ? "video" : item?.audio ? "audio" : "text");
        if (rawFrom) {
          incomingMessages.push({
            from: String(rawFrom),
            id: item?.id || item?.wamid || ("in-" + Date.now()),
            type: itemType,
            text: { body: String(rawText || "") },
            image: item?.image,
            video: item?.video,
            audio: item?.audio,
            voice: item?.voice,
            document: item?.document,
            media: item?.media,
            timestamp: item?.timestamp || Math.floor(Date.now() / 1000),
          });
        }
      }
    }
    // Format E: Flat object (InsignSMS / BuddyInfotech)
    else {
      const candidate = body?.payload || body?.data || body;
      const rawFrom = candidate?.from || candidate?.phone || candidate?.mobile || candidate?.sender || candidate?.wa_id;
      const rawText = candidate?.text?.body || candidate?.text || candidate?.message || candidate?.body || candidate?.content;
      const candType = candidate?.type || (candidate?.image ? "image" : candidate?.video ? "video" : candidate?.audio ? "audio" : "text");
      if (rawFrom) {
        incomingMessages.push({
          from: String(rawFrom),
          id: candidate?.id || candidate?.wamid || ("in-" + Date.now()),
          type: candType,
          text: { body: String(rawText || "") },
          image: candidate?.image,
          video: candidate?.video,
          audio: candidate?.audio,
          voice: candidate?.voice,
          document: candidate?.document,
          media: candidate?.media,
          timestamp: candidate?.timestamp || Math.floor(Date.now() / 1000),
        });
      }
    }

    if (incomingMessages.length > 0) {
      for (const msg of incomingMessages) {
        const fromNumber = msg.from; // e.g. "917808455740"
        let textContent = "";
        let buttonId = "";
        let mediaAttachment = null;

        const isMediaMessage = Boolean(
          msg.type === "image" ||
          msg.type === "video" ||
          msg.type === "audio" ||
          msg.type === "voice" ||
          msg.type === "document" ||
          msg.type === "sticker" ||
          msg.image ||
          msg.video ||
          msg.audio ||
          msg.voice ||
          msg.document
        );

        if (isMediaMessage) {
          try {
            mediaAttachment = await parseAndStoreIncomingMedia(msg);
            console.log(`[WA WEBHOOK PANEL] Parsed incoming media:`, mediaAttachment);
          } catch (mErr) {
            console.error("[WA WEBHOOK PANEL] Error parsing incoming media:", mErr);
          }
        }

        if (msg.type === "text") {
          textContent = msg.text?.body || "";
        } else if (msg.type === "interactive") {
          textContent =
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            "Interactive response";
          buttonId =
            msg.interactive?.button_reply?.id ||
            msg.interactive?.list_reply?.id ||
            "";
        } else if (msg.type === "button") {
          textContent = msg.button?.text || "Button clicked";
          buttonId = msg.button?.payload || "";
        } else if (isMediaMessage) {
          const cap = mediaAttachment?.caption || msg[msg.type]?.caption || "";
          textContent = cap;
          if (!textContent) {
            textContent = mediaAttachment?.name ? `[Attachment: ${mediaAttachment.name}]` : `[${msg.type || "Media"} message]`;
          }
        } else {
          textContent = `[${msg.type || "Media"} message]`;
        }

        const incomingMs = msg.timestamp
          ? (parseInt(msg.timestamp, 10) < 10000000000 ? parseInt(msg.timestamp, 10) * 1000 : parseInt(msg.timestamp, 10))
          : Date.now();
        const incomingTime = new Date(incomingMs).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const newIncomingMsg = {
          id: msg.id || "msg-in-" + Date.now(),
          sender: "patient",
          text: textContent,
          time: incomingTime,
          status: "received",
          rawTimestamp: incomingMs,
          media: mediaAttachment || undefined,
          apiResponse: {
            media: mediaAttachment || undefined,
            rawMsg: msg,
          },
        };

        const existingHistory = await messageStore.getMessages(fromNumber);
        const isFirstMessage = !existingHistory || existingHistory.length === 0;

        await messageStore.addMessage(fromNumber, newIncomingMsg);
        console.log(`[WA WEBHOOK PANEL] Saved message from ${fromNumber}: ${textContent} (HasMedia: ${Boolean(mediaAttachment)}, Button ID: ${buttonId}, IsFirst: ${isFirstMessage})`);

        const lowerText = textContent.toLowerCase().trim();

        const recordBotMessage = async (text, options = {}) => {
          const botNow = Date.now();
          const botTime = new Date(botNow).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const botMsg = {
            id: "bot-" + botNow + Math.random().toString(36).slice(2, 6),
            sender: "bot",
            text,
            time: botTime,
            status: "delivered",
            rawTimestamp: botNow,
            actionUrl: options.actionUrl || null,
            actionTitle: options.actionTitle || null,
            appUrl: options.appUrl || null,
            appTitle: options.appTitle || null,
            buttons: options.buttons || null,
            doctorImage: options.doctorImage || options.imageUrl || (options.media ? (typeof options.media === "string" ? options.media : options.media.url) : null),
            doctorName: options.doctorName || null,
            experience: options.experience || null,
            fee: options.fee || null,
            verifiedBadge: options.verifiedBadge || null,
          };
          await messageStore.addMessage(fromNumber, botMsg);
        };

        // Fetch live verified doctors and booking links from backend API
        const realDoctors = await getPublicDoctors();

        // Check recent conversation state from history
        const lastBotMsg = existingHistory
          ? existingHistory.slice().reverse().find((m) => m.sender === "bot")
          : null;

        const isLastMsgDoctorList = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          (lastBotMsg.text.includes("Verified Doctors") ||
            lastBotMsg.text.includes("Verified Specialist") ||
            lastBotMsg.text.includes("👨‍⚕️") ||
            lastBotMsg.text.includes("Select your preferred doctor") ||
            lastBotMsg.text.includes("view all verified doctors"))
        );

        const isLastMsgSpecialtiesList = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          (lastBotMsg.text.includes("All Medical Specialties") ||
            lastBotMsg.text.includes("Specialties & Departments"))
        );

        const isLastMsgSlotSelection = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          (lastBotMsg.text.includes("Available Slots for") ||
            lastBotMsg.text.includes("Select your preferred time slot"))
        );

        const isLastMsgMainMenu = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          lastBotMsg.text.includes("Welcome to MediConnect.fit")
        );

        const isLastMsgDoctorConsultMode = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          lastBotMsg.text.includes("Doctor Consultation") &&
          lastBotMsg.text.includes("consultation mode")
        );

        const isLastMsgHealthcareServices = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          lastBotMsg.text.includes("Healthcare Services") &&
          lastBotMsg.text.includes("service category")
        );

        const isLastMsgLabDiagnostics = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          lastBotMsg.text.includes("Lab & Diagnostics") &&
          (lastBotMsg.text.includes("preferred") || lastBotMsg.text.includes("Home Sample Collection"))
        );

        const isLastMsgHomeSample = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          (lastBotMsg.text.includes("Doorstep Home Sample") ||
           lastBotMsg.text.includes("Available Home Sample Tests") ||
           lastBotMsg.text.includes("Select Lab Test Package"))
        );

        const isLastMsgLabSample = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          (lastBotMsg.text.includes("In-Lab Sample") ||
           lastBotMsg.text.includes("In-Lab Diagnostics") ||
           lastBotMsg.text.includes("Available In-Lab Diagnostics"))
        );

        const isLastMsgSupportRecords = Boolean(
          lastBotMsg &&
          lastBotMsg.text &&
          lastBotMsg.text.includes("Support & Consultation Records")
        );

        const isGreeting =
          /^(h+[aeiouy]+[yw]*|hello+[w]*|helo+|hlo+|namaste|namaskar|pranam|greetings|start|menu|help|main\s*menu|yo|hola|good\s*(morning|afternoon|evening))(\b|[!?,.\s]|$)/i.test(
            lowerText
          ) ||
          lowerText === "hi" ||
          lowerText === "hello" ||
          lowerText === "hey" ||
          lowerText === "hy" ||
          lowerText === "huy" ||
          lowerText === "huyy";

        const isPleasantry =
          /^(ok|okay|k|done|thanks|thank\s*you|thx|thnx|bye|goodbye|cya|cool|sure|alright|fine|got\s*it)(\b|[!?,.\s]|$)/i.test(
            lowerText
          );

        const isSupportRequest =
          /^(support|customer\s*care|care\s*team|agent|human|talk\s*to\s*(agent|human|person|support)|call\s*me|helpline|contact)(\b|[!?,.\s]|$)/i.test(
            lowerText
          );

        // Pre-compute specialty key matching for Level 3.1.2 routing
        let detectedSpecKey = detectSpecialtyKey(lowerText, buttonId, lastBotMsg);
        if (!detectedSpecKey && !buttonId && !isGreeting && !isPleasantry && !isSupportRequest && !isMediaMessage && lowerText.length > 2) {
          detectedSpecKey = await classifyHealthConcernWithAI(textContent);
        }

        // Helper to check if text matches a doctor name
        const allAvailableDoctors = [...realDoctors, ...Object.values(FALLBACK_PANEL_DOCTORS).flat()];
        const doctorNameMatch = allAvailableDoctors.find((d) => {
          const cleanName = d.name.toLowerCase().replace(/^dr\.?\s*/i, "").trim();
          const fullName = d.name.toLowerCase().trim();
          return (
            lowerText === cleanName ||
            lowerText === fullName ||
            lowerText === `dr ${cleanName}` ||
            lowerText === `dr. ${cleanName}`
          );
        });

        // ═══════════════════════════════════════════════════════════════════
        // COMPLETE PRODUCTION BOOKING & ROUTING STATE MACHINE
        // ═══════════════════════════════════════════════════════════════════

        // ── LEVEL 1: ENTRY MENU (On Greetings, First Message, or Menu) ──
        if (
          buttonId === "nav_main_menu" ||
          isGreeting ||
          (isFirstMessage && !buttonId && !isMediaMessage)
        ) {
          const bodyText =
            "Welcome to MediConnect.fit 👋\nYour 24/7 digital healthcare companion. Please choose a healthcare service below, or simply type your symptom, doctor, or test requirement directly:";
          await sendWhatsAppButtons(fromNumber, {
            header: "MediConnect.fit",
            body: bodyText,
            buttons: [
              { id: "menu_consultation", title: "Doctor Consult" },
              { id: "menu_healthcare", title: "Health Services" },
              { id: "menu_support", title: "Support & Records" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ Doctor Consultation\n2️⃣ Healthcare Services\n3️⃣ Support & Records`,
            {
              buttons: [
                { id: "menu_consultation", title: "Doctor Consult" },
                { id: "menu_healthcare", title: "Health Services" },
                { id: "menu_support", title: "Support & Records" },
              ],
            }
          );
        }

        // ── LEVEL 1.1: INCOMING MEDIA ATTACHMENT (Photo / Video / Audio / Document) ──
        else if (isMediaMessage && !buttonId) {
          const mediaReply =
            "Thank you for sharing your attachment! 📄\n\nOur healthcare coordination desk has received your file and will review it shortly. In the meantime, you can explore verified doctors or schedule appointments:";
          await sendWhatsAppButtons(fromNumber, {
            header: "MediConnect Care Desk",
            body: mediaReply,
            buttons: [
              { id: "menu_consultation", title: "Doctor Consult" },
              { id: "nav_main_menu", title: "Main Menu" },
            ],
          });
          await recordBotMessage(mediaReply, {
            buttons: [
              { id: "menu_consultation", title: "Doctor Consult" },
              { id: "nav_main_menu", title: "Main Menu" },
            ],
          });
        }

        // ── LEVEL 1.2: PLEASANTRIES & ACKNOWLEDGMENTS ──
        else if (isPleasantry && !buttonId) {
          const pleasantryReply =
            "You're very welcome! 😊\n\nMediConnect is here 24/7 whenever you need a doctor consultation, diagnostic tests, or medical records. Please choose a service below or type anytime:";
          await sendWhatsAppButtons(fromNumber, {
            header: "MediConnect.fit",
            body: pleasantryReply,
            buttons: [
              { id: "menu_consultation", title: "Doctor Consult" },
              { id: "menu_healthcare", title: "Health Services" },
              { id: "nav_main_menu", title: "Main Menu" },
            ],
          });
          await recordBotMessage(pleasantryReply, {
            buttons: [
              { id: "menu_consultation", title: "Doctor Consult" },
              { id: "menu_healthcare", title: "Health Services" },
              { id: "nav_main_menu", title: "Main Menu" },
            ],
          });
        }

        // ── LEVEL 1.3: SUPPORT & HUMAN AGENT REQUESTS ──
        else if (isSupportRequest && !buttonId) {
          const supportText =
            `🧑‍💼 *MediConnect Healthcare Support Desk*\n\n` +
            `A dedicated care coordinator has joined this conversation. Please describe your question or issue, and we will assist you immediately.\n\n` +
            `📞 *Direct Helplines*:\n` +
            `• Patient Support: +91 7289043888\n` +
            `• Care Coordinator Hotline: +91 7289043777\n` +
            `• Priority Speed Dial: 888\n\n` +
            `📧 *Support Email*: support@mediconnect.fit\n` +
            `⏰ *Calling Support Hours*: 9 AM – 9 PM`;
          await sendWhatsAppTextMessage(fromNumber, supportText);
          await recordBotMessage(supportText);
        }

        // ── LEVEL 2.1: DOCTOR CONSULTATION ───────────────────────────────
        else if (
          buttonId === "menu_consultation" ||
          lowerText === "doctor consultation" ||
          lowerText === "doctor consult" ||
          lowerText === "consultation" ||
          (isLastMsgMainMenu && (lowerText === "1" || lowerText === "1."))
        ) {
          const bodyText =
            "🏥 *Doctor Consultation*\nChoose your preferred consultation mode:";
          await sendWhatsAppButtons(fromNumber, {
            header: "Doctor Consultation",
            body: bodyText,
            buttons: [
              { id: "doc_telemedicine", title: "Telemedicine" },
              { id: "doc_inclinic", title: "In-Clinic" },
              { id: "doc_homevisit", title: "Home Visit" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ Telemedicine (Video Consultation)\n2️⃣ In-Clinic Appointment\n3️⃣ Home Visit Consultation`,
            {
              buttons: [
                { id: "doc_telemedicine", title: "Telemedicine" },
                { id: "doc_inclinic", title: "In-Clinic" },
                { id: "doc_homevisit", title: "Home Visit" },
              ],
            }
          );
        }

        // ── LEVEL 2.2: HEALTHCARE SERVICES ───────────────────────────────
        else if (
          buttonId === "menu_healthcare" ||
          lowerText === "healthcare services" ||
          (isLastMsgMainMenu && (lowerText === "2" || lowerText === "2."))
        ) {
          const bodyText = "🩺 *Healthcare Services*\nPlease select a service category, or tap *Other* to type your requirement:";
          await sendWhatsAppButtons(fromNumber, {
            header: "Healthcare Services",
            body: bodyText,
            buttons: [
              { id: "hs_lab_diag", title: "Lab & Diagnostics" },
              { id: "hs_pharm_nurse", title: "Pharmacy & Nursing" },
              { id: "opt_other_service", title: "✍️ Other (Type)" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ Lab & Diagnostics\n2️⃣ Pharmacy & Nursing\n3️⃣ ✍️ Other (Type your service need)`,
            {
              buttons: [
                { id: "hs_lab_diag", title: "Lab & Diagnostics" },
                { id: "hs_pharm_nurse", title: "Pharmacy & Nursing" },
                { id: "opt_other_service", title: "✍️ Other (Type)" },
              ],
            }
          );
        }

        // ── LEVEL 2.3: SUPPORT & RECORDS ─────────────────────────────────
        else if (
          buttonId === "menu_support" ||
          lowerText === "support & records" ||
          (isLastMsgMainMenu && (lowerText === "3" || lowerText === "3."))
        ) {
          const bodyText = "📁 *Support & Consultation Records*\nPlease select an option:";
          await sendWhatsAppButtons(fromNumber, {
            header: "Support & Records",
            body: bodyText,
            buttons: [
              { id: "sub_my_consultations", title: "📅 Consultations" },
              { id: "sub_med_records", title: "📄 Medical Records" },
              { id: "sub_talk_support", title: "🧑‍💼 Support Desk" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ 📅 My Consultations & Past Bookings\n2️⃣ 📄 Medical Records & Rx Download\n3️⃣ 🧑‍💼 Talk to Support Specialist`,
            {
              buttons: [
                { id: "sub_my_consultations", title: "📅 Consultations" },
                { id: "sub_med_records", title: "📄 Medical Records" },
                { id: "sub_talk_support", title: "🧑‍💼 Support Desk" },
              ],
            }
          );
        }

        // ── LEVEL 3.1: TELEMEDICINE CONSULTATION ──
        else if (
          buttonId === "doc_telemedicine" ||
          lowerText === "telemedicine" ||
          lowerText === "teleconsultation" ||
          (isLastMsgDoctorConsultMode && (lowerText === "1" || lowerText === "1."))
        ) {
          const bodyText =
            `📞 *Telemedicine Video Consultation*\n\n` +
            `Connect with verified doctors in minutes across 24 clinical specialties.\n\n` +
            `Please choose a specialty below or tap *All Specialties* to browse all departments:`;

          await sendWhatsAppButtons(fromNumber, {
            header: "Telemedicine Doctors",
            body: bodyText,
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "spec_cardio", title: "Cardiologist" },
              { id: "opt_other_specialty", title: "All Specialties" },
            ],
          });
          await recordBotMessage(bodyText, {
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "spec_cardio", title: "Cardiologist" },
              { id: "opt_other_specialty", title: "All Specialties" },
            ],
          });
        }

        // ── ALL VERIFIED DOCTORS DIRECTORY (Sends Native CTA Button, No Raw Link) ──
        else if (buttonId === "act_tele_all_docs") {
          const docDirectoryBody =
            `👨‍⚕️ *Verified MediConnect Doctors*\n\n` +
            `Browse verified specialists across Delhi NCR, check live clinic schedules, and book online.\n\n` +
            `To view all verified doctors, available time slots and book instantly, tap the button below:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Doctors Directory",
            body: docDirectoryBody,
            imageUrl: null,
            webUrl: "https://mediconnect.fit/doctors",
            webTitle: "🌐 View Doctors",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });

          await recordBotMessage(docDirectoryBody, {
            actionUrl: "https://mediconnect.fit/doctors",
            actionTitle: "🌐 View Doctors",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });
        }

        // ── LEVEL 3.1.2: SPECIALTY SELECTED -> SHOW THE LIST OF ALL DOCTORS OF THAT SPECIALTY ──
        else if (
          detectedSpecKey &&
          (detectedSpecKey !== "general" ||
            buttonId === "spec_gp" ||
            (isLastMsgSpecialtyList && (lowerText === "1" || lowerText === "1.")) ||
            lowerText === "general physician" ||
            lowerText === "general medicine" ||
            lowerText === "physician" ||
            lowerText === "gp" ||
            /\b(fever|cold|cough|weakness|fatigue|body\s*ache|chills|viral|flu|infection)\b/i.test(lowerText))
        ) {
          const specKey = detectedSpecKey;

          const specInfoMap = {
            general: { title: "General Physicians", target: "General Physician" },
            derma: { title: "Dermatologists", target: "Dermatology" },
            gynec: { title: "Gynecologists", target: "Gynecology" },
            pedia: { title: "Pediatricians", target: "Pediatrics" },
            ortho: { title: "Orthopedics", target: "Orthopedics" },
            obgyn: { title: "Gynecology", target: "Gynecology" },
            opht: { title: "Ophthalmology", target: "Ophthalmology" },
            cardio: { title: "Cardiologists", target: "Cardiology" },
            neuro: { title: "Neurologists", target: "Neurology" },
            endo: { title: "Endocrinologists", target: "Endocrinology" },
            nephro: { title: "Nephrology", target: "Nephrology" },
            psych: { title: "Psychiatrists", target: "Psychiatry" },
            pulmo: { title: "Pulmonologists", target: "Pulmonology" },
            dent: { title: "Dentists", target: "Dentistry" },
            surgery: { title: "General Surgeons", target: "General Surgery" },
            gastro: { title: "Gastroenterologists", target: "Gastroenterology" },
            ent: { title: "ENT Specialists", target: "ENT (Otorhinolaryngology)" },
            uro: { title: "Urologists", target: "Urology" },
            onco: { title: "Oncology", target: "Oncology" },
            rheum: { title: "Rheumatologists", target: "Rheumatology" },
            physio: { title: "Physiotherapists", target: "Physiotherapy" },
          };

          const currentSpec = specInfoMap[specKey] || { title: "Specialist Doctors", target: "General Physician" };
          const specTitle = currentSpec.title;
          const targetSpecialtyParam = currentSpec.target;

          const matchingDocs = getDoctorsBySpecialty(realDoctors, specKey);
          const topDocs = matchingDocs.slice(0, 2);
          let bodyText = "";
          if (topDocs.length > 0) {
            const docListText = topDocs
              .map(
                (d, i) =>
                  `${i + 1}️⃣ *${d.name}*\n   ${d.verifiedBadge || "✅ Verified Specialist"} • ⏳ ${d.experience}\n   🏥 ${sanitizeClinicName(d.clinic)}\n   💰 Consultation Fee: ₹${d.fee}`
              )
              .join("\n\n");

            bodyText =
              `👨‍⚕️ *${specTitle}*\n\n` +
              `${docListText}\n\n` +
              `To view all verified doctors, schedules, and book an appointment, tap below:\n\n` +
              `_💡 Reply with any number (1-24) or specialty name to view another department, or reply *menu* for main menu._`;
          } else {
            bodyText =
              `👨‍⚕️ *${specTitle}*\n\n` +
              `Tap below to view verified ${specTitle.toLowerCase()} and available booking schedules on MediConnect:\n\n` +
              `_💡 Reply with any number (1-24) or specialty name to view another department, or reply *menu* for main menu._`;
          }

          const specialtyWebUrl = `https://mediconnect.fit/doctors?specialty=${encodeURIComponent(targetSpecialtyParam)}&search=${encodeURIComponent(targetSpecialtyParam)}`;
          const specialtyWebTitle = `🌐 View Doctors`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: specTitle,
            body: bodyText,
            imageUrl: topDocs[0]?.profilePicture || null,
            webUrl: specialtyWebUrl,
            webTitle: specialtyWebTitle,
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });

          await recordBotMessage(bodyText, {
            doctorImage: topDocs[0]?.profilePicture || null,
            media: topDocs[0]?.profilePicture || null,
            actionUrl: specialtyWebUrl,
            actionTitle: specialtyWebTitle,
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });
        }

        // ── LEVEL 3.1.3: DOCTOR SELECTED -> SHOW AVAILABLE SLOTS FOR THAT DOCTOR ──
        else if (
          buttonId.startsWith("doc_pick_") ||
          (isLastMsgDoctorList && ["1", "2", "3", "4", "5"].includes(lowerText)) ||
          doctorNameMatch
        ) {
          let chosenDoctor = null;

          if (buttonId.startsWith("doc_pick_")) {
            const docId = buttonId.replace("doc_pick_", "");
            chosenDoctor = allAvailableDoctors.find((d) => d.id === docId);
          } else if (doctorNameMatch) {
            chosenDoctor = doctorNameMatch;
          } else if (isLastMsgDoctorList && ["1", "2", "3", "4", "5"].includes(lowerText)) {
            const idx = parseInt(lowerText, 10) - 1;
            // Determine specialty from last bot message or default to general
            let specKeyword = "general";
            const lastText = (lastBotMsg?.text || "").toLowerCase();
            if (lastText.includes("cardio") || lastText.includes("heart")) specKeyword = "cardio";
            else if (lastText.includes("derma") || lastText.includes("skin")) specKeyword = "derma";
            else if (lastText.includes("ortho") || lastText.includes("bone")) specKeyword = "ortho";
            else if (lastText.includes("pedia") || lastText.includes("child")) specKeyword = "pedia";
            else if (lastText.includes("gynec") || lastText.includes("obstetric") || lastText.includes("women")) specKeyword = "gynec";
            else if (lastText.includes("neuro") || lastText.includes("brain")) specKeyword = "neuro";
            else if (lastText.includes("uro") || lastText.includes("prostate") || lastText.includes("stone")) specKeyword = "uro";
            else if (lastText.includes("dent") || lastText.includes("teeth")) specKeyword = "dent";
            else if (lastText.includes("gastro") || lastText.includes("stomach") || lastText.includes("liver")) specKeyword = "gastro";
            else if (lastText.includes("pulmo") || lastText.includes("lung") || lastText.includes("asthma")) specKeyword = "pulmo";
            else if (lastText.includes("psych") || lastText.includes("mental")) specKeyword = "psych";
            else if (lastText.includes("endo") || lastText.includes("thyroid")) specKeyword = "endo";
            else if (lastText.includes("nephro") || lastText.includes("kidney")) specKeyword = "nephro";
            else if (lastText.includes("opht") || lastText.includes("eye")) specKeyword = "opht";
            else if (lastText.includes("onco") || lastText.includes("cancer")) specKeyword = "onco";
            else if (lastText.includes("rheum") || lastText.includes("arthrit")) specKeyword = "rheum";
            else if (lastText.includes("physio") || lastText.includes("rehab")) specKeyword = "physio";
            else if (lastText.includes("surg")) specKeyword = "surgery";
            else if (lastText.includes("ent") || lastText.includes("ear") || lastText.includes("throat")) specKeyword = "ent";

            const matching = getDoctorsBySpecialty(realDoctors, specKeyword);
            chosenDoctor = matching[idx] || null;
          }

          if (!chosenDoctor) {
            const noDocText =
              `Please select a verified doctor or specialty from the directory to view available booking slots.`;
            await sendWhatsAppTextMessage(fromNumber, noDocText);
            await recordBotMessage(noDocText);
            return;
          }

          // Query live slots from backend API / dynamic schedule
          const slotResult = await fetchDoctorLiveSlots(chosenDoctor.id);
          const liveSlots = slotResult.slots;

          const bodyText =
            `👨‍⚕️ *Available Slots for ${chosenDoctor.name}*\n` +
            `${chosenDoctor.verifiedBadge || "✅ Verified Specialist"} • ⏳ ${chosenDoctor.experience}\n` +
            `Specialty: ${chosenDoctor.specialization} • 💰 Fee: ₹${chosenDoctor.fee}\n` +
            `Consultation Mode: Video Consultation (Telemedicine)\n\n` +
            `Select your preferred time slot:`;

          const slotButtons = [
            {
              id: `slot_${encodeURIComponent(liveSlots[0])}_${chosenDoctor.id}`,
              title: liveSlots[0].slice(0, 20),
            },
            {
              id: `slot_${encodeURIComponent(liveSlots[1])}_${chosenDoctor.id}`,
              title: liveSlots[1].slice(0, 20),
            },
            {
              id: `slot_${encodeURIComponent(liveSlots[2])}_${chosenDoctor.id}`,
              title: liveSlots[2].slice(0, 20),
            },
          ];

          await sendWhatsAppButtons(fromNumber, {
            header: "Select Time Slot",
            body: bodyText,
            footer: "MediConnect Appointment Desk",
            buttons: slotButtons,
          });

          await recordBotMessage(
            `${bodyText}\n\n1️⃣ ${liveSlots[0]}\n2️⃣ ${liveSlots[1]}\n3️⃣ ${liveSlots[2]}`,
            {
              buttons: slotButtons,
              doctorImage: chosenDoctor.profilePicture,
              doctorName: chosenDoctor.name,
              experience: chosenDoctor.experience,
              fee: chosenDoctor.fee,
              verifiedBadge: chosenDoctor.verifiedBadge,
            }
          );
        }

        // ── LEVEL 3.1.4: SLOT SELECTED -> SHOW DETAILS & CTA URL BUTTON (NOT PLAIN LINK) ──
        else if (
          buttonId.startsWith("slot_") ||
          (isLastMsgSlotSelection && ["1", "2", "3"].includes(lowerText))
        ) {
          let timeSlot = "Tomorrow 11:00 AM";
          let docId = "";

          if (buttonId.startsWith("slot_")) {
            const lastUnderscore = buttonId.lastIndexOf("_");
            if (lastUnderscore > 5) {
              const rawSlot = buttonId.substring(5, lastUnderscore);
              try {
                timeSlot = decodeURIComponent(rawSlot);
              } catch (e) {
                timeSlot = rawSlot;
              }
              docId = buttonId.substring(lastUnderscore + 1);
            }
          } else {
            const slotIdx = parseInt(lowerText, 10) - 1;
            if (lastBotMsg && Array.isArray(lastBotMsg.buttons) && lastBotMsg.buttons[slotIdx]) {
              timeSlot = lastBotMsg.buttons[slotIdx].title;
              const bId = lastBotMsg.buttons[slotIdx].id;
              const lu = bId.lastIndexOf("_");
              if (lu > 0) docId = bId.substring(lu + 1);
            }
          }

          const matchedDoctor = allAvailableDoctors.find((d) => d.id === docId);
          if (!matchedDoctor) {
            const noDoc = `Doctor details could not be found. Please visit https://mediconnect.fit/doctors to select a verified doctor.`;
            await sendWhatsAppTextMessage(fromNumber, noDoc);
            await recordBotMessage(noDoc);
            return;
          }
          const doctorBookingUrl = `https://mediconnect.fit/doctor/${matchedDoctor.id}`;
          const appBookingUrl = `https://mediconnect.fit/doctor/${matchedDoctor.id}?mode=telemedicine`;
          const clinicName = sanitizeClinicName(matchedDoctor.clinic);

          const detailsBody =
            `👨‍⚕️ *Doctor Consultation Details*\n\n` +
            `• *Doctor*: ${matchedDoctor.name}\n` +
            `• *Specialty*: ${matchedDoctor.specialization}\n` +
            `• *Status*: ${matchedDoctor.verifiedBadge || "✅ Verified Specialist"}\n` +
            `• *Experience*: ${matchedDoctor.experience}\n` +
            `• *Selected Slot*: ${timeSlot}\n` +
            `• *Consultation Mode*: Video Consultation (Telemedicine)\n` +
            `• *Fee*: ₹${matchedDoctor.fee}\n` +
            `• *Clinic*: ${clinicName}\n\n` +
            `✨ *What you get*:\n` +
            `✓ Direct video room access with verified doctor\n` +
            `✓ ABHA-linked digital prescription in DigiLocker\n` +
            `✓ WhatsApp reminders 15 mins before the session\n\n` +
            `🌐 *Book on Website*:\n${doctorBookingUrl}\n\n` +
            `📱 *Book on MediConnect Mobile App*:\n${appBookingUrl}\n\n` +
            `Tap below to confirm your appointment and complete secure payment:`;

          // Send dual Web and App CTA buttons with doctor profile picture
          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Appointment Confirmation",
            body: detailsBody,
            imageUrl: matchedDoctor.profilePicture,
            webUrl: doctorBookingUrl,
            webTitle: "🌐 Book Online",
            appUrl: appBookingUrl,
            appTitle: "📱 Book on App",
          });

          await recordBotMessage(detailsBody, {
            doctorImage: matchedDoctor.profilePicture,
            media: matchedDoctor.profilePicture,
            doctorName: matchedDoctor.name,
            experience: matchedDoctor.experience,
            fee: matchedDoctor.fee,
            verifiedBadge: matchedDoctor.verifiedBadge,
            actionUrl: doctorBookingUrl,
            actionTitle: "🌐 Book Online",
            appUrl: appBookingUrl,
            appTitle: "📱 Book on App",
          });
        }

        // ── LEVEL 3.2: IN-CLINIC APPOINTMENT ──
        else if (
          buttonId === "doc_inclinic" ||
          lowerText === "in-clinic" ||
          lowerText === "in clinic" ||
          lowerText === "clinic visit" ||
          (isLastMsgDoctorConsultMode && (lowerText === "2" || lowerText === "2."))
        ) {
          const clinicBody =
            `🏥 *In-Clinic Doctor Appointment*\n\n` +
            `Book an in-person consultation at our partner clinics and hospital OPDs across Delhi NCR.\n\n` +
            `Please choose a specialty below or tap *All Specialties* to browse all departments:`;

          await sendWhatsAppButtons(fromNumber, {
            header: "In-Clinic Doctors",
            body: clinicBody,
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "spec_cardio", title: "Cardiologist" },
              { id: "opt_other_specialty", title: "All Specialties" },
            ],
          });
          await recordBotMessage(clinicBody, {
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "spec_cardio", title: "Cardiologist" },
              { id: "opt_other_specialty", title: "All Specialties" },
            ],
          });
        }

        // ── LEVEL 3.3: DOCTOR HOME VISIT ──
        else if (
          buttonId === "doc_homevisit" ||
          buttonId === "doc_home_visit" ||
          lowerText === "home visit" ||
          lowerText === "doctor home visit" ||
          (isLastMsgDoctorConsultMode && (lowerText === "3" || lowerText === "3."))
        ) {
          const visitBody =
            `🏡 *Doctor Home Visit Desk*\n\n` +
            `Request a certified physician for physical examination and vital checks at your doorstep.\n\n` +
            `Select a specialty or tap below to request a doctor home visit:`;

          await sendWhatsAppButtons(fromNumber, {
            header: "Doctor Home Visit",
            body: visitBody,
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "opt_other_specialty", title: "All Specialties" },
              { id: "sub_talk_support", title: "🧑‍💼 Call Desk" },
            ],
          });
          await recordBotMessage(visitBody, {
            buttons: [
              { id: "spec_gp", title: "General Physician" },
              { id: "opt_other_specialty", title: "All Specialties" },
              { id: "sub_talk_support", title: "🧑‍💼 Call Desk" },
            ],
          });
        }

        // ── LEVEL 3.4.3: HOME SAMPLE PACKAGE SELECTED ──
        else if (
          buttonId === "pkg_fullbody" ||
          buttonId === "pkg_diabetes" ||
          buttonId === "pkg_cbc" ||
          buttonId === "pkg_thyroid" ||
          buttonId === "pkg_lft_kft" ||
          buttonId === "pkg_vitamins" ||
          (isLastMsgHomeSample && (
            ["1", "2", "3", "4", "5", "6", "1.", "2.", "3.", "4.", "5.", "6."].includes(lowerText) ||
            lowerText.includes("full body") ||
            lowerText.includes("diabetes") ||
            lowerText.includes("lipid") ||
            lowerText.includes("cbc") ||
            lowerText.includes("thyroid") ||
            lowerText.includes("lft") ||
            lowerText.includes("kft") ||
            lowerText.includes("vitamin")
          ))
        ) {
          const homeList = getHomeSampleCollectionList();
          let pkg = homeList[0]; // default full body

          if (buttonId === "pkg_diabetes" || (isLastMsgHomeSample && (lowerText === "2" || lowerText === "2." || lowerText.includes("diabetes") || lowerText.includes("lipid") || lowerText.includes("sugar")))) {
            pkg = homeList[1];
          } else if (buttonId === "pkg_cbc" || (isLastMsgHomeSample && (lowerText === "3" || lowerText === "3." || lowerText.includes("cbc") || lowerText.includes("blood count")))) {
            pkg = homeList[2];
          } else if (buttonId === "pkg_thyroid" || (isLastMsgHomeSample && (lowerText === "4" || lowerText === "4." || lowerText.includes("thyroid") || lowerText.includes("tsh")))) {
            pkg = homeList[3];
          } else if (buttonId === "pkg_lft_kft" || (isLastMsgHomeSample && (lowerText === "5" || lowerText === "5." || lowerText.includes("lft") || lowerText.includes("kft") || lowerText.includes("liver") || lowerText.includes("kidney")))) {
            pkg = homeList[4];
          } else if (buttonId === "pkg_vitamins" || (isLastMsgHomeSample && (lowerText === "6" || lowerText === "6." || lowerText.includes("vitamin")))) {
            pkg = homeList[5];
          }

          const discount = Math.round((1 - pkg.price / pkg.mrp) * 100);
          const labBody =
            `🧪 *Lab Test Booking: ${pkg.name}*\n\n` +
            `• *Category*: 🏠 Home Sample Collection (4-Hour SLA)\n` +
            `• *Details*: ${pkg.details}\n` +
            `• *Specimen*: ${pkg.specimen}\n` +
            `• *Preparation*: ${pkg.fasting}\n` +
            `• *Report Delivery*: Digital report in ${pkg.schedule} with ABHA sync\n` +
            `• *Price*: ₹${pkg.price} (MRP: ₹${pkg.mrp} • ${discount}% OFF)\n\n` +
            `Tap below to select your slot and confirm doorstep collection:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Home Sample Booking",
            body: labBody,
            webUrl: pkg.webUrl,
            webTitle: "🧪 Book Lab Test",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });

          await recordBotMessage(labBody, {
            actionUrl: pkg.webUrl,
            actionTitle: "🧪 Book Lab Test",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });
        }

        // ── LEVEL 3.4.4: IN-LAB DIAGNOSTIC SCAN SELECTED ──
        else if (
          buttonId === "scan_usg" ||
          buttonId === "scan_xray" ||
          buttonId === "scan_ct" ||
          buttonId === "scan_mri" ||
          buttonId === "scan_cardiac" ||
          buttonId === "scan_biopsy" ||
          (isLastMsgLabSample && (
            ["1", "2", "3", "4", "5", "6", "1.", "2.", "3.", "4.", "5.", "6."].includes(lowerText) ||
            lowerText.includes("xray") ||
            lowerText.includes("x-ray") ||
            lowerText.includes("usg") ||
            lowerText.includes("ultrasound") ||
            lowerText.includes("sonograph") ||
            lowerText.includes("ct") ||
            lowerText.includes("mri") ||
            lowerText.includes("ecg") ||
            lowerText.includes("echo") ||
            lowerText.includes("biopsy") ||
            lowerText.includes("fnac")
          ))
        ) {
          const scanList = getInLabDiagnosticScansList();
          let scan = scanList[0]; // default USG

          if (buttonId === "scan_xray" || (isLastMsgLabSample && (lowerText === "1" || lowerText === "1." || lowerText.includes("xray") || lowerText.includes("x-ray")))) {
            scan = scanList[1];
          } else if (buttonId === "scan_usg" || (isLastMsgLabSample && (lowerText === "2" || lowerText === "2." || lowerText.includes("usg") || lowerText.includes("ultrasound") || lowerText.includes("sonograph")))) {
            scan = scanList[0];
          } else if (buttonId === "scan_ct" || (isLastMsgLabSample && (lowerText === "3" || lowerText === "3." || lowerText.includes("ct")))) {
            scan = scanList[2];
          } else if (buttonId === "scan_mri" || (isLastMsgLabSample && (lowerText === "4" || lowerText === "4." || lowerText.includes("mri")))) {
            scan = scanList[3];
          } else if (buttonId === "scan_cardiac" || (isLastMsgLabSample && (lowerText === "5" || lowerText === "5." || lowerText.includes("ecg") || lowerText.includes("echo") || lowerText.includes("cardiac")))) {
            scan = scanList[4];
          } else if (buttonId === "scan_biopsy" || (isLastMsgLabSample && (lowerText === "6" || lowerText === "6." || lowerText.includes("biopsy") || lowerText.includes("fnac")))) {
            scan = scanList[5];
          }

          const inLabBody =
            `🏥 *In-Lab Diagnostic Procedure: ${scan.name}*\n\n` +
            `• *Category*: 🏥 In-Lab Diagnostic Centre Visit Only\n` +
            `• *Procedure*: ${scan.details}\n` +
            `• *Partner Labs*: PRL Diagnostics, Dr Lal PathLabs & Partner Centres\n` +
            `• *Preparation*: ${scan.prep}\n` +
            `• *Report Delivery*: ${scan.schedule}\n` +
            `• *Price Range*: ${scan.priceRange}\n\n` +
            `Tap below to select your nearest diagnostic centre & schedule your slot:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "In-Lab Diagnostic Booking",
            body: inLabBody,
            webUrl: scan.webUrl,
            webTitle: "🏥 Book In-Lab",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });

          await recordBotMessage(inLabBody, {
            actionUrl: scan.webUrl,
            actionTitle: "🏥 Book In-Lab",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Book on App",
          });
        }

        // ── LEVEL 3.4.1: HOME SAMPLE COLLECTION (Display ONLY tests available for home collection) ──
        else if (
          buttonId === "act_lab_packages" ||
          buttonId === "act_lab_home" ||
          lowerText === "home sample" ||
          lowerText === "home sample collection" ||
          lowerText === "home collection" ||
          (isLastMsgLabDiagnostics && (lowerText === "1" || lowerText === "1."))
        ) {
          const bodyText =
            `🧪 *Doorstep Home Sample Collection (4-Hour SLA)*\n` +
            `A certified phlebotomist visits your doorstep for sample collection. Digital report delivered within 6–12 hours with ABHA sync.\n\n` +
            `*Available Home Sample Tests & Packages:*\n` +
            `1️⃣ *Full Body Health Checkup* (60+ tests • ₹999)\n` +
            `2️⃣ *Diabetes & Lipid Profile* (HbA1c, Chol • ₹499)\n` +
            `3️⃣ *Complete Blood Count (CBC)* (Hemogram • ₹299)\n` +
            `4️⃣ *Thyroid Profile (T3/T4/TSH)* (Vital • ₹399)\n` +
            `5️⃣ *Liver & Kidney Panel (LFT+KFT)* (₹599)\n` +
            `6️⃣ *Vitamin D & B12 Combo* (₹799)\n\n` +
            `_💡 Reply with 1-6 or test name (e.g. CBC, Sugar, Thyroid) to book doorstep collection, or type any test._`;

          await sendWhatsAppButtons(fromNumber, {
            header: "Home Sample Collection",
            body: bodyText,
            buttons: [
              { id: "pkg_fullbody", title: "Full Body Checkup" },
              { id: "pkg_diabetes", title: "Diabetes & Lipid" },
              { id: "pkg_cbc", title: "CBC Blood Count" },
            ],
          });
          await recordBotMessage(bodyText, {
            buttons: [
              { id: "pkg_fullbody", title: "Full Body Checkup" },
              { id: "pkg_diabetes", title: "Diabetes & Lipid" },
              { id: "pkg_cbc", title: "CBC Blood Count" },
            ],
          });
        }

        // ── LEVEL 3.4.2: IN-LAB DIAGNOSTICS & SCANS (Display ONLY tests that require in-lab collection) ──
        else if (
          buttonId === "act_lab_sample" ||
          buttonId === "act_lab_partner" ||
          lowerText === "lab sample" ||
          lowerText === "partner lab" ||
          lowerText === "in-lab" ||
          lowerText === "in lab" ||
          lowerText === "visit lab" ||
          lowerText === "in-lab diagnostics" ||
          (isLastMsgLabDiagnostics && (lowerText === "2" || lowerText === "2."))
        ) {
          const bodyText =
            `🏥 *In-Lab Sample & Diagnostic Procedures*\n` +
            `These tests require specialized diagnostic equipment or imaging scans and are conducted at accredited partner diagnostic centres.\n\n` +
            `*Available In-Lab Diagnostics & Scans:*\n` +
            `1️⃣ *Digital X-Ray* (Chest, Spine, Extremities • from ₹400)\n` +
            `2️⃣ *Ultrasound / USG* (Abdomen, Pelvis, Doppler • from ₹800)\n` +
            `3️⃣ *CT Scan (CECT/NCCT)* (Brain, Chest HRCT • from ₹2,000)\n` +
            `4️⃣ *MRI Scan (1.5T/3T)* (Brain, Spine, Joints • from ₹4,500)\n` +
            `5️⃣ *Cardiology (ECG / 2D Echo)* (Heart • from ₹350)\n` +
            `6️⃣ *In-Clinic Pathology & FNAC* (from ₹650)\n\n` +
            `_💡 Reply with 1-6 or scan name (e.g. Ultrasound, X-Ray, CT, MRI, Echo) to book an accredited centre slot._`;

          await sendWhatsAppButtons(fromNumber, {
            header: "In-Lab Diagnostics",
            body: bodyText,
            buttons: [
              { id: "scan_usg", title: "Ultrasound / USG" },
              { id: "scan_xray", title: "Digital X-Ray" },
              { id: "scan_mri", title: "CT & MRI Scans" },
            ],
          });
          await recordBotMessage(bodyText, {
            buttons: [
              { id: "scan_usg", title: "Ultrasound / USG" },
              { id: "scan_xray", title: "Digital X-Ray" },
              { id: "scan_mri", title: "CT & MRI Scans" },
            ],
          });
        }

        // ── LEVEL 3.4: LAB & DIAGNOSTICS MENU ──
        else if (
          buttonId === "hs_lab_diag" ||
          lowerText === "lab & diagnostics" ||
          lowerText === "lab" ||
          lowerText === "diagnostics" ||
          lowerText === "lab tests" ||
          lowerText === "health services" ||
          (isLastMsgHealthcareServices && (lowerText === "1" || lowerText === "1."))
        ) {
          const bodyText = "🔬 *Lab & Diagnostics*\nPlease select your preferred sample collection mode:";
          await sendWhatsAppButtons(fromNumber, {
            header: "Lab & Diagnostics",
            body: bodyText,
            buttons: [
              { id: "act_lab_packages", title: "Home Sample" },
              { id: "act_lab_sample", title: "Lab Sample" },
              { id: "opt_other_lab", title: "✍️ Other (Type)" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ Home Sample Collection (4-Hour SLA)\n2️⃣ Lab Sample (Partner Diagnostic Centres & Scans)\n3️⃣ ✍️ Other (Type any test name)`,
            {
              buttons: [
                { id: "act_lab_packages", title: "Home Sample" },
                { id: "act_lab_sample", title: "Lab Sample" },
                { id: "opt_other_lab", title: "✍️ Other (Type)" },
              ],
            }
          );
        }

        // ── LEVEL 3.5.2: NURSING CARE ACTION (Checked BEFORE parent menu to prevent loops) ──
        else if (
          buttonId === "act_nurse_care" ||
          buttonId === "act_nursing" ||
          buttonId === "act_home_nursing" ||
          lowerText === "nursing care" ||
          lowerText === "home nursing" ||
          lowerText === "nursing" ||
          lowerText === "nursing support" ||
          lowerText.includes("nursing")
        ) {
          const nurseBody =
            `🩺 *Home Nursing Care Desk*\n\n` +
            `Certified male and female nurses for post-operative care, wound dressing, infusion administration, and elderly assistance.\n\n` +
            `Tap below to book certified nursing care:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Home Nursing Care",
            body: nurseBody,
            webUrl: "https://mediconnect.fit/nursing-care",
            webTitle: "🩺 Book Nursing Care",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Open Mobile App",
          });

          await recordBotMessage(nurseBody, {
            actionUrl: "https://mediconnect.fit/nursing-care",
            actionTitle: "🩺 Book Nursing Care",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Open Mobile App",
          });
        }

        // ── LEVEL 3.5.1: PHARMACY DELIVERY ACTION ──
        else if (
          buttonId === "act_pharm_deliv" ||
          lowerText === "medicine delivery" ||
          lowerText === "order medicine"
        ) {
          const pharmBody =
            `💊 *Express Medicine Delivery*\n\n` +
            `Upload your doctor prescription for 2-hour doorstep delivery from verified local pharmacies with up to 20% discount.\n\n` +
            `Tap below to place your medicine order:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Pharmacy Delivery",
            body: pharmBody,
            webUrl: "https://mediconnect.fit/medicine-order",
            webTitle: "💊 Order Medicines",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Order in App",
          });

          await recordBotMessage(pharmBody, {
            actionUrl: "https://mediconnect.fit/medicine-order",
            actionTitle: "💊 Order Medicines",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Order in App",
          });
        }

        // ── LEVEL 3.5: PHARMACY & NURSING MENU ──
        else if (
          buttonId === "hs_pharm_nurse" ||
          lowerText === "pharmacy & nursing" ||
          lowerText === "pharmacy"
        ) {
          const bodyText = "💊 *Pharmacy & Home Nursing Services*\nChoose a service below:";
          await sendWhatsAppButtons(fromNumber, {
            header: "Healthcare Assistance",
            body: bodyText,
            buttons: [
              { id: "act_pharm_deliv", title: "Medicine Delivery" },
              { id: "act_nurse_care", title: "Nursing Care" },
              { id: "opt_other_service", title: "✍️ Other (Type)" },
            ],
          });
          await recordBotMessage(
            `${bodyText}\n\n1️⃣ Express Medicine Delivery\n2️⃣ Home Nursing Care Services\n3️⃣ ✍️ Other (Type your requirement)`,
            {
              buttons: [
                { id: "act_pharm_deliv", title: "Medicine Delivery" },
                { id: "act_nurse_care", title: "Nursing Care" },
                { id: "opt_other_service", title: "✍️ Other (Type)" },
              ],
            }
          );
        }

        // ── ALL SPECIALTIES DIRECTORY (All 24 Backend Categories) ──
        else if (
          buttonId === "opt_other_specialty" ||
          buttonId === "doc_other" ||
          buttonId === "act_tele_select_spec" ||
          lowerText === "all specialties" ||
          lowerText === "specialties" ||
          lowerText === "departments" ||
          lowerText === "other specialty" ||
          lowerText === "other" ||
          lowerText === "other (type)" ||
          lowerText === "✍️ other (type)" ||
          (isLastMsgDoctorConsultMode && (lowerText === "other" || lowerText === "other/search" || lowerText.includes("other")))
        ) {
          const specialtyMenuText =
            `🩺 *All Medical Specialties & Departments*\n\n` +
            `Please reply with a *number (1-24)* or *department name*:\n\n` +
            `1️⃣ *General Physician* (Fever, Cold, Cough, BP, Diabetes)\n` +
            `2️⃣ *Dermatologist* (Skin, Hair, Acne, Rashes, Allergies)\n` +
            `3️⃣ *Gynecologist* (Women's Health, Periods, PCOD, Fertility)\n` +
            `4️⃣ *Pediatrician* (Child Care, Growth, Vaccinations)\n` +
            `5️⃣ *Orthopedic* (Joints, Bone Pain, Fractures, Spine)\n` +
            `6️⃣ *Gynecology & Obstetrics* (Pregnancy & Maternity Care)\n` +
            `7️⃣ *Ophthalmology* (Eye Care, Vision, Cataract, Specs)\n` +
            `8️⃣ *Cardiologist* (Heart Health, Chest Pain, ECG)\n` +
            `9️⃣ *Neurologist* (Brain, Nerves, Migraine, Stroke, Spine)\n` +
            `🔟 *Endocrinologist* (Thyroid, Diabetes, Hormones)\n` +
            `1️⃣1️⃣ *Nephrologist* (Kidney Health, Dialysis, Swelling)\n` +
            `1️⃣2️⃣ *Psychiatrist* (Mental Health, Anxiety, Sleep, Stress)\n` +
            `1️⃣3️⃣ *Pulmonologist* (Lungs, Asthma, Allergy, Breathing)\n` +
            `1️⃣4️⃣ *Dentistry* (Teeth, Gums, Toothache, Root Canal)\n` +
            `1️⃣5️⃣ *Surgery* (Surgical Consultations, Minor Procedures)\n` +
            `1️⃣6️⃣ *Gastroenterologist* (Stomach, Acidity, Liver, Digestion)\n` +
            `1️⃣7️⃣ *ENT Specialist* (Ear, Nose, Throat, Sinus, Hearing)\n` +
            `1️⃣8️⃣ *Urologist* (Kidney Stones, Urinary Health, Prostate)\n` +
            `1️⃣9️⃣ *Nephrology* (Renal Care, Creatinine, Kidney Failure)\n` +
            `2️⃣0️⃣ *Oncologist* (Cancer Care, Tumors, Chemotherapy)\n` +
            `2️⃣1️⃣ *Rheumatologist* (Arthritis, Joint Swelling, Autoimmune)\n` +
            `2️⃣2️⃣ *Dental Care* (Teeth Cleaning, Dental Implants, Braces)\n` +
            `2️⃣3️⃣ *Physiotherapist* (Physical Rehab, Muscle Pain, Mobility)\n` +
            `2️⃣4️⃣ *General Surgery* (Hernia, Appendix, Gallbladder)\n\n` +
            `_Reply with a number (1-24) or type any health concern to view verified specialists!_`;

          await sendWhatsAppTextMessage(fromNumber, specialtyMenuText);
          await recordBotMessage(specialtyMenuText);
        }

        // ── ✍️ "OTHER (TYPE HERE)" PROMPT FLOW FOR LAB & GENERAL SERVICES ──
        else if (
          buttonId === "opt_other_lab" ||
          buttonId === "opt_other_service"
        ) {
          const promptText =
            `✍️ *Type Your Request*\n\n` +
            `Please reply with:\n` +
            `• Health test or scan (e.g. *Full Body Checkup*, *CBC*, *Thyroid*, *ECG*, *X-Ray*)\n` +
            `• Medicine or nursing service requirement\n` +
            `• Any health question or symptom\n\n` +
            `We will search our database and assist you immediately!`;

          await sendWhatsAppTextMessage(fromNumber, promptText);
          await recordBotMessage(promptText);
        }

        // ── LEVEL 3.55: CHECK MY CONSULTATIONS & BOOKING HISTORY (Verified Account Lookup) ──
        else if (
          buttonId === "sub_my_consultations" ||
          buttonId === "doc_my_consultations" ||
          lowerText.includes("my consultation") ||
          lowerText.includes("my booking") ||
          lowerText.includes("my appointment") ||
          lowerText.includes("past consultation") ||
          lowerText.includes("check consultation") ||
          lowerText.includes("consultation history") ||
          lowerText.includes("appointment history") ||
          lowerText.includes("booking status") ||
          lowerText.includes("consultation status") ||
          lowerText === "my consultations" ||
          lowerText === "my appointments" ||
          lowerText === "consultation" ||
          lowerText === "consultations" ||
          lowerText === "booking" ||
          lowerText === "bookings" ||
          lowerText === "check my booking"
        ) {
          const cleanPhone = String(fromNumber).replace(/\D/g, "").slice(-10);
          const maskedPhone =
            cleanPhone.length === 10
              ? `+91-******${cleanPhone.slice(-4)}`
              : `+91-******`;

          const consultations = await fetchPatientConsultationsByPhone(fromNumber);

          if (consultations && consultations.length > 0) {
            // Limited safe info to preserve medical confidentiality
            const topConsultations = consultations.slice(0, 2);

            const consultationItems = topConsultations
              .map((c, i) => {
                const docName = c.doctor?.full_name || "Verified Specialist";
                const docSpec = c.doctor?.specialization || "General Medicine";
                const apptDate = c.appointment_date
                  ? new Date(c.appointment_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Scheduled";
                const apptTime = c.appointment_time ? c.appointment_time.slice(0, 5) : "";
                const timeStr = apptTime ? ` at ${apptTime}` : "";
                const mode =
                  c.appointment_type === "home_visit"
                    ? "🏡 Home Visit"
                    : c.appointment_type === "clinic"
                    ? "🏥 In-Clinic OPD"
                    : "📹 Video Consultation";
                const status = (c.status || "confirmed").toUpperCase();
                const maskedId = c.id ? `MCN-${c.id.slice(-5).toUpperCase()}` : `MCN-APT`;

                return `${i + 1}️⃣ *${docName}* (${docSpec})\n   🔖 Ref: #${maskedId}\n   📅 ${apptDate}${timeStr}\n   🩺 ${mode}\n   📌 Status: *${status}*`;
              })
              .join("\n\n");

            const historyBody =
              `📋 *Your Consultation Records*\n` +
              `🔒 *Verified Patient Account*: ${maskedPhone}\n\n` +
              `${consultationItems}\n\n` +
              `🛡️ *Confidentiality Notice*:\n` +
              `To protect patient medical confidentiality, full diagnosis notes, ABHA-linked digital prescriptions, and video room access are protected.\n\n` +
              `Log in securely to view your complete consultation history, download prescriptions, or join your video consultation:`;

            await sendWhatsAppDualRedirect(fromNumber, {
              header: "Consultation History",
              body: historyBody,
              webUrl: "https://mediconnect.fit/login?redirect=/website/appointments",
              webTitle: "🌐 View History",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 View in App",
            });

            await recordBotMessage(historyBody, {
              actionUrl: "https://mediconnect.fit/login?redirect=/website/appointments",
              actionTitle: "🌐 View History",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 View in App",
            });
          } else {
            const noHistoryBody =
              `📋 *Consultation History Search*\n` +
              `🔒 *Verified Phone*: ${maskedPhone}\n\n` +
              `No active or past consultation bookings were found directly registered to this WhatsApp number.\n\n` +
              `If you booked with an alternate mobile number or want to view full health records and invoices, please log in with your registered account:`;

            await sendWhatsAppDualRedirect(fromNumber, {
              header: "Consultation History",
              body: noHistoryBody,
              webUrl: "https://mediconnect.fit/login?redirect=/website/appointments",
              webTitle: "🌐 MediConnect Web",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Open App",
            });

            await recordBotMessage(noHistoryBody, {
              actionUrl: "https://mediconnect.fit/login?redirect=/website/appointments",
              actionTitle: "🌐 MediConnect Web",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Open App",
            });
          }
        }

        // ── LEVEL 3.6: ABHA & DIGILOCKER (Sends CTA Buttons) ───────────────
        else if (buttonId === "sub_abha_digi" || lowerText.includes("abha") || lowerText.includes("digilocker")) {
          const abhaBody =
            `🪪 *ABHA & DigiLocker Services*\n\n` +
            `Link your 14-digit Ayushman Bharat Health Account (ABHA) for seamless paperless records across all hospitals & clinics in India.\n\n` +
            `Tap below to create or link your ABHA account:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "ABHA Health Account",
            body: abhaBody,
            webUrl: "https://mediconnect.fit/abha",
            webTitle: "🪪 Link ABHA",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Link in App",
          });

          await recordBotMessage(abhaBody, {
            actionUrl: "https://mediconnect.fit/abha",
            actionTitle: "🪪 Link ABHA",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 Link in App",
          });
        }

        // ── LEVEL 3.7: MEDICAL RECORDS (Sends CTA Buttons) ─────────────────
        else if (buttonId === "sub_med_records" || lowerText.includes("records") || lowerText.includes("prescription")) {
          const rxBody =
            `📄 *Medical Records & Digital Locker*\n\n` +
            `Access your prescriptions, lab reports, and doctor clinical summaries securely.\n\n` +
            `Tap below to access your digital health vault:`;

          await sendWhatsAppDualRedirect(fromNumber, {
            header: "Digital Health Records",
            body: rxBody,
            webUrl: "https://mediconnect.fit/digital-health-records",
            webTitle: "📄 View Records",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 View in App",
          });

          await recordBotMessage(rxBody, {
            actionUrl: "https://mediconnect.fit/digital-health-records",
            actionTitle: "📄 View Records",
            appUrl: "https://mediconnect.fit/find-doctors",
            appTitle: "📱 View in App",
          });
        }

        // ── LEVEL 3.8: HUMAN SUPPORT & TAKEOVER (Issue #10) ──────────────────
        else if (
          buttonId === "sub_talk_support" ||
          lowerText === "support" ||
          lowerText === "talk to support" ||
          lowerText.includes("support") ||
          lowerText.includes("human") ||
          lowerText.includes("coordinator") ||
          lowerText.includes("help desk")
        ) {
          const supportText =
            `🧑‍💼 *MediConnect Healthcare Support Desk*\n\n` +
            `A dedicated care coordinator has joined this conversation. Please describe your question or issue, and we will assist you immediately.\n\n` +
            `📞 *Direct Helplines*:\n` +
            `• Patient Support: +91 7289043888\n` +
            `• Care Coordinator Hotline: +91 7289043777\n` +
            `• Priority Speed Dial: 888\n\n` +
            `📧 *Support Email*: support@mediconnect.fit\n` +
            `⏰ *Calling Support Hours*: 9 AM – 9 PM`;
          await sendWhatsAppTextMessage(fromNumber, supportText);
          await recordBotMessage(supportText);
        }

        // ── INTELLIGENT REAL-DATA SEARCH (WHEN USER TYPES ANY TEXT) ──────
        else {
          // If text explicitly requests a test, scan, profile, or package, search lab tests first
          const hasExplicitTestWord = /\b(lab|labs|test|tests|scan|scans|profile|package|checkup|panel|cbc|mri|x-?ray|ultrasound|sonography|kft|lft|culture|biopsy|pathology)\b/i.test(lowerText);
          const isExplicitLabKeyword = hasExplicitTestWord && !detectedSpecKey;

          // 1. If query is a diagnostic/lab test query, search live backend lab tests first!
          let labSearchResult = null;
          if (isExplicitLabKeyword) {
            labSearchResult = await searchLabTestsFromApi(textContent);
          }

          // 2. Search verified doctors ONLY when user has explicit doctor or clinical intent
          const hasDoctorSearchIntent =
            Boolean(doctorNameMatch) ||
            Boolean(detectedSpecKey) ||
            /\b(dr\.?|doctor|doctors|specialist|specialists|clinic|clinics|hospital|consultation|appointment|fever|cold|cough|pain|skin|heart|bone|child|eye|teeth|stomach|kidney)\b/i.test(lowerText);

          let matchedDoctors = [];
          if (hasDoctorSearchIntent && (!isExplicitLabKeyword || (labSearchResult && labSearchResult.type === "tests_found" && labSearchResult.tests.length === 0))) {
            matchedDoctors = await searchDoctorsFromApi(textContent);
          }

          // 3. If explicit lab keyword but not searched yet, search lab tests
          if (isExplicitLabKeyword && !labSearchResult) {
            labSearchResult = await searchLabTestsFromApi(textContent);
          }

          // A. If lab tests/scans matched with real data
          if (labSearchResult && labSearchResult.type === "tests_found" && labSearchResult.tests.length > 0) {
            const formattedLabText = formatLabSearchResults(labSearchResult);
            const isScan = labSearchResult.tests.some((t) => t.isScan);
            const headerTitle = isScan ? "Diagnostic Scans" : "Diagnostic & Lab Tests";

            await sendWhatsAppDualRedirect(fromNumber, {
              header: headerTitle,
              body: formattedLabText,
              webUrl: "https://mediconnect.fit/services/lab-tests",
              webTitle: isScan ? "🧪 Book Scan Online" : "🧪 Book Lab Tests",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
            });

            await recordBotMessage(formattedLabText, {
              actionUrl: "https://mediconnect.fit/services/lab-tests",
              actionTitle: isScan ? "🧪 Book Scan Online" : "🧪 Book Lab Tests",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
              buttons: labSearchResult.tests.slice(0, 3).map((t) => ({
                id: `test_${t.test_name.slice(0, 15)}`,
                title: t.test_name.slice(0, 20),
              })),
            });
          }
          // B. If general lab query matched accredited labs list
          else if (labSearchResult && labSearchResult.type === "labs_list" && labSearchResult.labs.length > 0 && isExplicitLabKeyword) {
            const formattedLabText = formatLabSearchResults(labSearchResult);

            await sendWhatsAppDualRedirect(fromNumber, {
              header: "Partner Diagnostic Labs",
              body: formattedLabText,
              webUrl: "https://mediconnect.fit/services/lab-tests",
              webTitle: "🧪 View All Labs",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
            });

            await recordBotMessage(formattedLabText, {
              actionUrl: "https://mediconnect.fit/services/lab-tests",
              actionTitle: "🧪 View All Labs",
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
              buttons: labSearchResult.labs.slice(0, 3).map((l) => ({
                id: `lab_${l.id}`,
                title: l.name.slice(0, 20),
              })),
            });
          }
          // C. If doctors matched in real API
          else if (matchedDoctors.length > 0) {
            const topMatches = matchedDoctors.slice(0, 2);
            const docListStr = topMatches
              .map(
                (d, i) =>
                  `${i + 1}️⃣ *${d.name}* (${d.specialization})\n   ${d.verifiedBadge || "✅ Verified Specialist"} • ⏳ ${d.experience}\n   🏥 ${sanitizeClinicName(d.clinic)}\n   💰 Consultation Fee: ₹${d.fee}`
              )
              .join("\n\n");

            const searchResultText =
              `👨‍⚕️ *Verified Doctors for "${textContent}":*\n\n${docListStr}\n\n` +
              `➕ *...and 50+ more verified specialists available!*\n\n` +
              `To book your preferred slot and complete appointment, tap below:`;

            // Detect if search keyword maps to a clinical specialty
            let filteredWebUrl = "https://mediconnect.fit/doctors";
            let filteredWebTitle = "🌐 View Doctors";

            const lTxt = lowerText;
            if (lTxt.includes("derma") || lTxt.includes("skin") || lTxt.includes("hair") || lTxt.includes("acne")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Dermatology&search=Dermatology";
              filteredWebTitle = "🌐 Dermatologists";
            } else if (lTxt.includes("physician") || lTxt.includes("general") || lTxt.includes("fever") || lTxt.includes("cold") || lTxt.includes("cough")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=General%20Physician&search=General%20Physician";
              filteredWebTitle = "🌐 Physicians";
            } else if (lTxt.includes("cardio") || lTxt.includes("heart") || lTxt.includes("ecg") || lTxt.includes("chest pain")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Cardiology&search=Cardiology";
              filteredWebTitle = "🌐 Cardiologists";
            } else if (lTxt.includes("ortho") || lTxt.includes("bone") || lTxt.includes("joint") || lTxt.includes("fractur") || lTxt.includes("spine")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Orthopedics&search=Orthopedics";
              filteredWebTitle = "🌐 Orthopedics";
            } else if (lTxt.includes("pedia") || lTxt.includes("child") || lTxt.includes("baby") || lTxt.includes("infant")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Pediatrics&search=Pediatrics";
              filteredWebTitle = "🌐 Pediatricians";
            } else if (lTxt.includes("gynec") || lTxt.includes("women") || lTxt.includes("obgyn") || lTxt.includes("pregnan") || lTxt.includes("period")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Gynecology&search=Gynecology";
              filteredWebTitle = "🌐 Gynecologists";
            } else if (lTxt.includes("opht") || lTxt.includes("eye") || lTxt.includes("vision") || lTxt.includes("cataract")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Ophthalmology&search=Ophthalmology";
              filteredWebTitle = "🌐 Eye Specialists";
            } else if (lTxt.includes("neuro") || lTxt.includes("brain") || lTxt.includes("migraine") || lTxt.includes("headache") || lTxt.includes("nerve")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Neurology&search=Neurology";
              filteredWebTitle = "🌐 Neurologists";
            } else if (lTxt.includes("endo") || lTxt.includes("thyroid") || lTxt.includes("hormone") || lTxt.includes("diabet")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Endocrinology&search=Endocrinology";
              filteredWebTitle = "🌐 Endocrinologists";
            } else if (lTxt.includes("nephro") || lTxt.includes("kidney") || lTxt.includes("dialysis") || lTxt.includes("creatinine")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Nephrology&search=Nephrology";
              filteredWebTitle = "🌐 Nephrologists";
            } else if (lTxt.includes("psych") || lTxt.includes("mental") || lTxt.includes("depress") || lTxt.includes("anxiety") || lTxt.includes("sleep")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Psychiatry&search=Psychiatry";
              filteredWebTitle = "🌐 Psychiatrists";
            } else if (lTxt.includes("pulmo") || lTxt.includes("lung") || lTxt.includes("asthma") || lTxt.includes("breath")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Pulmonology&search=Pulmonology";
              filteredWebTitle = "🌐 Pulmonologists";
            } else if ((lTxt.includes("ent") && !lTxt.includes("dent") && !lTxt.includes("gastro")) || /\b(ear|ears|earache|throat|nose|sinus|hearing|tonsils?|sore\s*throat)\b/i.test(lTxt) || lTxt.includes("otorhino")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=ENT%20(Otorhinolaryngology)&search=ENT";
              filteredWebTitle = "🌐 ENT Specialists";
            } else if (lTxt.includes("dent") || lTxt.includes("teeth") || lTxt.includes("tooth") || lTxt.includes("gum") || lTxt.includes("oral")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Dentistry&search=Dentistry";
              filteredWebTitle = "🌐 Dentists";
            } else if (lTxt.includes("gastro") || lTxt.includes("stomach") || lTxt.includes("acid") || lTxt.includes("liver") || lTxt.includes("digest")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Gastroenterology&search=Gastroenterology";
              filteredWebTitle = "🌐 Gastroenterologists";
            } else if (lTxt.includes("uro") || lTxt.includes("urina") || lTxt.includes("prostate") || lTxt.includes("stone")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Urology&search=Urology";
              filteredWebTitle = "🌐 Urologists";
            } else if (lTxt.includes("onco") || lTxt.includes("cancer") || lTxt.includes("tumor") || lTxt.includes("chemo")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Oncology&search=Oncology";
              filteredWebTitle = "🌐 Oncologists";
            } else if (lTxt.includes("rheum") || lTxt.includes("arthrit") || lTxt.includes("autoimmun")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Rheumatology&search=Rheumatology";
              filteredWebTitle = "🌐 Rheumatologists";
            } else if (lTxt.includes("physio") || lTxt.includes("rehab") || lTxt.includes("muscle pain") || lTxt.includes("back pain")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=Physiotherapy&search=Physiotherapy";
              filteredWebTitle = "🌐 Physiotherapists";
            } else if (lTxt.includes("surger") || lTxt.includes("surgeon") || lTxt.includes("hernia") || lTxt.includes("appendix")) {
              filteredWebUrl = "https://mediconnect.fit/doctors?specialty=General%20Surgery&search=General%20Surgery";
              filteredWebTitle = "🌐 General Surgeons";
            } else if (topMatches[0]?.specialization) {
              const cleanSpec = topMatches[0].specialization.replace(/[,/].*$/, "").trim();
              filteredWebUrl = `https://mediconnect.fit/doctors?specialty=${encodeURIComponent(cleanSpec)}&search=${encodeURIComponent(cleanSpec)}`;
              filteredWebTitle = `🌐 View Doctors`;
            }

            await sendWhatsAppDualRedirect(fromNumber, {
              header: "Verified Doctors",
              body: searchResultText,
              imageUrl: topMatches[0]?.profilePicture,
              webUrl: filteredWebUrl,
              webTitle: filteredWebTitle,
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
            });

            await recordBotMessage(searchResultText, {
              doctorImage: topMatches[0]?.profilePicture,
              media: topMatches[0]?.profilePicture,
              actionUrl: filteredWebUrl,
              actionTitle: filteredWebTitle,
              appUrl: "https://mediconnect.fit/find-doctors",
              appTitle: "📱 Book on App",
            });
          }
          // D. Fallback for Unrecognized / Unwanted messages (Never sends doctors)
          else {
            const fallbackBody =
              `I didn't quite catch that. 😊\n\n` +
              `*MediConnect.fit* is your 24/7 digital healthcare companion. How can we help you today?\n\n` +
              `1️⃣ *Doctor Consultation* — Telemedicine or In-Clinic\n` +
              `2️⃣ *Health Services* — Home Lab Tests & Scans\n` +
              `3️⃣ *Support & Records* — Speak with Care Team\n\n` +
              `_💡 Or type your symptom directly (e.g. "fever", "chest pain", "skin rash") or reply *menu*._`;

            await sendWhatsAppButtons(fromNumber, {
              header: "MediConnect Healthcare",
              body: fallbackBody,
              buttons: [
                { id: "menu_consultation", title: "Doctor Consult" },
                { id: "menu_healthcare", title: "Health Services" },
                { id: "menu_support", title: "Support & Records" },
              ],
            });

            await recordBotMessage(fallbackBody, {
              buttons: [
                { id: "menu_consultation", title: "Doctor Consult" },
                { id: "menu_healthcare", title: "Health Services" },
                { id: "menu_support", title: "Support & Records" },
              ],
            });
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[WA WEBHOOK PANEL] Error handling webhook POST:", err);
    return new Response("Internal Error: " + (err?.message || String(err)), { status: 500 });
  }
}
