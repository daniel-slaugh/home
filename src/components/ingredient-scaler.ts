import Fraction from 'fraction.js'

interface IngredientGroup {
  title: string
}
interface IngredientItem {
  name: string
  quantity: number
  unit: string
}
type Ingredient = IngredientGroup | IngredientItem

export class IngredientScaler extends HTMLElement {
  ingredientsData: Ingredient[] = []
  originalServes = 1
  scaleFactor = 1

  originalInstructions = ''
  servingsInput: HTMLInputElement | null = null
  ingredientRoot: HTMLElement | null = null
  instructionsContainer: HTMLElement | null = null

  connectedCallback() {
    const raw = this.dataset.ingredients || '[]'

    this.ingredientsData = JSON.parse(raw)
    this.originalServes = parseFloat(this.dataset.serves || '1') || 1

    this.servingsInput = this.querySelector('#multiplier-input')
    this.ingredientRoot = this.querySelector('#ingredient-root')
    this.instructionsContainer = this.querySelector('#instructions-container')
    if (!(this.servingsInput instanceof HTMLInputElement)) return
    if (!this.ingredientRoot || !this.instructionsContainer) return
    this.originalInstructions = this.instructionsContainer.innerHTML

    this.servingsInput?.addEventListener('input', () => this.renderAll())
    this.renderAll()
  }

  renderAll = () => {
    const newServes =
      parseFloat(this.servingsInput!.value) || this.originalServes
    this.scaleFactor = newServes / this.originalServes

    this.renderIngredients()
    this.renderInstructions()
  }

  renderIngredients = () => {
    this.ingredientRoot!.innerHTML = ''
    let currentUl = null

    for (const item of this.ingredientsData) {
      if ('title' in item) {
        currentUl = null
        const h4 = document.createElement('h5')
        h4.style.marginTop = '1rem'
        h4.textContent = item.title
        this.ingredientRoot!.appendChild(h4)
      } else {
        if (!currentUl) {
          currentUl = document.createElement('ul')
          currentUl.id = 'ingredient-list'
          this.ingredientRoot!.appendChild(currentUl)
        }
        const li = document.createElement('li')
        li.innerHTML = this.formatIngredient(item)
        currentUl.appendChild(li)
      }
    }
  }

  formatIngredient = (ingredient: any) => {
    const raw = ingredient.quantity * this.scaleFactor

    const { value: qty, unit } = this.convertUnit(raw, ingredient.unit)

    const MAX_DENOMINATOR = 8 // eighths in the kitchen
    const frac = this.formatWithMaxDenominator(qty, MAX_DENOMINATOR)
    return this.wrapColored(`${frac} ${unit} ${ingredient.name}`)
  }

  renderInstructions = () => {
    // 1) Handle [[[Name]]] → just "Name"
    let html = this.originalInstructions.replace(
      /\[\[\[\s*([^\]]+?)\s*\]\]\]/g,
      (_m, token) => this.wrapColored(`${token.trim()}`),
    )

    // 2) Handle [[Name]] → formatted "qty unit Name"
    html = html.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, (_m, token) => {
      const name = token.trim()
      const found = this.ingredientsData.find((i: any) => i.name === name)
      return found ? this.formatIngredient(found) : this.wrapColored(`${name}`)
    })

    this.instructionsContainer!.innerHTML = html
  }

  private formatWithMaxDenominator(value: number, maxDenominator = 8): string {
    const whole = Math.floor(value)
    const fracPart = value - whole
    if (fracPart < 1e-6) return `${whole}`

    let bestN = 0
    let bestD = 1
    let bestError = Infinity

    for (let d = 1; d <= maxDenominator; d++) {
      const n = Math.round(fracPart * d)
      const diff = Math.abs(fracPart - n / d)
      if (diff < bestError) {
        bestError = diff
        bestN = n
        bestD = d
      }
    }

    const frac = new Fraction(bestN, bestD).simplify()
    // if it rounded to a whole
    if (frac.n === frac.d) {
      return `${whole + 1}`
    }
    // if no fractional part
    if (frac.n === BigInt(0)) {
      return `${whole}`
    }

    const fracStr = `${frac.n}/${frac.d}`
    return whole > 0 ? `${whole} ${fracStr}` : fracStr
  }

  private wrapColored(text: string) {
    return `<span style="color: var(--accent);">${text}</span>`
  }

  private upSteps: Record<
    string,
    {
      convertAt: number
      factor: number
      next: string
    }
  > = {
    tsp: { convertAt: 3, factor: 3, next: 'Tbsp' },
    Tbsp: { convertAt: 4, factor: 16, next: 'cup' },
  }

  private downSteps: Record<
    string,
    {
      convertBelow: number
      factor: number
      prev: string
    }
  > = {
    Tbsp: { convertBelow: 1, factor: 3, prev: 'tsp' },
    cup: { convertBelow: 0.25, factor: 16, prev: 'Tbsp' },
  }

  private convertUnit(value: number, unit: string) {
    let v = value
    let u = unit

    // up‐convert
    let up = this.upSteps[u]
    while (up && v >= up.convertAt) {
      v = v / up.factor
      u = up.next
      up = this.upSteps[u]
    }

    // down‐convert
    let down = this.downSteps[u]
    while (down && v < down.convertBelow) {
      v = v * down.factor
      u = down.prev
      down = this.downSteps[u]
    }

    return { value: v, unit: u }
  }
}
