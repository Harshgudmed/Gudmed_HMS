import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'

function shade(hex, percent) {
  const h = (hex || '#2E4168').replace('#', '')
  if (h.length !== 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

export default function SplashScreen({ brandColor = '#2E4168', hospitalName = 'GudMed HMS', onDone }) {
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setHiding(true), 1600)
    const t2 = setTimeout(() => onDone?.(), 2050)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${hiding ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: `linear-gradient(160deg, ${shade(brandColor, 18)}, ${shade(brandColor, -32)})` }}
    >
      {/* Floating decorative orbs for depth */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl animate-float" />
      <div className="pointer-events-none absolute bottom-0 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl animate-float" style={{ animationDelay: '1.2s' }} />

      {/* App-icon style logo card */}
      <div className="animate-scale">
        <div className="h-24 w-24 rounded-[28px] bg-white elev-4 flex items-center justify-center">
          <Logo size={62} />
        </div>
      </div>

      <h1 className="animate-rise mt-6 text-2xl font-extrabold tracking-tight text-white" style={{ animationDelay: '.1s' }}>
        {hospitalName}
      </h1>
      <p className="animate-rise mt-1.5 text-sm text-white/70" style={{ animationDelay: '.18s' }}>
        Healthcare, simplified.
      </p>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-white"
            style={{ animation: 'pulseDot 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
