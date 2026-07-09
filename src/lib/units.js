// Canonical storage is always lbs/in (see profiles.units, ClientSettings.js).
// These helpers convert at the display/entry boundary only — nothing in the
// database ever changes shape based on a client's unit preference.

const LB_PER_KG = 0.453592
const CM_PER_IN = 2.54

export function lbsToKg(v) { return v * LB_PER_KG }
export function kgToLbs(v) { return v / LB_PER_KG }
export function inToCm(v) { return v * CM_PER_IN }
export function cmToIn(v) { return v / CM_PER_IN }

export function isMetric(units) { return units === 'metric' }

export function weightUnitLabel(units) { return isMetric(units) ? 'kg' : 'lbs' }
export function measurementUnitLabel(units) { return isMetric(units) ? 'cm' : 'in' }

// value/unit pairs for rendering — lbsValue/inValue are the canonical stored numbers.
export function displayWeight(lbsValue, units) {
  if (lbsValue == null || lbsValue === '') return { value: lbsValue, unit: 'lbs' }
  return isMetric(units)
    ? { value: +lbsToKg(lbsValue).toFixed(1), unit: 'kg' }
    : { value: +Number(lbsValue).toFixed(1), unit: 'lbs' }
}

export function displayMeasurement(inValue, units) {
  if (inValue == null || inValue === '') return { value: inValue, unit: 'in' }
  return isMetric(units)
    ? { value: +inToCm(inValue).toFixed(1), unit: 'cm' }
    : { value: +Number(inValue).toFixed(1), unit: 'in' }
}

// Inverse — a value the user typed while in the given display unit, converted
// back to canonical lbs/in right before it's persisted.
export function toCanonicalWeight(displayValue, units) {
  if (displayValue == null || displayValue === '' || isNaN(displayValue)) return displayValue
  return isMetric(units) ? kgToLbs(Number(displayValue)) : Number(displayValue)
}

export function toCanonicalMeasurement(displayValue, units) {
  if (displayValue == null || displayValue === '' || isNaN(displayValue)) return displayValue
  return isMetric(units) ? cmToIn(Number(displayValue)) : Number(displayValue)
}
