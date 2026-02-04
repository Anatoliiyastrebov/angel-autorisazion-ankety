// Скрипт для проверки настроек бота

require('dotenv').config()
const axios = require('axios')

console.log('🔍 Проверка настроек бота...\n')

let hasErrors = false

// Проверка TELEGRAM_BOT_TOKEN
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен')
  hasErrors = true
} else {
  console.log('✅ TELEGRAM_BOT_TOKEN установлен')
  console.log(`   Токен: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 15)}...`)
}

// Проверка SITE_URL
if (!process.env.SITE_URL) {
  console.error('❌ SITE_URL не установлен')
  hasErrors = true
} else {
  console.log('✅ SITE_URL установлен')
  console.log(`   URL: ${process.env.SITE_URL}`)
  
  // Проверка доступности API
  console.log('\n📡 Проверка доступности API сайта...')
  axios.post(`${process.env.SITE_URL}/api/auth/generate-token`, {
    userId: 123456789,
    botToken: process.env.TELEGRAM_BOT_TOKEN
  }, {
    timeout: 5000
  })
    .then((response) => {
      if (response.status === 200) {
        console.log('✅ API сайта доступен и отвечает')
      }
    })
    .catch((error) => {
      if (error.response?.status === 401) {
        console.error('❌ API вернул 401: Неверный токен бота')
        console.error('   Убедитесь, что TELEGRAM_BOT_TOKEN одинаковый в боте и на Vercel')
      } else if (error.response?.status === 400) {
        console.log('✅ API доступен (ошибка 400 ожидаема для тестового запроса)')
      } else {
        console.error(`❌ API недоступен: ${error.message}`)
        console.error('   Проверьте SITE_URL и убедитесь, что сайт развернут на Vercel')
      }
      hasErrors = true
    })
}

// Итог
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.error('❌ Обнаружены ошибки в настройках')
  console.error('   Исправьте ошибки и запустите проверку снова')
  process.exit(1)
} else {
  console.log('✅ Все настройки корректны!')
  console.log('   Бот готов к запуску: npm start')
  process.exit(0)
}

