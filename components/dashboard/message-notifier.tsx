'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/mock-auth'
import { createClient } from '@/lib/supabase/client'
import { playChime, flashTitle } from '@/lib/notify'

// اشتراك عام في رسائل التذاكر (محكوم بسياسات RLS) لتشغيل تنبيه صوتي ومرئي
// عند وصول رسالة جديدة من طرف آخر حتى لو كان المستخدم في تبويب مختلف.
export function MessageNotifier() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel('global-ticket-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string }
          if (msg.sender_id === user.id) return
          playChime()
          flashTitle('رسالة جديدة في تذكرتك')
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return null
}
