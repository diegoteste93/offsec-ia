'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import styles from './page.module.css'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
})

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
})

interface GraphNode {
  id: string
  name: string
  type: string
  properties: Record<string, unknown>
  x?: number
  y?: number
  z?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  projectId: string
}

// Helper to format Neo4j datetime objects to readable string
function formatNeo4jDateTime(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'year' in value &&
    'month' in value &&
    'day' in value &&
    'hour' in value &&
    'minute' in value &&
    'second' in value
  ) {
    const dt = value as {
      year: { low: number }
      month: { low: number }
      day: { low: number }
      hour: { low: number }
      minute: { low: number }
      second: { low: number }
    }
    const year = dt.year.low
    const month = String(dt.month.low).padStart(2, '0')
    const day = String(dt.day.low).padStart(2, '0')
    const hour = String(dt.hour.low).padStart(2, '0')
    const minute = String(dt.minute.low).padStart(2, '0')
    const second = String(dt.second.low).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  return null
}

const NODE_COLORS: Record<string, string> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL SECURITY (Red family) - Immediate attention needed
  // ═══════════════════════════════════════════════════════════════════════════
  Vulnerability: '#ef4444',  // Bright red - DANGER, highest priority
  CVE: '#dc2626',            // Deep red - Known vulnerabilities

  // ═══════════════════════════════════════════════════════════════════════════
  // THREAT INTELLIGENCE (Orange family) - Attack context
  // ═══════════════════════════════════════════════════════════════════════════
  MitreData: '#f97316',      // Orange - CWE/MITRE techniques
  Capec: '#eab308',          // Yellow - Attack patterns

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN HIERARCHY (Blue family) - Recon foundation
  // ═══════════════════════════════════════════════════════════════════════════
  Domain: '#1e3a8a',         // Deep navy - Root/foundation (most important)
  Subdomain: '#2563eb',      // Royal blue - Children of domain

  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORK LAYER (Cyan/Teal family) - Infrastructure
  // ═══════════════════════════════════════════════════════════════════════════
  IP: '#0d9488',             // Teal - Network addresses
  Port: '#0e7490',           // Dark cyan - Network ports
  Service: '#06b6d4',        // Cyan - Running services

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB APPLICATION LAYER (Purple family) - Web-specific assets
  // ═══════════════════════════════════════════════════════════════════════════
  BaseURL: '#6366f1',        // Indigo - Web entry points
  Endpoint: '#8b5cf6',       // Purple - Paths/routes
  Parameter: '#a855f7',      // Light purple - Inputs (attack surface)

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT & METADATA (Neutral family) - Supporting information
  // ═══════════════════════════════════════════════════════════════════════════
  Technology: '#22c55e',     // Green - Tech stack (good to know)
  Certificate: '#d97706',    // Amber - TLS/security context
  Header: '#78716c',         // Stone gray - HTTP metadata

  Default: '#6b7280',        // Gray - Fallback
}

// Severity-based size multipliers
const SEVERITY_SIZE_MULTIPLIERS: Record<string, number> = {
  critical: 1.0,
  high: 1.0,
  medium: 1.0,
  low: 0.7,
  info: 0.7,
  unknown: 0.7,
}

// Severity-based colors for Vulnerability nodes (pure red tonality, darker = lower severity)
// 3 tonality levels: critical (brightest), high/medium (mid), low/info (darkest)
const SEVERITY_COLORS_VULN: Record<string, string> = {
  critical: '#ff3333',  // Brilliant red - brightest, vivid
  high: '#b91c1c',      // Medium red (red-700) - mid tonality
  medium: '#b91c1c',    // Medium red (red-700) - mid tonality
  low: '#7f1d1d',       // Dark red (red-900) - darkest
  info: '#7f1d1d',      // Dark red (red-900) - darkest
  unknown: '#6b7280',   // Grey for unknown
}

// Severity-based colors for CVE nodes (red-purple/magenta tonality)
// 3 tonality levels: critical (brightest), high/medium (mid), low/info (darkest)
const SEVERITY_COLORS_CVE: Record<string, string> = {
  critical: '#ff3377',  // Brilliant magenta-red - brightest, vivid
  high: '#be185d',      // Medium pink-red (pink-700) - mid tonality
  medium: '#be185d',    // Medium pink-red (pink-700) - mid tonality
  low: '#831843',       // Dark pink-red (pink-900) - darkest
  info: '#831843',      // Dark pink-red (pink-900) - darkest
  unknown: '#6b7280',   // Grey for unknown
}

// Node size multipliers (1x = default size)
const NODE_SIZES: Record<string, number> = {
  Domain: 4,
  Subdomain: 3,
  IP: 2,
  Port: 2,
  Service: 2,
  BaseURL: 3,
  Technology: 2,
  Default: 1,
}

async function fetchGraphData(projectId: string): Promise<GraphData> {
  const response = await fetch(`/api/graph?projectId=${projectId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch graph data')
  }
  return response.json()
}

export default function GraphPage() {
  const projectId = 'project_2'
  const [is3D, setIs3D] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph3DRef = useRef<any>(null)
  // Store glow rings for 3D animation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glowRingsRef = useRef<any[]>([])
  // Animation time ref for 2D glow effect (updated via requestAnimationFrame)
  const animationTimeRef = useRef<number>(0)

  const drawerWidth = 400

  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', projectId],
    queryFn: () => fetchGraphData(projectId),
  })

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - (drawerOpen ? drawerWidth : 0),
        height: window.innerHeight - 140,
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [drawerOpen])

  useEffect(() => {
    if (!data || is3D) return

    // Wait for graph to be fully mounted
    const timer = setTimeout(() => {
      const fg = graphRef.current
      if (!fg) return

      const d3 = require('d3-force')

      // Only add collision detection to prevent circles from overlapping
      fg.d3Force('collide', d3.forceCollide().radius(20).strength(1).iterations(3))

      // Reheat the simulation to apply changes
      fg.d3ReheatSimulation()
    }, 300)

    return () => clearTimeout(timer)
  }, [data, is3D])

  // Animation loop for 2D graph (pulsing glow effect)
  // Uses requestAnimationFrame to update animationTimeRef and force canvas redraw
  useEffect(() => {
    if (is3D || !data) return

    // Check if there are any high-severity nodes that need animation
    const hasHighSeverity = data.nodes.some(node => {
      if (node.type === 'Vulnerability' || node.type === 'CVE') {
        const severity = (node.properties?.severity as string)?.toLowerCase()
        return severity === 'critical' || severity === 'high'
      }
      return false
    })

    if (!hasHighSeverity) return

    let animationId: number

    const animate = () => {
      // Update animation time for glow effect
      animationTimeRef.current = Date.now() / 1000

      const fg = graphRef.current
      if (fg) {
        // Force a complete redraw by calling _rerender (internal method)
        // This is more reliable than refresh() during user interactions
        if (typeof fg._rerender === 'function') {
          fg._rerender()
        } else if (typeof fg.refresh === 'function') {
          fg.refresh()
        }
      }
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [data, is3D])

  // Clear glow rings when switching views or data changes
  useEffect(() => {
    glowRingsRef.current = []
  }, [data, is3D])

  // Animation loop for 3D graph (pulsing glow rings)
  useEffect(() => {
    if (!is3D || !data) return

    // Check if there are any high-severity nodes that need animation
    const hasHighSeverity = data.nodes.some(node => {
      if (node.type === 'Vulnerability' || node.type === 'CVE') {
        const severity = (node.properties?.severity as string)?.toLowerCase()
        return severity === 'critical' || severity === 'high'
      }
      return false
    })

    if (!hasHighSeverity) return

    let animationId: number
    const animate = () => {
      const time = Date.now() / 1000

      // Animate all stored glow rings
      glowRingsRef.current.forEach(ring => {
        if (ring) {
          // Critical pulses faster (speed 10) than high (speed 3)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const glowLevel = (ring as any).__glowLevel || 'high'
          const speed = glowLevel === 'critical' ? 10 : 3
          const pulse = Math.sin(time * speed) * 0.15 + 1 // 0.85 to 1.15 scale
          const opacity = Math.sin(time * speed) * 0.2 + 0.4 // 0.2 to 0.6 opacity

          ring.scale.set(pulse, pulse, 1)
          if (ring.material) {
            ring.material.opacity = opacity
          }
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [data, is3D])

  const getNodeColor = useCallback((node: GraphNode) => {
    // Use severity-based colors for Vulnerability and CVE nodes
    if (node.type === 'Vulnerability') {
      const severity = (node.properties?.severity as string)?.toLowerCase() || 'unknown'
      return SEVERITY_COLORS_VULN[severity] || SEVERITY_COLORS_VULN.unknown
    }
    if (node.type === 'CVE') {
      const severity = (node.properties?.severity as string)?.toLowerCase() || 'unknown'
      return SEVERITY_COLORS_CVE[severity] || SEVERITY_COLORS_CVE.unknown
    }
    return NODE_COLORS[node.type] || NODE_COLORS.Default
  }, [])

  const getNodeSize = useCallback((node: GraphNode) => {
    const baseSize = NODE_SIZES[node.type] || NODE_SIZES.Default
    // Apply severity multiplier for Vulnerability and CVE nodes
    if (node.type === 'Vulnerability' || node.type === 'CVE') {
      const severity = (node.properties?.severity as string)?.toLowerCase() || 'unknown'
      const severityMultiplier = SEVERITY_SIZE_MULTIPLIERS[severity] || 1.0
      return baseSize * severityMultiplier
    }
    return baseSize
  }, [])

  // Check if a node should have glow effect (critical/high severity)
  // Returns: false, 'high', or 'critical'
  const getGlowLevel = useCallback((node: GraphNode): false | 'high' | 'critical' => {
    if (node.type === 'Vulnerability' || node.type === 'CVE') {
      const severity = (node.properties?.severity as string)?.toLowerCase()
      if (severity === 'critical') return 'critical'
      if (severity === 'high') return 'high'
    }
    return false
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setSelectedNode(null)
  }, [])

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← Back
        </Link>
        <h1 className={styles.title}>Graph View</h1>

        <div className={styles.toggleContainer}>
          <span className={!is3D ? styles.toggleActive : styles.toggleInactive}>2D</span>
          <button
            className={styles.toggleSwitch}
            onClick={() => setIs3D(!is3D)}
            aria-label="Toggle 2D/3D view"
          >
            <span className={`${styles.toggleKnob} ${is3D ? styles.toggleKnobRight : ''}`} />
          </button>
          <span className={is3D ? styles.toggleActive : styles.toggleInactive}>3D</span>
        </div>

        <div className={styles.toggleContainer}>
          <span className={styles.toggleLabel}>Labels</span>
          <button
            className={styles.toggleSwitch}
            onClick={() => setShowLabels(!showLabels)}
            aria-label="Toggle labels"
          >
            <span className={`${styles.toggleKnob} ${showLabels ? styles.toggleKnobRight : ''}`} />
          </button>
        </div>

        <span className={styles.projectId}>Project: {projectId}</span>
      </header>

      <div className={styles.legend}>
        {Object.entries(NODE_COLORS)
          .filter(([key]) => key !== 'Default')
          .map(([type, color]) => (
            <div key={type} className={styles.legendItem}>
              <span
                className={styles.legendColor}
                style={{ backgroundColor: color }}
              />
              <span>{type}</span>
            </div>
          ))}
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.graphContainer}>
          {isLoading && (
            <div className={styles.loading}>Loading graph data...</div>
          )}

          {error && (
            <div className={styles.error}>
              Error: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}

          {data && data.nodes.length === 0 && (
            <div className={styles.empty}>
              No data found for project: {projectId}
            </div>
          )}

          {data && data.nodes.length > 0 && !is3D && (
            <ForceGraph2D
              ref={graphRef}
              graphData={data}
              nodeLabel={(node) => `${(node as GraphNode).name} (${(node as GraphNode).type})`}
              nodeRelSize={6}
              linkLabel={(link) => (link as GraphLink).type}
              linkColor={(link) => {
                if (!selectedNode) return '#9ca3af'
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? '#60a5fa' : '#9ca3af'
              }}
              linkDirectionalArrowColor={(link) => {
                if (!selectedNode) return '#9ca3af'
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? '#60a5fa' : '#9ca3af'
              }}
              linkWidth={(link) => {
                if (!selectedNode) return 1
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? 3 : 1
              }}
              linkDirectionalParticles={4}
              linkDirectionalParticleWidth={(link) => {
                if (!selectedNode) return 0
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? 4 : 0
              }}
              linkDirectionalParticleColor={() => '#60a5fa'}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              backgroundColor="#0a0a0a"
              width={dimensions.width}
              height={dimensions.height}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.4}
              cooldownTime={Infinity}
              cooldownTicks={Infinity}
              onNodeClick={(node) => handleNodeClick(node as GraphNode)}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const graphNode = node as GraphNode & { x: number; y: number }
                const baseSize = 6
                const nodeSize = baseSize * getNodeSize(graphNode)
                const color = getNodeColor(graphNode)
                const isSelected = selectedNode?.id === graphNode.id

                // Draw selection marker (outer ring) for selected node
                if (isSelected) {
                  ctx.beginPath()
                  ctx.arc(graphNode.x, graphNode.y, nodeSize + 6, 0, 2 * Math.PI)
                  ctx.strokeStyle = '#22c55e' // Green for selected
                  ctx.lineWidth = 3
                  ctx.stroke()
                }

                // Check if this is a high/critical severity vulnerability or CVE
                const glowLevel = getGlowLevel(graphNode)

                // Draw pulsing glow effect for high/critical severity
                if (glowLevel) {
                  // Use animationTimeRef for consistent animation timing
                  const time = animationTimeRef.current || Date.now() / 1000
                  // Critical pulses faster (speed 10) than high (speed 3)
                  const speed = glowLevel === 'critical' ? 10 : 3
                  const pulse = Math.sin(time * speed) * 0.5 + 0.5 // 0 to 1 oscillation
                  const glowRadius = nodeSize + 2 + pulse * 3

                  // Outer glow ring
                  const gradient = ctx.createRadialGradient(
                    graphNode.x, graphNode.y, nodeSize,
                    graphNode.x, graphNode.y, glowRadius
                  )
                  gradient.addColorStop(0, color)
                  gradient.addColorStop(0.5, `${color}88`)
                  gradient.addColorStop(1, `${color}00`)

                  ctx.beginPath()
                  ctx.arc(graphNode.x, graphNode.y, glowRadius, 0, 2 * Math.PI)
                  ctx.fillStyle = gradient
                  ctx.fill()
                }

                // Draw main circle
                ctx.beginPath()
                ctx.arc(graphNode.x, graphNode.y, nodeSize, 0, 2 * Math.PI)
                ctx.fillStyle = color
                ctx.fill()

                // Draw label if enabled or if node is selected
                if ((showLabels && globalScale > 0.4) || isSelected) {
                  const label = graphNode.name
                  const fontSize = Math.max(6 / globalScale, 2)
                  ctx.font = `${fontSize}px Sans-Serif`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'top'
                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, graphNode.x, graphNode.y + nodeSize + 2)
                }
              }}
              nodePointerAreaPaint={(node, color, ctx) => {
                const graphNode = node as GraphNode & { x: number; y: number }
                ctx.beginPath()
                ctx.arc(graphNode.x, graphNode.y, 10, 0, 2 * Math.PI)
                ctx.fillStyle = color
                ctx.fill()
              }}
            />
          )}

          {data && data.nodes.length > 0 && is3D && (
            <ForceGraph3D
              ref={graph3DRef}
              graphData={data}
              nodeLabel={(node) => `${(node as GraphNode).name} (${(node as GraphNode).type})`}
              nodeColor={(node) => getNodeColor(node as GraphNode)}
              nodeRelSize={6}
              nodeOpacity={1}
              linkLabel={(link) => (link as GraphLink).type}
              linkColor={(link) => {
                if (!selectedNode) return '#9ca3af'
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? '#60a5fa' : '#9ca3af'
              }}
              linkWidth={(link) => {
                if (!selectedNode) return 1.5
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? 3.5 : 1.5
              }}
              linkDirectionalParticles={(link) => {
                if (!selectedNode) return 0
                const graphLink = link as GraphLink
                const sourceId = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as GraphNode).id
                const targetId = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as GraphNode).id
                return (sourceId === selectedNode.id || targetId === selectedNode.id) ? 4 : 0
              }}
              linkDirectionalParticleWidth={4}
              linkDirectionalParticleColor={() => '#60a5fa'}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              backgroundColor="#0a0a0a"
              width={dimensions.width}
              height={dimensions.height}
              onNodeClick={(node) => handleNodeClick(node as GraphNode)}
              nodeThreeObject={(node: object) => {
                const graphNode = node as GraphNode
                const THREE = require('three')
                const SpriteText = require('three-spritetext').default

                const group = new THREE.Group()

                // Create sphere with size multiplier
                const baseSize = 5
                const sphereSize = baseSize * getNodeSize(graphNode)
                const nodeColor = getNodeColor(graphNode)
                const isSelected = selectedNode?.id === graphNode.id

                // Add selection marker ring (green) for selected node
                if (isSelected) {
                  const selectGeometry = new THREE.RingGeometry(sphereSize * 1.4, sphereSize * 1.6, 32)
                  const selectMaterial = new THREE.MeshBasicMaterial({
                    color: '#22c55e',
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide,
                  })
                  const selectRing = new THREE.Mesh(selectGeometry, selectMaterial)
                  selectRing.lookAt(0, 0, 1)
                  group.add(selectRing)
                }

                // Add outer glow ring for high/critical severity
                const glowLevel = getGlowLevel(graphNode)
                if (glowLevel) {
                  const glowGeometry = new THREE.RingGeometry(sphereSize * 1.15, sphereSize * 1.4, 32)
                  const glowMaterial = new THREE.MeshBasicMaterial({
                    color: nodeColor,
                    transparent: true,
                    opacity: 0.4,
                    side: THREE.DoubleSide,
                  })
                  const glowRing = new THREE.Mesh(glowGeometry, glowMaterial)

                  // Make the ring always face the camera (billboard effect)
                  glowRing.lookAt(0, 0, 1)

                  // Store reference for animation with glow level
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(glowRing as any).__glowLevel = glowLevel
                  glowRingsRef.current.push(glowRing)

                  group.add(glowRing)
                }

                const geometry = new THREE.SphereGeometry(sphereSize, 16, 16)
                const material = new THREE.MeshLambertMaterial({
                  color: nodeColor,
                  transparent: true,
                  opacity: 0.9,
                })
                const sphere = new THREE.Mesh(geometry, material)
                group.add(sphere)

                // Create label if enabled or if node is selected
                if (showLabels || isSelected) {
                  const sprite = new SpriteText(graphNode.name)
                  sprite.color = '#ffffff'
                  sprite.textHeight = 3
                  sprite.position.y = sphereSize + 3
                  group.add(sprite)
                }

                return group
              }}
            />
          )}
        </div>

        {/* Drawer */}
        <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
          <div className={styles.drawerHeader}>
            <h2 className={styles.drawerTitle}>
              {selectedNode?.type}: {selectedNode?.name}
            </h2>
            <button className={styles.drawerClose} onClick={closeDrawer}>
              ×
            </button>
          </div>
          <div className={styles.drawerContent}>
            {selectedNode && (
              <>
                <div className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitleBasicInfo}>Basic Info</h3>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyKey}>Type</span>
                    <span
                      className={styles.propertyBadge}
                      style={{ backgroundColor: getNodeColor(selectedNode) }}
                    >
                      {selectedNode.type}
                    </span>
                  </div>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyKey}>ID</span>
                    <span className={styles.propertyValue}>{selectedNode.id}</span>
                  </div>
                  <div className={styles.propertyRow}>
                    <span className={styles.propertyKey}>Name</span>
                    <span className={styles.propertyValue}>{selectedNode.name}</span>
                  </div>
                </div>

                <div className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitleProperties}>Properties</h3>
                  {Object.entries(selectedNode.properties || {})
                    .sort(([a], [b]) => {
                      const bottomKeys = ['created_at', 'updated_at']
                      const aIsBottom = bottomKeys.includes(a)
                      const bIsBottom = bottomKeys.includes(b)
                      if (aIsBottom && !bIsBottom) return 1
                      if (!aIsBottom && bIsBottom) return -1
                      if (aIsBottom && bIsBottom) return bottomKeys.indexOf(a) - bottomKeys.indexOf(b)
                      return 0
                    })
                    .map(([key, value]) => {
                    const formattedDate = formatNeo4jDateTime(value)

                    // Format the display value
                    let displayValue: React.ReactNode
                    if (formattedDate) {
                      displayValue = formattedDate
                    } else if (
                      value === null ||
                      value === undefined ||
                      value === 'none' ||
                      value === 'None' ||
                      value === 'null' ||
                      value === 'NULL'
                    ) {
                      displayValue = '---'
                    } else if (Array.isArray(value)) {
                      if (value.length === 0) {
                        displayValue = '---'
                      } else {
                        displayValue = value.join(', ')
                      }
                    } else if (typeof value === 'object') {
                      displayValue = JSON.stringify(value, null, 2)
                    } else if (value === '') {
                      displayValue = '---'
                    } else {
                      displayValue = String(value)
                    }

                    return (
                      <div key={key} className={styles.propertyRow}>
                        <span className={styles.propertyKey}>{key}</span>
                        <span className={styles.propertyValue}>{displayValue}</span>
                      </div>
                    )
                  })}
                  {Object.keys(selectedNode.properties || {}).length === 0 && (
                    <p className={styles.emptyProperties}>No additional properties</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {data && (
        <div className={styles.stats}>
          <span>Nodes: {data.nodes.length}</span>
          <span>Links: {data.links.length}</span>
          <span>View: {is3D ? '3D' : '2D'}</span>
          <span>Labels: {showLabels ? 'On' : 'Off'}</span>
        </div>
      )}
    </main>
  )
}
