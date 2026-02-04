'use client'

/// <reference path="../../telegram-webapp.d.ts" />

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TelegramUser } from '@/components/TelegramLogin'

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userData, setUserData] = useState<TelegramUser | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    // Сохраняем URL для возврата, если его еще нет (на случай открытия через Menu Button напрямую)
    if (typeof window !== 'undefined') {
      const referrer = document.referrer
      const currentReturnUrl = localStorage.getItem('return_url')
      
      // Если return_url не сохранен, пытаемся определить его из referrer
      if (!currentReturnUrl && referrer) {
        try {
          const referrerUrl = new URL(referrer)
          // Если referrer с того же домена и это не страница авторизации, сохраняем его
          if (referrerUrl.origin === window.location.origin && 
              !referrerUrl.pathname.includes('/auth/')) {
            localStorage.setItem('return_url', referrerUrl.pathname + referrerUrl.search)
            console.log('💾 Сохранен URL из referrer для возврата:', referrerUrl.pathname + referrerUrl.search)
          }
        } catch (e) {
          console.warn('⚠️ Не удалось распарсить referrer:', e)
        }
      }
      
      // Если все еще нет return_url, используем главную страницу как fallback
      if (!localStorage.getItem('return_url')) {
        localStorage.setItem('return_url', '/')
        console.log('💾 Установлен fallback URL (главная страница)')
      }
    }

    // Проверяем, открыто ли из Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()

      // Приоритет 1: Данные из Web App (основной способ при открытии через Menu Button)
      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      console.log('🔍 Проверка данных Web App:', {
        hasWebApp: !!webApp,
        hasUser: !!webAppUser,
        hasInitData: !!initData,
        user: webAppUser ? {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          username: webAppUser.username
        } : null
      })

      if (webAppUser && initData?.auth_date && initData?.hash) {
        console.log('✅ Данные пользователя найдены в Web App')
        
        // Валидация данных пользователя
        if (!webAppUser.id || !webAppUser.first_name) {
          console.error('❌ ОШИБКА: Неполные данные пользователя из Web App')
          console.error('❌ ID:', webAppUser.id, 'Имя:', webAppUser.first_name)
          return
        }
        
        // Проверка auth_date (данные не должны быть старше 24 часов)
        const currentTime = Math.floor(Date.now() / 1000)
        const authDate = initData.auth_date
        if (currentTime - authDate > 86400) {
          console.error('❌ ОШИБКА: Данные авторизации устарели (старше 24 часов)')
          console.error('❌ Текущее время:', currentTime, 'Время авторизации:', authDate)
          return
        }
        
        // Проверка hash (базовая проверка наличия)
        if (!initData.hash || initData.hash.length === 0) {
          console.error('❌ ОШИБКА: Hash отсутствует или пустой')
          return
        }
        
        // Проверка initData строки
        if (!webApp.initData || webApp.initData.length === 0) {
          console.error('❌ ОШИБКА: initData строка отсутствует или пустая')
          return
        }
        
        console.log('✅ Валидация данных пройдена:', {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          hasHash: !!initData.hash,
          hasInitData: !!webApp.initData,
          authDate: authDate,
          age: currentTime - authDate
        })
        
        const user: TelegramUser = {
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          last_name: webAppUser.last_name || undefined,
          username: webAppUser.username || undefined,
          photo_url: webAppUser.photo_url || undefined,
          auth_date: initData.auth_date,
          hash: initData.hash,
          initData: webApp.initData,
        }

        // СРАЗУ сохраняем данные в localStorage при обнаружении
        console.log('💾 Сохранение данных пользователя в localStorage (при обнаружении Web App)...')
        localStorage.setItem('telegram_user', JSON.stringify(user))
        
        // Проверяем сохранение
        const saved = localStorage.getItem('telegram_user')
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed.id === user.id && parsed.first_name === user.first_name) {
              console.log('✅ Данные успешно сохранены и проверены в localStorage')
            } else {
              console.error('❌ ОШИБКА: Сохраненные данные не совпадают с исходными')
            }
          } catch (e) {
            console.error('❌ ОШИБКА: Не удалось распарсить сохраненные данные:', e)
          }
        } else {
          console.error('❌ ОШИБКА: Не удалось сохранить данные в localStorage')
        }

        setUserData(user)
        setIsAuthorized(true)
      } 
      // Приоритет 2: Данные из параметров URL (для обратной совместимости)
      else {
        const token = searchParams.get('token')
        const userId = searchParams.get('user_id')
        
        if (token && userId) {
          console.log('📡 Получение данных пользователя через API')
          fetchUserData(token, userId)
        } else {
          console.warn('⚠️ Нет данных для авторизации. Убедитесь, что открыто через Menu Button бота.')
        }
      }
    } else {
      console.warn('⚠️ Web App не обнаружен. Убедитесь, что открыто через Telegram бота.')
    }
  }, [searchParams])

  const fetchUserData = async (token: string, userId: string) => {
    try {
      const response = await fetch(`/api/auth/get-user?token=${token}&user_id=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to get user data')
      }

      const userData = await response.json()

      const user: TelegramUser = {
        id: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        photo_url: userData.photo_url,
        auth_date: Math.floor(Date.now() / 1000),
        hash: '',
        initData: '',
      }

      setUserData(user)
      setIsAuthorized(true)
    } catch (error) {
      console.error('❌ Ошибка при получении данных пользователя:', error)
    }
  }

  const handleConfirm = async () => {
    if (!userData) return

    setIsConfirming(true)

    try {
      // Сохраняем данные в localStorage (если еще не сохранены)
      console.log('💾 Сохранение данных пользователя в localStorage:', userData)
      const existingData = localStorage.getItem('telegram_user')
      
      if (!existingData) {
        localStorage.setItem('telegram_user', JSON.stringify(userData))
        console.log('💾 Данные сохранены в localStorage')
      } else {
        console.log('ℹ️ Данные уже есть в localStorage, обновляем...')
        localStorage.setItem('telegram_user', JSON.stringify(userData))
      }
      
      // Проверяем, что данные сохранились
      const saved = localStorage.getItem('telegram_user')
      if (!saved) {
        throw new Error('Не удалось сохранить данные')
      }
      
      // Парсим сохраненные данные для проверки
      try {
        const parsed = JSON.parse(saved)
        console.log('✅ Данные успешно сохранены в localStorage:', {
          id: parsed.id,
          first_name: parsed.first_name,
          username: parsed.username
        })
      } catch (e) {
        console.error('❌ Ошибка при проверке сохраненных данных:', e)
      }

      // Получаем URL для возврата и тип анкеты из localStorage
      const returnUrl = typeof window !== 'undefined' 
        ? localStorage.getItem('return_url') 
        : null
      const savedQuestionnaireType = typeof window !== 'undefined'
        ? localStorage.getItem('questionnaire_type')
        : null
      
      console.log('🔍 Проверка данных в localStorage:', {
        return_url: returnUrl,
        questionnaire_type: savedQuestionnaireType,
        telegram_user: localStorage.getItem('telegram_user') ? 'есть' : 'нет'
      })
      
      // Валидация сохраненного URL
      let validReturnUrl = returnUrl
      if (returnUrl) {
        // Проверяем, что URL валидный (начинается с /)
        if (!returnUrl.startsWith('/')) {
          console.warn('⚠️ Некорректный return_url, используем главную страницу')
          validReturnUrl = '/'
        }
        
        // Проверяем, что это не страница авторизации
        if (returnUrl.includes('/auth/')) {
          console.warn('⚠️ return_url указывает на страницу авторизации, используем главную')
          validReturnUrl = '/'
        }
      }
      
      // Если есть сохраненный URL, возвращаемся на него, иначе на главную
      // Убираем параметр auth=confirmed из URL, если он там есть, и добавляем заново
      let cleanReturnUrl = validReturnUrl || '/'
      if (cleanReturnUrl.includes('auth=confirmed')) {
        cleanReturnUrl = cleanReturnUrl.replace(/[?&]auth=confirmed/g, '').replace(/^&/, '?')
      }
      
      const redirectUrl = `${cleanReturnUrl}${cleanReturnUrl.includes('?') ? '&' : '?'}auth=confirmed`
      
      console.log('🔗 Исходный URL для возврата:', returnUrl || 'главная страница')
      console.log('🔗 Валидированный URL:', validReturnUrl || 'главная страница')
      console.log('🔗 Очищенный URL:', cleanReturnUrl)
      console.log('🔗 Полный URL редиректа:', redirectUrl)
      console.log('🔗 Тип анкеты для проверки:', savedQuestionnaireType)
      
      // Очищаем сохраненные данные из localStorage ПОСЛЕ использования
      if (typeof window !== 'undefined') {
        // Не удаляем сразу, дадим время на редирект
        setTimeout(() => {
          if (returnUrl) {
            localStorage.removeItem('return_url')
            console.log('🗑️ return_url удален из localStorage')
          }
          if (savedQuestionnaireType) {
            localStorage.removeItem('questionnaire_type')
            console.log('🗑️ questionnaire_type удален из localStorage')
          }
        }, 2000)
      }
      
      // Если открыто в Telegram Web App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp
        
        // Показываем уведомление об успехе
        webApp.showAlert('✅ Авторизация успешна! Возвращаемся обратно в анкету.', () => {
          // Дополнительная проверка сохранения данных перед редиректом
          const finalCheck = localStorage.getItem('telegram_user')
          if (!finalCheck) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Данные не найдены в localStorage перед редиректом!')
            // Пытаемся сохранить еще раз
            localStorage.setItem('telegram_user', JSON.stringify(userData))
            console.log('💾 Попытка повторного сохранения данных...')
          } else {
            console.log('✅ Финальная проверка: данные в localStorage присутствуют')
          }
          
          // Если есть return_url, возвращаемся на него, иначе на главную
          if (returnUrl) {
            // Возвращаемся на страницу анкеты (она должна быть открыта)
            const siteUrl = `${window.location.origin}${redirectUrl}`
            console.log('🔗 Возвращаемся на страницу анкеты:', siteUrl)
            webApp.openLink(siteUrl, { try_instant_view: false })
          } else {
            // Если нет return_url, возвращаемся на главную
            const siteUrl = `${window.location.origin}/?auth=confirmed`
            console.log('🔗 Возвращаемся на главную страницу:', siteUrl)
            webApp.openLink(siteUrl, { try_instant_view: false })
          }
          
          // Закрываем Web App через небольшую задержку
          setTimeout(() => {
            if (webApp.close) {
              webApp.close()
            }
          }, 1000)
        })
      } else {
        // Если не в Web App, просто перенаправляем
        console.log('🔗 Перенаправление на:', redirectUrl)
        if (returnUrl) {
          localStorage.removeItem('return_url')
        }
        router.push(redirectUrl)
      }
    } catch (error) {
      console.error('❌ Ошибка при подтверждении:', error)
      setIsConfirming(false)
      alert('Ошибка при сохранении данных. Попробуйте еще раз.')
    }
  }

  const handleCancel = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.close()
    } else {
      router.push('/')
    }
  }

  if (!isAuthorized || !userData) {
    return (
      <div className="container">
        <div className="card">
          <h1>Авторизация</h1>
          <p style={{ color: '#666', marginTop: '1rem', textAlign: 'center' }}>
            Загрузка данных из Telegram...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>🔐 Подтверждение авторизации</h1>
        
        <div style={{ 
          padding: '2rem', 
          background: '#f8f9fa', 
          borderRadius: '12px', 
          border: '2px solid #0088cc',
          marginBottom: '2rem'
        }}>
          <p style={{ 
            marginBottom: '1.5rem', 
            fontSize: '1.1rem', 
            textAlign: 'center',
            fontWeight: 500,
            color: '#333'
          }}>
            Вы хотите авторизоваться на сайте с данными:
          </p>
          
          <div style={{
            padding: '1.5rem',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#666', fontSize: '0.9rem' }}>Имя:</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', fontWeight: 500 }}>
                {userData.first_name}
                {userData.last_name && ` ${userData.last_name}`}
              </p>
            </div>
            
            {userData.username && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#666', fontSize: '0.9rem' }}>Telegram:</strong>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem' }}>
                  <a
                    href={`https://t.me/${userData.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#0088cc', 
                      textDecoration: 'none',
                      fontWeight: 500
                    }}
                  >
                    @{userData.username}
                  </a>
                </p>
              </div>
            )}
            
            <div>
              <strong style={{ color: '#666', fontSize: '0.9rem' }}>ID:</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '1rem', color: '#999' }}>
                {userData.id}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            className="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            style={{ 
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 500,
              background: isConfirming ? '#ccc' : '#0088cc',
              cursor: isConfirming ? 'not-allowed' : 'pointer'
            }}
          >
            {isConfirming ? '⏳ Подтверждение...' : '✅ Подтвердить авторизацию'}
          </button>
          
          <button
            onClick={handleCancel}
            disabled={isConfirming}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              background: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: isConfirming ? 'not-allowed' : 'pointer'
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card">
          <h1>Авторизация</h1>
          <p style={{ color: '#666', marginTop: '1rem' }}>
            Загрузка...
          </p>
        </div>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}

