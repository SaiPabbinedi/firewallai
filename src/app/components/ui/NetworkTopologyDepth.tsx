import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layers, RotateCcw } from 'lucide-react';

interface NetworkLayer {
  id: string;
  name: string;
  description: string;
  depth: number;
  color: string;
  nodes: NetworkNode[];
}

interface NetworkNode {
  id: string;
  label: string;
  ip: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface NetworkTopologyDepthProps {
  layers?: NetworkLayer[];
  onLayerToggle?: (layerId: string) => void;
  enableDepth?: boolean;
}

export function NetworkTopologyDepth({
  layers = defaultLayers,
  onLayerToggle,
  enableDepth = true,
}: NetworkTopologyDepthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLayer, setSelectedLayer] = useState<string>(layers[0]?.id || '');
  const [depthScale, setDepthScale] = useState(1);
  const [rotation, setRotation] = useState({ x: 0.5, y: 0.5 });
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(layers.map(l => l.id))
  );
  const animationFrameRef = useRef<number>();

  // Handle layer visibility toggle
  const toggleLayer = (layerId: string) => {
    const newVisible = new Set(visibleLayers);
    if (newVisible.has(layerId)) {
      newVisible.delete(layerId);
    } else {
      newVisible.add(layerId);
    }
    setVisibleLayers(newVisible);
    onLayerToggle?.(layerId);
  };

  // Handle mouse movement for 3D rotation
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRotation({ x: y * Math.PI, y: x * Math.PI });
  };

  // Draw 3D topology on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = 'rgba(7, 12, 24, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const layerSpacing = 40;

      // Draw layers in 3D space
      visibleLayers.forEach((layerId) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        const depthOffset = (layer.depth - 1) * layerSpacing;
        const perspectiveScale = 1 - (layer.depth - 1) * 0.15;

        // Draw layer background
        ctx.save();
        ctx.globalAlpha = 0.3 + perspectiveScale * 0.4;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.roundRect(
          centerX - 150 * perspectiveScale,
          centerY - 100 * perspectiveScale + depthOffset,
          300 * perspectiveScale,
          200 * perspectiveScale,
          10
        );
        ctx.fill();
        ctx.restore();

        // Draw layer border
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + perspectiveScale * 0.4;
        ctx.beginPath();
        ctx.roundRect(
          centerX - 150 * perspectiveScale,
          centerY - 100 * perspectiveScale + depthOffset,
          300 * perspectiveScale,
          200 * perspectiveScale,
          10
        );
        ctx.stroke();

        // Draw layer label
        ctx.fillStyle = layer.color;
        ctx.font = `bold ${14 * perspectiveScale}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
        ctx.fillText(
          layer.name,
          centerX,
          centerY - 80 * perspectiveScale + depthOffset
        );

        // Draw nodes
        const nodeRadius = 8 * perspectiveScale;
        const nodesPerRow = Math.ceil(Math.sqrt(layer.nodes.length));
        layer.nodes.forEach((node, idx) => {
          const row = Math.floor(idx / nodesPerRow);
          const col = idx % nodesPerRow;
          const nodeX = centerX - 120 * perspectiveScale + (col * 60 * perspectiveScale);
          const nodeY = centerY - 40 * perspectiveScale + (row * 50 * perspectiveScale) + depthOffset;

          // Node color based on status
          let nodeColor = '#00d9ff';
          if (node.status === 'warning') nodeColor = '#fbbf24';
          if (node.status === 'critical') nodeColor = '#ff3b57';

          // Draw node glow
          const grad = ctx.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, nodeRadius * 3);
          grad.addColorStop(0, nodeColor + '44');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, nodeRadius * 3, 0, Math.PI * 2);
          ctx.fill();

          // Draw node circle
          ctx.fillStyle = nodeColor;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, nodeRadius, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [visibleLayers, layers, rotation]);

  return (
    <div className="w-full space-y-4">
      {/* Canvas */}
      <motion.div
        className="relative rounded-xl overflow-hidden border"
        style={{
          borderColor: 'rgba(0, 217, 255, 0.3)',
          background: 'rgba(0, 0, 0, 0.3)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          onMouseMove={handleMouseMove}
          className="w-full cursor-move"
          style={{ display: 'block' }}
        />
      </motion.div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Depth Scale Control */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Depth Scale:</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={depthScale}
            onChange={(e) => setDepthScale(parseFloat(e.target.value))}
            className="w-24 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-foreground font-mono">{depthScale.toFixed(1)}x</span>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => {
            setRotation({ x: 0.5, y: 0.5 });
            setDepthScale(1);
          }}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Network Layers:</p>
        <div className="flex flex-wrap gap-2">
          {layers.map((layer) => (
            <motion.button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{
                borderColor: layer.color,
                background: visibleLayers.has(layer.id)
                  ? layer.color + '20'
                  : 'rgba(0, 0, 0, 0.2)',
                color: visibleLayers.has(layer.id) ? layer.color : '#888',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {layer.name}
              <span className="ml-2 text-[10px] opacity-60">
                ({layer.nodes.length})
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Info */}
      <motion.div
        className="p-3 rounded-lg text-xs text-muted-foreground"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderLeft: '2px solid rgba(0, 217, 255, 0.3)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p>
          <strong>Tip:</strong> Move your mouse over the canvas to rotate the 3D view. Toggle layers to focus on specific network segments.
        </p>
      </motion.div>
    </div>
  );
}

// Default network layers
const defaultLayers: NetworkLayer[] = [
  {
    id: 'dmz',
    name: 'DMZ',
    description: 'Demilitarized Zone',
    depth: 1,
    color: '#fb9238',
    nodes: [
      { id: 'web1', label: 'Web Server 1', ip: '203.0.113.10', status: 'healthy' },
      { id: 'web2', label: 'Web Server 2', ip: '203.0.113.11', status: 'healthy' },
      { id: 'mail', label: 'Mail Server', ip: '203.0.113.20', status: 'warning' },
    ],
  },
  {
    id: 'lan',
    name: 'LAN',
    description: 'Local Area Network',
    depth: 2,
    color: '#00d9ff',
    nodes: [
      { id: 'db1', label: 'Database 1', ip: '192.168.1.50', status: 'healthy' },
      { id: 'db2', label: 'Database 2', ip: '192.168.1.51', status: 'healthy' },
      { id: 'app', label: 'App Server', ip: '192.168.1.100', status: 'healthy' },
      { id: 'cache', label: 'Cache Server', ip: '192.168.1.101', status: 'healthy' },
    ],
  },
  {
    id: 'iot',
    name: 'IoT Network',
    description: 'Internet of Things Devices',
    depth: 3,
    color: '#a78bfa',
    nodes: [
      { id: 'sensor1', label: 'Sensor 1', ip: '10.0.1.10', status: 'healthy' },
      { id: 'sensor2', label: 'Sensor 2', ip: '10.0.1.11', status: 'critical' },
      { id: 'gateway', label: 'IoT Gateway', ip: '10.0.1.1', status: 'warning' },
      { id: 'device1', label: 'Device 1', ip: '10.0.1.20', status: 'healthy' },
    ],
  },
];
