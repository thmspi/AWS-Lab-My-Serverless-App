export const BASE_SPEED = 7;
export const MAX_SPEED = 18;
export const INITIAL_SPAWN_DELAY_MS = 1500;
export const MIN_SPAWN_DELAY_MS = 650;
export const DOUBLE_OBSTACLE_GAP = 14;
export const CACTUS_SOURCE_RECTS = {
  tall: { sourceX: 94, sourceY: 59, sourceWidth: 128, sourceHeight: 308 },
  compact: { sourceX: 39, sourceY: 486, sourceWidth: 244, sourceHeight: 213 },
};


function createObstacle({ x, groundY, tall }) {
  const width = tall ? 32 : 55;
  const height = tall ? 77 : 48;
  return { x, y: groundY - height, width, height, tall };
}


export function buildObstacleGroup({ startX, groundY, tall, isDouble }) {
  const first = createObstacle({ x: startX, groundY, tall });
  if (!isDouble) return [first];

  const secondTall = !tall;
  const second = createObstacle({
    x: first.x + first.width + DOUBLE_OBSTACLE_GAP,
    groundY,
    tall: secondTall,
  });
  return [first, second];
}


export function calculateSpriteFrame(progress, frameCount, frameStep) {
  const safeProgress = Math.max(0, Number(progress) || 0);
  return Math.floor(safeProgress / frameStep) % frameCount;
}


export function calculateSpriteFrameRect({ frameIndex, columns, frameWidth, frameHeight }) {
  return {
    sourceX: (frameIndex % columns) * frameWidth,
    sourceY: Math.floor(frameIndex / columns) * frameHeight,
    sourceWidth: frameWidth,
    sourceHeight: frameHeight,
  };
}


export function calculateCenteredSpriteDestination({
  anchor,
  bottomY,
  sourceWidth,
  sourceHeight,
  drawHeight,
}) {
  const width = Math.round(drawHeight * sourceWidth / sourceHeight);
  return {
    x: Math.round(anchor.x + anchor.width / 2 - width / 2),
    y: bottomY - drawHeight,
    width,
    height: drawHeight,
  };
}


export function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  );
}


export function scoreFromDistance(distance) {
  return Math.max(0, Math.floor(distance / 10));
}


export function calculateGameSpeed(distance) {
  return Math.min(MAX_SPEED, BASE_SPEED + distance / 2500);
}


export function calculateSpawnDelay(distance) {
  return Math.max(MIN_SPAWN_DELAY_MS, INITIAL_SPAWN_DELAY_MS - distance / 8);
}
