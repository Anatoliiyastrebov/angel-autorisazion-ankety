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
      const isValid = verifyTelegramAuth(body.telegram, botToken)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Неверная подпись Telegram' },
          { status: 401 }
        )
      }
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
    if (botToken && body.telegram.id) {
      try {
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
        
        // Формируем сообщение для администратора
        const adminMessage = `🔔 Новая авторизация через анкету!\n\n` +
          `📋 Тип анкеты: ${body.questionnaireType}\n` +
          `👤 Имя: ${body.telegram.first_name}${body.telegram.last_name ? ' ' + body.telegram.last_name : ''}\n` +
          `🆔 Username: ${body.telegram.username ? '@' + body.telegram.username : 'не указан'}\n` +
          `🆔 ID: ${body.telegram.id}\n` +
          `🔗 Ссылка: ${body.telegram.username ? `https://t.me/${body.telegram.username}` : 'недоступна'}`

        // Отправляем сообщение пользователю (подтверждение)
        const userMessage = `✅ Спасибо за авторизацию!\n\n` +
          `Ваши данные успешно получены.\n` +
          `Анкета: ${body.questionnaireType}\n` +
          `${body.telegram.username ? `Ваш Telegram: @${body.telegram.username}` : ''}`

        // Отправляем пользователю подтверждение
        await fetch(telegramApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: body.telegram.id,
            text: userMessage,
          }),
        })

        // Отправляем в группу (ID группы из переменных окружения или по умолчанию)
        const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-5074397630'
        await fetch(telegramApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: groupChatId,
            text: adminMessage,
          }),
        })
        console.log(`Message sent to group ${groupChatId} via Telegram Bot API`)

        // Отправляем администратору (если указан ADMIN_CHAT_ID в переменных окружения)
        const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
        if (adminChatId) {
          await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: adminMessage,
            }),
          })
          console.log('Message sent to admin via Telegram Bot API')
        }

        console.log('Message sent to user via Telegram Bot API')
      } catch (error) {
        console.error('Error sending message to Telegram:', error)
        // Не прерываем выполнение, если отправка сообщения не удалась
      }
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

