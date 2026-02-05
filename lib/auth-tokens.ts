import crypto from 'crypto'

// Интерфейс для данных пользователя Telegram
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

// Хранилище временных токенов авторизации (в продакшене используйте Redis или БД)
const authTokens = new Map<string, { userId: number; expiresAt: number }>()

// Хранилище данных пользователей (временное, в продакшене используйте Redis или БД)
const userDataStore = new Map<string, { userData: TelegramUserData; expiresAt: number }>()

// Генерируем токен авторизации
export function generateAuthToken(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 минут
  authTokens.set(token, { userId, expiresAt })
  
  // Очищаем истекшие токены
  setTimeout(() => {
    authTokens.delete(token)
  }, 5 * 60 * 1000)
  
  return token
}

// Проверяем токен
export function verifyAuthToken(token: string): number | null {
  const authData = authTokens.get(token)
  if (!authData) return null
  
  if (Date.now() > authData.expiresAt) {
    authTokens.delete(token)
    return null
  }
  
  return authData.userId
}

// Удаляем токен
export function deleteAuthToken(token: string): void {
  authTokens.delete(token)
}

// Сохраняем данные пользователя с токеном
export function saveUserData(userData: TelegramUserData): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 минут
  userDataStore.set(token, { userData, expiresAt })
  
  // Очищаем истекшие данные
  setTimeout(() => {
    userDataStore.delete(token)
  }, 10 * 60 * 1000)
  
  console.log(`💾 Данные пользователя ${userData.id} сохранены с токеном ${token.substring(0, 8)}...`)
  return token
}

// Получаем данные пользователя по токену
export function getUserData(token: string): TelegramUserData | null {
  const data = userDataStore.get(token)
  if (!data) {
    console.log(`⚠️ Данные для токена ${token.substring(0, 8)}... не найдены`)
    return null
  }
  
  if (Date.now() > data.expiresAt) {
    userDataStore.delete(token)
    console.log(`⚠️ Данные для токена ${token.substring(0, 8)}... истекли`)
    return null
  }
  
  console.log(`✅ Данные пользователя ${data.userData.id} получены по токену ${token.substring(0, 8)}...`)
  return data.userData
}

// Удаляем данные пользователя
export function deleteUserData(token: string): void {
  userDataStore.delete(token)
}

