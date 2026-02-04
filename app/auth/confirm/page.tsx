'use client'

/// <reference path="../../telegram-webapp.d.ts" />

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TelegramUser } from '@/components/TelegramLogin'

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userData, setUserData] = useState<TelegramUser | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    // Проверяем, открыто ли из Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()

      // Приоритет 1: Данные из Web App (основной способ при открытии через Menu Button)
      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      console.log('🔍 Проверка данных Web App:', {
        hasWebApp: !!webApp,
        hasUser: !!webAppUser,
        hasInitData: !!initData,
        user: webAppUser ? {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          username: webAppUser.username
        } : null
      })

      if (webAppUser && initData?.auth_date && initData?.hash) {
        console.log('✅ Данные пользователя найдены в Web App')
        const user: TelegramUser = {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          last_name: webAppUser.last_name,
          username: webAppUser.username,
          photo_url: webAppUser.photo_url,
          auth_date: initData.auth_date,
          hash: initData.hash,
          initData: webApp.initData,
        }

        setUserData(user)
        setIsAuthorized(true)
      } 
      // Приоритет 2: Данные из параметров URL (для обратной совместимости)
      else {
        const token = searchParams.get('token')
        const userId = searchParams.get('user_id')
        
        if (token && userId) {
          console.log('📡 Получение данных пользователя через API')
          fetchUserData(token, userId)
        } else {
          console.warn('⚠️ Нет данных для авторизации. Убедитесь, что открыто через Menu Button бота.')
        }
      }
    } else {
      console.warn('⚠️ Web App не обнаружен. Убедитесь, что открыто через Telegram бота.')
    }
  }, [searchParams])

  const fetchUserData = async (token: string, userId: string) => {
    try {
      const response = await fetch(`/api/auth/get-user?token=${token}&user_id=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to get user data')
      }

      const userData = await response.json()

      const user: TelegramUser = {
        id: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        photo_url: userData.photo_url,
        auth_date: Math.floor(Date.now() / 1000),
        hash: '',
        initData: '',
      }

      setUserData(user)
      setIsAuthorized(true)
    } catch (error) {
      console.error('❌ Ошибка при получении данных пользователя:', error)
    }
  }

  const handleConfirm = async () => {
    if (!userData) return

    setIsConfirming(true)

    try {
      // Сохраняем данные в localStorage
      console.log('💾 Сохранение данных пользователя в localStorage:', userData)
      localStorage.setItem('telegram_user', JSON.stringify(userData))
      
      // Проверяем, что данные сохранились
      const saved = localStorage.getItem('telegram_user')
      if (!saved) {
        throw new Error('Не удалось сохранить данные')
      }
      console.log('✅ Данные успешно сохранены в localStorage')

      // Получаем URL для возврата из localStorage
      const returnUrl = typeof window !== 'undefined' 
        ? localStorage.getItem('return_url') 
        : null
      
      // Если есть сохраненный URL, возвращаемся на него, иначе на главную
      const redirectUrl = returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}auth=confirmed`
        : '/?auth=confirmed'
      
      console.log('🔗 URL для возврата:', returnUrl || 'главная страница')
      console.log('🔗 Полный URL редиректа:', redirectUrl)
      
      // Если открыто в Telegram Web App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp
        
        // Показываем уведомление об успехе
        webApp.showAlert('✅ Авторизация успешна! Вы будете перенаправлены обратно в анкету.', () => {
          // Открываем сайт в браузере с параметром auth=confirmed
          const siteUrl = `${window.location.origin}${redirectUrl}`
          console.log('🔗 Открываем сайт:', siteUrl)
          webApp.openLink(siteUrl, { try_instant_view: false })
          
          // Очищаем сохраненный URL
          if (returnUrl) {
            localStorage.removeItem('return_url')
          }
          
          // Закрываем Web App через небольшую задержку
          setTimeout(() => {
            if (webApp.close) {
              webApp.close()
            }
          }, 1000)
        })
      } else {
        // Если не в Web App, просто перенаправляем
        console.log('🔗 Перенаправление на:', redirectUrl)
        if (returnUrl) {
          localStorage.removeItem('return_url')
        }
        router.push(redirectUrl)
      }
    } catch (error) {
      console.error('❌ Ошибка при подтверждении:', error)
      setIsConfirming(false)
      alert('Ошибка при сохранении данных. Попробуйте еще раз.')
    }
  }

  const handleCancel = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.close()
    } else {
      router.push('/')
    }
  }

  if (!isAuthorized || !userData) {
    return (
      <div className="container">
        <div className="card">
          <h1>Авторизация</h1>
          <p style={{ color: '#666', marginTop: '1rem', textAlign: 'center' }}>
            Загрузка данных из Telegram...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>🔐 Подтверждение авторизации</h1>
        
        <div style={{ 
          padding: '2rem', 
          background: '#f8f9fa', 
          borderRadius: '12px', 
          border: '2px solid #0088cc',
          marginBottom: '2rem'
        }}>
          <p style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.1rem', 
            textAlign: 'center',
            fontWeight: 500,
            color: '#333'
          }}>
            Вы хотите авторизоваться на сайте с данными:
          </p>
          
          <div style={{
            padding: '1.5rem',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#666', fontSize: '0.9rem' }}>Имя:</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', fontWeight: 500 }}>
                {userData.first_name}
                {userData.last_name && ` ${userData.last_name}`}
              </p>
            </div>
            
            {userData.username && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#666', fontSize: '0.9rem' }}>Telegram:</strong>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem' }}>
                  <a
                    href={`https://t.me/${userData.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#0088cc', 
                      textDecoration: 'none',
                      fontWeight: 500
                    }}
                  >
                    @{userData.username}
                  </a>
                </p>
              </div>
            )}
            
            <div>
              <strong style={{ color: '#666', fontSize: '0.9rem' }}>ID:</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1rem', color: '#999' }}>
                {userData.id}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            className="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            style={{ 
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 500,
              background: isConfirming ? '#ccc' : '#0088cc',
              cursor: isConfirming ? 'not-allowed' : 'pointer'
            }}
          >
            {isConfirming ? '⏳ Подтверждение...' : '✅ Подтвердить авторизацию'}
          </button>
          
          <button
            onClick={handleCancel}
            disabled={isConfirming}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              background: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: isConfirming ? 'not-allowed' : 'pointer'
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card">
          <h1>Авторизация</h1>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Загрузка...
          </p>
        </div>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}

