'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TelegramUser } from './TelegramLogin'

interface QuestionnaireFormProps {
  title: string
  questionnaireType: string
}

// Вопросы для разных типов анкет - личные данные
const questionnaireQuestions: Record<string, Array<{ id: string; label: string; type: 'text' | 'textarea' | 'number' | 'select'; options?: string[] }>> = {
  baby: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'age', label: 'Возраст (месяцы)', type: 'number' },
    { id: 'date_of_birth', label: 'Дата рождения', type: 'text' },
    { id: 'phone', label: 'Телефон родителя', type: 'text' },
    { id: 'address', label: 'Адрес проживания', type: 'textarea' },
    { id: 'parent_name', label: 'Имя родителя/опекуна', type: 'text' },
  ],
  child: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'age', label: 'Возраст (лет)', type: 'number' },
    { id: 'date_of_birth', label: 'Дата рождения', type: 'text' },
    { id: 'phone', label: 'Телефон', type: 'text' },
    { id: 'address', label: 'Адрес проживания', type: 'textarea' },
    { id: 'school', label: 'Школа/Учебное заведение', type: 'text' },
    { id: 'parent_name', label: 'Имя родителя/опекуна', type: 'text' },
  ],
  women: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'age', label: 'Возраст', type: 'number' },
    { id: 'date_of_birth', label: 'Дата рождения', type: 'text' },
    { id: 'phone', label: 'Телефон', type: 'text' },
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'address', label: 'Адрес проживания', type: 'textarea' },
    { id: 'height', label: 'Рост (см)', type: 'number' },
    { id: 'weight', label: 'Вес (кг)', type: 'number' },
  ],
  men: [
    { id: 'first_name', label: 'Имя', type: 'text' },
    { id: 'last_name', label: 'Фамилия', type: 'text' },
    { id: 'age', label: 'Возраст', type: 'number' },
    { id: 'date_of_birth', label: 'Дата рождения', type: 'text' },
    { id: 'phone', label: 'Телефон', type: 'text' },
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'address', label: 'Адрес проживания', type: 'textarea' },
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
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Загружаем данные пользователя из localStorage при загрузке
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Получаем данные из localStorage
    const savedUser = localStorage.getItem('telegram_user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        if (user.id && user.first_name) {
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
        } else {
          // Если данные невалидны, перенаправляем на главную
          router.push('/')
        }
      } catch (e) {
        localStorage.removeItem('telegram_user')
        router.push('/')
      }
    } else {
      // Если пользователь не авторизован, перенаправляем на главную
      router.push('/')
    }

    setIsLoading(false)
  }, [router])

  // Также проверяем Telegram Web App для обновления данных
  useEffect(() => {
    if (typeof window === 'undefined' || !telegramUser) return

    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      
      try {
        webApp.ready()
        webApp.expand()
      } catch (e) {
        // Игнорируем ошибки
      }

      // Обновляем данные из Web App, если они есть
      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      if (webAppUser && initData?.auth_date && initData?.hash) {
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
        
        // Обновляем данные
        setTelegramUser(user)
        localStorage.setItem('telegram_user', JSON.stringify(user))
        
        // Обновляем автозаполнение
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

    // Проверяем, что пользователь авторизован
    if (!telegramUser) {
      setError('Ошибка авторизации. Пожалуйста, вернитесь на главную страницу и авторизуйтесь.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    console.log('🟡 Отправка анкеты...', {
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

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">
          <h1>{title}</h1>
          <p style={{ color: '#666', marginTop: '1rem', textAlign: 'center' }}>
            Загрузка...
          </p>
        </div>
      </div>
    )
  }

  if (!telegramUser) {
    return null // Будет перенаправление на главную
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1>{title}</h1>
          <div style={{ 
            padding: '0.5rem 1rem', 
            background: '#d4edda', 
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            fontSize: '0.9rem',
            color: '#155724'
          }}>
            ✅ {telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Вопросы анкеты */}
        {questions.length > 0 ? (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Заполните анкету</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#666' }}>
              Данные из Telegram автоматически заполнены. Проверьте и дополните информацию.
            </p>
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
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                ) : question.type === 'textarea' ? (
                  <textarea
                    id={question.id}
                    value={answers[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required
                    rows={3}
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                ) : (
                  <input
                    id={question.id}
                    type="text"
                    value={answers[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
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
          </div>
        )}

        {/* Кнопка отправки */}
        {questions.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <button
              className="button"
              onClick={handleSubmit}
              disabled={isSubmitting || questions.some(q => !answers[q.id] || answers[q.id].trim() === '')}
              style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
            >
              {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666', textAlign: 'center' }}>
              Анкета будет отправлена в группу Telegram через бота
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
