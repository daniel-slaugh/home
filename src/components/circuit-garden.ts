type Point = { x: number; y: number }
type Sample = Point & { tx: number; ty: number }
type PlantKind = 'root' | 'cactus' | 'trunk' | 'branch' | 'vine' | 'seedling'

type Geometry = {
  samples: Sample[]
  cumulative: number[]
  length: number
}

type GrowingPath = Geometry & {
  id: string
  kind: PlantKind
  birth: number
  duration: number
  widthStart: number
  widthEnd: number
  depth: number
  color: string
  parent?: string
  flowDelay: number
  flowPeriod: number
  phase: number
}

type Leaf = {
  x: number
  y: number
  stemX: number
  stemY: number
  angle: number
  size: number
  birth: number
  phase: number
  cluster: number
  tier: number
  color: number
}

type Succulent = {
  x: number
  y: number
  size: number
  birth: number
  phase: number
  color: number
  variant: number
}

type Blossom = {
  x: number
  y: number
  birth: number
  size: number
  phase: number
  color: string
}

type Speck = {
  x: number
  y: number
  size: number
  phase: number
  speed: number
}

type PulseState = {
  cycle: number
  cycleTime: number
  lead: boolean
}

const canvas = document.querySelector<HTMLCanvasElement>('.circuit-garden')

if (canvas && canvas.dataset.ready !== 'true') {
  canvas.dataset.ready = 'true'

  const context = canvas.getContext('2d')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const previewMature = new URLSearchParams(window.location.search).get('garden-preview') === 'mature'

  if (context) {
    const hero = canvas.closest<HTMLElement>('.hero')
    const palette = {
      ink: '#071a10',
      cactusDark: '#123d28',
      cactusMid: '#246744',
      cactusLight: '#52a86f',
      barkDark: '#172d20',
      bark: '#294936',
      barkLight: '#4f755a',
      leafDark: '#173c28',
      leafMid: '#2e6a47',
      leaf: '#4fa872',
      leafLight: '#79d594',
      circuit: '#64cf87',
      circuitDim: '#2e6a4a',
      mint: '#8bf3a8',
      cyan: '#79d6c6',
      ember: '#e8a06b',
      cream: '#dcffe5',
    }

    const leafColors = [palette.leafDark, palette.leafMid, palette.leaf, '#3e8559', '#63bd7e']

    let width = 1
    let height = 1
    let sceneStart = performance.now()
    let circuitPaths: GrowingPath[] = []
    let botanicalPaths: GrowingPath[] = []
    let leaves: Leaf[] = []
    let blossoms: Blossom[] = []
    let specks: Speck[] = []
    let succulents: Succulent[] = []
    let cactusPaths: GrowingPath[] = []
    let treePaths: GrowingPath[] = []
    let vinePaths: GrowingPath[] = []
    let packetSprites = new Map<string, HTMLCanvasElement>()
    let animationFrame = 0
    let isVisible = true
    let isPageVisible = !document.hidden
    let frameBudgetTier = 0
    let lastFrame = 0
    let sceneSeed = 0
    let maintenanceEpoch = 62000
    const leadEpoch = 2400
    const networkPeriod = 28000

    function seededRandom(seed: number) {
      let state = seed >>> 0
      return () => {
        state += 0x6d2b79f5
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
      }
    }

    function clamp(value: number, min = 0, max = 1) {
      return Math.min(max, Math.max(min, value))
    }

    function lerp(start: number, end: number, amount: number) {
      return start + (end - start) * amount
    }

    function smoothstep(value: number) {
      const t = clamp(value)
      return t * t * (3 - 2 * t)
    }

    function easeOutCubic(value: number) {
      return 1 - Math.pow(1 - clamp(value), 3)
    }

    function inverseEaseOutCubic(progress: number) {
      return 1 - Math.cbrt(1 - clamp(progress))
    }

    function geometryFromPoints(points: Point[]): Geometry {
      const samples: Sample[] = points.map((point, index) => {
        const previous = points[Math.max(0, index - 1)]
        const next = points[Math.min(points.length - 1, index + 1)]
        const distance = Math.hypot(next.x - previous.x, next.y - previous.y) || 1
        return { ...point, tx: (next.x - previous.x) / distance, ty: (next.y - previous.y) / distance }
      })
      const cumulative = [0]
      let length = 0

      for (let index = 1; index < samples.length; index++) {
        length += Math.hypot(samples[index].x - samples[index - 1].x, samples[index].y - samples[index - 1].y)
        cumulative.push(length)
      }

      return { samples, cumulative, length }
    }

    function sampleCubic(start: Point, controlA: Point, controlB: Point, end: Point, count = 22): Geometry {
      const points: Point[] = []
      for (let index = 0; index <= count; index++) {
        const t = index / count
        const inverse = 1 - t
        points.push({
          x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
          y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y,
        })
      }
      return geometryFromPoints(points)
    }

    function sampleSmoothPath(points: Point[], steps = 10): Geometry {
      if (points.length < 3) return geometryFromPoints(points)
      const samples: Point[] = []
      const expanded = [points[0], ...points, points[points.length - 1]]

      for (let section = 0; section < expanded.length - 3; section++) {
        const p0 = expanded[section]
        const p1 = expanded[section + 1]
        const p2 = expanded[section + 2]
        const p3 = expanded[section + 3]

        for (let step = 0; step < steps; step++) {
          const t = step / steps
          const t2 = t * t
          const t3 = t2 * t
          samples.push({
            x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          })
        }
      }
      samples.push(points[points.length - 1])
      return geometryFromPoints(samples)
    }

    function addPath(collection: GrowingPath[], geometry: Geometry, options: Omit<GrowingPath, keyof Geometry>) {
      const path = { ...geometry, ...options }
      collection.push(path)
      return path
    }

    function pointAlong(path: Geometry, distance: number): Sample {
      const bounded = clamp(distance, 0, path.length)
      let low = 1
      let high = path.cumulative.length - 1

      while (low < high) {
        const middle = (low + high) >> 1
        if (path.cumulative[middle] < bounded) low = middle + 1
        else high = middle
      }

      const index = Math.max(1, low)
      const startDistance = path.cumulative[index - 1]
      const segmentLength = path.cumulative[index] - startDistance || 1
      const amount = (bounded - startDistance) / segmentLength
      const start = path.samples[index - 1]
      const end = path.samples[index]
      const tx = lerp(start.tx, end.tx, amount)
      const ty = lerp(start.ty, end.ty, amount)
      const tangentLength = Math.hypot(tx, ty) || 1
      return {
        x: lerp(start.x, end.x, amount),
        y: lerp(start.y, end.y, amount),
        tx: tx / tangentLength,
        ty: ty / tangentLength,
      }
    }

    function nearestDistance(path: Geometry, target: Point) {
      let closestDistance = 0
      let closestSquared = Infinity
      for (let index = 1; index < path.samples.length; index++) {
        const start = path.samples[index - 1]
        const end = path.samples[index]
        const dx = end.x - start.x
        const dy = end.y - start.y
        const segmentSquared = dx * dx + dy * dy || 1
        const amount = clamp(((target.x - start.x) * dx + (target.y - start.y) * dy) / segmentSquared)
        const projectedX = start.x + dx * amount
        const projectedY = start.y + dy * amount
        const squared = (projectedX - target.x) ** 2 + (projectedY - target.y) ** 2
        if (squared < closestSquared) {
          closestSquared = squared
          closestDistance = path.cumulative[index - 1] + Math.sqrt(segmentSquared) * amount
        }
      }
      return closestDistance
    }

    function flowSpeed(kind: PlantKind) {
      const speedScale = clamp(height / 900, 0.75, 1.2)
      return (kind === 'root' ? 0.14 : kind === 'trunk' ? 0.078 : kind === 'cactus' ? 0.061 : kind === 'branch' ? 0.047 : kind === 'seedling' ? 0.05 : 0.04) * speedScale
    }

    function createGlowSprite(color: string) {
      const sprite = document.createElement('canvas')
      sprite.width = 48
      sprite.height = 48
      const spriteContext = sprite.getContext('2d')
      if (!spriteContext) return sprite

      const gradient = spriteContext.createRadialGradient(24, 24, 0, 24, 24, 24)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.08, color)
      gradient.addColorStop(0.28, `${color}bb`)
      gradient.addColorStop(0.62, `${color}35`)
      gradient.addColorStop(1, `${color}00`)
      spriteContext.fillStyle = gradient
      spriteContext.fillRect(0, 0, 48, 48)
      return sprite
    }

    function buildScene() {
      const random = seededRandom(sceneSeed)
      const jitter = (amount: number) => (random() - 0.5) * amount
      const p = (x: number, y: number): Point => ({ x: x * width, y: y * height })
      const scale = clamp(Math.min(width, height) / 760, 0.72, 1.28)

      circuitPaths = []
      botanicalPaths = []
      cactusPaths = []
      treePaths = []
      vinePaths = []
      leaves = []
      blossoms = []
      specks = []
      succulents = []

      const rootY = 0.875
      const addCircuit = (id: string, points: Point[], kind: PlantKind, birth: number, duration: number, parent: string | undefined, flowDelay: number, flowPeriod: number, color = palette.circuit) =>
        addPath(circuitPaths, geometryFromPoints(points), {
          id,
          kind,
          birth,
          duration,
          widthStart: kind === 'root' ? 1.5 : 1.15,
          widthEnd: 0.8,
          depth: 0,
          color,
          parent,
          flowDelay,
          flowPeriod,
          phase: random(),
        })

      const rootMain = addCircuit('root-main', [p(-0.02, rootY), p(0.12, rootY), p(0.12, rootY - 0.025), p(0.36, rootY - 0.025), p(0.36, rootY + 0.012), p(0.64, rootY + 0.012), p(0.64, rootY - 0.018), p(1.02, rootY - 0.018)], 'root', 0, 7000, undefined, 0, networkPeriod, palette.circuitDim)
      addCircuit('root-low', [p(0.02, 0.925), p(0.02, rootY + 0.03), p(0.48, rootY + 0.03), p(0.48, rootY)], 'root', 900, 6200, 'root-main', 0, networkPeriod, palette.circuitDim)
      addCircuit('root-high', [p(0.98, 0.91), p(0.98, rootY + 0.018), p(0.72, rootY + 0.018), p(0.72, rootY - 0.018)], 'root', 1200, 5900, 'root-main', 0, networkPeriod, palette.circuitDim)

      const cactusX = 0.145 + jitter(0.012)
      const cactusTop = 0.235 + jitter(0.025)
      const cactusBase = p(cactusX, rootY)
      const cactusRootDistance = nearestDistance(rootMain, cactusBase)
      const cactusTapStart = pointAlong(rootMain, cactusRootDistance)
      const cactusTapArrival = cactusRootDistance / flowSpeed('root') + 120
      const cactusTap = addCircuit('cactus-tap', [cactusTapStart, cactusBase], 'root', 2200, 2400, rootMain.id, cactusTapArrival, networkPeriod, palette.circuitDim)
      const cactusArrival = cactusTapArrival + cactusTap.length / flowSpeed('root') + 120
      const cactusCircuit = addCircuit('cactus-wire', [cactusBase, p(cactusX, 0.66), p(cactusX + 0.008, 0.66), p(cactusX + 0.008, cactusTop)], 'cactus', 3200, 12500, cactusTap.id, cactusArrival, networkPeriod)
      addCircuit('cactus-left-wire', [p(cactusX, 0.6), p(cactusX - 0.085, 0.6), p(cactusX - 0.085, 0.43)], 'cactus', 8200, 6500, cactusCircuit.id, cactusArrival, networkPeriod)
      addCircuit('cactus-right-wire', [p(cactusX, 0.51), p(cactusX + 0.088, 0.51), p(cactusX + 0.088, 0.33)], 'cactus', 9200, 6900, cactusCircuit.id, cactusArrival, networkPeriod)

      const cactusMainBirth = 10500
      const cactusMain = addPath(botanicalPaths, sampleCubic(p(cactusX, rootY), p(cactusX - 0.006, 0.7), p(cactusX + 0.014, 0.43), p(cactusX + 0.008, cactusTop), 42), {
        id: 'cactus-main',
        kind: 'cactus',
        birth: cactusMainBirth,
        duration: 20500,
        widthStart: 56 * scale,
        widthEnd: 37 * scale,
        depth: 0,
        color: palette.cactusMid,
        parent: cactusTap.id,
        flowDelay: cactusArrival,
        flowPeriod: networkPeriod,
        phase: random(),
      })
      cactusPaths.push(cactusMain)

      const cactusLeftStart = p(cactusX - 0.002, 0.6)
      const cactusLeftDistance = nearestDistance(cactusMain, cactusLeftStart)
      const cactusLeftArrival = cactusMain.flowDelay + cactusLeftDistance / flowSpeed('cactus') + 120
      const cactusLeft = addPath(botanicalPaths, sampleSmoothPath([cactusLeftStart, p(cactusX - 0.082, 0.6), p(cactusX - 0.102, 0.55), p(cactusX - 0.102, 0.41)], 12), {
        id: 'cactus-left',
        kind: 'cactus',
        birth: 16000,
        duration: 13000,
        widthStart: 39 * scale,
        widthEnd: 29 * scale,
        depth: 1,
        color: palette.cactusMid,
        parent: cactusMain.id,
        flowDelay: cactusLeftArrival,
        flowPeriod: networkPeriod,
        phase: random(),
      })
      cactusPaths.push(cactusLeft)

      const cactusRightStart = p(cactusX + 0.005, 0.52)
      const cactusRightDistance = nearestDistance(cactusMain, cactusRightStart)
      const cactusRightArrival = cactusMain.flowDelay + cactusRightDistance / flowSpeed('cactus') + 120
      const cactusRight = addPath(botanicalPaths, sampleSmoothPath([cactusRightStart, p(cactusX + 0.084, 0.52), p(cactusX + 0.102, 0.47), p(cactusX + 0.102, 0.31)], 12), {
        id: 'cactus-right',
        kind: 'cactus',
        birth: 17500,
        duration: 14500,
        widthStart: 41 * scale,
        widthEnd: 28 * scale,
        depth: 1,
        color: palette.cactusLight,
        parent: cactusMain.id,
        flowDelay: cactusRightArrival,
        flowPeriod: networkPeriod,
        phase: random(),
      })
      cactusPaths.push(cactusRight)
      ;[cactusMain, cactusLeft, cactusRight].forEach((path, index) => {
        const tip = pointAlong(path, path.length)
        blossoms.push({
          x: tip.x,
          y: tip.y - 2 * scale,
          birth: leadEpoch + path.flowDelay + path.length / flowSpeed(path.kind) + 3200 + index * 450,
          size: (index === 0 ? 7.5 : 6.2) * scale,
          phase: random() * Math.PI * 2,
          color: index === 2 ? '#e6f0d7' : '#cde7c6',
        })
      })

      // The final tree is built from a real tapered recursive branch system.
      const treeX = 0.815 + jitter(0.015)
      const treeTop = 0.155 + jitter(0.018)
      const treeBase = p(treeX, rootY)
      const treeRootDistance = nearestDistance(rootMain, treeBase)
      const treeTapStart = pointAlong(rootMain, treeRootDistance)
      const treeTapArrival = treeRootDistance / flowSpeed('root') + 120
      const treeTap = addCircuit('tree-tap', [treeTapStart, treeBase], 'root', 2600, 2600, rootMain.id, treeTapArrival, networkPeriod, palette.circuitDim)
      const treeArrival = treeTapArrival + treeTap.length / flowSpeed('root') + 140
      addCircuit('tree-wire', [treeBase, p(treeX, 0.69), p(treeX - 0.012, 0.69), p(treeX - 0.012, 0.45), p(treeX, 0.45), p(treeX, treeTop + 0.05)], 'trunk', 3600, 14500, treeTap.id, treeArrival, networkPeriod)
      addCircuit('tree-left-wire', [p(treeX, 0.58), p(treeX - 0.12, 0.58), p(treeX - 0.12, 0.39), p(treeX - 0.2, 0.39)], 'branch', 9300, 9000, 'tree-wire', treeArrival, networkPeriod)
      addCircuit('tree-right-wire', [p(treeX, 0.48), p(treeX + 0.1, 0.48), p(treeX + 0.1, 0.29), p(treeX + 0.17, 0.29)], 'branch', 10500, 9200, 'tree-wire', treeArrival, networkPeriod)

      const trunkBirth = 10000
      const trunk = addPath(botanicalPaths, sampleCubic(p(treeX, rootY), p(treeX - 0.018, 0.66), p(treeX + 0.016, 0.39), p(treeX, treeTop), 48), {
        id: 'tree-trunk',
        kind: 'trunk',
        birth: trunkBirth,
        duration: 22500,
        widthStart: 25 * scale,
        widthEnd: 5.2 * scale,
        depth: 0,
        color: palette.bark,
        parent: treeTap.id,
        flowDelay: treeArrival,
        flowPeriod: networkPeriod,
        phase: random(),
      })
      treePaths.push(trunk)

      let branchId = 0
      const branchLimitX = width * 0.57
      const makeBranch = (start: Point, angle: number, length: number, depth: number, birth: number, parent: string, cluster: number) => {
        if (depth > 4 || length < 17) return

        const parentPath = treePaths.find((path) => path.id === parent)
        if (!parentPath) return
        const junctionDistance = nearestDistance(parentPath, start)
        const parentAnchor = pointAlong(parentPath, junctionDistance)
        const bend = jitter(0.22)
        const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
        if (end.x < branchLimitX || end.x > width * 1.06 || end.y < height * 0.025) return
        const desiredX = Math.cos(angle + bend)
        const desiredY = Math.sin(angle + bend)
        const shoulderX = parentAnchor.tx * 0.66 + desiredX * 0.34
        const shoulderY = parentAnchor.ty * 0.66 + desiredY * 0.34
        const shoulderLength = Math.hypot(shoulderX, shoulderY) || 1
        const controlA = { x: start.x + (shoulderX / shoulderLength) * length * 0.24, y: start.y + (shoulderY / shoulderLength) * length * 0.24 }
        const controlB = { x: end.x - Math.cos(angle - bend * 0.6) * length * 0.28, y: end.y - Math.sin(angle - bend * 0.6) * length * 0.28 }
        const duration = 6600 - depth * 650 + random() * 1500
        const id = `branch-${branchId++}`
        const handoffHold = 125 + depth * 25
        const branchArrival = parentPath.flowDelay + junctionDistance / flowSpeed(parentPath.kind) + handoffHold
        const junctionFraction = junctionDistance / Math.max(1, parentPath.length)
        const parentWidthAtJoin = lerp(parentPath.widthStart, parentPath.widthEnd, junctionFraction)
        const naturalWidthStart = (9.4 - depth * 1.65) * scale
        const widthStart = Math.max(0.38, Math.min(naturalWidthStart, parentWidthAtJoin * 0.7))
        const naturalWidthEnd = (3.2 - depth * 0.48) * scale
        const widthEnd = Math.max(0.3, Math.min(naturalWidthEnd, widthStart * (depth === 0 ? 0.56 : 0.52)))
        const branchPath = addPath(botanicalPaths, sampleCubic(start, controlA, controlB, end, 14 + Math.max(0, 8 - depth * 2)), {
          id,
          kind: 'branch',
          birth,
          duration,
          widthStart,
          widthEnd,
          depth,
          color: depth > 2 ? palette.barkLight : palette.bark,
          parent,
          flowDelay: branchArrival,
          flowPeriod: networkPeriod,
          phase: random(),
        })
        treePaths.push(branchPath)

        if (depth >= 1) {
          const density = width < 760 ? (depth === 1 ? 2 : 3) : depth === 1 ? 4 : 6
          for (let leafIndex = 0; leafIndex < density; leafIndex++) {
            const distance = branchPath.length * (0.42 + random() * 0.56)
            const anchor = pointAlong(branchPath, distance)
            const side = random() > 0.5 ? 1 : -1
            const spread = 5 + random() * 14
            const leafX = anchor.x - anchor.ty * spread * side + jitter(5)
            const leafY = anchor.y + anchor.tx * spread * side + jitter(5)
            leaves.push({
              x: leafX,
              y: leafY,
              stemX: anchor.x,
              stemY: anchor.y,
              angle: Math.atan2(anchor.ty, anchor.tx) + side * (0.55 + random() * 0.72),
              size: (5.4 + random() * 6.7) * scale,
              birth: leadEpoch + branchPath.flowDelay + distance / flowSpeed(branchPath.kind) + 650 + random() * 1250,
              phase: random() * Math.PI * 2,
              cluster,
              tier: depth >= 3 ? 2 : random() > 0.5 ? 1 : 0,
              color: Math.floor(random() * leafColors.length),
            })
          }
        }

        if (depth < 4) {
          const spread = 0.33 + random() * 0.25
          const childLength = length * (0.62 + random() * 0.09)
          const childBirth = birth + duration * inverseEaseOutCubic(0.985) + 150 + random() * 360
          makeBranch(end, angle - spread, childLength, depth + 1, childBirth, id, cluster)
          makeBranch(end, angle + spread * (0.8 + random() * 0.32), childLength * (0.88 + random() * 0.13), depth + 1, childBirth + 280 + random() * 520, id, cluster)
        }
      }

      const primaryFractions = [0.23, 0.34, 0.45, 0.55, 0.66, 0.75]
      primaryFractions.forEach((fraction, index) => {
        const anchor = pointAlong(trunk, trunk.length * fraction)
        const side = index % 2 === 0 ? -1 : 1
        const angle = -Math.PI / 2 + side * (0.62 + random() * 0.26)
        const length = (0.13 + random() * 0.055) * width
        makeBranch(anchor, angle, length, 0, 15000 + index * 1300, trunk.id, index)
      })

      // A few crown shoots close the silhouette and keep the top airy rather than cloud-like.
      const crown = pointAlong(trunk, trunk.length * 0.82)
      makeBranch(crown, -2.15, width * 0.105, 1, 20500, trunk.id, 7)
      makeBranch(crown, -0.98, width * 0.11, 1, 21400, trunk.id, 8)

      // Leaf clusters at twig tips make the mature crown thick, layered, and readable.
      for (const branch of treePaths.filter((path) => path.kind === 'branch' && path.depth >= 2)) {
        const tip = pointAlong(branch, branch.length)
        const clusterLeaves = width < 760 ? 5 : 9
        for (let index = 0; index < clusterLeaves; index++) {
          const radialAngle = random() * Math.PI * 2
          const radius = (4 + random() * 13) * scale
          leaves.push({
            x: tip.x + Math.cos(radialAngle) * radius,
            y: tip.y + Math.sin(radialAngle) * radius * 0.72,
            stemX: tip.x,
            stemY: tip.y,
            angle: radialAngle + jitter(0.5),
            size: (6.5 + random() * 7.5) * scale,
            birth: leadEpoch + branch.flowDelay + branch.length / flowSpeed(branch.kind) + 650 + random() * 3200,
            phase: random() * Math.PI * 2,
            cluster: branch.depth * 10 + Math.floor(branch.phase * 9),
            tier: random() > 0.6 ? 2 : random() > 0.5 ? 1 : 0,
            color: Math.floor(random() * leafColors.length),
          })
        }
      }

      const succulentPositions = width < 760 ? [0.2, 0.32, 0.68, 0.8] : [0.33, 0.41, 0.59, 0.67]
      const succulentSizes = [26, 38, 32, 22]
      succulentPositions.forEach((x, index) => {
        const base = p(x, rootY - 0.012)
        const rootDistance = nearestDistance(rootMain, base)
        const tapStart = pointAlong(rootMain, rootDistance)
        const arrival = rootDistance / flowSpeed('root') + 110
        const feedBirth = 8500 + index * 720
        const feed = addCircuit(`succulent-feed-${index}`, [tapStart, { x: tapStart.x, y: base.y + 8 * scale }, base], 'seedling', feedBirth, 4200, rootMain.id, arrival, networkPeriod, palette.circuitDim)
        succulents.push({
          x: base.x,
          y: base.y,
          size: succulentSizes[index] * scale,
          birth: leadEpoch + feed.flowDelay + feed.length / flowSpeed(feed.kind) + 1700 + index * 460,
          phase: random() * Math.PI * 2,
          color: index % 3,
          variant: index,
        })
      })
      leaves.sort((a, b) => a.tier - b.tier || a.birth - b.birth)

      for (let index = 0; index < Math.max(15, Math.round(width / 68)); index++) {
        specks.push({ x: random() * width, y: height * (0.08 + random() * 0.76), size: 0.6 + random() * 1.2, phase: random() * Math.PI * 2, speed: 0.00016 + random() * 0.00028 })
      }

      packetSprites = new Map([
        [palette.mint, createGlowSprite(palette.mint)],
        [palette.cyan, createGlowSprite(palette.cyan)],
        [palette.ember, createGlowSprite(palette.ember)],
      ])

      const leadPaths = [
        ...circuitPaths.filter((path) => path.id === 'root-main' || path.id.endsWith('-tap') || path.id.startsWith('succulent-feed-')),
        ...cactusPaths,
        ...treePaths,
        ...vinePaths,
      ]
      const finalLeadArrival = leadPaths.reduce((latest, path) => Math.max(latest, path.flowDelay + path.length / flowSpeed(path.kind)), 0)
      maintenanceEpoch = leadEpoch + finalLeadArrival + 4200
    }

    function pathProgress(path: GrowingPath, elapsed: number) {
      return easeOutCubic((elapsed - path.birth) / path.duration)
    }

    function scaffoldVisibility(elapsed: number) {
      return 1 - smoothstep((elapsed - 6200) / 26000)
    }

    function botanicalProgress(path: GrowingPath, elapsed: number) {
      const distance = Math.max(0, elapsed - leadEpoch - path.flowDelay) * flowSpeed(path.kind)
      return clamp(distance / Math.max(1, path.length))
    }

    function passageAge(path: GrowingPath, distance: number, elapsed: number) {
      return elapsed - (leadEpoch + path.flowDelay + distance / flowSpeed(path.kind))
    }

    function passageMaturity(path: GrowingPath, distance: number, elapsed: number) {
      return smoothstep(passageAge(path, distance, elapsed) / 7200)
    }

    function drawPartialPolyline(path: GrowingPath, progress: number, color: string, lineWidth: number, alpha: number, glow = 0) {
      if (progress <= 0) return
      const visible = path.length * progress
      context.beginPath()
      context.moveTo(path.samples[0].x, path.samples[0].y)

      for (let index = 1; index < path.samples.length; index++) {
        if (path.cumulative[index] <= visible) {
          context.lineTo(path.samples[index].x, path.samples[index].y)
        } else {
          const point = pointAlong(path, visible)
          context.lineTo(point.x, point.y)
          break
        }
      }

      context.globalAlpha = alpha
      context.strokeStyle = color
      context.lineWidth = lineWidth
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.shadowColor = color
      context.shadowBlur = glow
      context.stroke()
      context.shadowBlur = 0
    }

    function drawCircuitLayer(elapsed: number) {
      const circuitAlpha = 0.86 * scaffoldVisibility(elapsed)
      if (circuitAlpha <= 0.004) return
      for (const path of circuitPaths) {
        const progress = pathProgress(path, elapsed)
        if (progress <= 0) continue
        drawPartialPolyline(path, progress, path.color, path.widthStart, circuitAlpha, circuitAlpha > 0.42 ? 7 : 2)

        for (let index = 1; index < path.samples.length; index++) {
          const nodeDistance = path.cumulative[index]
          if (nodeDistance > path.length * progress) continue
          const node = path.samples[index]
          context.save()
          context.translate(node.x, node.y)
          context.rotate(Math.PI / 4)
          context.globalAlpha = circuitAlpha * 0.68
          context.fillStyle = path.color
          context.fillRect(-1.6, -1.6, 3.2, 3.2)
          context.restore()
        }
      }
    }

    function drawTaperedPath(path: GrowingPath, progress: number, elapsed: number, shadowColor: string, fillColor: string, detailColor: string) {
      if (progress <= 0) return
      const visibleDistance = path.length * progress
      const sketchWidth = path.kind === 'branch' || path.kind === 'vine' ? 0.82 : 1.15

      context.lineCap = 'round'
      context.lineJoin = 'round'
      for (let pass = 0; pass < 2; pass++) {
        for (let index = 1; index < path.samples.length; index++) {
          const startDistance = path.cumulative[index - 1]
          if (startDistance >= visibleDistance) break
          const endDistance = Math.min(path.cumulative[index], visibleDistance)
          const middleDistance = (startDistance + endDistance) * 0.5
          const amount = middleDistance / path.length
          const settled = passageMaturity(path, middleDistance, elapsed)
          const fullWidth = lerp(path.widthStart, path.widthEnd, amount)
          const widthAtPoint = lerp(Math.min(sketchWidth, fullWidth), fullWidth, settled)
          const start = path.samples[index - 1]
          const end = pointAlong(path, endDistance)
          context.beginPath()
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.strokeStyle = pass === 0 ? shadowColor : fillColor
          context.globalAlpha = pass === 0 ? lerp(0.05, 0.72, settled) : lerp(0.24, 0.91, settled)
          const outlinePadding = Math.min(3.5, Math.max(0.68, widthAtPoint * 0.38))
          context.lineWidth = Math.max(0.45, widthAtPoint + (pass === 0 ? outlinePadding : 0))
          context.stroke()
        }
      }

      if (path.kind === 'trunk' || (path.kind === 'branch' && path.depth < 2)) {
        context.strokeStyle = detailColor
        context.lineWidth = 0.7
        for (let distance = 15; distance < path.length * progress; distance += 18 + path.depth * 5) {
          const detail = smoothstep((passageAge(path, distance, elapsed) - 3600) / 4200)
          if (detail <= 0) continue
          const point = pointAlong(path, distance)
          const normalX = -point.ty
          const normalY = point.tx
          const mark = Math.max(3, lerp(path.widthStart, path.widthEnd, distance / path.length) * 0.32)
          context.globalAlpha = detail * 0.38
          context.beginPath()
          context.moveTo(point.x - normalX * mark, point.y - normalY * mark)
          context.lineTo(point.x + normalX * mark * 0.45 + point.tx * 3, point.y + normalY * mark * 0.45 + point.ty * 3)
          context.stroke()
        }
      }
    }

    function drawBranchCollar(path: GrowingPath, elapsed: number) {
      if (path.kind !== 'branch' || !path.parent) return
      const progress = botanicalProgress(path, elapsed)
      if (progress <= 0.015) return

      const parent = treePaths.find((candidate) => candidate.id === path.parent)
      if (!parent) return
      const start = path.samples[0]
      const junctionDistance = nearestDistance(parent, start)
      const parentVisible = parent.length * botanicalProgress(parent, elapsed)
      if (parentVisible + 2 < Math.min(junctionDistance, parent.length * 0.985)) return

      const bodyScale = passageMaturity(path, 0, elapsed)
      if (bodyScale <= 0.02) return

      const collarDistance = Math.min(path.length * progress, Math.max(7, path.widthStart * bodyScale * 1.9))
      if (collarDistance < 1.5) return
      const parentAnchor = pointAlong(parent, junctionDistance)
      const shoulder = pointAlong(path, Math.min(path.length, Math.max(1.5, collarDistance * 0.18)))
      const neck = pointAlong(path, collarDistance)
      const neckWidth = lerp(path.widthStart, path.widthEnd, collarDistance / path.length) * bodyScale * 0.5
      const baseSpan = Math.max(0.65, path.widthStart * bodyScale * 0.48)
      const edgeA = { x: neck.x - neck.ty * neckWidth, y: neck.y + neck.tx * neckWidth }
      const edgeB = { x: neck.x + neck.ty * neckWidth, y: neck.y - neck.tx * neckWidth }
      const baseA = { x: start.x - parentAnchor.tx * baseSpan, y: start.y - parentAnchor.ty * baseSpan }
      const baseB = { x: start.x + parentAnchor.tx * baseSpan, y: start.y + parentAnchor.ty * baseSpan }
      const gradient = context.createLinearGradient(start.x, start.y, neck.x, neck.y)
      gradient.addColorStop(0, parent.color)
      gradient.addColorStop(0.5, path.color)
      gradient.addColorStop(1, path.color)

      context.save()
      context.fillStyle = gradient
      context.globalAlpha = 0.94 * bodyScale
      context.beginPath()
      context.moveTo(baseA.x, baseA.y)
      context.bezierCurveTo(
        start.x + shoulder.tx * collarDistance * 0.26 - shoulder.ty * baseSpan * 0.38,
        start.y + shoulder.ty * collarDistance * 0.26 + shoulder.tx * baseSpan * 0.38,
        edgeA.x - neck.tx * collarDistance * 0.22,
        edgeA.y - neck.ty * collarDistance * 0.22,
        edgeA.x,
        edgeA.y
      )
      context.lineTo(edgeB.x, edgeB.y)
      context.bezierCurveTo(
        edgeB.x - neck.tx * collarDistance * 0.22,
        edgeB.y - neck.ty * collarDistance * 0.22,
        start.x + shoulder.tx * collarDistance * 0.26 + shoulder.ty * baseSpan * 0.38,
        start.y + shoulder.ty * collarDistance * 0.26 - shoulder.tx * baseSpan * 0.38,
        baseB.x,
        baseB.y
      )
      context.closePath()
      context.fill()

      context.strokeStyle = palette.barkLight
      context.lineWidth = Math.max(0.38, neckWidth * 0.12)
      context.globalAlpha = 0.16 * bodyScale
      context.beginPath()
      context.moveTo(start.x + shoulder.tx * 1.5, start.y + shoulder.ty * 1.5)
      context.quadraticCurveTo(
        lerp(start.x, neck.x, 0.52) - neck.ty * neckWidth * 0.18,
        lerp(start.y, neck.y, 0.52) + neck.tx * neckWidth * 0.18,
        neck.x,
        neck.y
      )
      context.stroke()
      context.restore()
    }

    function drawCactusDetails(path: GrowingPath, progress: number, maturity: number) {
      if (maturity < 0.32 || progress < 0.25) return
      const detail = smoothstep((maturity - 0.32) / 0.68)
      const visible = path.length * progress
      const offsets = [-0.3, -0.12, 0.12, 0.3]

      for (const offset of offsets) {
        context.beginPath()
        let started = false
        for (let distance = 0; distance <= visible; distance += 7) {
          const point = pointAlong(path, distance)
          const bodyWidth = lerp(path.widthStart, path.widthEnd, distance / path.length)
          const x = point.x - point.ty * bodyWidth * offset
          const y = point.y + point.tx * bodyWidth * offset
          if (!started) {
            context.moveTo(x, y)
            started = true
          } else context.lineTo(x, y)
        }
        context.strokeStyle = offset < 0 ? palette.cactusDark : palette.cactusLight
        context.lineWidth = 0.72
        context.globalAlpha = detail * 0.46
        context.stroke()
      }

      if (maturity < 0.58) return
      const spineAlpha = smoothstep((maturity - 0.58) / 0.42)
      for (let distance = 18; distance < visible - 8; distance += 17) {
        const point = pointAlong(path, distance)
        const bodyWidth = lerp(path.widthStart, path.widthEnd, distance / path.length)
        for (const side of [-1, 1]) {
          const centerX = point.x - point.ty * bodyWidth * 0.32 * side
          const centerY = point.y + point.tx * bodyWidth * 0.32 * side
          context.fillStyle = palette.cream
          context.globalAlpha = spineAlpha * 0.48
          context.beginPath()
          context.arc(centerX, centerY, 1.15, 0, Math.PI * 2)
          context.fill()
          context.strokeStyle = palette.cream
          context.lineWidth = 0.42
          for (let ray = 0; ray < 4; ray++) {
            const angle = ray * Math.PI * 0.5 + path.phase * 2.4
            const length = 3.2 + ((ray + Math.round(distance)) % 3)
            context.beginPath()
            context.moveTo(centerX, centerY)
            context.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length)
            context.stroke()
          }
        }
      }

      context.strokeStyle = palette.cactusDark
      context.lineWidth = 1.05
      context.globalAlpha = spineAlpha * 0.36
      for (let distance = 68 + path.phase * 32; distance < visible - 24; distance += 112) {
        const point = pointAlong(path, distance)
        const normalX = -point.ty
        const normalY = point.tx
        const bodyWidth = lerp(path.widthStart, path.widthEnd, distance / path.length)
        const scarWidth = bodyWidth * 0.22
        context.beginPath()
        context.moveTo(point.x - normalX * scarWidth, point.y - normalY * scarWidth)
        context.quadraticCurveTo(point.x + point.tx * 3, point.y + point.ty * 3, point.x + normalX * scarWidth, point.y + normalY * scarWidth)
        context.stroke()
      }
    }

    function leafVisualState(leaf: Leaf, elapsed: number) {
      const growth = smoothstep((elapsed - leaf.birth) / 5200)
      if (growth <= 0) return null
      const clusterSway = Math.sin(elapsed * 0.00038 + leaf.cluster * 0.87) * 0.045 + Math.sin(elapsed * 0.00013 + leaf.cluster * 1.91) * 0.025
      const localSway = Math.sin(elapsed * 0.00051 + leaf.phase) * 0.018
      const size = leaf.size * growth
      const leafX = lerp(leaf.stemX, leaf.x, growth)
      const leafY = lerp(leaf.stemY, leaf.y, growth)
      const angle = leaf.angle + clusterSway + localSway
      return {
        growth,
        size,
        leafX,
        leafY,
        angle,
        baseX: leafX - Math.cos(angle) * size * 0.12,
        baseY: leafY - Math.sin(angle) * size * 0.12,
      }
    }

    function drawLeafPetiole(leaf: Leaf, elapsed: number) {
      const state = leafVisualState(leaf, elapsed)
      if (!state) return

      context.save()
      context.strokeStyle = leaf.tier === 2 ? palette.leafMid : palette.barkLight
      context.lineWidth = Math.max(0.62, leaf.size * 0.082)
      context.globalAlpha = 0.62 * state.growth
      context.beginPath()
      context.moveTo(leaf.stemX, leaf.stemY)
      context.quadraticCurveTo(
        lerp(leaf.stemX, state.baseX, 0.58) + Math.sin(leaf.phase) * 1.5,
        lerp(leaf.stemY, state.baseY, 0.58) + Math.cos(leaf.phase) * 1.5,
        state.baseX,
        state.baseY
      )
      context.stroke()
      context.restore()
    }

    function drawLeafBlade(leaf: Leaf, elapsed: number) {
      const state = leafVisualState(leaf, elapsed)
      if (!state) return

      context.save()
      context.translate(state.leafX, state.leafY)
      context.rotate(state.angle)
      context.scale(1, 0.88 + state.growth * 0.12)
      context.globalAlpha = 0.76 + leaf.tier * 0.07
      context.fillStyle = leafColors[leaf.color]
      context.strokeStyle = leaf.tier === 2 ? palette.leafMid : palette.leafDark
      context.lineWidth = 0.72
      context.beginPath()
      context.moveTo(-state.size * 0.12, 0)
      context.bezierCurveTo(state.size * 0.18, -state.size * 0.52, state.size * 0.78, -state.size * 0.42, state.size, 0)
      context.bezierCurveTo(state.size * 0.76, state.size * 0.43, state.size * 0.2, state.size * 0.5, -state.size * 0.12, 0)
      context.closePath()
      context.fill()
      context.stroke()

      context.globalAlpha *= 0.48
      context.strokeStyle = palette.leafLight
      context.lineWidth = 0.48
      context.beginPath()
      context.moveTo(0, 0)
      context.lineTo(state.size * 0.82, 0)
      context.stroke()
      context.restore()
    }

    function drawSucculent(succulent: Succulent, elapsed: number) {
      const paletteSets = [
        ['#173c34', '#397a68', '#73b99a'],
        ['#243d32', '#52795c', '#91b987'],
        ['#203845', '#426b78', '#79aeb1'],
      ]
      const colors = paletteSets[succulent.color]
      const breathe = 0.985 + Math.sin(elapsed * 0.00042 + succulent.phase) * 0.015
      const baseGrowth = smoothstep((elapsed - succulent.birth) / 4300)
      if (baseGrowth <= 0) return

      context.save()
      context.translate(succulent.x, succulent.y)
      context.fillStyle = palette.ink
      context.globalAlpha = 0.42 * baseGrowth
      context.beginPath()
      context.ellipse(0, 1.5, succulent.size * 0.48 * baseGrowth, succulent.size * 0.11 * baseGrowth, 0, 0, Math.PI * 2)
      context.fill()

      if (succulent.variant === 1) {
        context.translate(0, -succulent.size * 0.06 * baseGrowth)
        context.scale(breathe, breathe)
        const leafCount = 9
        for (let index = 0; index < leafCount; index++) {
          const growth = smoothstep((elapsed - succulent.birth - index * 105) / 3600)
          if (growth <= 0) continue
          const fan = index / (leafCount - 1) - 0.5
          const angle = -Math.PI / 2 + fan * 1.72 + Math.sin(index * 5.73 + succulent.phase) * 0.055
          const length = succulent.size * (0.72 + (1 - Math.abs(fan)) * 0.5) * growth
          const leafWidth = succulent.size * (0.12 + (1 - Math.abs(fan)) * 0.055) * growth
          context.save()
          context.rotate(angle)
          context.fillStyle = colors[index % 3]
          context.strokeStyle = palette.ink
          context.lineWidth = 0.55
          context.globalAlpha = 0.92
          context.beginPath()
          context.moveTo(0, 0)
          context.bezierCurveTo(length * 0.22, -leafWidth, length * 0.72, -leafWidth * 0.5, length, 0)
          context.bezierCurveTo(length * 0.69, leafWidth * 0.46, length * 0.2, leafWidth, 0, 0)
          context.closePath()
          context.fill()
          context.stroke()
          context.strokeStyle = palette.mint
          context.globalAlpha = 0.32
          context.lineWidth = 0.4
          context.beginPath()
          context.moveTo(length * 0.12, 0)
          context.lineTo(length * 0.82, 0)
          context.stroke()
          context.restore()
        }
        context.restore()
        return
      }

      if (succulent.variant === 3) {
        context.scale(breathe, breathe)
        const stemGrowth = smoothstep((elapsed - succulent.birth) / 3300)
        context.strokeStyle = palette.leafMid
        context.lineWidth = Math.max(1.2, succulent.size * 0.13)
        context.lineCap = 'round'
        context.globalAlpha = 0.86
        context.beginPath()
        context.moveTo(0, 0)
        context.quadraticCurveTo(succulent.size * 0.08, -succulent.size * 0.56 * stemGrowth, -succulent.size * 0.04, -succulent.size * 1.15 * stemGrowth)
        context.stroke()
        for (let pair = 0; pair < 3; pair++) {
          const growth = smoothstep((elapsed - succulent.birth - 700 - pair * 420) / 3000)
          if (growth <= 0) continue
          const y = -succulent.size * (0.35 + pair * 0.31) * stemGrowth
          for (const side of [-1, 1]) {
            const x = side * succulent.size * (0.16 + pair * 0.015)
            context.save()
            context.translate(x, y)
            context.rotate(side * (-0.38 + pair * 0.08))
            context.scale(growth, growth)
            context.fillStyle = colors[Math.min(2, pair + 1)]
            context.strokeStyle = palette.ink
            context.lineWidth = 0.5
            context.globalAlpha = 0.92
            context.beginPath()
            context.ellipse(side * succulent.size * 0.18, 0, succulent.size * 0.27, succulent.size * 0.15, 0, 0, Math.PI * 2)
            context.fill()
            context.stroke()
            context.restore()
          }
        }
        context.restore()
        return
      }

      context.translate(0, -succulent.size * 0.2 * baseGrowth)
      context.scale(breathe, breathe * 0.64)

      const rings = [
        { count: 9, length: 1, width: 0.36, offset: 0 },
        { count: 7, length: 0.72, width: 0.33, offset: 0.24 },
        { count: 5, length: 0.46, width: 0.27, offset: 0.51 },
      ]

      rings.forEach((ring, ringIndex) => {
        const growth = smoothstep((elapsed - succulent.birth - ringIndex * 850) / 4300)
        if (growth <= 0) return
        for (let index = 0; index < ring.count; index++) {
          const angleVariation = Math.sin((index + 1) * 7.31 + ringIndex * 3.17 + succulent.phase) * 0.09
          const lengthVariation = 1 + Math.sin((index + 1) * 11.73 + ringIndex * 5.29 + succulent.phase) * 0.08
          const angle = (index / ring.count) * Math.PI * 2 + ring.offset + succulent.phase * 0.08 + angleVariation
          const length = succulent.size * ring.length * growth * lengthVariation
          const petalWidth = succulent.size * ring.width * growth
          context.save()
          context.rotate(angle)
          context.fillStyle = colors[Math.min(colors.length - 1, ringIndex)]
          context.strokeStyle = palette.ink
          context.lineWidth = 0.55
          context.globalAlpha = 0.88
          context.beginPath()
          context.moveTo(0, 0)
          context.bezierCurveTo(length * 0.22, -petalWidth, length * 0.76, -petalWidth * 0.72, length, 0)
          context.bezierCurveTo(length * 0.76, petalWidth * 0.72, length * 0.22, petalWidth, 0, 0)
          context.closePath()
          context.fill()
          context.stroke()
          context.strokeStyle = palette.mint
          context.globalAlpha = 0.34
          context.lineWidth = 0.42
          context.beginPath()
          context.moveTo(length * 0.08, 0)
          context.lineTo(length * 0.82, 0)
          context.stroke()
          context.restore()
        }
      })
      context.fillStyle = colors[2]
      context.globalAlpha = 0.95
      context.beginPath()
      context.arc(0, 0, succulent.size * 0.13 * baseGrowth, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    function drawBlossom(blossom: Blossom, elapsed: number) {
      const growth = smoothstep((elapsed - blossom.birth) / 6000)
      if (growth <= 0) return
      const breathe = 0.94 + Math.sin(elapsed * 0.0007 + blossom.phase) * 0.06
      context.save()
      context.translate(blossom.x, blossom.y)
      context.rotate(blossom.phase + Math.sin(elapsed * 0.0002) * 0.08)
      context.scale(growth * breathe, growth * breathe)
      context.fillStyle = blossom.color
      context.strokeStyle = palette.cream
      context.lineWidth = 0.55
      context.globalAlpha = 0.74
      for (let index = 0; index < 5; index++) {
        context.rotate((Math.PI * 2) / 5)
        context.beginPath()
        context.ellipse(blossom.size * 0.7, 0, blossom.size * 0.72, blossom.size * 0.3, 0, 0, Math.PI * 2)
        context.fill()
        context.stroke()
      }
      context.fillStyle = palette.cream
      context.beginPath()
      context.arc(0, 0, blossom.size * 0.24, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    function drawBotanicalLayer(elapsed: number) {
      const drawPlantPath = (path: GrowingPath) => {
        const progress = botanicalProgress(path, elapsed)
        if (progress <= 0) return
        const detailDistance = Math.min(path.length * progress, path.length * 0.35)
        const localMaturity = passageMaturity(path, detailDistance, elapsed)

        if (path.kind === 'cactus') {
          drawTaperedPath(path, progress, elapsed, palette.ink, path.color, palette.cactusLight)
          drawCactusDetails(path, progress, localMaturity)
        } else if (path.kind === 'trunk' || path.kind === 'branch') {
          drawTaperedPath(path, progress, elapsed, palette.ink, path.color, palette.barkLight)
        } else if (path.kind === 'vine') {
          drawTaperedPath(path, progress, elapsed, palette.ink, palette.leafMid, palette.leafLight)
        }
      }

      for (const path of botanicalPaths.filter((path) => path.kind === 'cactus' || path.kind === 'vine')) drawPlantPath(path)
      for (const path of [...treePaths].filter((path) => path.kind === 'branch').sort((a, b) => b.depth - a.depth)) drawPlantPath(path)
      for (const path of treePaths.filter((path) => path.kind === 'trunk')) drawPlantPath(path)
      for (const path of [...treePaths].filter((path) => path.kind === 'branch').sort((a, b) => a.depth - b.depth)) drawBranchCollar(path, elapsed)

      for (const leaf of leaves) drawLeafPetiole(leaf, elapsed)
      for (const leaf of leaves) drawLeafBlade(leaf, elapsed)
      for (const succulent of succulents) drawSucculent(succulent, elapsed)
      for (const blossom of blossoms) drawBlossom(blossom, elapsed)
    }

    function packetColor(cycle: number) {
      const hash = Math.abs(Math.sin((cycle + 1) * 12.9898))
      if (hash > 0.94) return palette.ember
      return Math.abs(cycle) % 2 === 0 ? palette.cyan : palette.mint
    }

    function pulseState(path: GrowingPath, elapsed: number, echo = false): PulseState | null {
      const speed = flowSpeed(path.kind)
      const transitTime = (path.length + 70) / speed

      if (!echo) {
        const leadTime = elapsed - leadEpoch - path.flowDelay
        if (leadTime >= 0 && leadTime <= transitTime) return { cycle: 0, cycleTime: leadTime, lead: true }
      }

      const maintenanceTime = elapsed - maintenanceEpoch - path.flowDelay - (echo ? 280 : 0)
      if (maintenanceTime < 0) return null
      const cycle = 1 + Math.floor(maintenanceTime / path.flowPeriod)
      const cycleTime = ((maintenanceTime % path.flowPeriod) + path.flowPeriod) % path.flowPeriod
      if (cycleTime > transitTime) return null
      return { cycle, cycleTime, lead: false }
    }

    function pathHash(value: string) {
      let hash = 2166136261
      for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
      }
      return hash >>> 0
    }

    function branchCarriesWave(path: GrowingPath, cycle: number, mobile: boolean): boolean {
      if (path.kind !== 'branch') return true
      const selectionDepth = mobile ? 1 : 2
      if (path.depth < selectionDepth) return true
      const parent = treePaths.find((candidate) => candidate.id === path.parent)
      if (parent?.kind === 'branch' && !branchCarriesWave(parent, cycle, mobile)) return false
      const siblings = treePaths.filter((candidate) => candidate.kind === 'branch' && candidate.parent === path.parent && candidate.depth === path.depth)
      if (siblings.length <= 1) return true
      const selected = ((pathHash(`${path.parent}:${path.depth}`) + cycle) % siblings.length + siblings.length) % siblings.length
      return siblings[selected]?.id === path.id
    }

    function drawJunctionRipple(point: Sample, color: string, age: number, energy: number) {
      if (age < 0 || age > 520) return
      const progress = age / 520
      context.globalCompositeOperation = 'lighter'
      context.strokeStyle = color
      context.lineWidth = 1.2
      context.globalAlpha = (1 - progress) * 0.62 * energy
      context.beginPath()
      context.arc(point.x, point.y, 3 + progress * 12, 0, Math.PI * 2)
      context.stroke()
      context.globalCompositeOperation = 'source-over'
    }

    function drawPacket(path: GrowingPath, elapsed: number, echo = false) {
      const pulse = pulseState(path, elapsed, echo)
      if (!pulse) return
      const speed = flowSpeed(path.kind)
      const distance = pulse.cycleTime * speed
      if (distance < 0 || distance > path.length + 70) return
      const isBotanicalPath = botanicalPaths.includes(path)
      const growthProgress = isBotanicalPath ? 1 : pathProgress(path, elapsed)
      if (growthProgress <= 0) return
      const visibleDistance = path.length * growthProgress
      const renderedDistance = Math.min(distance, visibleDistance)

      const energy = pulse.lead ? 0.96 : echo ? 0.08 : 0.22
      const color = packetColor(pulse.cycle)
      const sprite = packetSprites.get(color)
      if (!sprite) return
      const trailSamples = pulse.lead ? (width < 760 || frameBudgetTier > 0 ? 7 : 10) : width < 760 || frameBudgetTier > 0 ? 4 : 5
      const trailLength = pulse.lead ? (path.kind === 'root' ? 58 : 42) : path.kind === 'root' ? 32 : 25
      context.save()
      context.globalCompositeOperation = 'lighter'

      for (let index = trailSamples - 1; index >= 0; index--) {
        const amount = index / Math.max(1, trailSamples - 1)
        const sampleDistance = renderedDistance - amount * trailLength
        if (sampleDistance < 0 || sampleDistance > path.length) continue
        const point = pointAlong(path, sampleDistance)
        const tailEnergy = (1 - amount) ** 2 * energy
        const size = pulse.lead ? lerp(7, 20, tailEnergy) : lerp(4, 12, tailEnergy)
        context.globalAlpha = tailEnergy * (pulse.lead ? 0.76 : 0.42)
        context.drawImage(sprite, point.x - size / 2, point.y - size / 2, size, size)
      }

      if (renderedDistance <= path.length) {
        const head = pointAlong(path, renderedDistance)
        const angle = Math.atan2(head.ty, head.tx)
        context.translate(head.x, head.y)
        context.rotate(angle)
        context.globalAlpha = energy
        context.fillStyle = palette.cream
        context.beginPath()
        context.ellipse(0, 0, pulse.lead ? 2.8 : 1.45, pulse.lead ? 1.45 : 0.8, 0, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()

      if (path.parent) drawJunctionRipple(path.samples[0], color, pulse.cycleTime, energy)

      for (let index = 1; index < path.samples.length - 1; index++) {
        if (path.cumulative[index] > visibleDistance) continue
        const arrival = path.cumulative[index] / speed
        drawJunctionRipple(path.samples[index], color, pulse.cycleTime - arrival, energy)
      }

      if (pulse.lead && growthProgress >= 0.999 && distance > path.length) {
        const terminalAge = (distance - path.length) / speed
        const end = path.samples[path.samples.length - 1]
        if (terminalAge < 720) {
          context.save()
          context.globalCompositeOperation = 'lighter'
          for (let glint = 0; glint < 3; glint++) {
            const angle = path.phase * 12 + glint * 2.1
            const radius = terminalAge * 0.012 * (glint + 1)
            const size = 7 * (1 - terminalAge / 720)
            context.globalAlpha = (1 - terminalAge / 720) * 0.45
            context.drawImage(sprite, end.x + Math.cos(angle) * radius - size / 2, end.y + Math.sin(angle) * radius - size / 2, size, size)
          }
          context.restore()
        }
      }
    }

    function drawFlow(elapsed: number) {
      const groundFlowPaths = circuitPaths.filter((path) => path.id === 'root-main' || path.id.endsWith('-tap') || path.id.startsWith('succulent-feed-'))
      const mobile = width < 760
      const treeFlowPaths = [...treePaths].sort((a, b) => a.depth - b.depth || a.flowDelay - b.flowDelay)
      const allFlowPaths = [...groundFlowPaths, ...cactusPaths, ...vinePaths, ...treeFlowPaths]
      const maxPaths = mobile ? 32 : 64
      let maintenanceRendered = 0

      for (const path of allFlowPaths) {
        const pulse = pulseState(path, elapsed)
        if (!pulse) continue
        if (!pulse.lead) {
          if (maintenanceRendered >= maxPaths) continue
          if (!branchCarriesWave(path, pulse.cycle, mobile)) continue
        }
        drawPacket(path, elapsed)
        if (!pulse.lead && ((pulse.cycle % 5) + 5) % 5 === 2) drawPacket(path, elapsed, true)
        if (!pulse.lead) maintenanceRendered++
      }
    }

    function drawAtmosphere(elapsed: number, maturity: number) {
      for (const speck of specks) {
        const glow = Math.max(0, Math.sin(elapsed * speck.speed + speck.phase))
        if (glow < 0.32) continue
        context.globalAlpha = glow * (0.08 + maturity * 0.16)
        context.fillStyle = palette.mint
        context.fillRect(speck.x, speck.y + Math.sin(elapsed * 0.00018 + speck.phase) * 5, speck.size, speck.size)
      }
    }

    function render(time: number, staticFrame = false) {
      const elapsed = staticFrame ? 70000 : Math.max(0, time - sceneStart) + (previewMature ? 70000 : 0)
      const maturity = staticFrame ? 1 : smoothstep((elapsed - 9000) / 44000)
      hero?.style.setProperty('--scaffold-opacity', scaffoldVisibility(elapsed).toFixed(3))
      context.clearRect(0, 0, width, height)
      drawAtmosphere(elapsed, maturity)
      drawCircuitLayer(elapsed)
      drawBotanicalLayer(elapsed)
      if (!staticFrame) drawFlow(elapsed)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.shadowBlur = 0
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect()
      const mobile = bounds.width < 760
      const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      sceneSeed = 2718 + Math.round(width * 0.7 + height * 0.3)
      buildScene()
      if (reduceMotion.matches) render(performance.now(), true)
    }

    function animate(time: number) {
      if (!isVisible || !isPageVisible || reduceMotion.matches) return
      const sceneAge = time - sceneStart + (previewMature ? 70000 : 0)
      const minimumFrameTime = sceneAge > 56000 ? 30 : 15
      if (lastFrame && time - lastFrame < minimumFrameTime) {
        animationFrame = window.requestAnimationFrame(animate)
        return
      }
      const frameTime = lastFrame ? time - lastFrame : 16
      lastFrame = time
      if (frameTime > 22) frameBudgetTier = 1
      else if (frameTime < 17) frameBudgetTier = Math.max(0, frameBudgetTier - 0.01)
      render(time)
      animationFrame = window.requestAnimationFrame(animate)
    }

    function startAnimation() {
      window.cancelAnimationFrame(animationFrame)
      if (!reduceMotion.matches && isVisible && isPageVisible) {
        lastFrame = 0
        animationFrame = window.requestAnimationFrame(animate)
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        startAnimation()
      },
      { threshold: 0.02 }
    )
    visibilityObserver.observe(canvas)

    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden
      startAnimation()
    })

    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) {
        window.cancelAnimationFrame(animationFrame)
        render(performance.now(), true)
      } else {
        sceneStart = performance.now()
        startAnimation()
      }
    })

    resize()
    startAnimation()
  }
}
