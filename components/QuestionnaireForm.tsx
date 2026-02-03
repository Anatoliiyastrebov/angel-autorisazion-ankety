'use client'

import { useState, useEffect } from 'react'
import TelegramLogin, { TelegramUser } from './TelegramLogin'
import SimpleTelegramAuth, { SimpleTelegramUser } from './SimpleTelegramAuth'
import { useRouter } from 'next/navigation'

interface QuestionnaireFormProps {
  title: string
  questionnaireType: string
}

// Вопросы для разных типов анкет (пока пусто)
const questionnaireQuestions: Record<string, Array<{ id: string; label: string; type: 'text' | 'textarea' | 'number' | 'select'; options?: string[] }>> = {
  women: [],
  men: [],
  basic: [],
  extended: [],
}

export default function QuestionnaireForm({
  title,
  questionnaireType,
}: QuestionnaireFormProps) {
  const router = useRouter()
  const questions = questionnaireQuestions[questionnaireType] || []
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [telegramUser, setTelegramUser] = useState<TelegramUser | SimpleTelegramUser | null>(null)
  const [useSimpleAuth, setUseSimpleAuth] = useState(false)
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
        
        // Автоматически сохраняем данные пользователя (без показа модального окна)
        setTelegramUser(user)
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
    
    // Сохраняем данные пользователя (без проверки hash, так как проверки убраны)
    setTelegramUser(user)
    setError(null)
    console.log('✅ Telegram авторизация успешна:', user.first_name, user.username)
  }

  const handleSimpleAuth = (user: SimpleTelegramUser) => {
    console.log('🟢 Simple auth called with user:', user)
    setTelegramUser(user)
    setError(null)
    setUseSimpleAuth(false)
    console.log('✅ Простая авторизация успешна:', user.first_name, user.username)
  }


  const handleSubmit = async () => {
    // Проверяем, что пользователь авторизован через Telegram
    if (!telegramUser) {
      setError('Пожалуйста, авторизуйтесь через Telegram перед отправкой анкеты')
      return
    }

    setIsSubmitting(true)
    setError(null)

    console.log('🟡 Submitting questionnaire data...', {
      questionnaireType,
      answers,
      userId: telegramUser.id,
      username: telegramUser.username,
    })

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionnaireType,
          answers: answers || {},
          telegram: {
            id: typeof telegramUser.id === 'number' ? telegramUser.id : parseInt(telegramUser.id.replace('temp_', '')) || Date.now(),
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name || undefined,
            photo_url: 'photo_url' in telegramUser ? telegramUser.photo_url : undefined,
            auth_date: 'auth_date' in telegramUser ? telegramUser.auth_date : Math.floor(Date.now() / 1000),
            hash: 'hash' in telegramUser ? telegramUser.hash || '' : '',
            initData: 'initData' in telegramUser ? telegramUser.initData || '' : '',
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
          telegramUser.username || ''
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

          {/* Информация об анкете */}
          <div style={{ marginTop: '1rem', marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#666', textAlign: 'center' }}>
              Анкета пока без вопросов. Авторизуйтесь через Telegram для отправки данных.
            </p>
          </div>

          {/* Блок авторизации через Telegram */}
          <div className="form-group" style={{ marginTop: '2rem' }}>
            <h2>Авторизация через Telegram</h2>
            
            {telegramUser ? (
              <div style={{ padding: '1.5rem', background: '#e7f3ff', borderRadius: '8px', border: '1px solid #0088cc', marginBottom: '2rem' }}>
                <p style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                  <strong>✅ Авторизован:</strong> {telegramUser.first_name}
                  {telegramUser.last_name && ` ${telegramUser.last_name}`}
                </p>
                {telegramUser.username && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Telegram:</strong>{' '}
                    <a
                      href={`https://t.me/${telegramUser.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="telegram-link"
                      style={{ fontSize: '1rem' }}
                    >
                      @{telegramUser.username}
                    </a>
                  </p>
                )}
                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    className="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{ width: '100%' }}
                  >
                    {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
                  </button>
                </div>
              </div>
            ) : useSimpleAuth ? (
              <div>
                <SimpleTelegramAuth onAuth={handleSimpleAuth} />
                <button
                  className="button button-secondary"
                  onClick={() => setUseSimpleAuth(false)}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  Вернуться к авторизации через Telegram
                </button>
              </div>
            ) : (
              <div>
                {typeof window !== 'undefined' && window.Telegram?.WebApp ? (
                  <div style={{ 
                    padding: '1.5rem', 
                    background: '#fff3cd', 
                    borderRadius: '8px',
                    border: '1px solid #ffc107',
                    textAlign: 'center'
                  }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#856404', fontSize: '1rem' }}>
                      ⚠️ Данные пользователя не загружены
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#856404', marginBottom: '1rem' }}>
                      Для автоматической авторизации откройте этот сайт из Telegram через бота или меню-кнопку.
                    </p>
                    <a
                      href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{ 
                        display: 'inline-block', 
                        marginBottom: '1rem',
                        textDecoration: 'none',
                        width: '100%'
                      }}
                    >
                      🔵 Войти через Telegram
                    </a>
                    <p style={{ fontSize: '0.9rem', color: '#856404', fontWeight: 500, marginBottom: '1rem' }}>
                      Или используйте кнопку ниже для авторизации через Telegram Login Widget.
                    </p>
                    <div style={{ marginTop: '1rem' }}>
                      <TelegramLogin
                        botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}
                        onAuth={handleTelegramAuth}
                        buttonSize="large"
                        cornerRadius={4}
                        requestAccess={false}
                        usePic={true}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    padding: '1.5rem', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px solid #dee2e6'
                  }}>
                    <p style={{ marginBottom: '1rem', color: '#333', fontSize: '1rem', textAlign: 'center' }}>
                      <strong>Для отправки анкеты необходимо авторизоваться через Telegram</strong>
                    </p>
                    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                      Нажмите кнопку ниже, чтобы войти через Telegram. Ваши данные из Telegram будут использованы для связи с вами.
                    </p>
                    <a
                      href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{ 
                        display: 'block', 
                        marginBottom: '1rem',
                        textDecoration: 'none',
                        textAlign: 'center',
                        width: '100%'
                      }}
                    >
                      🔵 Войти через Telegram
                    </a>
                    <p style={{ fontSize: '0.85rem', color: '#999', textAlign: 'center', fontStyle: 'italic', marginBottom: '1rem' }}>
                      💡 Или используйте виджет ниже для авторизации через браузер
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                      <TelegramLogin
                        botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'telega_automat_bot'}
                        onAuth={handleTelegramAuth}
                        buttonSize="large"
                        cornerRadius={4}
                        requestAccess={false}
                        usePic={true}
                      />
                    </div>
                    <button
                      className="button button-secondary"
                      onClick={() => setUseSimpleAuth(true)}
                      style={{ width: '100%' }}
                    >
                      Или введите данные вручную
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
