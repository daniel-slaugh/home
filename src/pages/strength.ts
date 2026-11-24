import deck from '../strength/strength-deck.html?raw'

export function GET() {
  return new Response(deck, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
