import { NextRequest, NextResponse } from 'next/server'
import { getUserData, deleteUserData } from '@/lib/auth-tokens'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Получаем данные пользователя
    const userData = getUserData(token)

    if (!userData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Удаляем токен после использования (одноразовый)
    deleteUserData(token)

    return NextResponse.json({
      success: true,
      userData
    })
  } catch (error) {
    console.error('❌ Ошибка при получении данных пользователя:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

