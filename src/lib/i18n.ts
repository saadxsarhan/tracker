// Lightweight i18n. EN keys are the canonical source; AR translations cover top user-facing strings.
// Substitute next-intl in Phase 2 if desired.

export type Locale = 'en' | 'ar';

const dict: Record<string, { en: string; ar: string }> = {
  'app.name': { en: 'Remat D&A KPI Tracker', ar: 'متعقب مؤشرات الأداء — رمات' },
  'nav.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'nav.scorecard': { en: 'Scorecard', ar: 'بطاقة الأداء' },
  'nav.portfolio': { en: 'Dashboard Portfolio', ar: 'محفظة لوحات المعلومات' },
  'nav.opsTracker': { en: 'Ops SLA Tracker', ar: 'متابعة اتفاقية مستوى الخدمة' },
  'nav.deliveryTracker': { en: 'Delivery Tracker', ar: 'متابعة التسليم' },
  'nav.reports': { en: 'Reports', ar: 'التقارير' },
  'nav.admin': { en: 'Admin', ar: 'الإدارة' },
  'nav.tiers': { en: 'SLA Tiers', ar: 'مستويات اتفاقية الخدمة' },
  'nav.lookups': { en: 'Lookups', ar: 'القوائم المرجعية' },
  'nav.users': { en: 'Users', ar: 'المستخدمون' },
  'nav.audit': { en: 'Audit Log', ar: 'سجل التدقيق' },
  'auth.login': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'auth.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'auth.password': { en: 'Password', ar: 'كلمة المرور' },
  'auth.signOut': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'rag.green': { en: 'Green', ar: 'أخضر' },
  'rag.amber': { en: 'Amber', ar: 'أصفر' },
  'rag.red': { en: 'Red', ar: 'أحمر' },
  'common.target': { en: 'Target', ar: 'الهدف' },
  'common.actual': { en: 'Actual', ar: 'الفعلي' },
  'common.score': { en: 'Score', ar: 'النتيجة' },
  'common.weight': { en: 'Weight', ar: 'الوزن' },
  'common.period': { en: 'Period', ar: 'الفترة' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.export': { en: 'Export', ar: 'تصدير' },
  'common.search': { en: 'Search', ar: 'بحث' }
};

export function t(key: string, locale: Locale = 'en'): string {
  return dict[key]?.[locale] ?? key;
}
