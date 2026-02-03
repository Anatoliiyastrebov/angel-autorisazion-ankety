import type { Metadata } from 'next'
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
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>{children}</body>
    </html>
  )
}

