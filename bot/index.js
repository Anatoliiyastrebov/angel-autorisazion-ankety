// Telegram бот для авторизации на сайте
// Бот: @telega_automat_bot

require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')

// Проверка переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен!')
  console.error('Создайте файл .env и добавьте TELEGRAM_BOT_TOKEN=ваш_токен')
  process.exit(1)
}

if (!process.env.SITE_URL) {
  console.error('❌ Ошибка: SITE_URL не установлен!')
  console.error('Создайте файл .env и добавьте SITE_URL=https://ваш-домен.vercel.app')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
})

const SITE_URL = process.env.SITE_URL

// Временное хранилище токенов (в продакшене используйте Redis или БД)
const sessionTokens = {}

// Очистка старых токенов каждые 5 минут
setInterval(() => {
  const now = Date.now()
  Object.keys(sessionTokens).forEach(key => {
    if (now - sessionTokens[key].timestamp > 10 * 60 * 1000) {
      delete sessionTokens[key]
      console.log(`🗑️ Удален истекший токен сессии: ${key}`)
    }
  })
}, 5 * 60 * 1000)

// Обработчик команды /start с параметром auth_*
bot.onText(/\/start auth_(.+)/, async (msg, match) => {
  const chatId = msg.chat.id
  const sessionId = match[1]
  const userName = msg.from.first_name || 'Пользователь'
  
  console.log(`🔐 Запрос авторизации от пользователя ${chatId} (${userName}), сессия: ${sessionId}`)
  
  try {
    // Получаем токен авторизации с сайта
    console.log(`📡 Отправка запроса на ${SITE_URL}/api/auth/generate-token`)
    const response = await axios.post(`${SITE_URL}/api/auth/generate-token`, {
      userId: chatId,
      botToken: process.env.TELEGRAM_BOT_TOKEN
    }, {
      timeout: 10000, // 10 секунд таймаут
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.data || !response.data.token) {
      throw new Error('Токен не получен от сервера')
    }
    
    const { token, callbackUrl } = response.data
    
    console.log(`✅ Токен получен для сессии ${sessionId}`)
    
    // Сохраняем токен в сессии
    sessionTokens[sessionId] = { 
      token, 
      userId: chatId, 
      timestamp: Date.now(),
      userName: userName
    }
    
    // Отправляем сообщение с кнопкой Web App для подтверждения авторизации
    const message = await bot.sendMessage(chatId, 
      `🔐 Привет, ${userName}!\n\n` +
      `Для авторизации на сайте нажмите кнопку ниже:`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✅ Авторизоваться',
              web_app: { 
                url: `${SITE_URL}/auth/confirm?session=${sessionId}&token=${token}&user_id=${chatId}` 
              }
            }
          ]]
        }
      }
    )
    
    console.log(`✅ Сообщение с кнопкой отправлено пользователю ${chatId}`)
    
  } catch (error) {
    console.error('❌ Ошибка при генерации токена:', error.message)
    
    if (error.response) {
      console.error('Детали ошибки:', {
        status: error.response.status,
        data: error.response.data
      })
    }
    
    let errorMessage = '❌ Ошибка при создании токена авторизации. '
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage += 'Сервер недоступен. Проверьте SITE_URL в настройках.'
    } else if (error.response?.status === 401) {
      errorMessage += 'Неверный токен бота. Проверьте TELEGRAM_BOT_TOKEN.'
    } else {
      errorMessage += 'Попробуйте еще раз через несколько секунд.'
    }
    
    bot.sendMessage(chatId, errorMessage)
  }
})

// Обработчик обычной команды /start
bot.onText(/\/start$/, (msg) => {
  const chatId = msg.chat.id
  const userName = msg.from.first_name || 'Пользователь'
  
  console.log(`👋 Команда /start от пользователя ${chatId} (${userName})`)
  
  bot.sendMessage(chatId, 
    `👋 Привет, ${userName}!\n\n` +
    `Я бот для авторизации на сайте.\n\n` +
    `Для авторизации:\n` +
    `1. Перейдите на сайт\n` +
    `2. Нажмите кнопку "Войти через Telegram"\n` +
    `3. Следуйте инструкциям в боте\n\n` +
    `Бот: @telega_automat_bot`
  )
})

// Обработчик команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id
  
  bot.sendMessage(chatId,
    `📖 Помощь\n\n` +
    `Команды:\n` +
    `/start - Начать работу с ботом\n` +
    `/help - Показать эту справку\n\n` +
    `Для авторизации на сайте:\n` +
    `1. Откройте сайт\n` +
    `2. Нажмите "Войти через Telegram"\n` +
    `3. Нажмите кнопку "Авторизоваться" в этом боте`
  )
})

// Обработчик всех сообщений (для отладки)
bot.on('message', (msg) => {
  // Игнорируем команды, которые уже обработаны
  if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help'))) {
    return
  }
  
  // Логируем все остальные сообщения
  if (msg.text) {
    console.log(`💬 Сообщение от ${msg.from.id} (${msg.from.first_name}): ${msg.text}`)
  }
})

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.message)
  
  // Если ошибка критическая, перезапускаем бота
  if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 401) {
    console.error('❌ Критическая ошибка: Неверный токен бота!')
    process.exit(1)
  }
})

// Обработчик успешного запуска
bot.on('polling_error', () => {
  // Это событие срабатывает при ошибках, но мы уже обработали его выше
})

// Информация о запуске
console.log('🤖 Telegram бот запускается...')
console.log(`📡 SITE_URL: ${SITE_URL}`)
console.log(`🔑 Бот токен: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`)

// Проверка доступности API
axios.get(`${SITE_URL}/api/auth/generate-token`, { timeout: 5000 })
  .then(() => {
    console.log('✅ API сайта доступен')
  })
  .catch((error) => {
    console.warn('⚠️ Предупреждение: API сайта недоступен:', error.message)
    console.warn('⚠️ Убедитесь, что SITE_URL правильный и сайт работает')
  })

console.log('✅ Бот запущен и готов к работе!')
console.log('📝 Используйте /start для начала работы')

