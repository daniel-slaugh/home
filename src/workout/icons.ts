/**
 * Each deck's icon: it stands in for the suit on every card in the deck (the corners and the
 * big centre pip) and is printed on the deck's box. Drawn on a 24 × 24 grid in currentColor,
 * so a deck colours it with `art.icon.color`.
 */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICONS = {
  /** Bodyweight: a flexed arm. */
  bicep: svg(
    `<path fill="currentColor" stroke="none" d="M2.5 21V15.2C2.5 11 5.4 8 9.2 8c2.6 0 4.6 1.3 5.9 3.3l.3-2.1c-1.6-.4-2.9-1.9-2.9-3.6 0-2.1 1.7-3.8 3.9-3.8 2.6 0 4.6 2.1 4.6 4.7l.2 9.6c0 3.2-2.4 5.9-5.6 5.9H2.5Z"/>`
  ),
  /** Cardio: a heartbeat trace. */
  pulse: svg(`<path stroke-width="2.4" d="M1.5 12.5h4.5l2-4.5 3.5 11 3.5-15 2.5 8.5h5"/>`),
  /** Mobility: a joint turning through its range, a circle of motion with an arrow. */
  rotate: svg(`<path stroke-width="2.4" d="M20 12a8 8 0 1 1-2.4-5.7"/><path stroke-width="2.4" d="M20 3.5v4h-4"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>`),
  /** Warm-up: a flame. */
  flame: svg(
    `<path fill="currentColor" stroke="none" d="M12 22.5c-4.2 0-7.3-3-7.3-7 0-3.3 1.9-5.4 3.6-7.3 1.3-1.4 2.4-2.8 2.6-5 .1-.6.8-.9 1.3-.5 2.7 2.1 4.2 4.9 4 7.6.9-.5 1.5-1.4 1.8-2.4.2-.5.8-.7 1.2-.3 1.6 1.7 2.8 4.4 2.8 7.4 0 4.3-3.6 7.5-8 7.5Zm0-2c1.8 0 3.1-1.3 3.1-3 0-1.6-1-2.9-2.3-4-.3 1.3-1.2 2.2-2.3 2.6-.1-.9-.4-1.6-.9-2.2-.9 1-1.5 2.2-1.5 3.5 0 1.8 1.6 3.1 3.9 3.1Z"/>`
  ),
  /** Cool-down: a snowflake. */
  snowflake: svg(
    `<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 3.5 3 2.5 3-2.5M9 20.5l3-2.5 3 2.5M3.6 10.3l3.7-1.1-.6-3.8M20.4 13.7l-3.7 1.1.6 3.8M6.7 18.6l.6-3.8-3.7-1.1M17.3 5.4l-.6 3.8 3.7 1.1"/>`
  ),
} as const
