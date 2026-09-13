'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

export function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? 'fill-primary text-primary' : 'text-muted-foreground/40'}
        />
      ))}
    </span>
  )
}

export function StarInput({
  value,
  onChange,
  size = 28,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} نجوم`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= shown ? 'fill-primary text-primary' : 'text-muted-foreground/40'}
          />
        </button>
      ))}
    </div>
  )
}
