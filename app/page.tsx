'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthPage from '@/components/AuthPage'
import type { TelegramUser } from '@/components/TelegramLogin'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Проверяем сохраненные данные при загрузке
    if (typeof window !== 'undefined') {
      const loadUser = () => {
        const savedUser = localStorage.getItem('telegram_user')
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser)
            if (user.id && user.first_name) {
              console.log('✅ Пользователь найден в localStorage:', user)
              setTelegramUser(user)
              setIsLoading(false)
              return true
            }
          } catch (e) {
            console.error('❌ Ошибка при парсинге данных пользователя:', e)
            localStorage.removeItem('telegram_user')
          }
        }
        return false
      }

      // Проверяем параметр авторизации из URL
      const authConfirmed = searchParams.get('auth')
      if (authConfirmed === 'confirmed') {
        console.log('✅ Параметр auth=confirmed найден, загружаем данные...')
        
        // Даем небольшую задержку для сохранения данных из Web App
        setTimeout(() => {
          const userLoaded = loadUser()
          if (!userLoaded) {
            console.warn('⚠️ Данные пользователя не найдены после подтверждения')
            // Пробуем еще раз через небольшую задержку
            setTimeout(() => {
              loadUser()
              setIsLoading(false)
            }, 500)
          }
          
          // Очищаем параметр из URL
          window.history.replaceState({}, '', window.location.pathname)
        }, 100)
      } else {
        // Обычная загрузка без параметра
        loadUser()
        setIsLoading(false)
      }
    }
  }, [searchParams])

  const handleAuth = (user: TelegramUser) => {
    console.log('✅ Авторизация успешна, переходим к выбору анкет')
    setTelegramUser(user)
  }

  const questionnaires = [
    { path: '/questionnaire/baby', name: 'Анкета для малыша' },
    { path: '/questionnaire/child', name: 'Детская анкета' },
    { path: '/questionnaire/women', name: 'Женская анкета' },
    { path: '/questionnaire/men', name: 'Мужская анкета' },
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
              style={{
                display: 'block',
                padding: '1.5rem',
                background: '#f8f9fa',
                border: '2px solid #0088cc',
                borderRadius: '12px',
                textDecoration: 'none',
                color: '#333',
                fontSize: '1.1rem',
                fontWeight: 500,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e7f3ff'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f9fa'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
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

export default function Home() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card">
          <h1>Загрузка...</h1>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

