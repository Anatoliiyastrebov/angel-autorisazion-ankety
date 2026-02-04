'use client'

import Link from 'next/link'

export default function Home() {
  const questionnaires = [
    { path: '/questionnaire/baby', name: 'Анкета для малыша' },
    { path: '/questionnaire/child', name: 'Детская анкета' },
    { path: '/questionnaire/women', name: 'Женская анкета' },
    { path: '/questionnaire/men', name: 'Мужская анкета' },
  ]

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>📋 Анкеты</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>
          Выберите анкету для заполнения
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questionnaires.map((q) => (
            <Link
              key={q.path}
              href={q.path}
              className="questionnaire-link"
              style={{
                display: 'block',
                padding: '1.5rem',
                background: '#f8f9fa',
                border: '2px solid #0088cc',
                borderRadius: '12px',
                textDecoration: 'none',
                color: '#333',
                fontSize: '1.1rem',
                fontWeight: 500,
                textAlign: 'center',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e7f3ff'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 136, 204, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f9fa'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {q.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
