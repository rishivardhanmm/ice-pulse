import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roadmap — ICE Pulse' };

export default function CanvaPage() {
  redirect('/roadmap');
}
