import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CACTUS_SOURCE_RECTS,
  buildObstacleGroup,
  calculateCenteredSpriteDestination,
  calculateGameSpeed,
  calculateSpawnDelay,
  calculateSpriteFrame,
  calculateSpriteFrameRect,
  rectanglesOverlap,
  scoreFromDistance,
} from '../src/game-rules.js';


test('collision requires actual rectangle overlap', () => {
  assert.equal(
    rectanglesOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 9, y: 9, width: 10, height: 10 },
    ),
    true,
  );
  assert.equal(
    rectanglesOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 10, width: 10, height: 10 },
    ),
    false,
  );
});

test('score is monotonic and integer based', () => {
  assert.equal(scoreFromDistance(0), 0);
  assert.equal(scoreFromDistance(99.9), 9);
  assert.equal(scoreFromDistance(100), 10);
});

test('game difficulty is capped for playability', () => {
  assert.equal(calculateGameSpeed(0), 7);
  assert.equal(calculateGameSpeed(100_000), 18);
  assert.equal(calculateSpawnDelay(0), 1500);
  assert.equal(calculateSpawnDelay(100_000), 650);
});

test('a single obstacle group contains one obstacle at the requested position', () => {
  assert.deepEqual(
    buildObstacleGroup({ startX: 930, groundY: 286, tall: false, isDouble: false }),
    [{ x: 930, y: 238, width: 55, height: 48, tall: false }],
  );
});

test('a double obstacle group places two non-overlapping obstacles together', () => {
  const obstacles = buildObstacleGroup({ startX: 930, groundY: 286, tall: true, isDouble: true });

  assert.equal(obstacles.length, 2);
  assert.equal(obstacles[0].x, 930);
  assert.ok(obstacles[1].x > obstacles[0].x + obstacles[0].width);
  assert.ok(obstacles[1].x - (obstacles[0].x + obstacles[0].width) <= 18);
  assert.equal(obstacles[0].y + obstacles[0].height, 286);
  assert.equal(obstacles[1].y + obstacles[1].height, 286);
});

test('sprite animation frames loop at a stable interval', () => {
  assert.equal(calculateSpriteFrame(0, 6, 10), 0);
  assert.equal(calculateSpriteFrame(29, 6, 10), 2);
  assert.equal(calculateSpriteFrame(60, 6, 10), 0);
});

test('sprite frame rectangles support horizontal strips and grids', () => {
  assert.deepEqual(
    calculateSpriteFrameRect({ frameIndex: 5, columns: 6, frameWidth: 24, frameHeight: 24 }),
    { sourceX: 120, sourceY: 0, sourceWidth: 24, sourceHeight: 24 },
  );
  assert.deepEqual(
    calculateSpriteFrameRect({ frameIndex: 6, columns: 4, frameWidth: 135, frameHeight: 180 }),
    { sourceX: 270, sourceY: 180, sourceWidth: 135, sourceHeight: 180 },
  );
});

test('cactus crops exclude transparent margins and the detached artifact', () => {
  assert.deepEqual(CACTUS_SOURCE_RECTS, {
    tall: { sourceX: 94, sourceY: 59, sourceWidth: 128, sourceHeight: 308 },
    compact: { sourceX: 39, sourceY: 486, sourceWidth: 244, sourceHeight: 213 },
  });
});

test('a cropped sprite is centered on its hitbox and grounded without offset', () => {
  assert.deepEqual(
    calculateCenteredSpriteDestination({
      anchor: { x: 930, width: 32 },
      bottomY: 286,
      sourceWidth: 128,
      sourceHeight: 308,
      drawHeight: 77,
    }),
    { x: 930, y: 209, width: 32, height: 77 },
  );
});
