/**
 * Audio utilities for beep and sound effects
 */

let audioCtx: any = null

const getAudioContext = () => {
  if (audioCtx) return audioCtx
  try {
    const AudioCtx: any = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return null
    audioCtx = new AudioCtx()
    // Resume audio context on user interaction
    if (audioCtx.state === 'suspended') {
      document.addEventListener('click', () => audioCtx?.resume())
      document.addEventListener('touchend', () => audioCtx?.resume())
    }
    return audioCtx
  } catch {
    return null
  }
}

export const playBeep = (frequency: number = 880, duration: number = 120, volume: number = 0.04) => {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.value = volume
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start()
    osc.stop(ctx.currentTime + duration / 1000)
  } catch {}
}

export const playSuccessBeep = () => {
  playBeep(880, 100, 0.04)
  setTimeout(() => {
    playBeep(1046, 100, 0.04)
  }, 120)
}

export const playErrorBeep = () => {
  playBeep(440, 200, 0.04)
}
