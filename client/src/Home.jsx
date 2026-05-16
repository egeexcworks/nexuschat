import { Link } from "react-router-dom";

const conversations = [
  {
    name: "Ava Chen",
    avatar: "AC",
    hue: 340,
    msg: "The redesign looks 🔥 — I love the new bubbles",
    time: "now",
    unread: 2,
    online: true,
  },
  {
    name: "Mika Torres",
    avatar: "MT",
    hue: 200,
    msg: "Can you call later? Need to catch up",
    time: "2m",
    unread: 1,
    online: true,
  },
  {
    name: "Jordan Lee",
    avatar: "JL",
    hue: 150,
    msg: "Sent you the files 📎",
    time: "12m",
    unread: 0,
    online: false,
  },
  {
    name: "Sam Park",
    avatar: "SP",
    hue: 40,
    msg: "See you tonight!",
    time: "1h",
    unread: 0,
    online: true,
  },
];

const bubbles = [
  { from: "Ava", text: "Just sent you the new mockups — what do you think?", mine: false },
  { from: "You", text: "Love it. The purple gradient is perfect 💜", mine: true },
  { from: "Ava", text: "Right?? Let's ship it this week 🚀", mine: false },
];

const features = [
  {
    icon: "👥",
    title: "Add friends",
    desc: "Search anyone by name or username and send a friend request in seconds.",
  },
  {
    icon: "💬",
    title: "Direct messages",
    desc: "Private 1-on-1 conversations that feel personal, fast, and fun.",
  },
  {
    icon: "✨",
    title: "Expressive reactions",
    desc: "React with emoji, reply in threads, or send voice notes.",
  },
  {
    icon: "📞",
    title: "Voice & video",
    desc: "One tap to switch from text to a full HD call with your friend.",
  },
  {
    icon: "🔐",
    title: "End-to-end encrypted",
    desc: "Your messages belong to you — nobody else can read them.",
  },
  {
    icon: "🌍",
    title: "Always in sync",
    desc: "Firebase realtime keeps every device updated instantly.",
  },
];

function Avatar({ initials, hue, size = 44, online = false, ring = false }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(135deg, hsl(${hue},70%,62%), hsl(${hue + 40},65%,52%))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.35,
          color: "#fff",
          boxShadow: ring ? `0 0 0 3px #fff, 0 0 0 5px hsl(${hue},60%,60%)` : "none",
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </div>
      {online && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            top: 2,
            right: 1,
            width: size * 0.27,
            height: size * 0.27,
            background: "#22c55e",
            borderRadius: "50%",
            border: "2.5px solid #fff",
          }}
        />
      )}
    </div>
  );
}

function PhoneMockup() {
  return (
    <div
      style={{
        width: 280,
        borderRadius: 36,
        background: "#fff",
        boxShadow: "0 32px 80px rgba(99,60,180,0.18), 0 8px 24px rgba(0,0,0,0.1)",
        overflow: "hidden",
        border: "8px solid #f0f0f0",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Status bar */}
      <div style={{ background: "#f9f5ff", padding: "10px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>9:41</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 16, height: 8, border: "1.5px solid #1a1a2e", borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", left: 1, top: 1, bottom: 1, width: "75%", background: "#22c55e", borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ background: "#f9f5ff", padding: "8px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em" }}>Nexus</div>
          <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>4 active friends</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔍</div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✏️</div>
        </div>
      </div>

      {/* Active friends row */}
      <div style={{ padding: "8px 14px", background: "#fff", borderBottom: "1px solid #f3f0ff" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Active now</div>
        <div style={{ display: "flex", gap: 12 }}>
          {conversations.filter(c => c.online).map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Avatar initials={c.avatar} hue={c.hue} size={40} online />
              <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Conversations list */}
      <div style={{ background: "#fff" }}>
        {conversations.map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 14px",
            borderBottom: i < conversations.length - 1 ? "1px solid #faf8ff" : "none",
            background: c.unread ? "#fdfbff" : "#fff",
          }}>
            <Avatar initials={c.avatar} hue={c.hue} size={44} online={c.online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 600, color: "#1a1a2e" }}>{c.name}</span>
                <span style={{ fontSize: 10.5, color: c.unread ? "#8b5cf6" : "#9ca3af", fontWeight: c.unread ? 700 : 400 }}>{c.time}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                <span style={{ fontSize: 12, color: c.unread ? "#6b21a8" : "#9ca3af", fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                  {c.msg}
                </span>
                {c.unread > 0 && (
                  <span style={{ background: "#8b5cf6", color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{
        display: "flex", justifyContent: "space-around", padding: "12px 16px 16px",
        borderTop: "1px solid #f3f0ff", background: "#fff",
      }}>
        {["💬", "👥", "📞", "⚙️"].map((icon, i) => (
          <div key={i} style={{
            width: 42, height: 42, borderRadius: "50%",
            background: i === 0 ? "#ede9fe" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>{icon}</div>
        ))}
      </div>
    </div>
  );
}

function ChatBubblePreview() {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 24px 60px rgba(99,60,180,0.14)",
      overflow: "hidden",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      border: "1px solid #f0eaff",
      maxWidth: 360,
    }}>
      {/* Chat header */}
      <div style={{
        background: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
        padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Avatar initials="AC" hue={340} size={38} online />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Ava Chen</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>● Active now</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 17 }}>
          <span style={{ color: "rgba(255,255,255,0.85)", cursor: "pointer" }}>📞</span>
          <span style={{ color: "rgba(255,255,255,0.85)", cursor: "pointer" }}>🎥</span>
        </div>
      </div>
      {/* Messages */}
      <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, background: "#fdfbff" }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: b.mine ? "flex-end" : "flex-start",
            alignItems: "flex-end",
            gap: 6,
          }}>
            {!b.mine && <Avatar initials="AC" hue={340} size={26} />}
            <div style={{
              background: b.mine ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "#f0eaff",
              color: b.mine ? "#fff" : "#2d1b69",
              padding: "9px 13px",
              borderRadius: b.mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              fontSize: 13.5,
              fontWeight: 500,
              maxWidth: 220,
              lineHeight: 1.45,
              boxShadow: b.mine ? "0 4px 16px rgba(109,40,217,0.3)" : "none",
            }}>
              {b.text}
            </div>
          </div>
        ))}
        {/* Typing */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <Avatar initials="AC" hue={340} size={26} />
          <div style={{
            background: "#f0eaff",
            borderRadius: "18px 18px 18px 4px",
            padding: "10px 16px",
            display: "flex", gap: 4, alignItems: "center",
          }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <span key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6", display: "block",
                animation: `bounce 1.2s ${d}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
      {/* Input */}
      <div style={{
        padding: "10px 14px 14px", background: "#fff",
        display: "flex", alignItems: "center", gap: 8,
        borderTop: "1px solid #f0eaff",
      }}>
        <div style={{ flex: 1, background: "#f5f3ff", borderRadius: 99, padding: "9px 14px", fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>
          Aa
        </div>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>
          ➤
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#fff", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
        @keyframes floatA { 0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-14px) rotate(2deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) rotate(2deg)}50%{transform:translateY(-10px) rotate(-1deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        .fade-up { animation: fadeUp 0.55s ease both; }
        .nav-link:hover { color: #7c3aed !important; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(109,40,217,0.4) !important; }
        .cta-secondary:hover { transform: translateY(-2px); background: #f5f3ff !important; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(109,40,217,0.1) !important; }
        .friend-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(109,40,217,0.12) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid #f0eaff",
        padding: "0 5vw",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 14px rgba(109,40,217,0.35)",
          }}>N</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.03em" }}>Nexus</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {["Features", "Why Nexus", "Download"].map(item => (
            <a key={item} className="nav-link" href="#" style={{
              padding: "8px 14px", fontSize: 14, fontWeight: 600, color: "#6b7280",
              textDecoration: "none", borderRadius: 8, transition: "color 0.15s",
              display: "none",
            }}>{item}</a>
          ))}
          <Link to="/login">
            <button style={{
              padding: "8px 18px", fontSize: 14, fontWeight: 700, color: "#7c3aed",
              background: "transparent", border: "1.5px solid #ddd6fe", borderRadius: 10,
              cursor: "pointer", transition: "all 0.15s",
            }}>Log in</button>
          </Link>
          <Link to="/signup">
            <button className="cta-primary" style={{
              padding: "9px 20px", fontSize: 14, fontWeight: 700, color: "#fff",
              background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
              border: "none", borderRadius: 10, cursor: "pointer",
              boxShadow: "0 4px 18px rgba(109,40,217,0.3)",
              transition: "all 0.2s",
            }}>Get started free</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        padding: "80px 5vw 60px",
        background: "linear-gradient(160deg, #faf7ff 0%, #f5f0ff 40%, #fdf8ff 100%)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background blobs */}
        <div style={{ position: "absolute", top: -60, right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.12),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: "5%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.1),transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          {/* Left copy */}
          <div className="fade-up">
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "#ede9fe", borderRadius: 99, padding: "6px 14px",
              fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 28,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite", display: "inline-block" }} />
              Now with friend requests & DMs
            </div>

            <h1 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "clamp(40px, 5vw, 62px)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#1a1a2e",
              marginBottom: 22,
            }}>
              Talk to the<br />
              <span style={{
                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>people you love.</span>
            </h1>

            <p style={{ fontSize: 17, fontWeight: 500, color: "#6b7280", lineHeight: 1.7, maxWidth: 440, marginBottom: 36 }}>
              Nexus brings all your conversations together — friends, family, and teams — in one beautiful, fast, and private space.
            </p>

            {/* Friend search preview */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: "14px 18px",
              boxShadow: "0 4px 24px rgba(109,40,217,0.1)",
              border: "1.5px solid #ede9fe", marginBottom: 32, maxWidth: 400,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 2 }}>Add a friend</div>
                <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Search by name or @username</div>
              </div>
              <button style={{
                marginLeft: "auto", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px",
                fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}>Search</button>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/signup">
                <button className="cta-primary" style={{
                  padding: "14px 28px", fontSize: 15.5, fontWeight: 700, color: "#fff",
                  background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                  border: "none", borderRadius: 14, cursor: "pointer",
                  boxShadow: "0 6px 24px rgba(109,40,217,0.35)", transition: "all 0.2s",
                }}>Create your account →</button>
              </Link>
              <Link to="/login">
                <button className="cta-secondary" style={{
                  padding: "14px 28px", fontSize: 15.5, fontWeight: 700, color: "#7c3aed",
                  background: "#f5f3ff", border: "none", borderRadius: 14, cursor: "pointer",
                  transition: "all 0.2s",
                }}>Open Nexus</button>
              </Link>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28 }}>
              <div style={{ display: "flex" }}>
                {[{ i: "SA", h: 200 }, { i: "MT", h: 340 }, { i: "JL", h: 40 }, { i: "AC", h: 150 }].map((av, i) => (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                    <Avatar initials={av.i} hue={av.h} size={30} ring />
                  </div>
                ))}
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>Join 50,000+ people</span>
                <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}> already chatting</span>
              </div>
            </div>
          </div>

          {/* Right: phone mockup */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
            <div style={{ animation: "floatA 5s ease-in-out infinite", position: "relative", zIndex: 2 }}>
              <PhoneMockup />
            </div>
            {/* Floating chat card */}
            <div style={{
              position: "absolute", right: "-6%", top: "15%",
              animation: "floatB 6s ease-in-out infinite",
              zIndex: 3,
            }}>
              <div style={{
                background: "#fff", borderRadius: 18, padding: "12px 14px",
                boxShadow: "0 8px 32px rgba(109,40,217,0.18)",
                display: "flex", alignItems: "center", gap: 10,
                border: "1px solid #f0eaff", maxWidth: 200,
              }}>
                <Avatar initials="MT" hue={200} size={36} online />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a2e" }}>Mika Torres</div>
                  <div style={{ fontSize: 11.5, color: "#8b5cf6", fontWeight: 600 }}>Typing... ✍️</div>
                </div>
              </div>
            </div>
            {/* Friend request notification */}
            <div style={{
              position: "absolute", left: "-8%", bottom: "20%",
              animation: "floatA 7s 1s ease-in-out infinite",
              zIndex: 3,
            }}>
              <div style={{
                background: "#fff", borderRadius: 18, padding: "12px 14px",
                boxShadow: "0 8px 32px rgba(109,40,217,0.15)",
                border: "1px solid #f0eaff", maxWidth: 210,
              }}>
                <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Friend Request</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Avatar initials="JL" hue={150} size={32} online />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>Jordan Lee</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>wants to connect</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ flex: 1, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Accept</button>
                  <button style={{ flex: 1, background: "#f5f3ff", color: "#7c3aed", border: "none", borderRadius: 8, padding: "6px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Decline</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <div style={{ background: "linear-gradient(90deg,#8b5cf6,#6d28d9)", padding: "0 5vw", overflow: "hidden" }}>
        <div style={{
          display: "flex", gap: 0,
          whiteSpace: "nowrap", padding: "14px 0",
        }}>
          {["Message friends", "Add people you know", "React with emoji", "Voice & video calls", "End-to-end encrypted", "Always in sync",
            "Message friends", "Add people you know", "React with emoji", "Voice & video calls"].map((item, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", padding: "0 24px" }}>
              {i % 2 === 0 ? "●" : "○"} {item}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES GRID */}
      <section style={{ padding: "90px 5vw", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{
              display: "inline-block", background: "#ede9fe", borderRadius: 99,
              padding: "5px 14px", fontSize: 12.5, fontWeight: 700, color: "#7c3aed", marginBottom: 16,
            }}>Everything you need</div>
            <h2 style={{
              fontFamily: "'Sora', sans-serif", fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em", marginBottom: 14,
            }}>Built for real conversations</h2>
            <p style={{ fontSize: 16, color: "#6b7280", fontWeight: 500, maxWidth: 520, margin: "0 auto" }}>
              Everything you need to stay close with the people who matter most.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="feature-card" style={{
                background: i % 3 === 1 ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "#faf8ff",
                border: i % 3 === 1 ? "none" : "1.5px solid #ede9fe",
                borderRadius: 20, padding: "28px 26px",
                transition: "all 0.2s",
                boxShadow: "0 2px 12px rgba(109,40,217,0.06)",
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: i % 3 === 1 ? "#fff" : "#1a1a2e", marginBottom: 8, fontFamily: "'Sora', sans-serif" }}>{f.title}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: i % 3 === 1 ? "rgba(255,255,255,0.8)" : "#6b7280", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW FRIENDS WORK — explainer */}
      <section style={{ padding: "80px 5vw", background: "linear-gradient(160deg,#faf7ff,#f5f0ff)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 70, alignItems: "center" }}>
          <div>
            <div style={{
              display: "inline-block", background: "#ede9fe", borderRadius: 99,
              padding: "5px 14px", fontSize: 12.5, fontWeight: 700, color: "#7c3aed", marginBottom: 20,
            }}>Friends first</div>
            <h2 style={{
              fontFamily: "'Sora', sans-serif", fontSize: "clamp(26px, 3.5vw, 40px)",
              fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em", marginBottom: 20, lineHeight: 1.15,
            }}>Add friends,<br />start talking</h2>
            <p style={{ fontSize: 15.5, fontWeight: 500, color: "#6b7280", lineHeight: 1.7, marginBottom: 32 }}>
              Nexus is built around the people, not the rooms. Search for friends, send a request, and start messaging instantly once they accept.
            </p>

            {[
              ["🔍", "Search by name or @username"],
              ["📨", "Send a friend request"],
              ["✅", "Accept and start chatting"],
              ["📞", "Call, react, share anything"],
            ].map(([icon, step], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: i === 0 ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "#ede9fe",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  flexShrink: 0,
                }}>{icon}</div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{step}</span>
              </div>
            ))}

            <Link to="/signup">
              <button className="cta-primary" style={{
                marginTop: 24, padding: "13px 26px", fontSize: 15, fontWeight: 700, color: "#fff",
                background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                border: "none", borderRadius: 12, cursor: "pointer",
                boxShadow: "0 6px 22px rgba(109,40,217,0.3)", transition: "all 0.2s",
              }}>Find your friends →</button>
            </Link>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ animation: "floatB 6s ease-in-out infinite" }}>
              <ChatBubblePreview />
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section style={{ padding: "80px 5vw", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <h2 style={{
              fontFamily: "'Sora', sans-serif", fontSize: "clamp(26px, 3.5vw, 40px)",
              fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em",
            }}>Made for how you actually use it</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {[
              { icon: "❤️", title: "For friends", sub: "Catch up, share memes, never miss a moment.", hue: 340 },
              { icon: "👨‍👩‍👧", title: "For family", sub: "Group chats that feel warm and personal.", hue: 40 },
              { icon: "💼", title: "For teams", sub: "Stay aligned across projects with focused threads.", hue: 200 },
            ].map((card, i) => (
              <div key={i} className="friend-card" style={{
                borderRadius: 22, padding: "30px 26px",
                background: `linear-gradient(145deg, hsl(${card.hue},90%,97%), hsl(${card.hue},85%,94%))`,
                border: `1.5px solid hsl(${card.hue},70%,88%)`,
                transition: "all 0.2s",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{card.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora', sans-serif", marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 14.5, fontWeight: 500, color: "#6b7280", lineHeight: 1.6 }}>{card.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "80px 5vw 100px", background: "linear-gradient(160deg,#f5f0ff,#ede9fe)" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto", textAlign: "center",
          background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
          borderRadius: 28, padding: "56px 40px",
          boxShadow: "0 20px 60px rgba(109,40,217,0.35)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 42, marginBottom: 16 }}>💬</div>
            <h2 style={{
              fontFamily: "'Sora', sans-serif", fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16, lineHeight: 1.15,
            }}>Ready to connect?</h2>
            <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginBottom: 36, maxWidth: 460, margin: "0 auto 36px" }}>
              Join Nexus and have your first conversation in under a minute. It's free, forever.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/signup">
                <button style={{
                  padding: "14px 32px", fontSize: 15.5, fontWeight: 700, color: "#7c3aed",
                  background: "#fff", border: "none", borderRadius: 14, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)", transition: "all 0.2s",
                }}>Create free account</button>
              </Link>
              <Link to="/login">
                <button style={{
                  padding: "14px 32px", fontSize: 15.5, fontWeight: 700, color: "#fff",
                  background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)",
                  borderRadius: 14, cursor: "pointer", transition: "all 0.2s",
                }}>Sign in</button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#1a1a2e", padding: "40px 5vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>N</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Sora', sans-serif" }}>Nexus</span>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>© 2025 Nexus. Made with ❤️ for real conversations.</div>
        <div style={{ display: "flex", gap: 18 }}>
          {["Privacy", "Terms", "Contact"].map(item => (
            <a key={item} href="#" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textDecoration: "none" }}>{item}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}