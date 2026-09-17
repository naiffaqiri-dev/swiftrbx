import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'شروط الخدمة | SwiftRBX',
  description:
    'شروط الخدمة لمتجر SwiftRBX — التسليم والاسترداد وحدود المسؤولية. Terms of Service for the SwiftRBX store.',
}

const sections: LegalSection[] = [
  {
    en: {
      title: 'Agreement',
      body: 'Use of our site constitutes agreement to these terms.',
    },
    ar: {
      title: 'الموافقة',
      body: 'استخدام موقعنا يعتبر موافقة على هذه الشروط.',
    },
  },
  {
    en: {
      title: 'Robux Delivery & Refunds',
      body: 'Refunds are only allowed if a Robux delivery is not completed within 48 hours of order creation. As the Robux is delivered via a game pass created and valued by you, returns for mismatched products are not accepted.',
    },
    ar: {
      title: 'تسليم الروبوكس والاسترداد',
      body: 'لا يُسمح باسترداد الأموال إلا في حالة عدم إتمام تسليم الروبوكس خلال 48 ساعة من إنشاء الطلب. وبما أن التسليم يتم عبر "game pass" تُنشئه أنت وتحدّد قيمته، فلا تُقبل إرجاعات المنتجات غير المطابقة.',
    },
  },
  {
    en: {
      title: 'Limitation of Liability',
      body: 'SwiftRBX is not liable for any account restrictions or bans imposed by Roblox. It is your responsibility to manage your account and comply with Roblox\u2019s terms.',
    },
    ar: {
      title: 'حدود المسؤولية',
      body: 'SwiftRBX غير مسؤولة عن أي قيود أو حظر (Bans) تفرضه روبلوكس على حسابك. تقع عليك مسؤولية إدارة حسابك والالتزام بشروط روبلوكس.',
    },
  },
  {
    en: {
      title: 'Account Security',
      body: 'You are responsible for maintaining the confidentiality of your account credentials.',
    },
    ar: {
      title: 'أمان الحساب',
      body: 'أنت مسؤول عن الحفاظ على سرية بيانات اعتماد حسابك.',
    },
  },
  {
    en: {
      title: 'Termination',
      body: 'We may terminate access for violations. For support, email support@swiftrbx.site or open a site ticket.',
    },
    ar: {
      title: 'الإنهاء',
      body: 'نحتفظ بالحق في إنهاء الوصول عند الانتهاك. للدعم، راسل support@swiftrbx.site أو افتح تذكرة في الموقع.',
    },
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      badge="Terms of Service"
      titleEn="Terms of Service for"
      titleAr="شروط الخدمة لمتجر"
      introEn="By using our site, you agree to comply with these terms."
      introAr="من خلال استخدامك لموقعنا، فإنك توافق على الامتثال لهذه الشروط."
      sections={sections}
    />
  )
}
