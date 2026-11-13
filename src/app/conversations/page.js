"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Send,
  UserCheck,
  AlertTriangle,
  FileText,
  Paperclip,
  Check,
  CheckCheck,
  Info,
  Bot,
  MessageSquare,
  Plus,
  Loader2,
  Smile,
  MoreVertical,
  Users,
  Tag,
  Moon,
  Sun,
  Download,
  Image as ImageIcon,
  Video,
  Play,
  Volume2,
  Music,
  X,
  Sparkles,
  Mic,
  Shield,
  ShieldCheck,
  Ban,
  Flag,
  Pin,
  PinOff,
  Phone,
  Globe,
  ExternalLink,
  Smartphone,
  ZoomIn,
  Maximize2,
  ArrowLeft,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";

// Robust media format inspectors
export function isImageMedia(media) {
  if (!media) return false;
  const t = (media.type || "").toLowerCase();
  const u = (media.url || "").toLowerCase();
  return t.startsWith("image") || /\.(jpe?g|png|webp|gif|svg)($|\?)/i.test(u);
}

export function isVideoMedia(media) {
  if (!media) return false;
  const t = (media.type || "").toLowerCase();
  const u = (media.url || "").toLowerCase();
  return t.startsWith("video") || /\.(mp4|webm|mov|m4v|ogg)($|\?)/i.test(u);
}

export function isAudioMedia(media) {
  if (!media) return false;
  const t = (media.type || "").toLowerCase();
  const u = (media.url || "").toLowerCase();
  return t.startsWith("audio") || t === "voice" || /\.(mp3|ogg|opus|wav|m4a|aac)($|\?)/i.test(u);
}

export function formatLastMessagePreview(msg) {
  if (!msg) return "Active Thread";
  if (msg.media) {
    if (isImageMedia(msg.media)) return "📷 Photo";
    if (isVideoMedia(msg.media)) return "🎥 Video";
    if (isAudioMedia(msg.media)) return "🎤 Voice message";
    return `📄 ${msg.media.name || "Attachment"}`;
  }
  if (msg.text) {
    const lower = msg.text.toLowerCase().trim();
    if (lower === "[image message]") return "📷 Photo";
    if (lower === "[video message]") return "🎥 Video";
    if (lower === "[audio message]") return "🎤 Voice message";
    return formatWhatsAppText(msg.text);
  }
  return "Active Thread";
}

// Helper to expand approved Meta template tokens into full, authentic WhatsApp text
export function formatWhatsAppText(text) {
  if (!text) return "";

  // 1. Remove ratings completely from any chat or message
  text = text
    .replace(/⭐\s*[0-9.]+(\s*\([^)]*\))?/g, "")
    .replace(/⭐[^\n]*/g, "")
    .replace(/\s*•\s*⭐[^\n]*/g, "")
    .replace(/Rating:?\s*[0-9.]+\s*(\/5)?/gi, "");

  // 2. Never show Amerix Super Speciality Hospital
  text = text
    .replace(/Amerix Super Speciality Hospital/gi, "Apollo Clinic / MediConnect Partner Clinic")
    .replace(/Amerix/gi, "Apollo Clinic");

  if (text.includes("mediconnect_test_message")) {
    const match = text.match(/\(([^,]+),\s*([^)]+)\)/);
    const name = match ? match[1].trim() : "Support Desk";
    const ref = match ? match[2].trim() : "MC-843991";
    return `Hello ${name}, this is a test message from MediConnect. Your reference number is ${ref}. Thank you for choosing MediConnect.fit.`;
  }

  if (text.includes("navratri_post")) {
    return "Wishing everyone a very Happy Navratri! May Maa Durga bless you with happiness, good health, success and prosperity.";
  }

  return text;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function formatMessageTime(rawTimestamp, fallbackTime) {
  if (!rawTimestamp && !fallbackTime) return "";
  const num = Number(rawTimestamp);
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
      try {
        return new Date(ms).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (e2) {
        return fallbackTime || "";
      }
    }
  }
  return fallbackTime || "";
}

// Date-wise chat list timestamps (Issue 4: Today -> Time, Yesterday -> "Yesterday", Older -> Date)
export function formatConversationTimestamp(rawTimestamp, fallbackTime) {
  if (!rawTimestamp && !fallbackTime) return "";
  let ms = Number(rawTimestamp);
  if (isNaN(ms) || ms <= 0) {
    return fallbackTime || "";
  }
  if (ms < 10000000000) ms *= 1000;

  const date = new Date(ms);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    try {
      return date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    }
  }

  if (isYesterday) {
    return "Yesterday";
  }

  try {
    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch (e) {
    return date.toLocaleDateString();
  }
}

const EMOJI_CATEGORIES = [
  {
    name: "Smileys & Faces",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃",
      "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪",
      "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏",
      "😒", "🙄", "😬", "😮‍💨", "🤥", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
      "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
    ],
  },
  {
    name: "Gestures & Hands",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "👏", "🙌", "👐", "🤲",
      "🙏", "✍️", "💪", "🤳",
    ],
  },
  {
    name: "Hearts & Emotions",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌",
    ],
  },
  {
    name: "Healthcare & Life",
    emojis: [
      "🩺", "💊", "💉", "🩹", "🧬", "🔬", "🩸", "🏥", "🚑", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️",
      "🍏", "💧", "🧘", "🏃", "🫀", "🫁", "🦷", "🦴", "🌡️", "📋",
    ],
  },
  {
    name: "Symbols & Status",
    emojis: [
      "✨", "🔥", "⭐", "🌟", "💯", "⚡", "💥", "✅", "❌", "⚠️", "❓", "❗",
      "📅", "⏰", "⏳", "🔔", "📌", "📍", "🎉", "💐",
    ],
  },
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "unread" | "read"
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Mobile view toggle (Issue 16)
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Top Action Modals & In-Chat Search (Issue 11)
  const [showCallModal, setShowCallModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // Audio Recording with MediaRecorder API (Issue 15)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Message Tracking for Notifications (Issue 3)
  const knownMsgIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Attachment & Emoji Picker State
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Read / Unread Status Tracking
  const [readMap, setReadMap] = useState({});

  // More Options Menu & Contact Info State
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Pinned Chats Tracking
  const [pinnedChats, setPinnedChats] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("mediconnect_wa_pinned_chats");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Report Contact Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Spam or unsolicited messages");
  const [reportDetails, setReportDetails] = useState("");
  const [reportAlsoBlock, setReportAlsoBlock] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Quick simulate incoming reply state
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulatedText, setSimulatedText] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const inputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState({ name: "Muskan Sharma", role: "Support Agent" });

  // Get active logged in user & restore read map
  useEffect(() => {
    const syncUser = () => {
      try {
        const storedUser = localStorage.getItem("wa_panel_user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.name) setCurrentUser(parsed);
        }
      } catch (e) {}
    };

    syncUser();

    try {
      const storedRead = localStorage.getItem("mediconnect_wa_read_map");
      if (storedRead) {
        setReadMap(JSON.parse(storedRead));
      }
    } catch (e) {}

    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightboxMedia(null);
      }
    };
    if (lightboxMedia) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxMedia]);

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load real templates
  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.templates) {
          setTemplates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  // Load real conversations from API
  const loadConversations = async () => {
    try {
      const res = await fetch("/api/whatsapp/messages");
      const data = await res.json();

      let loadedConvs = [];

      // Restore saved conversations structure from localStorage for custom labels/agent state
      const savedMap = {};
      const saved = localStorage.getItem("mediconnect_wa_live_conversations");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) || [];
          parsed.forEach((c) => {
            const digits = (c.mobile || "").replace(/\D/g, "").slice(-10);
            if (digits) savedMap[digits] = c;
          });
        } catch (e) {}
      }

      // Read status tracking
      let currentReadMap = {};
      try {
        currentReadMap = JSON.parse(localStorage.getItem("mediconnect_wa_read_map") || "{}");
      } catch (e) {}

      if (data.success && data.allMessages) {
        for (const [phone, msgs] of Object.entries(data.allMessages)) {
          const cleanDigits = phone.replace(/\D/g, "").slice(-10);
          if (!cleanDigits) continue;
          const cleanPhone = "+91 " + cleanDigits;
          const existing = savedMap[cleanDigits] || {};

          // Strictly sort messages chronologically by normalized timestamp (ms)
          const sortedMsgs = (Array.isArray(msgs) ? [...msgs] : []).sort((a, b) => {
            const tsA = Number(a.rawTimestamp || 0);
            const tsB = Number(b.rawTimestamp || 0);
            const normA = tsA < 10000000000 ? tsA * 1000 : tsA;
            const normB = tsB < 10000000000 ? tsB * 1000 : tsB;
            return normA - normB;
          });

          const lastMsg = sortedMsgs[sortedMsgs.length - 1];

          let pName = existing.patientName || `WhatsApp User (+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)})`;
          if (cleanDigits === "8439993033") pName = "Support Desk (+91 84399 93033)";
          if (cleanDigits === "1800227575") pName = "1800227575";

          const hasAgentMsg = sortedMsgs.some((m) => m.sender === "agent");
          const takeover = existing.takeoverStatus || (hasAgentMsg ? "HUMAN_OWNERSHIP_ACTIVE" : "ACTIVE_AUTOMATION");

          // Calculate unread count based on incoming messages received
          const readInfo = currentReadMap[cleanDigits] || {};
          const lastReadTime = readInfo.lastReadTime || 0;
          const isManualUnread = readInfo.isManualUnread || false;

          const incomingUnread = sortedMsgs.filter((m) => {
            const mTs = Number(m.rawTimestamp || 0);
            const norm = mTs < 10000000000 ? mTs * 1000 : mTs;
            return (m.sender === "patient" || m.sender === "inbound") && norm > lastReadTime;
          });

          const rawUnread = isManualUnread ? Math.max(incomingUnread.length, 1) : incomingUnread.length;
          // Issue 10: Reset unread count if conversation is currently open
          const isCurrentlyActive = selectedId === "conv-" + cleanDigits;
          const unreadCount = isCurrentlyActive ? 0 : rawUnread;
          const isBlocked = Boolean(existing.isBlocked || (Array.isArray(data.blockedContacts) && data.blockedContacts.includes(cleanDigits)));
          const isReported = Boolean(existing.isReported || (data.reportedContacts && data.reportedContacts[cleanDigits]));

          loadedConvs.push({
            id: "conv-" + cleanDigits,
            patientName: pName,
            mobile: cleanPhone,
            patientId: existing.patientId || `PT-${cleanDigits.slice(-5)}`,
            serviceType: existing.serviceType || "Meta WhatsApp Cloud API Desk",
            workflowState: isBlocked ? "BLOCKED" : (existing.workflowState || "ACTIVE"),
            escalationTag: existing.escalationTag || (sortedMsgs.some((m) => m.status === "failed") ? "HIGH" : "NORMAL"),
            takeoverStatus: takeover,
            assignedAgent: existing.assignedAgent || (takeover === "HUMAN_OWNERSHIP_ACTIVE" ? (currentUser?.name || "Support Desk") : null),
            lastMessage: formatLastMessagePreview(lastMsg),
            lastActivity: lastMsg ? formatConversationTimestamp(lastMsg.rawTimestamp, lastMsg.time) : "Recently",
            unreadCount: unreadCount,
            isUnread: unreadCount > 0,
            isBlocked: isBlocked,
            isReported: isReported,
            messages: sortedMsgs,
          });
        }

        // Issue 3 & Issue 5: Chronological sort of conversations by most recent message timestamp (descending)
        loadedConvs.sort((a, b) => {
          const lastA = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
          const lastB = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
          const tsA = Number(lastA?.rawTimestamp || 0);
          const tsB = Number(lastB?.rawTimestamp || 0);
          const normA = tsA < 10000000000 ? tsA * 1000 : tsA;
          const normB = tsB < 10000000000 ? tsB * 1000 : tsB;
          return normB - normA;
        });

        // Issue 3: In-app popup/toast for incoming messages without manual refresh
        if (!isFirstLoadRef.current) {
          for (const conv of loadedConvs) {
            const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
            if (lastMsg && (lastMsg.sender === "patient" || lastMsg.sender === "inbound")) {
              if (!knownMsgIdsRef.current.has(lastMsg.id)) {
                toast(`💬 Incoming message from ${conv.patientName}:\n"${lastMsg.text?.slice(0, 50) || 'Attachment'}"`, {
                  icon: "🔔",
                  duration: 4000,
                });
              }
            }
          }
        }
        isFirstLoadRef.current = false;
        loadedConvs.forEach((c) => (c.messages || []).forEach((m) => knownMsgIdsRef.current.add(m.id)));
      }

      setConversations((prev) => {
        // Keep any pending local messages currently sending
        const pendingMap = {};
        prev.forEach((c) => {
          const pending = (c.messages || []).filter((m) => m.status === "sending");
          if (pending.length > 0) pendingMap[c.id] = pending;
        });

        return loadedConvs.map((c) => {
          if (pendingMap[c.id]) {
            const serverIds = new Set((c.messages || []).map((m) => m.id));
            const stillPending = pendingMap[c.id].filter((m) => !serverIds.has(m.id));
            return { ...c, messages: [...c.messages, ...stillPending] };
          }
          return c;
        });
      });

      setSelectedId((prev) => {
        // Support direct ?phone=... deep-linking from Takeovers / Escalations
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const phoneParam = params.get("phone");
          if (phoneParam) {
            const cleanTarget = phoneParam.replace(/\D/g, "").slice(-10);
            const foundByParam = loadedConvs.find((c) => (c.mobile || "").includes(cleanTarget));
            if (foundByParam) {
              setMobileShowChat(true);
              return foundByParam.id;
            }
          }
        }
        if (prev && loadedConvs.some((c) => c.id === prev)) {
          return prev; // PRESERVE currently selected conversation!
        }
        return loadedConvs.length > 0 ? loadedConvs[0].id : null;
      });
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    if (!loadingInitial && conversations.length > 0) {
      localStorage.setItem("mediconnect_wa_live_conversations", JSON.stringify(conversations));
    }
  }, [conversations, loadingInitial]);

  const currentConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  // Mark conversation as read when active (Issue 10: Synchronized across sessions)
  const markAsRead = async (convId) => {
    if (!convId) return;
    const digits = convId.replace(/\D/g, "").slice(-10);
    if (!digits) return;

    setReadMap((prev) => {
      const next = { ...prev, [digits]: { lastReadTime: Date.now(), isManualUnread: false } };
      localStorage.setItem("mediconnect_wa_read_map", JSON.stringify(next));
      return next;
    });

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0, isUnread: false } : c))
    );

    // Synchronize to backend database
    try {
      await fetch("/api/whatsapp/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: "+91 " + digits, action: "mark_read" }),
      });
    } catch (e) {}
  };

  // Mark conversation as unread manually
  const markAsUnread = (convId) => {
    if (!convId) return;
    const digits = convId.replace(/\D/g, "").slice(-10);
    if (!digits) return;

    setReadMap((prev) => {
      const next = { ...prev, [digits]: { lastReadTime: 0, isManualUnread: true } };
      localStorage.setItem("mediconnect_wa_read_map", JSON.stringify(next));
      return next;
    });

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: Math.max(c.unreadCount || 0, 1), isUnread: true } : c))
    );
    toast.success("Marked as Unread");
    setShowMoreMenu(false);
  };

  const handleSelectConversation = (id) => {
    setSelectedId(id);
    setMobileShowChat(true);
    markAsRead(id);
  };

  // Filter conversations matching search and "all" | "unread" | "read" tabs, prioritizing pinned chats
  const filteredConversations = conversations
    .filter((c) => {
      const matchesSearch =
        c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.mobile.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filter === "unread") {
        return c.unreadCount > 0 || c.isUnread;
      }
      if (filter === "read") {
        return !c.isUnread && (!c.unreadCount || c.unreadCount === 0);
      }
      return true;
    })
    .sort((a, b) => {
      const isPinnedA = pinnedChats.has(a.id);
      const isPinnedB = pinnedChats.has(b.id);
      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;
      return 0;
    });

  const unreadTotalCount = conversations.filter((c) => c.unreadCount > 0 || c.isUnread).length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConv?.id, currentConv?.messages?.length]);

  const handleCreateNewChat = (e) => {
    e?.preventDefault();
    if (!newPhoneNumber.trim()) {
      toast.error("Please enter a valid phone number");
      return;
    }

    const cleanDigits = newPhoneNumber.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    const formattedMobile = "+91 " + cleanDigits.slice(-10);
    const newId = "conv-" + cleanDigits.slice(-10);

    const existing = conversations.find(
      (c) => c.mobile.replace(/\D/g, "").slice(-10) === cleanDigits.slice(-10)
    );

    if (existing) {
      handleSelectConversation(existing.id);
      setShowNewChatModal(false);
      setNewPhoneNumber("");
      setNewPatientName("");
      toast.success("Opened existing conversation");
      return;
    }

    const newConv = {
      id: newId,
      patientName: newPatientName.trim() || `User (${cleanDigits.slice(-4)})`,
      mobile: formattedMobile,
      patientId: `PT-${cleanDigits.slice(-5)}`,
      serviceType: "Meta WhatsApp Cloud API",
      workflowState: "ACTIVE",
      escalationTag: "NORMAL",
      takeoverStatus: "HUMAN_OWNERSHIP_ACTIVE",
      assignedAgent: currentUser?.name || "Muskan Sharma",
      lastMessage: "New chat started",
      lastActivity: "Just now",
      unreadCount: 0,
      isUnread: false,
      messages: [],
    };

    setConversations([newConv, ...conversations]);
    handleSelectConversation(newId);
    setShowNewChatModal(false);
    setNewPhoneNumber("");
    setNewPatientName("");
    toast.success(`Chat started for ${formattedMobile}`);
  };

  // Handle file picker selection for photos/videos, document, or audio
  const handleFileSelect = (e, category) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setStagedAttachment({
      file,
      name: file.name,
      size: file.size,
      type: file.type || category,
      category,
      previewUrl,
    });
    setShowAttachmentMenu(false);
  };

  // Add emoji to message input
  const handleAddEmoji = (emoji) => {
    setReplyText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Simulate an incoming patient message to test 2-way live chat
  const handleSimulateIncoming = async (overrideText) => {
    const text = overrideText || simulatedText.trim();
    if (!text || !currentConv) return;

    setIsSimulating(true);
    try {
      const cleanMobile = currentConv.mobile.replace(/\D/g, "").slice(-10);
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: cleanMobile,
          text,
          sender: "patient",
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === currentConv.id) {
              const msgs = [...(c.messages || []), data.message];
              return {
                ...c,
                messages: msgs,
                lastMessage: formatLastMessagePreview(data.message),
                lastActivity: formatMessageTime(data.message.rawTimestamp, data.message.time),
              };
            }
            return c;
          })
        );
        toast.success(`Received incoming message from ${currentConv.mobile}`);
        setSimulatedText("");
        setShowSimulateModal(false);
      }
    } catch (err) {
      toast.error(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Issue 15: Browser MediaRecorder Audio Recording
  const startAudioRecording = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        toast.error("Audio recording not supported. Opening audio file selector.");
        audioInputRef.current?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      toast.success("Recording voice message... Speak now.");
    } catch (err) {
      console.warn("Microphone permission denied:", err);
      toast.error("Microphone access denied or unavailable. Opening file selector.");
      audioInputRef.current?.click();
    }
  };

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      try {
        const stream = mediaRecorderRef.current.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
    toast("Voice recording discarded", { icon: "🗑️" });
  };

  const stopAndSendAudioRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (!mediaRecorderRef.current || !isRecording) return;
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const stream = mediaRecorderRef.current.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          setStagedAttachment({
            file: new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" }),
            previewUrl: base64Audio,
            name: `Voice_Note_${new Date().toLocaleTimeString().replace(/:/g, "-")}.webm`,
            type: "audio/webm",
            size: audioBlob.size,
          });
          toast.success("Voice note ready to send. Press send or add a caption.");
        };
        reader.readAsDataURL(audioBlob);
      } catch (e) {
        console.error("Audio processing failed:", e);
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {}
  };

  // Export and Clear Chat handlers (Issue 11)
  const handleExportChat = () => {
    if (!currentConv) return;
    const lines = (currentConv.messages || []).map((m) => {
      const senderLabel =
        m.sender === "patient"
          ? currentConv.patientName
          : m.sender === "bot"
          ? "MediConnect Assistant"
          : m.agentName || "Agent";
      return `[${formatMessageTime(m.rawTimestamp, m.time)}] ${senderLabel}: ${m.text || m.media?.name || ""}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MediConnect_Chat_${(currentConv.mobile || "").replace(/\D/g, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
    toast.success("Chat transcript downloaded");
  };

  const handleClearChat = () => {
    if (!currentConv) return;
    if (confirm(`Clear local chat history with ${currentConv.patientName}?`)) {
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConv.id ? { ...c, messages: [] } : c))
      );
      setShowMoreMenu(false);
      toast.success("Chat history cleared");
    }
  };

  const handleToggleBlockContact = async () => {
    if (!currentConv) return;
    const isCurrentlyBlocked = Boolean(currentConv.isBlocked);
    const actionLabel = isCurrentlyBlocked ? "Unblock" : "Block";
    const cleanMobile = (currentConv.mobile || "").replace(/\D/g, "").slice(-10);

    if (
      !confirm(
        `Are you sure you want to ${actionLabel.toLowerCase()} contact ${currentConv.patientName || cleanMobile}?`
      )
    ) {
      return;
    }

    const newBlockedState = !isCurrentlyBlocked;

    // Optimistically update conversation state
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConv.id
          ? {
              ...c,
              isBlocked: newBlockedState,
              workflowState: newBlockedState ? "BLOCKED" : "ACTIVE",
            }
          : c
      )
    );
    setShowMoreMenu(false);

    try {
      await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_block",
          mobile: cleanMobile,
          blocked: newBlockedState,
        }),
      });
      toast.success(newBlockedState ? "Contact Blocked" : "Contact Unblocked");
    } catch (err) {
      console.error("Failed to toggle block status:", err);
      toast.error("Failed to update block status");
    }
  };

  const handleOpenReportModal = () => {
    setShowMoreMenu(false);
    setReportReason("Spam or unsolicited messages");
    setReportDetails("");
    setReportAlsoBlock(!currentConv?.isBlocked);
    setShowReportModal(true);
  };

  const handleSubmitReport = async (e) => {
    e?.preventDefault();
    if (!currentConv) return;
    const cleanMobile = (currentConv.mobile || "").replace(/\D/g, "").slice(-10);
    setIsSubmittingReport(true);
    try {
      await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_contact",
          mobile: cleanMobile,
          reason: reportReason,
          details: reportDetails,
          reportedBy: currentUser?.name || "Support Desk",
          alsoBlock: reportAlsoBlock,
        }),
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConv.id
            ? {
                ...c,
                isReported: true,
                isBlocked: reportAlsoBlock ? true : c.isBlocked,
                workflowState: reportAlsoBlock ? "BLOCKED" : (c.workflowState || "ACTIVE"),
              }
            : c
        )
      );

      toast.success(
        reportAlsoBlock
          ? "Contact reported and blocked"
          : "Report submitted to compliance review"
      );
      setShowReportModal(false);
    } catch (err) {
      console.error("Failed to report contact:", err);
      toast.error("Failed to submit report");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleTogglePinChat = (chatId) => {
    const id = chatId || currentConv?.id;
    if (!id) return;
    setPinnedChats((prev) => {
      const next = new Set(prev);
      const isPinned = next.has(id);
      if (isPinned) {
        next.delete(id);
        toast.success("Chat unpinned");
      } else {
        next.add(id);
        toast.success("Chat pinned to top");
      }
      try {
        localStorage.setItem("mediconnect_wa_pinned_chats", JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
    setShowMoreMenu(false);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!replyText.trim() && !selectedTemplate && !stagedAttachment) || isSending || !currentConv) return;

    const messageToSend = replyText.trim();
    const isTemplate = Boolean(selectedTemplate);
    const templateName = selectedTemplate;
    const tempId = "msg-" + Date.now();
    const timeStr = formatMessageTime(Date.now());
    const currentAgentName = currentUser?.name || "Muskan Sharma";

    let mediaToSend = null;

    // If an attachment is staged, upload to Supabase Storage first
    if (stagedAttachment) {
      setIsUploadingAttachment(true);
      try {
        const formData = new FormData();
        formData.append("file", stagedAttachment.file);
        const uploadRes = await fetch("/api/whatsapp/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
          mediaToSend = {
            url: uploadData.url,
            name: stagedAttachment.name,
            type: stagedAttachment.type,
            size: stagedAttachment.size,
          };
        }
      } catch (uploadErr) {
        console.warn("Upload error, using preview data:", uploadErr.message);
        mediaToSend = {
          url: stagedAttachment.previewUrl,
          name: stagedAttachment.name,
          type: stagedAttachment.type,
          size: stagedAttachment.size,
        };
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    const optimisticMsg = {
      id: tempId,
      sender: "agent",
      agentName: currentAgentName,
      text: isTemplate ? `[Template: ${templateName}]` : (messageToSend || (mediaToSend ? `[Attachment: ${mediaToSend.name}]` : "")),
      time: timeStr,
      rawTimestamp: Date.now(),
      status: "sending",
      media: mediaToSend,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === currentConv.id) {
          return {
            ...c,
            lastMessage: formatLastMessagePreview(optimisticMsg),
            lastActivity: "Just now",
            messages: [...(c.messages || []), optimisticMsg],
          };
        }
        return c;
      })
    );

    setReplyText("");
    setSelectedTemplate("");
    setShowTemplatePicker(false);
    setStagedAttachment(null);
    setIsSending(true);

    try {
      const recipientName =
        currentConv.patientName?.replace(/[^a-zA-Z\s]/g, "").trim() || "Support Desk";
      const referenceId = "MC-" + Math.floor(100000 + Math.random() * 900000);

      // Determine template params dynamically matching Meta requirements
      let paramsToSend = undefined;
      if (isTemplate) {
        if (templateName === "navratri_post") {
          paramsToSend = [];
        } else if (templateName === "mediconnect_test_message") {
          paramsToSend = [recipientName, referenceId];
        } else {
          const selectedTmplObj = templates.find((t) => t.name === templateName);
          const varCount = (selectedTmplObj?.content?.match(/\{\{\d+\}\}/g) || []).length;
          if (varCount === 0) {
            paramsToSend = [];
          } else if (varCount === 1) {
            paramsToSend = [recipientName];
          } else {
            paramsToSend = [recipientName, referenceId];
          }
        }
      }

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: currentConv.mobile,
          message: isTemplate ? undefined : messageToSend,
          templateName: isTemplate ? templateName : undefined,
          templateParams: paramsToSend,
          contactName: currentConv.patientName,
          agentName: currentAgentName,
          media: mediaToSend || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === currentConv.id) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.id === tempId ? { ...m, status: "sent", wamid: data.messageId } : m
                ),
              };
            }
            return c;
          })
        );
        toast.success(`Sent via Insign to WhatsApp (${currentConv.mobile})`);
      } else {
        const errMsg = data.error || "Failed to dispatch via Insign API";
        toast.error(`Insign Error: ${errMsg}`, { duration: 6000 });
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === currentConv.id) {
              return {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.id === tempId
                    ? { ...m, status: "failed", errorMessage: errMsg, apiResponse: data.apiResponse }
                    : m
                ),
              };
            }
            return c;
          })
        );
      }
    } catch (err) {
      toast.error(`Network error: ${err.message}`);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentConv.id) {
            return {
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === tempId ? { ...m, status: "failed", errorMessage: err.message } : m
              ),
            };
          }
          return c;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleTakeoverToggle = () => {
    if (!currentConv) return;
    const isCurrentlyTakenOver = currentConv.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE";
    const nextStatus = isCurrentlyTakenOver ? "ACTIVE_AUTOMATION" : "HUMAN_OWNERSHIP_ACTIVE";
    const agentName = currentUser?.name || "Muskan Sharma";

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === currentConv.id) {
          return {
            ...c,
            takeoverStatus: nextStatus,
            assignedAgent: isCurrentlyTakenOver ? null : agentName,
            messages: [
              ...(c.messages || []),
              {
                id: "sys-" + Date.now(),
                sender: "system",
                text: isCurrentlyTakenOver
                  ? "Support Agent released session. Automated WhatsApp bot resumed."
                  : `Human Takeover Active: ${agentName} claimed conversation. Bot paused.`,
                time: formatMessageTime(Date.now()),
                rawTimestamp: Date.now(),
                isSystem: true,
              },
            ],
          };
        }
        return c;
      })
    );

    if (isCurrentlyTakenOver) {
      toast.success("Returned to Automation (Bot Resumed)");
    } else {
      toast.success(`Human Takeover Activated (${agentName})`);
    }
  };

  // Helper to get initials & background color for avatar
  const getAvatarInfo = (name, phone) => {
    const cleanDigits = (phone || "").replace(/\D/g, "");
    if (cleanDigits.startsWith("1800")) {
      return { text: "18", bg: "bg-[#e91e63]" };
    }
    const char = (name || "").replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "U";
    if (char === "V") return { text: "V", bg: "bg-[#00a884]" };
    if (char === "S") return { text: "S", bg: "bg-[#008069]" };
    if (char === "M") return { text: "M", bg: "bg-[#7f39fb]" };
    return { text: char, bg: "bg-[#008069]" };
  };

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden">
      {/* Hidden File Inputs for Attachments */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        type="file"
        ref={documentInputRef}
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "document")}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "audio")}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden h-full">
        
        {/* PANE 1: Conversation List (Left Column - Matching Screenshot 1) */}
        <div className="w-80 lg:w-96 border-r border-slate-200/90 flex flex-col bg-white h-full flex-shrink-0">
          
          {/* Top Header Bar matching Screenshot 1 */}
          <div className="p-3 bg-[#f0f2f5] border-b border-slate-200/90 flex items-center justify-between">
            {/* User Profile Avatar */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-slate-300 text-slate-700 font-semibold flex items-center justify-center text-sm shadow-2xs">
                U
              </div>
            </div>

            {/* Header Right Action Icons */}
            <div className="flex items-center gap-4 text-[#54656f]">
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="hover:text-slate-900 transition cursor-pointer"
                title="Start new chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-slate-900 transition cursor-pointer"
                title="Communities & Channels"
              >
                <Users className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-slate-900 transition cursor-pointer"
                title="Tags & Labels"
              >
                <Tag className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-slate-900 transition cursor-pointer"
                title="Night Mode"
              >
                <Moon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar matching Screenshot 1 */}
          <div className="px-3 pt-2.5 pb-2 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-[#54656f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-xs text-slate-800 placeholder-[#54656f] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] transition"
              />
            </div>
          </div>

          {/* Filter Tabs matching Screenshot 1: [ All ] [ Unread ] [ Read ] */}
          <div className="flex items-center gap-2 px-3 pb-2.5 bg-white border-b border-slate-100">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                filter === "all"
                  ? "bg-[#00a884] text-white shadow-xs"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-5 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filter === "unread"
                  ? "bg-[#00a884] text-white shadow-xs"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
              }`}
            >
              <span>Unread</span>
              {unreadTotalCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filter === "unread" ? "bg-white text-[#00a884]" : "bg-[#00a884] text-white"
                  }`}
                >
                  {unreadTotalCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter("read")}
              className={`px-5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                filter === "read"
                  ? "bg-[#00a884] text-white shadow-xs"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
              }`}
            >
              Read
            </button>
          </div>

          {/* Chat Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
            {loadingInitial ? (
              <div className="p-8 flex flex-col items-center justify-center space-y-2 text-xs text-slate-500">
                <Loader2 className="w-5 h-5 text-[#00a884] animate-spin" />
                <span>Loading live conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <p>No conversations in "{filter}" tab</p>
                <button
                  onClick={() => {
                    setFilter("all");
                    setShowNewChatModal(true);
                  }}
                  className="text-[#00a884] hover:underline font-semibold cursor-pointer"
                >
                  + Click to start a new chat
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === currentConv?.id;
                const avatar = getAvatarInfo(c.patientName, c.mobile);
                const hasUnread = (c.unreadCount || 0) > 0 || c.isUnread;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`px-3 py-3 cursor-pointer transition relative hover:bg-[#f5f6f6] ${
                      isSelected ? "bg-[#f0f2f5]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar Circle */}
                      <div
                        className={`w-11 h-11 rounded-full ${avatar.bg} text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-2xs`}
                      >
                        {avatar.text}
                      </div>

                      {/* Info & Last Message */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-sm font-semibold text-[#111b21] truncate">
                              {c.patientName}
                            </h4>
                            {c.isBlocked && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold border border-rose-200 shrink-0">
                                Blocked
                              </span>
                            )}
                            {c.isReported && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200 shrink-0">
                                Reported
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {pinnedChats.has(c.id) && (
                              <Pin className="w-3 h-3 text-slate-400 rotate-45 shrink-0" title="Pinned" />
                            )}
                            <span className={`text-[11px] whitespace-nowrap ${hasUnread ? "text-[#00a884] font-semibold" : "text-[#667781]"}`}>
                              {c.lastActivity}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${hasUnread ? "text-[#111b21] font-medium" : "text-[#667781]"}`}>
                            {c.lastMessage}
                          </p>

                          {/* Unread Badge Pill */}
                          {hasUnread && (
                            <span className="w-5 h-5 rounded-full bg-[#25d366] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-2xs">
                              {c.unreadCount || 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANE 2: Active Chat Canvas (Center Column - Issue 16: Mobile Toggle) */}
        {currentConv ? (
          <div className={`${!mobileShowChat ? "hidden md:flex" : "flex"} flex-1 flex flex-col h-full bg-[#efeae2] min-w-0 relative overflow-hidden`}>
            
            {/* Active Chat Header matching Screenshot 1 */}
            <div className="h-[60px] px-3 sm:px-4 bg-[#f0f2f5] border-b border-slate-200/90 flex items-center justify-between shadow-2xs z-10 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Back Button (Issue 16) */}
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/80 transition cursor-pointer flex-shrink-0"
                  title="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  {(() => {
                    const av = getAvatarInfo(currentConv.patientName, currentConv.mobile);
                    return (
                      <div className={`w-10 h-10 rounded-full ${av.bg} text-white font-bold flex items-center justify-center text-sm shadow-2xs`}>
                        {av.text}
                      </div>
                    );
                  })()}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25d366] border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111b21] flex items-center gap-2">
                    {currentConv.patientName}
                    {pinnedChats.has(currentConv.id) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200" title="Pinned Chat">
                        <Pin className="w-3 h-3 text-slate-500 rotate-45" />
                        <span>Pinned</span>
                      </span>
                    )}
                    {currentConv.isBlocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300">
                        <Ban className="w-3 h-3 text-rose-600" />
                        <span>Blocked</span>
                      </span>
                    )}
                    {currentConv.isReported && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                        <Flag className="w-3 h-3 text-amber-600" />
                        <span>Reported</span>
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#00a884] font-medium">
                    {currentConv.isBlocked ? (
                      <span className="text-rose-600 font-semibold">Contact is blocked</span>
                    ) : (
                      <span>online</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Right Action Icons (Issue 11: Functional Top Icons) */}
              <div className="flex items-center gap-2 sm:gap-3 text-[#54656f]">
                {/* Takeover status pill */}
                {currentConv.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                    Agent Claimed
                  </span>
                )}

                {/* 1. Phone Call Action */}
                <button
                  type="button"
                  onClick={() => setShowCallModal(true)}
                  className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                  title="Direct Phone Call"
                >
                  <Phone className="w-5 h-5 text-emerald-600" />
                </button>

                {/* 2. Video Consultation Action */}
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                  title="Video Consultation Room"
                >
                  <Video className="w-5 h-5 text-sky-600" />
                </button>

                {/* 3. Search in Chat Action */}
                <button
                  type="button"
                  onClick={() => setShowChatSearch(!showChatSearch)}
                  className={`hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70 ${
                    showChatSearch ? "text-[#00a884] bg-slate-200/80" : ""
                  }`}
                  title="Search Messages in Chat"
                >
                  <Search className="w-5 h-5" />
                </button>

                {/* 4. Tags & Priority Action */}
                <button
                  type="button"
                  onClick={() => setShowTagsModal(true)}
                  className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                  title="Tags & Priority Labels"
                >
                  <Tag className="w-5 h-5 text-purple-600" />
                </button>

                {/* 5. Contact Notes Info */}
                <button
                  type="button"
                  onClick={() => setShowContactInfo(!showContactInfo)}
                  className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                  title="Patient Profile & Notes"
                >
                  <FileText className="w-5 h-5" />
                </button>

                {/* 6. Human Takeover Toggle */}
                <button
                  type="button"
                  onClick={handleTakeoverToggle}
                  className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                  title="Agent takeover toggle"
                >
                  <UserCheck className="w-5 h-5 text-amber-600" />
                </button>

                {/* 7. Context Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="hover:text-slate-900 transition cursor-pointer p-1 rounded hover:bg-slate-200/70"
                    title="Menu"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-52 z-40 text-xs text-slate-700">
                      <button
                        type="button"
                        onClick={() => handleTogglePinChat(currentConv.id)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        {pinnedChats.has(currentConv.id) ? (
                          <>
                            <PinOff className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-medium">Unpin Chat</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5 text-[#00a884] rotate-45" />
                            <span className="font-medium">Pin Chat</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChat}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                      >
                        <Download className="w-3.5 h-3.5 text-[#00629b]" />
                        <span>Export Chat Transcript</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearChat}
                        className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Chat History</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleBlockContact}
                        className={`w-full px-3 py-2 text-left flex items-center gap-2 cursor-pointer border-t border-slate-100 ${
                          currentConv.isBlocked
                            ? "hover:bg-emerald-50 text-emerald-700"
                            : "hover:bg-rose-50 text-rose-600"
                        }`}
                      >
                        {currentConv.isBlocked ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-medium">Unblock Contact</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            <span className="font-medium">Block Contact</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenReportModal}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 text-amber-700 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                      >
                        <Flag className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-medium">Report Contact</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSimulateModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                      >
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                        <span>Simulate WhatsApp Inbound</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* In-Chat Message Search Bar (Issue 11) */}
            {showChatSearch && (
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs z-10">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in this conversation..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
                    autoFocus
                  />
                  {chatSearchQuery && (
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                      {
                        (currentConv.messages || []).filter((m) =>
                          (m.text || "").toLowerCase().includes(chatSearchQuery.toLowerCase())
                        ).length
                      }{" "}
                      matches
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowChatSearch(false);
                    setChatSearchQuery("");
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Close chat search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Messages Body with WhatsApp Web Wallpaper Background */}
            <div 
              className="flex-1 px-3 sm:px-6 py-4 overflow-y-auto"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage:
                  "radial-gradient(#d8d2ca 0.75px, transparent 0.75px), radial-gradient(#d8d2ca 0.75px, #efeae2 0.75px)",
                backgroundSize: "28px 28px",
                backgroundPosition: "0 0, 14px 14px",
              }}
            >
              <div className="max-w-3xl mx-auto w-full space-y-2">
                {/* Date Badge: Today */}
                <div className="flex justify-center my-2">
                  <span className="px-3.5 py-0.5 bg-white/95 backdrop-blur-xs border border-slate-200/60 rounded-md text-[11px] font-semibold text-slate-600 shadow-2xs">
                    Today
                  </span>
                </div>

                {(!currentConv.messages || currentConv.messages.length === 0) ? (
                  <div className="h-4/5 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                    <Bot className="w-8 h-8 text-slate-400" />
                    <p className="text-xs font-medium text-slate-700">No message history yet for {currentConv.mobile}</p>
                    <p className="text-[11px] text-slate-500 max-w-sm">
                      Send a text message or approved Meta template below to start live conversation.
                    </p>
                  </div>
                ) : (
                  currentConv.messages.map((m, idx) => {
                    if (m.isSystem) {
                      return (
                        <div key={m.id || idx} className="flex justify-center my-2">
                          <span className="px-3 py-1 bg-amber-50/95 border border-amber-200 text-amber-900 text-[10px] font-medium rounded-full shadow-2xs">
                            {m.text}
                          </span>
                        </div>
                      );
                    }

                    const isAgent = m.sender === "agent" || m.sender === "outbound";
                    const isBot = m.sender === "bot";
                    const isPatient = m.sender === "patient" || (!isAgent && !isBot);
                    const isFailed = m.status === "failed";

                    // Clean raw attachment filenames from message text
                    const cleanCaption = (m.text || "")
                      .replace(/\[Attachment:\s*[^\]]+\]/gi, "")
                      .replace(/^\[(image|video|audio|voice|media) message\]$/gi, "")
                      .trim();

                    // Display unread banner matching Screenshot 1: 5 UNREAD MESSAGES
                    const unreadDividerIdx = Math.max(0, currentConv.messages.length - (currentConv.unreadCount || 0));
                    const showUnreadBanner = (currentConv.unreadCount || 0) > 0 && idx === unreadDividerIdx;

                    return (
                      <div key={m.id || idx}>
                        {/* Unread banner matching Screenshot 1 */}
                        {showUnreadBanner && (
                          <div className="w-full my-3 flex items-center justify-center">
                            <div className="w-full bg-[#d6ecf7] text-[#027eb5] text-[11px] font-bold text-center uppercase tracking-wider py-1.5 px-4 rounded shadow-2xs border border-[#bfe1f1]">
                              {currentConv.unreadCount} UNREAD {currentConv.unreadCount === 1 ? "MESSAGE" : "MESSAGES"}
                            </div>
                          </div>
                        )}

                        {/* RECEIVED PATIENT MESSAGE - ALIGNED ON LEFT (White Bubble) */}
                        {isPatient && (
                          <div className="flex justify-start my-1.5">
                            <div className="max-w-[85%] sm:max-w-[70%] bg-white text-[#111b21] rounded-2xl rounded-tl-xs px-3.5 py-2 shadow-xs border border-slate-200/50">
                              {/* Attachment rendering if present */}
                              {m.media ? (
                                <div className="mb-1">
                                  {isImageMedia(m.media) ? (
                                    <div
                                      className="overflow-hidden rounded-xl border border-slate-200/80 mb-1 group relative cursor-pointer bg-slate-900/5 select-none"
                                      onClick={() => setLightboxMedia(m.media)}
                                    >
                                      <img
                                        src={m.media.url}
                                        alt={m.media.name || "Photo attachment"}
                                        className="rounded-xl max-h-72 w-auto max-w-full object-cover transition hover:opacity-95"
                                        loading="lazy"
                                      />
                                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/60 text-white text-[10px] backdrop-blur-xs rounded-b-xl absolute bottom-0 inset-x-0 opacity-0 group-hover:opacity-100 transition">
                                        <span className="truncate max-w-[200px] flex items-center gap-1 font-medium">
                                          <ZoomIn className="w-3.5 h-3.5 text-emerald-400" /> Click to view
                                        </span>
                                        <a
                                          href={m.media.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          download={m.media.name || "photo.jpg"}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1 hover:text-emerald-300 transition"
                                          title="Download photo"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    </div>
                                  ) : isVideoMedia(m.media) ? (
                                    <div className="overflow-hidden rounded-xl border border-slate-200/80 mb-1 bg-black shadow-2xs">
                                      <video
                                        src={m.media.url}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="rounded-t-xl max-h-72 w-full object-contain bg-black"
                                      />
                                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 text-slate-200 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Video className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                          <span className="truncate text-[11px] font-medium">{m.media.name || "Video"}</span>
                                          {m.media.size > 0 && <span className="text-[10px] text-slate-400">({formatBytes(m.media.size)})</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setLightboxMedia(m.media)}
                                            className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                                            title="Expand fullscreen"
                                          >
                                            <Maximize2 className="w-3.5 h-3.5" />
                                          </button>
                                          <a
                                            href={m.media.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={m.media.name || "video.mp4"}
                                            className="p-1 text-slate-300 hover:text-white transition"
                                            title="Download video"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ) : isAudioMedia(m.media) ? (
                                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/90 my-1 shadow-2xs space-y-1.5">
                                      <div className="flex items-center justify-between gap-2 text-slate-700">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                                            <Mic className="w-3.5 h-3.5" />
                                          </div>
                                          <span className="text-xs font-semibold truncate text-slate-800">
                                            {m.media.type?.includes("voice") || m.media.name?.includes("voice") ? "Voice Message" : (m.media.name || "Audio Recording")}
                                          </span>
                                        </div>
                                        {m.media.size > 0 && <span className="text-[10px] text-slate-500 font-medium">{formatBytes(m.media.size)}</span>}
                                      </div>
                                      <audio
                                        src={m.media.url}
                                        controls
                                        preload="metadata"
                                        className="w-64 max-w-full h-9 rounded"
                                      />
                                      <div className="flex justify-end">
                                        <a
                                          href={m.media.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          download={m.media.name || "audio.ogg"}
                                          className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                                        >
                                          <Download className="w-3 h-3" /> Save audio
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3 p-2 bg-slate-100 rounded-lg border border-slate-200">
                                      <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{m.media.name}</p>
                                        <span className="text-[10px] text-slate-500">{formatBytes(m.media.size)}</span>
                                      </div>
                                      <a href={m.media.url} target="_blank" rel="noreferrer" download={m.media.name} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600">
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </div>
                                  )}
                                  {cleanCaption && (
                                    <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap select-text">
                                      {formatWhatsAppText(cleanCaption)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                /* Legacy placeholder badge when media is not attached */
                                m.text?.toLowerCase().trim() === "[image message]" ? (
                                  <div className="flex items-center gap-2.5 p-2 bg-blue-50/80 rounded-xl border border-blue-200/80 mb-1 text-xs text-blue-900">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                      <ImageIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-800">Photo Attachment</p>
                                      <span className="text-[10px] text-slate-500">Image message from WhatsApp</span>
                                    </div>
                                  </div>
                                ) : m.text?.toLowerCase().trim() === "[video message]" ? (
                                  <div className="flex items-center gap-2.5 p-2 bg-purple-50/80 rounded-xl border border-purple-200/80 mb-1 text-xs text-purple-900">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                      <Video className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-800">Video Message</p>
                                      <span className="text-[10px] text-slate-500">Video message from WhatsApp</span>
                                    </div>
                                  </div>
                                ) : m.text?.toLowerCase().trim() === "[audio message]" ? (
                                  <div className="flex items-center gap-2.5 p-2 bg-emerald-50/80 rounded-xl border border-emerald-200/80 mb-1 text-xs text-emerald-900">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                                      <Mic className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-slate-800">Voice Note / Audio</p>
                                      <span className="text-[10px] text-slate-500">Voice recording from WhatsApp</span>
                                    </div>
                                  </div>
                                ) : cleanCaption ? (
                                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap select-text">
                                    {formatWhatsAppText(cleanCaption)}
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-slate-500 italic py-1">
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Attachment received from WhatsApp</span>
                                  </div>
                                )
                              )}
                              <div className="flex items-center justify-end mt-0.5 text-[10px] text-[#667781] select-none font-medium">
                                <span>{formatMessageTime(m.rawTimestamp, m.time)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SENT AGENT MESSAGE - ALIGNED ON RIGHT (Light Green Bubble #d9fdd3) */}
                        {isAgent && (
                          <div className="flex justify-end my-1.5">
                            <div
                              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-xs px-3.5 py-2 text-[13px] leading-relaxed shadow-xs ${
                                isFailed
                                  ? "bg-rose-50 text-slate-900 border border-rose-300"
                                  : "bg-[#d9fdd3] text-[#111b21] border border-[#c7f4bf]"
                              }`}
                            >
                              {m.agentName && (
                                <div
                                  className={`text-[10px] font-semibold mb-0.5 flex items-center gap-1 select-none ${
                                    isFailed ? "text-rose-700" : "text-emerald-800"
                                  }`}
                                >
                                  <span>👤 {m.agentName}</span>
                                </div>
                              )}

                              {/* Attachment rendering if present */}
                              {m.media && (
                                <div className="mb-1">
                                  {isImageMedia(m.media) ? (
                                    <div
                                      className="overflow-hidden rounded-xl border border-emerald-300/60 mb-1 group relative cursor-pointer select-none"
                                      onClick={() => setLightboxMedia(m.media)}
                                    >
                                      <img
                                        src={m.media.url}
                                        alt={m.media.name || "Attachment"}
                                        className="rounded-xl max-h-72 w-auto max-w-full object-cover transition hover:opacity-95"
                                      />
                                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/60 text-white text-[10px] backdrop-blur-xs rounded-b-xl absolute bottom-0 inset-x-0 opacity-0 group-hover:opacity-100 transition">
                                        <span className="truncate max-w-[200px] flex items-center gap-1 font-medium">
                                          <ZoomIn className="w-3.5 h-3.5 text-emerald-300" /> Click to view
                                        </span>
                                        <a
                                          href={m.media.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          download={m.media.name || "photo.jpg"}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1 hover:text-emerald-300 transition"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    </div>
                                  ) : isVideoMedia(m.media) ? (
                                    <div className="overflow-hidden rounded-xl border border-black/10 mb-1 bg-black shadow-2xs">
                                      <video
                                        src={m.media.url}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="rounded-t-xl max-h-72 w-full object-contain bg-black"
                                      />
                                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 text-slate-200 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Video className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                          <span className="truncate text-[11px] font-medium">{m.media.name || "Video"}</span>
                                          {m.media.size > 0 && <span className="text-[10px] text-slate-400">({formatBytes(m.media.size)})</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setLightboxMedia(m.media)}
                                            className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
                                            title="Expand fullscreen"
                                          >
                                            <Maximize2 className="w-3.5 h-3.5" />
                                          </button>
                                          <a
                                            href={m.media.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={m.media.name || "video.mp4"}
                                            className="p-1 text-slate-300 hover:text-white transition"
                                            title="Download video"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ) : isAudioMedia(m.media) ? (
                                    <div className="p-2.5 rounded-xl border border-black/10 bg-black/5 my-1 shadow-2xs space-y-1.5">
                                      <div className="flex items-center justify-between gap-2 text-slate-700">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center flex-shrink-0">
                                            <Mic className="w-3.5 h-3.5" />
                                          </div>
                                          <span className="text-xs font-semibold truncate text-slate-800">
                                            {m.media.type?.includes("voice") || m.media.name?.includes("voice") ? "Voice Message" : (m.media.name || "Audio Recording")}
                                          </span>
                                        </div>
                                        {m.media.size > 0 && <span className="text-[10px] text-slate-600 font-medium">{formatBytes(m.media.size)}</span>}
                                      </div>
                                      <audio
                                        src={m.media.url}
                                        controls
                                        preload="metadata"
                                        className="w-64 max-w-full h-9 rounded"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3 p-2 bg-black/5 rounded-lg border border-black/10">
                                      <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{m.media.name}</p>
                                        <span className="text-[10px] text-slate-600">{formatBytes(m.media.size)}</span>
                                      </div>
                                      <a href={m.media.url} target="_blank" rel="noreferrer" download={m.media.name} className="p-1.5 rounded-full hover:bg-black/10 text-slate-600">
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}

                              {cleanCaption && (
                                <p className="whitespace-pre-wrap select-text">
                                  {formatWhatsAppText(cleanCaption)}
                                </p>
                              )}

                            {isFailed && m.errorMessage && (
                              <div className="mt-1.5 p-1.5 bg-rose-100/80 border border-rose-200 rounded text-[10px] text-rose-800 flex items-start gap-1 font-mono">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-rose-600" />
                                <span>Insign Gateway Error: {m.errorMessage}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781] select-none font-medium">
                              <span>{formatMessageTime(m.rawTimestamp, m.time)}</span>
                              {m.status === "read" ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline" title="Read by recipient (Blue Ticks)" />
                              ) : m.status === "delivered" ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] inline" title="Delivered to handset (Double Ticks)" />
                              ) : m.status === "failed" ? (
                                <span className="text-rose-600 font-bold" title="Delivery failed">✕</span>
                              ) : m.status === "sending" ? (
                                <Loader2 className="w-3 h-3 text-[#8696a0] animate-spin inline" title="Sending..." />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-[#8696a0] inline" title="Sent to WhatsApp (Single Tick)" />
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BOT AUTOMATED MESSAGE */}
                      {isBot && (
                        <div className="flex justify-start my-1.5">
                          <div className="max-w-[85%] sm:max-w-[70%] bg-white/95 text-[#111b21] rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-xs border border-sky-200">
                            <div className="text-[10px] font-bold text-sky-800 mb-1 flex items-center gap-1.5 select-none">
                              <span className="w-2 h-2 rounded-full bg-[#00a884]"></span>
                              <span>🤖 MediConnect Automated Assistant</span>
                            </div>
                            {(() => {
                              const rawContent = formatWhatsAppText(m.text || "");
                              // Extract all URLs
                              const urlRegex = /(https?:\/\/[^\s]+)/g;
                              const urlsInText = [];
                              let match;
                              while ((match = urlRegex.exec(rawContent)) !== null) {
                                urlsInText.push(match[1]);
                              }

                              // Clean ugly raw URLs and trailing booking headers from text
                              const cleanedText = rawContent
                                .replace(/🔗\s*Book Online:?\s*https?:\/\/[^\s]+/gi, "")
                                .replace(/🔗\s*Book:?\s*https?:\/\/[^\s]+/gi, "")
                                .replace(/To book your preferred slot and complete appointment:?/gi, "")
                                .replace(/🌐\s*\*Book on Website\*:?\s*\n?https?:\/\/[^\s]+/gi, "")
                                .replace(/📱\s*\*Book on MediConnect Mobile App\*:?\s*\n?https?:\/\/[^\s]+/gi, "")
                                .replace(/https?:\/\/[^\s]+/gi, "")
                                .replace(/\n{3,}/g, "\n\n")
                                .trim();

                              // Consolidate Action Buttons (Ensure BOTH Web and App buttons are provided if redirecting)
                              const actionButtons = [];

                              // 1. Direct Web action
                              const webCandidate =
                                m.actionUrl ||
                                urlsInText.find((u) => !u.includes("/app")) ||
                                null;

                              if (webCandidate) {
                                const isDoctor = webCandidate.includes("/doctor/") || webCandidate.includes("/doctors");
                                const isLab = webCandidate.includes("lab");
                                const isRecords = webCandidate.includes("records");
                                const isAbha = webCandidate.includes("abha");
                                const isLogin = webCandidate.includes("login") || webCandidate.includes("appointments");
                                const title = m.actionTitle
                                  ? m.actionTitle
                                  : isLogin
                                  ? "🌐 Login & View History"
                                  : isDoctor
                                  ? "🌐 View Doctors on Website"
                                  : isLab
                                  ? "🧪 Book Lab Test"
                                  : isRecords
                                  ? "📄 View Records"
                                  : isAbha
                                  ? "🪪 Link ABHA"
                                  : "🌐 Book on Website";

                                actionButtons.push({
                                  url: webCandidate,
                                  title,
                                  isApp: false,
                                });
                              }

                              // 2. Direct App action (Always provided alongside web redirect)
                              const appCandidate =
                                m.appUrl ||
                                urlsInText.find((u) => u.includes("/app")) ||
                                (webCandidate ? "https://mediconnect.fit/app" : null);

                              if (appCandidate) {
                                actionButtons.push({
                                  url: appCandidate,
                                  title: m.appTitle || "📱 Book on App",
                                  isApp: true,
                                });
                              }

                              // Extract options
                              const lines = (m.text || "").split("\n");
                              const optionLines = lines.filter((l) => l.trim().match(/^[1-9]️⃣/));
                              const pills =
                                Array.isArray(m.buttons) && m.buttons.length > 0
                                  ? m.buttons.map((b) => b.title || b.text || String(b))
                                  : optionLines.map((o) => o.trim());

                              // Resolve doctor card details if present
                              const doctorImg = m.doctorImage || m.imageUrl || (m.media?.type?.includes("image") ? m.media.url : null);
                              const docMatch = (m.text || "").match(/\*(?:Doctor\*:\s*)?(Dr\.\s*[^*\n]+)\*/i);
                              const parsedDocName = m.doctorName || (docMatch ? docMatch[1].trim() : null);
                              const expMatch = (m.text || "").match(/(?:Experience\*:\s*|⏳\s*)([^\n•]+)/i);
                              const parsedExp = m.experience || (expMatch ? expMatch[1].trim() : null);
                              const feeMatch = (m.text || "").match(/(?:Fee\*:\s*|Fee:\s*|💰\s*(?:Consultation\s*Fee:\s*)?)(₹\s*\d+)/i);
                              const parsedFee = m.fee ? `₹${m.fee}` : (feeMatch ? feeMatch[1].trim() : null);
                              const verifiedBadge = m.verifiedBadge || "✅ DMC Verified Specialist";
                              const fallbackImg = parsedDocName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(parsedDocName)}&background=0067A1&color=fff&bold=true` : null;
                              const displayImg = doctorImg || fallbackImg;

                              return (
                                <>
                                  {/* Doctor Profile Card (Name, Experience, Fee, Image, Verified Badge) */}
                                  {parsedDocName && displayImg && (
                                    <div className="mb-2.5 p-2 bg-gradient-to-r from-sky-50 via-teal-50/40 to-white rounded-xl border border-sky-100 flex items-center gap-2.5 shadow-2xs">
                                      <img
                                        src={displayImg}
                                        alt={parsedDocName}
                                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs bg-sky-100 flex-shrink-0"
                                        onError={(e) => {
                                          e.target.style.display = "none";
                                        }}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-bold text-slate-800 truncate">
                                            {parsedDocName}
                                          </span>
                                          <span className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded-full">
                                            {verifiedBadge}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-600">
                                          {parsedExp && <span>⏳ {parsedExp}</span>}
                                          {parsedFee && (
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                              {parsedFee}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap select-text">
                                    {cleanedText}
                                  </p>

                                  {/* Render Interactive Options / Doctor Pills */}
                                  {pills.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-sky-100 flex flex-wrap gap-1.5">
                                      {pills.map((opt, i) => (
                                        <span
                                          key={i}
                                          className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 text-xs font-semibold shadow-2xs"
                                        >
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Render Interactive Clickable Action Buttons (Both Web & App) */}
                                  {actionButtons.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-sky-100 flex flex-wrap gap-2">
                                      {actionButtons.map((btn, idx) => (
                                        <a
                                          key={idx}
                                          href={btn.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-xs transition-colors ${
                                            btn.isApp
                                              ? "bg-sky-600 hover:bg-sky-700"
                                              : "bg-[#00a884] hover:bg-[#008f6f]"
                                          }`}
                                        >
                                          {btn.isApp ? (
                                            <Smartphone className="w-3.5 h-3.5" />
                                          ) : (
                                            <Globe className="w-3.5 h-3.5" />
                                          )}
                                          <span>{btn.title}</span>
                                          <ExternalLink className="w-3 h-3 opacity-80" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            <div className="flex items-center justify-end mt-1 text-[10px] text-[#667781] select-none font-medium">
                              <span>{formatMessageTime(m.rawTimestamp, m.time)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Template Drawer Picker (Collapsible) */}
            {showTemplatePicker && (
              <div className="px-4 py-2 bg-emerald-50/90 border-t border-emerald-200 flex items-center gap-2 text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Meta Template:
                </span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-white border border-emerald-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">-- Choose Approved Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.category} - {t.status})
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <button
                    onClick={() => {
                      setSelectedTemplate("");
                      setShowTemplatePicker(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Staged Attachment Preview Bar */}
            {stagedAttachment && (
              <div className="px-4 py-2 bg-emerald-50/90 border-t border-emerald-200 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {stagedAttachment.previewUrl && (isImageMedia(stagedAttachment) || stagedAttachment.type?.startsWith("image/")) ? (
                    <img
                      src={stagedAttachment.previewUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-lg border border-emerald-300 flex-shrink-0"
                    />
                  ) : isVideoMedia(stagedAttachment) || stagedAttachment.type?.startsWith("video/") ? (
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0">
                      <Video className="w-5 h-5" />
                    </div>
                  ) : isAudioMedia(stagedAttachment) || stagedAttachment.type?.startsWith("audio/") ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                      <Mic className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {stagedAttachment.name}
                    </p>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {formatBytes(stagedAttachment.size)} • Ready to send
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStagedAttachment(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-emerald-100 transition cursor-pointer"
                  title="Cancel attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pop-up: Attachment Menu matching Screenshot 2 */}
            {showAttachmentMenu && (
              <div
                ref={attachmentMenuRef}
                className="absolute bottom-16 left-12 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[210px] space-y-1 z-30 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* 1. Photos & Videos (Blue icon) */}
                <button
                  type="button"
                  onClick={() => {
                    imageInputRef.current?.click();
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#007aff]/10 text-[#007aff] flex items-center justify-center group-hover:scale-105 transition">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">Photos & Videos</span>
                </button>

                {/* 2. Document (Purple icon) */}
                <button
                  type="button"
                  onClick={() => {
                    documentInputRef.current?.click();
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#7f39fb]/10 text-[#7f39fb] flex items-center justify-center group-hover:scale-105 transition">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">Document</span>
                </button>

                {/* 3. Audio (Green icon) */}
                <button
                  type="button"
                  onClick={() => {
                    audioInputRef.current?.click();
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#00a884]/10 text-[#00a884] flex items-center justify-center group-hover:scale-105 transition">
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">Audio</span>
                </button>
              </div>
            )}

            {/* Pop-up: WhatsApp Emoji Picker */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-16 left-3 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 w-80 max-h-96 flex flex-col z-30 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">WhatsApp Emojis</span>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.name}>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {cat.name}
                      </div>
                      <div className="grid grid-cols-8 gap-1">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleAddEmoji(emoji)}
                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded-lg transition hover:scale-110 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Message Input Bar */}
            <div className="px-3 sm:px-4 py-2.5 bg-[#f0f2f5] border-t border-slate-200/90 relative z-20 flex-shrink-0">
              {currentConv.isBlocked ? (
                <div className="max-w-3xl mx-auto flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <Ban className="w-4 h-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="font-bold text-rose-900">This contact is currently blocked</p>
                      <p className="text-[11px] text-rose-700">Messaging is suspended and incoming bot auto-responses are silenced.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBlockContact}
                    className="px-3.5 py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Unblock Contact</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center gap-2">
                {/* 1. Emoji Picker Button 😊 */}
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowAttachmentMenu(false);
                  }}
                  className={`p-2 rounded-full transition cursor-pointer text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/70 ${
                    showEmojiPicker ? "bg-slate-200/90 text-[#111b21]" : ""
                  }`}
                  title="Emoji"
                >
                  <Smile className="w-6 h-6" />
                </button>

                {/* 2. Attachment Menu Button 📎 matching Screenshot 2 */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachmentMenu(!showAttachmentMenu);
                    setShowEmojiPicker(false);
                  }}
                  className={`p-2 rounded-xl transition cursor-pointer text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/70 ${
                    showAttachmentMenu
                      ? "bg-purple-50 text-purple-700 ring-2 ring-purple-300"
                      : ""
                  }`}
                  title="Attach (Photos, Documents, Audio)"
                >
                  <Paperclip className="w-6 h-6" />
                </button>

                {/* 3. Magic Wand Template Button 🪄 */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className={`p-2 rounded-full transition cursor-pointer text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/70 ${
                    showTemplatePicker || selectedTemplate
                      ? "bg-emerald-200 text-emerald-800"
                      : ""
                  }`}
                  title="Meta Approved Templates"
                >
                  <Sparkles className="w-5 h-5" />
                </button>

                {/* 4. Text Input Field */}
                <div className="flex-1 relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={
                      selectedTemplate
                        ? `Dispatching template: "${selectedTemplate}"`
                        : stagedAttachment
                        ? `Add caption for ${stagedAttachment.name}...`
                        : "Type a message"
                    }
                    value={replyText}
                    disabled={Boolean(selectedTemplate) || isSending || isUploadingAttachment}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 placeholder-[#667781] focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition disabled:bg-slate-100 shadow-2xs"
                  />
                </div>

                {/* 5. Right Action: Send Button when typing or mic when empty */}
                {replyText.trim() || stagedAttachment || selectedTemplate ? (
                  <button
                    type="submit"
                    disabled={isSending || isUploadingAttachment}
                    className="p-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full flex items-center justify-center transition disabled:opacity-40 cursor-pointer shadow-xs flex-shrink-0"
                    title="Send message"
                  >
                    {isSending || isUploadingAttachment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      audioInputRef.current?.click();
                    }}
                    className="p-2.5 text-[#54656f] hover:text-slate-800 rounded-full flex items-center justify-center transition cursor-pointer"
                    title="Send Audio / Voice"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </form>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No Conversation Selected</p>
            <p className="text-xs text-slate-400 mt-1">Select a conversation or click "+ New Chat" to start.</p>
          </div>
        )}

        {/* PANE 3: Patient Context (Right Column) - Toggle via Info Icon */}
        {currentConv && showContactInfo && (
          <div className="w-72 lg:w-80 border-l border-slate-200/90 bg-white p-4 overflow-y-auto space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#00629b]" />
                Live Contact Info
              </h3>
              <button
                onClick={() => setShowContactInfo(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded hover:bg-slate-100 cursor-pointer"
                title="Hide Contact Details"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Contact:</span>
                <span className="font-semibold text-slate-800">{currentConv.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono font-semibold text-slate-800">{currentConv.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  currentConv.isBlocked
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {currentConv.workflowState}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Takeover:</span>
                <span className="font-medium text-slate-700">
                  {currentConv.takeoverStatus === "HUMAN_OWNERSHIP_ACTIVE" ? "Human Agent" : "Bot Automated"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleTogglePinChat(currentConv.id)}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    pinnedChats.has(currentConv.id)
                      ? "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {pinnedChats.has(currentConv.id) ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 text-slate-600" />
                      <span>Unpin Chat</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 text-emerald-600 rotate-45" />
                      <span>Pin Chat to Top</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlockContact}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    currentConv.isBlocked
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  {currentConv.isBlocked ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unblock Contact</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      <span>Block Contact</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleOpenReportModal}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Report Contact</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-sky-50/60 border border-sky-200/80 rounded-xl space-y-1.5 text-xs text-sky-950">
              <div className="font-bold flex items-center gap-1 text-sky-900">
                <Shield className="w-3.5 h-3.5" />
                Meta API Connection
              </div>
              <p className="text-[11px] text-sky-800">
                Messages sent from here go directly through Meta Cloud API to the recipient's personal WhatsApp.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Simulate Inbound Reply Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Simulate Patient Reply from WhatsApp
              </h3>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Simulate an incoming WhatsApp response from <strong>{currentConv?.mobile}</strong> to test both left (received) and right (sent) messages live.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-700 block">
                Quick Prompts:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["hi", "test", "Doctor, when can I take the medicine?", "Thank you doctor!"].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSimulateIncoming(prompt)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 rounded-md text-[11px] font-medium transition cursor-pointer"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Or Type Custom Inbound Message:
              </label>
              <input
                type="text"
                placeholder="e.g. Yes doctor, fever is better now"
                value={simulatedText}
                onChange={(e) => setSimulatedText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!simulatedText.trim() || isSimulating}
                onClick={() => handleSimulateIncoming()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? "Receiving..." : "Receive As Patient"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#00629b]" />
                Start Live WhatsApp Chat
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter any 10-digit mobile number to open a verified live WhatsApp chat thread.
            </p>

            <form onSubmit={handleCreateNewChat} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Recipient Name (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  WhatsApp Mobile Number (10 digits) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="98765 43210"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-[#00629b] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Open WhatsApp Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Direct Voice Call Modal (Issue 11) */}
      {showCallModal && currentConv && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                Initiate Patient Call
              </h3>
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">{currentConv.patientName}</p>
                <p className="text-xs font-mono text-emerald-700">{currentConv.mobile}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dial the patient directly from your telephony dialer or copy the contact number:
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(currentConv.mobile);
                  toast.success(`Copied ${currentConv.mobile} to clipboard`);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
              <a
                href={`tel:${(currentConv.mobile || "").replace(/\s+/g, "")}`}
                className="px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Patient</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 2. Video Consultation Link Modal (Issue 11) */}
      {showVideoModal && currentConv && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-600" />
                Video Consultation Session
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider">Telemedicine Room URL:</span>
              <p className="text-xs font-mono text-slate-800 break-all select-all">
                {`https://mediconnect.fit/doctor/${(currentConv.mobile || "").replace(/\D/g, "").slice(-10)}?mode=telemedicine`}
              </p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Send the telemedicine session invitation directly into this patient&apos;s WhatsApp chat or launch the room now:
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const url = `https://mediconnect.fit/doctor/${(currentConv.mobile || "").replace(/\D/g, "").slice(-10)}?mode=telemedicine`;
                  setReplyText(`Hello, your doctor is ready for your video consultation. Please tap the link to join: ${url}`);
                  setShowVideoModal(false);
                  inputRef.current?.focus();
                  toast.success("Video room link inserted into message input");
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Insert in Chat
              </button>
              <a
                href={`https://mediconnect.fit/doctor/${(currentConv.mobile || "").replace(/\D/g, "").slice(-10)}?mode=telemedicine`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#00629b] hover:bg-[#004f7c] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Launch Video Room</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tags & Priority Assignment Modal (Issue 11) */}
      {showTagsModal && currentConv && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                Assign Patient Tag & Priority
              </h3>
              <button
                type="button"
                onClick={() => setShowTagsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select tag to categorize this conversation:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "P1 Critical", color: "bg-rose-100 text-rose-800 border-rose-200" },
                { label: "Follow-up Required", color: "bg-amber-100 text-amber-800 border-amber-200" },
                { label: "VIP Patient", color: "bg-purple-100 text-purple-800 border-purple-200" },
                { label: "Prescription Ready", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                { label: "Consultation Booked", color: "bg-blue-100 text-blue-800 border-blue-200" },
                { label: "General Inquiry", color: "bg-slate-100 text-slate-800 border-slate-200" },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === currentConv.id
                          ? { ...c, escalationTag: t.label }
                          : c
                      )
                    );
                    setShowTagsModal(false);
                    toast.success(`Assigned tag "${t.label}" to ${currentConv.patientName}`);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer hover:scale-105 ${t.color}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Report Contact Modal */}
      {showReportModal && currentConv && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Report Contact</h3>
                  <p className="text-[11px] text-slate-500">Flag for safety, spam, or compliance review</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Contact Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-slate-800">{currentConv.patientName}</p>
                <p className="text-slate-500 font-mono text-[11px]">{currentConv.mobile}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {currentConv.patientId}
              </span>
            </div>

            {/* Reason Choices */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Reason for reporting <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5 text-xs">
                {[
                  { id: "spam", label: "Spam or unsolicited promotional messages" },
                  { id: "harassment", label: "Harassment, abusive, or threatening language" },
                  { id: "fraud", label: "Impersonation, scam, or fraudulent requests" },
                  { id: "inappropriate", label: "Inappropriate or non-medical queries" },
                  { id: "other", label: "Other suspicious behavior" },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                      reportReason === item.label
                        ? "bg-amber-50/70 border-amber-300 text-amber-950 font-medium"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.label}
                      checked={reportReason === item.label}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional details */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Additional Details (Optional)
              </label>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Briefly describe what happened for compliance audit..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Checkbox: Also block */}
            <label className="flex items-start gap-2.5 p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={reportAlsoBlock}
                onChange={(e) => setReportAlsoBlock(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-rose-900">Also block this contact immediately</span>
                <p className="text-[11px] text-rose-700">Prevents future inbound messages and silences automated bot replies.</p>
              </div>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReport}
                onClick={handleSubmitReport}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmittingReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Flag className="w-3.5 h-3.5" />
                    <span>{reportAlsoBlock ? "Report & Block" : "Submit Report"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MEDIA MODAL */}
      {lightboxMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-150 select-none"
          onClick={() => setLightboxMedia(null)}
        >
          {/* Top Bar: Title & Actions */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between text-white py-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                {isVideoMedia(lightboxMedia) ? (
                  <Video className="w-4 h-4 text-blue-400" />
                ) : isAudioMedia(lightboxMedia) ? (
                  <Mic className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-white">{lightboxMedia.name || "Media File"}</p>
                {lightboxMedia.size > 0 && (
                  <p className="text-[11px] text-white/60">{formatBytes(lightboxMedia.size)}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={lightboxMedia.url}
                target="_blank"
                rel="noreferrer"
                download={lightboxMedia.name || "media-file"}
                className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <a
                href={lightboxMedia.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/80 text-white transition cursor-pointer ml-1"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Stage */}
          <div 
            className="flex-1 w-full max-w-5xl flex items-center justify-center min-h-0 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideoMedia(lightboxMedia) ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] max-w-full rounded-xl shadow-2xl bg-black object-contain"
              />
            ) : isAudioMedia(lightboxMedia) ? (
              <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <Mic className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{lightboxMedia.name || "Voice / Audio"}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatBytes(lightboxMedia.size)}</p>
                </div>
                <audio src={lightboxMedia.url} controls autoPlay className="w-full" />
              </div>
            ) : (
              <img
                src={lightboxMedia.url}
                alt={lightboxMedia.name || "Full Preview"}
                className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain cursor-zoom-out"
                onClick={() => setLightboxMedia(null)}
              />
            )}
          </div>

          {/* Bottom Hint */}
          <div className="text-white/40 text-[11px] py-1 select-none">
            Click outside or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 font-mono text-[10px]">Esc</kbd> to close
          </div>
        </div>
      )}
    </div>
  );
}
