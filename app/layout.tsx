import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Анкеты',
  description: 'Сбор анкет с авторизацией через Telegram',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        {/* Telegram Web App Script - загружаем в head для ранней инициализации */}
        <script
          src="https://telegram.org/js/telegram-web-app.js"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}

