import { useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  label: {
    fontSize: 10, fontWeight: 500, color: '#888', letterSpacing: '0.1em',
    textTransform: 'uppercase', fontFamily: 'DM Mono, monospace',
    display: 'block', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E8E8E8',
    fontFamily: 'DM Sans', fontSize: 14, color: '#0D0D0D', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 0', borderBottom: '0.5px solid #F5F5F5',
  },
  sectionTitle: {
    fontSize: 16, fontWeight: 500, color: '#0D0D0D', marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.5,
  },
}

// ─── Components ───────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)}
    style={{ width: 44, height: 24, borderRadius: 999,
      background: value ? '#0F6E56' : '#E8E8E8', cursor: 'pointer',
      position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%', background: '#fff',
      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </div>
)

const SegmentedControl = ({ value, onChange, options }) => (
  <div style={{ display: 'flex', gap: 4, background: '#F0EDE8', borderRadius: 8, padding: 4 }}>
    {options.map(opt => (
      <button key={opt.value} onClick={() => onChange(opt.value)} type="button"
        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontFamily: 'DM Sans', fontSize: 13, fontWeight: value === opt.value ? 500 : 400,
          background: value === opt.value ? '#0D0D0D' : 'transparent',
          color: value === opt.value ? '#F5F2ED' : '#888',
          transition: 'all 0.15s ease' }}>
        {opt.label}
      </button>
    ))}
  </div>
)

const SaveButton = ({ saving, saved, onClick }) => (
  <button onClick={onClick} disabled={saving}
    style={{ height: 44, padding: '0 28px', background: saved ? '#0D5E49' : saving ? '#AAA' : '#0F6E56',
      border: 'none', borderRadius: 10, color: '#EAF3DE', fontSize: 14, fontWeight: 500,
      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans',
      transition: 'background 0.2s ease' }}>
    {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
  </button>
)

// ─── Sections ─────────────────────────────────────────────────────────────────

const SectionProfile = ({ profile, onProfileUpdate }) => {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [addressLine1, setAddressLine1] = useState(profile?.address_line1 || '')
  const [addressLine2, setAddressLine2] = useState(profile?.address_line2 || '')
  const [city, setCity] = useState(profile?.city || '')
  const [stateProvince, setStateProvince] = useState(profile?.state_province || '')
  const [postalCode, setPostalCode] = useState(profile?.postal_code || '')
  const [country, setCountry] = useState(profile?.country || 'US')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const age = dateOfBirth
    ? Math.floor((new Date() - new Date(dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles').update({
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
        phone: phone || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        state_province: stateProvince || null,
        postal_code: postalCode || null,
        country: country || null,
      })
      .eq('id', profile.id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    if (onProfileUpdate) onProfileUpdate(data)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div style={S.sectionTitle}>Profile</div>
      <div style={S.sectionSub}>Your personal information. Shared with your coach only.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>

        {/* Account */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0D0D0D', fontFamily: 'DM Mono, monospace',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: '0.5px solid #F0F0F0' }}>Account</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="First and last name" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Email</label>
              <div style={{ ...S.input, background: '#F5F2ED', color: '#888' }}>
                {profile?.email}
              </div>
              <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
                Contact your coach to update your email.
              </div>
            </div>
            <div>
              <label style={S.label}>Phone number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000" style={S.input} type="tel" />
            </div>
          </div>
        </div>

        {/* Personal */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0D0D0D', fontFamily: 'DM Mono, monospace',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: '0.5px solid #F0F0F0' }}>Personal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Date of birth</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                style={S.input} />
              {age !== null && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Age: {age}</div>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0D0D0D', fontFamily: 'DM Mono, monospace',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: '0.5px solid #F0F0F0' }}>Address</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Address line 1</label>
              <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)}
                placeholder="Street address" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Address line 2</label>
              <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, unit (optional)" style={S.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>City</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="City" style={S.input} />
              </div>
              <div>
                <label style={S.label}>State / Province</label>
                <input value={stateProvince} onChange={e => setStateProvince(e.target.value)}
                  placeholder="State" style={S.input} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Postal code</label>
                <input value={postalCode} onChange={e => setPostalCode(e.target.value)}
                  placeholder="ZIP / Postal code" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Country</label>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  style={{ ...S.input, cursor: 'pointer' }}>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                  <option value="IE">Ireland</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: 13, color: '#E24B4A' }}>{error}</div>}
        <div><SaveButton saving={saving} saved={saved} onClick={handleSave} /></div>
      </div>
    </div>
  )
}

const SectionCompetition = ({ profile, onProfileUpdate }) => {
  const [showDate, setShowDate] = useState(profile?.show_date || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles').update({ show_date: showDate || null })
      .eq('id', profile.id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    if (onProfileUpdate) onProfileUpdate(data)
    setTimeout(() => setSaved(false), 2500)
  }

  const daysUntil = showDate
    ? Math.ceil((new Date(showDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      <div style={S.sectionTitle}>Competition</div>
      <div style={S.sectionSub}>Set your show date to unlock your countdown timer and peak week planning.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <div>
          <label style={S.label}>Show date</label>
          <input type="date" value={showDate} onChange={e => setShowDate(e.target.value)}
            style={S.input} />
          {daysUntil !== null && daysUntil > 0 && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#EAF3DE', padding: '6px 12px', borderRadius: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: '#0F6E56' }}>{daysUntil}</span>
              <span style={{ fontSize: 12, color: '#3A7A4A' }}>days out</span>
            </div>
          )}
          {daysUntil !== null && daysUntil <= 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              Show date has passed — update it for your next competition.
            </div>
          )}
        </div>
        {error && <div style={{ fontSize: 13, color: '#E24B4A' }}>{error}</div>}
        <div><SaveButton saving={saving} saved={saved} onClick={handleSave} /></div>
      </div>
    </div>
  )
}

const SectionPreferences = ({ profile, onProfileUpdate }) => {
  const [units, setUnits] = useState(profile?.units || 'imperial')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles').update({ units })
      .eq('id', profile.id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    if (onProfileUpdate) onProfileUpdate(data)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div style={S.sectionTitle}>Preferences</div>
      <div style={S.sectionSub}>Customize how data is displayed across the app.</div>
      <div style={{ maxWidth: 480 }}>
        <div style={S.row}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>Units</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Weight and measurement display
            </div>
          </div>
          <SegmentedControl value={units} onChange={setUnits}
            options={[{ value: 'imperial', label: 'lbs / in' }, { value: 'metric', label: 'kg / cm' }]} />
        </div>
        {error && <div style={{ fontSize: 13, color: '#E24B4A', marginTop: 12 }}>{error}</div>}
        <div style={{ marginTop: 20 }}>
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </div>
  )
}

const SectionNotifications = () => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <div style={S.sectionTitle}>Notifications</div>
      <span style={{ fontSize: 10, background: '#F0EDE8', color: '#888', padding: '3px 10px',
        borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>COMING SOON</span>
    </div>
    <div style={S.sectionSub}>
      Push, email, and WhatsApp notifications will be available once the mobile app is live.
    </div>
    <div style={{ maxWidth: 480, opacity: 0.4 }}>
      {[
        { label: 'Coach feedback received', sub: 'Notify when your coach leaves feedback' },
        { label: 'Weekly check-in reminder', sub: 'Remind me to submit my check-in' },
        { label: 'Show day countdown', sub: 'Daily reminder as competition approaches' },
        { label: 'Macro targets updated', sub: 'When your coach adjusts your targets' },
      ].map(({ label, sub }) => (
        <div key={label} style={S.row}>
          <div>
            <div style={{ fontSize: 14, color: '#0D0D0D' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{sub}</div>
          </div>
          <Toggle value={false} onChange={() => {}} />
        </div>
      ))}
    </div>
  </div>
)

const SectionSecurity = ({ profile }) => {
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handlePasswordReset = async () => {
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    setResetLoading(false)
    setResetSent(true)
    setTimeout(() => setResetSent(false), 5000)
  }

  return (
    <div>
      <div style={S.sectionTitle}>Security</div>
      <div style={S.sectionSub}>Manage your password and account access.</div>
      <div style={{ maxWidth: 480 }}>
        <div style={S.row}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>Password</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {resetSent
                ? '✓ Reset link sent — check your inbox.'
                : 'Send a reset link to your email address.'}
            </div>
          </div>
          <button onClick={handlePasswordReset} disabled={resetLoading || resetSent}
            style={{ padding: '8px 16px', borderRadius: 8,
              border: `1px solid ${resetSent ? '#0F6E56' : '#E8E8E8'}`,
              background: resetSent ? '#EAF3DE' : '#fff',
              color: resetSent ? '#0F6E56' : '#0D0D0D',
              fontSize: 13, cursor: resetLoading || resetSent ? 'default' : 'pointer',
              fontFamily: 'DM Sans', fontWeight: 500, transition: 'all 0.15s ease',
              whiteSpace: 'nowrap' }}>
            {resetLoading ? 'Sending...' : resetSent ? 'Sent ✓' : 'Change password'}
          </button>
        </div>

        <div style={{ ...S.row, borderBottom: 'none' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#E24B4A' }}>Sign out</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Sign out of your account on this device.
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E8E8E8',
              background: '#fff', color: '#E24B4A', fontSize: 13,
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}


const SectionBilling = ({ profile }) => {
  // Stubbed — will be powered by Stripe once connected
  const billingData = {
    plan: 'Active',
    amount: null,
    nextBilling: null,
    cardLast4: null,
    history: [],
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={S.sectionTitle}>Billing & Subscription</div>
        <span style={{ fontSize: 10, background: '#F0EDE8', color: '#888', padding: '3px 10px',
          borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>STRIPE PENDING</span>
      </div>
      <div style={S.sectionSub}>
        Your subscription details, payment method, and billing history.
      </div>

      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Current plan */}
        <div style={{ background: '#0D0D0D', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#0F6E56', fontFamily: 'DM Mono, monospace',
                letterSpacing: '0.08em', marginBottom: 6 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 22, fontWeight: 300, color: '#F5F2ED', letterSpacing: '-0.01em' }}>
                —
              </div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                Managed by your coach
              </div>
            </div>
            <span style={{ fontSize: 10, background: '#EAF3DE', color: '#1A5C0A',
              padding: '4px 12px', borderRadius: 999, fontFamily: 'DM Mono, monospace',
              fontWeight: 500 }}>
              ACTIVE
            </span>
          </div>
        </div>

        {/* Next billing */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Next billing</div>
          <div style={S.row}>
            <div>
              <div style={{ fontSize: 14, color: '#0D0D0D' }}>Amount</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Monthly subscription</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#AAA' }}>—</div>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: 14, color: '#0D0D0D' }}>Next payment date</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Auto-renews monthly</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#AAA' }}>—</div>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Payment method</div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 28, background: '#F5F2ED', borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#888', fontFamily: 'DM Mono, monospace' }}>
                CARD
              </div>
              <div>
                <div style={{ fontSize: 14, color: '#AAA' }}>No card on file</div>
                <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>
                  Connect Stripe to manage payment method
                </div>
              </div>
            </div>
            <button disabled
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E8E8E8',
                background: '#F5F2ED', color: '#AAA', fontSize: 13, cursor: 'not-allowed',
                fontFamily: 'DM Sans' }}>
              Update
            </button>
          </div>
        </div>

        {/* Billing history */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Billing history</div>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: '#888' }}>No billing history yet</div>
            <div style={{ fontSize: 12, color: '#AAA', marginTop: 4 }}>
              Past invoices will appear here once Stripe is connected.
            </div>
          </div>
        </div>

        {/* Cancel */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 4, color: '#E24B4A' }}>Danger zone</div>
          <div style={S.row}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>Cancel subscription</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Contact your coach to cancel or pause your subscription.
              </div>
            </div>
            <button disabled
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E8E8E8',
                background: '#F5F2ED', color: '#AAA', fontSize: 13,
                cursor: 'not-allowed', fontFamily: 'DM Sans' }}>
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'competition', label: 'Competition', icon: '🏆' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'billing', label: 'Billing', icon: '💳' },
]

// ─── Main Settings shell ──────────────────────────────────────────────────────

export default function ClientSettings({ profile, onProfileUpdate }) {
  const [activeSection, setActiveSection] = useState('profile')

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 500 }}>

      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '0.5px solid #E8E8E8',
        paddingRight: 0, marginRight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: '#AAA', letterSpacing: '0.1em',
          fontFamily: 'DM Mono, monospace', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: 8 }}>
          Settings
        </div>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveSection(item.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
              borderRadius: 8, marginBottom: 2, fontFamily: 'DM Sans', fontSize: 14,
              background: activeSection === item.id ? '#0D0D0D' : 'transparent',
              color: activeSection === item.id ? '#F5F2ED' : '#555',
              fontWeight: activeSection === item.id ? 500 : 400,
              transition: 'all 0.15s ease' }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, paddingLeft: 40 }}>
        {activeSection === 'profile' && (
          <SectionProfile profile={profile} onProfileUpdate={onProfileUpdate} />
        )}
        {activeSection === 'competition' && (
          <SectionCompetition profile={profile} onProfileUpdate={onProfileUpdate} />
        )}
        {activeSection === 'preferences' && (
          <SectionPreferences profile={profile} onProfileUpdate={onProfileUpdate} />
        )}
        {activeSection === 'notifications' && <SectionNotifications />}
        {activeSection === 'security' && <SectionSecurity profile={profile} />}
        {activeSection === 'billing' && <SectionBilling profile={profile} />}
      </div>
    </div>
  )
}