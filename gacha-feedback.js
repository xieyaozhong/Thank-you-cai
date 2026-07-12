(() => {
  "use strict";

  const machine = document.querySelector("#gacha-machine");
  const knob = document.querySelector("#draw-button");
  const action = document.querySelector("#draw-action");
  const screen = document.querySelector("#gacha-screen");
  const screenArt = document.querySelector("#gacha-screen-art");
  const status = document.querySelector("#gacha-status");
  const hint = document.querySelector("#gacha-hint");
  const pointsBoard = document.querySelector(".point-board");

  if (!machine || !knob || !action || !screen || !status || !hint) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const SOUND_KEY = "thank-you-cai-gacha-sound-v1";
  const PHASE_ORDER = ["turning", "shaking", "waiting", "dropping", "revealing"];
  const PHASE_LABELS = {
    idle: "待機",
    turning: "轉動",
    shaking: "混合",
    waiting: "鎖定",
    dropping: "掉落",
    revealing: "開卡",
  };

  function readSoundPreference() {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  }

  function saveSoundPreference(enabled) {
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    } catch {
      // 部分隱私模式會阻擋 localStorage；音效仍可在本次頁面切換。
    }
  }

  let soundEnabled = readSoundPreference();
  let audioContext = null;
  let lastPhase = machine.dataset.phase || "idle";
  let revealToken = 0;
  let phaseToneTimer = 0;

  const feedbackLayer = document.createElement("div");
  feedbackLayer.className = "gacha-feedback-layer";
  feedbackLayer.setAttribute("aria-hidden", "true");
  feedbackLayer.innerHTML = `
    <span class="gacha-impact-ring"></span>
    <span class="gacha-reveal-burst"></span>
    <span class="gacha-feedback-spark gacha-feedback-spark--1">✦</span>
    <span class="gacha-feedback-spark gacha-feedback-spark--2">✦</span>
    <span class="gacha-feedback-spark gacha-feedback-spark--3">✦</span>
  `;
  machine.append(feedbackLayer);

  const particleLayer = document.createElement("div");
  particleLayer.className = "gacha-particle-layer";
  particleLayer.setAttribute("aria-hidden", "true");
  machine.append(particleLayer);

  const lamps = document.createElement("div");
  lamps.className = "gacha-stage-lamps";
  lamps.setAttribute("aria-hidden", "true");
  lamps.innerHTML = PHASE_ORDER.map((phase, index) => `<span data-stage="${phase}"><i>${index + 1}</i></span>`).join("");
  machine.prepend(lamps);

  const controls = document.createElement("div");
  controls.className = "gacha-feedback-controls";
  controls.innerHTML = `
    <button type="button" class="gacha-sound-toggle" aria-pressed="${soundEnabled}">
      <span aria-hidden="true">${soundEnabled ? "♪" : "×"}</span>
      <span>${soundEnabled ? "音效開啟" : "音效關閉"}</span>
    </button>
    <span class="gacha-feedback-caption">按下旋鈕，感受每個抽卡階段</span>
  `;
  machine.append(controls);

  const soundToggle = controls.querySelector(".gacha-sound-toggle");

  function ensureAudio() {
    if (!soundEnabled) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function tone({ frequency = 440, duration = 0.08, type = "square", volume = 0.035, slideTo = null, delay = 0 }) {
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noiseBurst(duration = 0.08, volume = 0.025, delay = 0) {
    const context = ensureAudio();
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(context.currentTime + delay);
  }

  function playPress() {
    tone({ frequency: 180, slideTo: 125, duration: 0.075, type: "square", volume: 0.025 });
  }

  function playPhase(phase) {
    window.clearTimeout(phaseToneTimer);
    if (!soundEnabled) return;
    switch (phase) {
      case "turning":
        tone({ frequency: 220, slideTo: 640, duration: 0.2, type: "sawtooth", volume: 0.025 });
        tone({ frequency: 330, duration: 0.045, delay: 0.18, volume: 0.02 });
        break;
      case "shaking":
        [0, 0.09, 0.18, 0.27].forEach((delay, index) => {
          tone({ frequency: index % 2 ? 165 : 205, duration: 0.045, delay, type: "square", volume: 0.02 });
        });
        noiseBurst(0.18, 0.018, 0.04);
        break;
      case "waiting":
        tone({ frequency: 300, slideTo: 760, duration: 0.18, type: "sine", volume: 0.028 });
        break;
      case "dropping":
        tone({ frequency: 115, slideTo: 72, duration: 0.16, type: "triangle", volume: 0.05 });
        noiseBurst(0.07, 0.035);
        break;
      case "revealing":
        tone({ frequency: 520, duration: 0.08, type: "square", volume: 0.025 });
        tone({ frequency: 660, duration: 0.11, delay: 0.08, type: "square", volume: 0.025 });
        break;
      default:
        break;
    }
  }

  function playReveal(grade) {
    const notes = grade === "S" ? [523.25, 659.25, 783.99, 1046.5]
      : grade === "A" ? [440, 554.37, 659.25]
      : grade === "B" ? [392, 493.88, 587.33]
      : [329.63, 392, 493.88];
    notes.forEach((frequency, index) => tone({
      frequency,
      duration: grade === "S" ? 0.22 : 0.16,
      delay: index * 0.07,
      type: grade === "S" ? "sine" : "square",
      volume: grade === "S" ? 0.045 : 0.032,
    }));
  }

  function vibrate(pattern) {
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  }

  function updateStageLamps(phase) {
    const currentIndex = PHASE_ORDER.indexOf(phase);
    lamps.querySelectorAll("[data-stage]").forEach((lamp, index) => {
      lamp.classList.toggle("is-current", index === currentIndex);
      lamp.classList.toggle("is-done", currentIndex >= 0 && index < currentIndex);
    });
    machine.style.setProperty("--gacha-stage", String(Math.max(0, currentIndex + 1)));
    machine.setAttribute("data-stage-label", PHASE_LABELS[phase] || "待機");
  }

  function pulsePoints() {
    if (!pointsBoard) return;
    pointsBoard.classList.remove("is-spending");
    void pointsBoard.offsetWidth;
    pointsBoard.classList.add("is-spending");
  }

  function triggerClass(element, className, duration = 500) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  }

  function createParticles(grade = "C") {
    if (reduceMotion) return;
    particleLayer.replaceChildren();
    const count = grade === "S" ? 34 : grade === "A" ? 25 : grade === "B" ? 18 : 14;
    const palette = grade === "S"
      ? ["#f1bd3d", "#fff7c9", "#f4b7ad", "#b8d46a"]
      : grade === "A"
        ? ["#78a94b", "#b8d46a", "#f1bd3d", "#fff7c9"]
        : grade === "B"
          ? ["#e97e2e", "#f1bd3d", "#f4b7ad"]
          : ["#397247", "#78a94b", "#fff3c9"];

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.4;
      const distance = 75 + Math.random() * (grade === "S" ? 155 : 110);
      const size = 5 + Math.floor(Math.random() * 7);
      particle.className = `gacha-particle gacha-particle--${index % 3}`;
      particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--particle-rotate", `${Math.round(Math.random() * 540 - 270)}deg`);
      particle.style.setProperty("--particle-delay", `${Math.random() * 80}ms`);
      particle.style.setProperty("--particle-size", `${size}px`);
      particle.style.setProperty("--particle-color", palette[index % palette.length]);
      particleLayer.append(particle);
    }
    window.setTimeout(() => particleLayer.replaceChildren(), 1100);
  }

  function revealFeedback(grade) {
    const token = ++revealToken;
    machine.dataset.rarity = grade;
    triggerClass(machine, "is-reward-reveal", grade === "S" ? 1300 : 900);
    triggerClass(screen, "is-reward-reveal", grade === "S" ? 1200 : 850);
    if (screenArt) triggerClass(screenArt, "is-card-pop", 750);
    createParticles(grade);
    playReveal(grade);
    vibrate(grade === "S" ? [45, 30, 70, 30, 110] : grade === "A" ? [35, 30, 70] : [28, 20, 45]);
    window.setTimeout(() => {
      if (token === revealToken) delete machine.dataset.rarity;
    }, grade === "S" ? 1450 : 1000);
  }

  function onPhaseChange(phase) {
    if (phase === lastPhase) return;
    lastPhase = phase;
    updateStageLamps(phase);
    playPhase(phase);

    switch (phase) {
      case "turning":
        pulsePoints();
        triggerClass(machine, "is-starting", 480);
        vibrate([15, 18, 22]);
        break;
      case "shaking":
        vibrate([22, 28, 22, 28, 32]);
        break;
      case "waiting":
        vibrate(18);
        break;
      case "dropping":
        triggerClass(machine, "is-impact", 560);
        vibrate([38, 28, 78]);
        break;
      case "revealing":
        vibrate([20, 18, 35]);
        break;
      case "idle":
        lamps.querySelectorAll("[data-stage]").forEach((lamp) => lamp.classList.remove("is-current", "is-done"));
        break;
      default:
        break;
    }
  }

  function onStatusChange() {
    const text = status.textContent || "";
    const match = text.match(/^([SABC])\s*級/);
    if (match) revealFeedback(match[1]);
  }

  function pressStart(event) {
    if (knob.disabled || machine.getAttribute("aria-busy") === "true") return;
    machine.classList.add("is-pressing");
    knob.classList.add("is-pressing");
    ensureAudio();
    playPress();
    vibrate(10);
    if (event.pointerId != null) knob.setPointerCapture?.(event.pointerId);
  }

  function pressEnd() {
    machine.classList.remove("is-pressing");
    knob.classList.remove("is-pressing");
  }

  function actionPress(event) {
    if (action.disabled || machine.getAttribute("aria-busy") === "true") return;
    ensureAudio();
    triggerClass(action, "is-tapped", 260);
    playPress();
    vibrate(10);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    saveSoundPreference(soundEnabled);
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.innerHTML = `<span aria-hidden="true">${soundEnabled ? "♪" : "×"}</span><span>${soundEnabled ? "音效開啟" : "音效關閉"}</span>`;
    if (soundEnabled) {
      ensureAudio();
      tone({ frequency: 440, duration: 0.08 });
      tone({ frequency: 660, duration: 0.1, delay: 0.07 });
    }
  }

  knob.addEventListener("pointerdown", pressStart, { passive: true });
  knob.addEventListener("pointerup", pressEnd, { passive: true });
  knob.addEventListener("pointercancel", pressEnd, { passive: true });
  knob.addEventListener("lostpointercapture", pressEnd, { passive: true });
  action.addEventListener("pointerdown", actionPress, { passive: true });
  soundToggle.addEventListener("click", toggleSound);

  const phaseObserver = new MutationObserver(() => onPhaseChange(machine.dataset.phase || "idle"));
  phaseObserver.observe(machine, { attributes: true, attributeFilter: ["data-phase"] });

  const statusObserver = new MutationObserver(onStatusChange);
  statusObserver.observe(status, { childList: true, characterData: true, subtree: true });

  updateStageLamps(lastPhase);
  machine.classList.add("gacha-feedback-ready");
})();
