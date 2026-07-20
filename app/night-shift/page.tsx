import type { Metadata } from 'next'
import NightShift from './NightShift'

export const metadata: Metadata = {
  title: 'NIGHT SHIFT — Data Center Operator Sim',
  description:
    'You are the last human night-shift operator in a Tier III data center. Ack alarms, verify work orders, and keep the racks alive until 06:00.',
  robots: { index: false },
}

export default function NightShiftPage() {
  return <NightShift />
}
