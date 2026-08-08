import sheet from '../Greek Campaign/diana-sheet.html?raw'

export function GET() {
  return new Response(sheet, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
