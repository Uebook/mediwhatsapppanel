"use client";

import "@/styles/globals.css";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("wa_panel_user");
      if (stored) {
        setUser(JSON.parse(stored));
      } else if (pathname !== "/login") {
        router.replace("/login");
      }
    } catch (e) {
      if (pathname !== "/login") router.replace("/login");
    } finally {
      setCheckingAuth(false);
    }
  }, [pathname, router]);

  // If on login page, render clean standalone view
  if (pathname === "/login") {
    return (
      <html lang="en">
        <head>
          <title>Sign In — MediConnect WhatsApp Ops Panel</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
        </head>
        <body className="bg-slate-50 text-slate-900 min-h-screen antialiased font-sans selection:bg-[#00629b] selection:text-white">
          {children}
          <Toaster position="top-right" />
        </body>
      </html>
    );
  }

  // If loading authentication
  if (checkingAuth && !user) {
    return (
      <html lang="en">
        <body className="bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#00629b] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Loading MediConnect WhatsApp Desk...</span>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>MediConnect.fit — WhatsApp Operations Desk</title>
        <meta name="description" content="Enterprise WhatsApp Support & Operations Panel for MediConnect.fit" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className={`bg-slate-50 text-slate-900 antialiased flex flex-col font-sans selection:bg-[#00629b] selection:text-white ${pathname === "/conversations" ? "h-screen overflow-hidden" : "min-h-screen"}`}>
        <div className={`flex ${pathname === "/conversations" ? "h-screen overflow-hidden" : "min-h-screen"}`}>
          {/* Main Sidebar */}
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          {/* Dynamic Content Frame */}
          <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
              pathname === "/conversations" ? "h-screen overflow-hidden" : ""
            } ${
              sidebarOpen ? "lg:ml-64" : "lg:ml-20"
            }`}
          >
            <Navbar
              onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              sidebarOpen={sidebarOpen}
            />

            <main
              className={`flex-1 min-w-0 ${
                pathname === "/conversations"
                  ? "h-[calc(100vh-4rem)] overflow-hidden p-0 bg-[#f0f2f5]"
                  : "p-4 lg:p-6 bg-slate-50/80 overflow-y-auto min-h-[calc(100vh-4rem)]"
              }`}
            >
              {children}
            </main>
          </div>
        </div>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 500,
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            },
          }}
        />
      </body>
    </html>
  );
}
