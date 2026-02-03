'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
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

  useEffect(() => {
    if (!botName || botName === 'your_bot_name' || !containerRef.current) {
      return
    }

    // Устанавливаем глобальный обработчик для Telegram Widget
    window.onTelegramAuth = onAuth

    // Очищаем контейнер
    containerRef.current.innerHTML = ''

    // Создаем script тег с data-атрибутами (как в официальной документации Telegram)
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

    containerRef.current.appendChild(script)

    return () => {
      if (window.onTelegramAuth === onAuth) {
        delete window.onTelegramAuth
      }
      // Очищаем скрипт при размонтировании
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

  return <div ref={containerRef} style={{ minHeight: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
}

