import { describe, it, expect } from 'vitest'
import {
  summarizeHistory,
  flagPills,
  nearbyRank,
  partitionNearbyPlaces,
  isNotAFit,
  mergeVisitHistories,
  OUTCOME_LABELS
} from './visitHistory.js'

// Fixed local noon so day-level math is independent of when the suite runs.
const NOW = new Date(2026, 9, 14, 12, 0).getTime()

// A visit `days` calendar days before NOW, at the given local hour.
function at(days, hour = 9) {
  return new Date(2026, 9, 14 - days, hour, 0).getTime()
}

function visit(days, fields = {}) {
  return { source: 'local', timestamp: at(days), status: '', outcome: '', ...fields }
}

// Newest first, like mergeVisitHistories returns.
function summarize(visits) {
  return summarizeHistory([...visits].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), NOW)
}

describe('recent visit window (60 days)', () => {
  it('59 days ago is recent', () => {
    expect(summarize([visit(59)]).recentVisit).toBe(true)
  })

  it('exactly 60 days ago is recent (inclusive), even late in that day', () => {
    expect(summarize([visit(60)]).recentVisit).toBe(true)
    expect(summarizeHistory([{ timestamp: at(60, 23), outcome: 'left-info' }], NOW).recentVisit).toBe(true)
  })

  it('61 days ago is not recent, even late in that day', () => {
    const s = summarize([visit(61)])
    expect(s.recentVisit).toBe(false)
    expect(s.muted).toBe(false)
    expect(summarizeHistory([{ timestamp: at(61, 23), outcome: 'left-info' }], NOW).recentVisit).toBe(false)
  })
})

describe('not-a-fit window (365 days)', () => {
  const naf = days => visit(days, { outcome: 'not-a-fit' })

  it('364 days ago is not a fit', () => {
    expect(summarize([naf(364)]).notAFit).toBe(true)
  })

  it('exactly 365 days ago is not a fit (inclusive)', () => {
    const s = summarize([naf(365)])
    expect(s.notAFit).toBe(true)
    expect(s.muted).toBe(true)
  })

  it('366 days ago has expired', () => {
    const s = summarize([naf(366)])
    expect(s.notAFit).toBe(false)
    expect(s.muted).toBe(false)
  })

  it('records when the mute started', () => {
    expect(summarize([naf(200)]).notAFitAt).toBe(at(200))
  })
})

describe('clearing not-a-fit', () => {
  it('a later positive visit clears the mute', () => {
    const s = summarize([
      visit(300, { outcome: 'not-a-fit' }),
      visit(100, { outcome: 'spoke-to-owner' })
    ])
    expect(s.notAFit).toBe(false)
    expect(s.muted).toBe(false)
  })

  it('a later positive status alone clears the mute', () => {
    const s = summarize([
      visit(300, { outcome: 'not-a-fit' }),
      visit(100, { status: 'meeting-set' })
    ])
    expect(s.notAFit).toBe(false)
  })

  it('a later not-interested visit does not clear it', () => {
    expect(summarize([
      visit(300, { outcome: 'not-a-fit' }),
      visit(100, { outcome: 'not-interested' })
    ]).notAFit).toBe(true)
    expect(summarize([
      visit(300, { outcome: 'not-a-fit' }),
      visit(100, { outcome: 'left-info', status: 'not-interested' })
    ]).notAFit).toBe(true)
  })

  it('a later visit with no outcome or status does not clear it', () => {
    expect(summarize([visit(300, { outcome: 'not-a-fit' }), visit(100)]).notAFit).toBe(true)
  })

  it('an earlier positive visit does not clear a newer not-a-fit', () => {
    expect(summarize([
      visit(300, { outcome: 'spoke-to-owner' }),
      visit(100, { outcome: 'not-a-fit' })
    ]).notAFit).toBe(true)
  })

  it('a newer not-a-fit after a clearing visit mutes again', () => {
    const s = summarize([
      visit(300, { outcome: 'not-a-fit' }),
      visit(200, { outcome: 'spoke-to-owner' }),
      visit(100, { outcome: 'not-a-fit' })
    ])
    expect(s.notAFit).toBe(true)
    expect(s.notAFitAt).toBe(at(100))
  })
})

describe('not-interested does not mute', () => {
  it('outcome not-interested is not a fit', () => {
    expect(isNotAFit({ outcome: 'not-interested' })).toBe(false)
    expect(isNotAFit({ outcome: 'not-a-fit' })).toBe(true)
  })

  it('old not-interested outcome or status leaves the place unmuted', () => {
    const s = summarize([visit(90, { outcome: 'not-interested', status: 'not-interested' })])
    expect(s.notAFit).toBe(false)
    expect(s.muted).toBe(false)
    expect(s.tone).toBe('prior')
  })

  it('the old skip tone is gone', () => {
    const s = summarize([visit(10, { status: 'not-interested' })])
    expect(s.tone).not.toBe('skip')
  })
})

describe('team visits', () => {
  it('a teammate visit counts toward the recent window', () => {
    const merged = mergeVisitHistories([], [
      { capturedAt: new Date(at(20)).toISOString(), userName: 'Sam', outcome: 'left-info' }
    ], 'Rory')
    const s = summarizeHistory(merged, NOW)
    expect(s.teamOnly).toBe(true)
    expect(s.recentVisit).toBe(true)
    expect(s.muted).toBe(true)
  })

  it('a teammate not-a-fit mutes', () => {
    const merged = mergeVisitHistories([], [
      { capturedAt: new Date(at(200)).toISOString(), userName: 'Sam', outcome: 'not-a-fit' }
    ], 'Rory')
    expect(summarizeHistory(merged, NOW).notAFit).toBe(true)
  })

  it('a recent visit anywhere in the list counts, not just the newest', () => {
    const s = summarizeHistory([
      { source: 'team', timestamp: 0, outcome: 'left-info' },
      { source: 'local', timestamp: at(5), outcome: 'left-info' }
    ], NOW)
    expect(s.recentVisit).toBe(true)
  })
})

describe('missing dates', () => {
  it('visits without a timestamp are ignored for windows', () => {
    const s = summarizeHistory([
      { source: 'team', timestamp: 0, outcome: 'not-a-fit' },
      { source: 'local', outcome: 'not-a-fit' }
    ], NOW)
    expect(s.count).toBe(2)
    expect(s.recentVisit).toBe(false)
    expect(s.notAFit).toBe(false)
    expect(s.muted).toBe(false)
  })

  it('an undated positive visit does not clear a dated not-a-fit', () => {
    const s = summarizeHistory([
      { source: 'local', timestamp: at(100), outcome: 'not-a-fit' },
      { source: 'team', timestamp: 0, outcome: 'spoke-to-owner' }
    ], NOW)
    expect(s.notAFit).toBe(true)
  })

  it('a team visit with no capturedAt is ignored', () => {
    const merged = mergeVisitHistories([], [{ userName: 'Sam', outcome: 'not-a-fit' }], 'Rory')
    expect(summarizeHistory(merged, NOW).muted).toBe(false)
  })
})

describe('both flags', () => {
  it('a recent not-a-fit visit sets both flags and is muted once', () => {
    const s = summarize([visit(30, { outcome: 'not-a-fit' })])
    expect(s.recentVisit).toBe(true)
    expect(s.notAFit).toBe(true)
    expect(s.muted).toBe(true)
  })
})

describe('flagPills', () => {
  it('is empty for no flags or no summary', () => {
    expect(flagPills(summarize([visit(100)]))).toEqual([])
    expect(flagPills(null)).toEqual([])
  })

  it('shows the recent pill', () => {
    expect(flagPills(summarize([visit(10)]))).toEqual(['Visited in last 60 days'])
  })

  it('shows the not-a-fit pill', () => {
    expect(flagPills(summarize([visit(100, { outcome: 'not-a-fit' })]))).toEqual(['Not a fit (last 365 days)'])
  })

  it('shows both pills when both apply', () => {
    expect(flagPills(summarize([visit(10, { outcome: 'not-a-fit' })]))).toEqual([
      'Visited in last 60 days',
      'Not a fit (last 365 days)'
    ])
  })
})

describe('nearbyRank', () => {
  it('orders due, new, prior, then muted', () => {
    const due = summarize([visit(90, { followUpDate: '2026-10-01' })])
    const prior = summarize([visit(90)])
    const recent = summarize([visit(10)])
    const notFit = summarize([visit(200, { outcome: 'not-a-fit' })])
    expect(nearbyRank(due)).toBe(0)
    expect(nearbyRank(null)).toBe(1)
    expect(nearbyRank(prior)).toBe(2)
    expect(nearbyRank(recent)).toBe(3)
    expect(nearbyRank(notFit)).toBe(3)

    const sorted = [notFit, prior, null, due].sort((a, b) => nearbyRank(a) - nearbyRank(b))
    expect(sorted).toEqual([due, null, prior, notFit])
  })
})

describe('Nearby ordering', () => {
  // Same comparator SearchView uses for Nearby.
  const rankNearby = list => [...list].sort((a, b) =>
    nearbyRank(a.history) - nearbyRank(b.history) || a.distMeters - b.distMeters
  )
  const places = () => [
    { name: 'Not a fit', distMeters: 50, history: summarize([visit(200, { outcome: 'not-a-fit' })]) },
    { name: 'Recent', distMeters: 100, history: summarize([visit(10)]) },
    { name: 'New far', distMeters: 400, history: null },
    { name: 'New near', distMeters: 150, history: null },
    { name: 'Cleared', distMeters: 300, history: summarize([visit(200, { outcome: 'not-a-fit' }), visit(100, { outcome: 'left-info' })]) },
    { name: 'Due', distMeters: 500, history: summarize([visit(90, { followUpDate: '2026-10-01' })]) }
  ]

  it('sorts muted places last, even when closer', () => {
    expect(rankNearby(places()).map(p => p.name)).toEqual([
      'Due', 'New near', 'New far', 'Cleared', 'Not a fit', 'Recent'
    ])
  })

  it('keeps every place and splits flagged ones off in order', () => {
    const { active, flagged } = partitionNearbyPlaces(rankNearby(places()))
    expect(active.map(p => p.name)).toEqual(['Due', 'New near', 'New far', 'Cleared'])
    expect(flagged.map(p => p.name)).toEqual(['Not a fit', 'Recent'])
    expect(flagged.length).toBe(2) // "Recently worked (2)"
  })

  it('flagged places keep their pills', () => {
    const { flagged } = partitionNearbyPlaces(places())
    expect(flagged.map(p => flagPills(p.history))).toEqual([
      ['Not a fit (last 365 days)'],
      ['Visited in last 60 days']
    ])
  })

  it('has no flagged group when nothing is muted', () => {
    const { active, flagged } = partitionNearbyPlaces([{ name: 'New', history: null }])
    expect(active).toHaveLength(1)
    expect(flagged).toEqual([])
  })

  it('handles an empty or missing list', () => {
    expect(partitionNearbyPlaces([])).toEqual({ active: [], flagged: [] })
    expect(partitionNearbyPlaces(undefined)).toEqual({ active: [], flagged: [] })
  })
})

describe('labels', () => {
  it('has a Not a Fit outcome label', () => {
    expect(OUTCOME_LABELS['not-a-fit']).toBe('Not a Fit')
  })
})
