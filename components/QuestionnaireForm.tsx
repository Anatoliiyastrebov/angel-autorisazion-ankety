'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TelegramLogin, { TelegramUser } from './TelegramLogin'

interface QuestionnaireFormProps {
  title: string
  questionnaireType: string
}

// Вопросы для разных типов анкет
const questionnaireQuestions: Record<string, Array<{ id: string; label: string; type: 'text' | 'textarea' | 'number' | 'select'; options?: string[] }>> = {
  women: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'height', label: 'Рост (см)', type: 'number' },
    { id: 'weight', label: 'Вес (кг)', type: 'number' },
  ],
  men: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'height', label: 'Рост (см)', type: 'number' },
    { id: 'weight', label: 'Вес (кг)', type: 'number' },
  ],
  basic: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'height', label: 'Рост (см)', type: 'number' },
    { id: 'weight', label: 'Вес (кг)', type: 'number' },
  ],
  extended: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'height', label: 'Рост (см)', type: 'number' },
    { id: 'weight', label: 'Вес (кг)', type: 'number' },
  ],
}

export default function QuestionnaireForm({
  title,
  questionnaireType,
}: QuestionnaireFormProps) {
  const router = useRouter()
  const questions = questionnaireQuestions[questionnaireType] || []
  
  // Логирование для отладки
  useEffect(() => {
    console.log('📋 QuestionnaireForm loaded:', {
      questionnaireType,
      questionsCount: questions.length,
      questions: questions
    })
  }, [questionnaireType, questions.length])
  
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Получаем имя бота из переменных окружения
  const [botName, setBotName] = useState<string>('')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBotName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '')
    }
  }, [])

  // Проверяем данные из Telegram Web App при загрузке (как было раньше)
  useEffect(() => {
    if (typeof window === 'undefined') return

    let isMounted = true
    let webAppInitialized = false

    // Проверяем Telegram Web App
    const checkTelegramWebApp = () => {
      if (!isMounted) return
      
      if (!window.Telegram?.WebApp) {
        console.log('ℹ️ Telegram Web App не обнаружен')
        return
      }

      const webApp = window.Telegram.WebApp
      
      // Вызываем ready и expand только один раз
      if (!webAppInitialized) {
        try {
          webApp.ready()
          webApp.expand()
          webAppInitialized = true
        } catch (e) {
          // Игнорируем ошибки, если уже вызвано
        }
      }

      console.log('🔍 Проверка данных Telegram Web App:', {
        hasWebApp: !!window.Telegram?.WebApp,
        hasInitDataUnsafe: !!webApp.initDataUnsafe,
        hasUser: !!webApp.initDataUnsafe?.user,
        initData: webApp.initData ? 'present' : 'missing',
      })

      // Проверяем, если открыто напрямую из Telegram Web App
      if (webApp.initDataUnsafe?.user && !telegramUser && isMounted) {
        const webAppUser = webApp.initDataUnsafe.user
        const initData = webApp.initDataUnsafe

        console.log('📋 Данные пользователя из Web App:', {
          user: webAppUser,
          auth_date: initData?.auth_date,
          hash: initData?.hash ? 'present' : 'missing',
        })

        if (webAppUser && initData?.auth_date && initData?.hash && isMounted) {
          console.log('✅ Telegram Web App: загружаю данные пользователя')
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

          if (isMounted) {
            setTelegramUser(user)
            // Автоматически заполняем имя и фамилию из Telegram
            setAnswers(prev => {
              const newAnswers = { ...prev }
              if (user.first_name && !newAnswers.first_name) {
                newAnswers.first_name = user.first_name
              }
              if (user.last_name && !newAnswers.last_name) {
                newAnswers.last_name = user.last_name
              }
              return newAnswers
            })
          }
          return
        } else {
          console.warn('⚠️ Telegram Web App обнаружен, но данные пользователя неполные:', {
            hasUser: !!webAppUser,
            hasAuthDate: !!initData?.auth_date,
            hasHash: !!initData?.hash,
          })
        }
      } else if (window.Telegram?.WebApp && !webApp.initDataUnsafe?.user) {
        console.log('ℹ️ Telegram Web App detected but user data not available')
        
        // Попробуем получить данные из initData строки напрямую
        if (webApp.initData && isMounted) {
          console.log('🔍 Пытаюсь парсить initData строку:', webApp.initData.substring(0, 100))
          try {
            // Парсим initData строку (формат: key=value&key2=value2)
            const params = new URLSearchParams(webApp.initData)
            const userParam = params.get('user')
            if (userParam && isMounted) {
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
              
              if (user.id && user.first_name && isMounted) {
                setTelegramUser(user)
                setAnswers(prev => {
                  const newAnswers = { ...prev }
                  if (user.first_name && !newAnswers.first_name) {
                    newAnswers.first_name = user.first_name
                  }
                  if (user.last_name && !newAnswers.last_name) {
                    newAnswers.last_name = user.last_name
                  }
                  return newAnswers
                })
                return
              }
            }
          } catch (error) {
            console.error('❌ Ошибка при парсинге initData:', error)
          }
        }
      }
    }

    // Проверяем сразу
    checkTelegramWebApp()

    // Также проверяем после небольшой задержки, на случай если Web App еще загружается
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        checkTelegramWebApp()
      }
    }, 500)
    
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [telegramUser])

  // Обработчик успешной авторизации через Telegram Login Widget (как fallback)
  const handleTelegramAuth = (user: TelegramUser) => {
    console.log('✅ Telegram Login Widget авторизация успешна:', user)
    setTelegramUser(user)
    setError(null)
    
    // Автоматически заполняем имя и фамилию из Telegram
    setAnswers(prev => {
      const newAnswers = { ...prev }
      if (user.first_name && !newAnswers.first_name) {
        newAnswers.first_name = user.first_name
      }
      if (user.last_name && !newAnswers.last_name) {
        newAnswers.last_name = user.last_name
      }
      return newAnswers
    })
  }



  const handleInputChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleSubmit = async () => {
    // Проверяем, что все вопросы заполнены
    const unansweredQuestions = questions.filter((q) => !answers[q.id] || answers[q.id].trim() === '')
    if (unansweredQuestions.length > 0) {
      setError('Пожалуйста, заполните все вопросы')
      return
    }

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
            id: telegramUser.id,
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name || undefined,
            photo_url: telegramUser.photo_url || undefined,
            auth_date: telegramUser.auth_date || Math.floor(Date.now() / 1000),
            hash: telegramUser.hash || '',
            initData: telegramUser.initData || '',
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

          {/* Вопросы анкеты - все на одной странице */}
          {questions.length > 0 ? (
            <div style={{ marginTop: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Заполните анкету</h2>
              {questions.map((question) => (
                <div key={question.id} className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor={question.id}>
                    {question.label}
                    {!answers[question.id] && <span style={{ color: 'red' }}> *</span>}
                  </label>
                  
                  {question.type === 'number' ? (
                    <input
                      id={question.id}
                      type="number"
                      value={answers[question.id] || ''}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      id={question.id}
                      type="text"
                      value={answers[question.id] || ''}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: '2rem', padding: '2rem', background: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#856404', margin: 0, fontWeight: 500 }}>
                ⚠️ Вопросы анкеты не загружены
              </p>
              <p style={{ color: '#856404', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Тип анкеты: <strong>{questionnaireType}</strong>
              </p>
              <p style={{ color: '#856404', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Доступные типы: {Object.keys(questionnaireQuestions).join(', ')}
              </p>
            </div>
          )}

          {/* Статус авторизации Telegram */}
          {telegramUser && (
            <div className="form-group" style={{ marginTop: '2rem', padding: '1rem', background: '#d4edda', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✅</span>
                <strong style={{ color: '#155724', fontSize: '1rem' }}>Telegram подтверждён:</strong>
              </div>
              {telegramUser.username ? (
                <a
                  href={`https://t.me/${telegramUser.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="telegram-link"
                  style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 500,
                    color: '#0088cc',
                    textDecoration: 'none'
                  }}
                >
                  @{telegramUser.username}
                </a>
              ) : (
                <span style={{ color: '#666', fontSize: '1rem' }}>
                  ID: {telegramUser.id} (username не указан)
                </span>
              )}
            </div>
          )}

          {/* Блок авторизации через Telegram */}
          {!telegramUser && (
            <div className="form-group" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
              <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Авторизация через Telegram</h2>
              
              {/* Если открыто из Telegram Web App, показываем сообщение */}
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
                  <p style={{ fontSize: '0.9rem', color: '#856404', marginBottom: '1.5rem' }}>
                    Для автоматической авторизации откройте этот сайт из Telegram через бота или меню-кнопку.
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#856404' }}>
                    Или используйте кнопку ниже для авторизации через Telegram Login Widget.
                  </p>
                </div>
              ) : (
                <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#666', textAlign: 'center' }}>
                  Для отправки анкеты необходимо авторизоваться через Telegram. Нажмите кнопку ниже.
                </p>
              )}
              
              {/* Telegram Login Widget как fallback */}
              {botName ? (
                <TelegramLogin
                  botName={botName}
                  onAuth={handleTelegramAuth}
                  buttonSize="large"
                  requestAccess={false}
                />
              ) : (
                <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', color: '#856404', textAlign: 'center' }}>
                  ⚠️ Ошибка: имя бота не настроено. Проверьте переменную окружения NEXT_PUBLIC_TELEGRAM_BOT_NAME
                </div>
              )}
            </div>
          )}

          {/* Кнопка отправки */}
          {questions.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              {telegramUser ? (
                <button
                  className="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || questions.some(q => !answers[q.id] || answers[q.id].trim() === '')}
                  style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
                </button>
              ) : (
                <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: '#856404', margin: 0, fontWeight: 500 }}>
                    ⚠️ Для отправки анкеты необходимо авторизоваться через Telegram
                  </p>
                  <p style={{ color: '#856404', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    Нажмите кнопку "Войти через Telegram" выше
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
