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

        const pathSegments = location.pathname.split('/').filter(Boolean);

        if (['de', 'en', 'ar'].includes(pathSegments[0])) {
            pathSegments[0] = newLang;
        } else {
            pathSegments.unshift(newLang);
        }

        const newPath = '/' + pathSegments.join('/');
        navigate(newPath);
    };

    const languages = [
        { code: 'de', label: 'DE' },
        { code: 'en', label: 'EN' },
        { code: 'ar', label: 'AR' }
    ];

    const activeLabel = languages.find((lng) => lng.code === currentLang)?.label || currentLang.toUpperCase();

    return (
        <div className={`language-switcher ${className || ''}`}>
            <button
                type="button"
                className="language-switcher__toggle"
                aria-haspopup="listbox"
                aria-label="Change language"
            >
                <Language className="language-switcher__toggle-icon" />
                <span className="language-switcher__toggle-label">{activeLabel}</span>
            </button>

            <div className="language-switcher__list" role="listbox" aria-label="Select language">
                {languages.map((lng) => (
                    <button
                        key={lng.code}
                        type="button"
                        onClick={() => handleLanguageChange(lng.code)}
                        className={`language-switcher__option ${currentLang === lng.code ? 'is-active' : ''}`}
                        role="option"
                        aria-selected={currentLang === lng.code}
                    >
                        <span>{lng.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
