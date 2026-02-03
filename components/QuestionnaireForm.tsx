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
    const checkWebApp = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const webAppUser = window.Telegram.WebApp.initDataUnsafe.user
        const initData = window.Telegram.WebApp.initDataUnsafe
        const initDataString = window.Telegram.WebApp.initData // Оригинальная строка
        
        if (webAppUser && initData.auth_date && initData.hash) {
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
          
          // Показываем модальное окно с данными пользователя
          setTelegramUser(user)
          setShowModal(true)
        }
      }
    }

    // Проверяем сразу
    checkWebApp()

    // Также проверяем через небольшую задержку на случай, если скрипт загружается
    const timer = setTimeout(checkWebApp, 500)

    return () => clearTimeout(timer)
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
                ? 'Ваши данные из Telegram загружены. Подтвердите отправку.'
                : 'Авторизуйтесь через Telegram, чтобы отправить ваши данные. Мы свяжемся с вами в Telegram.'}
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
                <TelegramLogin
                  botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}
                  onAuth={handleTelegramAuth}
                  buttonSize="large"
                  cornerRadius={4}
                  requestAccess={false}
                  usePic={true}
                />
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                  Нажмите кнопку выше, чтобы войти через Telegram
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#999', textAlign: 'center' }}>
                  Или откройте сайт из Telegram для автоматической авторизации
                </p>
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

