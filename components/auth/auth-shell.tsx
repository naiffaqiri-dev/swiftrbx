import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Visual side */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/swiftrbx-banner.jpg"
          alt="SwiftRBX"
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-md text-balance text-lg font-medium text-foreground/90">
            متجرك الأمثل لشراء الروبكس — تسليم فوري، أسعار منافسة، ودعم مباشر على
            مدار الساعة.
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex items-center justify-between">
            <BrandLogo />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">الرئيسية</Link>
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-balance">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              {subtitle}
            </p>
          </div>

          {children}

          <div className="text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
