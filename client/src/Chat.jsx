/**
 * Nexus Chat — Complete Rewrite
 *
 * KEY FIXES:
 * - Friend acceptance now atomically updates BOTH users in a single batch write
 * - Real-time listeners properly sync friend state for both parties
 * - No stale state / cache issues (all state derived from live Firestore snapshots)
 * - Proper validation: no duplicates, no self-adds, no double requests
 * - Chat unlocks instantly after acceptance (derived from live friends array)
 *
 * ARCHITECTURE:
 * - All friend-state (friends, requests, sent) is read directly from live profile
 *   snapshots — never stored in redundant local state that can drift.
 * - Message deduplication handled by Firestore document IDs (no client-side gen).
 * - writeBatch() for all multi-document operations to prevent partial writes.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, doc, setDoc, getDoc, updateDoc,
  arrayUnion, arrayRemove, where, getDocs, deleteDoc,
  writeBatch, limit, Timestamp,
} from "firebase/firestore";

/* ─────────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────────── */

/** Stable DM conversation ID (alphabetically sorted UIDs) */
const dmId = (a, b) => [a, b].sort().join("__");

/** Hue from string for avatar gradient */
const hue = (s = "") => [...s].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;

/** Generate a random 8-char alphanumeric user ID */
const genUserId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

/** Format Firestore timestamp to HH:MM */
const fmtTime = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

/** Format Firestore timestamp to date label */
const fmtDate = (ts) => {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Format last-seen timestamp */
const fmtLastSeen = (ts) => {
  if (!ts?.toDate) return "a while ago";
  const d = ts.toDate();
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/** Sanitize text input */
const sanitize = (s) => s.replace(/<[^>]*>/g, "").trim().slice(0, 2000);

/* ─────────────────────────────────────────────────────────────────
   TOAST SYSTEM
───────────────────────────────────────────────────────────────── */

let _addToast = null;
export const toast = {
  success: (msg) => _addToast?.({ msg, type: "success" }),
  error:   (msg) => _addToast?.({ msg, type: "error" }),
  info:    (msg) => _addToast?.({ msg, type: "info" }),
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _addToast = useCallback(({ msg, type }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const colors = { success: "#22c55e", error: "#ef4444", info: "#8b5cf6" };
  const icons  = { success: "✓", error: "✕", info: "ℹ" };

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#1a1a2e", color: "#fff",
          borderRadius: 12, padding: "12px 18px",
          fontSize: 13.5, fontWeight: 600,
          borderLeft: `4px solid ${colors[t.type]}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          animation: "toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          maxWidth: 320,
        }}>
          <span style={{ color: colors[t.type], fontSize: 15, fontWeight: 800 }}>{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AVATAR COMPONENT
───────────────────────────────────────────────────────────────── */

const STATUS_COLORS = {
  online:  "#22c55e",
  away:    "#f59e0b",
  busy:    "#ef4444",
  offline: "#9ca3af",
};

function Avatar({ name = "?", photo, size = 40, status, mine = false }) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const h = hue(name);
  const bg = mine
    ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
    : `linear-gradient(135deg,hsl(${h},60%,58%),hsl(${(h + 40) % 360},55%,48%))`;

  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      {photo ? (
        <img src={photo} alt={name} style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "2px solid rgba(255,255,255,0.1)",
        }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%", background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.35, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.02em", flexShrink: 0, userSelect: "none",
        }}>{initials}</div>
      )}
      {status && status !== "offline" && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.26, height: size * 0.26,
          background: STATUS_COLORS[status] || STATUS_COLORS.online,
          borderRadius: "50%", border: "2px solid #fff",
          boxSizing: "content-box",
        }} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────────────────────────────────── */

function Bubble({ msg, isMine, showDate, onReact, onReply, onDelete, myId }) {
  const [showActions, setShowActions] = useState(false);
  const time = fmtTime(msg.timestamp);
  const dateLabel = fmtDate(msg.timestamp);

  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions);

  return (
    <>
      {showDate && (
        <div style={{
          textAlign: "center", margin: "20px 0 10px",
          fontSize: 11, color: "#a78bfa", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>{dateLabel}</div>
      )}

      {/* Reply preview */}
      {msg.replyTo && (
        <div style={{
          display: "flex", flexDirection: isMine ? "row-reverse" : "row",
          padding: "0 16px 2px",
        }}>
          <div style={{
            maxWidth: "60%", padding: "4px 10px",
            background: "rgba(139,92,246,0.08)", borderRadius: 8,
            borderLeft: isMine ? "none" : "3px solid #8b5cf6",
            borderRight: isMine ? "3px solid #8b5cf6" : "none",
            fontSize: 12, color: "#7c3aed", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <span style={{ fontWeight: 700 }}>{msg.replyTo.userName}: </span>
            {msg.replyTo.text}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex", gap: 8, padding: "2px 16px",
          flexDirection: isMine ? "row-reverse" : "row",
          alignItems: "flex-end",
          animation: "bubbleIn 0.2s ease",
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {!isMine && (
          <Avatar name={msg.userName} photo={msg.userPhoto} size={30} />
        )}

        <div style={{
          maxWidth: "72%", display: "flex", flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start", gap: 3,
          position: "relative",
        }}>
          {!isMine && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", paddingLeft: 4 }}>
              {msg.userName}
            </span>
          )}

          <div style={{
            background: isMine
              ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
              : "#f5f3ff",
            color: isMine ? "#fff" : "#1e1b4b",
            borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "10px 14px",
            fontSize: 14, lineHeight: 1.55, wordBreak: "break-word",
            border: isMine ? "none" : "1px solid #ede9fe",
            boxShadow: isMine
              ? "0 4px 16px rgba(79,70,229,0.25)"
              : "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            {msg.deleted ? (
              <span style={{ opacity: 0.5, fontStyle: "italic", fontSize: 13 }}>
                Message deleted
              </span>
            ) : msg.text}
          </div>

          {/* Reactions */}
          {reactionEntries.length > 0 && (
            <div style={{
              display: "flex", gap: 4, flexWrap: "wrap",
              justifyContent: isMine ? "flex-end" : "flex-start",
              paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0,
            }}>
              {reactionEntries.map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  style={{
                    background: users.includes(myId) ? "#ede9fe" : "#f5f3ff",
                    border: `1px solid ${users.includes(myId) ? "#8b5cf6" : "#e5e7eb"}`,
                    borderRadius: 20, padding: "2px 8px", fontSize: 12,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {emoji} <span style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9" }}>{users.length}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            paddingLeft: 4, paddingRight: 4,
          }}>
            <span style={{ fontSize: 10.5, color: "#c4b5fd" }}>{time}</span>
            {isMine && msg.readBy && (
              <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700 }}>
                {msg.readBy.length > 0 ? "✓✓" : "✓"}
              </span>
            )}
          </div>
        </div>

        {/* Message actions (hover) */}
        {showActions && !msg.deleted && (
          <div style={{
            display: "flex", flexDirection: isMine ? "row" : "row-reverse",
            gap: 4, alignSelf: "center",
            animation: "fadeIn 0.1s ease",
          }}>
            {["👍", "❤️", "😂", "😮"].map((em) => (
              <button
                key={em}
                onClick={() => onReact(msg.id, em)}
                title={`React ${em}`}
                style={{
                  width: 28, height: 28, border: "1px solid #ede9fe",
                  borderRadius: "50%", background: "#fff", cursor: "pointer",
                  fontSize: 14, display: "flex", alignItems: "center",
                  justifyContent: "center", transition: "transform 0.1s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.15)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >{em}</button>
            ))}
            <button onClick={() => onReply(msg)} title="Reply" style={{
              width: 28, height: 28, border: "1px solid #ede9fe",
              borderRadius: "50%", background: "#fff", cursor: "pointer",
              fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
            }}>↩</button>
            {isMine && (
              <button onClick={() => onDelete(msg.id)} title="Delete" style={{
                width: 28, height: 28, border: "1px solid #fee2e2",
                borderRadius: "50%", background: "#fff", cursor: "pointer",
                fontSize: 13, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#ef4444",
              }}>✕</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EMOJI PICKER (lightweight)
───────────────────────────────────────────────────────────────── */

const EMOJI_LIST = [
  "😊","😂","🥰","😍","🤩","😎","🥳","🤔","😅","😭",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💕","💯",
  "🎉","🎊","🎁","🎈","✨","🌟","⭐","🔥","💫","🌈",
  "👍","👎","👋","🙌","🤝","💪","🙏","👏","🤜","🤛",
  "😀","😃","😄","😁","🥲","😇","🤗","🤭","😏","😒",
];

function EmojiPicker({ onPick, onClose }) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", right: 0, marginBottom: 8,
      background: "#fff", border: "1.5px solid #ede9fe", borderRadius: 16,
      padding: 12, width: 260, zIndex: 50,
      boxShadow: "0 10px 40px rgba(109,40,217,0.15)",
      display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 2,
      animation: "fadeUp 0.15s ease",
    }}>
      {EMOJI_LIST.map((em) => (
        <button key={em} onClick={() => { onPick(em); onClose(); }} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 18, padding: 4, borderRadius: 6, lineHeight: 1,
          transition: "transform 0.1s",
        }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.25)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        >{em}</button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────────────────────────── */

function Skeleton({ width, height, borderRadius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN CHAT COMPONENT
───────────────────────────────────────────────────────────────── */

export default function Chat() {
  const navigate = useNavigate();

  /* ── Auth ── */
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── Profile (live snapshot of the current user's Firestore doc) ── */
  const [profile, setProfile]     = useState(null);

  /* ── Friends (live snapshots of each friend's doc) ── */
  const [friendProfiles, setFriendProfiles]   = useState({});   // uid → profile
  const [requestProfiles, setRequestProfiles] = useState({});   // uid → profile (incoming)

  /* ── Messages ── */
  const [messages, setMessages]   = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);

  /* ── UI ── */
  const [tab, setTab]             = useState("chats");  // chats | friends | requests
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [replyTo, setReplyTo]     = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  /* ── Friend search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  /* ── Profile edit ── */
  const [showProfile, setShowProfile] = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const [editName, setEditName]   = useState("");
  const [editBio, setEditBio]     = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editStatus, setEditStatus] = useState("online");
  const [profileSaving, setProfileSaving] = useState(false);

  /* ── Typing indicator ── */
  const [friendTyping, setFriendTyping] = useState(false);

  /* ── Blocked users ── */
  const [blocked, setBlocked]     = useState([]);

  /* ── Loading states ── */
  const [messagesLoading, setMessagesLoading] = useState(false);

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const msgUnsubRef = useRef(null);
  const typingTimer = useRef(null);
  const typingDocRef = useRef(null);

  const myId = user?.uid;

  /* ════════════════════════════════════════════════════════════
     AUTH LISTENER
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    return auth.onAuthStateChanged((u) => {
      if (u) { setUser(u); setAuthLoading(false); }
      else navigate("/login");
    });
  }, [navigate]);

  /* ════════════════════════════════════════════════════════════
     BOOTSTRAP / LIVE PROFILE SNAPSHOT
     All derived state (friends, requests, sent, blocked) is
     read directly from this snapshot — never duplicated.
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!myId || !user) return;
    const ref = doc(db, "users", myId);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        // First-time user setup
        const displayName = user.displayName || user.email?.split("@")[0] || "User";
        const newProfile = {
          uid: myId,
          name: displayName,
          email: user.email || "",
          photo: user.photoURL || "",
          bio: "",
          userId: genUserId(),
          friends: [],
          friendRequests: [],
          sentRequests: [],
          blocked: [],
          status: "online",
          online: true,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, newProfile);
        setProfile(newProfile);
      } else {
        const data = snap.data();
        setProfile(data);
        setBlocked(data.blocked || []);
      }
    });
    return unsub;
  }, [myId, user]);

  /* ════════════════════════════════════════════════════════════
     ONLINE PRESENCE
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!myId) return;
    const ref = doc(db, "users", myId);
    const setOnline = () =>
      setDoc(ref, { online: true, lastSeen: serverTimestamp(), status: profile?.status || "online" }, { merge: true }).catch(() => {});
    const setOffline = () =>
      setDoc(ref, { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});

    setOnline();
    window.addEventListener("beforeunload", setOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") setOnline();
      else setOffline();
    });
    return () => {
      setOffline();
      window.removeEventListener("beforeunload", setOffline);
    };
  }, [myId, profile?.status]);

  /* ════════════════════════════════════════════════════════════
     LIVE FRIEND PROFILE SNAPSHOTS
     Subscribes to each friend's doc independently so any
     change (name, photo, online status) reflects instantly.
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!profile?.friends?.length) {
      setFriendProfiles({});
      return;
    }
    const unsubs = profile.friends.map((fid) =>
      onSnapshot(doc(db, "users", fid), (snap) => {
        if (snap.exists()) {
          setFriendProfiles((prev) => ({ ...prev, [fid]: { uid: fid, ...snap.data() } }));
        }
      })
    );
    // Clean up removed friends
    setFriendProfiles((prev) => {
      const next = {};
      profile.friends.forEach((fid) => { if (prev[fid]) next[fid] = prev[fid]; });
      return next;
    });
    return () => unsubs.forEach((u) => u());
  }, [JSON.stringify(profile?.friends)]);

  /* ════════════════════════════════════════════════════════════
     LIVE REQUEST PROFILE SNAPSHOTS
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!profile?.friendRequests?.length) {
      setRequestProfiles({});
      return;
    }
    const unsubs = profile.friendRequests.map((fid) =>
      onSnapshot(doc(db, "users", fid), (snap) => {
        if (snap.exists()) {
          setRequestProfiles((prev) => ({ ...prev, [fid]: { uid: fid, ...snap.data() } }));
        }
      }, () => {
        setRequestProfiles((prev) => { const n = { ...prev }; delete n[fid]; return n; });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [JSON.stringify(profile?.friendRequests)]);

  /* ════════════════════════════════════════════════════════════
     LAST MESSAGES + UNREAD COUNTS per friend
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!myId || !profile?.friends?.length) return;
    const unsubs = profile.friends.map((fid) => {
      const cid = dmId(myId, fid);
      const q = query(
        collection(db, "dms", cid, "messages"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      return onSnapshot(q, (snap) => {
        const last = snap.docs[0]?.data() || null;
        setLastMessages((prev) => ({ ...prev, [fid]: last }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [myId, JSON.stringify(profile?.friends)]);

  /* ════════════════════════════════════════════════════════════
     LIVE MESSAGES for active DM
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (msgUnsubRef.current) { msgUnsubRef.current(); msgUnsubRef.current = null; }
    if (!activeFriend || !myId) { setMessages([]); return; }

    setMessagesLoading(true);
    const cid = dmId(myId, activeFriend.uid);
    const q = query(
      collection(db, "dms", cid, "messages"),
      orderBy("timestamp", "asc")
    );
    msgUnsubRef.current = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMessagesLoading(false);
    });
    return () => { if (msgUnsubRef.current) msgUnsubRef.current(); };
  }, [activeFriend?.uid, myId]);

  /* ════════════════════════════════════════════════════════════
     TYPING INDICATOR — subscribe to friend's typing signal
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!activeFriend || !myId) { setFriendTyping(false); return; }
    const cid = dmId(myId, activeFriend.uid);
    const ref = doc(db, "dms", cid, "typing", activeFriend.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setFriendTyping(false); return; }
      const { isTyping, lastTyped } = snap.data();
      const stale = Date.now() - (lastTyped?.toMillis?.() || 0) > 5000;
      setFriendTyping(isTyping && !stale);
    });
    return unsub;
  }, [activeFriend?.uid, myId]);

  /* ════════════════════════════════════════════════════════════
     SCROLL TO BOTTOM
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, friendTyping]);

  /* ════════════════════════════════════════════════════════════
     COMPUTED VALUES
  ════════════════════════════════════════════════════════════ */

  const friends      = useMemo(() => Object.values(friendProfiles), [friendProfiles]);
  const friendReqs   = useMemo(() => Object.values(requestProfiles), [requestProfiles]);
  const reqCount     = profile?.friendRequests?.length || 0;

  const isFriend     = (uid) => profile?.friends?.includes(uid);
  const hasSent      = (uid) => profile?.sentRequests?.includes(uid);
  const hasRequest   = (uid) => profile?.friendRequests?.includes(uid);
  const isBlocked    = (uid) => blocked.includes(uid);

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const ta = lastMessages[a.uid]?.timestamp?.toDate?.() || 0;
      const tb = lastMessages[b.uid]?.timestamp?.toDate?.() || 0;
      return tb - ta;
    });
  }, [friends, lastMessages]);

  const messageGroups = useMemo(() =>
    messages.map((msg, i) => ({
      ...msg,
      showDate: !messages[i - 1] || fmtDate(msg.timestamp) !== fmtDate(messages[i - 1].timestamp),
    })),
    [messages]
  );

  /* ════════════════════════════════════════════════════════════
     ACTIONS
  ════════════════════════════════════════════════════════════ */

  /** Search users by userId or name */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const q1 = query(collection(db, "users"), where("userId", "==", searchQuery.trim()));
      const q2 = query(collection(db, "users"), where("name", "==", searchQuery.trim()));
      const [r1, r2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const all = new Map();
      [...r1.docs, ...r2.docs].forEach((d) => {
        if (d.id !== myId) all.set(d.id, { uid: d.id, ...d.data() });
      });
      setSearchResults(Array.from(all.values()));
    } catch (e) {
      toast.error("Search failed. Try again.");
    }
    setSearching(false);
  };

  /**
   * Send friend request — validates no duplicates, no existing friendship.
   */
  const sendRequest = async (targetId) => {
    if (!myId) return;
    if (targetId === myId) {
      toast.error("You can't add yourself.");
      return;
    }
    if (isFriend(targetId)) {
      toast.info("Already friends!");
      return;
    }
    if (hasSent(targetId)) {
      toast.info("Request already sent.");
      return;
    }
    if (hasRequest(targetId)) {
      toast.info("They already sent you a request.");
      return;
    }
    if (isBlocked(targetId)) {
      toast.error("Unblock this user first.");
      return;
    }

    try {
      const batch = writeBatch(db);

      batch.set(
        doc(db, "users", targetId),
        {
          friendRequests: arrayUnion(myId),
        },
        { merge: true }
      );

      batch.set(
        doc(db, "users", myId),
        {
          sentRequests: arrayUnion(targetId),
        },
        { merge: true }
      );

      await batch.commit();

      toast.success("Friend request sent!");
      setSearchResults((prev) =>
        prev.map((u) => (u.uid === targetId ? { ...u, requested: true } : u))
      );
    } catch (err) {
      console.error("sendRequest failed:", err);
      toast.error(err?.message || "Failed to send friend request.");
    }
  };

  /**
   * Accept friend request — CRITICAL FIX.
   * Uses writeBatch to atomically update BOTH users simultaneously.
   * Both users' friends arrays are updated in one commit.
   */
  const acceptRequest = async (fromId) => {
    if (!myId) return;
    try {
      const batch = writeBatch(db);
      // Add each other to friends, remove from request/sent queues
      batch.set(doc(db, "users", myId), {
        friends: arrayUnion(fromId),
        friendRequests: arrayRemove(fromId),
      }, { merge: true });
      batch.set(doc(db, "users", fromId), {
        friends: arrayUnion(myId),
        sentRequests: arrayRemove(myId),
      }, { merge: true });
      await batch.commit();
      toast.success("Friend added!");
    } catch (err) {
      console.error("acceptRequest:", err);
      toast.error("Failed to accept request.");
    }
  };

  /** Decline friend request */
  const declineRequest = async (fromId) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId), { friendRequests: arrayRemove(fromId) }, { merge: true });
      batch.set(doc(db, "users", fromId), { sentRequests: arrayRemove(myId) }, { merge: true });
      await batch.commit();
      toast.info("Request declined.");
    } catch (err) {
      toast.error("Failed to decline request.");
    }
  };

  /** Remove friend — updates both users */
  const removeFriend = async (friendId) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId), { friends: arrayRemove(friendId) }, { merge: true });
      batch.set(doc(db, "users", friendId), { friends: arrayRemove(myId) }, { merge: true });
      await batch.commit();
      if (activeFriend?.uid === friendId) setActiveFriend(null);
      toast.info("Friend removed.");
    } catch (err) {
      toast.error("Failed to remove friend.");
    }
  };

  /** Block user */
  const blockUser = async (uid) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId), {
        blocked: arrayUnion(uid),
        friends: arrayRemove(uid),
        friendRequests: arrayRemove(uid),
        sentRequests: arrayRemove(uid),
      }, { merge: true });
      batch.set(doc(db, "users", uid), {
        friends: arrayRemove(myId),
        friendRequests: arrayRemove(myId),
        sentRequests: arrayRemove(myId),
      }, { merge: true });
      await batch.commit();
      if (activeFriend?.uid === uid) setActiveFriend(null);
      toast.info("User blocked.");
    } catch (err) {
      toast.error("Failed to block user.");
    }
  };

  /** Unblock user */
  const unblockUser = async (uid) => {
    try {
      await setDoc(doc(db, "users", myId), { blocked: arrayRemove(uid) }, { merge: true });
      toast.info("User unblocked.");
    } catch (err) {
      toast.error("Failed to unblock user.");
    }
  };

  /** Send a message */
  const handleSend = async () => {
    const text = sanitize(input);
    if (!text || !activeFriend || !myId || sending) return;
    if (isBlocked(activeFriend.uid)) { toast.error("You have blocked this user."); return; }

    setSending(true);
    const cid = dmId(myId, activeFriend.uid);
    try {
      const msgData = {
        text,
        userId: myId,
        userName: profile?.name || "User",
        userPhoto: profile?.photo || "",
        timestamp: serverTimestamp(),
        readBy: [],
        reactions: {},
        deleted: false,
      };
      if (replyTo) {
        msgData.replyTo = { text: replyTo.text, userName: replyTo.userName, id: replyTo.id };
      }
      await addDoc(collection(db, "dms", cid, "messages"), msgData);
      setInput("");
      setReplyTo(null);
      inputRef.current?.focus();

      // Clear typing indicator
      clearTimeout(typingTimer.current);
      if (typingDocRef.current) {
        setDoc(typingDocRef.current, { isTyping: false, lastTyped: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.error("handleSend:", e);
      toast.error("Message failed. Try again.");
    }
    setSending(false);
  };

  /** Typing indicator — debounced */
  const handleTyping = (value) => {
    setInput(value);
    if (!activeFriend || !myId) return;
    const cid = dmId(myId, activeFriend.uid);
    const ref = doc(db, "dms", cid, "typing", myId);
    typingDocRef.current = ref;
    setDoc(ref, { isTyping: true, lastTyped: serverTimestamp() }, { merge: true }).catch(() => {});
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setDoc(ref, { isTyping: false, lastTyped: serverTimestamp() }, { merge: true }).catch(() => {});
    }, 3000);
  };

  /** React to a message */
  const handleReact = async (msgId, emoji) => {
    if (!myId || !activeFriend) return;
    const cid = dmId(myId, activeFriend.uid);
    const ref = doc(db, "dms", cid, "messages", msgId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const reactions = snap.data().reactions || {};
      const users = reactions[emoji] || [];
      const next = users.includes(myId)
        ? users.filter((u) => u !== myId)  // toggle off
        : [...users, myId];                 // toggle on
      if (next.length === 0) {
        const updated = { ...reactions };
        delete updated[emoji];
        await updateDoc(ref, { reactions: updated });
      } else {
        await updateDoc(ref, { [`reactions.${emoji}`]: next });
      }
    } catch (err) {
      console.error("handleReact:", err);
    }
  };

  /** Soft-delete a message */
  const handleDelete = async (msgId) => {
    if (!myId || !activeFriend) return;
    const cid = dmId(myId, activeFriend.uid);
    try {
      await updateDoc(doc(db, "dms", cid, "messages", msgId), {
        deleted: true, text: "",
      });
    } catch (err) {
      toast.error("Failed to delete message.");
    }
  };

  /** Save profile */
  const saveProfile = async () => {
    if (!myId) return;
    setProfileSaving(true);
    try {
      // Validate userId uniqueness if changed
      const newUserId = editUserId.trim();
      if (newUserId && newUserId !== profile?.userId) {
        const q = query(collection(db, "users"), where("userId", "==", newUserId));
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0].id !== myId) {
          toast.error("This ID is taken. Choose another.");
          setProfileSaving(false);
          return;
        }
      }
      await setDoc(doc(db, "users", myId), {
        name: editName.trim() || profile?.name,
        bio: editBio.trim(),
        userId: newUserId || profile?.userId,
        status: editStatus,
      }, { merge: true });
      toast.success("Profile saved!");
      setEditMode(false);
    } catch (err) {
      toast.error("Failed to save profile.");
    }
    setProfileSaving(false);
  };

  /** Logout */
  const handleLogout = async () => {
    if (myId) {
      await setDoc(doc(db, "users", myId), { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }
    await signOut(auth);
    navigate("/login");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ════════════════════════════════════════════════════════════
     SELECT FRIEND (and validate friendship still active)
  ════════════════════════════════════════════════════════════ */
  const openChat = (friend) => {
    if (!isFriend(friend.uid)) {
      toast.error("You are no longer friends with this user.");
      return;
    }
    setActiveFriend(friend);
    setTab("chats");
  };

  /* ════════════════════════════════════════════════════════════
     LOADING STATE
  ════════════════════════════════════════════════════════════ */
  if (authLoading || !user) {
    return (
      <div style={{
        display: "flex", height: "100dvh", alignItems: "center",
        justifyContent: "center", background: "#f5f3ff",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg,#8b5cf6,#4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900, color: "#fff",
            animation: "pulse 1.5s ease infinite",
          }}>N</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>Loading Nexus…</div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f3ff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 99px; }
        @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)} }
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
        @keyframes toastIn { from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none} }
        .row-hover:hover { background: #f5f3ff !important; }
        .btn-ghost:hover { background: #ede9fe !important; color: #7c3aed !important; }
        .btn-ghost:active { transform: scale(0.97); }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
        .send-btn:active:not(:disabled) { transform: scale(0.96); }
      `}</style>

      <div style={{
        display: "flex", height: "100dvh",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "#f5f3ff", overflow: "hidden",
      }}>

        {/* ══════════════════════════════════════════
            LEFT SIDEBAR
        ══════════════════════════════════════════ */}
        <div style={{
          width: 320, background: "#fff",
          borderRight: "1.5px solid #ede9fe",
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>

          {/* Header */}
          <div style={{
            height: 60, padding: "0 16px",
            borderBottom: "1.5px solid #ede9fe",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "linear-gradient(135deg,#8b5cf6,#4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 900, color: "#fff",
                fontFamily: "'Sora', sans-serif",
                boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
              }}>N</div>
              <span style={{
                fontSize: 17, fontWeight: 900, color: "#1a1a2e",
                fontFamily: "'Sora', sans-serif", letterSpacing: "-0.03em",
              }}>Nexus</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { icon: "🔍", action: () => setTab("friends"), title: "Find Friends" },
                { icon: "⚙️", action: () => { setShowProfile(true); setEditName(profile?.name || ""); setEditBio(profile?.bio || ""); setEditUserId(profile?.userId || ""); setEditStatus(profile?.status || "online"); }, title: "Settings" },
              ].map(({ icon, action, title }) => (
                <button key={icon} className="btn-ghost" onClick={action} title={title} style={{
                  width: 32, height: 32, border: "none", borderRadius: 8,
                  background: "transparent", cursor: "pointer", fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>{icon}</button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", padding: "8px 12px 0", gap: 2,
            borderBottom: "1.5px solid #ede9fe",
          }}>
            {[
              { id: "chats", label: "Chats" },
              { id: "friends", label: "Friends" },
              { id: "requests", label: reqCount ? `Requests · ${reqCount}` : "Requests" },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "7px 12px", fontSize: 12.5, fontWeight: 700,
                background: tab === t.id ? "#ede9fe" : "transparent",
                color: tab === t.id ? "#7c3aed" : "#9ca3af",
                border: "none", borderRadius: "8px 8px 0 0",
                cursor: "pointer", transition: "all 0.15s",
                position: "relative",
                whiteSpace: "nowrap",
              }}>
                {t.label}
                {t.id === "requests" && reqCount > 0 && (
                  <span style={{
                    position: "absolute", top: 4, right: 4,
                    width: 7, height: 7, background: "#ef4444",
                    borderRadius: "50%",
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* ── CHATS TAB ── */}
            {tab === "chats" && (
              <div>
                {sortedFriends.length === 0 ? (
                  <div style={{ padding: "50px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}>No conversations yet</div>
                    <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 4 }}>Add friends to start chatting</div>
                    <button onClick={() => setTab("friends")} style={{
                      marginTop: 16, padding: "9px 20px", fontSize: 13, fontWeight: 700,
                      background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", color: "#fff",
                      border: "none", borderRadius: 10, cursor: "pointer",
                    }}>Find friends →</button>
                  </div>
                ) : sortedFriends.map((friend) => {
                  const last = lastMessages[friend.uid];
                  const isActive = activeFriend?.uid === friend.uid;
                  const friendStatus = friend.online
                    ? (friend.status || "online")
                    : "offline";
                  return (
                    <div
                      key={friend.uid}
                      className="row-hover"
                      onClick={() => openChat(friend)}
                      style={{
                        display: "flex", alignItems: "center", gap: 11,
                        padding: "10px 16px", cursor: "pointer",
                        background: isActive ? "#f5f3ff" : "transparent",
                        borderLeft: `3px solid ${isActive ? "#8b5cf6" : "transparent"}`,
                        transition: "all 0.12s",
                      }}
                    >
                      <Avatar name={friend.name} photo={friend.photo} size={44} status={friendStatus} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{friend.name}</span>
                          <span style={{ fontSize: 10.5, color: "#c4b5fd", fontWeight: 600, flexShrink: 0 }}>
                            {last?.timestamp ? fmtTime(last.timestamp) : ""}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12.5, color: "#9ca3af",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", marginTop: 2,
                        }}>
                          {last
                            ? (last.deleted ? "Message deleted" : last.userId === myId ? `You: ${last.text}` : last.text)
                            : (friend.bio || "Say hello! 👋")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── FRIENDS TAB ── */}
            {tab === "friends" && (
              <div style={{ padding: 14 }}>
                {/* Search box */}
                <div style={{
                  background: "#faf8ff", border: "1.5px solid #ede9fe",
                  borderRadius: 14, padding: 14, marginBottom: 14,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    Find friends
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Name or friend ID…"
                      style={{
                        flex: 1, padding: "9px 13px", borderRadius: 10,
                        border: "1.5px solid #ede9fe", fontSize: 13, fontWeight: 500,
                        fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                        background: "#fff", color: "#1a1a2e",
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching}
                      style={{
                        padding: "9px 14px", background: "linear-gradient(135deg,#8b5cf6,#4f46e5)",
                        color: "#fff", border: "none", borderRadius: 10,
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        opacity: searching ? 0.7 : 1,
                      }}
                    >{searching ? "…" : "🔍"}</button>
                  </div>

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {searchResults.map((u) => {
                        const _isFriend  = isFriend(u.uid);
                        const _hasSent   = hasSent(u.uid) || u._requested;
                        const _hasReq    = hasRequest(u.uid);
                        const _isBlocked = isBlocked(u.uid);
                        return (
                          <div key={u.uid} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: "#fff", borderRadius: 12, padding: "10px 12px",
                            border: "1px solid #ede9fe",
                          }}>
                            <Avatar name={u.name} photo={u.photo} size={38} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>#{u.userId}</div>
                            </div>
                            {_isBlocked ? (
                              <button onClick={() => unblockUser(u.uid)} style={styles.btnDanger}>Unblock</button>
                            ) : _isFriend ? (
                              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>Friends ✓</span>
                            ) : _hasReq ? (
                              <button onClick={() => acceptRequest(u.uid)} style={styles.btnPrimary}>Accept</button>
                            ) : _hasSent ? (
                              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Requested</span>
                            ) : (
                              <button onClick={() => sendRequest(u.uid)} style={styles.btnPrimary}>Add</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {searchResults.length === 0 && searchQuery && !searching && (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: "#9ca3af", textAlign: "center" }}>
                      No users found
                    </div>
                  )}
                </div>

                {/* Friends list */}
                <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10 }}>
                  Friends — {friends.length}
                </div>
                {friends.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>
                    No friends yet. Search above! 👆
                  </div>
                ) : friends.map((friend) => {
                  const friendStatus = friend.online ? (friend.status || "online") : "offline";
                  return (
                    <div key={friend.uid} className="row-hover" style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 10px", borderRadius: 12,
                      transition: "all 0.12s", marginBottom: 4,
                    }}>
                      <Avatar name={friend.name} photo={friend.photo} size={40} status={friendStatus} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{friend.name}</div>
                        <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>#{friend.userId}</div>
                        <div style={{ fontSize: 11, color: STATUS_COLORS[friendStatus], fontWeight: 600 }}>
                          {friend.online ? (friend.status || "online") : `last seen ${fmtLastSeen(friend.lastSeen)}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openChat(friend)} style={styles.btnPrimary}>DM</button>
                        <button onClick={() => removeFriend(friend.uid)} style={styles.btnDanger}>✕</button>
                      </div>
                    </div>
                  );
                })}

                {/* Sent requests */}
                {profile?.sentRequests?.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.09em", textTransform: "uppercase", margin: "16px 0 10px" }}>
                      Sent — {profile.sentRequests.length}
                    </div>
                    {profile.sentRequests.map((uid) => {
                      const fp = friendProfiles[uid] || requestProfiles[uid];
                      return (
                        <div key={uid} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 12, marginBottom: 4,
                          background: "#faf8ff", border: "1px solid #ede9fe",
                        }}>
                          <Avatar name={fp?.name || uid} photo={fp?.photo} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{fp?.name || uid}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>Request pending…</div>
                          </div>
                          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Sent</span>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Blocked users */}
                {blocked.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", letterSpacing: "0.09em", textTransform: "uppercase", margin: "16px 0 10px" }}>
                      Blocked — {blocked.length}
                    </div>
                    {blocked.map((uid) => (
                      <div key={uid} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 12, marginBottom: 4,
                        background: "#fff5f5", border: "1px solid #fee2e2",
                      }}>
                        <Avatar name={uid} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>Blocked user</div>
                        </div>
                        <button onClick={() => unblockUser(uid)} style={{
                          padding: "5px 10px", fontSize: 11.5, fontWeight: 700,
                          background: "#fff", color: "#ef4444",
                          border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer",
                        }}>Unblock</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── REQUESTS TAB ── */}
            {tab === "requests" && (
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 12 }}>
                  Incoming — {friendReqs.length}
                </div>
                {friendReqs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 13 }}>
                    No pending requests 🎉
                  </div>
                ) : friendReqs.map((req) => (
                  <div key={req.uid} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#faf8ff", border: "1.5px solid #ede9fe",
                    borderRadius: 14, padding: "12px 14px", marginBottom: 10,
                    animation: "slideIn 0.2s ease",
                  }}>
                    <Avatar name={req.name} photo={req.photo} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{req.name}</div>
                      <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>#{req.userId}</div>
                      {req.bio && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.bio}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => acceptRequest(req.uid)} style={{
                        ...styles.btnPrimary, padding: "7px 14px", fontSize: 12.5,
                      }}>Accept ✓</button>
                      <button onClick={() => declineRequest(req.uid)} style={{
                        ...styles.btnDanger, padding: "7px 14px", fontSize: 12.5,
                      }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User footer */}
          <div style={{ padding: "10px 12px", borderTop: "1.5px solid #ede9fe" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 11px", borderRadius: 12,
              background: "#faf8ff", border: "1.5px solid #ede9fe",
              cursor: "pointer", transition: "all 0.15s",
            }} className="row-hover" onClick={() => {
              setShowProfile(true);
              setEditName(profile?.name || "");
              setEditBio(profile?.bio || "");
              setEditUserId(profile?.userId || "");
              setEditStatus(profile?.status || "online");
            }}>
              <Avatar name={profile?.name} photo={profile?.photo} size={34} status={profile?.status || "online"} mine />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || "You"}</div>
                <div style={{ fontSize: 10.5, color: "#a78bfa", fontWeight: 600 }}>#{profile?.userId}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                style={{ ...styles.btnDanger, fontSize: 11.5, padding: "4px 9px" }}
              >Exit</button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            MAIN CHAT AREA
        ══════════════════════════════════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#faf8ff" }}>

          {!activeFriend ? (
            /* Empty state */
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 18, padding: 40,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: "linear-gradient(135deg,#8b5cf6,#4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, boxShadow: "0 12px 40px rgba(79,70,229,0.25)",
              }}>💬</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em" }}>
                  Welcome to Nexus
                </div>
                <div style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500, marginTop: 6 }}>
                  Select a conversation or add friends to get started
                </div>
              </div>
              <button onClick={() => setTab("friends")} style={{
                padding: "11px 24px", fontSize: 14, fontWeight: 700, color: "#fff",
                background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", border: "none",
                borderRadius: 12, cursor: "pointer", boxShadow: "0 6px 20px rgba(79,70,229,0.28)",
              }}>Add a friend →</button>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                height: 60, borderBottom: "1.5px solid #ede9fe",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 20px", background: "#fff", flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar
                    name={activeFriend.name}
                    photo={activeFriend.photo}
                    size={38}
                    status={activeFriend.online ? (activeFriend.status || "online") : "offline"}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif" }}>
                      {activeFriend.name}
                    </div>
                    <div style={{ fontSize: 11, color: activeFriend.online ? STATUS_COLORS[activeFriend.status || "online"] : "#9ca3af", fontWeight: 600 }}>
                      {activeFriend.online
                        ? (activeFriend.status === "busy" ? "Busy" : activeFriend.status === "away" ? "Away" : "Active now")
                        : `Last seen ${fmtLastSeen(activeFriend.lastSeen)}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => toast.info("Voice calls coming soon!")}
                    style={styles.iconBtn}
                    title="Voice call (coming soon)"
                  >📞</button>
                  <button
                    className="btn-ghost"
                    onClick={() => toast.info("Video calls coming soon!")}
                    style={styles.iconBtn}
                    title="Video call (coming soon)"
                  >🎥</button>
                  <button
                    className="btn-ghost"
                    onClick={() => blockUser(activeFriend.uid)}
                    style={{ ...styles.iconBtn, color: "#ef4444" }}
                    title="Block user"
                  >🚫</button>
                  <button
                    className="btn-ghost"
                    onClick={() => removeFriend(activeFriend.uid)}
                    style={{ ...styles.iconBtn, color: "#ef4444" }}
                    title="Remove friend"
                  >✕</button>
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>

                {/* Conversation intro */}
                <div style={{ textAlign: "center", padding: "24px 20px 32px" }}>
                  <Avatar name={activeFriend.name} photo={activeFriend.photo} size={60} />
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", marginTop: 10 }}>
                    {activeFriend.name}
                  </div>
                  {activeFriend.bio && (
                    <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>{activeFriend.bio}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: "#c4b5fd", marginTop: 6, fontWeight: 600 }}>
                    Beginning of your conversation
                  </div>
                </div>

                {/* Loading skeleton */}
                {messagesLoading && (
                  <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, flexDirection: i % 2 === 0 ? "row" : "row-reverse" }}>
                        <Skeleton width={32} height={32} borderRadius={16} />
                        <Skeleton width={`${40 + (i * 15)}%`} height={40} borderRadius={12} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages */}
                {!messagesLoading && messageGroups.map((msg) => (
                  <Bubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.userId === myId}
                    showDate={msg.showDate}
                    myId={myId}
                    onReact={handleReact}
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                  />
                ))}

                {/* Typing indicator */}
                {friendTyping && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 20px", animation: "fadeIn 0.2s ease",
                  }}>
                    <Avatar name={activeFriend.name} photo={activeFriend.photo} size={26} />
                    <div style={{
                      background: "#f5f3ff", border: "1px solid #ede9fe",
                      borderRadius: "18px 18px 18px 4px", padding: "10px 16px",
                      display: "flex", gap: 4,
                    }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span key={i} style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: "#a78bfa", display: "inline-block",
                          animation: `bounce 1s ${d}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply preview */}
              {replyTo && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#f5f3ff", borderTop: "1px solid #ede9fe",
                  padding: "8px 16px",
                }}>
                  <div style={{
                    flex: 1, padding: "6px 10px", borderRadius: 8,
                    borderLeft: "3px solid #8b5cf6", background: "#ede9fe",
                    fontSize: 12.5, color: "#6d28d9",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontWeight: 700 }}>Replying to {replyTo.userName}: </span>{replyTo.text}
                  </div>
                  <button onClick={() => setReplyTo(null)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#9ca3af", fontSize: 16, padding: 4,
                  }}>✕</button>
                </div>
              )}

              {/* Input */}
              <div style={{ padding: "10px 16px 14px", flexShrink: 0, position: "relative" }}>
                {showEmojiPicker && (
                  <EmojiPicker
                    onPick={(em) => setInput((p) => p + em)}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 8,
                  background: "#fff", border: "1.5px solid #ede9fe",
                  borderRadius: 18, padding: "8px 10px",
                  boxShadow: "0 2px 12px rgba(109,40,217,0.05)",
                }}>
                  <button
                    onClick={() => setShowEmojiPicker((p) => !p)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 20, padding: "4px 2px", flexShrink: 0, lineHeight: 1,
                      opacity: 0.6, transition: "opacity 0.1s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
                    title="Emoji picker"
                  >😊</button>

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={`Message ${activeFriend.name}…`}
                    rows={1}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      resize: "none", color: "#1a1a2e", fontSize: 14, lineHeight: 1.5,
                      fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "5px 4px",
                      maxHeight: 120, overflowY: "auto",
                    }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                  />

                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    title="Send (Enter)"
                    style={{
                      width: 40, height: 40, borderRadius: 12, border: "none",
                      background: (sending || !input.trim())
                        ? "#ede9fe"
                        : "linear-gradient(135deg,#8b5cf6,#4f46e5)",
                      cursor: (sending || !input.trim()) ? "not-allowed" : "pointer",
                      color: (sending || !input.trim()) ? "#c4b5fd" : "#fff",
                      fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s", flexShrink: 0,
                      boxShadow: (sending || !input.trim()) ? "none" : "0 4px 14px rgba(79,70,229,0.3)",
                    }}
                  >➤</button>
                </div>
                <div style={{ textAlign: "center", fontSize: 10.5, color: "#d8b4fe", marginTop: 5, fontWeight: 500 }}>
                  Enter to send · Shift+Enter for newline
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PROFILE MODAL
      ══════════════════════════════════════════ */}
      {showProfile && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(79,70,229,0.12)",
            backdropFilter: "blur(8px)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { setShowProfile(false); setEditMode(false); }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 24, width: 400, maxWidth: "95vw",
              boxShadow: "0 30px 80px rgba(79,70,229,0.2)", overflow: "hidden",
              animation: "modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              background: "linear-gradient(135deg,#8b5cf6,#4f46e5)",
              padding: "24px 24px 36px", position: "relative",
            }}>
              <button
                onClick={() => { setShowProfile(false); setEditMode(false); }}
                style={{
                  position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.2)",
                  border: "none", borderRadius: 8, width: 28, height: 28,
                  color: "#fff", cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Avatar name={profile?.name} photo={profile?.photo} size={64} status={profile?.status || "online"} mine />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", fontFamily: "'Sora', sans-serif" }}>
                    {profile?.name}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>
                    {profile?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: "24px 24px 20px", marginTop: -14 }}>
              {/* Friend ID card */}
              <div style={{
                background: "#faf8ff", borderRadius: 14, padding: "12px 16px",
                border: "1.5px solid #ede9fe", marginBottom: 20,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  Your Friend ID
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#7c3aed", fontFamily: "'Sora', sans-serif", letterSpacing: "0.04em" }}>
                  #{profile?.userId}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Share this so friends can find you</div>
              </div>

              {editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Display Name", value: editName, set: setEditName, placeholder: "Your name" },
                    { label: "Friend ID (unique)", value: editUserId, set: setEditUserId, placeholder: "Custom ID" },
                  ].map(({ label, value, set, placeholder }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>{label}</div>
                      <input
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        style={{
                          width: "100%", padding: "9px 13px", borderRadius: 10,
                          border: "1.5px solid #ede9fe", fontSize: 13.5,
                          fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                          color: "#1a1a2e", background: "#faf8ff",
                        }}
                      />
                    </div>
                  ))}

                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>Bio</div>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Something about you…"
                      rows={2}
                      style={{
                        width: "100%", padding: "9px 13px", borderRadius: 10,
                        border: "1.5px solid #ede9fe", fontSize: 13.5, resize: "none",
                        fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                        color: "#1a1a2e", background: "#faf8ff",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>Status</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[
                        { val: "online", label: "🟢 Online" },
                        { val: "away",   label: "🟡 Away" },
                        { val: "busy",   label: "🔴 Busy" },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setEditStatus(val)}
                          style={{
                            flex: 1, padding: "7px 6px", fontSize: 12, fontWeight: 700,
                            background: editStatus === val ? "#ede9fe" : "#faf8ff",
                            color: editStatus === val ? "#7c3aed" : "#6b7280",
                            border: `1.5px solid ${editStatus === val ? "#c4b5fd" : "#ede9fe"}`,
                            borderRadius: 9, cursor: "pointer",
                          }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={saveProfile}
                      disabled={profileSaving}
                      style={{
                        flex: 1, padding: "11px", fontSize: 14, fontWeight: 700, color: "#fff",
                        background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", border: "none",
                        borderRadius: 12, cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(79,70,229,0.28)",
                      }}
                    >{profileSaving ? "Saving…" : "Save changes"}</button>
                    <button
                      onClick={() => setEditMode(false)}
                      style={{
                        padding: "11px 16px", fontSize: 14, fontWeight: 700, color: "#7c3aed",
                        background: "#f5f3ff", border: "none", borderRadius: 12, cursor: "pointer",
                      }}
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Bio</div>
                    <div style={{ fontSize: 14, color: profile?.bio ? "#374151" : "#9ca3af", fontStyle: profile?.bio ? "normal" : "italic" }}>
                      {profile?.bio || "No bio yet"}
                    </div>
                  </div>
                  <div style={{ marginBottom: 18, display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Friends</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{friends.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Status</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: STATUS_COLORS[profile?.status || "online"] }}>
                        {(profile?.status || "online").charAt(0).toUpperCase() + (profile?.status || "online").slice(1)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setEditMode(true)}
                      style={{
                        flex: 1, padding: "11px", fontSize: 14, fontWeight: 700, color: "#fff",
                        background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", border: "none",
                        borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 14px rgba(79,70,229,0.28)",
                      }}
                    >Edit profile ✏️</button>
                    <button
                      onClick={handleLogout}
                      style={{
                        padding: "11px 16px", fontSize: 14, fontWeight: 700, color: "#ef4444",
                        background: "#fef2f2", border: "none", borderRadius: 12, cursor: "pointer",
                      }}
                    >Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SHARED BUTTON STYLES
───────────────────────────────────────────────────────────────── */
const styles = {
  btnPrimary: {
    padding: "6px 12px", fontSize: 12, fontWeight: 700,
    background: "linear-gradient(135deg,#8b5cf6,#4f46e5)", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer",
  },
  btnDanger: {
    padding: "6px 12px", fontSize: 12, fontWeight: 700,
    background: "#fef2f2", color: "#ef4444",
    border: "1px solid #fee2e2", borderRadius: 8, cursor: "pointer",
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 9, background: "#f5f3ff",
    border: "none", fontSize: 16, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  },
};