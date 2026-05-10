import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const recentFriends = [
  { i: "AC", h: 340, n: "Ava" },
  { i: "MT", h: 200, n: "Mika" },
  { i: "JL", h: 150, n: "Jordan" },
  { i: "SP", h: 40,  n: "Sam" },
];

function Avatar({ initials, hue, size = 40, online = false }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},68%,60%), hsl(${hue + 40},62%,50%))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.35, color: "#fff",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>{initials}</div>
      {online && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.26, height: size * 0.26,
          background: "#22c55e", borderRadius: "50%",
          border: "2.5px solid #fff",
        }} />
      )}
    </div>
  );
}

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Failed to login");
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const u        = result.user;
      await setDoc(doc(db, "users", u.uid), {
        uid: u.uid,
        username: u.displayName || u.email?.split("@")[0],
        email: u.email, photoURL: u.photoURL, lastLoginAt: new Date(),
      }, { merge: true });
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Failed to sign in with Google");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: "linear-gradient(145deg,#f9f5ff 0%,#f1eaff 50%,#fdf8ff 100%)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes floatA{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .inp:focus{border-color:#8b5cf6!important;box-shadow:0 0 0 3px rgba(139,92,246,0.15)!important;outline:none;}
        .inp::placeholder{color:#c4b5fd;}
        .google-btn:hover{background:#f8f5ff!important;transform:translateY(-1px);box-shadow:0 6px 20px rgba(109,40,217,0.12)!important;}
        .submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 32px rgba(109,40,217,0.38)!important;}
        .submit-btn:disabled{opacity:0.7;cursor:not-allowed;}
      `}</style>

      {/* LEFT PANEL */}
      <div style={{
        flex: "0 0 46%", background: "linear-gradient(145deg,#8b5cf6 0%,#6d28d9 60%,#5b21b6 100%)",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 52px", position: "relative", overflow: "hidden",
      }} className="hidden lg:flex lg:flex-col">
        {/* Decorative blobs */}
        <div style={{ position:"absolute", top:-60, right:-60, width:260, height:260, borderRadius:"50%", background:"rgba(255,255,255,0.07)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-40, left:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"40%", right:"-5%", width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

        {/* Logo */}
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none" }}>
          <div style={{
            width:44, height:44, borderRadius:13,
            background:"rgba(255,255,255,0.2)",
            backdropFilter:"blur(10px)",
            border:"1.5px solid rgba(255,255,255,0.3)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:800, color:"#fff",
            fontFamily:"'Sora', sans-serif",
          }}>N</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'Sora', sans-serif", letterSpacing:"-0.02em" }}>Nexus</div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.6)", fontWeight:500 }}>welcome back</div>
          </div>
        </Link>

        {/* Hero copy */}
        <div style={{ position:"relative", zIndex:2 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:7,
            background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)",
            borderRadius:99, border:"1px solid rgba(255,255,255,0.25)",
            padding:"6px 14px", fontSize:12.5, fontWeight:700, color:"#fff", marginBottom:24,
          }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block", animation:"pulse 2s infinite" }} />
            Your friends are online
          </div>
          <h1 style={{
            fontFamily:"'Sora', sans-serif", fontSize:42,
            fontWeight:800, color:"#fff", lineHeight:1.1,
            letterSpacing:"-0.04em", marginBottom:18,
          }}>
            Pick up where<br />you left off.
          </h1>
          <p style={{ fontSize:15.5, color:"rgba(255,255,255,0.75)", fontWeight:500, lineHeight:1.7, maxWidth:340 }}>
            Sign back in and jump straight into your conversations — no waiting, no loading.
          </p>
        </div>

        {/* Active friends preview */}
        <div style={{
          background:"rgba(255,255,255,0.12)", backdropFilter:"blur(12px)",
          border:"1px solid rgba(255,255,255,0.2)",
          borderRadius:20, padding:"18px 20px",
          animation:"floatA 5s ease-in-out infinite",
          position:"relative", zIndex:2,
        }}>
          <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.6)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>
            Active friends
          </div>
          <div style={{ display:"flex", gap:14 }}>
            {recentFriends.map((f, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                <Avatar initials={f.i} hue={f.h} size={42} online />
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:600 }}>{f.n}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, height:1, background:"rgba(255,255,255,0.15)" }} />
          <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, background:"rgba(255,255,255,0.1)", borderRadius:99, padding:"8px 14px", fontSize:12.5, color:"rgba(255,255,255,0.5)" }}>
              Message Ava...
            </div>
            <div style={{
              width:34, height:34, borderRadius:"50%",
              background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.3)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
            }}>➤</div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div style={{
        flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"40px 28px",
      }}>
        <div style={{ width:"100%", maxWidth:420, animation:"fadeUp 0.45s ease both" }}>

          {/* Mobile logo */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }} className="lg:hidden">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'Sora',sans-serif" }}>N</div>
              <span style={{ fontSize:20, fontWeight:800, color:"#1a1a2e", fontFamily:"'Sora',sans-serif" }}>Nexus</span>
            </div>
          </div>

          {/* Header */}
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:30, fontWeight:800, color:"#1a1a2e", letterSpacing:"-0.03em", marginBottom:8 }}>
              Welcome back 👋
            </h2>
            <p style={{ fontSize:15, color:"#6b7280", fontWeight:500 }}>
              Sign in to continue to your conversations.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background:"#fef2f2", border:"1.5px solid #fecaca",
              borderRadius:12, padding:"12px 16px", marginBottom:20,
              display:"flex", alignItems:"center", gap:10,
              fontSize:13.5, color:"#dc2626", fontWeight:600,
            }}>
              <span style={{ fontSize:16 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google */}
          <button
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:12, padding:"12px 20px",
              background:"#fff", border:"1.5px solid #e5e7eb",
              borderRadius:14, cursor:"pointer",
              fontSize:15, fontWeight:700, color:"#1a1a2e",
              boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
              transition:"all 0.18s", marginBottom:22,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22 }}>
            <div style={{ flex:1, height:1, background:"#e9e3ff" }} />
            <span style={{ fontSize:13, color:"#a78bfa", fontWeight:600 }}>or</span>
            <div style={{ flex:1, height:1, background:"#e9e3ff" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13.5, fontWeight:700, color:"#374151", marginBottom:7 }}>
                Email address
              </label>
              <input
                className="inp"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width:"100%", padding:"12px 16px",
                  background:"#faf7ff", border:"1.5px solid #ddd6fe",
                  borderRadius:12, fontSize:14.5, color:"#1a1a2e",
                  fontFamily:"'Plus Jakarta Sans', sans-serif",
                  transition:"border-color 0.15s, box-shadow 0.15s",
                }}
              />
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <label style={{ fontSize:13.5, fontWeight:700, color:"#374151" }}>Password</label>
                <a href="#" style={{ fontSize:12.5, color:"#8b5cf6", fontWeight:700, textDecoration:"none" }}>Forgot password?</a>
              </div>
              <div style={{ position:"relative" }}>
                <input
                  className="inp"
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width:"100%", padding:"12px 48px 12px 16px",
                    background:"#faf7ff", border:"1.5px solid #ddd6fe",
                    borderRadius:12, fontSize:14.5, color:"#1a1a2e",
                    fontFamily:"'Plus Jakarta Sans', sans-serif",
                    transition:"border-color 0.15s, box-shadow 0.15s",
                  }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:0.5,
                }}>{showPw ? "🙈" : "👁️"}</button>
              </div>
            </div>

            <button
              className="submit-btn"
              type="submit"
              disabled={loading}
              style={{
                width:"100%", padding:"13px 0",
                background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",
                border:"none", borderRadius:14,
                fontSize:15.5, fontWeight:700, color:"#fff",
                cursor:"pointer",
                boxShadow:"0 6px 22px rgba(109,40,217,0.3)",
                transition:"all 0.2s",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                fontFamily:"'Plus Jakarta Sans', sans-serif",
              }}
            >
              {loading ? (
                <>
                  <span style={{ width:18, height:18, border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
                  Signing in…
                </>
              ) : "Sign in →"}
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign:"center", fontSize:14, color:"#6b7280", marginTop:24, fontWeight:500 }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color:"#7c3aed", fontWeight:700, textDecoration:"none" }}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}