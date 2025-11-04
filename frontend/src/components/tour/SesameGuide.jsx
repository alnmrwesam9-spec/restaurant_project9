// frontend/src/components/tour/SesameGuide.jsx
import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTour } from '@reactour/tour'
import { useTranslation } from 'react-i18next'

export default function SesameGuide() {
  const location = useLocation()
  const { steps, setSteps, currentStep, setCurrentStep, isOpen } = useTour()
  const removeHandlerRef = useRef(null)
  const prevPathRef = useRef(null)
  const { t, i18n } = useTranslation()

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------
  const waitFor = (selector, { timeout = 4000, interval = 60 } = {}) =>
    new Promise((resolve) => {
      if (!selector) return resolve(null)
      const t0 = performance.now()
      const iid = setInterval(() => {
        const el = document.querySelector(selector)
        const done = el || performance.now() - t0 > timeout
        if (done) {
          clearInterval(iid)
          resolve(el || null)
        }
      }, interval)
    })

  function getScrollParent(node) {
    if (!node) return null
    const isScrollable = (el) => {
      const style = getComputedStyle(el)
      return /(auto|scroll|overlay)/.test(style.overflowY)
    }
    let parent = node.parentElement
    while (parent && parent !== document.body) {
      if (isScrollable(parent)) return parent
      parent = parent.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  // --------------------------------------------------------------------------
  // Intro (avatar + welcome)
  // --------------------------------------------------------------------------
  const IntroStep = useMemo(
    () => ({
      selector: undefined,
      position: 'center',
      style: { maxWidth: 440 },
      content: () => (
        <div className="sesame-intro">
          <div className="sesame-avatar" aria-hidden>
            {/* يمكنك تغيير الصورة متى شئت */}
            <img
              src="/img/sesame-avatar.png"
              onError={(e) => {
                e.currentTarget.replaceWith(document.createTextNode('🤖'))
              }}
              alt=""
            />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="sesame-title">
              {t('tour.intro_title', 'Hi! I’m {{name}} 👋', {
                name: t('tour.sesame_name', 'Semsem'),
              })}
            </div>
            <div className="sesame-body">
              {t(
                'tour.intro_body',
                'I’ll guide you through the main actions so everything is simple. You can reopen this tour any time from the button below.'
              )}
            </div>
          </div>
        </div>
      ),
    }),
    [t]
  )

  // --------------------------------------------------------------------------
  // Steps per route
  // --------------------------------------------------------------------------
  const builtSteps = useMemo(() => {
    const path = location?.pathname || '/'

    // viewport-specific selector helper (desktop / mobile)
    let isDesktop = false
    try {
      isDesktop =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(min-width:600px)').matches
    } catch {}
    const vpSel = (base) => `${base}[data-vp=${isDesktop ? 'desktop' : 'mobile'}]`

    // ----- /menus ------------------------------------------------------------
    if (path === '/menus') {
      return [
        IntroStep,
        {
          selector: '[data-tour=menus-title]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.menus_title_note', 'Your menus live here.'),
        },
        {
          selector: '[data-tour=menu-create]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.menu_create', 'Create a new menu from this field and button.'),
        },
        {
          selector: vpSel('[data-tour=menu-go]'),
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.menu_go', 'Click to open this menu editor.'),
        },
        {
          selector: vpSel('[data-tour=dish-cards]'),
          position: isDesktop ? 'top' : 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.dish_cards', 'Your dishes will appear here once added.'),
        },

        // Allergen generator (modal) — requires user action to proceed
        {
          selector: vpSel('[data-tour=generate-allergens]'),
          position: 'bottom',
          stepInteraction: true,
          style: { maxWidth: 520 },
          content: t('tour.generate_open', 'Open the allergen code generator dialog.'),
          meta: { requireAction: true },
        },

        {
          selector: '[data-tour=allergen-toggle-force]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t('tour.force', 'Force regenerate: ignore previous results and recompute from scratch.'),
        },
        {
          selector: '[data-tour=allergen-toggle-use-llm]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t(
            'tour.use_llm_info',
            'use_llm: enable the AI assistant to suggest allergen codes from dish text.'
          ),
        },
        {
          selector: '[data-tour=allergen-toggle-llm-dry-run]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t(
            'tour.llm_dry_run_info',
            'llm_dry_run: preview only — do not save any changes. Use this first to review suggestions.'
          ),
        },
        {
          selector: '[data-tour=allergen-toggle-llm-guess-codes]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t(
            'tour.llm_guess_codes_info',
            'llm_guess_codes: ask AI to guess final codes directly in addition to terms.'
          ),
        },
        {
          selector: '[data-tour=allergen-toggle-llm-debug]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t('tour.llm_debug_info', 'llm_debug: show extra diagnostics to understand suggestions.'),
        },
        {
          selector: '[data-tour=allergen-preview]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.preview_info', 'Preview shows proposed changes without saving. Use this before Run.'),
        },
        {
          selector: '[data-tour=allergen-run]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.run_info', 'Run applies changes (or executes the previewed batch).'),
        },

        { selector: undefined, position: 'center', content: t('tour.end', 'That is it! You can relaunch this tour anytime.') },
      ]
    }

    // ----- /menus/:id --------------------------------------------------------
    if (/^\/menus\/\d+\/?$/.test(path)) {
      return [
        IntroStep,
        {
          selector: '[data-tour=section-name-input]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.section_name_input', 'Type a section name here.'),
        },
        {
          selector: '[data-tour=section-add]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.section_add', 'Click Add to create the section.'),
        },
        {
          selector: '[data-tour=section-view-dishes]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.section_view_dishes', 'Open the dishes page for this section.'),
          stepInteraction: true,
          meta: { requireAction: true, resetOnNext: true },
        },
      ]
    }

    // ----- /sections/:id/dishes ---------------------------------------------
    if (/^\/sections\/\d+\/dishes$/.test(path)) {
      return [
        IntroStep,
        {
          selector: '[data-tour=dish-form-name]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.dish_form_name', 'Enter the dish name here.'),
        },
        {
          selector: '[data-tour=dish-form-image]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t('tour.dish_form_image', 'Upload a photo for the dish.'),
        },
        {
          selector: '[data-tour=dish-form-prices]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.dish_form_prices', 'Add prices. Mark one as default.'),
        },
        {
          selector: '[data-tour=dish-save]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.dish_save', 'Save the dish when you are done.'),
        },
      ]
    }

    // ----- /show/menu/... (public page) --------------------------------------
    if (location?.pathname?.startsWith('/show/menu/')) {
      return [
        IntroStep,
        {
          selector: '[data-tour=public-search]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.public_search', 'Search the public menu by name or description.'),
        },
        {
          selector: '[data-tour=public-sections]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.public_sections', 'Jump between sections using these chips.'),
        },
        {
          selector: '[data-tour=public-dish-card]',
          position: 'right',
          style: { maxWidth: 520 },
          content: t('tour.public_dish_card', 'Tap a dish to see details.'),
        },
        {
          selector: '[data-tour=public-to-top]',
          position: 'left',
          style: { maxWidth: 420 },
          content: t('tour.public_to_top', 'Scroll back to top quickly from here.'),
        },
        {
          selector: '[data-tour=public-share]',
          position: 'left',
          style: { maxWidth: 420 },
          content: t('tour.public_share', 'Share the public link with customers or friends.'),
        },
        {
          selector: '[data-tour=public-print]',
          position: 'left',
          style: { maxWidth: 420 },
          content: t('tour.public_print', 'Print the menu page for display or backup.'),
        },
      ]
    }

    // ----- /menus/:id/public-settings ----------------------------------------
    if (/^\/menus\/\d+\/public-settings$/.test(path)) {
      return [
        IntroStep,

        // Publishing + public link & QR
        {
          selector: '[data-tour=public-settings-publish]',
          position: 'left',
          style: { maxWidth: 520 },
          content: t('tour.pub_publish', 'Publish / unpublish the menu from here.'),
        },
        {
          selector: '[data-tour=public-link-field]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.pub_link_field', 'Your public link appears here once published.'),
        },
        {
          selector: '[data-tour=public-link-open]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.pub_open', 'Open the public page in a new tab.'),
        },
        {
          selector: '[data-tour=public-link-copy]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.pub_copy', 'Copy the public link to share with customers.'),
        },
        {
          selector: '[data-tour=public-link-qr]',
          position: 'bottom',
          style: { maxWidth: 520 },
          content: t('tour.pub_download_qr', 'Download a QR code you can print and place on tables.'),
        },
        {
          selector: '[data-tour=public-qr]',
          position: 'left',
          style: { maxWidth: 520 },
          content: t('tour.pub_qr_box', 'This is the live QR preview.'),
        },

        // Theme & typography
        {
          selector: '[data-tour=theme-mode]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_theme_mode', 'Pick a preset theme or switch to Custom to unlock more controls.'),
        },
        {
          selector: '[data-tour=colors]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_colors', 'Choose background, text and accent colors.'),
        },
        {
          selector: '[data-tour=font-select]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_font', 'Select a font family for public view.'),
        },
        {
          selector: '[data-tour=font-scale]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_font_scale', 'Adjust global text scale for readability.'),
        },

        // Prices & visibility
        {
          selector: '[data-tour=price-color]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_price_color', 'Set price badge color.'),
        },
        {
          selector: '[data-tour=price-scale]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_price_scale', 'Control price size independently.'),
        },
        {
          selector: '[data-tour=visibility]',
          position: 'top',
          style: { maxWidth: 520 },
          content: t('tour.pub_visibility', 'Show or hide logo, hero, search, section names and prices.'),
        },

        // Save (interaction)
        {
          selector: '[data-tour=save]',
          position: 'top',
          style: { maxWidth: 520 },
          stepInteraction: true,
          content: t('tour.pub_save', 'Click to save your display settings.'),
        },

        { selector: undefined, position: 'center', content: t('tour.end', 'All set! You can relaunch this tour anytime.') },
      ]
    }

    // Default: Intro only
    return [IntroStep]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.pathname, t])

  // --------------------------------------------------------------------------
  // Push steps & reset when path changes
  // --------------------------------------------------------------------------
  useEffect(() => {
    setSteps(builtSteps)
    const currPath = location?.pathname || '/'
    if (prevPathRef.current !== currPath) {
      if (builtSteps.length) setCurrentStep(0)
      prevPathRef.current = currPath
    }
  }, [builtSteps, setSteps, setCurrentStep, location?.pathname])

  // --------------------------------------------------------------------------
  // Re-render current step when language changes (instant text update)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const onLang = () => {
      setSteps(builtSteps)
      setCurrentStep((s) => s) // trigger refresh without changing index
    }
    i18n.on('languageChanged', onLang)
    return () => i18n.off('languageChanged', onLang)
  }, [i18n, builtSteps, setSteps, setCurrentStep])

  // --------------------------------------------------------------------------
  // Require-action steps: lock page & advance only after user action
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      document.documentElement.classList.remove('tour-lock')
      document.body?.classList?.remove?.('tour-lock')
      if (removeHandlerRef.current) {
        removeHandlerRef.current()
        removeHandlerRef.current = null
      }
      return
    }

    // cleanup previous listener (if any)
    if (removeHandlerRef.current) {
      removeHandlerRef.current()
      removeHandlerRef.current = null
    }

    const step = steps?.[currentStep]
    const needsClick = Boolean(step?.meta?.requireAction)

    document.documentElement.classList.toggle('tour-lock', needsClick)
    try {
      document.body.classList.toggle('tour-lock', needsClick)
    } catch {}

    if (!needsClick) return

    const selector = step?.selector
    const target = selector ? document.querySelector(selector) : null
    if (!target) return

    const handler = () => {
      const next = steps?.[currentStep + 1]
      const advance = () => setCurrentStep((s) => s + 1)
      const resetOnNext = Boolean(steps?.[currentStep]?.meta?.resetOnNext)

      if (next?.selector) {
        const start = Date.now()
        const probe = async () => {
          const el = await waitFor(next.selector, { timeout: 3000, interval: 120 })
          if (el || Date.now() - start >= 3000) {
            setTimeout(() => {
              if (resetOnNext) setCurrentStep(0)
              else advance()
            }, 120)
          } else {
            setTimeout(probe, 120)
          }
        }
        setTimeout(probe, 150)
      } else {
        setTimeout(() => {
          if (resetOnNext) setCurrentStep(0)
          else advance()
        }, 300)
      }
    }

    target.addEventListener('click', handler, { once: true })
    removeHandlerRef.current = () => {
      try {
        target.removeEventListener('click', handler)
      } catch {}
    }
  }, [steps, currentStep, setCurrentStep, isOpen])

  // --------------------------------------------------------------------------
  // Auto-center current target inside nearest scrollable parent (while open)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return
    const step = steps?.[currentStep]
    if (!step) return
    const selector = step.selector
    if (!selector || selector === 'body') return

    ;(async () => {
      const el = await waitFor(selector)
      if (!el) return
      const parent = getScrollParent(el)
      try {
        const parentRect = parent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const offset =
          elRect.top - parentRect.top - parent.clientHeight / 2 + elRect.height / 2
        parent.scrollTo({ top: parent.scrollTop + offset, behavior: 'smooth' })
      } catch {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    })()
  }, [steps, currentStep, isOpen])

  return null
}
