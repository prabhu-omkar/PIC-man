import MovingDirection from "./MovingDirection.js";

export default class Pacman {
  constructor(x, y, tileSize, velocity, tileMap) {
    this.x = x;
    this.y = y;
    this.tileSize = tileSize;
    this.velocity = velocity;
    this.tileMap = tileMap;

    this.currentMovingDirection = null;
    this.requestedMovingDirection = null;

    this.pacmanAnimationTimerDefault = 10;
    this.pacmanAnimationTimer = null;

    this.pacmanRotation = this.Rotation.right;
    this.wakaSound = new Audio("sounds/waka.wav");
    if (window.isMuted) this.wakaSound.muted = true;

    this.powerDotSound = new Audio("sounds/power_dot.wav");
    if (window.isMuted) this.powerDotSound.muted = true;
    this.powerDotSound.loop = true;
    this.powerDotActive = false;
    this.powerDotAboutToExpire = false;

    this.powerDotEndTime = null;
    this.powerDotWarningTime = null;
    this.ghostRespawns = [];

    this.eatGhostSound = new Audio("sounds/eat_ghost.wav");
    if (window.isMuted) this.eatGhostSound.muted = true;
    this.respawnSound = new Audio("sounds/respawn.wav");
    if (window.isMuted) this.respawnSound.muted = true;

    this.ghostKills = 0;
    this.madeFirstMove = false;

    // AI-controlled: no keyboard listener
    this.#loadPacmanImages();

    window.addEventListener("muteToggled", () => {
      this.wakaSound.muted = window.isMuted;
      this.powerDotSound.muted = window.isMuted;
      this.eatGhostSound.muted = window.isMuted;
      this.respawnSound.muted = window.isMuted;
    });
  }

  Rotation = {
    right: 0,
    down: 1,
    left: 2,
    up: 3,
  };

  draw(ctx, pause, enemies, gameTime) {
    const paused = pause();
    if (!paused) {
      this.#aiDecide(enemies);
      this.#move();
      this.#animate();
    }
    this.#eatDot();
    this.#eatPowerDot(gameTime);
    this.#eatGhost(enemies, gameTime);

    const size = this.tileSize / 2;

    ctx.save();
    ctx.translate(this.x + size, this.y + size);
    ctx.rotate((this.pacmanRotation * 90 * Math.PI) / 180);
    ctx.drawImage(
      this.pacmanImages[this.pacmanImageIndex],
      -size,
      -size,
      this.tileSize,
      this.tileSize
    );
    ctx.restore();

    // Handle power dot timing
    if (!paused && this.powerDotActive) {
      const now = gameTime.now;
      if (now >= this.powerDotEndTime) {
        this.powerDotActive = false;
        this.powerDotAboutToExpire = false;
        this.powerDotSound.pause();
        const bgMusic = document.getElementById("bgMusic");
        if (bgMusic && !window.isMuted) bgMusic.play().catch(() => {});
      } else if (now >= this.powerDotWarningTime) {
        this.powerDotAboutToExpire = true;
      }
    }

    // Handle queued ghost respawns
    if (!paused) {
      this.ghostRespawns = this.ghostRespawns.filter(data => {
        if (!this.powerDotActive) {
          const newEnemy = new data.constructor(
            data.spawn.x,
            data.spawn.y,
            this.tileSize,
            data.velocity,
            this.tileMap,
            data.spawn.name
          );
          newEnemy.fadingIn = true;
          newEnemy.respawnAlpha = 0;
          enemies.push(newEnemy);
          if (!window.isMuted) this.respawnSound.play().catch(() => {});
          return false;
        }
        return true;
      });
    }
  }

  #loadPacmanImages() {
    const load = name => {
      const img = new Image();
      img.src = `images/${name}`;
      return img;
    };

    this.pacmanImages = [
      load("pacman_frame_0.png"),
      load("pacman_frame_1.png"),
      load("pacman_frame_2.png"),
      load("pacman_frame_3.png"),
      load("pacman_frame_4.png"),
      load("pacman_frame_5.png"),
      load("pacman_frame_6.png"),
    ];
    this.pacmanImageIndex = 0;
  }

  #torusDist(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    const wrappedDc = this.tileMap.map[0].length - dc;
    return dr + Math.min(dc, wrappedDc);
  }

  // ========== AI DECISION MAKING ==========

  #aiDecide(enemies) {
    if (!Number.isInteger(this.x / this.tileSize) || !Number.isInteger(this.y / this.tileSize)) return;

    const row = Math.floor(this.y / this.tileSize);
    const col = Math.floor(this.x / this.tileSize);

    // HUNT MODE: power dot active → chase nearest ghost
    if (this.powerDotActive && enemies.length > 0) {
      let nearest = null;
      let best = Infinity;
      for (const e of enemies) {
        const d = this.#torusDist(Math.floor(e.y / this.tileSize), Math.floor(e.x / this.tileSize), row, col);
        if (d < best) { best = d; nearest = e; }
      }
      if (nearest) {
        const dir = this.#bfsTo(row, col, Math.floor(nearest.y / this.tileSize), Math.floor(nearest.x / this.tileSize));
        if (dir !== null) { this.requestedMovingDirection = dir; return; }
      }
    }

    // EVASION CHECK: any ghost within 5 tiles?
    const danger = 5;
    const nearby = enemies.filter(e => {
      const d = this.#torusDist(Math.floor(e.y / this.tileSize), Math.floor(e.x / this.tileSize), row, col);
      return d <= danger;
    });

    if (nearby.length > 0 && !this.powerDotActive) {
      this.requestedMovingDirection = this.#evade(row, col, nearby);
    } else {
      const dir = this.#seekDot(row, col);
      if (dir !== null) this.requestedMovingDirection = dir;
    }
  }

  #bfsTo(sr, sc, tr, tc) {
    const dirs = [
      { dir: MovingDirection.up, dr: -1, dc: 0 },
      { dir: MovingDirection.down, dr: 1, dc: 0 },
      { dir: MovingDirection.left, dr: 0, dc: -1 },
      { dir: MovingDirection.right, dr: 0, dc: 1 },
    ];
    const visited = new Set();
    visited.add(`${sr},${sc}`);
    const queue = [];

    for (const d of dirs) {
      let nr = sr + d.dr, nc = sc + d.dc;
      if (nc < 0) nc = this.tileMap.map[0].length - 1;
      else if (nc >= this.tileMap.map[0].length) nc = 0;
      if (this.#walkable(nr, nc) && !visited.has(`${nr},${nc}`)) {
        if (nr === tr && nc === tc) return d.dir;
        visited.add(`${nr},${nc}`);
        queue.push({ r: nr, c: nc, first: d.dir });
      }
    }
    let h = 0;
    while (h < queue.length) {
      const { r, c, first } = queue[h++];
      for (const d of dirs) {
        let nr = r + d.dr, nc = c + d.dc;
        if (nc < 0) nc = this.tileMap.map[0].length - 1;
        else if (nc >= this.tileMap.map[0].length) nc = 0;
        const k = `${nr},${nc}`;
        if (this.#walkable(nr, nc) && !visited.has(k)) {
          if (nr === tr && nc === tc) return first;
          visited.add(k);
          queue.push({ r: nr, c: nc, first });
        }
      }
    }
    return this.currentMovingDirection;
  }

  #seekDot(sr, sc) {
    const dirs = [
      { dir: MovingDirection.up, dr: -1, dc: 0 },
      { dir: MovingDirection.down, dr: 1, dc: 0 },
      { dir: MovingDirection.left, dr: 0, dc: -1 },
      { dir: MovingDirection.right, dr: 0, dc: 1 },
    ];
    const visited = new Set();
    visited.add(`${sr},${sc}`);
    const queue = [];

    for (const d of dirs) {
      let nr = sr + d.dr, nc = sc + d.dc;
      if (nc < 0) nc = this.tileMap.map[0].length - 1;
      else if (nc >= this.tileMap.map[0].length) nc = 0;
      if (this.#walkable(nr, nc) && !visited.has(`${nr},${nc}`)) {
        const t = this.tileMap.map[nr][nc];
        if (t === 0 || t === 7) return d.dir;
        visited.add(`${nr},${nc}`);
        queue.push({ r: nr, c: nc, first: d.dir });
      }
    }
    let h = 0;
    while (h < queue.length) {
      const { r, c, first } = queue[h++];
      for (const d of dirs) {
        let nr = r + d.dr, nc = c + d.dc;
        if (nc < 0) nc = this.tileMap.map[0].length - 1;
        else if (nc >= this.tileMap.map[0].length) nc = 0;
        const k = `${nr},${nc}`;
        if (this.#walkable(nr, nc) && !visited.has(k)) {
          const t = this.tileMap.map[nr][nc];
          if (t === 0 || t === 7) return first;
          visited.add(k);
          queue.push({ r: nr, c: nc, first });
        }
      }
    }
    return this.currentMovingDirection;
  }

  #evade(row, col, ghosts) {
    const dirs = [
      { dir: MovingDirection.up, dr: -1, dc: 0 },
      { dir: MovingDirection.down, dr: 1, dc: 0 },
      { dir: MovingDirection.left, dr: 0, dc: -1 },
      { dir: MovingDirection.right, dr: 0, dc: 1 },
    ];
    
    // 1. Build a 'danger map' using BFS from all ghost locations
    const R = this.tileMap.map.length;
    const C = this.tileMap.map[0].length;
    const distFromGhost = Array(R).fill(0).map(() => Array(C).fill(Infinity));
    const gQueue = [];
    
    for (const g of ghosts) {
      const gr = Math.floor(g.y / this.tileSize);
      const gc = Math.floor(g.x / this.tileSize);
      if (gr >= 0 && gr < R && gc >= 0 && gc < C) {
        distFromGhost[gr][gc] = 0;
        gQueue.push({ r: gr, c: gc, d: 0 });
      }
    }
    
    let head = 0;
    while (head < gQueue.length) {
      const { r, c, d } = gQueue[head++];
      if (d > 15) continue; // Limit search radius
      for (const m of dirs) {
        let nr = r + m.dr, nc = c + m.dc;
        if (nc < 0) nc = this.tileMap.map[0].length - 1;
        else if (nc >= this.tileMap.map[0].length) nc = 0;
        if (this.#walkable(nr, nc) && distFromGhost[nr][nc] > d + 1) {
          distFromGhost[nr][nc] = d + 1;
          gQueue.push({ r: nr, c: nc, d: d + 1 });
        }
      }
    }
    
    // 2. BFS from Pac-Man to find the "safest" reachable tile
    const pQueue = [{ r: row, c: col, first: null, dist: 0 }];
    const visited = new Set();
    visited.add(`${row},${col}`);
    head = 0;
    
    let bestNode = null;
    let maxSafety = -1;
    let minPathDist = Infinity;
    
    while (head < pQueue.length) {
      const { r, c, first, dist } = pQueue[head++];
      const safety = distFromGhost[r][c];
      
      if (safety > maxSafety || (safety === maxSafety && dist < minPathDist)) {
        maxSafety = safety;
        minPathDist = dist;
        bestNode = { r, c, first };
      }
      
      if (dist > 8) continue; // Lookahead depth
      
      for (const m of dirs) {
        let nr = r + m.dr, nc = c + m.dc;
        if (nc < 0) nc = this.tileMap.map[0].length - 1;
        else if (nc >= this.tileMap.map[0].length) nc = 0;
        const k = `${nr},${nc}`;
        if (this.#walkable(nr, nc) && !visited.has(k)) {
          // Avoid paths where a ghost would intercept Pac-Man before he gets there
          if (distFromGhost[nr][nc] <= dist + 1) continue;
          visited.add(k);
          pQueue.push({ r: nr, c: nc, first: first === null ? m.dir : first, dist: dist + 1 });
        }
      }
    }
    
    if (bestNode && bestNode.first !== null) {
      return bestNode.first;
    }
    
    // Fallback: pick the valid neighbor with the highest danger map value
    const valid = dirs.filter(d => this.#walkable(row + d.dr, col + d.dc));
    if (valid.length === 0) return this.currentMovingDirection;

    let bestDir = valid[0].dir;
    let bestScore = -Infinity;
    for (const m of valid) {
      let nr = row + m.dr, nc = col + m.dc;
      if (nc < 0) nc = this.tileMap.map[0].length - 1;
      else if (nc >= this.tileMap.map[0].length) nc = 0;
      const score = distFromGhost[nr][nc];
      if (score > bestScore) {
        bestScore = score;
        bestDir = m.dir;
      }
    }
    return bestDir;
  }

  #walkable(r, c) {
    if (r < 0 || r >= this.tileMap.map.length || c < 0 || c >= this.tileMap.map[0].length) return false;
    return this.tileMap.map[r][c] !== 1;
  }

  // ========== MOVEMENT (unchanged logic) ==========

  #move() {
    if (this.currentMovingDirection !== this.requestedMovingDirection) {
      if (
        Number.isInteger(this.x / this.tileSize) &&
        Number.isInteger(this.y / this.tileSize)
      ) {
        if (
          !this.tileMap.didCollideWithEnvironment(
            this.x,
            this.y,
            this.requestedMovingDirection
          )
        ) {
          this.currentMovingDirection = this.requestedMovingDirection;
        }
      }
    }

    if (
      this.tileMap.didCollideWithEnvironment(
        this.x,
        this.y,
        this.currentMovingDirection
      )
    ) {
      this.pacmanAnimationTimer = null;
      this.pacmanImageIndex = 1;
      return;
    } else if (
      this.currentMovingDirection !== null &&
      this.pacmanAnimationTimer === null
    ) {
      this.pacmanAnimationTimer = this.pacmanAnimationTimerDefault;
    }

    switch (this.currentMovingDirection) {
      case MovingDirection.up:
        this.y -= this.velocity;
        this.pacmanRotation = this.Rotation.up;
        break;
      case MovingDirection.down:
        this.y += this.velocity;
        this.pacmanRotation = this.Rotation.down;
        break;
      case MovingDirection.left:
        this.x -= this.velocity;
        this.pacmanRotation = this.Rotation.left;
        break;
      case MovingDirection.right:
        this.x += this.velocity;
        this.pacmanRotation = this.Rotation.right;
        break;
    }
    
    // Portal wrapping
    if (this.x < 0) {
      // Walked off the left edge — wrap to right side
      this.x += this.tileMap.map[0].length * this.tileSize;
    } else {
      const column = Math.floor(this.x / this.tileSize);
      const row = Math.floor(this.y / this.tileSize);
      if (this.tileMap.map[row]?.[column] === 2 &&
          column === this.tileMap.map[0].length - 1 &&
          this.currentMovingDirection === MovingDirection.right) {
        this.x = 0;
      }
    }
  }

  #animate() {
    if (this.pacmanAnimationTimer === null) return;

    this.pacmanAnimationTimer--;
    if (this.pacmanAnimationTimer === 0) {
      this.pacmanAnimationTimer = this.pacmanAnimationTimerDefault;
      this.pacmanImageIndex = (this.pacmanImageIndex + 1) % this.pacmanImages.length;
    }
  }

  #eatDot() {
    if (this.tileMap.eatDot(this.x, this.y) && this.madeFirstMove) {
      if (!window.isMuted) {
        this.wakaSound.volume = 0.8;
        this.wakaSound.play().catch(() => {});
      }
      window.score += 10;
    }
  }

  #eatPowerDot(gameTime) {
    if (this.tileMap.eatPowerDot(this.x, this.y)) {
      const bgMusic = document.getElementById("bgMusic");
      if (bgMusic) bgMusic.pause();

      this.powerDotSound.currentTime = 0;
      if (!window.isMuted) this.powerDotSound.play().catch(() => {});
      this.powerDotActive = true;
      this.powerDotAboutToExpire = false;

      const now = gameTime.now;
      this.powerDotEndTime = now + 6000;
      this.powerDotWarningTime = now + 4000;
    }
  }

  #eatGhost(enemies, gameTime) {
    if (this.powerDotActive) {
      const now = gameTime.now;
      const collideEnemies = enemies.filter(enemy => enemy.collideWith(this));
      collideEnemies.forEach(enemy => {
        enemies.splice(enemies.indexOf(enemy), 1);
        if (!window.isMuted) this.eatGhostSound.play().catch(() => {});
        this.ghostKills++;

        const spawn = this.tileMap.enemySpawnPoints.find(e => e.name === enemy.color);
        if (spawn) {
          this.ghostRespawns.push({
            spawn,
            constructor: enemy.constructor,
            velocity: enemy.velocity,
            schedule: this.powerDotEndTime
          });
        }
      });
    }
  }
}
        
// Breadth-First Search (BFS) pathfinding
