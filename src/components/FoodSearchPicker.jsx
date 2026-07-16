import { useState } from 'react'
import { color as staticColor, appearance, font, type, badge } from '../lib/theme'

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

export const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10)

// Searches Nutritionix (via the /api proxy — credentials never reach the
// client) for a food, then lets the caller pick a servings multiplier before
// adding it. Macros are meant to be cached at add-time by the caller, never
// re-queried live for display, per the spec's caching rationale. Used by the
// coach-side meal builder (CoachDashboard.js) and the client-side food diary
// (ClientHome.js) — same search UI, different destination table.
export default function FoodSearchPicker({ onAdd, onCancel }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [servings, setServings] = useState(1)
  const [loadingNutrients, setLoadingNutrients] = useState(false)

  const search = async (e) => {
    e?.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true)
    setError(null)
    setSelected(null)
    try {
      const res = await fetch(`/api/nutritionix-search?query=${encodeURIComponent(query)}`)
      if (!res.headers.get('content-type')?.includes('application/json')) {
        // Local `npm start` doesn't serve /api/* at all (only a Vercel
        // deploy does) — surface that plainly instead of a raw JSON parse error.
        throw new Error('Food search is only available on a deployed environment, not local dev.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data)
    } catch (err) {
      setError(err.message)
      setResults(null)
    }
    setSearching(false)
  }

  const pickFood = async (food) => {
    setLoadingNutrients(true)
    setError(null)
    try {
      const res = await fetch('/api/nutritionix-nutrients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food.is_branded
          ? { nix_item_id: food.nix_item_id }
          : { food_name: food.food_name }),
      })
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Food search is only available on a deployed environment, not local dev.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not get nutrition info')
      setSelected(data)
      setServings(1)
    } catch (err) {
      setError(err.message)
    }
    setLoadingNutrients(false)
  }

  const handleAdd = () => {
    if (!selected) return
    onAdd({
      food_name: selected.food_name,
      quantity: round1((selected.serving_qty || 1) * servings),
      unit: selected.serving_unit || 'serving',
      calories: round1((selected.calories || 0) * servings),
      protein: round1((selected.protein || 0) * servings),
      carbs: round1((selected.carbs || 0) * servings),
      fats: round1((selected.fats || 0) * servings),
      nutritionix_food_id: selected.nutritionix_food_id || null,
    })
  }

  const allResults = results ? [...results.common, ...results.branded] : []

  return (
    <div style={{ marginTop: 8, padding: 10, background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 8 }}>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="text" placeholder="Search a food (e.g. chicken breast)" value={query}
          onChange={e => setQuery(e.target.value)} autoFocus
          style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
            fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', color: color.textOnLight.primary }} />
        <button type="submit" disabled={searching || query.trim().length < 2}
          style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
            background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans,
            fontSize: type.label, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {searching ? 'Searching...' : 'Search'}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'transparent',
            color: color.textOnLight.faint, fontFamily: font.sans, fontSize: type.label, cursor: 'pointer' }}>
          Cancel
        </button>
      </form>

      {error && <div style={{ fontSize: type.label, color: color.alert, marginBottom: 8 }}>{error}</div>}

      {!selected && results && (
        allResults.length === 0 ? (
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary }}>No results for "{query}".</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
            {allResults.map((food, i) => (
              <button key={i} onClick={() => pickFood(food)} disabled={loadingNutrients}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
                  padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer',
                  fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.primary, width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.background = color.bone }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <span>{food.food_name}{food.brand_name ? ` (${food.brand_name})` : ''}</span>
                {food.is_branded && <span style={badge('neutral')}>Branded</span>}
              </button>
            ))}
          </div>
        )
      )}

      {loadingNutrients && <div style={{ fontSize: type.label, color: color.textOnLight.secondary }}>Loading nutrition info...</div>}

      {selected && (
        <div style={{ background: color.bone, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>
            {selected.food_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: type.label, color: color.textOnLight.secondary }}>Servings</label>
            <input type="number" step={0.25} min={0.25} value={servings}
              onChange={e => setServings(parseFloat(e.target.value) || 0)}
              style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                fontFamily: font.mono, fontSize: type.body, color: color.textOnLight.primary, boxSizing: 'border-box' }} />
            <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
              × {selected.serving_qty}{selected.serving_unit} serving
            </span>
          </div>
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono, marginBottom: 10 }}>
            {round1((selected.calories || 0) * servings)} kcal · {round1((selected.protein || 0) * servings)}g P ·{' '}
            {round1((selected.carbs || 0) * servings)}g C · {round1((selected.fats || 0) * servings)}g F
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd}
              style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${color.forest}`,
                background: 'transparent', color: color.forest, fontFamily: font.sans, fontSize: type.label,
                fontWeight: 500, cursor: 'pointer' }}>
              Add to meal
            </button>
            <button onClick={() => setSelected(null)}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'transparent',
                color: color.textOnLight.faint, fontFamily: font.sans, fontSize: type.label, cursor: 'pointer' }}>
              Back to search
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
