'use client'

import { useState, useEffect } from 'react'
import TelegramLogin, { TelegramUser } from './TelegramLogin'
import TelegramAuthModal from './TelegramAuthModal'
import { useRouter } from 'next/navigation'

interface QuestionnaireFormProps {
  title: string
  questionnaireType: string
}

export default function QuestionnaireForm({
  title,
  questionnaireType,
}: QuestionnaireFormProps) {
  const router = useRouter()
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Проверяем Telegram Web App при загрузке компонента
  useEffect(() => {
    let isMounted = true
    let isInitialized = false
    
    const initializeWebApp = () => {
      // Предотвращаем множественную инициализацию и работу после размонтирования
      if (!isMounted || isInitialized || typeof window === 'undefined' || !window.Telegram?.WebApp) {
        return false
      }
      
      const webApp = window.Telegram.WebApp
      
      // Инициализируем Web App только один раз
      if (!isInitialized) {
        try {
          webApp.ready()
          webApp.expand()
          isInitialized = true
        } catch (error) {
          console.error('Error initializing Web App:', error)
          return false
        }
      }
      
      // Проверяем наличие данных пользователя
      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe
      const initDataString = webApp.initData // Оригинальная строка
      
      if (webAppUser && initData?.auth_date && initData?.hash) {
        if (!isMounted) return false // Компонент размонтирован
        
        console.log('✅ Telegram Web App: user data loaded')
        
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
        
        // Автоматически показываем модальное окно с данными для согласия
        setTelegramUser(user)
        setShowModal(true)
        return true // Данные загружены
      }
      
      return false // Данные еще не загружены
    }

    // Проверяем сразу
    if (initializeWebApp()) {
      return () => {
        isMounted = false
      }
    }

    // Если данные не загружены, проверяем через небольшую задержку
    const timer = setTimeout(() => {
      if (isMounted && !initializeWebApp()) {
        console.log('ℹ️ Telegram Web App detected but user data not available')
      }
    }, 500)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [])

  const handleTelegramAuth = (user: TelegramUser) => {
    console.log('🟢 handleTelegramAuth called with user:', user)
    console.log('🟢 User hash:', user.hash ? 'present' : 'missing')
    
    if (!user.hash || user.hash.trim() === '') {
      setError('Ошибка: данные авторизации неполные. Попробуйте авторизоваться еще раз.')
      console.error('❌ Hash отсутствует в данных пользователя')
      return
    }
    
    setTelegramUser(user)
    // Показываем модальное окно вместо автоматической отправки
    setShowModal(true)
  }

  const handleModalConfirm = () => {
    if (telegramUser) {
      setShowModal(false)
      handleSubmit(telegramUser)
    }
  }

  const handleModalCancel = () => {
    setShowModal(false)
    setTelegramUser(null)
  }

  const handleSubmit = async (user?: TelegramUser) => {
    const userToSubmit = user || telegramUser
    if (!userToSubmit) {
      setError('Пожалуйста, авторизуйтесь через Telegram')
      return
    }

    // Проверяем, что данные из реальной авторизации Telegram (есть hash)
    if (!userToSubmit.hash || userToSubmit.hash.trim() === '') {
      setError('Ошибка: данные не прошли проверку авторизации Telegram')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(true)
    setError(null)

    console.log('🟡 Submitting data to API...', {
      questionnaireType,
      userId: userToSubmit.id,
      username: userToSubmit.username,
      hasHash: !!userToSubmit.hash
    })

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionnaireType,
          telegram: {
            id: userToSubmit.id,
            username: userToSubmit.username,
            first_name: userToSubmit.first_name,
            last_name: userToSubmit.last_name,
            photo_url: userToSubmit.photo_url,
            auth_date: userToSubmit.auth_date,
            hash: userToSubmit.hash,
            initData: userToSubmit.initData, // Отправляем оригинальную строку initData для Web App
          },
        }),
      })

      console.log('🟡 API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API error:', errorData)
        throw new Error(errorData.error || 'Ошибка при отправке данных')
      }

      const data = await response.json()
      console.log('✅ API success:', data)
      
      router.push(
        `/questionnaire/success?username=${encodeURIComponent(
          userToSubmit.username || ''
        )}&type=${encodeURIComponent(questionnaireType)}`
      )
    } catch (err) {
      console.error('❌ Submit error:', err)
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="container">
        <div className="card">
          <h1>{title}</h1>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group" style={{ marginTop: '2rem' }}>
            <h2>Авторизация через Telegram</h2>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              {typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user
                ? '✅ Ваши данные из Telegram загружены автоматически. Подтвердите отправку в модальном окне.'
                : 'Для автоматической авторизации откройте этот сайт из Telegram. Или используйте кнопку ниже для авторизации через браузер.'}
            </p>
            
            {telegramUser && !showModal ? (
              <div style={{ padding: '1rem', background: '#e7f3ff', borderRadius: '4px' }}>
                <p style={{ marginBottom: '0.5rem' }}>
                  <strong>Авторизован:</strong> {telegramUser.first_name}
                  {telegramUser.last_name && ` ${telegramUser.last_name}`}
                </p>
                {telegramUser.username && (
                  <p>
                    <strong>Telegram:</strong>{' '}
                    <a
                      href={`https://t.me/${telegramUser.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="telegram-link"
                    >
                      @{telegramUser.username}
                    </a>
                  </p>
                )}
                {isSubmitting && (
                  <p style={{ marginTop: '1rem', color: '#666' }}>
                    Проверка данных и отправка...
                  </p>
                )}
              </div>
            ) : !showModal ? (
              <div>
                {typeof window !== 'undefined' && window.Telegram?.WebApp ? (
                  <div style={{ 
                    padding: '1.5rem', 
                    background: '#fff3cd', 
                    borderRadius: '8px',
                    border: '1px solid #ffc107',
                    textAlign: 'center'
                  }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#856404' }}>
                      ⚠️ Данные пользователя не загружены
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#856404' }}>
                      Для автоматической авторизации откройте этот сайт из Telegram через бота или меню-кнопку.
                    </p>
                  </div>
                ) : (
                  <>
                    <TelegramLogin
                      botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}
                      onAuth={handleTelegramAuth}
                      buttonSize="large"
                      cornerRadius={4}
                      requestAccess={false}
                      usePic={true}
                    />
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '1rem', 
                      background: '#e7f3ff', 
                      borderRadius: '8px',
                      border: '1px solid #0088cc'
                    }}>
                      <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#004085', fontWeight: 500 }}>
                        💡 Рекомендация
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#004085' }}>
                        Для автоматической авторизации без подтверждений откройте этот сайт из Telegram через бота или меню-кнопку.
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {telegramUser && (
        <TelegramAuthModal
          user={telegramUser}
          isOpen={showModal}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  )
}

