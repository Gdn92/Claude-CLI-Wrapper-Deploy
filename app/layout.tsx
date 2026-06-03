import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PushSetup } from '@/components/PushSetup'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Claude CLI Wrapper',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 h-screen overflow-hidden`}>
        <PushSetup />
        {children}
      </body>
    </html>
  )
}
