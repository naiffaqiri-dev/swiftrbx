'use client'

import { Button } from '@/components/ui/button'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.43-1.67 4.2-5.5 4.2-3.31 0-6-2.74-6-6.12s2.69-6.12 6-6.12c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.99 3.36 14.74 2.4 12 2.4 6.85 2.4 2.66 6.58 2.66 11.7S6.85 21 12 21c5.5 0 9.14-3.86 9.14-9.3 0-.62-.07-1.1-.16-1.5H12z"
      />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a13.7 13.7 0 0 1 4.34 2.2 13.5 13.5 0 0 0-11.02 0A13.7 13.7 0 0 1 12.82 3.5L12.58 3A19.8 19.8 0 0 0 7.7 4.4C4.6 9 3.77 13.5 4.18 17.9a19.9 19.9 0 0 0 6.04 3.05l.48-.66a13 13 0 0 1-2.06-.98l.5-.38a14.2 14.2 0 0 0 11.72 0l.5.38c-.65.38-1.34.71-2.06.98l.48.66a19.9 19.9 0 0 0 6.05-3.05c.48-5.11-.82-9.57-3.53-13.5ZM9.68 15.2c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.96 2.4-2.15 2.4Zm5.28 0c-1.18 0-2.15-1.08-2.15-2.4s.95-2.41 2.15-2.41 2.17 1.09 2.15 2.41c0 1.32-.95 2.4-2.15 2.4Z" />
    </svg>
  )
}

export function SocialButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => alert('سيتم تفعيل الدخول عبر Google لاحقاً')}
      >
        <GoogleIcon />
        Google
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => alert('سيتم تفعيل الدخول عبر Discord لاحقاً')}
      >
        <DiscordIcon />
        Discord
      </Button>
    </div>
  )
}
