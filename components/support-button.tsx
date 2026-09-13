'use client'

import { Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SupportButton() {
  return (
    <Button
      onClick={() => alert('نافذة الدعم المباشر ستفتح تذكرة في الديسكورد (قريباً)')}
      className="fixed bottom-6 left-6 z-50 gap-2 rounded-full shadow-[0_0_28px_-6px_var(--primary)]"
    >
      <Headphones className="size-4" />
      الدعم المباشر
    </Button>
  )
}
