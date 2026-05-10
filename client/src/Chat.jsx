import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, doc, setDoc, getDoc, updateDoc,
  arrayUnion, arrayRemove, where, getDocs, deleteDoc,
} from "firebase/firestore";

/* ─── helpers ─────────────────────────────────────────────── */
const hue = (name = "") => [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
const dmId = (a, b) => [a, b].sort().join("_");
const fmtTime = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "···";
const fmtDate = (ts) => {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/* ─── Avatar ───────────────────────────────────────────────── */
function Avatar({ name = "?", photo, size = 40, online = false, mine = false }) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const h = hue(name);
  const bg = mine
    ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
    : `linear-gradient(135deg,hsl(${h},65%,62%),hsl(${h + 40},60%,52%))`;
  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      {photo ? (
        <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%", background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.36, fontWeight: 800, color: "#fff",
          fontFamily: "'Sora', sans-serif", flexShrink: 0,
        }}>{initials}</div>
      )}
      {online && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27,
          background: "#22c55e", borderRadius: "50%",
          border: `2px solid #fff`,
        }} />
      )}
    </div>
  );
}

/* ─── Bubble ───────────────────────────────────────────────── */
function Bubble({ msg, isMine, showDate, prevDate }) {
  const time = fmtTime(msg.timestamp);
  const dateLabel = fmtDate(msg.timestamp);
  return (
    <>
      {showDate && (
        <div style={{ textAlign: "center", margin: "16px 0 8px", fontSize: 11.5, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {dateLabel}
        </div>
      )}
      <div style={{
        display: "flex", gap: 8, padding: "3px 16px",
        flexDirection: isMine ? "row-reverse" : "row",
        alignItems: "flex-end",
        animation: "fadeUp 0.18s ease both",
      }}>
        {!isMine && <Avatar name={msg.userName} photo={msg.userPhoto} size={32} />}
        <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: 2 }}>
          {!isMine && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#8b5cf6", paddingLeft: 4 }}>{msg.userName}</span>
          )}
          <div style={{
            background: isMine
              ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
              : "#f5f3ff",
            color: isMine ? "#fff" : "#2d1b69",
            borderRadius: isMine ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
            padding: "10px 15px",
            fontSize: 14, lineHeight: 1.55,
            wordBreak: "break-word",
            boxShadow: isMine ? "0 4px 18px rgba(109,40,217,0.3)" : "0 2px 8px rgba(109,40,217,0.07)",
            border: isMine ? "none" : "1px solid #ede9fe",
          }}>
            {msg.text}
          </div>
          <span style={{ fontSize: 10.5, color: "#c4b5fd", paddingLeft: 4, paddingRight: 4 }}>{time}</span>
        </div>
      </div>
    </>
  );
}

/* ─── Main Chat Component ──────────────────────────────────── */
export default function Chat() {
  const [user] = useState(auth?.currentUser);
  const navigate = useNavigate?.() || {};

  // Profile state
  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Friends state
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Conversation state
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);

  // UI state
  const [tab, setTab] = useState("chats"); // chats | friends | requests
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [lastMessages, setLastMessages] = useState({});

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);
  const unsub = useRef(null);

  const myId = user?.uid;

  /* ── bootstrap profile ── */
  useEffect(() => {
    if (!myId) return;
    const ref = doc(db, "users", myId);
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        const displayName = user.displayName || user.email?.split("@")[0] || "User";
        const newProfile = {
          uid: myId,
          name: displayName,
          email: user.email || "",
          photo: user.photoURL || "",
          bio: "",
          userId: myId.slice(0, 8),
          friends: [],
          friendRequests: [],
          sentRequests: [],
          createdAt: serverTimestamp(),
          online: true,
          lastSeen: serverTimestamp(),
        };
        await setDoc(ref, newProfile);
        setProfile(newProfile);
      }
    });
    return unsub;
  }, [myId]);

  /* ── mark online / offline ── */
  useEffect(() => {
    if (!myId) return;
    const ref = doc(db, "users", myId);
    updateDoc(ref, { online: true, lastSeen: serverTimestamp() }).catch(() => {});
    const off = () => updateDoc(ref, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
    window.addEventListener("beforeunload", off);
    return () => { off(); window.removeEventListener("beforeunload", off); };
  }, [myId]);

  /* ── load friends list ── */
  useEffect(() => {
    if (!profile?.friends?.length) { setFriends([]); return; }
    const unsubs = profile.friends.map((fid) =>
      onSnapshot(doc(db, "users", fid), (snap) => {
        if (snap.exists()) {
          setFriends((prev) => {
            const filtered = prev.filter((f) => f.uid !== fid);
            return [...filtered, { uid: fid, ...snap.data() }];
          });
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [profile?.friends?.join(",")]);

  /* ── load friend requests ── */
  useEffect(() => {
    if (!profile?.friendRequests?.length) { setFriendRequests([]); return; }
    Promise.all(
      profile.friendRequests.map((fid) =>
        getDoc(doc(db, "users", fid)).then((s) => s.exists() ? { uid: fid, ...s.data() } : null)
      )
    ).then((res) => setFriendRequests(res.filter(Boolean)));
  }, [profile?.friendRequests?.join(",")]);

  /* ── load DM messages when activeFriend changes ── */
  useEffect(() => {
    if (unsub.current) { unsub.current(); unsub.current = null; }
    if (!activeFriend || !myId) { setMessages([]); return; }
    const convoId = dmId(myId, activeFriend.uid);
    const q = query(collection(db, "dms", convoId, "messages"), orderBy("timestamp", "asc"));
    unsub.current = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { if (unsub.current) unsub.current(); };
  }, [activeFriend?.uid, myId]);

  /* ── track last messages per friend ── */
  useEffect(() => {
    if (!myId || !profile?.friends?.length) return;
    const unsubs = profile.friends.map((fid) => {
      const convoId = dmId(myId, fid);
      const q = query(collection(db, "dms", convoId, "messages"), orderBy("timestamp", "desc"));
      return onSnapshot(q, (snap) => {
        const last = snap.docs[0]?.data();
        setLastMessages((prev) => ({ ...prev, [fid]: last || null }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [myId, profile?.friends?.join(",")]);

  /* ── scroll to bottom ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── search users ── */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const q1 = query(collection(db, "users"), where("userId", "==", searchQuery.trim()));
      const q2 = query(collection(db, "users"), where("name", "==", searchQuery.trim()));
      const [r1, r2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const all = new Map();
      [...r1.docs, ...r2.docs].forEach((d) => {
        if (d.id !== myId) all.set(d.id, { uid: d.id, ...d.data() });
      });
      setSearchResults(Array.from(all.values()));
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  /* ── send friend request ── */
  const sendRequest = async (targetId) => {
    if (!myId) return;
    await updateDoc(doc(db, "users", targetId), { friendRequests: arrayUnion(myId) });
    await updateDoc(doc(db, "users", myId), { sentRequests: arrayUnion(targetId) });
  };

  /* ── accept friend request ── */
  const acceptRequest = async (fromId) => {
    await updateDoc(doc(db, "users", myId), {
      friends: arrayUnion(fromId),
      friendRequests: arrayRemove(fromId),
    });
    await updateDoc(doc(db, "users", fromId), {
      friends: arrayUnion(myId),
      sentRequests: arrayRemove(myId),
    });
  };

  /* ── decline request ── */
  const declineRequest = async (fromId) => {
    await updateDoc(doc(db, "users", myId), { friendRequests: arrayRemove(fromId) });
    await updateDoc(doc(db, "users", fromId), { sentRequests: arrayRemove(myId) });
  };

  /* ── remove friend ── */
  const removeFriend = async (friendId) => {
    await updateDoc(doc(db, "users", myId), { friends: arrayRemove(friendId) });
    await updateDoc(doc(db, "users", friendId), { friends: arrayRemove(myId) });
    if (activeFriend?.uid === friendId) setActiveFriend(null);
  };

  /* ── send message ── */
  const handleSend = async () => {
    if (!input.trim() || !activeFriend || !myId) return;
    setSending(true);
    const convoId = dmId(myId, activeFriend.uid);
    try {
      await addDoc(collection(db, "dms", convoId, "messages"), {
        text: input.trim(),
        userId: myId,
        userName: profile?.name || "User",
        userPhoto: profile?.photo || "",
        timestamp: serverTimestamp(),
      });
      setInput("");
      inputRef.current?.focus();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── save profile ── */
  const saveProfile = async () => {
    if (!myId) return;
    setProfileSaving(true);
    await updateDoc(doc(db, "users", myId), {
      name: editName.trim() || profile?.name,
      bio: editBio.trim(),
      userId: editUserId.trim() || profile?.userId,
    });
    setEditingProfile(false);
    setProfileSaving(false);
  };

  /* ── logout ── */
  const handleLogout = async () => {
    await updateDoc(doc(db, "users", myId), { online: false }).catch(() => {});
    await signOut(auth);
    navigate("/login");
  };

  const isFriend = (uid) => profile?.friends?.includes(uid);
  const hasSentRequest = (uid) => profile?.sentRequests?.includes(uid);
  const hasRequest = (uid) => profile?.friendRequests?.includes(uid);
  const reqCount = profile?.friendRequests?.length || 0;

  // Sort friends by last message time
  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const ta = lastMessages[a.uid]?.timestamp?.toDate?.() || 0;
      const tb = lastMessages[b.uid]?.timestamp?.toDate?.() || 0;
      return tb - ta;
    });
  }, [friends, lastMessages]);

  // Group messages by date
  const messageGroups = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const showDate = !prev ||
        fmtDate(msg.timestamp) !== fmtDate(prev.timestamp);
      return { ...msg, showDate };
    });
  }, [messages]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f3ff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 99px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes bounceTyping { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)} }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .friend-row:hover { background: #ede9fe !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 6px 20px rgba(109,40,217,0.45) !important; }
        .send-btn:active:not(:disabled) { transform: scale(0.96); }
        .tab-btn:hover { background: #ede9fe !important; color: #7c3aed !important; }
        .icon-btn:hover { background: #ede9fe !important; }
        .req-btn:hover { filter: brightness(0.92); }
      `}</style>

      <div style={{ display: "flex", height: "100dvh", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#f5f3ff", overflow: "hidden" }}>

        {/* ── Left Sidebar ── */}
        <div style={{
          width: 340, background: "#fff", borderRight: "1.5px solid #ede9fe",
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: "0 18px", height: 64,
            borderBottom: "1.5px solid #ede9fe",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, fontWeight: 800, color: "#fff",
                boxShadow: "0 4px 14px rgba(109,40,217,0.35)",
                fontFamily: "'Sora', sans-serif",
              }}>N</div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.03em" }}>Nexus</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="icon-btn" onClick={() => { setShowAddFriend(true); setTab("friends"); }} style={{
                width: 34, height: 34, borderRadius: 10, background: "transparent",
                border: "none", cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", position: "relative",
              }} title="Add Friend">➕</button>
              <button className="icon-btn" onClick={() => { setShowProfile(true); setEditName(profile?.name || ""); setEditBio(profile?.bio || ""); setEditUserId(profile?.userId || ""); }} style={{
                width: 34, height: 34, borderRadius: 10, background: "transparent",
                border: "none", cursor: "pointer", fontSize: 17,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }} title="Profile">⚙️</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", padding: "10px 14px 0", gap: 4, borderBottom: "1.5px solid #ede9fe" }}>
            {[
              { id: "chats", label: "Chats" },
              { id: "friends", label: "Friends" },
              { id: "requests", label: `Requests${reqCount ? ` (${reqCount})` : ""}` },
            ].map((t) => (
              <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
                padding: "8px 14px", fontSize: 13, fontWeight: 700,
                background: tab === t.id ? "#ede9fe" : "transparent",
                color: tab === t.id ? "#7c3aed" : "#9ca3af",
                border: "none", borderRadius: "10px 10px 0 0",
                cursor: "pointer", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* CHATS TAB */}
            {tab === "chats" && (
              <div>
                {sortedFriends.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}>No conversations yet</div>
                    <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 4 }}>Add friends to start chatting</div>
                    <button onClick={() => { setShowAddFriend(true); setTab("friends"); }} style={{
                      marginTop: 16, padding: "9px 20px", fontSize: 13, fontWeight: 700,
                      background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                      border: "none", borderRadius: 10, cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(109,40,217,0.3)",
                    }}>Add a friend</button>
                  </div>
                ) : sortedFriends.map((friend) => {
                  const last = lastMessages[friend.uid];
                  const isActive = activeFriend?.uid === friend.uid;
                  return (
                    <div key={friend.uid} className="friend-row" onClick={() => setActiveFriend(friend)} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 18px", cursor: "pointer", transition: "all 0.12s",
                      background: isActive ? "#ede9fe" : "transparent",
                      borderLeft: isActive ? "3px solid #8b5cf6" : "3px solid transparent",
                    }}>
                      <Avatar name={friend.name} photo={friend.photo} size={46} online={friend.online} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{friend.name}</span>
                          {last?.timestamp && (
                            <span style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600 }}>{fmtTime(last.timestamp)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {last ? (last.userId === myId ? `You: ${last.text}` : last.text) : (friend.bio || "Say hello! 👋")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FRIENDS TAB */}
            {tab === "friends" && (
              <div style={{ padding: "14px" }}>
                {showAddFriend && (
                  <div style={{
                    background: "#faf8ff", border: "1.5px solid #ede9fe", borderRadius: 14,
                    padding: "14px", marginBottom: 14, animation: "slideIn 0.2s ease",
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#7c3aed", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Find friends
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Name or friend ID…"
                        style={{
                          flex: 1, padding: "9px 14px", borderRadius: 10,
                          border: "1.5px solid #ede9fe", fontSize: 13, fontWeight: 500,
                          fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
                          background: "#fff", color: "#1a1a2e",
                        }}
                      />
                      <button onClick={handleSearch} disabled={searching} style={{
                        padding: "9px 16px", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                        color: "#fff", border: "none", borderRadius: 10, fontSize: 13,
                        fontWeight: 700, cursor: "pointer",
                      }}>{searching ? "…" : "🔍"}</button>
                    </div>
                    {searchResults.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {searchResults.map((u) => (
                          <div key={u.uid} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: "#fff", borderRadius: 12, padding: "10px 12px",
                            border: "1px solid #ede9fe",
                          }}>
                            <Avatar name={u.name} photo={u.photo} size={38} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>ID: {u.userId}</div>
                            </div>
                            {isFriend(u.uid) ? (
                              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>Friends ✓</span>
                            ) : hasRequest(u.uid) ? (
                              <button onClick={() => acceptRequest(u.uid)} style={{
                                padding: "6px 12px", fontSize: 12, fontWeight: 700,
                                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                                border: "none", borderRadius: 8, cursor: "pointer",
                              }}>Accept</button>
                            ) : hasSentRequest(u.uid) ? (
                              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>Requested</span>
                            ) : (
                              <button onClick={() => sendRequest(u.uid)} style={{
                                padding: "6px 12px", fontSize: 12, fontWeight: 700,
                                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                                border: "none", borderRadius: 8, cursor: "pointer",
                              }}>Add</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.length === 0 && searchQuery && !searching && (
                      <div style={{ marginTop: 10, fontSize: 12.5, color: "#9ca3af", textAlign: "center" }}>No users found</div>
                    )}
                  </div>
                )}

                {/* Friends list */}
                <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2 }}>
                  Friends — {friends.length}
                </div>
                {friends.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>
                    No friends yet. Search above! 👆
                  </div>
                ) : friends.map((friend) => (
                  <div key={friend.uid} className="friend-row" style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 10px", borderRadius: 12, cursor: "pointer",
                    transition: "all 0.12s", marginBottom: 4,
                  }}>
                    <Avatar name={friend.name} photo={friend.photo} size={40} online={friend.online} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a2e" }}>{friend.name}</div>
                      <div style={{ fontSize: 11.5, color: "#a78bfa", fontWeight: 600 }}>ID: {friend.userId}</div>
                      {friend.bio && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.bio}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setActiveFriend(friend); setTab("chats"); }} style={{
                        padding: "6px 10px", fontSize: 12, fontWeight: 700,
                        background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                        border: "none", borderRadius: 8, cursor: "pointer",
                      }}>DM</button>
                      <button onClick={() => removeFriend(friend.uid)} style={{
                        padding: "6px 10px", fontSize: 12, fontWeight: 700,
                        background: "#fef2f2", color: "#ef4444",
                        border: "none", borderRadius: 8, cursor: "pointer",
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* REQUESTS TAB */}
            {tab === "requests" && (
              <div style={{ padding: "14px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2 }}>
                  Incoming — {friendRequests.length}
                </div>
                {friendRequests.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af", fontSize: 13 }}>
                    No pending requests 🎉
                  </div>
                ) : friendRequests.map((req) => (
                  <div key={req.uid} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#faf8ff", border: "1.5px solid #ede9fe",
                    borderRadius: 14, padding: "12px 14px", marginBottom: 8,
                    animation: "slideIn 0.2s ease",
                  }}>
                    <Avatar name={req.name} photo={req.photo} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{req.name}</div>
                      <div style={{ fontSize: 11.5, color: "#a78bfa", fontWeight: 600 }}>ID: {req.userId}</div>
                      {req.bio && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{req.bio}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button className="req-btn" onClick={() => acceptRequest(req.uid)} style={{
                        padding: "7px 14px", fontSize: 12.5, fontWeight: 700,
                        background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                        border: "none", borderRadius: 9, cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(109,40,217,0.28)",
                        transition: "filter 0.15s",
                      }}>Accept ✓</button>
                      <button className="req-btn" onClick={() => declineRequest(req.uid)} style={{
                        padding: "7px 14px", fontSize: 12.5, fontWeight: 700,
                        background: "#fef2f2", color: "#ef4444",
                        border: "none", borderRadius: 9, cursor: "pointer",
                        transition: "filter 0.15s",
                      }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User footer */}
          <div style={{ padding: "10px 14px", borderTop: "1.5px solid #ede9fe" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: "#faf8ff", border: "1.5px solid #ede9fe",
              cursor: "pointer",
            }} onClick={() => { setShowProfile(true); setEditName(profile?.name || ""); setEditBio(profile?.bio || ""); setEditUserId(profile?.userId || ""); }}>
              <Avatar name={profile?.name} photo={profile?.photo} size={36} online mine />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || "You"}</div>
                <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>ID: {profile?.userId}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} style={{
                fontSize: 12, fontWeight: 700, color: "#ef4444",
                background: "#fef2f2", border: "none", borderRadius: 8,
                padding: "5px 10px", cursor: "pointer",
              }}>Exit</button>
            </div>
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#faf8ff" }}>
          {!activeFriend ? (
            /* Empty state */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, boxShadow: "0 10px 40px rgba(109,40,217,0.3)",
              }}>💬</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em" }}>
                  Welcome to Nexus
                </div>
                <div style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500, marginTop: 6 }}>
                  Select a conversation or add friends to get started
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowAddFriend(true); setTab("friends"); }} style={{
                  padding: "11px 22px", fontSize: 14, fontWeight: 700, color: "#fff",
                  background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", border: "none", borderRadius: 12,
                  cursor: "pointer", boxShadow: "0 6px 20px rgba(109,40,217,0.3)",
                }}>Add a friend →</button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                height: 64, borderBottom: "1.5px solid #ede9fe",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 20px", background: "#fff",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={activeFriend.name} photo={activeFriend.photo} size={40} online={activeFriend.online} />
                  <div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif" }}>{activeFriend.name}</div>
                    <div style={{ fontSize: 11.5, color: activeFriend.online ? "#22c55e" : "#9ca3af", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {activeFriend.online ? (
                        <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />Active now</>
                      ) : "Offline"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{
                    width: 36, height: 36, borderRadius: 10, background: "#f5f3ff", border: "none",
                    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }} title="Voice call (coming soon)">📞</button>
                  <button style={{
                    width: 36, height: 36, borderRadius: 10, background: "#f5f3ff", border: "none",
                    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }} title="Video call (coming soon)">🎥</button>
                  <button onClick={() => removeFriend(activeFriend.uid)} style={{
                    width: 36, height: 36, borderRadius: 10, background: "#fef2f2", border: "none",
                    fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#ef4444", fontWeight: 700,
                  }} title="Remove friend">✕</button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>
                {/* Convo intro */}
                <div style={{ textAlign: "center", padding: "20px 20px 28px" }}>
                  <Avatar name={activeFriend.name} photo={activeFriend.photo} size={64} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", marginTop: 10 }}>{activeFriend.name}</div>
                  {activeFriend.bio && <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{activeFriend.bio}</div>}
                  <div style={{ fontSize: 12, color: "#c4b5fd", marginTop: 6, fontWeight: 600 }}>This is the beginning of your conversation</div>
                </div>

                {messageGroups.map((msg) => (
                  <Bubble key={msg.id} msg={msg} isMine={msg.userId === myId} showDate={msg.showDate} />
                ))}

                {typing && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 20px" }}>
                    <Avatar name={activeFriend.name} photo={activeFriend.photo} size={26} />
                    <div style={{ background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: "20px 20px 20px 4px", padding: "10px 16px", display: "flex", gap: 4 }}>
                      {[0, 0.18, 0.36].map((d, i) => (
                        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: `bounceTyping 1s ${d}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "10px 16px 16px", flexShrink: 0 }}>
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 10,
                  background: "#fff", border: "1.5px solid #ede9fe",
                  borderRadius: 20, padding: "8px 10px",
                  boxShadow: "0 2px 12px rgba(109,40,217,0.06)",
                  transition: "border-color 0.15s",
                }}
                  onFocus={() => {}} // focus style via CSS would need class
                >
                  {["😊", "🎉", "❤️"].map((em) => (
                    <button key={em} onClick={() => setInput((p) => p + em)} style={{
                      background: "none", border: "none", fontSize: 18, cursor: "pointer",
                      padding: "4px", borderRadius: 6, opacity: 0.65, transition: "opacity 0.1s",
                      flexShrink: 0,
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = "0.65"}
                    >{em}</button>
                  ))}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setTyping(true);
                      clearTimeout(typingTimer.current);
                      typingTimer.current = setTimeout(() => setTyping(false), 2500);
                    }}
                    onKeyDown={handleKey}
                    placeholder={`Message ${activeFriend.name}…`}
                    rows={1}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      resize: "none", color: "#1a1a2e", fontSize: 14.5, lineHeight: 1.5,
                      fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "6px 4px",
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
                    style={{
                      width: 42, height: 42, borderRadius: 14, border: "none",
                      background: sending || !input.trim()
                        ? "#ede9fe"
                        : "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                      cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                      color: sending || !input.trim() ? "#c4b5fd" : "#fff",
                      fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s", flexShrink: 0,
                      boxShadow: sending || !input.trim() ? "none" : "0 4px 14px rgba(109,40,217,0.35)",
                    }}
                  >➤</button>
                </div>
                <div style={{ textAlign: "center", fontSize: 11, color: "#d8b4fe", marginTop: 5, fontWeight: 500 }}>
                  Enter to send · Shift+Enter for newline
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Profile Modal ── */}
      {showProfile && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(109,40,217,0.15)", backdropFilter: "blur(6px)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowProfile(false)}>
          <div style={{
            background: "#fff", borderRadius: 24, padding: 0, width: 420, maxWidth: "95vw",
            boxShadow: "0 30px 80px rgba(109,40,217,0.25)", animation: "modalIn 0.2s ease",
            overflow: "hidden",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", padding: "28px 28px 40px", position: "relative" }}>
              <button onClick={() => setShowProfile(false)} style={{
                position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.2)",
                border: "none", borderRadius: 8, width: 30, height: 30, fontSize: 16,
                color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={profile?.name} photo={profile?.photo} size={72} mine />
                  <div style={{
                    position: "absolute", bottom: 0, right: 0, width: 24, height: 24,
                    background: "#fff", borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 13, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}>✏️</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Sora', sans-serif" }}>{profile?.name}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", fontWeight: 600, marginTop: 2 }}>{profile?.email}</div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "28px 28px 24px", marginTop: -16 }}>
              <div style={{
                background: "#faf8ff", borderRadius: 16, padding: "14px 16px",
                border: "1.5px solid #ede9fe", marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Your Friend ID</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed", fontFamily: "'Sora', sans-serif", letterSpacing: "0.05em" }}>{profile?.userId}</div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>Share this ID so friends can find you</div>
              </div>

              {editingProfile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>Display Name</div>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #ede9fe", fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
                        outline: "none", color: "#1a1a2e", background: "#faf8ff",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>Friend ID (unique)</div>
                    <input value={editUserId} onChange={(e) => setEditUserId(e.target.value)}
                      placeholder="Your custom ID"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #ede9fe", fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
                        outline: "none", color: "#1a1a2e", background: "#faf8ff",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 5 }}>Bio</div>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Something about you…" rows={2}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #ede9fe", fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif",
                        outline: "none", color: "#1a1a2e", resize: "none", background: "#faf8ff",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveProfile} disabled={profileSaving} style={{
                      flex: 1, padding: "11px", fontSize: 14, fontWeight: 700, color: "#fff",
                      background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", border: "none",
                      borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 14px rgba(109,40,217,0.3)",
                    }}>{profileSaving ? "Saving…" : "Save changes"}</button>
                    <button onClick={() => setEditingProfile(false)} style={{
                      padding: "11px 18px", fontSize: 14, fontWeight: 700, color: "#7c3aed",
                      background: "#f5f3ff", border: "none", borderRadius: 12, cursor: "pointer",
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Bio</div>
                    <div style={{ fontSize: 14, color: profile?.bio ? "#374151" : "#9ca3af", fontStyle: profile?.bio ? "normal" : "italic" }}>
                      {profile?.bio || "No bio yet"}
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Friends</div>
                    <div style={{ fontSize: 14, color: "#374151" }}>{friends.length} friend{friends.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditingProfile(true)} style={{
                      flex: 1, padding: "11px", fontSize: 14, fontWeight: 700, color: "#fff",
                      background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", border: "none",
                      borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 14px rgba(109,40,217,0.3)",
                    }}>Edit profile ✏️</button>
                    <button onClick={handleLogout} style={{
                      padding: "11px 18px", fontSize: 14, fontWeight: 700, color: "#ef4444",
                      background: "#fef2f2", border: "none", borderRadius: 12, cursor: "pointer",
                    }}>Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}