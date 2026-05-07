'use client';
import { useRouter } from 'next/navigation';

export function PeriodPicker({ value, basePath }: { value: string; basePath: string }) {
  const router = useRouter();
  // value is YYYY-MM
  return (
    <input
      type="month"
      value={value}
      className="input w-40 text-sm"
      onChange={e => router.push(`${basePath}?period=${e.target.value}`)}
    />
  );
}
