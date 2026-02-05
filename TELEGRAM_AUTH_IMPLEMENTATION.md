# Telegram Web App Авторизация — Полная инструкция для копирования

## Описание

Авторизация пользователей через Telegram Web App. Пользователь нажимает кнопку на сайте → открывается Telegram → подтверждает авторизацию → возвращается на сайт с данными из Telegram.

---

## Требования

- Next.js 14+ (App Router)
- Telegram Bot (создать через @BotFather)
- Telegram Web App (создать через @BotFather командой `/newapp`)
- Vercel или другой хостинг с HTTPS

---

## Переменные окружения

```env
# .env.local
NEXT_PUBLIC_TELEGRAM_BOT_NAME=your_bot_name
NEXT_PUBLIC_SITE_URL=https://your-site.vercel.app
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_GROUP_CHAT_ID=-1001234567890
```

---

## Структура файлов

```
app/
├── page.tsx                      # Главная страница с авторизацией
├── auth/
│   └── confirm/
│       └── page.tsx              # Страница подтверждения (Telegram Web App)
└── api/
    └── auth/
        ├── create-session/
        │   └── route.ts          # Создание сессии перед открытием Telegram
        ├── save-user/
        │   └── route.ts          # Сохранение данных пользователя
        └── get-user-data/
            └── route.ts          # Получение данных по токену
lib/
└── auth-tokens.ts                # Хранилище токенов и сессий
telegram-webapp.d.ts              # TypeScript типы для Telegram Web App
```

---

## 1. TypeScript типы — `telegram-webapp.d.ts`

```typescript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
          }
          auth_date: number
          hash: string
          start_param?: string
        }
        ready: () => void
        expand: () => void
        close: () => void
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void
      }
    }
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
  initData?: string
}

export {}
```

Добавьте в `tsconfig.json`:
```json
{
  "include": ["telegram-webapp.d.ts", ...]
}
```

---

## 2. Хранилище токенов — `lib/auth-tokens.ts`

```typescript
import crypto from 'crypto'

export interface TelegramUserData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
  initData: string
}

export interface AuthSession {
  returnUrl: string
  questionnaireType: string
  createdAt: number
}

// Хранилище (в продакшене используйте Redis)
const userDataStore = new Map<string, { userData: TelegramUserData; expiresAt: number }>()
const authSessions = new Map<string, { session: AuthSession; expiresAt: number }>()

// Сохранение данных пользователя
export function saveUserData(userData: TelegramUserData): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 минут
  userDataStore.set(token, { userData, expiresAt })
  setTimeout(() => userDataStore.delete(token), 10 * 60 * 1000)
  return token
}

// Получение данных пользователя
export function getUserData(token: string): TelegramUserData | null {
  const data = userDataStore.get(token)
  if (!data || Date.now() > data.expiresAt) {
    userDataStore.delete(token)
    return null
  }
  return data.userData
}

// Удаление данных
export function deleteUserData(token: string): void {
  userDataStore.delete(token)
}

// Сохранение сессии (URL возврата)
export function saveAuthSession(returnUrl: string, questionnaireType: string): string {
  const sessionId = crypto.randomBytes(16).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 минут
  authSessions.set(sessionId, {
    session: { returnUrl, questionnaireType, createdAt: Date.now() },
    expiresAt
  })
  setTimeout(() => authSessions.delete(sessionId), 15 * 60 * 1000)
  return sessionId
}

// Получение сессии
export function getAuthSession(sessionId: string): AuthSession | null {
  const data = authSessions.get(sessionId)
  if (!data || Date.now() > data.expiresAt) {
    authSessions.delete(sessionId)
    return null
  }
  return data.session
}

// Удаление сессии
export function deleteAuthSession(sessionId: string): void {
  authSessions.delete(sessionId)
}
```

---

## 3. API: Создание сессии — `app/api/auth/create-session/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saveAuthSession } from '@/lib/auth-tokens'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { returnUrl, questionnaireType } = await request.json()
    const sessionId = saveAuthSession(returnUrl || '/', questionnaireType || '')
    return NextResponse.json({ success: true, sessionId })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 4. API: Сохранение пользователя — `app/api/auth/save-user/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saveUserData, TelegramUserData, getAuthSession, deleteAuthSession } from '@/lib/auth-tokens'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userData, sessionId } = await request.json()

    if (!userData || !userData.id || !userData.first_name) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 400 })
    }

    // Получаем URL возврата из сессии
    let returnUrl = '/'
    if (sessionId) {
      const session = getAuthSession(sessionId)
      if (session) {
        returnUrl = session.returnUrl
        deleteAuthSession(sessionId)
      }
    }

    // Сохраняем данные и получаем токен
    const token = saveUserData(userData as TelegramUserData)
    
    // Формируем URL для возврата
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    const separator = returnUrl.includes('?') ? '&' : '?'
    const callbackUrl = `${siteUrl}${returnUrl}${separator}auth_token=${token}`

    return NextResponse.json({ success: true, token, callbackUrl })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 5. API: Получение данных — `app/api/auth/get-user-data/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getUserData, deleteUserData } from '@/lib/auth-tokens'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const userData = getUserData(token)
    if (!userData) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    deleteUserData(token) // Одноразовый токен
    return NextResponse.json({ success: true, userData })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 6. Страница подтверждения — `app/auth/confirm/page.tsx`

```tsx
'use client'

import { Suspense, useEffect, useState } from 'react'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
  initData?: string
}

function AuthConfirmContent() {
  const [userData, setUserData] = useState<TelegramUser | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
  const [authComplete, setAuthComplete] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()

      const webAppUser = webApp.initDataUnsafe?.user
      const initData = webApp.initDataUnsafe

      if (webAppUser && initData?.auth_date && initData?.hash) {
        setUserData({
          id: webAppUser.id,
          first_name: webAppUser.first_name,
          last_name: webAppUser.last_name,
          username: webAppUser.username,
          photo_url: webAppUser.photo_url,
          auth_date: initData.auth_date,
          hash: initData.hash,
          initData: webApp.initData,
        })
      }
    }
  }, [])

  const getSessionId = (): string | null => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp.initDataUnsafe?.start_param || null
    }
    return null
  }

  const handleConfirm = async () => {
    if (!userData) return
    setIsConfirming(true)

    try {
      const sessionId = getSessionId()
      const response = await fetch('/api/auth/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userData, sessionId }),
      })

      if (!response.ok) throw new Error('Ошибка')
      
      const result = await response.json()
      setCallbackUrl(result.callbackUrl)
      setAuthComplete(true)
    } catch (error) {
      setIsConfirming(false)
      alert('Ошибка. Попробуйте ещё раз.')
    }
  }

  const handleGoToSite = () => {
    if (callbackUrl && window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(callbackUrl, { try_instant_view: false })
      setTimeout(() => window.Telegram?.WebApp?.close(), 500)
    }
  }

  if (authComplete && callbackUrl) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>✅ Авторизация успешна!</h1>
        <button onClick={handleGoToSite} style={{ padding: '1rem 2rem', fontSize: '1.1rem', background: '#0088cc', color: 'white', border: 'none', borderRadius: '8px', marginTop: '1rem' }}>
          📋 Вернуться на сайт
        </button>
      </div>
    )
  }

  if (!userData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🔐 Авторизация</h1>
        <p>Эта страница работает только через Telegram бота.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>🔐 Подтверждение авторизации</h1>
      <p>Имя: {userData.first_name} {userData.last_name}</p>
      {userData.username && <p>@{userData.username}</p>}
      <button onClick={handleConfirm} disabled={isConfirming} style={{ padding: '1rem 2rem', fontSize: '1.1rem', background: '#0088cc', color: 'white', border: 'none', borderRadius: '8px', marginTop: '1rem' }}>
        {isConfirming ? '⏳ Подтверждение...' : '✅ Подтвердить'}
      </button>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <AuthConfirmContent />
    </Suspense>
  )
}
```

---

## 7. Главная страница с авторизацией — `app/page.tsx`

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  auth_date: number
  hash: string
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || ''

  useEffect(() => {
    const loadUser = async () => {
      // 1. Проверяем auth_token в URL (возврат после авторизации)
      const authToken = searchParams.get('auth_token')
      if (authToken) {
        try {
          const response = await fetch(`/api/auth/get-user-data?token=${authToken}`)
          if (response.ok) {
            const { userData } = await response.json()
            if (userData) {
              setUser(userData)
              localStorage.setItem('telegram_user', JSON.stringify(userData))
              window.history.replaceState({}, '', '/')
              setIsLoading(false)
              return
            }
          }
        } catch (e) {}
        window.history.replaceState({}, '', '/')
      }

      // 2. Проверяем localStorage
      const saved = localStorage.getItem('telegram_user')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.id && parsed.first_name) {
            // Проверяем срок действия (24 часа)
            const currentTime = Math.floor(Date.now() / 1000)
            if (parsed.auth_date && currentTime - parsed.auth_date < 86400) {
              setUser(parsed)
            } else {
              localStorage.removeItem('telegram_user')
            }
          }
        } catch (e) {
          localStorage.removeItem('telegram_user')
        }
      }
      setIsLoading(false)
    }
    loadUser()
  }, [searchParams])

  const handleAuth = async () => {
    try {
      const response = await fetch('/api/auth/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/', questionnaireType: '' })
      })
      const { sessionId } = await response.json()
      
      const webAppUrl = `https://t.me/${botName}/app?startapp=${sessionId}`
      
      // На мобильных используем редирект
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile) {
        window.location.href = webAppUrl
      } else {
        window.open(webAppUrl, '_blank') || (window.location.href = webAppUrl)
      }
    } catch (e) {
      alert('Ошибка. Попробуйте ещё раз.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('telegram_user')
    setUser(null)
  }

  if (isLoading) return <div>Загрузка...</div>

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🔐 Требуется авторизация</h1>
        <button onClick={handleAuth} style={{ padding: '1rem 2rem', fontSize: '1.1rem', background: '#0088cc', color: 'white', border: 'none', borderRadius: '8px', marginTop: '1rem' }}>
          🤖 Войти через Telegram
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        ✅ Авторизация пройдена: {user.username ? `@${user.username}` : user.first_name}
        <button onClick={handleLogout} style={{ marginLeft: '1rem' }}>Выйти</button>
      </div>
      {/* Ваш контент */}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <HomeContent />
    </Suspense>
  )
}
```

---

## 8. Настройка @BotFather

### Создание Web App:
1. Откройте @BotFather
2. `/newapp`
3. Выберите бота
4. **Title:** `Авторизация`
5. **Description:** `Авторизация на сайте`
6. **Web App URL:** `https://your-site.vercel.app/auth/confirm`
7. **Short Name:** `app` ← ВАЖНО!

### Настройка Menu Button (опционально):
1. `/mybots` → выберите бота
2. **Bot Settings** → **Menu Button** → **Configure**
3. **URL:** `https://your-site.vercel.app/auth/confirm`
4. **Text:** `Авторизоваться`

---

## Процесс авторизации

```
1. Пользователь на сайте → нажимает "Войти через Telegram"
   ↓
2. Сайт создаёт сессию на сервере (API create-session)
   ↓
3. Открывается https://t.me/bot/app?startapp=SESSION_ID
   ↓
4. Telegram показывает Web App (/auth/confirm)
   ↓
5. Web App получает данные из window.Telegram.WebApp.initDataUnsafe
   ↓
6. Пользователь подтверждает → данные отправляются на сервер (API save-user)
   ↓
7. Сервер сохраняет данные, возвращает auth_token и callbackUrl
   ↓
8. Web App открывает callbackUrl через openLink()
   ↓
9. Сайт загружает данные по auth_token (API get-user-data)
   ↓
10. Пользователь авторизован ✅
```

---

## Важные моменты

1. **Short Name = "app"** — обязателен для работы `?startapp=`
2. **HTTPS обязателен** — Telegram Web App работает только по HTTPS
3. **Токены одноразовые** — после использования удаляются
4. **Срок действия** — сессия 15 мин, данные пользователя 10 мин
5. **localStorage** — для сохранения авторизации между сессиями
6. **Мобильные** — используйте `window.location.href` вместо `window.open()`
