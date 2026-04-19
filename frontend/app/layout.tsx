import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
})

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
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased`}>
        <Navbar />
        <main className="flex-1 bg-background min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
