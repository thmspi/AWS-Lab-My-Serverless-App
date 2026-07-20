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
} from './game-rules.js';


const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 360;
const GROUND_Y = 286;
const GRAVITY = 0.92;
const JUMP_FORCE = -16.5;
const DINO_DRAW_SIZE = 72;
const SPRITE_DEFINITIONS = {
  idle: { source: '/assets/dino-idle.png', frameCount: 3, columns: 3, frameWidth: 24, frameHeight: 24 },
  move: { source: '/assets/dino-move.png', frameCount: 6, columns: 6, frameWidth: 24, frameHeight: 24 },
  dash: { source: '/assets/dino-dash.png', frameCount: 6, columns: 6, frameWidth: 24, frameHeight: 24 },
  jump: { source: '/assets/dino-jump.png', frameCount: 4, columns: 4, frameWidth: 24, frameHeight: 24 },
  dead: { source: '/assets/dino-dead.png', frameCount: 5, columns: 5, frameWidth: 24, frameHeight: 24 },
  cactus: { source: '/assets/cactus.png' },
};


export class DinoGame {
  constructor(canvas, { onScoreChange = () => {}, onGameOver = () => {} } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onScoreChange = onScoreChange;
    this.onGameOver = onGameOver;
    this.animationFrame = null;
    this.lastFrameTime = performance.now();
    this.lastSpawnTime = 0;
    this.frameClock = 0;
    this.deathAnimationStartedAt = 0;
    this.sprites = this.loadSprites();
    this.localBest = Number.parseInt(localStorage.getItem('dinoLocalBest') ?? '0', 10) || 0;
    this.reset();
    this.bindControls();
    this.draw();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  loadSprites() {
    return Object.fromEntries(Object.entries(SPRITE_DEFINITIONS).map(([name, definition]) => {
      const image = new Image();
      image.addEventListener('load', () => this.draw(), { once: true });
      image.src = definition.source;
      return [name, { ...definition, image }];
    }));
  }

  reset() {
    this.state = 'idle';
    this.distance = 0;
    this.score = 0;
    this.dino = { x: 96, y: GROUND_Y - 58, width: 54, height: 58, velocityY: 0 };
    this.obstacles = [];
    this.clouds = [
      { x: 160, y: 70, size: 1 },
      { x: 500, y: 115, size: 0.75 },
      { x: 760, y: 58, size: 1.1 },
    ];
    this.onScoreChange(this.score, this.localBest);
  }

  bindControls() {
    this.handleKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
        event.preventDefault();
        this.jump();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    cancelAnimationFrame(this.animationFrame);
  }

  start() {
    if (this.state === 'running') return;
    if (this.state === 'gameover') this.reset();
    this.state = 'running';
    this.lastSpawnTime = performance.now();
  }

  jump() {
    if (this.state !== 'running') this.start();
    const onGround = this.dino.y >= GROUND_Y - this.dino.height - 1;
    if (onGround) this.dino.velocityY = JUMP_FORCE;
  }

  loop(time) {
    const delta = Math.min((time - this.lastFrameTime) / 16.67, 2);
    this.frameClock += time - this.lastFrameTime;
    this.lastFrameTime = time;
    if (this.state === 'running') this.update(delta, time);
    this.draw();
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(delta, time) {
    const speed = calculateGameSpeed(this.distance);
    this.distance += speed * delta;
    const nextScore = scoreFromDistance(this.distance);
    if (nextScore !== this.score) {
      this.score = nextScore;
      this.onScoreChange(this.score, this.localBest);
    }

    this.dino.velocityY += GRAVITY * delta;
    this.dino.y += this.dino.velocityY * delta;
    const floor = GROUND_Y - this.dino.height;
    if (this.dino.y > floor) {
      this.dino.y = floor;
      this.dino.velocityY = 0;
    }

    if (time - this.lastSpawnTime >= calculateSpawnDelay(this.distance)) {
      this.spawnObstacle();
      this.lastSpawnTime = time + Math.random() * 300;
    }

    for (const obstacle of this.obstacles) obstacle.x -= speed * delta;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

    for (const cloud of this.clouds) {
      cloud.x -= speed * 0.08 * delta;
      if (cloud.x < -100) cloud.x = WORLD_WIDTH + Math.random() * 200;
    }

    const dinoHitbox = {
      x: this.dino.x + 8,
      y: this.dino.y + 8,
      width: this.dino.width - 14,
      height: this.dino.height - 10,
    };
    if (this.obstacles.some((obstacle) => rectanglesOverlap(dinoHitbox, obstacle))) {
      this.finish();
    }
  }

  spawnObstacle() {
    const tall = Math.random() > 0.55;
    const isDouble = this.distance > 700 && Math.random() > 0.66;
    this.obstacles.push(...buildObstacleGroup({
      startX: WORLD_WIDTH + 30,
      groundY: GROUND_Y,
      tall,
      isDouble,
    }));
  }

  finish() {
    this.state = 'gameover';
    this.deathAnimationStartedAt = this.frameClock;
    if (this.score > this.localBest) {
      this.localBest = this.score;
      localStorage.setItem('dinoLocalBest', String(this.localBest));
    }
    this.onScoreChange(this.score, this.localBest);
    this.onGameOver(this.score);
    this.draw();
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const sky = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    sky.addColorStop(0, '#0a0a0b');
    sky.addColorStop(1, '#1b1b1e');
    context.fillStyle = sky;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawStars(context);
    for (const cloud of this.clouds) this.drawCloud(context, cloud);
    this.drawGround(context);
    for (const obstacle of this.obstacles) this.drawObstacle(context, obstacle);
    this.drawDino(context);

    if (this.state !== 'running') this.drawOverlay(context);
  }

  drawStars(context) {
    context.fillStyle = 'rgba(255, 255, 255, 0.32)';
    for (let index = 0; index < 36; index += 1) {
      const x = (index * 83 + 31) % WORLD_WIDTH;
      const y = (index * 47 + 19) % 185;
      context.fillRect(x, y, index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1);
    }
  }

  drawCloud(context, cloud) {
    context.save();
    context.translate(cloud.x, cloud.y);
    context.scale(cloud.size, cloud.size);
    context.fillStyle = 'rgba(210, 210, 215, 0.1)';
    context.beginPath();
    context.arc(0, 12, 20, 0, Math.PI * 2);
    context.arc(24, 0, 28, 0, Math.PI * 2);
    context.arc(55, 14, 20, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawGround(context) {
    context.fillStyle = '#080809';
    context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    context.strokeStyle = '#b8b8bc';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, GROUND_Y);
    context.lineTo(WORLD_WIDTH, GROUND_Y);
    context.stroke();
    context.fillStyle = 'rgba(220, 220, 224, 0.14)';
    const offset = this.distance % 44;
    for (let x = -offset; x < WORLD_WIDTH; x += 44) context.fillRect(x, GROUND_Y + 18, 22, 3);
  }

  drawImageRegion(context, image, source, destination) {
    if (!image?.complete || !image.naturalWidth) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.filter = 'grayscale(1) contrast(1.18) brightness(1.08)';
    context.drawImage(
      image,
      source.sourceX,
      source.sourceY,
      source.sourceWidth,
      source.sourceHeight,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    context.restore();
    return true;
  }

  drawSprite(context, spriteName, frameIndex, destination) {
    const sprite = this.sprites[spriteName];
    const source = calculateSpriteFrameRect({
      frameIndex,
      columns: sprite.columns,
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
    });
    return this.drawImageRegion(context, sprite.image, source, destination);
  }

  drawDino(context) {
    const onGround = this.dino.y >= GROUND_Y - this.dino.height - 1;
    let spriteName = 'idle';
    let frameIndex = calculateSpriteFrame(this.frameClock, SPRITE_DEFINITIONS.idle.frameCount, 260);

    if (this.state === 'gameover') {
      spriteName = 'dead';
      frameIndex = Math.min(
        SPRITE_DEFINITIONS.dead.frameCount - 1,
        Math.floor((this.frameClock - this.deathAnimationStartedAt) / 105),
      );
    } else if (this.state === 'running' && !onGround) {
      spriteName = 'jump';
      frameIndex = calculateSpriteFrame(this.frameClock, SPRITE_DEFINITIONS.jump.frameCount, 110);
    } else if (this.state === 'running') {
      spriteName = calculateGameSpeed(this.distance) >= 11 ? 'dash' : 'move';
      frameIndex = calculateSpriteFrame(
        this.frameClock,
        SPRITE_DEFINITIONS[spriteName].frameCount,
        spriteName === 'dash' ? 65 : 90,
      );
    }

    const wasDrawn = this.drawSprite(context, spriteName, frameIndex, {
      x: this.dino.x - 9,
      y: this.dino.y - 14,
      width: DINO_DRAW_SIZE,
      height: DINO_DRAW_SIZE,
    });
    if (wasDrawn) return;

    const { x, y } = this.dino;
    context.save();
    context.translate(x, y);
    context.fillStyle = '#e4e4e7';
    context.fillRect(8, 18, 36, 34);
    context.fillRect(24, 0, 30, 30);
    context.fillRect(0, 35, 18, 10);
    context.fillStyle = '#111113';
    context.fillRect(43, 7, 5, 5);
    context.fillStyle = '#8f8f94';
    context.fillRect(44, 18, 10, 4);
    context.fillStyle = '#e4e4e7';
    const legOffset = this.state === 'running' && Math.floor(this.distance / 16) % 2 ? 8 : 0;
    context.fillRect(14, 48, 9, 10 - legOffset / 2);
    context.fillRect(34, 48, 9, 6 + legOffset / 2);
    context.restore();
  }

  drawObstacle(context, obstacle) {
    const source = obstacle.tall ? CACTUS_SOURCE_RECTS.tall : CACTUS_SOURCE_RECTS.compact;
    const destination = calculateCenteredSpriteDestination({
      anchor: obstacle,
      bottomY: GROUND_Y,
      sourceWidth: source.sourceWidth,
      sourceHeight: source.sourceHeight,
      drawHeight: obstacle.height,
    });
    const wasDrawn = this.drawImageRegion(
      context,
      this.sprites.cactus.image,
      source,
      destination,
    );
    if (wasDrawn) return;

    context.fillStyle = obstacle.tall ? '#a1a1a6' : '#c4c4c8';
    context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    context.fillStyle = 'rgba(8, 8, 9, 0.36)';
    context.fillRect(obstacle.x + 7, obstacle.y + 10, 5, obstacle.height - 18);
  }

  drawOverlay(context) {
    context.fillStyle = 'rgba(7, 7, 8, 0.76)';
    context.fillRect(250, 105, 400, 115);
    context.strokeStyle = 'rgba(220, 220, 224, 0.28)';
    context.strokeRect(250, 105, 400, 115);
    context.textAlign = 'center';
    context.fillStyle = '#f5f8ff';
    context.font = '700 26px system-ui';
    context.fillText(this.state === 'gameover' ? 'PARTIE TERMINÉE' : 'DINO', 450, 150);
    context.fillStyle = '#a1a1a6';
    context.font = '16px system-ui';
    context.fillText(
      this.state === 'gameover' ? 'Espace pour recommencer' : 'Espace ou ↑ pour sauter',
      450,
      186,
    );
  }
}
