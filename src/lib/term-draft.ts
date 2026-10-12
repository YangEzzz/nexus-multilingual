import type { TermItem } from '@/types/domain'

interface TermDraftSnapshot { terms: TermItem[], selected: TermItem[] }

export function captureTermDraft(terms: TermItem[], selected: Map<string, TermItem>): string {
  return JSON.stringify({ terms, selected: Array.from(selected.values()) } satisfies TermDraftSnapshot)
}

export function restoreTermDraft(snapshot: string) {
  const draft = JSON.parse(snapshot) as TermDraftSnapshot
  const selected = new Map(draft.selected.map(term => [term.id, term]))
  for (const term of draft.terms) {
    if (selected.has(term.id))
      selected.set(term.id, term)
  }
  return { terms: draft.terms, selected }
}
