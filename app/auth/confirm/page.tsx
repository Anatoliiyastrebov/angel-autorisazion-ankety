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
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
  const [authComplete, setAuthComplete] = useState(false)

  useEffect(() => {
    // Проверяем, открыто ли из Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()

      // Данные из Web App
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
        
        // Валидация данных пользователя
        if (!webAppUser.id || !webAppUser.first_name) {
          console.error('❌ ОШИБКА: Неполные данные пользователя из Web App')
          return
        }
        
        // Проверка auth_date (данные не должны быть старше 24 часов)
        const currentTime = Math.floor(Date.now() / 1000)
        const authDate = initData.auth_date
        if (currentTime - authDate > 86400) {
          console.error('❌ ОШИБКА: Данные авторизации устарели (старше 24 часов)')
          return
        }
        
        const user: TelegramUser = {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          last_name: webAppUser.last_name || undefined,
          username: webAppUser.username || undefined,
          photo_url: webAppUser.photo_url || undefined,
          auth_date: initData.auth_date,
          hash: initData.hash,
          initData: webApp.initData,
        }

        setUserData(user)
        setIsAuthorized(true)
      } else {
        console.warn('⚠️ Нет данных для авторизации в Web App.')
        console.warn('⚠️ Эта страница должна открываться через Menu Button бота.')
      }
    } else {
      console.warn('⚠️ Telegram Web App не обнаружен.')
      console.warn('⚠️ Эта страница работает только при открытии через Telegram бота.')
    }
  }, [searchParams])

  // Получаем данные из start_param (переданы при открытии Web App)
  const getStartParamData = (): { returnUrl: string; questionnaireType: string } => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const startParam = window.Telegram.WebApp.initDataUnsafe?.start_param
        if (startParam) {
          console.log('🔑 Получен start_param:', startParam)
          const decoded = decodeURIComponent(atob(startParam))
          const [returnUrl, questionnaireType] = decoded.split('|')
          console.log('📋 Декодированные данные:', { returnUrl, questionnaireType })
          return { returnUrl: returnUrl || '/', questionnaireType: questionnaireType || '' }
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при декодировании start_param:', error)
    }
    return { returnUrl: '/', questionnaireType: '' }
  }

  const handleConfirm = async () => {
    if (!userData) return

    setIsConfirming(true)

    try {
      // Получаем URL для возврата из start_param (переданы при открытии Web App)
      const { returnUrl, questionnaireType } = getStartParamData()
      
      console.log('📡 Отправка данных на сервер...', {
        returnUrl,
        questionnaireType,
        userId: userData.id
      })

      // Отправляем данные на сервер и получаем токен
      const response = await fetch('/api/auth/save-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userData: {
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            username: userData.username,
            photo_url: userData.photo_url,
            auth_date: userData.auth_date,
            hash: userData.hash,
            initData: userData.initData,
          },
          returnUrl,
          questionnaireType,
        }),
      })

      if (!response.ok) {
        throw new Error('Ошибка при сохранении данных')
      }

      const result = await response.json()
      console.log('✅ Данные сохранены на сервере:', result)

      // Сохраняем URL для возврата
      setCallbackUrl(result.callbackUrl)
      setAuthComplete(true)

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

  const handleGoToSite = () => {
    if (callbackUrl) {
      // Открываем сайт в браузере (не в Web App)
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(callbackUrl, { try_instant_view: false })
        // Закрываем Web App через небольшую задержку
        setTimeout(() => {
          window.Telegram?.WebApp?.close()
        }, 500)
      } else {
        window.location.href = callbackUrl
      }
    }
  }

  // Получаем имя бота для инструкции
  const botName = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'
    : 'telega_automat_bot'

  // Если авторизация завершена - показываем кнопку для перехода на сайт
  if (authComplete && callbackUrl) {
    return (
      <div className="container">
        <div className="card">
          <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>✅ Авторизация успешна!</h1>
          
          <div style={{ 
            padding: '1.5rem', 
            background: '#d4edda', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #c3e6cb',
            textAlign: 'center'
          }}>
            <p style={{ color: '#155724', margin: 0, fontSize: '1.1rem' }}>
              Данные сохранены. Нажмите кнопку ниже, чтобы вернуться к анкете.
            </p>
          </div>

          <button
            onClick={handleGoToSite}
            style={{
              width: '100%',
              padding: '1.25rem',
              fontSize: '1.2rem',
              fontWeight: 600,
              background: '#0088cc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            📋 Вернуться к анкете
          </button>

          <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
            Ваши данные из Telegram будут автоматически подставлены в анкету.
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthorized || !userData) {
    return (
      <div className="container">
        <div className="card">
          <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔐 Авторизация</h1>
          
          {typeof window !== 'undefined' && window.Telegram?.WebApp ? (
            // Если открыто через Web App, но данных нет
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                Загрузка данных из Telegram...
              </p>
              <p style={{ color: '#999', fontSize: '0.9rem' }}>
                Если данные не загружаются, попробуйте закрыть и открыть заново через Menu Button бота.
              </p>
            </div>
          ) : (
            // Если открыто в обычном браузере
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                padding: '1.5rem', 
                background: '#fff3cd', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid #ffc107'
              }}>
                <p style={{ color: '#856404', margin: 0, fontWeight: 500, fontSize: '1.1rem' }}>
                  ⚠️ Эта страница работает только через Telegram
                </p>
              </div>
              
              <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Для авторизации необходимо открыть эту страницу через Telegram бота.
              </p>
              
              <div style={{ 
                padding: '1.5rem', 
                background: '#e7f3ff', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid #0088cc',
                textAlign: 'left'
              }}>
                <p style={{ fontWeight: 500, marginBottom: '1rem', color: '#0088cc' }}>
                  📋 Инструкция:
                </p>
                <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#333', lineHeight: 1.8 }}>
                  <li>Откройте Telegram</li>
                  <li>Найдите бота <strong>@{botName}</strong></li>
                  <li>Нажмите кнопку <strong>"Авторизоваться"</strong> внизу экрана (Menu Button)</li>
                  <li>Подтвердите авторизацию</li>
                  <li>Нажмите "Вернуться к анкете"</li>
                </ol>
              </div>
              
              <a 
                href={`https://t.me/${botName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '1rem 2rem',
                  background: '#0088cc',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '1.1rem'
                }}
              >
                🤖 Открыть бота в Telegram
              </a>
            </div>
          )}
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
