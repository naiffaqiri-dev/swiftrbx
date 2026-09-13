import { createClient } from '@supabase/supabase-js'

// عميل بصلاحية الخدمة — للاستخدام في الخادم فقط (Route Handlers).
// يُنشئ حسابات مؤكّدة البريد مباشرة حتى يسجّل المستخدم دخوله فوراً بلا رسالة تحقق.
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('إعدادات Supabase الخادمية غير مكتملة')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
