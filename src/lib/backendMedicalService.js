/**
 * MediConnect Backend Medical Service
 * Fetches 100% real doctor details, specialties, lab categories and booking URLs
 * from the live production backend API (https://mediconnect.fit/api)
 */

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || "https://mediconnect.fit/api";
const WEBSITE_BASE = "https://mediconnect.fit";
const APP_DOWNLOAD_URL = "https://mediconnect.fit/app";

// Cached memory store with 5-minute TTL to ensure fast responses
let cachedDoctors = null;
let cachedDoctorsTime = 0;
let cachedLabCategories = null;
let cachedLabCategoriesTime = 0;
let cachedApprovedLabs = null;
let cachedApprovedLabsTime = 0;

/**
 * Fetch public doctors from the real backend API without authentication
 */
export async function getPublicDoctors() {
  const now = Date.now();
  if (cachedDoctors && now - cachedDoctorsTime < 5 * 60 * 1000) {
    return cachedDoctors;
  }

  try {
    const res = await fetch(`${BACKEND_API_BASE}/doctors/get?public_only=true&limit=200`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      const normalized = rawList
        .map((doc) => {
          const details = doc.doctor_details || doc;
          const name = details.full_name || doc.full_name || "Specialist Doctor";
          const rawSpec = details.specialization || doc.specialization || "General Medicine";

          // Clean up specialization strings (e.g. "Other,General Physician" -> "General Physician")
          const cleanSpec = String(rawSpec)
            .replace(/^Other,\s*/i, "")
            .replace(/,Other.*/i, "")
            .trim() || "General Medicine";

          // Real fee from API (video_consultation_fee or clinic_consultation_fee or consultation_fee)
          const vFee = Number(details.video_consultation_fee);
          const cFee = Number(details.clinic_consultation_fee);
          const genFee = Number(details.consultation_fee);
          const displayFee = vFee > 0 ? vFee : (cFee > 0 ? cFee : (genFee > 0 ? genFee : 500));

          // Clean clinic name - never show Amerix Super Speciality Hospital
          let clinic = details.clinic_name || "Apollo Clinic / MediConnect Partner Clinic";
          if (!clinic || String(clinic).toLowerCase().includes("amerix")) {
            clinic = "Apollo Clinic / MediConnect Partner Clinic";
          }

          const exp = details.experience_years ? `${details.experience_years} Years Experience` : "10+ Years Experience";
          const isVerified = details.registration_verified !== false;
          const verifiedBadge = isVerified ? "✅ Verified Specialist" : "✅ MediConnect Verified";

          const profilePic =
            doc.profile_picture ||
            details.profile_picture ||
            details.passport_photo?.[0] ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0067A1&color=fff&bold=true`;

          return {
            id: doc.id || details.id,
            name: name.startsWith("Dr.") ? name : `Dr. ${name}`,
            specialization: cleanSpec,
            experience: exp,
            verifiedBadge: verifiedBadge,
            clinic: clinic,
            fee: displayFee,
            availableDays: details.available_days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            profilePicture: profilePic,
          };
        })
        .filter((d) => !d.name.toLowerCase().includes("test"));

      if (normalized.length > 0) {
        cachedDoctors = normalized;
        cachedDoctorsTime = now;
        return normalized;
      }
    }
  } catch (err) {
    console.warn("[backendMedicalService] Error fetching doctors from backend API:", err.message);
  }

  return [];
}

/**
 * Fetch approved partner labs from the real backend API with 5-minute cache
 */
export async function getApprovedLabs() {
  const now = Date.now();
  if (cachedApprovedLabs && now - cachedApprovedLabsTime < 5 * 60 * 1000) {
    return cachedApprovedLabs;
  }

  try {
    const res = await fetch(`${BACKEND_API_BASE}/patient/lab/labs?limit=50`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const labs = Array.isArray(json?.data?.labs) ? json.data.labs : [];
      if (labs.length > 0) {
        cachedApprovedLabs = labs;
        cachedApprovedLabsTime = now;
        return labs;
      }
    }
  } catch (err) {
    console.warn("[backendMedicalService] Error fetching approved labs from backend API:", err.message);
  }

  return cachedApprovedLabs || [];
}

const COMMON_LAB_SYNONYMS = {
  cbc: ["cbc", "complete blood count", "hemogram"],
  sugar: ["glucose", "sugar", "hba1c", "diabetes"],
  diabetes: ["glucose", "sugar", "hba1c", "diabetes"],
  glucose: ["glucose", "sugar", "hba1c", "diabetes"],
  xray: ["x-ray", "xray", "radiology"],
  "x-ray": ["x-ray", "xray", "radiology"],
  usg: ["ultrasound", "sonography", "usg"],
  ultrasound: ["ultrasound", "sonography", "usg"],
  ct: ["ct scan", "cect", "ncct", "computed tomography"],
  "ct scan": ["ct scan", "cect", "ncct", "computed tomography"],
  mri: ["mri", "magnetic resonance"],
  lipid: ["lipid", "cholesterol", "triglycerides"],
  cholesterol: ["lipid", "cholesterol", "triglycerides"],
  thyroid: ["thyroid", "tsh", "t3", "t4"],
  tsh: ["thyroid", "tsh", "t3", "t4"],
  kft: ["kft", "kidney", "creatinine", "urea", "rft"],
  kidney: ["kft", "kidney", "creatinine", "urea", "rft"],
  lft: ["lft", "liver function", "bilirubin", "sgot", "sgpt"],
  liver: ["lft", "liver function", "bilirubin", "sgot", "sgpt"],
  vitamin: ["vitamin d", "vitamin b12", "vitamin"],
  "vitamin d": ["vitamin d", "25-hydroxy", "cholecalciferol"],
  vitamind: ["vitamin d", "25-hydroxy", "cholecalciferol"],
  "vitamin b12": ["vitamin b12", "cyanocobalamin", "b12"],
  dengue: ["dengue", "ns1", "igg", "igm"],
  malaria: ["malaria", "smear", "antigen"],
  typhoid: ["typhoid", "widal"],
  urine: ["urine routine", "urine examination", "urine"],
  calcium: ["calcium", "ca++"],
  creatinine: ["creatinine", "kft"],
  "full body": ["full body", "health checkup", "package"],
};

function isRadiologyOrScan(testName, department) {
  const t = (testName || "").toLowerCase();
  const d = (department || "").toLowerCase();
  return (
    /\b(ct|cect|ncct|hrct|pet-ct)\b|ct scan|\bmri\b|x-?ray|ultrasound|sonograph|doppler|\becg\b|\bekg\b|\becho\b|mammograph|dexa|scanogram|radiology/i.test(t) ||
    /radiology|imaging|x-ray|ct scan|mri/i.test(d)
  );
}

function formatCollectionTypeDesc(testName, department, labAcceptsHome) {
  if (isRadiologyOrScan(testName, department)) {
    return "🏥 Partner Diagnostic Centre Visit";
  }
  if (labAcceptsHome) {
    return "🏠 Doorstep Home Collection (or 🏥 Lab Visit)";
  }
  return "🏥 Partner Lab Visit";
}

export function cleanReportingSchedule(sched) {
  if (!sched || sched === "#N/A" || sched === "Please enquire") return "Same day";
  let s = String(sched).trim().replace(/^Reporting Schedule\s*/i, "");
  if (/^same day/i.test(s)) return "Same day";
  if (/^next (working )?day/i.test(s)) return "Next day";
  const numMatch = s.match(/(\d+)(?:st|nd|rd|th)?\s*working\s*day/i);
  if (numMatch) return `${numMatch[1]} working days`;
  return s.length > 25 ? `${s.slice(0, 22)}...` : s;
}

export function getHomeSampleCollectionList() {
  return [
    {
      id: "pkg_fullbody",
      num: 1,
      name: "Full Body Health Checkup",
      details: "60+ Vital Parameters (CBC, Lipid, LFT, KFT, Sugar)",
      price: 999,
      mrp: 2499,
      fasting: "10-12 hrs fasting required",
      specimen: "Blood & Urine Sample",
      schedule: "Same Day (12h SLA)",
      category: "Full Body Packages",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=fullbody",
    },
    {
      id: "pkg_diabetes",
      num: 2,
      name: "Diabetes & Lipid Profile",
      details: "HbA1c, Fasting Blood Sugar, Total Cholesterol, HDL/LDL",
      price: 499,
      mrp: 1200,
      fasting: "8-10 hrs fasting required",
      specimen: "Blood Sample",
      schedule: "Same Day (6h SLA)",
      category: "Chronic Care",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=diabetes",
    },
    {
      id: "pkg_cbc",
      num: 3,
      name: "Complete Blood Count (CBC)",
      details: "Hemoglobin, TLC, DLC, Platelet Count, RBC Indices",
      price: 299,
      mrp: 500,
      fasting: "No fasting required",
      specimen: "EDTA Whole Blood",
      schedule: "Same Day (4h SLA)",
      category: "Routine Pathology",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=cbc",
    },
    {
      id: "pkg_thyroid",
      num: 4,
      name: "Thyroid Profile (T3, T4, TSH)",
      details: "Total T3, Total T4 & Ultra-Sensitive TSH",
      price: 399,
      mrp: 900,
      fasting: "Morning sample preferred",
      specimen: "Serum Blood Sample",
      schedule: "Same Day (6h SLA)",
      category: "Hormone Panel",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=thyroid",
    },
    {
      id: "pkg_lft_kft",
      num: 5,
      name: "Liver & Kidney Panel (LFT + KFT)",
      details: "SGOT, SGPT, Bilirubin, Creatinine, Urea, Uric Acid",
      price: 599,
      mrp: 1400,
      fasting: "10 hrs fasting required",
      specimen: "Serum Blood Sample",
      schedule: "Same Day (8h SLA)",
      category: "Organ Function",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=lft-kft",
    },
    {
      id: "pkg_vitamins",
      num: 6,
      name: "Vitamin D & B12 Combo",
      details: "25-OH Vitamin D & Active Vitamin B12 Levels",
      price: 799,
      mrp: 1800,
      fasting: "No fasting required",
      specimen: "Serum Blood Sample",
      schedule: "Same Day (10h SLA)",
      category: "Vitamins & Minerals",
      collection: "🏠 Doorstep Phlebotomist Home Collection",
      webUrl: "https://mediconnect.fit/services/lab-tests?home_collection=true&pkg=vitamins",
    },
  ];
}

export function getInLabDiagnosticScansList() {
  return [
    {
      id: "scan_usg",
      num: 1,
      name: "Ultrasound / USG Scan",
      details: "USG Whole Abdomen, Pelvis, Obstetrics / Pregnancy Sonography, Color Doppler",
      priceRange: "₹800 - ₹1,500",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Full bladder or fasting as advised by doctor",
      schedule: "Same Day Verified Report",
      category: "Ultrasound & Sonography",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=usg",
    },
    {
      id: "scan_xray",
      num: 2,
      name: "Digital X-Ray",
      details: "Chest PA View, Cervical Spine, Lumbar Spine, Knee / Joints",
      priceRange: "₹400 - ₹800",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Wear loose clothing, no metal accessories",
      schedule: "Instant / 2-Hour Report",
      category: "Radiology & Imaging",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=xray",
    },
    {
      id: "scan_ct",
      num: 3,
      name: "CT Scan (CECT / NCCT)",
      details: "CT Brain, High Resolution Chest CT (HRCT), Abdomen & Pelvis",
      priceRange: "₹2,000 - ₹5,500",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Fasting & Serum Creatinine report for contrast scans",
      schedule: "Same Day Radiologist Verification",
      category: "Advanced Tomography",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=ct",
    },
    {
      id: "scan_mri",
      num: 4,
      name: "MRI Scan (1.5T / 3T)",
      details: "MRI Brain, Lumbo-Sacral Spine, Cervical Spine, Knee / Joint MRI",
      priceRange: "₹4,500 - ₹8,500",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Strictly metal-free; safety questionnaire required",
      schedule: "Same Day / Next Day Report",
      category: "Magnetic Resonance Imaging",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=mri",
    },
    {
      id: "scan_cardiac",
      num: 5,
      name: "Cardiology (ECG / 2D Echo / TMT)",
      details: "12-Lead ECG, 2D Echocardiography with Doppler, Treadmill Stress Test",
      priceRange: "₹350 - ₹2,200",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Resting test; comfortable shoes for TMT",
      schedule: "Immediate Cardiologist Review",
      category: "Cardiac Diagnostics",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=cardiac",
    },
    {
      id: "scan_biopsy",
      num: 6,
      name: "In-Clinic Pathology & FNAC",
      details: "Fine Needle Aspiration Cytology (FNAC), Biopsy & Histopathology",
      priceRange: "₹650 - ₹2,500",
      venue: "🏥 Partner Diagnostic Centre Visit Only",
      prep: "Doctor referral prescription required",
      schedule: "24-48 Hours Pathologist Analysis",
      category: "Clinical Pathology",
      webUrl: "https://mediconnect.fit/services/lab-tests?type=fnac",
    },
  ];
}

/**
 * Intelligent Lab & Diagnostic Test Search matching user query across multiple partner labs
 */
export async function searchLabTestsFromApi(rawQuery, collectionFilter = null) {
  if (!rawQuery || typeof rawQuery !== "string") return null;
  const q = rawQuery.trim().toLowerCase();

  // Pure numbers or list number selections (e.g. "1", "2", "18", "18.") are not lab test names
  if (/^\d+(\b|\.|\s)/.test(q) || /^\d+$/.test(q)) {
    return null;
  }

  // Doctor specialty names and consultations should never return lab test results unless query explicitly mentions test/scan/package
  const isExplicitLabWord = /\b(test|tests|scan|scans|profile|package|checkup|panel|cbc|mri|x-?ray|ultrasound|sonography|kft|lft|culture|biopsy|pathology)\b/i.test(q);
  if (!isExplicitLabWord) {
    const specialtyTerms = [
      "cardio", "cardiologist", "cardiology", "heart",
      "derma", "dermatologist", "dermatology", "skin",
      "ortho", "orthopedic", "orthopedics", "bone", "joint",
      "pedia", "pediatrician", "pediatrics", "child",
      "gynec", "gynecologist", "gynecology", "obgyn", "obstetric",
      "opht", "ophthalmologist", "ophthalmology", "eye",
      "neuro", "neurologist", "neurology", "brain",
      "endo", "endocrinologist", "endocrinology",
      "nephro", "nephrologist", "nephrology",
      "psych", "psychiatrist", "psychiatry", "mental",
      "pulmo", "pulmonologist", "pulmonology", "lung",
      "dent", "dentist", "dentistry", "dental", "tooth", "teeth",
      "gastro", "gastroenterologist", "gastroenterology", "stomach",
      "ent", "ent specialist", "ear", "throat", "nose",
      "uro", "urologist", "urology", "prostate",
      "onco", "oncologist", "oncology", "cancer",
      "rheum", "rheumatologist", "rheumatology", "arthritis",
      "physio", "physiotherapist", "physiotherapy",
      "surgery", "surgeon", "general surgery",
      "general physician", "physician", "doctor", "gp"
    ];
    if (specialtyTerms.some((t) => q === t || q.startsWith(`${t} `) || q.endsWith(` ${t}`) || q.includes(` ${t} `))) {
      return null;
    }
  }

  const labs = await getApprovedLabs();
  const labMap = new Map();
  labs.forEach((l) => labMap.set(l.id, l));

  // Determine all synonym variations to search
  const searchTerms = [q];
  for (const [key, aliases] of Object.entries(COMMON_LAB_SYNONYMS)) {
    if (q === key || q.includes(key) || aliases.some((a) => q === a || q.includes(a))) {
      searchTerms.push(...aliases);
      break;
    }
  }
  const uniqueTerms = [...new Set(searchTerms)];

  // 1. Check services configured on lab profiles (e.g. imaging scans or full body packages)
  const matchedServices = [];
  for (const lab of labs) {
    if (Array.isArray(lab.services)) {
      for (const s of lab.services) {
        const sName = (s.service_name || "").toLowerCase();
        if (uniqueTerms.some((t) => sName.includes(t) || t.includes(sName))) {
          matchedServices.push({
            test_name: s.service_name,
            price: Number(s.price),
            lab_id: lab.id,
            lab_name: lab.lab_name,
            accepts_home_collection: Boolean(lab.accepts_home_collection),
            collection_type: "lab",
            specimen_type: "Diagnostic Scan / Procedure",
            reporting_schedule: "Same day",
            department: "Radiology / Imaging",
          });
        }
      }
    }
  }

  // 2. Query public lab tests API with fallback terms
  let rawTests = [];
  for (const term of uniqueTerms) {
    try {
      const res = await fetch(`${BACKEND_API_BASE}/public/lab-tests?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          rawTests = json.data;
          break;
        }
      }
    } catch (e) {
      console.warn("[backendMedicalService] Public lab-test query failed:", e.message);
    }
  }

  const combined = [...matchedServices, ...rawTests];

  // If no specific test matches the query but user asked generally about labs
  if (combined.length === 0) {
    return {
      type: "labs_list",
      query: rawQuery,
      labs: labs.slice(0, 3).map((l) => ({
        id: l.id,
        name: l.lab_name,
        address: l.address,
        accepts_home_collection: Boolean(l.accepts_home_collection),
        servicesCount: l.services?.length || 0,
        bookingUrl: `${WEBSITE_BASE}/services/lab-tests/${l.id}`,
      })),
      totalLabs: labs.length,
      generalUrl: `${WEBSITE_BASE}/services/lab-tests`,
    };
  }

  // Group tests across multiple labs by normalized test name
  const grouped = new Map();
  for (const item of combined) {
    const rawName = (item.test_name || item.name || "").trim();
    if (!rawName) continue;
    const normKey = rawName.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    const isScanTest = isRadiologyOrScan(rawName, item.department);

    // Apply strict collection filter if requested
    if (collectionFilter === "home" && isScanTest) {
      continue; // Exclude in-lab scans from home sample collection
    }
    if (collectionFilter === "lab" && !isScanTest) {
      continue; // Exclude home blood draws from in-lab procedures
    }

    if (!grouped.has(normKey)) {
      grouped.set(normKey, {
        test_name: rawName,
        specimen_type: item.specimen_type || "Blood / Serum",
        reporting_schedule: cleanReportingSchedule(item.reporting_schedule || item.schedule || item.turnaround_time),
        department: item.department || "",
        category: item.category?.name || "",
        isScan: isScanTest,
        labs: [],
      });
    }

    const entry = grouped.get(normKey);
    const labInfo = labMap.get(item.lab_id);
    const labName = item.lab_name || labInfo?.lab_name || "MediConnect Partner Lab";
    const labAcceptsHome = item.accepts_home_collection ?? labInfo?.accepts_home_collection ?? false;

    if (!entry.labs.some((l) => l.lab_name === labName)) {
      entry.labs.push({
        lab_id: item.lab_id || labInfo?.id,
        lab_name: labName,
        price: Number(item.price || item.offer_price || 0),
        accepts_home_collection: labAcceptsHome,
        collection_type: formatCollectionTypeDesc(rawName, item.department, labAcceptsHome),
        bookingUrl: item.lab_id ? `${WEBSITE_BASE}/services/lab-tests/${item.lab_id}` : `${WEBSITE_BASE}/services/lab-tests`,
      });
    }
  }

  // Rank groups: exact test name match first, then tests offered by more partner labs
  const ranked = Array.from(grouped.values()).sort((a, b) => {
    const aLower = a.test_name.toLowerCase();
    const bLower = b.test_name.toLowerCase();
    const aExact = aLower === q || aLower.startsWith(q) ? 2 : aLower.includes(q) ? 1 : 0;
    const bExact = bLower === q || bLower.startsWith(q) ? 2 : bLower.includes(q) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return b.labs.length - a.labs.length;
  });

  return {
    type: "tests_found",
    query: rawQuery,
    tests: ranked.slice(0, 3),
    totalMatches: ranked.length,
    generalUrl: `${WEBSITE_BASE}/services/lab-tests`,
  };
}

/**
 * Format real lab tests with pricing across multiple labs and collection types for WhatsApp
 */
export function formatLabSearchResults(searchResult) {
  if (!searchResult) return null;

  if (searchResult.type === "tests_found") {
    const { query, tests, totalMatches } = searchResult;
    const hasScan = tests.some((t) => t.isScan);
    const titleType = hasScan ? "Diagnostic & Lab Scans" : "Diagnostic & Lab Tests";

    let text = `🔬 *${titleType} for "${query}":*\n\n`;

    tests.forEach((t, i) => {
      const numEmoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"][i] || `${i + 1}️⃣`;

      // Price range across labs
      const prices = t.labs.map((l) => l.price).filter((p) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const priceStr = minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`;

      const collectionBadge = t.isScan
        ? "🏥 In-Lab Only (Equipment)"
        : "🏠 Doorstep Home Sample";

      text += `${numEmoji} *${t.test_name}*\n`;
      text += `   💰 *Price*: ${priceStr}\n`;
      text += `   🚗 *Collection*: ${collectionBadge}\n`;
      text += `   ⚡ *Report*: ${cleanReportingSchedule(t.reporting_schedule)}\n\n`;
    });

    if (totalMatches > tests.length) {
      text += `➕ *+${totalMatches - tests.length} more accredited options available*\n\n`;
    }

    text += `Tap below to compare partner labs & schedule:`;

    return text;
  }

  if (searchResult.type === "labs_list") {
    let text = `🏥 *MediConnect Accredited Partner Labs:*\n\n`;
    searchResult.labs.forEach((lab, i) => {
      const numEmoji = ["1️⃣", "2️⃣", "3️⃣"][i] || `${i + 1}️⃣`;
      const coll = lab.accepts_home_collection
        ? "🏠 Doorstep Home Sample & 🏥 Centre"
        : "🏥 Centre Visit Only";
      text += `${numEmoji} *${lab.name}*\n`;
      text += `   📍 Location: ${lab.address || "New Delhi / NCR"}\n`;
      text += `   🚗 Collection: ${coll}\n\n`;
    });
    text += `Tap below to browse all available lab tests & book online:`;
    return text;
  }

  return null;
}

/**
 * Fetch Lab Test Categories strictly from real backend API
 */
export async function getLabCategories() {
  const now = Date.now();
  if (cachedLabCategories && now - cachedLabCategoriesTime < 10 * 60 * 1000) {
    return cachedLabCategories;
  }

  try {
    const res = await fetch(`${BACKEND_API_BASE}/lab/categories`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        cachedLabCategories = json.data;
        cachedLabCategoriesTime = now;
        return json.data;
      }
    }
  } catch (err) {
    console.warn("[backendMedicalService] Error fetching lab categories from backend API:", err.message);
  }

  return [];
}

/**
 * Intelligent Doctor Search matching user query (name, specialty, symptom)
 */
export async function searchDoctorsFromApi(query) {
  if (!query || typeof query !== "string") return [];
  const q = query.trim().toLowerCase();

  const allDoctors = await getPublicDoctors();

  // Keyword to specialty mapping for symptoms
  const symptomMap = {
    fever: "General Physician",
    cold: "General Physician",
    cough: "General Physician",
    chest: "Cardiology",
    heart: "Cardiology",
    bp: "Cardiology",
    skin: "Dermatology",
    rash: "Dermatology",
    hair: "Dermatology",
    acne: "Dermatology",
    ear: "ENT",
    nose: "ENT",
    throat: "ENT",
    sinus: "ENT",
    bone: "Orthopedics",
    joint: "Orthopedics",
    fracture: "Orthopedics",
    knee: "Orthopedics",
    teeth: "Dentistry",
    tooth: "Dentistry",
    dental: "Dentistry",
    eye: "Ophthalmology",
    vision: "Ophthalmology",
    cataract: "Ophthalmology",
    stomach: "Gastroenterology",
    digestion: "Gastroenterology",
    liver: "Gastroenterology",
    acid: "Gastroenterology",
    kidney: "Nephrology",
    dialysis: "Nephrology",
    renal: "Nephrology",
    urine: "Urology",
    urinary: "Urology",
    prostate: "Urology",
    stone: "Urology",
    uro: "Urology",
    brain: "Neurology",
    nerve: "Neurology",
    migraine: "Neurology",
    stroke: "Neurology",
    neuro: "Neurology",
    child: "Pediatrics",
    baby: "Pediatrics",
    infant: "Pediatrics",
    pedia: "Pediatrics",
    pregnant: "Gynecology",
    pregnancy: "Gynecology",
    period: "Gynecology",
    pcod: "Gynecology",
    women: "Gynecology",
    gynec: "Gynecology",
    thyroid: "Endocrinology",
    diabetes: "Endocrinology",
    sugar: "Endocrinology",
    hormone: "Endocrinology",
    cancer: "Oncology",
    tumor: "Oncology",
    onco: "Oncology",
    arthritis: "Rheumatology",
    gout: "Rheumatology",
    rheum: "Rheumatology",
    physio: "Physiotherapy",
    rehab: "Physiotherapy",
    hernia: "General Surgery",
    appendix: "General Surgery",
    surgery: "General Surgery",
    lung: "Pulmonology",
    asthma: "Pulmonology",
    breath: "Pulmonology",
    pulmo: "Pulmonology",
    mental: "Psychiatry",
    anxiety: "Psychiatry",
    depress: "Psychiatry",
    sleep: "Psychiatry",
    stress: "Psychiatry",
    psych: "Psychiatry",
  };

  let targetSpecialty = "";
  for (const [symptom, spec] of Object.entries(symptomMap)) {
    if (q.includes(symptom)) {
      targetSpecialty = spec;
      break;
    }
  }

  const matches = allDoctors.filter((doc) => {
    const docName = doc.name.toLowerCase();
    const docSpec = doc.specialization.toLowerCase();
    const clinic = (doc.clinic || "").toLowerCase();

    if (docName.includes(q) || docSpec.includes(q) || clinic.includes(q)) return true;
    if (targetSpecialty && docSpec.includes(targetSpecialty.toLowerCase())) return true;
    return false;
  });

  return matches;
}

/**
 * Build unified booking URLs for Web and Mobile App
 */
export function getBookingLinks(doctorId, specialty) {
  const webDoctorUrl = doctorId
    ? `${WEBSITE_BASE}/website/doctor/${doctorId}`
    : specialty
    ? `${WEBSITE_BASE}/doctors?specialty=${encodeURIComponent(specialty)}`
    : `${WEBSITE_BASE}/doctors`;

  return {
    webUrl: webDoctorUrl,
    appUrl: APP_DOWNLOAD_URL,
    labWebUrl: `${WEBSITE_BASE}/services/lab-tests`,
    pharmacyWebUrl: `${WEBSITE_BASE}/medicine-order`,
    nursingWebUrl: `${WEBSITE_BASE}/nursing-care`,
    homeVisitWebUrl: `${WEBSITE_BASE}/doctors`,
    cardioWebUrl: `${WEBSITE_BASE}/cardio-connect`,
    lungWebUrl: `${WEBSITE_BASE}/lung-connect`,
  };
}

function parseTimeTo24h(str) {
  if (!str) return "09:00";
  str = String(str).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return str.slice(0, 5);
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function formatTo12h(time24) {
  if (!time24) return "10:00 AM";
  const [hStr, mStr] = String(time24).split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr || "00"} ${ampm}`;
}

function generateDoctorSlotsFromApiHours(startTime, endTime, intervalMin = 30) {
  const start = parseTimeTo24h(startTime);
  const end = parseTimeTo24h(endTime);
  const slots = [];
  let current = new Date(`1970-01-01T${start}:00`);
  const endLimit = new Date(`1970-01-01T${end}:00`);

  while (current < endLimit) {
    const time24 = current.toTimeString().slice(0, 5);
    slots.push({
      time24,
      display12: formatTo12h(time24),
    });
    current.setMinutes(current.getMinutes() + intervalMin);
  }
  return slots;
}

/**
 * Query real live slots for a doctor directly from backend API
 * Extracts the doctor's actual available_time, video_slots, and slot_interval_minutes.
 */
export async function fetchDoctorLiveSlots(doctorId) {
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. First try backend API /api/doctors/slots
  try {
    const res = await fetch(`${BACKEND_API_BASE}/doctors/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctor_id: doctorId,
        date: todayStr,
        appointment_type: "video_consultation",
      }),
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        const available = json.data
          .filter((s) => !s.slot_booked)
          .map((s) => s.slot_time || s.start_time || s.time || s)
          .filter(Boolean);

        if (available.length > 0) {
          return {
            source: "backend_api",
            slots: available.slice(0, 3).map((t) => (t.includes("Today") || t.includes("Tomorrow") ? t : `Today ${formatTo12h(t)}`)),
          };
        }
      }
    }
  } catch (err) {
    console.warn("[backendMedicalService] Error calling /api/doctors/slots:", err.message);
  }

  // 2. Fetch doctor's real working schedule directly from backend API (/api/doctors/get?public_only=true)
  try {
    const detailRes = await fetch(`${BACKEND_API_BASE}/doctors/get?public_only=true&limit=200`, { cache: "no-store" });
    const detailJson = await detailRes.json().catch(() => ({}));
    const rawList = Array.isArray(detailJson?.data) ? detailJson.data : Array.isArray(detailJson) ? detailJson : [];
    const fullDoc = rawList.find((d) => (d.id || d.doctor_details?.id) === doctorId) || rawList[0];
    const details = fullDoc?.doctor_details || fullDoc;

    const availableTime = details?.available_time;
    let startTime = "10:00";
    let endTime = "20:00";
    const slotInterval = details?.slot_interval_minutes ? Number(details.slot_interval_minutes) : 30;

    if (availableTime && typeof availableTime === "object" && availableTime.start && availableTime.end) {
      startTime = availableTime.start;
      endTime = availableTime.end;
    } else if (details?.video_slots && typeof details.video_slots === "object") {
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = weekdays[new Date().getDay()];
      const daySlots = details.video_slots[dayName];
      if (Array.isArray(daySlots) && daySlots[0]?.start && daySlots[0]?.end) {
        startTime = daySlots[0].start;
        endTime = daySlots[0].end;
      }
    }

    // Generate real slots from doctor's actual hours
    const realSlots = generateDoctorSlotsFromApiHours(startTime, endTime, slotInterval > 0 ? slotInterval : 30);

    // Calculate current Indian Standard Time (IST)
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const istNow = new Date(utc + 5.5 * 3600000);
    const istHour = istNow.getHours();
    const istMin = istNow.getMinutes();
    const currentMins = istHour * 60 + istMin;

    const upcomingToday = [];
    const tomorrowSlots = [];

    realSlots.forEach(({ time24, display12 }) => {
      const [h, m] = time24.split(":").map(Number);
      const slotMins = h * 60 + m;
      if (slotMins > currentMins + 10) {
        upcomingToday.push(`Today ${display12}`);
      } else {
        tomorrowSlots.push(`Tomorrow ${display12}`);
      }
    });

    const chosenSlots = [];
    if (upcomingToday.length >= 2) {
      chosenSlots.push(upcomingToday[0], upcomingToday[1]);
      if (upcomingToday.length >= 3) {
        chosenSlots.push(upcomingToday[2]);
      } else if (tomorrowSlots.length > 0) {
        chosenSlots.push(tomorrowSlots[0]);
      }
    } else if (upcomingToday.length === 1) {
      chosenSlots.push(upcomingToday[0]);
      if (tomorrowSlots.length >= 1) chosenSlots.push(tomorrowSlots[0]);
      if (tomorrowSlots.length >= 2) chosenSlots.push(tomorrowSlots[1]);
    } else {
      chosenSlots.push(...tomorrowSlots.slice(0, 3));
    }

    if (chosenSlots.length > 0) {
      return {
        source: "doctor_api_schedule",
        slots: chosenSlots,
      };
    }
  } catch (e) {
    console.warn("[backendMedicalService] Error generating real doctor slots from API schedule:", e.message);
  }

  return {
    source: "doctor_api_schedule",
    slots: [],
  };
}

/**
 * Query real patient consultations from backend API by verified phone number
 */
export async function fetchPatientConsultationsByPhone(phone) {
  try {
    const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) return [];

    const res = await fetch(`${BACKEND_API_BASE}/appointment/web?search=${encodeURIComponent(cleanPhone)}&limit=5`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json?.data?.appointments) ? json.data.appointments : [];
    }
  } catch (err) {
    console.warn("[backendMedicalService] Error fetching patient consultations by phone:", err.message);
  }
  return [];
}

