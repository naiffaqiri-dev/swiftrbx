'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'

type HomeRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export function HomeReveal({ children, className, delay = 0 }: HomeRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
