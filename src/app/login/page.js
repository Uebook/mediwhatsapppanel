"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Key, Shield } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("support@mediconnect.fit");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success && data.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("wa_panel_user", JSON.stringify(data.user));
        }
        toast.success(`Welcome back, ${data.user.name}!`);
        router.push("/dashboard");
      } else {
        toast.error(data.error || "Authentication failed. Invalid email or password.");
      }
    } catch (err) {
      toast.error("Login request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (type) => {
    if (type === "support") {
      setEmail("support@mediconnect.fit");
      setPassword("admin123");
    } else {
      setEmail("admin@mediconnect.fit");
      setPassword("admin123");
    }
    toast.success("Credentials filled");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#00629b] text-white font-bold text-xl mb-3 shadow-subtle">
          M
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          MediConnect<span className="text-[#00629b]">.fit</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          WhatsApp Support & Operations Desk
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">Sign in to your account</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter your credentials to access the live support desk.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mediconnect.fit"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50/80 border border-slate-200/90 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50/80 border border-slate-200/90 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00629b] focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00629b] hover:bg-[#004f7c] text-white font-semibold rounded-lg transition shadow-subtle flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Demo Credentials */}
        <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3 h-3 text-[#00629b]" />
            Quick Demo Login
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials("support")}
              className="p-2 text-left bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-200 rounded-lg transition"
            >
              <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#00629b]" />
                Support Agent
              </div>
              <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">support@...</div>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials("admin")}
              className="p-2 text-left bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 hover:border-sky-200 rounded-lg transition"
            >
              <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#00629b]" />
                Admin
              </div>
              <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">admin@...</div>
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 text-center">
        Protected by MediConnect.fit Role-Based Access Control
      </p>
    </div>
  );
}
