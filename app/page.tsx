'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
  initData?: string
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'

  const questionnaires = [
    { path: '/questionnaire/baby', name: '👶 Анкета для малыша', type: 'baby' },
    { path: '/questionnaire/child', name: '🧒 Детская анкета', type: 'child' },
    { path: '/questionnaire/women', name: '👩 Женская анкета', type: 'women' },
    { path: '/questionnaire/men', name: '👨 Мужская анкета', type: 'men' },
  ]

  // Загрузка данных пользователя
  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadUser = async () => {
      // 1. Проверяем auth_token в URL (возврат после авторизации)
      const authToken = searchParams.get('auth_token')
      if (authToken) {
        console.log('🔑 Найден auth_token, загружаем данные...')
        try {
          const response = await fetch(`/api/auth/get-user-data?token=${authToken}`)
          if (response.ok) {
            const result = await response.json()
            if (result.userData) {
              console.log('✅ Данные получены с сервера:', result.userData)
              const user: TelegramUser = {
                id: result.userData.id,
                first_name: result.userData.first_name,
                last_name: result.userData.last_name,
                username: result.userData.username,
                photo_url: result.userData.photo_url,
                auth_date: result.userData.auth_date,
                hash: result.userData.hash,
                initData: result.userData.initData,
              }
              setTelegramUser(user)
              localStorage.setItem('telegram_user', JSON.stringify(user))
              
              // Убираем токен из URL
              window.history.replaceState({}, '', '/')
              setIsLoading(false)
              return
            }
          }
        } catch (error) {
          console.error('❌ Ошибка при загрузке данных:', error)
        }
        // Убираем невалидный токен из URL
        window.history.replaceState({}, '', '/')
      }

      // 2. Проверяем localStorage
      const savedUser = localStorage.getItem('telegram_user')
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser)
          if (user.id && user.first_name) {
            // Проверяем, что данные не старше 24 часов
            if (user.auth_date) {
              const currentTime = Math.floor(Date.now() / 1000)
              if (currentTime - user.auth_date > 86400) {
                console.log('⚠️ Данные устарели, требуется повторная авторизация')
                localStorage.removeItem('telegram_user')
                setIsLoading(false)
                return
              }
            }
            console.log('✅ Данные загружены из localStorage:', user)
            setTelegramUser(user)
          }
        } catch (e) {
          console.error('❌ Ошибка при парсинге данных:', e)
          localStorage.removeItem('telegram_user')
        }
      }
      
      setIsLoading(false)
    }

    loadUser()
  }, [searchParams])

  // Определяем мобильное устройство
  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  // Обработчик авторизации
  const handleAuth = async () => {
    setIsAuthenticating(true)
    
    try {
      // Сохраняем сессию на сервере
      const response = await fetch('/api/auth/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: '/',
          questionnaireType: ''
        })
      })
      
      if (!response.ok) throw new Error('Failed to create session')
      
      const { sessionId } = await response.json()
      console.log('✅ Сессия создана:', sessionId)
      
      // Открываем Web App
      const webAppUrl = `https://t.me/${botName}/app?startapp=${sessionId}`
      
      // На мобильных используем location.href для лучшей совместимости
      if (isMobile()) {
        window.location.href = webAppUrl
      } else {
        // На десктопе открываем в новой вкладке
        const newWindow = window.open(webAppUrl, '_blank')
        if (!newWindow) {
          // Если popup заблокирован, используем редирект
          window.location.href = webAppUrl
        }
      }
    } catch (error) {
      console.error('❌ Ошибка:', error)
      alert('Ошибка при подготовке авторизации. Попробуйте ещё раз.')
      setIsAuthenticating(false)
    }
  }

  // Выход из аккаунта
  const handleLogout = () => {
    localStorage.removeItem('telegram_user')
    setTelegramUser(null)
  }

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">
          <h1 style={{ textAlign: 'center' }}>📋 Анкеты</h1>
          <p style={{ textAlign: 'center', color: '#666', marginTop: '1rem' }}>
            Загрузка...
          </p>
        </div>
      </div>
    )
  }

  // Если не авторизован - показываем форму авторизации
  if (!telegramUser) {
    return (
      <div className="container">
        <div className="card">
          <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>📋 Анкеты</h1>
          
          <div style={{ 
            padding: '2rem', 
            background: '#e7f3ff', 
            borderRadius: '12px',
            border: '2px solid #0088cc',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ textAlign: 'center', color: '#0088cc', marginBottom: '1rem' }}>
              🔐 Требуется авторизация
            </h2>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Для заполнения анкет необходимо авторизоваться через Telegram.
              Ваши данные будут автоматически подставлены в анкету.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleAuth}
                disabled={isAuthenticating}
                style={{
                  padding: '16px 32px',
                  fontSize: '18px',
                  fontWeight: 600,
                  background: isAuthenticating ? '#ccc' : '#0088cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '56px',
                  minWidth: '200px',
                  WebkitTapHighlightColor: 'rgba(0,136,204,0.3)',
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              >
                {isAuthenticating ? (
                  '⏳ Подготовка...'
                ) : (
                  <>
                    <span>🤖</span>
                    <span>Войти через Telegram</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div style={{ 
            padding: '1rem', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
              После авторизации вы сможете заполнить и отправить анкеты
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Авторизован - показываем анкеты
  return (
    <div className="container">
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>📋 Анкеты</h1>
        
        {/* Статус авторизации */}
        <div style={{ 
          padding: '1rem 1.5rem', 
          background: '#d4edda', 
          borderRadius: '8px',
          border: '1px solid #c3e6cb',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div>
              <p style={{ color: '#155724', fontWeight: 600, margin: 0 }}>
                Авторизация пройдена
              </p>
              <p style={{ color: '#155724', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                {telegramUser.username ? `@${telegramUser.username}` : `${telegramUser.first_name} ${telegramUser.last_name || ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              background: 'transparent',
              color: '#155724',
              border: '1px solid #155724',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Выйти
          </button>
        </div>
        
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}>
          Выберите анкету для заполнения
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionnaires.map((q) => (
            <Link
              key={q.path}
              href={q.path}
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
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e7f3ff'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 136, 204, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f9fa'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {q.name}
            </Link>
          ))}
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
          <h1 style={{ textAlign: 'center' }}>📋 Анкеты</h1>
          <p style={{ textAlign: 'center', color: '#666', marginTop: '1rem' }}>
            Загрузка...
          </p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
