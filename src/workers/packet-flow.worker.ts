// WebWorker for offloading 3D packet flow calculations
// This prevents UI blocking during heavy 3D computations

interface Packet {
  id: string;
  fromId: string;
  toId: string;
  progress: number;
  speed: number;
  size: number;
  color: string;
  label: string;
}

interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  label: string;
  ip: string;
  color: string;
  glowColor: string;
}

interface ProjectedNode {
  sx: number;
  sy: number;
  scale: number;
}

// Message types
interface WorkerMessage {
  type: 'calculate-projection' | 'update-packets' | 'get-stats';
  data: any;
}

interface WorkerResponse {
  type: 'projection-result' | 'packets-result' | 'stats-result';
  data: any;
}

let packets: Packet[] = [];
let nodes: Node3D[] = [];
let typeCounts: Record<string, number> = {};
let totalPackets = 0;
let blockedPackets = 0;

// Calculate 3D to 2D projection
function project3D(
  node: Node3D,
  rotX: number,
  rotY: number,
  fov: number,
  canvasWidth: number,
  canvasHeight: number
): ProjectedNode {
  // Apply rotations
  let x = node.x;
  let y = node.y;
  let z = node.z;

  // Rotate around X axis
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;

  // Rotate around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;

  // Perspective projection
  const scale = fov / (fov + z2);
  const sx = canvasWidth / 2 + x2 * scale * 50;
  const sy = canvasHeight / 2 + y1 * scale * 50;

  return { sx, sy, scale };
}

// Update packet positions
function updatePackets(deltaTime: number): void {
  packets = packets.filter(p => {
    p.progress += p.speed * deltaTime;
    if (p.progress >= 1) {
      typeCounts[p.label] = (typeCounts[p.label] || 0) + 1;
      totalPackets++;
      if (p.label === 'BLOCKED') blockedPackets++;
      return false;
    }
    return true;
  });
}

// Main worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'calculate-projection': {
        const { node, rotX, rotY, fov, canvasWidth, canvasHeight } = data;
        const result = project3D(node, rotX, rotY, fov, canvasWidth, canvasHeight);
        const response: WorkerResponse = {
          type: 'projection-result',
          data: result,
        };
        self.postMessage(response);
        break;
      }

      case 'update-packets': {
        const { newPackets, deltaTime } = data;
        packets = newPackets;
        updatePackets(deltaTime);
        const response: WorkerResponse = {
          type: 'packets-result',
          data: {
            packets,
            typeCounts,
            totalPackets,
            blockedPackets,
          },
        };
        self.postMessage(response);
        break;
      }

      case 'get-stats': {
        const response: WorkerResponse = {
          type: 'stats-result',
          data: {
            typeCounts,
            totalPackets,
            blockedPackets,
          },
        };
        self.postMessage(response);
        break;
      }

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      data: { message: (error as Error).message },
    });
  }
};

// Batch projection calculation for multiple nodes
function batchProjectNodes(
  nodesToProject: Node3D[],
  rotX: number,
  rotY: number,
  fov: number,
  canvasWidth: number,
  canvasHeight: number
): Map<string, ProjectedNode> {
  const projections = new Map<string, ProjectedNode>();
  for (const node of nodesToProject) {
    projections.set(node.id, project3D(node, rotX, rotY, fov, canvasWidth, canvasHeight));
  }
  return projections;
}

// Extended message handler for batch operations
const extendedHandler = (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'batch-project') {
    const { nodes: nodesToProject, rotX, rotY, fov, canvasWidth, canvasHeight } = data;
    const projections = batchProjectNodes(
      nodesToProject,
      rotX,
      rotY,
      fov,
      canvasWidth,
      canvasHeight
    );
    const projectionArray = Array.from(projections.entries()).map(([id, proj]) => ({
      id,
      ...proj,
    }));
    self.postMessage({
      type: 'batch-project-result',
      data: projectionArray,
    });
  }
};

// Update the main handler to include batch operations
const originalHandler = self.onmessage;
self.onmessage = (event: MessageEvent) => {
  if (event.data.type === 'batch-project') {
    extendedHandler(event);
  } else {
    originalHandler?.call(self, event);
  }
};
