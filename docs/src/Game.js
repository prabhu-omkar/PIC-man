
import TileMap from "./TileMap.js";
import GameTime from "./GameTime.js";
import MovingDirection from "./MovingDirection.js";

const tileSize = 42;
const velocity = 2;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileMap = new TileMap(tileSize);
const pacman = tileMap.getPacman(velocity);
const enemies = tileMap.getEnemies(0.75 * velocity);

const gameTime = new GameTime();

const pacmanStart = { x: pacman.x, y: pacman.y };
const enemySpawns = enemies.map(enemy => ({ x: enemy.x, y: enemy.y }));

let pauseUntil = 0;
let waitingToRespawn = false;
let paused = false;

let gameOver = false;
let gameWin = false;

window.score = 0;

let playerMadeFirstMove = false;
let playerGhostWasAlive = true;

// Ghost cycling: pinky → inky → clyde → pinky
const ghostOrder = ["pinky", "inky", "clyde"];
let controlledIndex = 0;
let controlledGhostColor = ghostOrder[0];

function initPlayerGhost(ghost) {
  ghost.isPlayerControlled = true;
  ghost.velocity = velocity;
  ghost.movingDirection = null;
  ghost.requestedMovingDirection = null;
}

function updateCurrentGhostHUD() {
  const nameDisplay = document.getElementById("currentGhostName");
  const iconDisplay = document.getElementById("currentGhostIcon");
  if (nameDisplay && iconDisplay) {
    nameDisplay.textContent = controlledGhostColor.toUpperCase();
    iconDisplay.src = `images/${controlledGhostColor}.png`;

    let transformStr = "";
    if (controlledGhostColor === "clyde") {
      transformStr += "translateY(2px) ";
    }
    if (controlledGhostColor === "pinky") {
      transformStr += "translateX(1px) ";
    }
    iconDisplay.style.transform = transformStr.trim() || "translate(0px, 0px)";
  }
}

// Set initial player ghost (Pinky)
const pinkyInit = enemies.find(e => e.color === controlledGhostColor);
if (pinkyInit) initPlayerGhost(pinkyInit);
updateCurrentGhostHUD();

const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");

const gameOverSound = new Audio("sounds/gameOver.wav");
gameOverSound.volume = 0.8;
if (window.isMuted) gameOverSound.muted = true;

const gameWinSound = new Audio("sounds/gameWin.wav");
gameWinSound.volume = 0.8;
if (window.isMuted) gameWinSound.muted = true;

const readySound = new Audio("sounds/ready.wav");
if (window.isMuted) readySound.muted = true;

window.addEventListener("muteToggled", () => {
  gameOverSound.muted = window.isMuted;
  gameWinSound.muted = window.isMuted;
  readySound.muted = window.isMuted;
});

function stopBgMusic() {
  const music = document.getElementById("bgMusic");
  if (music) {
    music.pause();
    music.currentTime = 0;
  }
  if (pacman.powerDotSound) {
    pacman.powerDotSound.pause();
    pacman.powerDotSound.currentTime = 0;
  }
}


function gameLoop() {
  if (!window.gameStarted) {
    tileMap.draw(ctx);
    pacman.draw(ctx, () => true, enemies, gameTime);
    enemies.forEach(enemy => enemy.draw(ctx, () => true, pacman));
    return;
  }

  if (paused) return;

  // Sync pacman.madeFirstMove with player state
  if (playerMadeFirstMove) {
    pacman.madeFirstMove = true;
  }

  tileMap.draw(ctx);
  pacman.draw(ctx, pause, enemies, gameTime);

  enemies.forEach(enemy => enemy.draw(ctx, pause, pacman));
  drawGameEnd();

  checkGameWin();
  checkGameOver();
  checkPlayerGhostEaten();
  updateHUD();
}

function updateHUD(flash = false) {
  const currentScore = tileMap.dotsLeft() * 10;
  scoreDisplay.textContent = `Score: ${currentScore}`;

  const killsDisplay = document.getElementById("ghostKills");
  if (killsDisplay && pacman) {
    killsDisplay.textContent = `Kills: ${pacman.ghostKills}`;
  }

  livesDisplay.innerHTML = "";
}

// REVERSED: Player WINS when any ghost catches Pac-Man (non-frightened)
function checkGameWin() {
  if (!gameWin && !gameOver) {
    const caught = enemies.some(enemy => !pacman.powerDotActive && enemy.collideWith(pacman));
    if (caught) {
      gameWin = true;
      stopBgMusic();
      updateHUD();
      if (!window.isMuted) gameWinSound.play();
    }
  }
}

// REVERSED: Player LOSES when Pac-Man eats all dots
function checkGameOver() {
  if (!gameOver && !gameWin) {
    if (tileMap.didWin()) {
      gameOver = true;
      stopBgMusic();
      if (!window.isMuted) gameOverSound.play();
    }
  }
}

// Detect when player's ghost is eaten by powered-up Pac-Man
function checkPlayerGhostEaten() {
  if (gameOver || gameWin) return;

  const controlled = enemies.find(e => e.color === controlledGhostColor);

  if (!controlled && playerGhostWasAlive) {
    // Player ghost was eaten! (respawn is handled by Pacman.js automatically)
    playerGhostWasAlive = false;
  } else if (controlled && !playerGhostWasAlive) {
    // Player ghost respawned — restore control
    playerGhostWasAlive = true;
    controlled.isPlayerControlled = true;
    // Snap to grid to prevent getting stuck if AI moved us fractionally this frame
    controlled.x = Math.round(controlled.x / tileSize) * tileSize;
    controlled.y = Math.round(controlled.y / tileSize) * tileSize;
    controlled.velocity = velocity;
    controlled.requestedMovingDirection = null;
    controlled.movingDirection = null;
  }
}

function pause() {
  return !playerMadeFirstMove || gameOver || gameWin || gameTime.now < pauseUntil;
}

function drawGameEnd() {
  const overlay = document.getElementById("gameEndOverlay");
  if ((gameOver || gameWin) && gameTime.now >= pauseUntil) {
    overlay.querySelector("h2").textContent = gameWin ? "You Win!" : "Game Over";

    const endScore = document.getElementById("endScore");
    const endKills = document.getElementById("endKills");
    if (endScore) endScore.textContent = `Score: ${tileMap.dotsLeft() * 10}`;
    if (endKills && pacman) endKills.textContent = `Kills: ${pacman.ghostKills}`;

    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
}

tileMap.setCanvasSize(canvas);
setInterval(gameLoop, 1000 / 70);

// Player controls the active ghost with Arrow Keys, WASD, and Shift to cycle
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") {
    paused = !paused;
    const pauseMessage = document.getElementById("pauseMessage");

    if (paused) {
      gameTime.pause();
      pauseMessage.style.display = "block";

    } else {
      gameTime.resume();
      pauseMessage.style.display = "none";
    }
  }

  // Shift: cycle through ghosts (pinky → inky → clyde → pinky)
  if (event.key === "Shift") {
    const current = enemies.find(e => e.color === controlledGhostColor);
    if (current) {
      current.isPlayerControlled = false;
      // Snap to nearest tile so AI velocity aligns to the grid
      current.x = Math.round(current.x / tileSize) * tileSize;
      current.y = Math.round(current.y / tileSize) * tileSize;
      current.velocity = 0.75 * velocity; // restore AI speed
    }

    controlledIndex = (controlledIndex + 1) % ghostOrder.length;
    controlledGhostColor = ghostOrder[controlledIndex];
    updateCurrentGhostHUD();

    const next = enemies.find(e => e.color === controlledGhostColor);
    if (next) {
      // Snap to nearest tile so player velocity aligns to the grid
      next.x = Math.round(next.x / tileSize) * tileSize;
      next.y = Math.round(next.y / tileSize) * tileSize;
      next.isPlayerControlled = true;
      next.velocity = pacman.powerDotActive ? (0.75 * velocity) : velocity;
      next.requestedMovingDirection = next.movingDirection;
      next.madeFirstMove = playerMadeFirstMove;
    }
    playerGhostWasAlive = !!next;
    return;
  }

  // Movement controls for the active ghost
  const ghost = enemies.find(e => e.isPlayerControlled);
  if (!ghost) return;

  let dir = null;
  switch (event.key) {
    case "ArrowUp": case "w": case "W": dir = MovingDirection.up; break;
    case "ArrowDown": case "s": case "S": dir = MovingDirection.down; break;
    case "ArrowLeft": case "a": case "A": dir = MovingDirection.left; break;
    case "ArrowRight": case "d": case "D": dir = MovingDirection.right; break;
  }

  if (dir !== null) {
    ghost.requestedMovingDirection = dir;
    ghost.madeFirstMove = true;
    playerMadeFirstMove = true;
  }
});
     
// Win/lose state evaluation
