import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { color, font, type, labelStyle } from '../lib/theme'

const S = {
  label: { ...labelStyle(false), letterSpacing: '0.1em' },
}

// Purema fields a CSV column can map to — "skip" leaves a column unused.
const PUREMA_FIELDS = [
  { key: 'skip', label: "Don't import" },
  { key: 'date', label: 'Date' },
  { key: 'weight', label: 'Weight (lbs)' },
  { key: 'waist', label: 'Waist (in)' },
  { key: 'sleep', label: 'Sleep (hrs)' },
  { key: 'calories', label: 'Calories' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'fats', label: 'Fats (g)' },
  { key: 'notes', label: 'Notes' },
]

// Best-effort header -> field guess, e.g. "Body Weight (lbs)" -> weight.
// Coaches always confirm/override this before anything imports.
const GUESS_PATTERNS = {
  date: /date|day/i,
  weight: /weight|bodyweight|bw\b/i,
  waist: /waist/i,
  sleep: /sleep/i,
  calories: /cal(ories)?|kcal/i,
  protein: /protein/i,
  carbs: /carb/i,
  fats: /fat/i,
  notes: /note|comment/i,
}

function guessField(header) {
  const entry = Object.entries(GUESS_PATTERNS).find(([, pattern]) => pattern.test(header))
  return entry ? entry[0] : 'skip'
}

// Accepts common spreadsheet date formats (M/D/YYYY, YYYY-MM-DD, etc.) and
// returns a local Y-M-D key, or null if unparseable. Avoids letting
// new Date(str) silently produce "Invalid Date" objects downstream.
function parseDateKey(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NUMERIC_FIELDS = ['weight', 'waist', 'sleep', 'calories', 'protein', 'carbs', 'fats']

const FieldSelect = ({ value, onChange }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
      fontFamily: font.sans, fontSize: type.label, color: color.textOnLight.primary, background: color.surfaceLight }}>
    {PUREMA_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
  </select>
)

export default function ImportHistory({ client, coachId, existingCheckins, onClose, onImported }) {
  const [step, setStep] = useState('upload') // upload | mapping | review | done
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const handleFile = (file) => {
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || []
        if (fields.length === 0 || results.data.length === 0) {
          setError('Could not find any rows in that file.')
          return
        }
        setFileName(file.name)
        setHeaders(fields)
        setRows(results.data)
        setMapping(Object.fromEntries(fields.map(h => [h, guessField(h)])))
        setStep('mapping')
      },
      error: (err) => setError(err.message),
    })
  }

  // Build the validated, sequentially-numbered import set from the raw rows
  // + current column mapping. Recomputed on the fly rather than stored, so
  // changing a mapping in the review step (going Back) always reflects the
  // latest choices.
  const buildPlan = () => {
    const dateHeader = Object.keys(mapping).find(h => mapping[h] === 'date')
    if (!dateHeader) return { ready: [], skipped: rows.map(r => ({ row: r, reason: 'No column mapped to Date' })) }

    const existingWeekNumbers = new Set(existingCheckins.map(c => c.week_number))

    const parsed = rows.map(row => {
      const dateKey = parseDateKey(row[dateHeader])
      if (!dateKey) return { row, reason: 'Unparseable date' }
      const values = {}
      Object.entries(mapping).forEach(([header, field]) => {
        if (field === 'skip' || field === 'date') return
        const raw = row[header]
        if (raw === undefined || raw === '' || raw === null) return
        values[field] = NUMERIC_FIELDS.includes(field) ? parseFloat(raw) : raw
      })
      return { row, dateKey, values }
    })

    const withDates = parsed.filter(p => p.dateKey)
    const badDates = parsed.filter(p => !p.dateKey).map(p => ({ row: p.row, reason: 'Unparseable date' }))

    withDates.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))

    const ready = []
    const skipped = [...badDates]
    withDates.forEach((p, i) => {
      const weekNumber = i + 1
      if (existingWeekNumbers.has(weekNumber)) {
        skipped.push({ row: p.row, reason: `Week ${weekNumber} already exists for this client` })
        return
      }
      ready.push({
        client_id: client.id,
        coach_id: coachId,
        client_name: client.full_name || client.email,
        // Noon, not midnight — check_ins.submitted_at is a timestamptz, so a
        // naive midnight string can shift to the prior calendar day once
        // Postgres round-trips it through UTC and the client re-renders it
        // in a negative-offset local timezone. Noon keeps the intended date
        // stable across realistic timezones.
        submitted_at: `${p.dateKey}T12:00:00`,
        week_number: weekNumber,
        weight: p.values.weight ?? null,
        waist: p.values.waist ?? null,
        sleep: p.values.sleep ?? null,
        calories: p.values.calories ?? null,
        protein: p.values.protein ?? null,
        carbs: p.values.carbs ?? null,
        fats: p.values.fats ?? null,
        notes: p.values.notes ?? null,
        coach_feedback: null,
        imported_backfill: true,
      })
    })

    return { ready, skipped }
  }

  const confirmImport = async (plan) => {
    setImporting(true)
    setError(null)
    const { data, error: insertError } = await supabase.from('check_ins').insert(plan.ready).select()
    setImporting(false)
    if (insertError) { setError(insertError.message); return }
    setImportedCount(data?.length || plan.ready.length)
    onImported(data || [])
    setStep('done')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: color.bone, borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh',
        overflowY: 'auto', margin: '0 20px' }} onClick={e => e.stopPropagation()}>

        <div style={{ position: 'sticky', top: 0, background: color.void, padding: '16px 24px',
          borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: color.textOnDark.primary }}>Import history</div>
            <div style={{ fontSize: type.label, color: color.textOnDark.secondary, marginTop: 2 }}>{client.full_name || client.email}</div>
          </div>
          <button onClick={onClose} style={{ background: color.surfaceDarkRaised, border: 'none',
            color: color.textOnDark.secondary, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {step === 'upload' && (
            <div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
                Upload a CSV export from a spreadsheet of this client's past check-ins. You'll map columns and
                review everything before anything is imported.
              </div>
              <label style={{ display: 'block', border: `1.5px dashed ${color.borderLight}`, borderRadius: 12,
                padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: color.surfaceLight }}>
                <div style={{ fontSize: type.body, color: color.textOnLight.primary, fontWeight: 500, marginBottom: 4 }}>
                  Click to choose a CSV file
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.faint }}>or drag one here</div>
                <input type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              </label>
              {error && <div style={{ fontSize: type.body, color: color.alert, marginTop: 12 }}>{error}</div>}
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <div style={{ ...S.label, marginBottom: 4 }}>Map columns</div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 14 }}>
                {fileName} · {rows.length} rows. Confirm what each column means — we guessed where we could.
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      {headers.map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px', minWidth: 130 }}>
                          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 6,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</div>
                          <FieldSelect value={mapping[h]} onChange={val => setMapping(m => ({ ...m, [h]: val }))} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((row, i) => (
                      <tr key={i} style={{ borderTop: `0.5px solid ${color.borderLight}` }}>
                        {headers.map(h => (
                          <td key={h} style={{ padding: '8px', fontSize: type.label, color: color.textOnLight.primary,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, fontFamily: font.mono }}>
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && (
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginBottom: 16 }}>
                  Showing first 8 of {rows.length} rows.
                </div>
              )}

              {!Object.values(mapping).includes('date') && (
                <div style={{ fontSize: type.body, color: color.alert, marginBottom: 12 }}>
                  Map at least one column to Date to continue.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('upload')}
                  style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                    background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans,
                    fontSize: type.body, cursor: 'pointer' }}>
                  Back
                </button>
                <button onClick={() => setStep('review')} disabled={!Object.values(mapping).includes('date')}
                  style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
                    background: Object.values(mapping).includes('date') ? color.forest : color.textOnLight.faint,
                    color: color.sage, fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                    cursor: Object.values(mapping).includes('date') ? 'pointer' : 'not-allowed' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (() => {
            const plan = buildPlan()
            return (
              <div>
                <div style={{ ...S.label, marginBottom: 10 }}>Review import</div>
                <div style={{ background: color.surfaceLight, border: `1px solid ${color.borderLight}`, borderRadius: 10,
                  padding: 16, marginBottom: 16, fontSize: type.body, color: color.textOnLight.primary }}>
                  <strong>{plan.ready.length}</strong> row{plan.ready.length === 1 ? '' : 's'} ready to import
                  {plan.skipped.length > 0 && <>, <strong>{plan.skipped.length}</strong> skipped — see below</>}.
                </div>

                {plan.ready.length > 0 && (
                  <div style={{ marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
                    {plan.ready.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: type.label,
                        color: color.textOnLight.secondary, padding: '4px 0', fontFamily: font.mono }}>
                        <span style={{ color: color.textOnLight.faint, minWidth: 60 }}>Week {r.week_number}</span>
                        <span>{new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {r.weight != null && <span>· {r.weight} lbs</span>}
                        {r.calories != null && <span>· {r.calories} kcal</span>}
                      </div>
                    ))}
                  </div>
                )}

                {plan.skipped.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ ...S.label, marginBottom: 8, color: color.alert }}>Skipped rows</div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {plan.skipped.map((s, i) => (
                        <div key={i} style={{ fontSize: type.label, color: color.textOnLight.secondary }}>
                          {s.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 12 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setStep('mapping')}
                    style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                      background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans,
                      fontSize: type.body, cursor: 'pointer' }}>
                    Back
                  </button>
                  <button onClick={() => confirmImport(plan)} disabled={importing || plan.ready.length === 0}
                    style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
                      background: plan.ready.length === 0 ? color.textOnLight.faint : color.forest, color: color.sage,
                      fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                      cursor: plan.ready.length === 0 ? 'not-allowed' : 'pointer' }}>
                    {importing ? 'Importing...' : `Import ${plan.ready.length} check-in${plan.ready.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )
          })()}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>
                Imported {importedCount} check-in{importedCount === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 20 }}>
                Marked as imported history — visible to both you and {client.full_name || 'the client'}.
              </div>
              <button onClick={onClose}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: color.forest,
                  color: color.sage, fontFamily: font.sans, fontSize: type.body, fontWeight: 500, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
