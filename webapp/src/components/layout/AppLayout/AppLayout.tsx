'use client'

import { usePathname } from 'next/navigation'
import { GlobalHeader } from '../GlobalHeader'
import { NavigationBar } from '../NavigationBar'
import { Footer } from '../Footer'
import styles from './AppLayout.module.css'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return <main className={styles.main}>{children}</main>
  }

  return (
    <div className={styles.layout}>
      <GlobalHeader />
      <NavigationBar />
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  )
}
