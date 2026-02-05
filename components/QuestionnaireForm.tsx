'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function QuestionnaireFormContent({
  title,
  questionnaireType,
}: QuestionnaireFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const questions = questionnaireQuestions[questionnaireType] || []
  
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botName, setBotName] = useState<string>('')

  // Загружаем имя бота
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBotName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '')
    }
  }, [])

  // Загружаем данные пользователя из localStorage при загрузке
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Сначала проверяем Web App (если открыто через Menu Button)
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
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
        
        setTelegramUser(user)
        localStorage.setItem('telegram_user', JSON.stringify(user))
        
        // Автоматически заполняем данные
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

    // Проверяем параметр авторизации из URL (возврат после авторизации через бота)
    const authConfirmed = searchParams.get('auth')
    if (authConfirmed === 'confirmed') {
      console.log('✅ Авторизация подтверждена, загружаем данные пользователя...')
      loadUserData()
      // Очищаем параметр из URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else {
      loadUserData()
    }
  }, [searchParams])

  // Периодическая проверка данных пользователя (если страница остается открытой)
  useEffect(() => {
    if (typeof window === 'undefined' || telegramUser) return

    // Проверяем данные каждые 2 секунды, если пользователь еще не авторизован
    const checkInterval = setInterval(() => {
      const savedUser = localStorage.getItem('telegram_user')
      if (savedUser && !telegramUser) {
        console.log('🔄 Автоматическая проверка: данные пользователя найдены!')
        try {
          const user = JSON.parse(savedUser)
          if (user.id && user.first_name) {
            console.log('✅ Автоматическая загрузка данных пользователя:', user)
            setTelegramUser(user)
            
            // Автоматически заполняем данные
            setAnswers(prev => {
              const newAnswers = { ...prev }
              if (user.first_name && !newAnswers.first_name) {
                newAnswers.first_name = user.first_name
                console.log('✅ Автозаполнение: имя =', user.first_name)
              }
              if (user.last_name && !newAnswers.last_name) {
                newAnswers.last_name = user.last_name
                console.log('✅ Автозаполнение: фамилия =', user.last_name)
              }
              return newAnswers
            })
            
            // Останавливаем проверку
            clearInterval(checkInterval)
          }
        } catch (e) {
          console.error('❌ Ошибка при автоматической загрузке данных:', e)
        }
      }
    }, 2000) // Проверяем каждые 2 секунды

    // Останавливаем проверку через 5 минут (чтобы не проверять бесконечно)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      console.log('⏰ Автоматическая проверка данных остановлена (таймаут 5 минут)')
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
    }
  }, [telegramUser])

  const loadUserData = () => {
    console.log('🔍 Загрузка данных пользователя из localStorage...')
    const savedUser = localStorage.getItem('telegram_user')
    const savedQuestionnaireType = localStorage.getItem('questionnaire_type')
    
    // Проверяем, что тип анкеты совпадает
    if (savedQuestionnaireType && savedQuestionnaireType !== questionnaireType) {
      console.warn('⚠️ Тип анкеты не совпадает:', {
        сохраненный: savedQuestionnaireType,
        текущий: questionnaireType
      })
      // Можно показать предупреждение или перенаправить на правильную анкету
    }
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        console.log('🔍 Распарсенные данные пользователя:', {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          hasId: !!user.id,
          hasFirstName: !!user.first_name,
          hasHash: !!user.hash,
          hasInitData: !!user.initData
        })
        
        // Валидация данных пользователя
        if (!user.id || !user.first_name) {
          console.error('❌ ОШИБКА: Неполные данные пользователя')
          console.error('❌ ID:', user.id, 'Имя:', user.first_name)
          localStorage.removeItem('telegram_user')
          return
        }
        
        // Проверка auth_date (данные не должны быть старше 24 часов)
        if (user.auth_date) {
          const currentTime = Math.floor(Date.now() / 1000)
          const authDate = user.auth_date
          if (currentTime - authDate > 86400) {
            console.error('❌ ОШИБКА: Данные авторизации устарели (старше 24 часов)')
            localStorage.removeItem('telegram_user')
            return
          }
        }
        
        console.log('✅ Валидация данных пользователя пройдена')
        console.log('✅ Данные пользователя загружены из localStorage:', user)
        setTelegramUser(user)
        
        // Автоматически заполняем имя и фамилию из Telegram
        setAnswers(prev => {
          const newAnswers = { ...prev }
          if (user.first_name && !newAnswers.first_name) {
            newAnswers.first_name = user.first_name
            console.log('✅ Автозаполнение: имя =', user.first_name)
          }
          if (user.last_name && !newAnswers.last_name) {
            newAnswers.last_name = user.last_name
            console.log('✅ Автозаполнение: фамилия =', user.last_name)
          }
          return newAnswers
        })
      } catch (e) {
        console.error('❌ Ошибка при парсинге данных пользователя:', e)
        console.error('❌ Сырые данные:', savedUser)
        localStorage.removeItem('telegram_user')
      }
    } else {
      console.log('ℹ️ Данные пользователя не найдены в localStorage')
      console.log('🔍 Все ключи в localStorage:', Object.keys(localStorage))
    }
  }

  // Обработчик авторизации через Telegram
  const handleTelegramAuth = (user: TelegramUser) => {
    console.log('✅ Telegram авторизация успешна:', user)
    setTelegramUser(user)
    setError(null)
    
    // Автоматически заполняем данные из Telegram
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

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ marginBottom: '2rem' }}>{title}</h1>

        {error && <div className="error-message">{error}</div>}

        {/* Статус авторизации */}
        {telegramUser && (
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            background: '#d4edda', 
            borderRadius: '8px',
            border: '1px solid #c3e6cb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <strong style={{ color: '#155724', fontSize: '1rem' }}>Telegram подтверждён:</strong>
            </div>
            {telegramUser.username ? (
              <span style={{ color: '#155724', fontSize: '1rem' }}>
                @{telegramUser.username}
              </span>
            ) : (
              <span style={{ color: '#155724', fontSize: '1rem' }}>
                {telegramUser.first_name} {telegramUser.last_name || ''}
              </span>
            )}
          </div>
        )}

        {/* Вопросы анкеты */}
        {questions.length > 0 ? (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Заполните анкету</h2>
            {telegramUser && (
              <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#666' }}>
                Данные из Telegram автоматически заполнены. Проверьте и дополните информацию.
              </p>
            )}
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

        {/* Блок авторизации через Telegram (в конце формы) */}
        {!telegramUser && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '2rem', 
            background: '#e7f3ff', 
            borderRadius: '8px',
            border: '2px solid #0088cc'
          }}>
            <h3 style={{ marginBottom: '1rem', textAlign: 'center', color: '#0088cc' }}>
              🔐 Авторизация через Telegram
            </h3>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: '#666', textAlign: 'center' }}>
              Для отправки анкеты необходимо авторизоваться через Telegram. 
              После авторизации данные из Telegram автоматически заполнятся в анкете.
            </p>
            
            {botName ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={() => {
                    // Сохраняем текущий URL анкеты и тип анкеты для возврата после авторизации
                    if (typeof window !== 'undefined') {
                      // Получаем текущий URL без параметра auth=confirmed (если он есть)
                      const currentPath = window.location.pathname
                      const currentSearch = window.location.search
                        .replace(/[?&]auth=confirmed/g, '')
                        .replace(/^&/, '?')
                        .replace(/^$/, '')
                      
                      const currentUrl = currentPath + (currentSearch || '')
                      
                      // Сохраняем URL анкеты
                      localStorage.setItem('return_url', currentUrl)
                      
                      // Сохраняем тип анкеты для проверки
                      localStorage.setItem('questionnaire_type', questionnaireType)
                      
                      console.log('💾 Сохранены данные для возврата:', {
                        url: currentUrl,
                        questionnaireType: questionnaireType
                      })
                    }
                    
                    // ВСЕГДА открываем бота - только через Menu Button в боте можно получить данные Telegram
                    // Страница /auth/confirm работает только как Web App из бота
                    const botUrl = `https://t.me/${botName}`
                    console.log('🔗 Открываем бота для авторизации:', botUrl)
                    console.log('ℹ️ После открытия бота нажмите кнопку "Авторизоваться" внизу экрана')
                    
                    // Открываем бота в новой вкладке (текущая остается открытой)
                    window.open(botUrl, '_blank', 'noopener,noreferrer')
                    
                    // Показываем инструкцию
                    alert('1. Откроется Telegram бот\n2. Нажмите кнопку "Авторизоваться" внизу экрана (Menu Button)\n3. Подтвердите авторизацию\n4. Вернитесь на эту страницу - данные загрузятся автоматически')
                  }}
                  style={{
                    padding: '1rem 2rem',
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    background: '#0088cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>🤖</span>
                  <span>Авторизоваться через Telegram</span>
                </button>
              </div>
            ) : (
              <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', color: '#856404', textAlign: 'center' }}>
                ⚠️ Имя бота не настроено. Проверьте переменную окружения NEXT_PUBLIC_TELEGRAM_BOT_NAME
              </div>
            )}
          </div>
        )}

        {/* Кнопка отправки (только если авторизован) */}
        {questions.length > 0 && telegramUser && (
          <div style={{ marginTop: '2rem' }}>
            <button
              className="button"
              onClick={handleSubmit}
              disabled={isSubmitting || questions.some(q => !answers[q.id] || answers[q.id].trim() === '')}
              style={{ 
                width: '100%', 
                fontSize: '1.1rem', 
                padding: '1rem',
                background: isSubmitting || questions.some(q => !answers[q.id] || answers[q.id].trim() === '') 
                  ? '#ccc' 
                  : '#28a745',
                cursor: isSubmitting || questions.some(q => !answers[q.id] || answers[q.id].trim() === '') 
                  ? 'not-allowed' 
                  : 'pointer'
              }}
            >
              {isSubmitting ? 'Отправка...' : 'Отправить анкету'}
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666', textAlign: 'center' }}>
              Анкета будет отправлена в группу Telegram через бота
            </p>
          </div>
        )}

        {/* Сообщение, если не авторизован */}
        {questions.length > 0 && !telegramUser && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: '#fff3cd', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#856404', margin: 0, fontWeight: 500 }}>
              ⚠️ Для отправки анкеты необходимо авторизоваться через Telegram
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuestionnaireForm(props: QuestionnaireFormProps) {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card">
          <h1>{props.title}</h1>
          <p style={{ color: '#666', marginTop: '1rem', textAlign: 'center' }}>
            Загрузка...
          </p>
        </div>
      </div>
    }>
      <QuestionnaireFormContent {...props} />
    </Suspense>
  )
}
