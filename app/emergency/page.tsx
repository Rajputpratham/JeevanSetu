import type { Metadata } from 'next';
import EmergencyClient from '@/components/emergency/EmergencyClient';

export const metadata: Metadata = {
  title: 'Emergency Help — Call 112 Now | Emergency Hospitals Near You',
  description: 'India emergency: call 112 (free, 24×7). Directory of hospitals with verified 24×7 emergency services near you — one-tap call and directions. Always call 112 before anything else in a life-threatening emergency.',
};

export default function EmergencyPage() {
  return <EmergencyClient />;
}
