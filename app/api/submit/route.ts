import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'

interface TelegramData {
  id: number
  username?: string
  first_name: string
  last_name?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface SubmitRequest {
  questionnaireType: string
  telegram: TelegramData
}

function verifyTelegramAuth(data: TelegramData, botToken: string): boolean {
  try {
    const { hash, ...userData } = data
    
    // Создаем data-check-string из всех полей кроме hash
    // Фильтруем undefined значения и сортируем по ключу
    const dataCheckString = Object.keys(userData)
      .filter((key) => userData[key as keyof typeof userData] !== undefined)
      .sort()
      .map((key) => {
        const value = userData[key as keyof typeof userData]
        return `${key}=${value}`
      })
      .join('\n')

    // Создаем секретный ключ из токена бота
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest()

    // Вычисляем HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    // Проверяем, что hash совпадает
    if (calculatedHash !== hash) {
      return false
    }

    // Проверяем, что данные не устарели (не старше 24 часов)
    const currentTime = Math.floor(Date.now() / 1000)
    const authDate = data.auth_date
    if (currentTime - authDate > 86400) {
      return false
    }

    return true
  } catch (error) {
    console.error('Error verifying Telegram auth:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRequest = await request.json()

    // Валидация данных
    if (!body.questionnaireType || !body.telegram) {
      return NextResponse.json(
        { error: 'Не все обязательные поля заполнены' },
        { status: 400 }
      )
    }

    // Проверка подписи Telegram (опционально, если есть токен бота)
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (botToken) {
      // Проверяем подпись только если есть hash (для Login Widget и Web App)
      // Для простой формы hash будет пустым, пропускаем проверку
      if (body.telegram.hash && body.telegram.hash.trim() !== '') {
        const isValid = verifyTelegramAuth(body.telegram, botToken)
        if (!isValid) {
          return NextResponse.json(
            { error: 'Неверная подпись Telegram' },
            { status: 401 }
          )
        }
      }
      // Для простой формы (без hash) пропускаем проверку подписи
    }

    // Здесь можно сохранить данные в базу данных
    // Например: await saveToDatabase(body)

    // Логирование для отладки (в продакшене лучше использовать логгер)
    console.log('Data submitted:', {
      type: body.questionnaireType,
      telegram: {
        id: body.telegram.id,
        username: body.telegram.username,
        first_name: body.telegram.first_name,
      },
    })

    // Отправляем сообщение боту с данными пользователя
    if (botToken) {
      const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
      
      // Формируем сообщение для администратора/группы
      const adminMessage = `🔔 Новая авторизация через анкету!\n\n` +
        `📋 Тип анкеты: ${body.questionnaireType}\n` +
        `👤 Имя: ${body.telegram.first_name}${body.telegram.last_name ? ' ' + body.telegram.last_name : ''}\n` +
        `🆔 Username: ${body.telegram.username ? '@' + body.telegram.username : 'не указан'}\n` +
        `🆔 ID: ${body.telegram.id}\n` +
        `🔗 Ссылка: ${body.telegram.username ? `https://t.me/${body.telegram.username}` : 'недоступна'}`

      // Функция для отправки сообщения с обработкой ошибок
      const sendTelegramMessage = async (chatId: string | number, text: string, description: string) => {
        try {
          const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: text,
            }),
          })

          const result = await response.json()
          
          if (!response.ok || !result.ok) {
            console.error(`❌ Failed to send message to ${description} (${chatId}):`, result.description || result.error_code || result)
            return { success: false, error: result.description || result.error_code || 'Unknown error' }
          }
          
          console.log(`✅ Message sent to ${description} (${chatId}) successfully`)
          return { success: true }
        } catch (error) {
          console.error(`❌ Error sending message to ${description} (${chatId}):`, error)
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }

      // Отправляем в группу (обязательно)
      const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-5074397630'
      const groupResult = await sendTelegramMessage(groupChatId, adminMessage, 'group')
      
      if (!groupResult.success) {
        console.error('⚠️ Failed to send message to group, but continuing...')
        // Не прерываем выполнение, но логируем ошибку
      }

      // Отправляем пользователю (только если это реальный Telegram ID, не временный)
      // Проверяем, что ID не является временным (Date.now() создает очень большие числа)
      const isRealTelegramId = body.telegram.id < 2147483647 // Максимальный реальный Telegram ID
      if (isRealTelegramId && body.telegram.id) {
        const userMessage = `✅ Спасибо за авторизацию!\n\n` +
          `Ваши данные успешно получены.\n` +
          `Анкета: ${body.questionnaireType}\n` +
          `${body.telegram.username ? `Ваш Telegram: @${body.telegram.username}` : ''}`
        
        await sendTelegramMessage(body.telegram.id, userMessage, 'user')
      }

      // Отправляем администратору (если указан)
      if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
        await sendTelegramMessage(process.env.TELEGRAM_ADMIN_CHAT_ID, adminMessage, 'admin')
      }
    } else {
      console.error('⚠️ TELEGRAM_BOT_TOKEN not set, cannot send messages')
    }

    return NextResponse.json({
      success: true,
      message: 'Анкета успешно отправлена',
    })
  } catch (error) {
    console.error('Error submitting questionnaire:', error)
    return NextResponse.json(
      { error: 'Ошибка при обработке запроса' },
      { status: 500 }
    )
  }
}

