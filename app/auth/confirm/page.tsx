'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    // Проверяем, открыто ли из Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()

      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      if (webAppUser && initData?.auth_date && initData?.hash) {
        const user = {
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

        // Сохраняем данные в localStorage для использования на сайте
        localStorage.setItem('telegram_user', JSON.stringify(user))
      }
    }
  }, [])

  const handleConfirm = () => {
    // Получаем тип анкеты из URL или используем по умолчанию
    const questionnaireType = searchParams.get('type') || 'women'
    
    // Если открыто в Telegram Web App, открываем сайт в браузере
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const siteUrl = `${window.location.origin}/questionnaire/${questionnaireType}?auth=confirmed`
      // Открываем сайт в браузере
      window.open(siteUrl, '_blank')
      // Закрываем Web App через небольшую задержку
      setTimeout(() => {
        window.Telegram.WebApp.close()
      }, 500)
    } else {
      // Если не в Web App, просто перенаправляем
      router.push(`/questionnaire/${questionnaireType}?auth=confirmed`)
    }
  }

  if (!isAuthorized) {
    return (
      <div className="container">
        <div className="card">
          <h1>Авторизация</h1>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Загрузка данных из Telegram...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Подтверждение авторизации</h1>
        
        <div style={{ 
          padding: '1.5rem', 
          background: '#e7f3ff', 
          borderRadius: '8px', 
          border: '1px solid #0088cc',
          marginTop: '2rem'
        }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            <strong>Данные из Telegram:</strong>
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Имя:</strong> {userData.first_name}
            {userData.last_name && ` ${userData.last_name}`}
          </p>
          {userData.username && (
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Telegram:</strong>{' '}
              <a
                href={`https://t.me/${userData.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="telegram-link"
              >
                @{userData.username}
              </a>
            </p>
          )}
        </div>

        <p style={{ marginTop: '2rem', color: '#666', textAlign: 'center' }}>
          Нажмите кнопку ниже, чтобы вернуться на сайт и заполнить анкету.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <button
            className="button"
            onClick={handleConfirm}
            style={{ width: '100%' }}
          >
            Подтвердить и вернуться на сайт
          </button>
        </div>
      </div>
    </div>
  )
}

