import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  color as staticColor, appearance, font, type,
} from '../lib/theme';
import '../styles/purema-responsive.css';

// Pre-auth, unauthenticated public page — same light-forced treatment as
// PublicApply.jsx/Home.js/Pricing.js (see PublicApply.jsx's top-of-file
// comment for the full mechanism/reasoning).
const color = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
}

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: color.bone, display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: font.sans }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
      <Mark size={40} />
      <div style={{ fontSize: type.display, fontWeight: 300, letterSpacing: '-0.03em',
        color: color.textOnLight.primary, marginTop: 12 }}>
        purema<span style={{ color: color.forest }}>.</span>
      </div>
    </div>
    <div className="purema-card" style={{ background: color.surfaceLight,
      borderRadius: 16, border: `0.5px solid ${color.borderLight}`, padding: 32, maxWidth: 440, width: '100%' }}>
      {children}
    </div>
  </div>
)

// Groups slots by calendar date (in the VIEWER's own timezone — the browser
// already resolves this correctly since slot_start is a real timestamptz)
// and labels each with that same timezone's abbreviation, since the
// prospect has no stored timezone preference at this point — see
// PHASE 2 spec: "auto-detect via the browser for display purposes only."
function groupSlotsByLocalDate(slots) {
  const groups = new Map();
  for (const iso of slots) {
    const d = new Date(iso);
    const dateKey = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push({ iso, d });
  }
  return Array.from(groups.entries());
}

const formatSlotTime = (d) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export default function BookIntakeCall({ token }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'light');
  }, []);

  const [status, setStatus] = useState('loading'); // loading | invalid | booked | ready | confirmed
  const [info, setInfo] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: infoRows, error: infoError } = await supabase.rpc('booking_info_for_token', { p_token: token });
      if (cancelled) return;
      const row = Array.isArray(infoRows) ? infoRows[0] : infoRows;
      if (infoError || !row) { setStatus('invalid'); return; }
      setInfo(row);

      if (row.is_booked) { setStatus('booked'); return; }

      const { data: slotRows, error: slotError } = await supabase.rpc('available_slots_for_booking_token', { p_token: token });
      if (cancelled) return;
      if (slotError) { setStatus('invalid'); return; }
      setSlots((slotRows || []).map(r => r.slot_start));
      setStatus('ready');
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  async function handleBook() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const { data, error: bookError } = await supabase.rpc('book_intake_call', {
      p_token: token, p_slot_start: selected,
    });
    setSubmitting(false);
    if (bookError || data !== true) {
      // Most likely: someone else took this exact slot between page load
      // and this click — re-fetch so the picker reflects reality instead
      // of silently retrying against a slot that's already gone.
      setError("That time was just taken — pick another below.");
      const { data: slotRows } = await supabase.rpc('available_slots_for_booking_token', { p_token: token });
      setSlots((slotRows || []).map(r => r.slot_start));
      setSelected(null);
      return;
    }
    setStatus('confirmed');
  }

  if (status === 'loading') {
    return <Shell><p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>Loading...</p></Shell>;
  }

  if (status === 'invalid') {
    return (
      <Shell>
        <p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>
          This scheduling link isn't valid or has expired.
        </p>
      </Shell>
    );
  }

  if (status === 'booked' || status === 'confirmed') {
    const date = status === 'confirmed' ? new Date(selected) : null;
    const existing = info?.booked_date && info?.booked_start_time
      ? new Date(`${info.booked_date}T${info.booked_start_time}`)
      : null;
    return (
      <Shell>
        <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnLight.primary, margin: '0 0 8px' }}>
          You're booked
        </h2>
        <p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>
          {status === 'confirmed' && date
            ? `Your intake call with ${info?.coach_name || 'your coach'} is confirmed for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${formatSlotTime(date)}.`
            : existing
              ? `Your intake call with ${info?.coach_name || 'your coach'} is already scheduled for ${existing.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${formatSlotTime(existing)}.`
              : `Your intake call with ${info?.coach_name || 'your coach'} is already scheduled.`}
        </p>
      </Shell>
    );
  }

  // status === 'ready'
  const groups = groupSlotsByLocalDate(slots);

  return (
    <Shell>
      <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnLight.primary, margin: '0 0 8px' }}>
        Book your intake call
      </h2>
      <p style={{ marginBottom: 24, color: color.textOnLight.secondary, fontSize: type.body }}>
        Pick a 20-minute slot with {info?.coach_name || 'your coach'}. Times are shown in your local timezone.
      </p>

      {groups.length === 0 ? (
        <p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>
          No open times in the next two weeks — check back soon or reach out directly.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 360, overflowY: 'auto', marginBottom: 20 }}>
          {groups.map(([dateLabel, daySlots]) => (
            <div key={dateLabel}>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono,
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                {dateLabel}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daySlots.map(({ iso, d }) => (
                  <button key={iso} type="button" onClick={() => setSelected(iso)}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${selected === iso ? color.forest : color.borderLight}`,
                      background: selected === iso ? color.sage : 'transparent',
                      color: color.textOnLight.primary, fontFamily: font.sans, fontSize: type.label }}>
                    {formatSlotTime(d)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: color.alert, marginBottom: 12, fontSize: type.body }}>{error}</p>}

      <button type="button" onClick={handleBook} disabled={!selected || submitting}
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none',
          background: (!selected || submitting) ? color.borderLight : color.forest,
          color: (!selected || submitting) ? color.textOnLight.faint : color.sage,
          fontWeight: 500, fontSize: type.body, fontFamily: font.sans,
          cursor: (!selected || submitting) ? 'not-allowed' : 'pointer',
        }}>
        {submitting ? 'Booking...' : 'Confirm time'}
      </button>
    </Shell>
  );
}
