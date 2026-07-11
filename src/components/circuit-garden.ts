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
  angle: number
  size: number
  birth: number
  phase: number
  cluster: number
  tier: number
  color: number
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

const canvas = document.querySelector<HTMLCanvasElement>('.circuit-garden')

if (canvas && canvas.dataset.ready !== 'true') {
  canvas.dataset.ready = 'true'

  const context = canvas.getContext('2d')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const previewMature = new URLSearchParams(window.location.search).get('garden-preview') === 'mature'

  if (context) {
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

      addCircuit('root-main', [p(-0.02, rootY), p(0.12, rootY), p(0.12, rootY - 0.025), p(0.36, rootY - 0.025), p(0.36, rootY + 0.012), p(0.64, rootY + 0.012), p(0.64, rootY - 0.018), p(1.02, rootY - 0.018)], 'root', 0, 7000, undefined, 0, 7900, palette.circuitDim)
      addCircuit('root-low', [p(0.02, 0.925), p(0.02, rootY + 0.03), p(0.48, rootY + 0.03), p(0.48, rootY)], 'root', 900, 6200, 'root-main', 650, 7900, palette.circuitDim)
      addCircuit('root-high', [p(0.98, 0.91), p(0.98, rootY + 0.018), p(0.72, rootY + 0.018), p(0.72, rootY - 0.018)], 'root', 1200, 5900, 'root-main', 980, 7900, palette.circuitDim)

      const cactusX = 0.145 + jitter(0.012)
      const cactusTop = 0.235 + jitter(0.025)
      const cactusCircuit = addCircuit('cactus-wire', [p(cactusX, rootY), p(cactusX, 0.66), p(cactusX + 0.008, 0.66), p(cactusX + 0.008, cactusTop)], 'cactus', 3200, 12500, 'root-main', 1250, 13700)
      addCircuit('cactus-left-wire', [p(cactusX, 0.6), p(cactusX - 0.085, 0.6), p(cactusX - 0.085, 0.43)], 'cactus', 8200, 6500, cactusCircuit.id, 3650, 13700)
      addCircuit('cactus-right-wire', [p(cactusX, 0.51), p(cactusX + 0.088, 0.51), p(cactusX + 0.088, 0.33)], 'cactus', 9200, 6900, cactusCircuit.id, 4050, 13700)

      const cactusMain = addPath(botanicalPaths, sampleCubic(p(cactusX, rootY), p(cactusX - 0.006, 0.7), p(cactusX + 0.014, 0.43), p(cactusX + 0.008, cactusTop), 42), {
        id: 'cactus-main',
        kind: 'cactus',
        birth: 10500,
        duration: 20500,
        widthStart: 56 * scale,
        widthEnd: 37 * scale,
        depth: 0,
        color: palette.cactusMid,
        parent: 'root-main',
        flowDelay: 1600,
        flowPeriod: 13700,
        phase: random(),
      })
      cactusPaths.push(cactusMain)

      const cactusLeft = addPath(botanicalPaths, sampleSmoothPath([p(cactusX - 0.002, 0.6), p(cactusX - 0.082, 0.6), p(cactusX - 0.102, 0.55), p(cactusX - 0.102, 0.41)], 12), {
        id: 'cactus-left',
        kind: 'cactus',
        birth: 16000,
        duration: 13000,
        widthStart: 39 * scale,
        widthEnd: 29 * scale,
        depth: 1,
        color: palette.cactusMid,
        parent: cactusMain.id,
        flowDelay: 4200,
        flowPeriod: 13700,
        phase: random(),
      })
      cactusPaths.push(cactusLeft)

      const cactusRight = addPath(botanicalPaths, sampleSmoothPath([p(cactusX + 0.005, 0.52), p(cactusX + 0.084, 0.52), p(cactusX + 0.102, 0.47), p(cactusX + 0.102, 0.31)], 12), {
        id: 'cactus-right',
        kind: 'cactus',
        birth: 17500,
        duration: 14500,
        widthStart: 41 * scale,
        widthEnd: 28 * scale,
        depth: 1,
        color: palette.cactusLight,
        parent: cactusMain.id,
        flowDelay: 4650,
        flowPeriod: 13700,
        phase: random(),
      })
      cactusPaths.push(cactusRight)
      ;[cactusMain, cactusLeft, cactusRight].forEach((path, index) => {
        const tip = pointAlong(path, path.length)
        blossoms.push({
          x: tip.x,
          y: tip.y - 2 * scale,
          birth: 39500 + index * 2300,
          size: (index === 0 ? 7.5 : 6.2) * scale,
          phase: random() * Math.PI * 2,
          color: index === 2 ? '#e6f0d7' : '#cde7c6',
        })
      })

      // The final tree is built from a real tapered recursive branch system.
      const treeX = 0.815 + jitter(0.015)
      const treeTop = 0.155 + jitter(0.018)
      addCircuit('tree-wire', [p(treeX, rootY), p(treeX, 0.69), p(treeX - 0.012, 0.69), p(treeX - 0.012, 0.45), p(treeX, 0.45), p(treeX, treeTop + 0.05)], 'trunk', 3600, 14500, 'root-main', 1750, 17900)
      addCircuit('tree-left-wire', [p(treeX, 0.58), p(treeX - 0.12, 0.58), p(treeX - 0.12, 0.39), p(treeX - 0.2, 0.39)], 'branch', 9300, 9000, 'tree-wire', 4600, 17900)
      addCircuit('tree-right-wire', [p(treeX, 0.48), p(treeX + 0.1, 0.48), p(treeX + 0.1, 0.29), p(treeX + 0.17, 0.29)], 'branch', 10500, 9200, 'tree-wire', 5050, 17900)

      const trunk = addPath(botanicalPaths, sampleCubic(p(treeX, rootY), p(treeX - 0.018, 0.66), p(treeX + 0.016, 0.39), p(treeX, treeTop), 48), {
        id: 'tree-trunk',
        kind: 'trunk',
        birth: 10000,
        duration: 22500,
        widthStart: 25 * scale,
        widthEnd: 5.2 * scale,
        depth: 0,
        color: palette.bark,
        parent: 'root-main',
        flowDelay: 2100,
        flowPeriod: 17900,
        phase: random(),
      })
      treePaths.push(trunk)

      let branchId = 0
      const branchLimitX = width * 0.57
      const makeBranch = (start: Point, angle: number, length: number, depth: number, birth: number, parent: string, cluster: number) => {
        if (depth > 4 || length < 17) return

        const bend = jitter(0.22)
        const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
        if (end.x < branchLimitX || end.x > width * 1.06 || end.y < height * 0.025) return
        const controlA = { x: start.x + Math.cos(angle + bend) * length * 0.34, y: start.y + Math.sin(angle + bend) * length * 0.34 }
        const controlB = { x: end.x - Math.cos(angle - bend * 0.6) * length * 0.28, y: end.y - Math.sin(angle - bend * 0.6) * length * 0.28 }
        const duration = 6600 - depth * 650 + random() * 1500
        const id = `branch-${branchId++}`
        const branchPath = addPath(botanicalPaths, sampleCubic(start, controlA, controlB, end, 14 + Math.max(0, 8 - depth * 2)), {
          id,
          kind: 'branch',
          birth,
          duration,
          widthStart: Math.max(1.1, (9.4 - depth * 1.65) * scale),
          widthEnd: Math.max(0.55, (3.2 - depth * 0.48) * scale),
          depth,
          color: depth > 2 ? palette.barkLight : palette.bark,
          parent,
          flowDelay: 4200 + depth * 780,
          flowPeriod: 17900,
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
            leaves.push({
              x: anchor.x - anchor.ty * spread * side + jitter(5),
              y: anchor.y + anchor.tx * spread * side + jitter(5),
              angle: Math.atan2(anchor.ty, anchor.tx) + side * (0.55 + random() * 0.72),
              size: (5.4 + random() * 6.7) * scale,
              birth: birth + duration * (0.55 + random() * 0.48) + random() * 7000,
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
          const childBirth = birth + duration * (0.46 + random() * 0.15)
          makeBranch(end, angle - spread, childLength, depth + 1, childBirth, id, cluster)
          makeBranch(end, angle + spread * (0.8 + random() * 0.32), childLength * (0.88 + random() * 0.13), depth + 1, childBirth + 450 + random() * 800, id, cluster)
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

      const canopyCenters = [p(treeX - 0.09, 0.22), p(treeX + 0.005, 0.17), p(treeX + 0.095, 0.23), p(treeX - 0.14, 0.32), p(treeX - 0.035, 0.31), p(treeX + 0.085, 0.34), p(treeX - 0.095, 0.42), p(treeX + 0.035, 0.43)]
      canopyCenters.forEach((center, clusterIndex) => {
        const count = width < 760 ? 14 : 29
        const radiusX = width * (0.038 + random() * 0.014)
        const radiusY = height * (0.046 + random() * 0.018)
        for (let index = 0; index < count; index++) {
          const radialAngle = random() * Math.PI * 2
          const radius = Math.sqrt(random())
          leaves.push({
            x: center.x + Math.cos(radialAngle) * radiusX * radius,
            y: center.y + Math.sin(radialAngle) * radiusY * radius,
            angle: radialAngle + jitter(0.8),
            size: (7.2 + random() * 7.8) * scale,
            birth: 30500 + clusterIndex * 730 + random() * 10500,
            phase: random() * Math.PI * 2,
            cluster: 40 + clusterIndex,
            tier: random() > 0.67 ? 2 : random() > 0.46 ? 1 : 0,
            color: Math.floor(random() * leafColors.length),
          })
        }
      })

      // Organic vines retain their underlying circuit paths but grow curls and thick leaves.
      const vineDefinitions = [
        [p(-0.02, 0.16), p(0.07, 0.15), p(0.12, 0.21), p(0.25, 0.19), p(0.36, 0.15)],
        [p(1.02, 0.11), p(0.95, 0.13), p(0.91, 0.22), p(0.87, 0.27), p(0.89, 0.36)],
        [p(0.28, 0.94), p(0.29, 0.8), p(0.34, 0.73), p(0.35, 0.62)],
      ]

      vineDefinitions.forEach((points, index) => {
        addCircuit(
          `vine-wire-${index}`,
          points.map((point, pointIndex) => (pointIndex % 2 ? { x: point.x, y: points[pointIndex - 1].y } : point)),
          'vine',
          11500 + index * 1600,
          15000,
          index === 2 ? 'root-main' : undefined,
          6200 + index * 900,
          23300,
          palette.circuitDim
        )
        const vine = addPath(botanicalPaths, sampleSmoothPath(points, 14), {
          id: `vine-${index}`,
          kind: 'vine',
          birth: 15500 + index * 1700,
          duration: 22000,
          widthStart: 4.2 * scale,
          widthEnd: 2.1 * scale,
          depth: 0,
          color: palette.leafMid,
          parent: index === 2 ? 'root-main' : undefined,
          flowDelay: 7000 + index * 1100,
          flowPeriod: 23300,
          phase: random(),
        })
        vinePaths.push(vine)

        const leafSpacing = width < 760 ? 34 : 24
        for (let distance = 28; distance < vine.length - 12; distance += leafSpacing + random() * 9) {
          const anchor = pointAlong(vine, distance)
          const side = Math.floor(distance / leafSpacing) % 2 ? 1 : -1
          leaves.push({
            x: anchor.x - anchor.ty * side * 8,
            y: anchor.y + anchor.tx * side * 8,
            angle: Math.atan2(anchor.ty, anchor.tx) + side * 0.92,
            size: (6.2 + random() * 4.2) * scale,
            birth: vine.birth + (distance / vine.length) * vine.duration + 3800 + random() * 2800,
            phase: random() * Math.PI * 2,
            cluster: 20 + index,
            tier: 1,
            color: 2 + Math.floor(random() * 3),
          })
        }

        const tip = pointAlong(vine, vine.length)
        blossoms.push({ x: tip.x, y: tip.y, birth: vine.birth + vine.duration + 4500, size: 6.5 * scale, phase: random() * Math.PI * 2, color: index === 1 ? palette.ember : palette.mint })
      })

      // Leaf clusters at twig tips make the mature crown thick, layered, and readable.
      for (const branch of treePaths.filter((path) => path.kind === 'branch' && path.depth >= 2)) {
        const tip = pointAlong(branch, branch.length)
        const clusterLeaves = width < 760 ? 3 : 6
        for (let index = 0; index < clusterLeaves; index++) {
          const radialAngle = random() * Math.PI * 2
          const radius = (5 + random() * 18) * scale
          leaves.push({
            x: tip.x + Math.cos(radialAngle) * radius,
            y: tip.y + Math.sin(radialAngle) * radius * 0.72,
            angle: radialAngle + jitter(0.5),
            size: (6.5 + random() * 7.5) * scale,
            birth: branch.birth + branch.duration + random() * 9000,
            phase: random() * Math.PI * 2,
            cluster: branch.depth * 10 + Math.floor(branch.phase * 9),
            tier: random() > 0.6 ? 2 : random() > 0.5 ? 1 : 0,
            color: Math.floor(random() * leafColors.length),
          })
        }
      }
      leaves.sort((a, b) => a.tier - b.tier || a.birth - b.birth)

      for (let index = 0; index < Math.max(15, Math.round(width / 68)); index++) {
        specks.push({ x: random() * width, y: height * (0.08 + random() * 0.76), size: 0.6 + random() * 1.2, phase: random() * Math.PI * 2, speed: 0.00016 + random() * 0.00028 })
      }

      packetSprites = new Map([
        [palette.mint, createGlowSprite(palette.mint)],
        [palette.cyan, createGlowSprite(palette.cyan)],
        [palette.ember, createGlowSprite(palette.ember)],
      ])
    }

    function pathProgress(path: GrowingPath, elapsed: number) {
      return easeOutCubic((elapsed - path.birth) / path.duration)
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

    function drawCircuitLayer(elapsed: number, maturity: number) {
      const circuitAlpha = 0.22 + (1 - maturity) * 0.64
      for (const path of circuitPaths) {
        const progress = pathProgress(path, elapsed)
        if (progress <= 0) continue
        drawPartialPolyline(path, progress, path.color, path.widthStart, circuitAlpha, maturity < 0.4 ? 7 : 2)

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

    function drawTaperedPath(path: GrowingPath, progress: number, maturity: number, shadowColor: string, fillColor: string, detailColor: string) {
      if (progress <= 0 || maturity <= 0) return
      const visibleIndex = Math.max(1, Math.floor((path.samples.length - 1) * progress))
      const bodyScale = smoothstep(maturity)

      context.lineCap = 'round'
      context.lineJoin = 'round'
      for (let pass = 0; pass < 2; pass++) {
        for (let index = 1; index <= visibleIndex; index++) {
          const amount = index / (path.samples.length - 1)
          const widthAtPoint = lerp(path.widthStart, path.widthEnd, amount) * bodyScale
          const start = path.samples[index - 1]
          const end = path.samples[index]
          context.beginPath()
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.strokeStyle = pass === 0 ? shadowColor : fillColor
          context.globalAlpha = pass === 0 ? 0.72 * bodyScale : 0.91 * bodyScale
          context.lineWidth = Math.max(0.6, widthAtPoint + (pass === 0 ? 3.5 : 0))
          context.stroke()
        }
      }

      if (maturity > 0.48 && (path.kind === 'trunk' || (path.kind === 'branch' && path.depth < 2))) {
        const detail = smoothstep((maturity - 0.48) / 0.52)
        context.strokeStyle = detailColor
        context.lineWidth = 0.7
        context.globalAlpha = detail * 0.38
        for (let distance = 15; distance < path.length * progress; distance += 18 + path.depth * 5) {
          const point = pointAlong(path, distance)
          const normalX = -point.ty
          const normalY = point.tx
          const mark = Math.max(3, lerp(path.widthStart, path.widthEnd, distance / path.length) * 0.32)
          context.beginPath()
          context.moveTo(point.x - normalX * mark, point.y - normalY * mark)
          context.lineTo(point.x + normalX * mark * 0.45 + point.tx * 3, point.y + normalY * mark * 0.45 + point.ty * 3)
          context.stroke()
        }
      }
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

    function drawLeaf(leaf: Leaf, elapsed: number) {
      const growth = smoothstep((elapsed - leaf.birth) / 5200)
      if (growth <= 0) return
      const clusterSway = Math.sin(elapsed * 0.00038 + leaf.cluster * 0.87) * 0.045 + Math.sin(elapsed * 0.00013 + leaf.cluster * 1.91) * 0.025
      const localSway = Math.sin(elapsed * 0.00051 + leaf.phase) * 0.018
      const size = leaf.size * growth

      context.save()
      context.translate(leaf.x, leaf.y)
      context.rotate(leaf.angle + clusterSway + localSway)
      context.scale(growth, 0.88 + growth * 0.12)
      context.globalAlpha = 0.76 + leaf.tier * 0.07
      context.fillStyle = leafColors[leaf.color]
      context.strokeStyle = leaf.tier === 2 ? palette.leafMid : palette.leafDark
      context.lineWidth = 0.72
      context.beginPath()
      context.moveTo(-size * 0.12, 0)
      context.bezierCurveTo(size * 0.18, -size * 0.52, size * 0.78, -size * 0.42, size, 0)
      context.bezierCurveTo(size * 0.76, size * 0.43, size * 0.2, size * 0.5, -size * 0.12, 0)
      context.closePath()
      context.fill()
      context.stroke()

      context.globalAlpha *= 0.48
      context.strokeStyle = palette.leafLight
      context.lineWidth = 0.48
      context.beginPath()
      context.moveTo(0, 0)
      context.lineTo(size * 0.82, 0)
      context.stroke()
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

    function drawBotanicalLayer(elapsed: number, maturity: number) {
      for (const path of botanicalPaths) {
        const progress = pathProgress(path, elapsed)
        if (progress <= 0) continue
        const localMaturity = maturity * smoothstep((elapsed - path.birth + 2200) / Math.max(6000, path.duration * 0.75))

        if (path.kind === 'cactus') {
          drawTaperedPath(path, progress, localMaturity, palette.ink, path.color, palette.cactusLight)
          drawCactusDetails(path, progress, localMaturity)
        } else if (path.kind === 'trunk' || path.kind === 'branch') {
          drawTaperedPath(path, progress, localMaturity, palette.ink, path.color, palette.barkLight)
        } else if (path.kind === 'vine') {
          drawTaperedPath(path, progress, localMaturity, palette.ink, palette.leafMid, palette.leafLight)
        }
      }

      for (const leaf of leaves) drawLeaf(leaf, elapsed)
      for (const blossom of blossoms) drawBlossom(blossom, elapsed)
    }

    function packetColor(path: GrowingPath, cycle: number) {
      const hash = Math.abs(Math.sin((cycle + 1) * 12.9898 + path.phase * 78.233))
      if (hash > 0.94) return palette.ember
      if (path.kind === 'root' || path.kind === 'vine') return palette.cyan
      return palette.mint
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

    function drawPacket(path: GrowingPath, elapsed: number, maturity: number, echo = false) {
      const period = path.flowPeriod
      const launchOffset = path.flowDelay + (echo ? 280 : 0)
      const local = elapsed - 2400 - launchOffset
      if (local < 0 || pathProgress(path, elapsed) < 0.92) return
      const cycle = Math.floor(local / period)
      const cycleTime = ((local % period) + period) % period
      const speedScale = clamp(height / 900, 0.75, 1.2)
      const speed = (path.kind === 'root' ? 0.12 : path.kind === 'trunk' ? 0.076 : path.kind === 'cactus' ? 0.059 : path.kind === 'branch' ? 0.045 : 0.038) * speedScale
      const distance = cycleTime * speed
      if (distance < 0 || distance > path.length + 70) return

      const energy = echo ? 0.3 : 0.92
      const color = packetColor(path, cycle)
      const sprite = packetSprites.get(color)
      if (!sprite) return
      const trailSamples = width < 760 || frameBudgetTier > 0 ? 6 : 10
      const trailLength = path.kind === 'root' ? 58 : 42
      context.save()
      context.globalCompositeOperation = 'lighter'

      for (let index = trailSamples - 1; index >= 0; index--) {
        const amount = index / Math.max(1, trailSamples - 1)
        const sampleDistance = distance - amount * trailLength
        if (sampleDistance < 0 || sampleDistance > path.length) continue
        const point = pointAlong(path, sampleDistance)
        const tailEnergy = (1 - amount) ** 2 * energy
        const size = lerp(7, 20, tailEnergy)
        context.globalAlpha = tailEnergy * (0.48 + maturity * 0.28)
        context.drawImage(sprite, point.x - size / 2, point.y - size / 2, size, size)
      }

      if (distance <= path.length) {
        const head = pointAlong(path, distance)
        const angle = Math.atan2(head.ty, head.tx)
        context.translate(head.x, head.y)
        context.rotate(angle)
        context.globalAlpha = energy
        context.fillStyle = palette.cream
        context.beginPath()
        context.ellipse(0, 0, 2.8, 1.45, 0, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()

      for (let index = 1; index < path.samples.length - 1; index++) {
        const arrival = path.cumulative[index] / speed
        drawJunctionRipple(path.samples[index], color, cycleTime - arrival, energy)
      }

      if (distance > path.length) {
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

    function drawFlow(elapsed: number, maturity: number) {
      const allFlowPaths = [...circuitPaths, ...cactusPaths, ...treePaths.filter((path) => path.depth < 4), ...vinePaths]
      const maxPaths = width < 760 ? 18 : 34
      let rendered = 0

      for (const path of allFlowPaths) {
        if (rendered >= maxPaths) break
        const deepBranchCycle = Math.floor((elapsed - path.flowDelay) / path.flowPeriod)
        if (path.kind === 'branch' && path.depth > 2 && Math.abs(deepBranchCycle + Math.floor(path.phase * 7)) % 3 !== 0) continue
        drawPacket(path, elapsed, maturity)
        if (Math.abs(deepBranchCycle + Math.floor(path.phase * 11)) % 4 === 0) drawPacket(path, elapsed, maturity, true)
        rendered++
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
      context.clearRect(0, 0, width, height)
      drawAtmosphere(elapsed, maturity)
      drawCircuitLayer(elapsed, maturity)
      drawBotanicalLayer(elapsed, maturity)
      if (!staticFrame) drawFlow(elapsed, maturity)
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
