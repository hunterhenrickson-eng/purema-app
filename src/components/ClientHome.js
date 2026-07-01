import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CheckInForm from './CheckInForm'
import ClientSettings from './ClientSettings'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ─── Icons ────────────────────────────────────────────────────────────────────

const GearIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name?.split(' ')[0] || 'Athlete'}.`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysAgo(ts) {
  const days = Math.floor((new Date() - new Date(ts)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '0.5px solid #E8E8E8',
    padding: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: 500,
    color: '#888',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: 'DM Mono, monospace',
  },
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

const StatPill = ({ label, value, unit }) => {
  if (!value) return null
  return (
    <div style={{ background: '#F5F2ED', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 500, color: '#0D0D0D', letterSpacing: '-0.01em' }}>
        {value}<span style={{ fontSize: 12, color: '#888', marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ─── Macro bar ────────────────────────────────────────────────────────────────

const MacroBar = ({ label, value, unit, color }) => {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 52, fontSize: 11, color: '#888', fontFamily: 'DM Mono, monospace',
        letterSpacing: '0.04em', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: '#F0EDE8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '100%', background: color, borderRadius: 999, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', minWidth: 52, textAlign: 'right' }}>
        {value}{unit}
      </div>
    </div>
  )
}

// ─── Home tab ─────────────────────────────────────────────────────────────────

const TabHome = ({ profile, checkins, onGoToCheckin }) => {
  const latest = checkins[0]
  const nextWeek = latest ? latest.week_number + 1 : 1
  const hasCheckedInThisWeek = latest &&
    (new Date() - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24) < 7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting + CTA row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 300, color: '#0D0D0D', letterSpacing: '-0.02em' }}>
            {greeting(profile?.full_name)}
          </div>
          <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
            {latest
              ? `Last check-in was ${daysAgo(latest.submitted_at)}`
              : 'Welcome — submit your first check-in to get started.'}
          </div>
        </div>

        {!hasCheckedInThisWeek ? (
          <button onClick={onGoToCheckin}
            style={{ height: 44, padding: '0 24px', background: '#0F6E56', border: 'none',
              borderRadius: 10, color: '#EAF3DE', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            Submit Week {nextWeek} Check-in <span>→</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EAF3DE',
            padding: '10px 16px', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0D3D1F' }}>
                Week {latest.week_number} submitted
              </div>
              <div style={{ fontSize: 11, color: '#3A7A4A' }}>Waiting for feedback</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Latest check-in stats */}
        {latest && (
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 14 }}>
              Week {latest.week_number} · {formatDate(latest.submitted_at)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <StatPill label="WEIGHT" value={latest.weight} unit="lbs" />
              <StatPill label="WAIST" value={latest.waist} unit="in" />
              <StatPill label="SLEEP" value={latest.sleep} unit="hrs" />
            </div>
            {(latest.calories || latest.protein || latest.carbs || latest.fats) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...S.label, marginBottom: 2 }}>Nutrition this week</div>
                <MacroBar label="KCAL" value={latest.calories} unit="" color="#0F6E56" />
                <MacroBar label="PRO" value={latest.protein} unit="g" color="#0F6E56" />
                <MacroBar label="CARB" value={latest.carbs} unit="g" color="#BA7517" />
                <MacroBar label="FAT" value={latest.fats} unit="g" color="#888" />
              </div>
            )}
          </div>
        )}

        {/* Coach feedback */}
        {latest?.coach_feedback ? (
          <div style={{ ...S.card, background: '#0D0D0D', border: 'none' }}>
            <div style={{ ...S.label, color: '#0F6E56', marginBottom: 12 }}>
              Coach feedback — Week {latest.week_number}
            </div>
            <div style={{ fontSize: 14, color: '#F5F2ED', lineHeight: 1.8 }}>
              {latest.coach_feedback}
            </div>
          </div>
        ) : latest && (
          <div style={{ ...S.card, background: '#1A1A1A', border: 'none',
            display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#BA7517', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F2ED' }}>
                Feedback pending
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                Your coach hasn't reviewed Week {latest.week_number} yet.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Check-in history */}
      {checkins.length > 1 && (
        <div>
          <div style={{ ...S.label, marginBottom: 12 }}>History</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {checkins.slice(1, 7).map(c => (
              <div key={c.id} style={{ ...S.card, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '14px 16px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>
                    Week {c.week_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {formatDate(c.submitted_at)}{c.weight ? ` · ${c.weight} lbs` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 10,
                  background: c.coach_feedback ? '#EAF3DE' : '#F0EDE8',
                  color: c.coach_feedback ? '#1A5C0A' : '#888',
                  padding: '3px 10px', borderRadius: 999,
                  fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
                  {c.coach_feedback ? 'Reviewed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {checkins.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#0D0D0D', marginBottom: 6 }}>
            No check-ins yet
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            Submit your first check-in to get started.
          </div>
          <button onClick={onGoToCheckin}
            style={{ height: 44, padding: '0 24px', background: '#0F6E56', border: 'none',
              borderRadius: 10, color: '#EAF3DE', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Submit Week 1 Check-in
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

const TabCheckIn = ({ onSuccess }) => (
  <div>
    <CheckInForm onSuccess={onSuccess} />
  </div>
)

// ─── Main shell ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'checkin', label: 'Check-in' },
]

export default function ClientHome() {
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, checkinsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('check_ins').select('*').eq('client_id', user.id)
          .order('submitted_at', { ascending: false }),
      ])

      if (!profileRes.error) setProfile(profileRes.data)
      if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile)
  }

  // Called by CheckInForm on successful submission
  const handleCheckInSuccess = () => {
    // Reload check-ins so home tab reflects the new submission immediately
    async function reload() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('check_ins').select('*').eq('client_id', user.id)
        .order('submitted_at', { ascending: false })
      if (data) setCheckins(data)
    }
    reload()
    setActiveTab('home')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12,
        color: '#0F6E56', letterSpacing: '0.1em' }}>LOADING...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top nav */}
      <div style={{ background: '#0D0D0D', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mark size={20} />
            <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: '#F5F2ED' }}>
              purema<span style={{ color: '#0F6E56' }}>.</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {profile?.full_name && (
              <span style={{ fontSize: 13, color: '#AAA', fontFamily: 'DM Sans' }}>
                {profile.full_name}
              </span>
            )}
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 11, color: '#AAA', fontFamily: 'DM Mono, monospace',
                letterSpacing: '0.1em', background: 'transparent', border: '1px solid #333',
                cursor: 'pointer', padding: '5px 12px', borderRadius: 6 }}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '10px 18px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  color: activeTab === tab.id ? '#F5F2ED' : '#AAA',
                  borderBottom: activeTab === tab.id ? '2px solid #0F6E56' : '2px solid transparent',
                  transition: 'color 0.15s ease, border-bottom 0.15s ease' }}>
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => setActiveTab('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              border: 'none', background: activeTab === 'settings' ? '#1A1A1A' : 'transparent',
              color: activeTab === 'settings' ? '#F5F2ED' : '#666',
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease',
              marginBottom: 2 }}>
            <GearIcon />
            <span style={{ fontSize: 12, fontFamily: 'DM Sans' }}>Settings</span>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 80px' }}>
        {activeTab === 'home' && (
          <TabHome
            profile={profile}
            checkins={checkins}
            onGoToCheckin={() => setActiveTab('checkin')}
          />
        )}
        {activeTab === 'checkin' && (
          <TabCheckIn onSuccess={handleCheckInSuccess} />
        )}
        {activeTab === 'settings' && (
          <ClientSettings profile={profile} onProfileUpdate={handleProfileUpdate} />
        )}
      </div>
    </div>
  )
}