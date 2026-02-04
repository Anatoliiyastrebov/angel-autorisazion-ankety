'use client'

/// <reference path="../telegram-webapp.d.ts" />

import { useEffect, useState } from 'react'
import TelegramLogin, { TelegramUser } from './TelegramLogin'

interface AuthPageProps {
  onAuth: (user: TelegramUser) => void
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [botName, setBotName] = useState<string>('')
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBotName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '')
      
      // Проверяем Telegram Web App при загрузке
      checkTelegramWebApp()
      
      // Также проверяем после полной загрузки страницы
      const handleLoad = () => {
        console.log('📄 Страница полностью загружена, повторная проверка...')
        setTimeout(() => {
          checkTelegramWebApp()
        }, 500)
      }
      
      if (document.readyState === 'complete') {
        handleLoad()
      } else {
        window.addEventListener('load', handleLoad)
        return () => window.removeEventListener('load', handleLoad)
      }
      
      // Дополнительная проверка через небольшое время (на случай, если скрипт загружается медленно)
      const timeoutId = setTimeout(() => {
        console.log('⏰ Таймаут проверки, повторная попытка...')
        checkTelegramWebApp()
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [])

  const checkTelegramWebApp = () => {
    if (typeof window === 'undefined') return

    setIsChecking(true)

    // Ждем загрузки Telegram Web App скрипта
    const checkWebApp = () => {
      console.log('🔍 Проверка Telegram Web App...')
      
      // Проверяем, если открыто из Telegram Web App
      if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp
        console.log('✅ Telegram WebApp объект найден:', {
          hasInitData: !!webApp.initData,
          hasInitDataUnsafe: !!webApp.initDataUnsafe,
          initDataLength: webApp.initData?.length || 0,
          hasUser: !!webApp.initDataUnsafe?.user
        })
        
        try {
          // Инициализируем Web App
          webApp.ready()
          webApp.expand()
          
          // Настраиваем тему
          if (webApp.themeParams) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', webApp.themeParams.bg_color || '#ffffff')
            document.documentElement.style.setProperty('--tg-theme-text-color', webApp.themeParams.text_color || '#000000')
          }
        } catch (e) {
          console.warn('⚠️ Ошибка при инициализации Web App:', e)
        }

        const webAppUser = webApp.initDataUnsafe?.user
        const initData = webApp.initDataUnsafe

        console.log('🔍 Данные initDataUnsafe:', {
          hasUser: !!webAppUser,
          hasAuthDate: !!initData?.auth_date,
          hasHash: !!initData?.hash,
          user: webAppUser ? {
            id: webAppUser.id,
            first_name: webAppUser.first_name,
            username: webAppUser.username
          } : null
        })

        // Приоритет 1: Данные из initDataUnsafe (самый надежный способ)
        if (webAppUser && initData?.auth_date && initData?.hash) {
          console.log('✅ Telegram Web App: данные пользователя найдены через initDataUnsafe', webAppUser)
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
          
          console.log('✅ Создан объект пользователя:', user)
          
          // Сохраняем в localStorage
          localStorage.setItem('telegram_user', JSON.stringify(user))
          
          // Вызываем callback
          console.log('✅ Вызываем onAuth callback')
          onAuth(user)
          setIsChecking(false)
          return true
        }

        // Приоритет 2: Парсим initData строку
        if (webApp.initData) {
          console.log('🔍 Парсим initData строку:', webApp.initData.substring(0, 100) + '...')
          try {
            const params = new URLSearchParams(webApp.initData)
            const userParam = params.get('user')
            const authDate = params.get('auth_date')
            const hash = params.get('hash')
            
            console.log('🔍 Параметры из initData:', {
              hasUser: !!userParam,
              hasAuthDate: !!authDate,
              hasHash: !!hash
            })
            
            if (userParam) {
              const userData = JSON.parse(decodeURIComponent(userParam))
              console.log('✅ Найдены данные пользователя в initData:', userData)
              
              const user: TelegramUser = {
                id: userData.id,
                first_name: userData.first_name,
                last_name: userData.last_name,
                username: userData.username,
                photo_url: userData.photo_url,
                auth_date: parseInt(authDate || '0'),
                hash: hash || '',
                initData: webApp.initData,
              }
              
              if (user.id && user.first_name) {
                console.log('✅ Создан объект пользователя из initData:', user)
                localStorage.setItem('telegram_user', JSON.stringify(user))
                onAuth(user)
                setIsChecking(false)
                return true
              } else {
                console.error('❌ Недостаточно данных пользователя:', { id: user.id, first_name: user.first_name })
              }
            } else {
              console.warn('⚠️ Параметр user не найден в initData')
            }
          } catch (error) {
            console.error('❌ Ошибка при парсинге initData:', error)
            console.error('❌ initData строка:', webApp.initData)
          }
        } else {
          console.warn('⚠️ webApp.initData отсутствует')
        }
      } else {
        console.log('⚠️ window.Telegram?.WebApp не найден')
      }
      return false
    }

    // Проверяем сразу, если скрипт уже загружен
    if (checkWebApp()) {
      return
    }

    // Если скрипт еще не загружен, ждем его загрузки (увеличиваем время ожидания)
    let attempts = 0
    const maxAttempts = 30 // Увеличено с 10 до 30 (3 секунды)
    const checkInterval = setInterval(() => {
      attempts++
      console.log(`🔍 Попытка ${attempts}/${maxAttempts}...`)
      if (checkWebApp() || attempts >= maxAttempts) {
        clearInterval(checkInterval)
        if (attempts >= maxAttempts) {
          console.warn('⚠️ Превышено максимальное количество попыток')
          // Проверяем сохраненные данные, если Web App не доступен
          const savedUser = localStorage.getItem('telegram_user')
          if (savedUser) {
            try {
              const user = JSON.parse(savedUser)
              if (user.id && user.first_name) {
                console.log('✅ Найдены сохраненные данные пользователя')
                onAuth(user)
                setIsChecking(false)
                return
              }
            } catch (e) {
              localStorage.removeItem('telegram_user')
            }
          }
          setIsChecking(false)
        }
      }
    }, 100)
  }

  const handleTelegramAuth = (user: TelegramUser) => {
    console.log('✅ Telegram авторизация успешна:', user)
    // Сохраняем в localStorage
    localStorage.setItem('telegram_user', JSON.stringify(user))
    onAuth(user)
  }

  if (isChecking) {
    return (
      <div className="container">
        <div className="card">
          <h1>Проверка авторизации...</h1>
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
        <h1>Авторизация через Telegram</h1>
        
        <div style={{ 
          marginTop: '2rem', 
          padding: '2rem', 
          background: '#e7f3ff', 
          borderRadius: '8px',
          border: '1px solid #0088cc'
        }}>
          <p style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>
            Для доступа к анкетам необходимо авторизоваться через Telegram
          </p>
          
          <p style={{ marginBottom: '2rem', fontSize: '0.95rem', color: '#666', textAlign: 'center' }}>
            Нажмите кнопку ниже, чтобы войти через Telegram
          </p>

          {botName ? (
            <TelegramLogin
              botName={botName}
              onAuth={handleTelegramAuth}
              buttonSize="large"
              requestAccess={false}
            />
          ) : (
            <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', color: '#856404', textAlign: 'center' }}>
              ⚠️ Имя бота не настроено. Проверьте переменную окружения NEXT_PUBLIC_TELEGRAM_BOT_NAME
            </div>
          )}
        </div>

        {typeof window !== 'undefined' && window.Telegram?.WebApp ? (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: '#d1ecf1', 
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#0c5460',
            textAlign: 'center',
            border: '1px solid #bee5eb'
          }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              ✅ Открыто через Telegram Web App
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
              Авторизация должна произойти автоматически. Если этого не произошло, используйте кнопку выше.
            </p>
            <details style={{ marginTop: '1rem', textAlign: 'left', fontSize: '0.8rem' }}>
              <summary style={{ cursor: 'pointer', color: '#0c5460', fontWeight: 500 }}>
                🔍 Отладочная информация
              </summary>
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff', borderRadius: '4px', fontFamily: 'monospace' }}>
                <div>initData: {window.Telegram?.WebApp?.initData ? '✅ Есть' : '❌ Нет'}</div>
                <div>initDataUnsafe: {window.Telegram?.WebApp?.initDataUnsafe ? '✅ Есть' : '❌ Нет'}</div>
                <div>initDataUnsafe.user: {window.Telegram?.WebApp?.initDataUnsafe?.user ? '✅ Есть' : '❌ Нет'}</div>
                {window.Telegram?.WebApp?.initDataUnsafe?.user && (
                  <div style={{ marginTop: '0.5rem' }}>
                    ID: {window.Telegram.WebApp.initDataUnsafe.user.id}<br/>
                    Имя: {window.Telegram.WebApp.initDataUnsafe.user.first_name}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                  Откройте консоль браузера (F12) для подробных логов
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: '#fff3cd', 
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#856404',
            textAlign: 'center',
            border: '1px solid #ffeaa7'
          }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              💡 Рекомендуется открыть сайт через Telegram бота
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
              Для автоматической авторизации откройте сайт через кнопку в боте или меню бота.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

