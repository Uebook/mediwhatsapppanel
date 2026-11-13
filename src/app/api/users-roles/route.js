import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xskruftixchdbrsnitbh.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU";

const SUPABASE_BUCKET = "whatsapp-store";
const SUPABASE_FILE = "users_rbac.json";
const MEDICONNECT_STAFF_API = "https://mediconnect.fit/api/admin/staff";

const DEFAULT_USERS = [
  {
    id: "u-admin",
    name: "Super Admin",
    email: "admin@mediconnect.fit",
    role: "Super Admin",
    permissions: ["ALL_ACCESS", "BROADCASTS", "TEMPLATES_CRUD", "TAKEOVERS", "AUDIT_EXPORT"],
    status: "Active",
    lastLogin: "Just now",
    source: "Database",
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-support",
    name: "Support Desk",
    email: "support@mediconnect.fit",
    role: "Support Agent",
    permissions: ["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"],
    status: "Active",
    lastLogin: "Active Today",
    source: "Database",
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-muskan",
    name: "Muskan Sharma",
    email: "muskan@mediconnect.fit",
    role: "Support Agent",
    permissions: ["LIVE_TAKEOVER", "REPLY_WHATSAPP"],
    status: "Active",
    lastLogin: "Active Now",
    source: "Database",
    createdAt: new Date().toISOString(),
  },
];

async function fetchFromMediconnectDb() {
  try {
    const res = await fetch(MEDICONNECT_STAFF_API, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const staffList = data.data?.staff || [];
    return staffList.map((s) => ({
      id: "staff-" + s.id,
      name: s.full_name || "Staff Member",
      email: (s.email || "").toLowerCase(),
      phone: s.phone || "",
      employeeCode: s.employee_code || "",
      department: s.department || "Medical Operations",
      role: s.staff_roles?.name || (s.designation === "nurse" ? "Nurse Operations" : "Support Agent"),
      permissions: s.staff_roles?.name?.toLowerCase().includes("support")
        ? ["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"]
        : ["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW"],
      status: s.is_active ? "Active" : "Suspended",
      lastLogin: s.last_login_at
        ? new Date(s.last_login_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Active Today",
      source: "MediConnect Main DB",
      createdAt: s.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[users-roles] MediConnect main DB staff fetch error:", err.message);
    return [];
  }
}

async function fetchUsersFromDb(forceSyncMediconnect = false) {
  let dbUsers = [];
  try {
    // 1. Fetch from Supabase Cloud Storage
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${SUPABASE_FILE}?t=${Date.now()}`;
    const res = await fetch(fileUrl, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        dbUsers = data;
      }
    }
  } catch (err) {
    console.warn("[users-roles] Supabase fetch error:", err.message);
  }

  if (dbUsers.length === 0) {
    dbUsers = [...DEFAULT_USERS];
  }

  // 2. If forceSync or first time, merge MediConnect production DB staff
  const existingEmails = new Set(dbUsers.map((u) => (u.email || "").toLowerCase()));
  const rdsStaff = await fetchFromMediconnectDb();
  let hasNewStaff = false;

  for (const s of rdsStaff) {
    if (s.email && !existingEmails.has(s.email.toLowerCase())) {
      dbUsers.push(s);
      existingEmails.add(s.email.toLowerCase());
      hasNewStaff = true;
    }
  }

  // If newly merged or empty, persist back to Supabase Cloud DB
  if (hasNewStaff) {
    try {
      await saveUsersToDb(dbUsers);
    } catch (e) {}
  }

  return dbUsers;
}

async function saveUsersToDb(users) {
  try {
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_FILE}`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
      },
      body: JSON.stringify(users, null, 2),
    });
    return res.ok;
  } catch (err) {
    console.error("[users-roles] Supabase save error:", err.message);
    return false;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const forceSync = searchParams.get("sync") === "true";
    const users = await fetchUsersFromDb(forceSync);
    return NextResponse.json({
      success: true,
      source: "supabase_db",
      syncedWithMediconnectDb: true,
      users,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      role = "Support Agent",
      phone = "",
      department = "",
      employeeCode = "",
      password = "admin123",
      permissions,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const currentUsers = await fetchUsersFromDb();

    // Check if email already exists
    if (currentUsers.some((u) => (u.email || "").toLowerCase() === cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "An agent or user with this email already exists" },
        { status: 400 }
      );
    }

    const defaultPerms =
      role === "Super Admin"
        ? ["ALL_ACCESS", "BROADCASTS", "TEMPLATES_CRUD", "TAKEOVERS", "AUDIT_EXPORT"]
        : role === "Medical Operations"
        ? ["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW", "SEND_TEMPLATES"]
        : ["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"];

    const finalPermissions =
      Array.isArray(permissions) && permissions.length > 0 ? permissions : defaultPerms;

    let authId = null;

    // Register user in Supabase Auth DB with full metadata
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: password || "admin123",
          email_confirm: true,
          user_metadata: {
            name: name.trim(),
            role,
            phone: phone.trim(),
            department: department.trim(),
            employeeCode: employeeCode.trim(),
            permissions: finalPermissions,
            status: "Active",
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        authId = authData.id;
      }
    } catch (authErr) {
      console.warn("[users-roles] Supabase Auth user register warning:", authErr.message);
    }

    const newUser = {
      id: authId ? `auth-${authId}` : `u-${Date.now()}`,
      auth_id: authId || null,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      department: department.trim() || (role === "Super Admin" ? "Administration" : "Customer Support"),
      employeeCode: employeeCode.trim() || `WA${String(currentUsers.length + 1).padStart(4, "0")}`,
      role,
      permissions: finalPermissions,
      status: "Active",
      lastLogin: "Invited",
      source: "Database",
      createdAt: new Date().toISOString(),
    };

    const updated = [...currentUsers, newUser];
    await saveUsersToDb(updated);

    return NextResponse.json({
      success: true,
      user: newUser,
      users: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, status, role, permissions, phone, department, employeeCode, name, password } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const currentUsers = await fetchUsersFromDb();
    let targetUser = null;

    const updated = currentUsers.map((u) => {
      if (u.id === id || (u.auth_id && u.auth_id === id)) {
        targetUser = {
          ...u,
          name: name !== undefined ? name.trim() : u.name,
          phone: phone !== undefined ? phone.trim() : (u.phone || ""),
          department: department !== undefined ? department.trim() : (u.department || ""),
          employeeCode: employeeCode !== undefined ? employeeCode.trim() : (u.employeeCode || ""),
          status: status !== undefined ? status : u.status,
          role: role !== undefined ? role : u.role,
          permissions: permissions !== undefined ? permissions : u.permissions,
        };
        return targetUser;
      }
      return u;
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Also sync updates to Supabase Auth DB
    try {
      let authUserId = targetUser.auth_id;
      if (!authUserId && targetUser.email) {
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const match = (listData.users || []).find(
            (u) => u.email?.toLowerCase() === targetUser.email.toLowerCase()
          );
          if (match) authUserId = match.id;
        }
      }

      if (authUserId) {
        const updatePayload = {
          user_metadata: {
            name: targetUser.name,
            role: targetUser.role,
            phone: targetUser.phone,
            department: targetUser.department,
            employeeCode: targetUser.employeeCode,
            permissions: targetUser.permissions,
            status: targetUser.status,
          },
        };
        if (password) {
          updatePayload.password = password;
        }
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
          method: "PUT",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatePayload),
        });
      }
    } catch (authUpdateErr) {
      console.warn("[users-roles] Supabase auth sync warning:", authUpdateErr.message);
    }

    await saveUsersToDb(updated);

    return NextResponse.json({
      success: true,
      user: targetUser,
      users: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    if (id === "u-admin" || id === "b58edcf6-39e4-4ac6-b513-24ae17fb4d09") {
      return NextResponse.json(
        { success: false, error: "Cannot delete the primary Super Admin account" },
        { status: 403 }
      );
    }

    const currentUsers = await fetchUsersFromDb();
    const toDelete = currentUsers.find((u) => u.id === id || u.auth_id === id);
    const filtered = currentUsers.filter((u) => u.id !== id && u.auth_id !== id);

    // Also delete user from Supabase Auth DB
    if (toDelete && toDelete.email) {
      try {
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const match = (listData.users || []).find(
            (u) => u.email?.toLowerCase() === toDelete.email.toLowerCase()
          );
          if (match && match.id) {
            await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${match.id}`, {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
          }
        }
      } catch (authDelErr) {
        console.warn("[users-roles] Supabase Auth deletion warning:", authDelErr.message);
      }
    }

    await saveUsersToDb(filtered);

    return NextResponse.json({
      success: true,
      users: filtered,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
