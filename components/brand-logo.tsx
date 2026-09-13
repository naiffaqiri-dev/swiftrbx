import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function BrandLogo({
  className,
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <Link href="/" className={cn('flex items-center gap-3', className)}>
      <span className="relative block size-10 overflow-hidden rounded-xl ring-1 ring-primary/40 shadow-[0_0_20px_-4px_var(--primary)]">
        <Image
          src="/images/swiftrbx-logo.jpg"
          alt="شعار SwiftRBX"
          fill
          className="object-cover"
          sizes="40px"
          priority
        />
      </span>
      {showText && (
        <span className="text-xl font-extrabold tracking-tight">
          Swift<span className="text-primary">RBX</span>
        </span>
      )}
    </Link>
  )
}
