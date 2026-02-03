'use client'

import { TelegramUser } from './TelegramLogin'

interface TelegramAuthModalProps {
  user: TelegramUser
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  isSubmitting?: boolean
}

export default function TelegramAuthModal({
  user,
  isOpen,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: TelegramAuthModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Подтверждение авторизации</h2>
        </div>
        
        <div className="modal-body">
          <div className="user-info-card">
            {user.photo_url && (
              <div className="user-avatar">
                <img src={user.photo_url} alt={user.first_name} />
              </div>
            )}
            
            <div className="user-details">
              <div className="user-detail-row">
                <span className="detail-label">Имя:</span>
                <span className="detail-value">
                  {user.first_name}
                  {user.last_name && ` ${user.last_name}`}
                </span>
              </div>
              
              {user.username && (
                <div className="user-detail-row">
                  <span className="detail-label">Telegram:</span>
                  <span className="detail-value">
                    <a
                      href={`https://t.me/${user.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="telegram-link"
                    >
                      @{user.username}
                    </a>
                  </span>
                </div>
              )}
              
              <div className="user-detail-row">
                <span className="detail-label">ID:</span>
                <span className="detail-value">{user.id}</span>
              </div>
            </div>
          </div>
          
          <div className="modal-message">
            <p>Ваши данные из Telegram успешно получены.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              Нажмите "Подтвердить", чтобы отправить данные.
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button
            className="button button-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            className="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Отправка...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}

