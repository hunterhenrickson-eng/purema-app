import { useState } from 'react'
import { supabase } from '../lib/supabase'

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function Auth() {
  const [mode, setMode] = useState("login")
  const [role, setRole] = useState("coach")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleSignup = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{ id: data.user.id, role, full_name: name, email }])
      if (profileError) { setError(profileError.message); setLoading(false); return }
      setMessage("Account created! You can now sign in.")
      setMode("login")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <Mark size={28} />
          <span style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.03em", color: "#F5F2ED" }}>
            purema<span style={{ color: "#0F6E56" }}>.</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#555", fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>
          BUILT FOR COACHES WHO BUILD ATHLETES
        </div>
      </div>

      <div style={{ background: "#111", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400,
        border: "0.5px solid #1A1A1A" }}>

        <div style={{ display: "flex", gap: 8, marginBottom: 28, background: "#0D0D0D",
          borderRadius: 10, padding: 4 }}>
          <button onClick={() => setMode("login")}
            style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: "DM Sans, sans-serif",
              background: mode === "login" ? "#0F6E56" : "transparent",
              color: mode === "login" ? "#EAF3DE" : "#555" }}>
            Sign in
          </button>
          <button onClick={() => setMode("signup")}
            style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: "DM Sans, sans-serif",
              background: mode === "signup" ? "#0F6E56" : "transparent",
              color: mode === "signup" ? "#EAF3DE" : "#555" }}>
            Create account
          </button>
        </div>

        {mode === "signup" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>I am a</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRole("coach")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, fontWeight: 500, fontFamily: "DM Sans, sans-serif",
                    background: role === "coach" ? "#0F6E56" : "#1A1A1A",
                    color: role === "coach" ? "#EAF3DE" : "#555",
                    border: role === "coach" ? "none" : "1px solid #2A2A2A" }}>
                  Coach
                </button>
                <button onClick={() => setRole("client")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, fontWeight: 500, fontFamily: "DM Sans, sans-serif",
                    background: role === "client" ? "#0F6E56" : "#1A1A1A",
                    color: role === "client" ? "#EAF3DE" : "#555",
                    border: role === "client" ? "none" : "1px solid #2A2A2A" }}>
                  Athlete
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>Full name</div>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
                  color: "#F5F2ED", padding: "11px 14px", fontSize: 14, fontFamily: "DM Sans, sans-serif",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
              color: "#F5F2ED", padding: "11px 14px", fontSize: 14, fontFamily: "DM Sans, sans-serif",
              outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>Password</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
              color: "#F5F2ED", padding: "11px 14px", fontSize: 14, fontFamily: "DM Sans, sans-serif",
              outline: "none", boxSizing: "border-box" }} />
        </div>

        {error && (
          <div style={{ background: "#1A0808", border: "1px solid #3A1010", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#E24B4A" }}>{error}</div>
          </div>
        )}

        {message && (
          <div style={{ background: "#0A1A0A", border: "1px solid #1A3A1A", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#0F6E56" }}>{message}</div>
          </div>
        )}

        <button
          onClick={mode === "login" ? handleLogin : handleSignup}
          disabled={loading}
          style={{ width: "100%", height: 48, background: loading ? "#555" : "#0F6E56",
            border: "none", borderRadius: 10, color: "#EAF3DE", fontSize: 14, fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "DM Sans, sans-serif" }}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "#333", fontFamily: "DM Mono, monospace",
        textAlign: "center", lineHeight: 1.6 }}>
        purema.app · Built for coaches who build athletes.
      </div>
    </div>
  )
}
