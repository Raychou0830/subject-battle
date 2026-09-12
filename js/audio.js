(() => {
  class GameAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    async unlock() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    setEnabled(enabled) { this.enabled = !!enabled; }

    tone(freq, duration = .12, type = 'sine', gain = .05, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      amp.gain.setValueAtTime(.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + .012);
      amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
      osc.connect(amp).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration + .03);
    }

    success() {
      this.tone(660,.13,'sine',.05,0);
      this.tone(880,.16,'sine',.05,.09);
      this.tone(1175,.22,'triangle',.04,.18);
    }

    wrong() {
      this.tone(210,.16,'sawtooth',.035,0);
      this.tone(155,.22,'sawtooth',.03,.12);
    }

    laser() {
      this.tone(920,.08,'square',.022,0);
      this.tone(540,.18,'sawtooth',.025,.05);
    }

    hit() {
      this.tone(95,.16,'square',.035,0);
      this.tone(70,.22,'triangle',.03,.06);
    }

    victory() {
      [523,659,784,1047].forEach((f,i)=>this.tone(f,.22,'triangle',.05,i*.12));
    }
  }

  window.ElementBattleAudio = new GameAudio();
})();
