'use strict';

// Normalization for the last-view state a window restores on reopen.
//
// This used to live in floatingBubble.js, but it describes the *window's* view,
// not the bubble, so it belongs with the app rather than with a feature that no
// longer exists.
//
// Both fields are always written back. Omitting a value because it equals the
// default ('today' / 'tool') would be lossy: the renderer could not then tell
// "the user chose the tool breakdown" apart from "no view was provided", and
// would fall back to the first custom-ordered view — silently discarding a
// persisted last view.

const INITIAL_RENDERER_PERIODS = new Set(['today', 'month', 'allTime']);
const INITIAL_RENDERER_BREAKDOWNS = new Set([
  'home', 'tool', 'status', 'device', 'model', 'project', 'session', 'limits', 'trends'
]);

function normalizedInitialRendererValue(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.has(raw) ? raw : fallback;
}

function normalizeInitialRendererViewState(value = {}, fallback = {}) {
  const source = value || {};
  const fallbackSource = fallback || {};
  const fallbackPeriod = normalizedInitialRendererValue(fallbackSource.period, INITIAL_RENDERER_PERIODS, 'today');
  const fallbackBreakdown = normalizedInitialRendererValue(fallbackSource.breakdown, INITIAL_RENDERER_BREAKDOWNS, 'tool');
  return {
    period: normalizedInitialRendererValue(source.period, INITIAL_RENDERER_PERIODS, fallbackPeriod),
    breakdown: normalizedInitialRendererValue(source.breakdown, INITIAL_RENDERER_BREAKDOWNS, fallbackBreakdown)
  };
}

/** Query string form, always carrying both fields. */
function initialRendererViewStateQuery(viewState = {}) {
  const normalized = normalizeInitialRendererViewState(viewState);
  return { period: normalized.period, breakdown: normalized.breakdown };
}

module.exports = {
  INITIAL_RENDERER_PERIODS,
  INITIAL_RENDERER_BREAKDOWNS,
  normalizeInitialRendererViewState,
  initialRendererViewStateQuery
};
