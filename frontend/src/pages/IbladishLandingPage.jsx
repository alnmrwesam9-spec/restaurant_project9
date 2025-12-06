import React from 'react'
import styles from './IbladishLandingPage.module.css'
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
    Language
} from '@mui/icons-material'

export default function IbladishLandingPage() {
    return (
        <div className={styles.ibladishPage} dir="ltr">
            {/* Navbar with Logo */}
            <header className={styles.navHeader}>
                <div className={styles.navContainer}>
                    <div className={styles.logoWrapper}>
                        {/* Text/Logo Composite */}
                        <img
                            src="/assets/logo.svg"
                            alt="IBLADISH Logo"
                            className={styles.logoPartText}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <img
                            src="/assets/icon.svg"
                            alt="IBLADISH Icon"
                            className={styles.logoPartIcon}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                    <div className={styles.navActions}>
                        <button className={`${styles.btn} ${styles.btnPrimary}`}>Los geht's</button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.container}>
                    <div className={styles.heroContent}>
                        <h1 className={styles.heroTitle}>Die Speisekarte, die sich selbst aktualisiert.</h1>
                        <p className={styles.heroSubtitle}>
                            Mit IBLADISH verwaltest du deine gesamte Speisekarte an einem Ort – Änderungen sind sofort überall sichtbar, dank QR-Code & Link.
                        </p>
                        <div className={styles.heroCta}>
                            <button className={`${styles.btn} ${styles.btnPrimary}`}>
                                Jetzt kostenlos starten →
                            </button>
                            <button className={`${styles.btn} ${styles.btnSecondary}`}>
                                Demo ansehen →
                            </button>
                        </div>
                    </div>
                    <div className={styles.heroImage}>
                        <div className={`${styles.placeholderImage} ${styles.heroPlaceholder}`}>
                            <span>Dashboard Preview (Placeholder)</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem Section */}
            <section className={styles.problemSection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Problem: Was Gastronomen heute nervt</h2>
                    <div className={styles.sectionSubtitle}>
                        Veraltete Prozesse und Insellösungen kosten Zeit und Nerven.
                    </div>
                    <div className={styles.problemGrid}>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>Preise ändern → neue Speisekarten drucken</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>Allergene und Zusatzstoffe korrekt kennzeichnen</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>Website fehlt oder ist veraltet</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>QR-Codes zeigen PDF-Dateien, die nicht optimiert sind</p>
                        </div>
                        <div className={styles.problemCard}>
                            <div className={styles.problemIcon}><Close /></div>
                            <p>Zeitverlust durch Mehrfach-Änderungen</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Solution Section */}
            <section className={styles.solutionSection}>
                <div className={styles.container}>
                    <div className={styles.solutionContent}>
                        <div className={styles.solutionText}>
                            <span className={styles.solutionSubtitle}>Die Lösung – IBLADISH</span>
                            <h2 className={styles.sectionTitle} style={{ textAlign: 'left', marginBottom: '1rem' }}>
                                Alles an einem Ort. Sofort überall aktualisiert.
                            </h2>
                            <ul className={styles.solutionList}>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>Preise, Fotos, Beschreibung in Sekunden ändern</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>Live-Update auf jedem Smartphone</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>Eine digitale Speisekarte für Tische, Flyer, Website</span>
                                </li>
                                <li>
                                    <CheckCircle className={styles.solutionIcon} />
                                    <span>KI analysiert und erzeugt Allergen- & Zusatzstoffkennzeichnung automatisch</span>
                                </li>
                            </ul>
                        </div>
                        <div className={styles.solutionImage}>
                            <div className={`${styles.placeholderImage} ${styles.solutionPlaceholder}`}>
                                <span>Solution Demo (Placeholder)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className={styles.featuresSection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Hauptfunktionen</h2>
                    <div className={styles.featuresGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 01</div>
                            {/* Force larger icons via className + explicit size wrapper */}
                            <div className={styles.iconContainer}>
                                <Hub className={styles.featureIcon} />
                            </div>
                            <h3>
                                Zentrale Speisekarten-Verwaltung
                            </h3>
                            <p>Eine Änderung → überall aktualisiert.</p>
                            <p>Kein PDF, keine doppelten Versionen, kein Chaos.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 02</div>
                            <div className={styles.iconContainer}>
                                <QrCode2 className={styles.featureIcon} />
                            </div>
                            <h3>
                                QR-Code & Link für Tischkarten & Flyer
                            </h3>
                            <p>Ein Code funktioniert für immer.</p>
                            <p>Egal wie oft du die Preise änderst.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 03</div>
                            <div className={styles.iconContainer}>
                                <AutoAwesome className={styles.featureIcon} />
                            </div>
                            <h3>
                                KI-Allergen-Erkennung (einzigartig)
                            </h3>
                            <p>IBLADISH erkennt automatisch:</p>
                            <ul>
                                <li>Allergene</li>
                                <li>Zusatzstoffe</li>
                                <li>Spuren von …</li>
                            </ul>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 04</div>
                            <div className={styles.iconContainer}>
                                <Public className={styles.featureIcon} />
                            </div>
                            <h3>
                                Für Google optimiert
                            </h3>
                            <p>Deine digitale Speisekarte wird als "Digitale Menu-Page" indexiert.</p>
                            <p>Mehr Sichtbarkeit, besser für Touristen.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureNumberBadge}>Feature 05</div>
                            <div className={styles.iconContainer}>
                                <Translate className={styles.featureIcon} />
                            </div>
                            <h3>
                                Multi-Language ready (optional)
                            </h3>
                            <p>Deutsch – Arabisch – Englisch – Türkisch – etc.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className={styles.howItWorks}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Wie funktioniert das?</h2>
                    <p className={styles.sectionSubtitle} style={{ color: '#9ca3af', marginTop: 0 }}>Kurz & simpel erklärt</p>

                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <RestaurantMenu fontSize="large" />
                            </div>
                            <h3>1. Speisen anlegen</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <Print fontSize="large" />
                            </div>
                            <h3>2. QR-Code ausdrucken</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <CurrencyExchange fontSize="large" />
                            </div>
                            <h3>3. Preis ändern → sofort überall sichtbar</h3>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIconWrapper}>
                                <Smartphone fontSize="large" />
                            </div>
                            <h3>4. Gäste scannen → perfekte mobile Speisekarte</h3>
                        </div>
                    </div>
                    <p className={styles.howItWorksFooter} style={{ textAlign: 'center', marginTop: '2rem', color: '#6b7280' }}>Kein App-Download. Keine Installation.</p>
                </div>
            </section>

            {/* Why IBLADISH Section */}
            <section className={styles.whySection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Warum IBLADISH?</h2>
                    <div className={styles.comparisonTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Problem</th>
                                    <th>IBLADISH Lösung</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Teure Druckkosten bei Preisänderung</td>
                                    <td>0€ jedes Mal – QR bleibt gleich</td>
                                </tr>
                                <tr>
                                    <td>Falsche Allergene</td>
                                    <td>KI erkennt automatisch</td>
                                </tr>
                                <tr>
                                    <td>Keine Website</td>
                                    <td>Speisekarte = Mini-Website</td>
                                </tr>
                                <tr>
                                    <td>Touristen verstehen Menü nicht</td>
                                    <td>Multi-Language</td>
                                </tr>
                                <tr>
                                    <td>Unordentliche PDFs</td>
                                    <td>Moderne Web-App Speisekarte</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Social Proof Section */}
            <section className={styles.testimonials}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Social Proof – Fälle</h2>
                    <div className={styles.testimonialsGrid}>
                        <div className={styles.testimonialCard}>
                            <div className={styles.quoteIcon}>"</div>
                            <p className={styles.testimonialText}>Wir sparen 400€ Druckkosten pro Monat.</p>
                        </div>
                        <div className={styles.testimonialCard}>
                            <div className={styles.quoteIcon}>"</div>
                            <p className={styles.testimonialText}>Endlich ordentliche Allergene.</p>
                        </div>
                        <div className={styles.testimonialCard}>
                            <div className={styles.quoteIcon}>"</div>
                            <p className={styles.testimonialText}>Der QR-Code steht auf allen Tischen – läuft perfekt.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className={styles.pricingSection}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Preise</h2>
                    <div className={styles.pricingGrid}>
                        <div className={styles.pricingCard}>
                            <h3 className={styles.pricingTitle}>Free</h3>
                            <div className={styles.pricingPrice}>
                                <span className={styles.priceAmount}>0 €</span>
                                <span className={styles.pricePeriod}>/ Monat</span>
                            </div>
                            <p className={styles.pricingFeatures}>kommt bald</p>
                            <button className={`${styles.btn} ${styles.btnSecondary}`}>Bald verfügbar</button>
                        </div>
                        <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
                            <div className={styles.featuredBadge}>Empfohlen</div>
                            <h3 className={styles.pricingTitle}>Premium</h3>
                            <div className={styles.pricingPrice}>
                                <span className={styles.priceAmount}>29 €</span>
                                <span className={styles.pricePeriod}>/ Monat</span>
                            </div>
                            <p className={styles.pricingFeatures}>kommt bald</p>
                            <button className={`${styles.btn} ${styles.btnPrimary}`}>Jetzt starten</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className={styles.footerCta}>
                <div className={styles.container}>
                    <h2>Bereit, deine Speisekarte zu modernisieren?</h2>
                    <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
                        Jetzt kostenlos starten →
                    </button>
                </div>
            </section>
        </div>
    )
}
