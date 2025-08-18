
// ChatGPT で生成した、適当な通知音
export const playSound = () => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const now = audioCtx.currentTime;

  const playNote = (
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "triangle",
    volume: number = 0.1
  ) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const freqs = [329.63, 440, 659.25];

  // ベース音（最も低い音）を先に
  playNote(freqs[0], now, 0.25, "triangle", 0.12);

  // 中音・高音は少し遅れて重ねる（ステレオ感UP）
  playNote(freqs[1], now + 0.05, 0.22, "triangle", 0.1);
  playNote(freqs[2], now + 0.08, 0.20, "triangle", 0.08);
};
