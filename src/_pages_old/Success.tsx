import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, Home, Send } from 'lucide-react';

const Success: React.FC = () => {
  const { language, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="card-wellness text-center max-w-md animate-slide-up">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            {t('thankYou')}
          </h1>

          <p className="text-lg text-muted-foreground mb-8">
            {t('successMessage')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/?lang=${language}`}
              className="btn-secondary flex items-center justify-center gap-2 flex-1"
            >
              <Home className="w-5 h-5" />
              {t('backToHome')}
            </Link>

            <Link
              to={`/?lang=${language}`}
              className="btn-primary flex items-center justify-center gap-2 flex-1"
            >
              <Send className="w-5 h-5" />
              {t('sendAnother')}
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="fixed top-1/3 left-1/4 w-32 h-32 bg-success/10 rounded-full blur-3xl pointer-events-none animate-pulse-soft" />
        <div className="fixed bottom-1/3 right-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </main>
      
      <Footer />
    </div>
  );
};

export default Success;
