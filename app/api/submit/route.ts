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
  initData?: string // Оригинальная строка initData для Web App
}

interface SubmitRequest {
  questionnaireType: string
  answers?: Record<string, string> // Ответы на вопросы анкеты
  telegram: TelegramData
}

function verifyTelegramAuth(data: TelegramData, botToken: string): boolean {
  try {
    // Если есть initData (из Web App), используем его для проверки
    if (data.initData) {
      return verifyTelegramWebApp(data.initData, botToken, data.auth_date)
    }
    
    // Иначе проверяем как Login Widget
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
      console.error('❌ Hash mismatch. Calculated:', calculatedHash, 'Received:', hash)
      return false
    }

    // Проверяем, что данные не устарели (не старше 24 часов)
    const currentTime = Math.floor(Date.now() / 1000)
    const authDate = data.auth_date
    if (currentTime - authDate > 86400) {
      console.error('❌ Auth data is too old. Current:', currentTime, 'Auth Date:', authDate)
      return false
    }

    return true
  } catch (error) {
    console.error('❌ Error verifying Telegram auth:', error)
    return false
  }
}

function verifyTelegramWebApp(initData: string, botToken: string, authDate: number): boolean {
  try {
    // Парсим initData (формат: key1=value1&key2=value2&hash=...)
    const params = new URLSearchParams(initData)
    const receivedHash = params.get('hash')
    
    if (!receivedHash) {
      console.error('❌ Hash not found in initData')
      return false
    }
    
    // Удаляем hash из параметров
    params.delete('hash')
    
    // Создаем data-check-string из всех параметров, отсортированных по ключу
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
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
    if (calculatedHash !== receivedHash) {
      console.error('❌ Web App hash mismatch. Calculated:', calculatedHash, 'Received:', receivedHash)
      console.error('❌ Data check string:', dataCheckString)
      return false
    }
    
    // Проверяем, что данные не устарели (не старше 24 часов)
    const currentTime = Math.floor(Date.now() / 1000)
    if (currentTime - authDate > 86400) {
      console.error('❌ Web App auth data is too old. Current:', currentTime, 'Auth Date:', authDate)
      return false
    }
    
    console.log('✅ Web App signature verified successfully')
    return true
  } catch (error) {
    console.error('❌ Error verifying Telegram Web App:', error)
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

    // Получаем токен бота для отправки сообщений
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Сервер не настроен для обработки авторизации' },
        { status: 500 }
      )
    }

    // Используем username из данных (без проверки)
    let verifiedUsername = body.telegram.username || 'не указан'

    // Здесь можно сохранить данные в базу данных
    // Например: await saveToDatabase(body)

    // Логирование для отладки (в продакшене лучше использовать логгер)
    console.log('📝 Data submitted:', {
      type: body.questionnaireType,
      telegram: {
        id: body.telegram.id,
        username: verifiedUsername,
        first_name: body.telegram.first_name,
      },
    })

    // Отправляем сообщение боту с данными пользователя
    if (botToken) {
      const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
      
      // Формируем сообщение для администратора/группы
      let adminMessage = `🔔 Новая анкета!\n\n` +
        `📋 Тип анкеты: ${body.questionnaireType}\n` +
        `👤 Имя: ${body.telegram.first_name}${body.telegram.last_name ? ' ' + body.telegram.last_name : ''}\n` +
        `🆔 Username: ${verifiedUsername ? '@' + verifiedUsername : 'не указан'}\n` +
        `🆔 ID: ${body.telegram.id}\n` +
        `🔗 Ссылка: ${verifiedUsername ? `https://t.me/${verifiedUsername}` : 'недоступна'}\n\n`
      
      // Добавляем ответы на вопросы анкеты, если они есть
      if (body.answers && Object.keys(body.answers).length > 0) {
        adminMessage += `📝 Ответы на вопросы:\n`
        for (const [questionId, answer] of Object.entries(body.answers)) {
          adminMessage += `\n• ${questionId}: ${answer}`
        }
      }

      // Отправляем в группу напрямую через Telegram API
      // Если группа была преобразована в супергруппу, используем migrate_to_chat_id из ошибки
      let groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || '-1003533385546'
      console.log('📤 Отправляю сообщение в группу:', groupChatId)
      let groupSent = false
      let attempts = 0
      const maxAttempts = 2
      
      while (!groupSent && attempts < maxAttempts) {
        try {
          console.log(`📤 Попытка ${attempts + 1}: отправка в группу ${groupChatId}`)
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
          console.log('📤 Результат отправки в группу:', {
            ok: groupResult.ok,
            error_code: groupResult.error_code,
            description: groupResult.description
          })
          
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
              error_code: groupResult.error_code,
              fullResponse: groupResult
            })
            // Для других ошибок возвращаем ошибку
            return NextResponse.json(
              {
                error: `Не удалось отправить сообщение в группу: ${groupResult.description || 'Неизвестная ошибка'}`,
                details: groupResult
              },
              { status: 500 }
            )
          }
        } catch (error) {
          console.error('❌ Ошибка при отправке в группу:', error)
          return NextResponse.json(
            { error: 'Ошибка при отправке сообщения в группу' },
            { status: 500 }
          )
        }
      }
      
      if (!groupSent) {
        console.error('❌ Не удалось отправить сообщение в группу после всех попыток')
        return NextResponse.json(
          { error: 'Не удалось отправить сообщение в группу. Попробуйте позже.' },
          { status: 500 }
        )
      }

      // Отправляем пользователю (только если это реальный Telegram ID)
      const isRealTelegramId = body.telegram.id < 2147483647
      if (isRealTelegramId && body.telegram.id) {
        console.log('📤 Отправляю сообщение пользователю:', body.telegram.id)
        const userMessage = `✅ Спасибо за авторизацию!\n\n` +
          `Ваши данные успешно получены.\n` +
          `Анкета: ${body.questionnaireType}\n` +
          `${verifiedUsername ? `Ваш Telegram: @${verifiedUsername}` : ''}`
        
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

