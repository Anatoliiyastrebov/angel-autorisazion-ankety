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
  initData?: string // Оригинальная строка initData для Web App
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
    if (!botName || botName === 'your_bot_name' || !containerRef.current) {
      return
    }

    // Сначала проверяем Web App (быстрая проверка)
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const webAppUser = window.Telegram.WebApp.initDataUnsafe.user
      const initData = window.Telegram.WebApp.initDataUnsafe
      const initDataString = window.Telegram.WebApp.initData // Оригинальная строка
      
      if (webAppUser && initData.auth_date && initData.hash) {
        setIsWebApp(true)
        
        const user: TelegramUser = {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          last_name: webAppUser.last_name,
          username: webAppUser.username,
          photo_url: webAppUser.photo_url,
          auth_date: initData.auth_date,
          hash: initData.hash,
          initData: initDataString, // Сохраняем оригинальную строку для проверки
        }
        
        window.Telegram.WebApp.ready()
        window.Telegram.WebApp.expand()
        
        setTimeout(() => {
          onAuth(user)
        }, 100)
        return
      }
    }

    // Устанавливаем глобальный обработчик для Telegram Widget
    window.onTelegramAuth = (user: TelegramUser) => {
      console.log('🔵 Telegram Widget auth received:', user)
      console.log('🔵 User data:', {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        hash: user.hash ? 'present' : 'missing'
      })
      
      // Проверяем, что hash есть
      if (!user.hash || user.hash.trim() === '') {
        console.error('❌ Ошибка: hash отсутствует в данных пользователя')
        alert('Ошибка авторизации: данные не прошли проверку. Попробуйте еще раз.')
        return
      }
      
      onAuth(user)
    }

    // Очищаем контейнер
    containerRef.current.innerHTML = ''

    // Создаем функцию для загрузки виджета
    const loadWidget = () => {
      if (!containerRef.current) return

      // Создаем script тег с data-атрибутами (официальный способ Telegram)
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', botName)
      script.setAttribute('data-size', buttonSize)
      script.setAttribute('data-corner-radius', cornerRadius.toString())
      if (requestAccess) {
        script.setAttribute('data-request-access', 'write')
      }
      script.setAttribute('data-userpic', usePic.toString())
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.async = true
      
      script.onload = () => {
        console.log('✅ Telegram widget script loaded')
      }
      
      script.onerror = () => {
        console.error('❌ Failed to load Telegram widget script')
        if (containerRef.current) {
          containerRef.current.innerHTML = '<p style="color: red; padding: 1rem;">Ошибка загрузки виджета Telegram. Проверьте настройки бота и домен в BotFather.</p>'
        }
      }

      containerRef.current.appendChild(script)
      console.log('Widget script added to container with bot:', botName)
    }

    // Загружаем виджет сразу
    loadWidget()

    return () => {
      if (window.onTelegramAuth === onAuth) {
        delete window.onTelegramAuth
      }
      // Очищаем контейнер при размонтировании
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
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
        minHeight: '60px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        width: '100%'
      }} 
    >
      {!isWebApp && (
        <div style={{ 
          padding: '1rem', 
          background: '#f8f9fa', 
          borderRadius: '4px',
          textAlign: 'center',
          width: '100%'
        }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            Загрузка кнопки авторизации...
          </p>
        </div>
      )}
    </div>
  )
}

