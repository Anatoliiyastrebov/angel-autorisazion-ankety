'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
          }
          auth_date: number
          hash: string
        }
        ready: () => void
        expand: () => void
      }
    }
  }
}

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramLoginProps {
  botName: string
  onAuth: (user: TelegramUser) => void
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  requestAccess?: boolean
  usePic?: boolean
}

export default function TelegramLogin({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 4,
  requestAccess = false,
  usePic = true,
}: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isWebApp, setIsWebApp] = useState(false)

  useEffect(() => {
    if (!botName || botName === 'your_bot_name') {
      return
    }

    // Проверяем, открыт ли сайт через Telegram Web App
    const checkTelegramWebApp = () => {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const webAppUser = window.Telegram.WebApp.initDataUnsafe.user
        const initData = window.Telegram.WebApp.initDataUnsafe
        
        if (webAppUser && initData.auth_date && initData.hash) {
          setIsWebApp(true)
          
          // Формируем объект пользователя из Web App
          const user: TelegramUser = {
            id: webAppUser.id,
            first_name: webAppUser.first_name,
            last_name: webAppUser.last_name,
            username: webAppUser.username,
            photo_url: webAppUser.photo_url,
            auth_date: initData.auth_date,
            hash: initData.hash,
          }
          
          // Инициализируем Web App
          window.Telegram.WebApp.ready()
          window.Telegram.WebApp.expand()
          
          // Вызываем callback с данными пользователя
          setTimeout(() => {
            onAuth(user)
          }, 100)
          
          return true
        }
      }
      return false
    }

    // Пытаемся использовать Web App
    if (checkTelegramWebApp()) {
      return
    }

    // Если не Web App, используем обычный виджет
    if (!containerRef.current) {
      return
    }

    // Устанавливаем глобальный обработчик для Telegram Widget
    window.onTelegramAuth = (user: TelegramUser) => {
      console.log('Telegram Widget auth received:', user)
      onAuth(user)
    }

    // Очищаем контейнер
    containerRef.current.innerHTML = ''

    // Создаем div для виджета (не script, как рекомендует Telegram)
    const widgetDiv = document.createElement('div')
    widgetDiv.setAttribute('data-telegram-login', botName)
    widgetDiv.setAttribute('data-size', buttonSize)
    widgetDiv.setAttribute('data-corner-radius', cornerRadius.toString())
    if (requestAccess) {
      widgetDiv.setAttribute('data-request-access', 'write')
    }
    widgetDiv.setAttribute('data-userpic', usePic.toString())
    widgetDiv.setAttribute('data-onauth', 'onTelegramAuth(user)')
    
    containerRef.current.appendChild(widgetDiv)

    // Загружаем скрипт виджета
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.onload = () => {
      console.log('Telegram widget script loaded')
    }
    script.onerror = () => {
      console.error('Failed to load Telegram widget script')
    }
    
    // Добавляем скрипт в head, а не в контейнер
    document.head.appendChild(script)

    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth
      }
      // Очищаем контейнер при размонтировании
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      // Удаляем скрипт
      const existingScript = document.querySelector('script[src*="telegram-widget.js"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [botName, onAuth, buttonSize, cornerRadius, requestAccess, usePic])

  if (!botName || botName === 'your_bot_name') {
    return (
      <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
        Ошибка: имя бота не настроено. Проверьте переменную окружения NEXT_PUBLIC_TELEGRAM_BOT_NAME
      </div>
    )
  }

  if (isWebApp) {
    return (
      <div style={{ padding: '1rem', background: '#e7f3ff', borderRadius: '4px', textAlign: 'center' }}>
        <p>Авторизация через Telegram Web App...</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        minHeight: '40px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }} 
    />
  )
}

