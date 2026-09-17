import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | SwiftRBX',
  description:
    'سياسة الخصوصية لمتجر SwiftRBX — كيف نجمع بياناتك ونحميها. Privacy Policy for the SwiftRBX store.',
}

const sections: LegalSection[] = [
  {
    en: {
      title: 'Information We Collect',
      body: 'We collect information provided via Google OAuth and Discord, including your email address and username. Your Roblox username is recorded only for order history and statistical purposes.',
    },
    ar: {
      title: 'المعلومات التي نجمعها',
      body: 'نجمع المعلومات المقدمة عبر تسجيل الدخول من Google وDiscord، مثل بريدك الإلكتروني واسم المستخدم. ويُسجَّل اسم مستخدم روبلوكس الخاص بك لأغراض سجل الطلبات والإحصاءات فقط.',
    },
  },
  {
    en: {
      title: 'Data Security',
      body: 'We implement industry-standard security measures to protect your information from unauthorized access, alteration, or disclosure.',
    },
    ar: {
      title: 'أمان البيانات',
      body: 'نطبّق معايير أمان صناعية لحماية بياناتك من الوصول أو التعديل أو الإفشاء غير المصرّح به.',
    },
  },
  {
    en: {
      title: 'User Rights',
      body: 'You have the right to access, correct, or delete your personal data at any time by contacting us.',
    },
    ar: {
      title: 'حقوق المستخدم',
      body: 'لديك الحق في الوصول إلى بياناتك أو تصحيحها أو حذفها في أي وقت عبر التواصل معنا.',
    },
  },
  {
    en: {
      title: 'Contact Us',
      body: 'For questions, email support@swiftrbx.site or open a ticket on the site.',
    },
    ar: {
      title: 'اتصل بنا',
      body: 'لأي استفسار، تواصل عبر البريد support@swiftrbx.site أو افتح تذكرة في الموقع.',
    },
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      badge="Privacy Policy"
      titleEn="Privacy Policy for"
      titleAr="سياسة الخصوصية لمتجر"
      introEn="We at SwiftRBX are committed to protecting your privacy and the security of your data. This policy explains the information we collect and how we use it."
      introAr="نحن في SwiftRBX نلتزم بحماية خصوصيتك وأمان بياناتك. تشرح هذه السياسة المعلومات التي نجمعها وكيف نستخدمها."
      sections={sections}
    />
  )
}
