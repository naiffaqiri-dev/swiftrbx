// Shared password/username rules for SwiftRBX (client + server).

// اسم المستخدم: أحرف إنجليزية وأرقام و _ ، من 2 إلى 16 خانة
export const USERNAME_RE = /^[A-Za-z0-9_]{2,16}$/

const PASSWORD_LETTER = /[A-Za-z]/
const PASSWORD_DIGIT = /[0-9]/
const PASSWORD_SYMBOL = /[^A-Za-z0-9]/

// كلمة المرور: حروف وأرقام + علامة واحدة على الأقل
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 خانات'
  if (!PASSWORD_LETTER.test(password)) return 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل'
  if (!PASSWORD_DIGIT.test(password)) return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل'
  if (!PASSWORD_SYMBOL.test(password))
    return 'كلمة المرور يجب أن تحتوي على علامة واحدة على الأقل (مثل @ # ! _)'
  return null
}
