"use client"

// نغمة تنبيه خفيفة عبر WebAudio (بدون ملفات صوتية خارجية)
let audioCtx: AudioContext | null = null

export function playChime() {
  if (typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx = audioCtx ?? new Ctx()
    const ctx = audioCtx
    if (ctx.state === "suspended") ctx.resume().catch(() => {})

    const now = ctx.currentTime
    // نغمتان متتاليتان لطيفتان
    const tones = [880, 1174.7]
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const start = now + i * 0.14
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    })
  } catch {
    // تجاهل أي خطأ في الصوت
  }
}

// وميض عنوان التبويب عند وصول رسالة والمستخدم في تبويب آخر
let flashTimer: ReturnType<typeof setInterval> | null = null
let originalTitle = ""

export function flashTitle(message = "رسالة جديدة") {
  if (typeof document === "undefined") return
  if (document.visibilityState === "visible") return
  if (!flashTimer) originalTitle = document.title
  let on = false
  if (flashTimer) clearInterval(flashTimer)
  flashTimer = setInterval(() => {
    document.title = on ? originalTitle : `🔔 ${message}`
    on = !on
  }, 900)

  const restore = () => {
    if (flashTimer) {
      clearInterval(flashTimer)
      flashTimer = null
    }
    if (originalTitle) document.title = originalTitle
    document.removeEventListener("visibilitychange", restore)
  }
  document.addEventListener("visibilitychange", restore)
}
