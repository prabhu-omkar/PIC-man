import MovingDirection from "./MovingDirection.js";

export default class Enemy {
  constructor(x, y, tileSize, velocity, tileMap, name = "pinky") {
    this.color = name;
    this.x = x;
    this.y = y;
    this.tileSize = tileSize;
    this.velocity = velocity;
    this.tileMap = tileMap;

    this.#loadImages();

    this.directionTimerDefault = this.#random(10, 25);
    this.directionTimer = this.directionTimerDefault;

    this.scaredAboutToExpireTimerDefault = 10;
    this.scaredAboutToExpireTimer = this.scaredAboutToExpireTimerDefault;

    this.respawnAlpha = 0;
    this.fadingIn = true;

    // All ghosts start as AI-controlled; Game.js sets isPlayerControlled
    this.isPlayerControlled = false;
    this.requestedMovingDirection = null;
    this.madeFirstMove = false;
    this.movingDirection = Math.floor(
      Math.random() * Object.keys(MovingDirection).length
    );
  }

  draw(ctx, pause, pacman) {
    if (!pause()) {
      if (this.isPlayerControlled) {
        let targetVelocity = pacman.powerDotActive ? 1.5 : 2;
        if (this.velocity !== targetVelocity) {
          if (Number.isInteger(this.x / this.tileSize) && Number.isInteger(this.y / this.tileSize)) {
             this.velocity = targetVelocity;
          }
        }
        this.#movePlayer();
      } else {
        this.#move();
        this.#changeDirection(pacman);
      }
    }
    this.#setImage(ctx, pacman);
  }

  collideWith(pacman) {
    const size = this.tileSize / 2;
    return (
      this.x < pacman.x + size &&
      this.x + size > pacman.x &&
      this.y < pacman.y + size &&
      this.y + size > pacman.y
    );
  }

  // ========== PLAYER MOVEMENT (controlled ghost) ==========

  #movePlayer() {
    // Input buffering: switch direction at tile boundaries
    if (this.movingDirection !== this.requestedMovingDirection) {
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
          this.movingDirection = this.requestedMovingDirection;
        }
      }
    }

    if (
      this.tileMap.didCollideWithEnvironment(
        this.x,
        this.y,
        this.movingDirection
      )
    ) {
      return;
    }

    switch (this.movingDirection) {
      case MovingDirection.up:
        this.y -= this.velocity;
        break;
      case MovingDirection.down:
        this.y += this.velocity;
        break;
      case MovingDirection.left:
        this.x -= this.velocity;
        break;
      case MovingDirection.right:
        this.x += this.velocity;
        break;
    }

    // Wormhole handling
    if (this.x < 0) {
      // Walked off the left edge — wrap to right side
      this.x += this.tileMap.map[0].length * this.tileSize;
    } else {
      const col = Math.floor(this.x / this.tileSize);
      const row = Math.floor(this.y / this.tileSize);
      if (this.tileMap.map[row]?.[col] === 2 &&
          col === this.tileMap.map[0].length - 1 &&
          this.movingDirection === MovingDirection.right) {
        this.x = 0;
      }
    }
  }

  // ========== RENDERING (unchanged) ==========

  #setImage(ctx, pacman) {
    if (pacman.powerDotActive) {
      this.#setImageWhenPowerDotIsActive(pacman);
    } else {
      this.image = this.normalGhost;
    }

    if (this.fadingIn) {
      this.respawnAlpha += 0.05;
      if (this.respawnAlpha >= 1) {
        this.respawnAlpha = 1;
        this.fadingIn = false;
      }
      ctx.globalAlpha = this.respawnAlpha;
    }

    // Pulsing white glow around the player-controlled ghost
    if (this.isPlayerControlled) {
      const pulse = 10 + 8 * Math.sin(Date.now() / 200);
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
      ctx.shadowBlur = pulse;
    }

    ctx.drawImage(this.image, this.x, this.y, this.tileSize, this.tileSize);

    // Reset canvas effects
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  #setImageWhenPowerDotIsActive(pacman) {
    if (pacman.powerDotAboutToExpire) {
      this.scaredAboutToExpireTimer--;
      if (this.scaredAboutToExpireTimer === 0) {
        this.scaredAboutToExpireTimer = this.scaredAboutToExpireTimerDefault;
        this.image = this.image === this.scaredGhost ? this.scaredGhost2 : this.scaredGhost;
      }
    } else {
      this.image = this.scaredGhost;
    }
  }

  // ========== AI MOVEMENT (non-Pinky ghosts, unchanged) ==========

  #changeDirection(pacman) {
    if (!Number.isInteger(this.x / this.tileSize) || !Number.isInteger(this.y / this.tileSize)) return;

    let directions = [
      { dir: MovingDirection.up, dx: 0, dy: -1 },
      { dir: MovingDirection.down, dx: 0, dy: 1 },
      { dir: MovingDirection.left, dx: -1, dy: 0 },
      { dir: MovingDirection.right, dx: 1, dy: 0 },
    ];

    const oppositeDirections = {
      [MovingDirection.up]: MovingDirection.down,
      [MovingDirection.down]: MovingDirection.up,
      [MovingDirection.left]: MovingDirection.right,
      [MovingDirection.right]: MovingDirection.left
    };

    let validMoves = directions.filter(d => 
        d.dir !== oppositeDirections[this.movingDirection] && 
        !this.tileMap.didCollideWithEnvironment(this.x, this.y, d.dir)
    );

    if (validMoves.length === 0) {
        validMoves = directions.filter(d => !this.tileMap.didCollideWithEnvironment(this.x, this.y, d.dir));
    }

    const maxRows = this.tileMap.map.length;
    const maxCols = this.tileMap.map[0].length;
    
    let targetRow = Math.floor(pacman.y / this.tileSize);
    let targetCol = Math.floor(pacman.x / this.tileSize);

    if (pacman.powerDotActive) {
        if (this.color === "blinky") { targetRow = 0; targetCol = maxCols - 1; }
        else if (this.color === "inky") { targetRow = maxRows - 1; targetCol = maxCols - 1; }
        else { targetRow = maxRows - 1; targetCol = 0; } 
    } else {
        if (this.color === "clyde") {
            const d = Math.abs(targetRow - Math.floor(this.y/this.tileSize)) + Math.abs(targetCol - Math.floor(this.x/this.tileSize));
            if (d < 8) {
                targetRow = maxRows - 1; targetCol = 0;
            }
        }
    }

    const currentRow = Math.floor(this.y / this.tileSize);
    const currentCol = Math.floor(this.x / this.tileSize);

    validMoves.sort((a, b) => {
      const nextColA = currentCol + a.dx;
      const nextRowA = currentRow + a.dy;
      const nextColB = currentCol + b.dx;
      const nextRowB = currentRow + b.dy;

      let dxA = Math.abs(nextColA - targetCol);
      dxA = Math.min(dxA, maxCols - dxA); 
      let dyA = Math.abs(nextRowA - targetRow);
      const distA = dxA + dyA;

      let dxB = Math.abs(nextColB - targetCol);
      dxB = Math.min(dxB, maxCols - dxB); 
      let dyB = Math.abs(nextRowB - targetRow);
      const distB = dxB + dyB;

      return distA - distB;
    });

    if (validMoves.length > 0) {
        this.movingDirection = validMoves[0].dir;
    }
  }

  #move() {
    if (!this.tileMap.didCollideWithEnvironment(this.x, this.y, this.movingDirection)) {
      switch (this.movingDirection) {
        case MovingDirection.up:
          this.y -= this.velocity;
          break;
        case MovingDirection.down:
          this.y += this.velocity;
          break;
        case MovingDirection.left:
          this.x -= this.velocity;
          break;
        case MovingDirection.right:
          this.x += this.velocity;
          break;
      }
      // Wormhole handling
      if (this.x < 0) {
        // Walked off the left edge — wrap to right side
        this.x += this.tileMap.map[0].length * this.tileSize;
      } else {
        const col = Math.floor(this.x / this.tileSize);
        const row = Math.floor(this.y / this.tileSize);
        if (this.tileMap.map[row]?.[col] === 2 &&
            col === this.tileMap.map[0].length - 1 &&
            this.movingDirection === MovingDirection.right) {
          this.x = 0;
        }
      }
    }
  }

  #random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  #loadImages() {
    this.normalGhost = new Image();
    switch (this.color) {
      case "pinky":
        this.normalGhost.src = "images/pinky.png";
        break;
      case "inky":
        this.normalGhost.src = "images/inky.png";
        break;
      case "clyde":
        this.normalGhost.src = "images/clyde.png";
        break;
      case "blinky":
        this.normalGhost.src = "images/blinky.png";
        break;
      default:
        this.normalGhost.src = "images/pinky.png";
    }

    this.scaredGhost = new Image();
    this.scaredGhost.src = "images/scaredGhost.png";

    this.scaredGhost2 = new Image();
    this.scaredGhost2.src = "images/scaredGhost2.png";

    this.image = this.normalGhost;
  }
}      
// Dynamic active ghost switching logic
