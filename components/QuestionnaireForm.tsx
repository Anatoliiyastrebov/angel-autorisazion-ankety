'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [telegramUser, setTelegramUser] = useState<any | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Проверяем данные из localStorage (после подтверждения в Web App)
  useEffect(() => {
    if (typeof window !== 'undefined' && !telegramUser) {
      // Проверяем параметр auth=confirmed из URL
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('auth') === 'confirmed') {
        const savedUser = localStorage.getItem('telegram_user')
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser)
            setTelegramUser(user)
            // Заполняем имя и фамилию из Telegram, если они есть
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
            // Очищаем параметр из URL
            window.history.replaceState({}, '', window.location.pathname)
          } catch (error) {
            console.error('Error parsing saved user data:', error)
          }
        }
      }

      // Также проверяем, если открыто напрямую из Telegram Web App
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const webApp = window.Telegram.WebApp
        webApp.ready()
        webApp.expand()

        const webAppUser = webApp.initDataUnsafe.user
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

          setTelegramUser(user)
          // Заполняем имя и фамилию из Telegram
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
      }
    }
  }, [telegramUser])



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
          {questions.length > 0 && (
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
          )}

          {/* Поле для связи (Telegram username) */}
          {telegramUser && (
            <div className="form-group" style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <label>
                <strong>Способ связи (Telegram):</strong>
              </label>
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                {telegramUser.username ? (
                  <a
                    href={`https://t.me/${telegramUser.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="telegram-link"
                    style={{ fontSize: '1rem' }}
                  >
                    @{telegramUser.username}
                  </a>
                ) : (
                  <span style={{ color: '#666' }}>Username не указан</span>
                )}
              </div>
            </div>
          )}

          {/* Кнопка отправки */}
          {questions.length > 0 && telegramUser && (
            <div style={{ marginTop: '2rem' }}>
              <button
                className="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ width: '100%' }}
              >
                {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
              </button>
            </div>
          )}

          {/* Блок авторизации через Telegram */}
          {!telegramUser && (
            <div className="form-group" style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
              <h2>Авторизация через Telegram</h2>
              
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
                    <a
                      href={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/confirm?type=${questionnaireType}`}
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
                      🔵 Авторизоваться через Telegram
                    </a>
                    <div style={{ 
                      padding: '1rem', 
                      background: '#e7f3ff', 
                      borderRadius: '8px',
                      border: '1px solid #0088cc',
                      marginTop: '1rem'
                    }}>
                      <p style={{ fontSize: '0.9rem', color: '#004085', textAlign: 'center', margin: 0 }}>
                        💡 <strong>Инструкция:</strong> Нажмите кнопку выше для авторизации в Telegram. После подтверждения вы вернетесь на сайт для заполнения анкеты.
                      </p>
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
                      Для автоматической авторизации откройте этот сайт из Telegram через бота. Ваши данные из Telegram будут использованы для связи с вами.
                    </p>
                    <a
                      href={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/confirm?type=${questionnaireType}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{ 
                        display: 'block', 
                        marginBottom: '1.5rem',
                        textDecoration: 'none',
                        textAlign: 'center',
                        width: '100%'
                      }}
                    >
                      🔵 Авторизоваться через Telegram
                    </a>
                    <div style={{ 
                      padding: '1rem', 
                      background: '#e7f3ff', 
                      borderRadius: '8px',
                      border: '1px solid #0088cc'
                    }}>
                      <p style={{ fontSize: '0.9rem', color: '#004085', textAlign: 'center', margin: 0, marginBottom: '0.5rem' }}>
                        💡 <strong>Инструкция:</strong>
                      </p>
                      <ol style={{ fontSize: '0.85rem', color: '#004085', textAlign: 'left', margin: 0, paddingLeft: '1.5rem' }}>
                        <li>Нажмите кнопку выше для авторизации в Telegram</li>
                        <li>Подтвердите авторизацию в Telegram</li>
                        <li>Вернитесь на сайт для заполнения анкеты</li>
                        <li>Ваши данные из Telegram будут использованы для связи</li>
                      </ol>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
        </div>
      </div>
    </>
  )
}
