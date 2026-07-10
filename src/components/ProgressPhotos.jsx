import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  color as staticColor, appearance, font, type, labelStyleAppearance as labelStyle, badge,
} from '../lib/theme'

// Embedded in ClientHome.js/CoachDashboard.js — both appearance-toggle-aware
// screens — so this shadows `color` the same way those two do, rather than
// shipping a light-only card inside an otherwise dark-mode-correct dashboard.
const color = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
}

const ANGLES = ['front', 'back', 'side']
const SIGNED_URL_TTL = 3600

const S = {
  card: {
    background: color.surfaceLight,
    borderRadius: 14,
    border: `0.5px solid ${color.borderLight}`,
    padding: 20,
  },
  label: { ...labelStyle(), letterSpacing: '0.1em' },
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// clientId/coachId: whose gallery this is. checkins: that client's check-ins
// (already loaded by the parent either way — ClientHome loads its own,
// CoachDashboard already loads every client's for the dashboard generally),
// sorted most-recent-first, used only to offer "link to my most recent
// check-in" on upload and to resolve week numbers for display. canUpload:
// false renders a read-only gallery (the coach view) with no upload control
// at all, per spec. onJumpToWeek: optional callback for the "Week N" badge
// click-through, wired by ClientHome's Progress tab to switch to Feedback
// and highlight that week — not implemented here, since what "jump" means
// is a parent-level navigation concern, not this component's.
export default function ProgressPhotoGallery({ clientId, coachId, checkins, canUpload, onJumpToWeek }) {
  const [photos, setPhotos] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [error, setError] = useState(null)

  const [file, setFile] = useState(null)
  const [angle, setAngle] = useState('')
  const [linkToCheckin, setLinkToCheckin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const latestCheckin = checkins && checkins.length > 0 ? checkins[0] : null

  const loadPhotos = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('client_id', clientId)
      .order('taken_at', { ascending: false })
    if (err) { setError(err.message); return }
    setPhotos(data || [])
  }, [clientId])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  // The bucket is private — photo_url stores the storage object path, not a
  // renderable URL, so every load needs a fresh batch of signed URLs (a
  // persisted signed URL would eventually expire and break).
  useEffect(() => {
    if (!photos || photos.length === 0) { setSignedUrls({}); return }
    let cancelled = false
    async function sign() {
      const { data } = await supabase.storage
        .from('progress-photos')
        .createSignedUrls(photos.map(p => p.photo_url), SIGNED_URL_TTL)
      if (cancelled) return
      const map = {}
      ;(data || []).forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl })
      setSignedUrls(map)
    }
    sign()
    return () => { cancelled = true }
  }, [photos])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setUploadError(null)

    // Path convention {client_id}/... matches the storage RLS policies
    // exactly (they extract the first folder segment as the owning client).
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadErr } = await supabase.storage.from('progress-photos').upload(path, file)
    if (uploadErr) { setUploadError(uploadErr.message); setUploading(false); return }

    const { error: insertErr } = await supabase.from('progress_photos').insert({
      client_id: clientId,
      coach_id: coachId,
      check_in_id: linkToCheckin && latestCheckin ? latestCheckin.id : null,
      photo_url: path,
      angle: angle || null,
      taken_at: new Date().toISOString(),
    })
    setUploading(false)
    if (insertErr) { setUploadError(insertErr.message); return }

    setFile(null)
    setAngle('')
    setLinkToCheckin(false)
    loadPhotos()
  }

  const checkinById = (id) => (checkins || []).find(c => c.id === id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canUpload && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 12 }}>Add a photo</div>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.primary }} />

            <div>
              <label style={{ ...labelStyle(), display: 'block', marginBottom: 6 }}>Angle (optional)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {ANGLES.map(a => (
                  <button key={a} type="button" onClick={() => setAngle(angle === a ? '' : a)}
                    style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${angle === a ? color.forest : color.borderLight}`,
                      background: angle === a ? color.sage : 'transparent',
                      color: angle === a ? color.forest : color.textOnLight.secondary,
                      fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
                      textTransform: 'capitalize' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {latestCheckin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontSize: type.body, color: color.textOnLight.secondary }}>
                <input type="checkbox" checked={linkToCheckin}
                  onChange={e => setLinkToCheckin(e.target.checked)} />
                Link to my most recent check-in (Week {latestCheckin.week_number})
              </label>
            )}

            {uploadError && <div style={{ fontSize: type.body, color: color.alert }}>{uploadError}</div>}

            <button type="submit" disabled={!file || uploading}
              style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: 'none',
                background: (!file || uploading) ? color.textOnLight.faint : color.forest, color: color.sage,
                fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                cursor: (!file || uploading) ? 'not-allowed' : 'pointer' }}>
              {uploading ? 'Uploading...' : 'Upload photo'}
            </button>
          </form>
        </div>
      )}

      {error && <div style={{ fontSize: type.body, color: color.alert }}>{error}</div>}

      {!photos ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Loading...</div>
      ) : photos.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
          {canUpload ? 'No photos yet — add your first one above.' : 'No progress photos yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {photos.map(p => {
            const linkedCheckin = p.check_in_id ? checkinById(p.check_in_id) : null
            return (
              <div key={p.id} style={{ ...S.card, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden',
                  aspectRatio: '3 / 4', background: color.bone }}>
                  {signedUrls[p.photo_url] ? (
                    <img src={signedUrls[p.photo_url]} alt={p.angle || 'Progress photo'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: type.label, color: color.textOnLight.faint }}>
                      Loading...
                    </div>
                  )}
                  {p.angle && (
                    <span style={{ position: 'absolute', top: 6, left: 6, ...badge('neutral'), textTransform: 'capitalize' }}>
                      {p.angle}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
                    {formatDate(p.taken_at)}
                  </span>
                  {linkedCheckin && (
                    <button onClick={() => onJumpToWeek && onJumpToWeek(linkedCheckin.week_number)}
                      disabled={!onJumpToWeek}
                      style={{ ...badge('info'), border: 'none', cursor: onJumpToWeek ? 'pointer' : 'default' }}>
                      Week {linkedCheckin.week_number}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
