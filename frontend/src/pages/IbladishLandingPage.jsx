import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './IbladishLandingPage.module.css'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
    Close,
    Hub,
    QrCode2,
    AutoAwesome,
    Public,
    Translate,
    RestaurantMenu,
    Print,
    CurrencyExchange,
    Smartphone,
    CheckCircle,
    MenuBook,
    Speed,
    Language,
    FormatQuote
} from '@mui/icons-material'

export default function IbladishLandingPage() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { lang } = useParams()

    const supportedLangs = ['de', 'en', 'ar']
    const urlLang = lang && supportedLangs.includes(lang) ? lang : null
    const activeLang = urlLang || (supportedLangs.includes(i18n.language) ? i18n.language : 'de')
    const langPrefix = activeLang ? `/${activeLang}` : ''
    const registerPath = `${langPrefix}/register`

    useEffect(() => {
        if (urlLang && i18n.language !== urlLang) {
            i18n.changeLanguage(urlLang)
        }
    }, [urlLang, i18n])

    const isRtl = activeLang === 'ar'

    const handleStartNow = () => navigate(registerPath)
    const handleSeeSolutions = () => {
        const target = document.getElementById('solutions')
        if (target?.scrollIntoView) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
            navigate(`${langPrefix}/#solutions`)
        }
    }

    return (
        <div className={styles.ibladishPage} dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Navbar with Logo */}
            <header className={styles.navHeader}>
                <div className={styles.navContainer}>
                    <div className={styles.logoWrapper}>
                        <img
                            src="/assets/logo+icons.svg"
                            alt="IBLADISH"
                            className={styles.mainLogo}
                        />
                    </div>
                    <div className={styles.navActions} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <LanguageSwitcher />
                        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleStartNow}>
                            {t('landing.nav.cta')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.container}>
                    <div className={styles.heroContent}>
                        <h1 className={styles.heroTitle}>{t('landing.hero.title')}</h1>
                        <p className={styles.heroSubtitle}>
                            {t('landing.hero.subtitle')}
                        </p>
                        <div className={styles.heroCta}>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleStartNow}>
                                {t('landing.hero.cta_primary')}
                            </button>
                            <button className={`${styles.btn} ${styles.btnSecondary}`}>
                                {t('landing.hero.cta_secondary')}
                            </button>
                        </div>
                    </div>
                    <div className={styles.heroImage}>
                        <img
                            src="/img/desktop-hero.png"
                            alt="IBLADISH Dashboard"
                            className={styles.heroImgAsset}
                        />
                    </div>
                </div>
            </section>

            {/* Marquee Section (Clean/Restored) */}
            <section className={styles.marqueeSection}>
                <div className={styles.marqueeHeader}>{t('landing.marquee.title')}</div>
                <div className={styles.marqueeContainer}>
                    <div className={styles.marqueeTrack}>
                        {/* Set 1 */}
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Restaurant A</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Gastro Pro</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />FoodPoint</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Bistro24</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />ChefTech</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />MenuMasters</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Urban Eats</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Green Bowl</div>

                        {/* Set 2 (Duplicate for Loop) */}
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Restaurant A</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Gastro Pro</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />FoodPoint</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Bistro24</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />ChefTech</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />MenuMasters</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Urban Eats</div>
                        <div className={styles.marqueeLogo}><div className={styles.marqueeLogoIcon} />Green Bowl</div>
                    </div>
                </div>
            </section>

            {/* Problem Section */}
            <section className={styles.problemSection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>{t('landing.problem.title')}</h2>
                    <div className={styles.sectionSubtitle}>
                        {t('landing.problem.subtitle')}
                    </div>
                    <div className={styles.problemGrid}>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>{t('landing.problem.cards.1')}</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>{t('landing.problem.cards.2')}</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>{t('landing.problem.cards.3')}</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>{t('landing.problem.cards.4')}</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>{t('landing.problem.cards.5')}</p>
                        </div>
                    </div>
                    <div className={styles.problemHint}>
                        <button type="button" className={styles.hintCta} onClick={handleSeeSolutions}>
                            <span className={styles.hintArrow} aria-hidden="true">↓</span>
                            <span className={styles.hintText}>{t('landing.solution.subtitle')}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Solution Section (Creative Image) */}
            <section className={styles.solutionSection} id="solutions">
                <div className={styles.container}>
                    <div className={styles.solutionContent}>
                        <div className={styles.solutionText}>
                            <span className={styles.solutionSubtitle}>{t('landing.solution.subtitle')}</span>
                            <h2 className={styles.sectionTitle} style={{ marginBottom: '1rem' }}>
                                {t('landing.solution.title')}
                            </h2>
                            <ul className={styles.solutionList}>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>{t('landing.solution.list.1')}</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>{t('landing.solution.list.2')}</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>{t('landing.solution.list.3')}</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>{t('landing.solution.list.4')}</span>
                                </li>
                            </ul>
                        </div>
                        {/* Creative Image Wrapper */}
                        <div className={styles.creativeWrapper}>
                            <div className={`${styles.creativeShape} ${styles.shapeOrange}`} />
                            <div className={`${styles.creativeShape} ${styles.shapeBlue}`} />
                            <div className={styles.creativeImageCard}>
                                <div className={styles.mockBrowserHeader}>
                                    <div className={`${styles.mockDot} ${styles.dotRed}`} />
                                    <div className={`${styles.mockDot} ${styles.dotYellow}`} />
                                    <div className={`${styles.mockDot} ${styles.dotGreen}`} />
                                </div>
                                <div className={styles.mockContent}>
                                    <div className={styles.mockHero}>{t('landing.solution.dashboard')}</div>
                                    <div className={styles.mockSkeletonBlock} style={{ width: '60%' }} />
                                    <div className={styles.mockSkeletonBlock} style={{ width: '90%' }} />
                                    <div className={styles.mockSkeletonBlock} style={{ width: '85%' }} />
                                    <div className={styles.mockSkeletonBlock} style={{ width: '50%', marginTop: 'auto' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className={styles.featuresSection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>{t('landing.features.title')}</h2>
                    <div className={styles.featuresGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 01</div>
                            <div className={styles.iconContainer}>
                                <Hub className={styles.featureIcon} />
                            </div>
                            <h3>{t('landing.features.cards.1.title')}</h3>
                            <p>{t('landing.features.cards.1.desc1')}</p>
                            <p>{t('landing.features.cards.1.desc2')}</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 02</div>
                            <div className={styles.iconContainer}>
                                <QrCode2 className={styles.featureIcon} />
                            </div>
                            <h3>{t('landing.features.cards.2.title')}</h3>
                            <p>{t('landing.features.cards.2.desc1')}</p>
                            <p>{t('landing.features.cards.2.desc2')}</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 03</div>
                            <div className={styles.iconContainer}>
                                <AutoAwesome className={styles.featureIcon} />
                            </div>
                            <h3>{t('landing.features.cards.3.title')}</h3>
                            <p>{t('landing.features.cards.3.desc1')}</p>
                            <ul>
                                <li>{t('landing.features.cards.3.list_items.1')}</li>
                                <li>{t('landing.features.cards.3.list_items.2')}</li>
                                <li>{t('landing.features.cards.3.list_items.3')}</li>
                            </ul>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 04</div>
                            <div className={styles.iconContainer}>
                                <Public className={styles.featureIcon} />
                            </div>
                            <h3>{t('landing.features.cards.4.title')}</h3>
                            <p>{t('landing.features.cards.4.desc1')}</p>
                            <p>{t('landing.features.cards.4.desc2')}</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 05</div>
                            <div className={styles.iconContainer}>
                                <Translate className={styles.featureIcon} />
                            </div>
                            <h3>{t('landing.features.cards.5.title')}</h3>
                            <p>{t('landing.features.cards.5.desc1')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className={styles.howItWorks}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>{t('landing.how_it_works.title')}</h2>
                    <p className={styles.sectionSubtitle} style={{ color: '#9ca3af', marginTop: 0 }}>
                        {t('landing.how_it_works.subtitle')}
                    </p>

                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <RestaurantMenu fontSize="large" />
                            </div>
                            <h3>1. {t('landing.how_it_works.steps.1')}</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <Print fontSize="large" />
                            </div>
                            <h3>2. {t('landing.how_it_works.steps.2')}</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <CurrencyExchange fontSize="large" />
                            </div>
                            <h3>3. {t('landing.how_it_works.steps.3')}</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <Smartphone fontSize="large" />
                            </div>
                            <h3>4. {t('landing.how_it_works.steps.4')}</h3>
                        </div>
                    </div>
                    <p className={styles.howItWorksFooter} style={{ textAlign: 'center', marginTop: '2rem', color: '#6b7280' }}>
                        {t('landing.how_it_works.footer')}
                    </p>
                </div>
            </section>

            {/* Why IBLADISH Section */}
            <section className={styles.whySection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>{t('landing.why.title')}</h2>
                    <div className={styles.comparisonTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('landing.why.table.col_problem')}</th>
                                    <th>{t('landing.why.table.col_solution')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{t('landing.why.table.rows.1.prob')}</td>
                                    <td>{t('landing.why.table.rows.1.sol')}</td>
                                </tr>
                                <tr>
                                    <td>{t('landing.why.table.rows.2.prob')}</td>
                                    <td>{t('landing.why.table.rows.2.sol')}</td>
                                </tr>
                                <tr>
                                    <td>{t('landing.why.table.rows.3.prob')}</td>
                                    <td>{t('landing.why.table.rows.3.sol')}</td>
                                </tr>
                                <tr>
                                    <td>{t('landing.why.table.rows.4.prob')}</td>
                                    <td>{t('landing.why.table.rows.4.sol')}</td>
                                </tr>
                                <tr>
                                    <td>{t('landing.why.table.rows.5.prob')}</td>
                                    <td>{t('landing.why.table.rows.5.sol')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Social Proof (Replit-Style Scroll) */}
            <section className={styles.testimonials}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>{t('landing.testimonials.title')}</h2>
                    <p className={styles.sectionSubtitle}>{t('landing.testimonials.subtitle')}</p>

                    {/* Horizontal Scroll Container */}
                    <div className={styles.testimonialsScrollWrapper}>
                        <div className={styles.testimonialsGrid}>
                            {/* Card 1 */}
                            <div className={styles.testimonialCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardLogo}>⭐⭐⭐⭐⭐</div>
                                </div>
                                <p className={styles.testimonialText}>
                                    {t('landing.testimonials.cards.1.text')}
                                </p>
                                <div className={styles.testimonialAuthor}>
                                    <div className={styles.avatar} style={{ backgroundColor: '#06D6A0' }}>TB</div>
                                    <div className={styles.authorMeta}>
                                        <h4>{t('landing.testimonials.cards.1.author')}</h4>
                                        <span>{t('landing.testimonials.cards.1.role')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2 (Featured) */}
                            <div className={`${styles.testimonialCard} ${styles.testimonialFeatured}`}>
                                <div className={styles.cardBadge}>{t('landing.testimonials.cards.2.badge')}</div>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardLogo}>{t('landing.testimonials.cards.2.logo')}</div>
                                </div>
                                <p className={styles.testimonialText}>
                                    {t('landing.testimonials.cards.2.text')}
                                </p>
                                <div className={styles.testimonialAuthor}>
                                    <div className={styles.avatar} style={{ backgroundColor: '#F27141' }}>AK</div>
                                    <div className={styles.authorMeta}>
                                        <h4>{t('landing.testimonials.cards.2.author')}</h4>
                                        <span>{t('landing.testimonials.cards.2.role')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className={styles.testimonialCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardLogo}>⭐⭐⭐⭐⭐</div>
                                </div>
                                <p className={styles.testimonialText}>
                                    {t('landing.testimonials.cards.3.text')}
                                </p>
                                <div className={styles.testimonialAuthor}>
                                    <div className={styles.avatar} style={{ backgroundColor: '#118AB2' }}>SL</div>
                                    <div className={styles.authorMeta}>
                                        <h4>{t('landing.testimonials.cards.3.author')}</h4>
                                        <span>{t('landing.testimonials.cards.3.role')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4 */}
                            <div className={styles.testimonialCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardLogo}>⭐⭐⭐⭐⭐</div>
                                </div>
                                <p className={styles.testimonialText}>
                                    {t('landing.testimonials.cards.4.text')}
                                </p>
                                <div className={styles.testimonialAuthor}>
                                    <div className={styles.avatar} style={{ backgroundColor: '#FFD166', color: '#333' }}>MW</div>
                                    <div className={styles.authorMeta}>
                                        <h4>{t('landing.testimonials.cards.4.author')}</h4>
                                        <span>{t('landing.testimonials.cards.4.role')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className={styles.pricingSection}>
                <div className={styles.pricingBgShape} />
                <div className={styles.container}>
                    <h2 className={styles.pricingHeading}>{t('landing.pricing.title')}</h2>
                    <p className={styles.pricingSubtitle}>{t('landing.pricing.subtitle')}</p>

                    <div className={styles.pricingGrid}>
                        <div className={styles.pricingCard}>
                            <h3 className={styles.pricingTitle}>{t('landing.pricing.free.title')}</h3>
                            <div className={styles.pricingPrice}>
                                <span className={styles.priceAmount}>0 €</span>
                                <span className={styles.pricePeriod}>{t('landing.pricing.free.period')}</span>
                            </div>
                            <p className={styles.pricingFeatures}>{t('landing.pricing.free.features')}</p>
                            <button className={`${styles.btn} ${styles.btnSecondary}`}>{t('landing.pricing.free.cta')}</button>
                        </div>

                        <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
                            <div className={styles.featuredBadge}>{t('landing.pricing.premium.badge')}</div>
                            <h3 className={styles.pricingTitle}>{t('landing.pricing.premium.title')}</h3>
                            <div className={styles.pricingPrice}>
                                <span className={styles.priceAmount}>29 €</span>
                                <span className={styles.pricePeriod}>{t('landing.pricing.premium.period')}</span>
                            </div>
                            <p className={styles.pricingFeatures}>{t('landing.pricing.premium.features')}</p>
                            <button className={`${styles.btn} ${styles.btnPrimary}`}>{t('landing.pricing.premium.cta')}</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className={styles.footerCta}>
                <div className={styles.container}>
                    <h2>{t('landing.footer.title')}</h2>
                    <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
                        {t('landing.footer.cta')}
                    </button>
                </div>
            </section>
        </div>
    )
}
