import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Web3bridge Assessment',
  description: 'Technical assessment portal for incoming Web3bridge developers.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0A0A0F] text-white min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-12 overflow-y-auto custom-scrollbar`}>
        {/* Ambient Background Glows */}
        <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        <main className="w-full max-w-4xl relative z-10 flex flex-col">
          {children}
        </main>

        <Toaster theme="dark" position="bottom-right" toastOptions={{
          style: { background: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)' }
        }}/>
      </body>
    </html>
  )
}
