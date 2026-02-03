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

      // Отправляем в группу напрямую через Telegram API
      // Если группа была преобразована в супергруппу, используем migrate_to_chat_id из ошибки
      let groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-5074397630'
      let groupSent = false
      let attempts = 0
      const maxAttempts = 2
      
      while (!groupSent && attempts < maxAttempts) {
        try {
          const groupResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: groupChatId,
              text: adminMessage,
            }),
          })

          const groupResult = await groupResponse.json()
          
          if (groupResponse.ok && groupResult.ok) {
            console.log('✅ Сообщение успешно отправлено в группу:', groupChatId)
            groupSent = true
          } else if (groupResult.error_code === 400 && groupResult.description?.includes('upgraded to a supergroup')) {
            // Группа была преобразована в супергруппу, получаем новый ID
            const migrateMatch = groupResult.parameters?.migrate_to_chat_id
            if (migrateMatch) {
              console.log(`🔄 Группа преобразована в супергруппу. Старый ID: ${groupChatId}, новый ID: ${migrateMatch}`)
              groupChatId = migrateMatch.toString()
              attempts++
              // Продолжаем попытку с новым ID
            } else {
              console.error('❌ Группа преобразована, но новый ID не найден:', groupResult)
              // Пробуем использовать стандартный формат для супергруппы (добавляем -100)
              const oldId = parseInt(groupChatId.replace('-', ''))
              if (!isNaN(oldId)) {
                groupChatId = `-100${oldId}`
                console.log(`🔄 Пробуем новый формат ID супергруппы: ${groupChatId}`)
                attempts++
              } else {
                console.error('❌ Не удалось определить новый ID группы')
                break
              }
            }
          } else {
            console.error('❌ Ошибка отправки в группу:', {
              chatId: groupChatId,
              error: groupResult.description || groupResult.error_code,
              fullResponse: groupResult
            })
            // Для других ошибок не прерываем выполнение, но логируем
            break
          }
        } catch (error) {
          console.error('❌ Ошибка при отправке в группу:', error)
          break
        }
      }
      
      if (!groupSent) {
        console.error('⚠️ Не удалось отправить сообщение в группу после всех попыток')
        // Не возвращаем ошибку пользователю, но логируем для отладки
      }

      // Отправляем пользователю (только если это реальный Telegram ID)
      const isRealTelegramId = body.telegram.id < 2147483647
      if (isRealTelegramId && body.telegram.id) {
        const userMessage = `✅ Спасибо за авторизацию!\n\n` +
          `Ваши данные успешно получены.\n` +
          `Анкета: ${body.questionnaireType}\n` +
          `${body.telegram.username ? `Ваш Telegram: @${body.telegram.username}` : ''}`
        
        try {
          const userResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: body.telegram.id,
              text: userMessage,
            }),
          })
          
          const userResult = await userResponse.json()
          if (userResult.ok) {
            console.log('✅ Сообщение отправлено пользователю')
          } else {
            console.warn('⚠️ Не удалось отправить сообщение пользователю:', userResult.description)
          }
        } catch (error) {
          console.warn('⚠️ Ошибка при отправке пользователю:', error)
        }
      }

      // Отправляем администратору (если указан)
      if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
        try {
          const adminResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
              text: adminMessage,
            }),
          })
          
          const adminResult = await adminResponse.json()
          if (adminResult.ok) {
            console.log('✅ Сообщение отправлено администратору')
          }
        } catch (error) {
          console.warn('⚠️ Ошибка при отправке администратору:', error)
        }
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

