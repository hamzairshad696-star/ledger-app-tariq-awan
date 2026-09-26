import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <p className="text-5xl font-semibold text-navy-900">404</p>
        <p className="mt-2 text-slate-600">This page does not exist.</p>
        <Link href="/login" className="mt-4 inline-block link">Go to sign in</Link>
      </div>
    </div>
  );
}
