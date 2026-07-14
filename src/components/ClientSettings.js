import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { color, font, type, labelStyle, badge } from '../lib/theme'

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  label: { ...labelStyle(false), letterSpacing: '0.1em' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
    fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.primary, outline: 'none',
    boxSizing: 'border-box', background: color.surfaceLight,
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 0', borderBottom: `0.5px solid ${color.borderSubtle}`,
  },
  sectionTitle: {
    fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 4,
  },
  sectionSub: {
    fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 24, lineHeight: 1.5,
  },
}

// ─── Components ───────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange, disabled }) => (
  <div onClick={() => !disabled && onChange(!value)}
    style={{ width: 44, height: 24, borderRadius: 999,
      background: value ? color.forest : color.borderLight, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%', background: color.surfaceLight,
      border: `0.5px solid ${color.borderLight}`, transition: 'left 0.2s ease' }} />
  </div>
)

const SegmentedControl = ({ value, onChange, options }) => (
  <div style={{ display: 'flex', gap: 4, background: color.surfaceSunken, borderRadius: 8, padding: 4 }}>
    {options.map(opt => (
      <button key={opt.value} onClick={() => onChange(opt.value)} type="button"
        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontFamily: font.sans, fontSize: type.body, fontWeight: value === opt.value ? 500 : 400,
          background: value === opt.value ? color.void : 'transparent',
          color: value === opt.value ? color.textOnDark.primary : color.textOnLight.secondary,
          transition: 'all 0.15s ease' }}>
        {opt.label}
      </button>
    ))}
  </div>
)

const SaveButton = ({ saving, saved, onClick }) => (
  <button onClick={onClick} disabled={saving}
    style={{ height: 44, padding: '0 28px', background: saved ? color.forestPressed : saving ? color.textOnLight.faint : color.forest,
      border: 'none', borderRadius: 10, color: color.sage, fontSize: type.body, fontWeight: 500,
      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: font.sans,
      transition: 'background 0.2s ease' }}>
    {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
  </button>
)

// ─── Sections ─────────────────────────────────────────────────────────────────

// Guarded rather than assumed — Intl.supportedValuesOf shipped in every
// evergreen browser years ago (Chrome/Edge 99+, Firefox 119+, Safari 17+),
// but on the off chance it's unavailable this just yields an empty option
// list instead of throwing, so the field still renders (showing whatever
// value is already saved) rather than crashing the whole settings page.
const TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

const SectionProfile = ({ profile, onProfileUpdate }) => {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '')
  const [timezone, setTimezone] = useState(profile?.timezone || '')
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
        timezone: timezone || null,
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
          <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: `0.5px solid ${color.borderSubtle}` }}>Account</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="First and last name" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Email</label>
              <div style={{ ...S.input, background: color.bone, color: color.textOnLight.secondary }}>
                {profile?.email}
              </div>
              <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>
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
          <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: `0.5px solid ${color.borderSubtle}` }}>Personal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Date of birth</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                style={S.input} />
              {age !== null && (
                <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 4, fontFamily: font.mono }}>Age: {age}</div>
              )}
            </div>
            <div>
              <label style={S.label}>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                style={{ ...S.input, cursor: 'pointer' }}>
                <option value="">Not set</option>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8,
            borderBottom: `0.5px solid ${color.borderSubtle}` }}>Address</div>
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

        {error && <div style={{ fontSize: type.body, color: color.alert }}>{error}</div>}
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
              background: color.sage, padding: '6px 12px', borderRadius: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: color.forest }}>{daysUntil}</span>
              <span style={{ fontSize: type.label, color: color.successTextSoft }}>days out</span>
            </div>
          )}
          {daysUntil !== null && daysUntil <= 0 && (
            <div style={{ marginTop: 8, fontSize: type.label, color: color.textOnLight.secondary }}>
              Show date has passed — update it for your next competition.
            </div>
          )}
        </div>
        {error && <div style={{ fontSize: type.body, color: color.alert }}>{error}</div>}
        <div><SaveButton saving={saving} saved={saved} onClick={handleSave} /></div>
      </div>
    </div>
  )
}

const SectionPreferences = ({ profile, onProfileUpdate }) => {
  const [units, setUnits] = useState(profile?.units || 'imperial')
  const [appearance, setAppearance] = useState(profile?.appearance || 'system')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    // App.js's [data-appearance]-setting effect reads its OWN independently-
    // fetched profile state, not this component's — so a saved appearance
    // change won't actually repaint anything until that state re-loads.
    // Reload only when appearance itself changed, so a units-only save keeps
    // the existing lightweight in-place "Saved" UX instead of always
    // reloading.
    const appearanceChanged = appearance !== (profile?.appearance || 'system')
    const { data, error: err } = await supabase
      .from('profiles').update({ units, appearance })
      .eq('id', profile.id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (appearanceChanged) {
      // The reload is genuinely necessary (see comment above), but neither
      // ClientHome's activeTab nor this component's own activeSection is
      // reflected in the URL, so without stashing both a reload always
      // drops back to their hardcoded defaults ('home' / 'profile') instead
      // of leaving the user on Settings -> Preferences.
      try {
        sessionStorage.setItem('purema_restore_tab', 'settings')
        sessionStorage.setItem('purema_restore_settings_section', 'preferences')
      } catch {}
      window.location.reload()
      return
    }
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
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>Units</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
              Weight and measurement display
            </div>
          </div>
          <SegmentedControl value={units} onChange={setUnits}
            options={[{ value: 'imperial', label: 'lbs / in' }, { value: 'metric', label: 'kg / cm' }]} />
        </div>
        <div style={S.row}>
          <div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>Appearance</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
              Light, dark, or match your device
            </div>
          </div>
          <SegmentedControl value={appearance} onChange={setAppearance}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
        </div>
        {error && <div style={{ fontSize: type.body, color: color.alert, marginTop: 12 }}>{error}</div>}
        <div style={{ marginTop: 20 }}>
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </div>
  )
}

// Preferences storage only — flipping one of these toggles just persists
// the coach's/client's choice on their profile row. There's no push/email/
// WhatsApp delivery infrastructure to actually act on these yet.
const NOTIFICATION_PREFS = [
  { key: 'notify_coach_feedback', label: 'Coach feedback received', sub: 'Notify when your coach leaves feedback' },
  { key: 'notify_weekly_reminder', label: 'Weekly check-in reminder', sub: 'Remind me to submit my check-in' },
  { key: 'notify_show_day_countdown', label: 'Show day countdown', sub: 'Daily reminder as competition approaches' },
  { key: 'notify_macro_target_updates', label: 'Macro targets updated', sub: 'When your coach adjusts your targets' },
  { key: 'notify_new_message', label: 'New message from coach', sub: 'When your coach sends you a message' },
]

const SectionNotifications = ({ profile, onProfileUpdate }) => {
  const [savingKey, setSavingKey] = useState(null)
  const [error, setError] = useState(null)

  const handleToggle = async (key, value) => {
    setError(null)
    setSavingKey(key)
    const { data, error: err } = await supabase
      .from('profiles').update({ [key]: value })
      .eq('id', profile.id).select().single()
    setSavingKey(null)
    if (err) { setError(err.message); return }
    if (onProfileUpdate) onProfileUpdate(data)
  }

  return (
    <div>
      <div style={S.sectionTitle}>Notifications</div>
      <div style={S.sectionSub}>
        Choose what you want to be notified about. (Delivery — push, email, or WhatsApp — isn't built yet; this just saves your preference.)
      </div>
      {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 12 }}>{error}</div>}
      <div style={{ maxWidth: 480 }}>
        {NOTIFICATION_PREFS.map(({ key, label, sub }) => (
          <div key={key} style={S.row}>
            <div>
              <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>{label}</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>{sub}</div>
            </div>
            <Toggle value={!!profile?.[key]} onChange={(v) => handleToggle(key, v)} disabled={savingKey === key} />
          </div>
        ))}
      </div>
    </div>
  )
}

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
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>Password</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
              {resetSent
                ? '✓ Reset link sent — check your inbox.'
                : 'Send a reset link to your email address.'}
            </div>
          </div>
          <button onClick={handlePasswordReset} disabled={resetLoading || resetSent}
            style={{ padding: '8px 16px', borderRadius: 8,
              border: `1px solid ${resetSent ? color.forest : color.borderLight}`,
              background: resetSent ? color.sage : color.surfaceLight,
              color: resetSent ? color.forest : color.textOnLight.primary,
              fontSize: type.body, cursor: resetLoading || resetSent ? 'default' : 'pointer',
              fontFamily: font.sans, fontWeight: 500, transition: 'all 0.15s ease',
              whiteSpace: 'nowrap' }}>
            {resetLoading ? 'Sending...' : resetSent ? 'Sent ✓' : 'Change password'}
          </button>
        </div>

        <div style={{ ...S.row, borderBottom: 'none' }}>
          <div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.alert }}>Sign out</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
              Sign out of your account on this device.
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
              background: color.surfaceLight, color: color.alert, fontSize: type.body,
              cursor: 'pointer', fontFamily: font.sans, fontWeight: 500 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}


const SectionBilling = ({ profile }) => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={S.sectionTitle}>Billing & Subscription</div>
        <span style={badge('neutral')}>STRIPE PENDING</span>
      </div>
      <div style={S.sectionSub}>
        Your subscription details, payment method, and billing history.
      </div>

      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Current plan */}
        <div style={{ background: color.void, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono,
                letterSpacing: '0.08em', marginBottom: 6 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 22, fontWeight: 300, color: color.textOnDark.primary, letterSpacing: '-0.01em', fontFamily: font.mono }}>
                —
              </div>
              <div style={{ fontSize: type.body, color: color.textOnDark.faint, marginTop: 4 }}>
                Managed by your coach
              </div>
            </div>
            <span style={badge('success')}>
              ACTIVE
            </span>
          </div>
        </div>

        {/* Next billing */}
        <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Next billing</div>
          <div style={S.row}>
            <div>
              <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>Amount</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>Monthly subscription</div>
            </div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.faint }}>—</div>
          </div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>Next payment date</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>Auto-renews monthly</div>
            </div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.faint }}>—</div>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Payment method</div>
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 28, background: color.bone, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono }}>
                CARD
              </div>
              <div>
                <div style={{ fontSize: type.body, color: color.textOnLight.faint }}>No card on file</div>
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>
                  Connect Stripe to manage payment method
                </div>
              </div>
            </div>
            <button disabled
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                background: color.bone, color: color.textOnLight.faint, fontSize: type.body, cursor: 'not-allowed',
                fontFamily: font.sans }}>
              Update
            </button>
          </div>
        </div>

        {/* Billing history */}
        <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Billing history</div>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>No billing history yet</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>
              Past invoices will appear here once Stripe is connected.
            </div>
          </div>
        </div>

        {/* Cancel */}
        <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 }}>
          <div style={{ ...S.label, marginBottom: 4, color: color.alert }}>Danger zone</div>
          <div style={S.row}>
            <div>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>Cancel subscription</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
                Contact your coach to cancel or pause your subscription.
              </div>
            </div>
            <button disabled
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                background: color.bone, color: color.textOnLight.faint, fontSize: type.body,
                cursor: 'not-allowed', fontFamily: font.sans }}>
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
  // Restores the section an appearance-change reload was stashed from (see
  // SectionPreferences' handleSave) — reads once and clears immediately so
  // a normal, non-reload page load still lands on the real default.
  const [activeSection, setActiveSection] = useState(() => {
    try {
      const restore = sessionStorage.getItem('purema_restore_settings_section')
      if (restore) { sessionStorage.removeItem('purema_restore_settings_section'); return restore }
    } catch {}
    return 'profile'
  })

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 500 }}>

      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `0.5px solid ${color.borderLight}`,
        paddingRight: 0, marginRight: 0 }}>
        <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.faint, letterSpacing: '0.1em',
          fontFamily: font.mono, textTransform: 'uppercase',
          padding: '0 12px', marginBottom: 8 }}>
          Settings
        </div>
        <div style={{ padding: '0 12px', marginBottom: 16 }}>
          <span style={badge('info')}>{profile?.role === 'client' ? 'Client account' : 'Account'}</span>
        </div>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveSection(item.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
              borderRadius: 8, marginBottom: 2, fontFamily: font.sans, fontSize: type.body,
              background: activeSection === item.id ? color.void : 'transparent',
              color: activeSection === item.id ? color.textOnDark.primary : color.textOnLight.secondary,
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
        {activeSection === 'notifications' && (
          <SectionNotifications profile={profile} onProfileUpdate={onProfileUpdate} />
        )}
        {activeSection === 'security' && <SectionSecurity profile={profile} />}
        {activeSection === 'billing' && <SectionBilling profile={profile} />}
      </div>
    </div>
  )
}