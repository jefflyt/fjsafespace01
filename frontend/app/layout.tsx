import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { AuthProvider } from '@/components/layout/AuthProvider'

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          <main className="flex-1 bg-background min-h-screen bg-dot-grid">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
