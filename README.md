# 👻 P.I.C. MAN — Reverse Pac-Man!

*What if the prey bites back?* Welcome to **Pic-Man** (**P**inky, **I**nky, and **C**lyde **Man**!). The tables have turned: you control the ghosts, and an AI-driven Pac-Man is out to eat everything—including you!

**[🎮 Play the Game Live Here!](prabhu-omkar.github.io/PIC-man/)**

---

## 🕹️ How to Play

- **Arrow Keys / WASD** or **On-Screen D-Pad** — Move your ghost (mobile friendly!).
- **Shift** or **SWITCH Button** — Cycle between Pinky, Inky, or Clyde.
- **P** / **M** — Pause / Mute.

**Win/Lose Conditions:**
- **WIN:** Touch Pac-Man before he eats all the dots.
- **LOSE:** Pac-Man clears the board.
- **SURVIVAL MODE:** If Pac-Man eats a power pellet, *run*. Eaten ghosts respawn when the power fades. During this mode, ghosts suffer a **75% speed penalty**!

---

## 🧠 The AI Algorithms

Pac-Man uses real pathfinding to hunt and evade:
- **BFS (Breadth-First Search):** Calculates the shortest path to his next meal.
- **Danger Mapping (Evasion):** When a ghost nears, a BFS "Danger Map" evaluates nearby tiles up to an 8-tile lookahead to maximize distance and avoid dead-ends.
- **Torus Math:** Distance calculations handle map wrap-arounds, so Pac-Man knows exactly when portaling through walls is the fastest escape.

---

## 🧗 Development Challenges

Making the AI "smart but fair" was tricky:
1. **The Portal Glitch:** Pac-Man skipped blocks passing left-to-right through portals. Fixing grid alignment and coordinate math was a nightmare!
2. **Ghost Switching:** Seamlessly trading AI control for Player control (and pausing inactive ghosts) took careful state management.
3. **Corner Traps:** Early AI would trap itself in corners out of fear. Adding "lookahead depth" logic gave it the ability to juke safely.
4. **Balancing:** Giving Pac-Man 3 lives vs. infinite lives for the player, plus the 75% speed penalty for frightened ghosts, finally made the chase balanced.

---

## 🚀 Run Locally

This game uses ES modules, requiring a local server.

**Option 1: Node.js (Auto-reloads)**
```bash
cd docs
npx live-server
```

**Option 2: Python**
```bash
cd docs
python -m http.server 8080
```
Then visit `http://localhost:8080`.
