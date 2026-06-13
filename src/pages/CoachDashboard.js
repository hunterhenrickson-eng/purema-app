import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CheckInDetail = ({ checkin, onClose, onFeedbackSave }) => {
  const [feedback, setFeedback] = useState(checkin.coach_feedback || "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveFeedback = async () => {
    setSaving(true)
    const { error } = await supabase
      .from("check_ins")
      .update({ coach_feedback: feedback })
      .eq("id", checkin.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      onFeedbackSave(checkin.id, feedback)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const Row = ({ label, value, unit }) => value ? (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: "0.5px solid #F0F0F0" }}>
      <span style={{ fontSize: 13, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}>{value}{unit ? " " + unit : ""}</span>
    </div>
  ) : null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#F5F2ED", borderRadius: 16, width: "100%",
        maxWidth: 560, maxHeight: "88vh", overflowY: "auto", margin: "0 20px" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ position: "sticky", top: 0, background: "#0D0D0D", padding: "16px 20px",
          borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "#F5F2ED" }}>{checkin.client_name}</div>
            <div style={{ fontSize: 11, color: "#0F6E56", fontFamily: "DM Mono, monospace", marginTop: 2 }}>
              WEEK {checkin.week_number}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#1A1A1A", border: "none", color: "#888",
            width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>x</button>
        </div>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "0.5px solid #E8E8E8" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 12 }}>Body metrics</div>
            <Row label="Weight" value={checkin.weight} unit="lbs" />
            <Row label="Waist" value={checkin.waist} unit="in" />
            <Row label="Chest" value={checkin.chest} unit="in" />
            <Row label="Hips" value={checkin.hips} unit="in" />
            <Row label="Arms" value={checkin.arms} unit="in" />
            <Row label="Thighs" value={checkin.thighs} unit="in" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "0.5px solid #E8E8E8" }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 12 }}>Nutrition</div>
              <Row label="Calories" value={checkin.calories} unit="kcal" />
              <Row label="Protein" value={checkin.protein} unit="g" />
              <Row label="Carbs" value={checkin.carbs} unit="g" />
              <Row label="Fats" value={checkin.fats} unit="g" />
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "0.5px solid #E8E8E8" }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 12 }}>Lifestyle</div>
              <Row label="Sleep" value={checkin.sleep} unit="hrs" />
              <Row label="Water" value={checkin.water} unit="L" />
              <Row label="Steps" value={checkin.steps} />
              <Row label="Stress" value={checkin.stress ? checkin.stress + " / 10" : null} />
              <Row label="Adherence" value={checkin.adherence ? checkin.adherence + " / 10" : null} />
            </div>
          </div>

          {checkin.notes && (
            <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 12, padding: 16, border: "0.5px solid #E8E8E8" }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 8 }}>Client notes</div>
              <div style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>{checkin.notes}</div>
            </div>
          )}

          <div style={{ gridColumn: "1 / -1", background: "#0D0D0D", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: "#0F6E56", letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 8 }}>Coach feedback</div>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Leave feedback for this client..."
              rows={4}
              style={{ width: "100%", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8,
                color: "#F5F2ED", padding: "10px 12px", fontSize: 14, fontFamily: "DM Sans, sans-serif",
                lineHeight: 1.6, resize: "none", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={saveFeedback} disabled={saving}
              style={{ marginTop: 8, width: "100%", height: 44, background: saved ? "#0D5E49" : "#0F6E56",
                border: "none", borderRadius: 8, color: "#EAF3DE", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              {saving ? "Saving..." : saved ? "Saved!" : "Save feedback"}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function CoachDashboard() {
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchCheckins()
  }, [])

  const fetchCheckins = async () => {
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .order("submitted_at", { ascending: false })
    if (!error) setCheckins(data)
    setLoading(false)
  }

  const handleFeedbackSave = (id, feedback) => {
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, coach_feedback: feedback } : c))
  }

  const pending = checkins.filter(c => !c.coach_feedback).length
  const reviewed = checkins.filter(c => c.coach_feedback).length

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F2ED" }}>

      <div style={{ background: "#0D0D0D", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark size={22} />
            <span style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.03em", color: "#F5F2ED" }}>
              purema<span style={{ color: "#0F6E56" }}>.</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: "#F5F2ED" }}>{checkins.length}</div>
              <div style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: pending > 0 ? "#BA7517" : "#555" }}>{pending}</div>
              <div style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pending</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: "#0F6E56" }}>{reviewed}</div>
              <div style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Reviewed</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px 80px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, color: "#888",
            fontSize: 13, fontFamily: "DM Mono, monospace" }}>Loading check-ins...</div>
        )}

        {!loading && checkins.length === 0 && (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#0D0D0D", marginBottom: 8 }}>No check-ins yet</div>
            <div style={{ fontSize: 14, color: "#888" }}>Check-ins will appear here when clients submit them.</div>
          </div>
        )}

        {!loading && checkins.length > 0 && (
          <>
            {pending > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#888", letterSpacing: "0.1em",
                  textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 14 }}>
                  Needs review — {pending}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10, marginBottom: 32 }}>
                  {checkins.filter(c => !c.coach_feedback).map(checkin => (
                    <div key={checkin.id} onClick={() => setSelected(checkin)}
                      style={{ background: "#fff", borderRadius: 12, padding: 18,
                        border: "0.5px solid #E8E8E8", cursor: "pointer", display: "flex",
                        alignItems: "center", gap: 14, transition: "box-shadow 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FAEEDA",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 500, color: "#BA7517", flexShrink: 0 }}>
                        {checkin.client_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "#0D0D0D" }}>{checkin.client_name}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                          Week {checkin.week_number} · {formatDate(checkin.submitted_at)}
                          {checkin.weight ? " · " + checkin.weight + " lbs" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, background: "#FAEEDA", color: "#633806",
                          padding: "3px 10px", borderRadius: 999, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>
                          Pending
                        </span>
                        <span style={{ color: "#CCC", fontSize: 18 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reviewed > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#888", letterSpacing: "0.1em",
                  textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 14 }}>
                  Reviewed — {reviewed}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                  {checkins.filter(c => c.coach_feedback).map(checkin => (
                    <div key={checkin.id} onClick={() => setSelected(checkin)}
                      style={{ background: "#fff", borderRadius: 12, padding: 18,
                        border: "0.5px solid #E8E8E8", cursor: "pointer", display: "flex",
                        alignItems: "center", gap: 14, opacity: 0.65, transition: "box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.opacity = "1" }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.opacity = "0.65" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EAF3DE",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 500, color: "#0F6E56", flexShrink: 0 }}>
                        {checkin.client_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "#0D0D0D" }}>{checkin.client_name}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                          Week {checkin.week_number} · {formatDate(checkin.submitted_at)}
                          {checkin.weight ? " · " + checkin.weight + " lbs" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, background: "#EAF3DE", color: "#1A5C0A",
                          padding: "3px 10px", borderRadius: 999, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>
                          Done
                        </span>
                        <span style={{ color: "#CCC", fontSize: 18 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <CheckInDetail
          checkin={selected}
          onClose={() => setSelected(null)}
          onFeedbackSave={handleFeedbackSave}
        />
      )}
    </div>
  )
}
