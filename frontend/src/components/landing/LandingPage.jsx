import React, { useEffect, useRef, useState } from "react";
import {
  HERO,
  HOW_IT_WORKS,
  FEATURES,
  COMMUNITY,
  BOTTOM_CTA,
  FOOTER,
  PHONE_PINS,
  PHONE_USER_LOCATION,
} from "./landingConstants";
import {
  LocationIcon,
  SearchIcon,
  ChatIcon,
  MapIcon,
  ChatFeatureIcon,
  ClockIcon,
  WalletIcon,
  ReportsIcon,
  SignupIcon,
  StarIcon,
} from "./landingIcons";
import "./LandingPage.css";

const STEP_ICON_MAP = {
  location: LocationIcon,
  search: SearchIcon,
  chat: ChatIcon,
};

const FEATURE_ICON_MAP = {
  map: MapIcon,
  chatFeature: ChatFeatureIcon,
  clock: ClockIcon,
  wallet: WalletIcon,
  reports: ReportsIcon,
  signup: SignupIcon,
};

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

/* ─── Hero ─── */
function HeroSection({ onOpenApp, onLearnMore }) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <div className="hero-phone">
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-map-grid" />
              {PHONE_PINS.map((pin, i) => (
                <span
                  key={i}
                  className="phone-pin"
                  style={{
                    top: pin.top,
                    left: pin.left,
                    "--pin-size": `${pin.size}px`,
                    animationDelay: `${pin.delay}s`,
                  }}
                >
                  <svg width={pin.size} height={Math.round(pin.size * 1.35)} viewBox="0 0 24 32" fill="none">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill={pin.color} />
                    <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9" />
                  </svg>
                </span>
              ))}
              <span
                className="phone-user-location"
                style={{
                  top: PHONE_USER_LOCATION.top,
                  left: PHONE_USER_LOCATION.left,
                  "--loc-size": `${PHONE_USER_LOCATION.size}px`,
                  animationDelay: `${PHONE_USER_LOCATION.delay}s`,
                }}
              >
                <svg width={PHONE_USER_LOCATION.size} height={PHONE_USER_LOCATION.size} viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#4285F4" opacity="0.18" />
                  <circle cx="24" cy="24" r="16" fill="#4285F4" opacity="0.25" />
                  <circle cx="24" cy="24" r="10" fill="#4285F4" />
                  <path d="M24 16l4 12-4-3-4 3z" fill="#fff" />
                </svg>
              </span>
            </div>
            <div className="phone-home-bar" />
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">{HERO.title}</h1>
          <p className="hero-subtitle">{HERO.subtitle}</p>
          <div className="hero-buttons">
            <button type="button" className="btn-primary" onClick={onOpenApp}>
              {HERO.ctaPrimary}
            </button>
            <button type="button" className="btn-secondary" onClick={onLearnMore}>
              <svg className="btn-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6l4 4 4-4" />
              </svg>
              {HERO.ctaSecondary}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorksSection({ sectionRef }) {
  const [ref, visible] = useInView();

  return (
    <section className="landing-how" ref={sectionRef}>
      <div className="section-bar" />
      <div className="landing-container" ref={ref}>
        <h2 className="section-title">{HOW_IT_WORKS.title}</h2>
        <p className="section-subtitle">{HOW_IT_WORKS.subtitle}</p>

        <div className="how-steps">
          {HOW_IT_WORKS.steps.map((step, i) => {
            const Icon = STEP_ICON_MAP[step.icon];
            return (
              <div
                key={step.number}
                className={`how-step ${visible ? "how-step--visible" : ""}`}
                style={{ transitionDelay: `${i * 0.15}s` }}
              >
                <div
                  className="step-icon-wrapper"
                  style={{ "--icon-color": step.color }}
                >
                  <Icon />
                </div>
                <span className="step-number">{step.number}</span>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */
function FeaturesSection() {
  const [ref, visible] = useInView();

  return (
    <section className="landing-features">
      <div className="landing-container" ref={ref}>
        <h2 className="section-title">{FEATURES.title}</h2>
        <p className="section-subtitle">{FEATURES.subtitle}</p>

        <div className="features-grid">
          {FEATURES.items.map((feat, i) => {
            const Icon = FEATURE_ICON_MAP[feat.icon];
            return (
              <div
                key={feat.title}
                className={`feature-card ${visible ? "feature-card--visible" : ""}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div
                  className="feature-icon-wrapper"
                  style={{ "--feat-color": feat.color }}
                >
                  <Icon />
                </div>
                <h3 className="feature-title">{feat.title}</h3>
                <p className="feature-desc">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Community ─── */
function CommunitySection() {
  const [ref, visible] = useInView();

  return (
    <section className="landing-community">
      <div className="landing-container" ref={ref}>
        <div className="community-header">
          <span className="community-icon-badge">
            <SignupIcon />
          </span>
          <h2 className="section-title">{COMMUNITY.title}</h2>
        </div>
        <p className="section-subtitle">{COMMUNITY.subtitle}</p>
        <span className="community-badge">{COMMUNITY.badge}</span>

        <div className="testimonials-row">
          {COMMUNITY.testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`testimonial-card ${visible ? "testimonial-card--visible" : ""}`}
              style={{ transitionDelay: `${i * 0.15}s` }}
            >
              <div className="testimonial-stars">
                {[...Array(5)].map((_, j) => (
                  <StarIcon key={j} />
                ))}
              </div>
              <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
              <div className="testimonial-author">
                <div
                  className="author-avatar"
                  style={{ background: t.color }}
                >
                  {t.initial}
                </div>
                <div>
                  <div className="author-name">{t.name}</div>
                  <div className="author-hood">{t.neighborhood}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="stats-row">
          {COMMUNITY.stats.map((s) => (
            <div key={s.label} className="stat-item">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bottom CTA ─── */
function BottomCtaSection({ onOpenApp }) {
  return (
    <section className="landing-bottom-cta">
      <div className="landing-container bottom-cta-inner">
        <div className="bottom-cta-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <h2 className="bottom-cta-title">{BOTTOM_CTA.title}</h2>
        <p className="bottom-cta-subtitle">{BOTTOM_CTA.subtitle}</p>
        <button type="button" className="bottom-cta-button" onClick={onOpenApp}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {BOTTOM_CTA.ctaLabel}
        </button>
        <p className="bottom-cta-mobile-label">{BOTTOM_CTA.mobileLabel}</p>
        <div className="store-badges">
          {BOTTOM_CTA.stores.map((store) => (
            <a
              key={store.name}
              href={store.href}
              className="store-badge"
              target="_blank"
              rel="noopener noreferrer"
            >
              {store.name === "App Store" ? (
                <svg className="store-badge-icon" width="20" height="24" viewBox="0 0 814 1000" fill="currentColor">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.3-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.5-317.3 79.5 0 145.6 52.7 195.2 52.7 47.4 0 121.6-55.8 211.8-55.8 16.2.1 128.3 1.7 198.2 107.4zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
                </svg>
              ) : (
                <svg className="store-badge-icon" width="20" height="22" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
                </svg>
              )}
              <div className="store-badge-text">
                <span className="store-badge-small">{store.label}</span>
                <span className="store-badge-name">{store.name}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function FooterSection() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3 className="footer-logo">{FOOTER.brand}</h3>
            <p className="footer-desc">{FOOTER.description}</p>
          </div>
          <div className="footer-links">
            <h4>{FOOTER.links.title}</h4>
            <ul>
              {FOOTER.links.items.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-contact">
            <h4>{FOOTER.contact.title}</h4>
            <a href={`mailto:${FOOTER.contact.email}`}>
              {FOOTER.contact.email}
            </a>
            <p>{FOOTER.contact.description}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-social">
            {FOOTER.social.map((s) => (
              <a key={s} href="#" className="social-link">
                {s}
              </a>
            ))}
          </div>
          <span className="footer-copy">{FOOTER.copyright}</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main ─── */
export default function LandingPage({ onOpenApp }) {
  const howRef = useRef(null);

  const scrollToHow = () => {
    howRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-page">
      <HeroSection onOpenApp={onOpenApp} onLearnMore={scrollToHow} />
      <HowItWorksSection sectionRef={howRef} />
      <FeaturesSection />
      {/* <CommunitySection /> */}
      <BottomCtaSection onOpenApp={onOpenApp} />
      <FooterSection />
    </div>
  );
}
