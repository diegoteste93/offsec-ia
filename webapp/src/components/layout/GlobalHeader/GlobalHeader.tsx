'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ProjectSelector } from './ProjectSelector'
import styles from './GlobalHeader.module.css'

interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
}

export function GlobalHeader() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAuthUser(data))
      .catch(() => setAuthUser(null))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Image src="/logo.png" alt="RedAmon" width={28} height={28} className={styles.logoImg} />
        <span className={styles.logoText}>
          <span className={styles.logoAccent}>Red</span>Amon
        </span>
        <span className={styles.version}>v1.2.0</span>
      </div>

      <div className={styles.spacer} />

      <div className={styles.actions}>
        <ProjectSelector />

        <div className={styles.divider} />

        <ThemeToggle />

        <div className={styles.divider} />

        <button className={styles.userButton} onClick={handleLogout} title="Logout">
          <div className={styles.avatar}>
            <span>{authUser?.name?.slice(0, 2).toUpperCase() || 'RA'}</span>
          </div>
          <span className={styles.userName}>{authUser?.name || 'Admin'}</span>
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  )
}
