import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/components/layout/globals.css' // We'll put global css here or leave default
import { Navbar } from '@/components/layout/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FJDashboard | Analyst Operations',
  description: 'FJ SafeSpace Analyst Operations Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <div className="flex-1 bg-slate-50 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
