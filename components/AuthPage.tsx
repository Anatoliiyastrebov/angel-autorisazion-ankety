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
    }
  }, [])

  const checkTelegramWebApp = () => {
    if (typeof window === 'undefined') return

    setIsChecking(true)

    // Проверяем, если открыто из Telegram Web App
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      
      try {
        webApp.ready()
        webApp.expand()
      } catch (e) {
        // Игнорируем ошибки
      }

      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      if (webAppUser && initData?.auth_date && initData?.hash) {
        console.log('✅ Telegram Web App: данные пользователя найдены')
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
        
        // Сохраняем в localStorage
        localStorage.setItem('telegram_user', JSON.stringify(user))
        
        // Вызываем callback
        onAuth(user)
        setIsChecking(false)
        return
      }

      // Попробуем получить данные из initData строки
      if (webApp.initData) {
        try {
          const params = new URLSearchParams(webApp.initData)
          const userParam = params.get('user')
          if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam))
            console.log('✅ Найдены данные пользователя в initData:', userData)
            
            const user: TelegramUser = {
              id: userData.id,
              first_name: userData.first_name,
              last_name: userData.last_name,
              username: userData.username,
              photo_url: userData.photo_url,
              auth_date: parseInt(params.get('auth_date') || '0'),
              hash: params.get('hash') || '',
              initData: webApp.initData,
            }
            
            if (user.id && user.first_name) {
              localStorage.setItem('telegram_user', JSON.stringify(user))
              onAuth(user)
              setIsChecking(false)
              return
            }
          }
        } catch (error) {
          console.error('❌ Ошибка при парсинге initData:', error)
        }
      }
    }

    // Проверяем, есть ли сохраненные данные
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

        {typeof window !== 'undefined' && window.Telegram?.WebApp && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: '#fff3cd', 
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#856404',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>
              💡 Вы открыли сайт из Telegram. Если авторизация не произошла автоматически, используйте кнопку выше.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

