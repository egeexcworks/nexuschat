import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

function StrengthBar({ password }) {
  const score = !password ? 0
    : password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : password.length >= 6 ? 2 : 1;
  const colors = ["#e5e7eb", "#f87171", "#fbbf24", "#22c55e"];
  const labels = ["", "Weak", "Fair", "Strong"];
  return password ? (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:7 }}>
      <div style={{ display:"flex", gap:3, flex:1 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            flex:1, height:3, borderRadius:99,
            background: i <= score ? colors[score] : "#e9e3ff",
            transition:"background 0.25s",
          }} />
        ))}
      </div>
      <span style={{ fontSize:11.5, fontWeight:700, color: colors[score] }}>{labels[score]}</span>
    </div>
  ) : null;
}

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, username, email, createdAt: new Date(),
      });
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Failed to create account");
    } finally { setLoading(false); }
  };

  const handleGoogleSignup = async () => {
    setError(""); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const u        = result.user;
      await setDoc(doc(db, "users", u.uid), {
        uid: u.uid,
        username: u.displayName || u.email?.split("@")[0],
        email: u.email, photoURL: u.photoURL, createdAt: new Date(),
      }, { merge: true });
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Failed to continue with Google");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight:"100vh", display:"flex",
      fontFamily:"'Plus Jakarta Sans', sans-serif",
      background:"linear-gradient(145deg,#f9f5ff 0%,#f1eaff 50%,#fdf8ff 100%)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes floatB{0%,100%{transform:translateY(0) rotate(1deg)}50%{transform:translateY(-10px) rotate(-1deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .inp:focus{border-color:#8b5cf6!important;box-shadow:0 0 0 3px rgba(139,92,246,0.15)!important;outline:none;}
        .inp::placeholder{color:#c4b5fd;}
        .google-btn:hover{background:#f8f5ff!important;transform:translateY(-1px);box-shadow:0 6px 20px rgba(109,40,217,0.12)!important;}
        .submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 32px rgba(109,40,217,0.38)!important;}
        .submit-btn:disabled{opacity:0.7;cursor:not-allowed;}
      `}</style>

      {/* LEFT PANEL */}
      <div style={{
        flex:"0 0 46%",
        background:"linear-gradient(145deg,#7c3aed 0%,#6d28d9 55%,#5b21b6 100%)",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"48px 52px", position:"relative", overflow:"hidden",
      }} className="hidden lg:flex lg:flex-col">
        <div style={{ position:"absolute", top:-70, left:-70, width:280, height:280, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-50, right:-50, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }} />

        {/* Logo */}
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none" }}>
          <div style={{
            width:44, height:44, borderRadius:13,
            background:"rgba(255,255,255,0.2)", backdropFilter:"blur(10px)",
            border:"1.5px solid rgba(255,255,255,0.3)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:800, color:"#fff", fontFamily:"'Sora',sans-serif",
          }}>N</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'Sora',sans-serif", letterSpacing:"-0.02em" }}>Nexus</div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.55)", fontWeight:500 }}>new account</div>
          </div>
        </Link>

        {/* Copy */}
        <div style={{ position:"relative", zIndex:2 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:7,
            background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)",
            borderRadius:99, border:"1px solid rgba(255,255,255,0.25)",
            padding:"6px 14px", fontSize:12.5, fontWeight:700, color:"#fff", marginBottom:24,
          }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block", animation:"pulse 2s infinite" }} />
            Free forever
          </div>
          <h1 style={{
            fontFamily:"'Sora', sans-serif", fontSize:42, fontWeight:800,
            color:"#fff", lineHeight:1.1, letterSpacing:"-0.04em", marginBottom:18,
          }}>
            Meet your<br />people here.
          </h1>
          <p style={{ fontSize:15.5, color:"rgba(255,255,255,0.72)", fontWeight:500, lineHeight:1.7, maxWidth:340 }}>
            Create an account in seconds and start messaging friends, family, and teammates instantly.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, position:"relative", zIndex:2 }}>
          {[
            ["👥", "Add friends by name or @username"],
            ["💬", "Private DMs, fully encrypted"],
            ["📞", "Voice & video calls, one tap"],
            ["🔔", "Instant notifications, realtime sync"],
          ].map(([icon, label], i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:12,
              background:"rgba(255,255,255,0.1)", backdropFilter:"blur(8px)",
              border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:12, padding:"11px 16px",
              animation:`floatB ${5 + i * 0.5}s ${i * 0.3}s ease-in-out infinite`,
            }}>
              <span style={{ fontSize:20 }}>{icon}</span>
              <span style={{ fontSize:13.5, fontWeight:600, color:"rgba(255,255,255,0.88)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 28px" }}>
        <div style={{ width:"100%", maxWidth:420, animation:"fadeUp 0.45s ease both" }}>

          {/* Mobile logo */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }} className="lg:hidden">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'Sora',sans-serif" }}>N</div>
              <span style={{ fontSize:20, fontWeight:800, color:"#1a1a2e", fontFamily:"'Sora',sans-serif" }}>Nexus</span>
            </div>
          </div>

          <div style={{ marginBottom:28 }}>
            <h2 style={{ fontFamily:"'Sora', sans-serif", fontSize:30, fontWeight:800, color:"#1a1a2e", letterSpacing:"-0.03em", marginBottom:8 }}>
              Create your account ✨
            </h2>
            <p style={{ fontSize:15, color:"#6b7280", fontWeight:500 }}>
              Join Nexus and start chatting in under a minute.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:12,
              padding:"12px 16px", marginBottom:20,
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
            onClick={handleGoogleSignup}
            disabled={loading}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:12, padding:"12px 20px",
              background:"#fff", border:"1.5px solid #e5e7eb",
              borderRadius:14, cursor:"pointer",
              fontSize:15, fontWeight:700, color:"#1a1a2e",
              boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
              transition:"all 0.18s", marginBottom:22,
              fontFamily:"'Plus Jakarta Sans', sans-serif",
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
          <form onSubmit={handleSignup}>
            {/* Username */}
            <div style={{ marginBottom:15 }}>
              <label style={{ display:"block", fontSize:13.5, fontWeight:700, color:"#374151", marginBottom:7 }}>
                Username
              </label>
              <div style={{ position:"relative" }}>
                <span style={{
                  position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
                  fontSize:15, opacity:0.45,
                }}>👤</span>
                <input
                  className="inp"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  style={{
                    width:"100%", padding:"12px 16px 12px 42px",
                    background:"#faf7ff", border:"1.5px solid #ddd6fe",
                    borderRadius:12, fontSize:14.5, color:"#1a1a2e",
                    fontFamily:"'Plus Jakarta Sans', sans-serif",
                    transition:"all 0.15s",
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom:15 }}>
              <label style={{ display:"block", fontSize:13.5, fontWeight:700, color:"#374151", marginBottom:7 }}>
                Email address
              </label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, opacity:0.45 }}>✉️</span>
                <input
                  className="inp"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width:"100%", padding:"12px 16px 12px 42px",
                    background:"#faf7ff", border:"1.5px solid #ddd6fe",
                    borderRadius:12, fontSize:14.5, color:"#1a1a2e",
                    fontFamily:"'Plus Jakarta Sans', sans-serif",
                    transition:"all 0.15s",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom:26 }}>
              <label style={{ display:"block", fontSize:13.5, fontWeight:700, color:"#374151", marginBottom:7 }}>
                Password
              </label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, opacity:0.45 }}>🔒</span>
                <input
                  className="inp"
                  type={showPw ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width:"100%", padding:"12px 48px 12px 42px",
                    background:"#faf7ff", border:"1.5px solid #ddd6fe",
                    borderRadius:12, fontSize:14.5, color:"#1a1a2e",
                    fontFamily:"'Plus Jakarta Sans', sans-serif",
                    transition:"all 0.15s",
                  }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:0.5,
                }}>{showPw ? "🙈" : "👁️"}</button>
              </div>
              <StrengthBar password={password} />
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
                  Creating account…
                </>
              ) : "Create account →"}
            </button>

            <p style={{ fontSize:11.5, color:"#9ca3af", textAlign:"center", marginTop:14, fontWeight:500, lineHeight:1.6 }}>
              By signing up you agree to our{" "}
              <a href="#" style={{ color:"#8b5cf6", textDecoration:"none", fontWeight:700 }}>Terms</a>
              {" "}and{" "}
              <a href="#" style={{ color:"#8b5cf6", textDecoration:"none", fontWeight:700 }}>Privacy Policy</a>.
            </p>
          </form>

          <p style={{ textAlign:"center", fontSize:14, color:"#6b7280", marginTop:22, fontWeight:500 }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color:"#7c3aed", fontWeight:700, textDecoration:"none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}