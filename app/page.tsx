'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthPage from '@/components/AuthPage'
import type { TelegramUser } from '@/components/TelegramLogin'

export default function Home() {
  const router = useRouter()
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Проверяем сохраненные данные при загрузке
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('telegram_user')
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser)
          if (user.id && user.first_name) {
            setTelegramUser(user)
          }
        } catch (e) {
          localStorage.removeItem('telegram_user')
        }
      }
      setIsLoading(false)
    }
  }, [])

  const handleAuth = (user: TelegramUser) => {
    console.log('✅ Авторизация успешна, переходим к выбору анкет')
    setTelegramUser(user)
  }

  const questionnaires = [
    { path: '/questionnaire/women', name: 'Женская анкета' },
    { path: '/questionnaire/men', name: 'Мужская анкета' },
    { path: '/questionnaire/basic', name: 'Базовая анкета' },
    { path: '/questionnaire/extended', name: 'Расширенная анкета' },
  ]

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">
          <h1>Загрузка...</h1>
        </div>
      </div>
    )
  }

  // Если не авторизован - показываем страницу авторизации
  if (!telegramUser) {
    return <AuthPage onAuth={handleAuth} />
  }

  // Если авторизован - показываем выбор анкет
  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Выберите анкету</h1>
          <div style={{ 
            padding: '0.5rem 1rem', 
            background: '#d4edda', 
            borderRadius: '8px',
            border: '1px solid #c3e6cb'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#155724' }}>
              ✅ {telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionnaires.map((q) => (
            <Link
              key={q.path}
              href={q.path}
              className="questionnaire-link"
            >
              {q.name}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
          <button
            onClick={() => {
              localStorage.removeItem('telegram_user')
              setTelegramUser(null)
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}

