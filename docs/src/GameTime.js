// src/GameTime.js
export default class GameTime {
  constructor() {
    this.baseTime = Date.now();
    this.totalPausedDuration = 0;
    this.pausedAt = null;
  }

  get now() {
    if (this.pausedAt !== null) {
      return this.pausedAt - this.baseTime - this.totalPausedDuration;
    }
    return Date.now() - this.baseTime - this.totalPausedDuration;
  }

  pause() {
    if (this.pausedAt === null) {
      this.pausedAt = Date.now();
    }
  }

  resume() {
    if (this.pausedAt !== null) {
      this.totalPausedDuration += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  isPaused() {
    return this.pausedAt !== null;
  }
}

       