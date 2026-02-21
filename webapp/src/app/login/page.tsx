'use client'

import Image from 'next/image'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Falha no login')
        return
      }

      router.push('/projects')
      router.refresh()
    } catch {
      setError('Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.glow} aria-hidden="true" />
      <form className={styles.card} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image src="/logo.png" alt="RedAmon" width={32} height={32} />
            <div>
              <h1 className={styles.title}><span>Red</span>Amon</h1>
              <p className={styles.subtitle}>Security Reconnaissance Dashboard</p>
            </div>
          </div>
          <div className={styles.badge}>
            <ShieldCheck size={14} />
            <span>Secure Login</span>
          </div>
        </header>

        <div className={styles.formFields}>
          <div className="formGroup">
            <label className="formLabel formLabelRequired">Email</label>
            <input
              type="email"
              className="textInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@local"
              required
            />
          </div>

          <div className="formGroup">
            <label className="formLabel formLabelRequired">Senha</label>
            <input
              type="password"
              className="textInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className="primaryButton" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
