import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Language } from '@mui/icons-material';

export default function LanguageSwitcher({ className }) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { lang } = useParams();

    const currentLang = lang || i18n.language || 'de';

    const handleLanguageChange = (newLang) => {
        if (newLang === currentLang) return;

        i18n.changeLanguage(newLang);

        // Update URL: /de/ibladish -> /ar/ibladish
        // We assume the route structure is /:lang/...
        // If we are on a route without :lang, we might need to be careful.
        // But for Ibladish page, we know it is /:lang/ibladish

        const pathSegments = location.pathname.split('/').filter(Boolean);

        // If the first segment is a language code, replace it
        if (['de', 'en', 'ar'].includes(pathSegments[0])) {
            pathSegments[0] = newLang;
        } else {
            // If no lang prefix (shouldn't happen with our new route), prepend it
            pathSegments.unshift(newLang);
        }

        const newPath = '/' + pathSegments.join('/');
        navigate(newPath);
    };

    const languages = [
        { code: 'de', label: 'DE', flag: '🇩🇪' },
        { code: 'en', label: 'EN', flag: '🇺🇸' },
        { code: 'ar', label: 'AR', flag: '🇸🇦' }
    ];

    return (
        <div className={`language-switcher ${className || ''}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Language style={{ color: '#6b7280', fontSize: '1.2rem' }} />
            <div style={{ display: 'flex', gap: '0.25rem' }}>
                {languages.map((lng) => (
                    <button
                        key={lng.code}
                        onClick={() => handleLanguageChange(lng.code)}
                        style={{
                            background: currentLang === lng.code ? '#F27141' : 'transparent',
                            color: currentLang === lng.code ? '#fff' : '#6b7280',
                            border: '1px solid',
                            borderColor: currentLang === lng.code ? '#F27141' : '#e5e7eb',
                            borderRadius: '6px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>{lng.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
