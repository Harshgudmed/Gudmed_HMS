import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format a doctor's name with exactly one "Dr." prefix.
 * Handles names already stored with a title (e.g. "Dr. Suresh Patel")
 * so we never end up with "Dr. Dr. Suresh Patel".
 */
export function drName(name) {
  if (!name) return ''
  const clean = String(name).replace(/^\s*(dr\.?\s+)+/i, '').trim()
  return clean ? `Dr. ${clean}` : ''
}
