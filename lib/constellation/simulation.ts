import { CONFIG, RuntimeConfig } from './config'
import { Node } from './node'
import { Connection } from './connection'

export interface ConnectionType {
  type: 'tether' | 'constellation' | 'trail'
  connection: Connection
}

export class Simulation {
  nodes: Node[]
  connections: ConnectionType[]
  cursorX: number
  cursorY: number
  config: RuntimeConfig
  cursorTrail: Array<{ x: number; y: number; time: number }> = []

  constructor(width: number, height: number, config: RuntimeConfig = CONFIG) {
    this.nodes = []
    this.connections = []
    this.cursorX = -9999
    this.cursorY = -9999
    this.config = config

    // Create nodes
    for (let i = 0; i < config.nodeCount; i++) {
      this.nodes.push(new Node(
        Math.random() * width,
        Math.random() * height
      ))
    }
  }

  updateConfig(config: RuntimeConfig): void {
    this.config = config
  }

  resize(width: number, height: number): void {
    // Nodes will naturally wrap, no need to reposition
  }

  setCursor(x: number, y: number): void {
    this.cursorX = x
    this.cursorY = y
    
    // Add to trail
    const now = performance.now() / 1000
    this.cursorTrail.push({ x, y, time: now })
    
    // Remove old trail points
    const trailCutoff = now - this.config.trailFadeTime
    this.cursorTrail = this.cursorTrail.filter(point => point.time > trailCutoff)
    
    // Limit trail length
    if (this.cursorTrail.length > this.config.trailLength) {
      this.cursorTrail = this.cursorTrail.slice(-this.config.trailLength)
    }
  }

  update(deltaTime: number, width: number, height: number): void {
    // Update node energy based on cursor proximity
    for (const node of this.nodes) {
      const distToCursor = node.distanceTo(this.cursorX, this.cursorY)
      const isInInfluence = distToCursor < this.config.cursorInfluenceRadius
      
      if (isInInfluence) {
        // Add energy when cursor is near
        const influenceFactor = 1 - (distToCursor / this.config.cursorInfluenceRadius)
        node.addEnergy(influenceFactor * deltaTime, this.config)
      }
      
      // Update node (energy decay happens inside)
      node.update(deltaTime, width, height, this.cursorX, this.cursorY, this.config)
    }

    // Remove decaying connections
    this.connections = this.connections.filter(connType => 
      connType.connection.update(deltaTime, this.cursorX, this.cursorY, this.config)
    )

    // Find active nodes (based on energy)
    const activeNodes = this.nodes.filter(node => node.energy > 0.1)

    // 1) CURSOR TETHER: Connect cursor to nearest active nodes
    const tetherConnections: ConnectionType[] = []
    if (activeNodes.length > 0 && this.cursorX > -9999) {
      const nodesWithDistance = activeNodes.map(node => ({
        node,
        distance: node.distanceTo(this.cursorX, this.cursorY)
      }))
      nodesWithDistance.sort((a, b) => a.distance - b.distance)
      
      const tetherNodes = nodesWithDistance.slice(0, this.config.tetherCount)
      
      for (const { node } of tetherNodes) {
        // Check if tether already exists
        const exists = this.connections.some(connType => 
          connType.type === 'tether' &&
          (connType.connection.nodeA === node || connType.connection.nodeB === node)
        )
        
        if (!exists) {
          // Create a special tether connection
          // For tethers, nodeA is the target node (we'll draw from cursor to nodeA in renderer)
          const tetherConn = new Connection(node, node)
          tetherConn.isTether = true
          tetherConn.tetherTarget = node
          tetherConnections.push({ type: 'tether', connection: tetherConn })
        }
      }
    }

    // 2) LOCAL CONSTELLATION: Active nodes connect to other active nodes
    const constellationConnections: ConnectionType[] = []
    const existingConstellationCount = this.connections.filter(c => c.type === 'constellation').length
    
    // Only create new constellation connections if under max total edges
    if (existingConstellationCount < this.config.maxTotalEdges) {
    for (let i = 0; i < activeNodes.length; i++) {
      const nodeA = activeNodes[i]
      const nearbyNodes: Array<{ node: Node; distance: number }> = []

      // Find nearby active nodes
      for (let j = 0; j < activeNodes.length; j++) {
        if (i === j) continue
        const nodeB = activeNodes[j]
        const distance = nodeA.distanceToNode(nodeB)

          if (distance < this.config.nodeConnectionRadius) {
          nearbyNodes.push({ node: nodeB, distance })
        }
      }

      // Sort by distance and take top N
      nearbyNodes.sort((a, b) => a.distance - b.distance)
        const topNodes = nearbyNodes.slice(0, this.config.maxConnectionsPerNode)

        // Create connections if they don't exist and under max edges
      for (const { node: nodeB } of topNodes) {
          if (constellationConnections.length + existingConstellationCount >= this.config.maxTotalEdges) {
            break
          }
          
          const exists = this.connections.some(connType => 
            connType.type === 'constellation' &&
            ((connType.connection.nodeA === nodeA && connType.connection.nodeB === nodeB) ||
             (connType.connection.nodeA === nodeB && connType.connection.nodeB === nodeA))
        )

        if (!exists) {
            constellationConnections.push({
              type: 'constellation',
              connection: new Connection(nodeA, nodeB)
            })
          }
        }
        
        if (constellationConnections.length + existingConstellationCount >= this.config.maxTotalEdges) {
          break
        }
      }
    }

    // Add new connections
    this.connections.push(...tetherConnections, ...constellationConnections)
  }

  checkWowMoment(): void {
    // Check for triangles or closed loops
    const activeNodes = this.nodes.filter(node => node.energy > 0.1)
    if (activeNodes.length < 3) return

    // Build adjacency map (only constellation connections)
    const adjMap = new Map<Node, Node[]>()
    for (const connType of this.connections) {
      if (connType.type === 'constellation') {
        const conn = connType.connection
        if (conn.nodeA.energy > 0.1 && conn.nodeB.energy > 0.1 && !conn.isDecaying) {
        if (!adjMap.has(conn.nodeA)) adjMap.set(conn.nodeA, [])
        if (!adjMap.has(conn.nodeB)) adjMap.set(conn.nodeB, [])
        adjMap.get(conn.nodeA)!.push(conn.nodeB)
        adjMap.get(conn.nodeB)!.push(conn.nodeA)
        }
      }
    }

    // Check for triangles (3 nodes all connected to each other)
    for (const nodeA of activeNodes) {
      const neighborsA = adjMap.get(nodeA) || []
      for (const nodeB of neighborsA) {
        const neighborsB = adjMap.get(nodeB) || []
        for (const nodeC of neighborsB) {
          if (nodeC !== nodeA && neighborsA.includes(nodeC)) {
            // Triangle found!
            this.triggerPulse([nodeA, nodeB, nodeC])
            return
          }
        }
      }
    }
  }

  private triggerPulse(nodes: Node[]): void {
    // Only trigger if nodes aren't already pulsing
    if (nodes.some(n => n.pulseTime > 0)) return

    for (const node of nodes) {
      node.pulseTime = this.config.wowPulseDuration
    }
  }
}
