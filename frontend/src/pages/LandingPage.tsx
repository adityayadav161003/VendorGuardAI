import React, { useEffect, useRef, useState } from 'react';
import { lazy, Suspense } from 'react';
import {
  motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence,
} from 'framer-motion';
import {
  ArrowRight, FileText, ShieldCheck, CheckCircle2, XCircle, HelpCircle,
  Lock, Eye, ScanLine, Landmark, Scale, BadgeCheck,
} from 'lucide-react';
import Lenis from 'lenis';
import { Crest } from '../components/Brand';

const Network3D = lazy(() =>
  import('../components/three/Network3D').then(m => ({ default: m.Network3D })),
);

/* ────────────────────────────────────────────────────────────────────
   Honest demo data — clearly labelled synthetic, mirrors real engine output
   (GSTIN checksum-valid, real finding types, real claim labels).
──────────────────────────────────────────────────────────────────── */
const DEMO_DOCS = [
  { icon: FileText, label: 'GST Certificate', tint: '#5F6D3B' },
  { icon: BadgeCheck, label: 'PAN Card', tint: '#B9975B' },
  { icon: Landmark, label: 'Bank Letter', tint: '#775731' },
  { icon: ScanLine, label: 'ISO Certificate', tint: '#4C572F' },
  { icon: Scale, label: 'Invoice', tint: '#96763F' },
];

const DEMO_FIELDS = [
  { label: 'GSTIN', value: '27AAACV1234C1ZP', confidence: 0.98, snippet: 'GSTIN 27AAACV1234C1ZP registered to Veridian Packaging, Status: Active' },
  { label: 'PAN', value: 'AAACV1234C', confidence: 0.97, snippet: 'PAN AAACV1234C — permanent account number card' },
  { label: 'Bank holder', value: 'Veridian Packaging Industries', confidence: 0.93, snippet: 'Account 123456789012 under name "Veridian Packaging Industries", IFSC HDFC0000123' },
  { label: 'ISO expiry', value: '31-12-2027', confidence: 0.94, snippet: 'ISO 9001:2015 Certificate expiry date: 31-12-2027' },
];

const CLAIM_STATES = [
  {
    icon: CheckCircle2, label: 'Supported', tone: '#7D9464', chip: 'bg-olive-100 text-olive-800 border-olive-300',
    claim: 'The GSTIN 27AAACV1234C1ZP embeds the matching PAN AAACV1234C.',
    evidence: 'GST Certificate · p.1 — "GSTIN 27AAACV1234C1ZP (PAN AAACV1234C) registered, Active."',
    confidence: 0.97,
  },
  {
    icon: XCircle, label: 'Contradicted', tone: '#B0563A', chip: 'bg-[#F4DED4] text-terracotta-deep border-terracotta/40',
    claim: 'The bank account is held in the name of Veridian Global Trading LLC.',
    evidence: 'Cancelled Cheque · p.1 — holder "Veridian Global Trading LLC" contradicts registered name.',
    confidence: 0.91,
  },
  {
    icon: HelpCircle, label: 'Insufficient evidence', tone: '#C29B4A', chip: 'bg-[#F3E7C9] text-gold-deep border-brass/50',
    claim: 'The supplier holds an ISO 22000 food-safety certification.',
    evidence: 'No document on file mentions ISO 22000 — nothing to verify against, so no verdict.',
    confidence: 0.4,
  },
];

const SPEC_CHECKS = [
  { n: 'GSTIN', d: '15-character structure, state code, embedded PAN, entity code and the base-36 checksum digit.' },
  { n: 'PAN', d: '5+4+1 pattern with the entity-type letter validated.' },
  { n: 'CIN', d: '21-character ministry structure check.' },
  { n: 'IFSC', d: '4 letters, a zero, 6 alphanumerics.' },
  { n: 'Expiry', d: 'Certificate expiry parsed and dated, flagged at 60 days.' },
  { n: 'Prices', d: 'IQR outlier detection across quoted amounts.' },
  { n: 'Bank', d: 'Holder name vs registered legal name, fuzzy-matched conservatively.' },
];

/* Cursor-reactive tilt hook */
function useTilt(max = 7) {
  const rx = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const ry = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max * 2); rx.set(-py * max * 2);
  };
  const reset = () => { rx.set(0); ry.set(0); };
  return { rx, ry, onMouseMove, reset };
}

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-deep';

/* ════════════════════════════════════════════════════════════════════ */

export const LandingPage: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [navCondensed, setNavCondensed] = useState(false);

  // Lenis smooth scrolling (skipped for reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.11 });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  useEffect(() => scrollY.on('change', v => setNavCondensed(v > 48)), [scrollY]);

  const go = () => { onEnter(); };

  return (
    <div ref={pageRef} className="bg-[var(--surface-0)] text-espresso selection:bg-olive-600 selection:text-cream-50">
      <LandingNav condensed={navCondensed} onEnter={go} />
      <Hero onEnter={go} />
      <TheProblem />
      <VerifyEvidence />
      <VerifyAI />
      <NetworkSection />
      <SpecGrid />
      <TrustAndLimits />
      <FinalCTA onEnter={go} />
      <footer className="border-t border-white/[0.06] bg-[#0B0D0A] py-8 text-center text-xs text-cream-100/40">
        VendorGuard AI — decision-support supplier verification. Every claim links to evidence, or is labelled Insufficient.
      </footer>
    </div>
  );
};

/* ── Sticky translucent nav, condenses on scroll ─────────────────── */
const LandingNav: React.FC<{ condensed: boolean; onEnter: () => void }> = ({ condensed, onEnter }) => (
  <motion.header
    initial={{ y: -70, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className="fixed top-0 inset-x-0 z-50 glass-dark transition-all duration-300"
    style={{ background: condensed ? 'rgba(11,13,10,0.82)' : 'rgba(11,13,10,0.55)' }}
  >
    <div className={`max-w-[1200px] mx-auto px-6 flex items-center justify-between transition-all duration-300 ${condensed ? 'py-2.5' : 'py-4'}`}>
      <div className="flex items-center gap-2.5">
        <Crest className={condensed ? 'w-8 h-8' : 'w-10 h-10'} />
        <span className="font-display text-lg font-semibold text-cream-100 tracking-tight">VendorGuard</span>
        <span className="text-[9px] font-bold tracking-[0.22em] px-1.5 py-0.5 rounded border border-brass/60 text-brass-light">AI</span>
      </div>
      <button onClick={onEnter} className="btn-primary !rounded-full">
        Start verifying <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </motion.header>
);

/* ── 1 · Hero ─────────────────────────────────────────────────────── */
const Hero: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const { rx, ry, onMouseMove, reset } = useTilt(6);
  const parallaxY = useTransform(useScroll().scrollY, [0, 600], [0, 90]);

  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden">
      <motion.div style={{ y: parallaxY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-6%] w-[38rem] h-[38rem] rounded-full bg-olive-500/10 blur-3xl" />
        <div className="absolute bottom-[-16%] right-[-4%] w-[34rem] h-[34rem] rounded-full bg-brass/15 blur-3xl" />
      </motion.div>

      <div className="max-w-[1200px] mx-auto px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center w-full">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-deep border border-brass/40 rounded-full px-3 py-1"
          >
            <Lock className="w-3 h-3" /> Evidence-grounded supplier verification
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-semibold mt-6"
            style={{ fontSize: 'var(--text-display)', letterSpacing: 'var(--track-display)', lineHeight: 'var(--leading-display)' }}
          >
            Every claim,<br />linked to <span className="italic text-olive-700 dark:text-olive-300">evidence</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-lg max-w-[52ch] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            VendorGuard reads your suppliers' documents, cross-checks every identifier,
            and verifies its own report claim-by-claim — Supported, Contradicted, or Insufficient.
            Nothing ships without a source.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex items-center gap-3 flex-wrap"
          >
            <button onClick={onEnter} className="btn-primary !px-7 !py-3 !text-[15px] !rounded-full">
              Start verifying <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#verify-ai" className="btn-ghost !px-7 !py-3 !text-[15px] !rounded-full">
              See it work
            </a>
          </motion.div>
        </div>

        {/* Live-rendered report card, cursor-reactive */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: 1100 }}
          className="hidden lg:block"
        >
          <motion.div
            onMouseMove={onMouseMove} onMouseLeave={reset}
            style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
            className="card-premium !rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <span className={sectionLabel}>Live report · synthetic demo</span>
              <span className="badge-success"><ShieldCheck className="w-3 h-3" /> Assessed</span>
            </div>
            <p className="font-display text-2xl font-semibold">Veridian Packaging Industries</p>
            <div className="mt-5 flex items-center gap-6">
              <ScoreRing value={87} />
              <div className="space-y-2.5 flex-1">
                {[
                  ['Identity', 96], ['Documents', 92], ['Financial', 88],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium">{k}</span>
                      <span className="font-mono font-bold">{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-olive-500 to-olive-700"
                        initial={{ width: 0 }} animate={{ width: `${v}%` }}
                        transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <Eye className="w-3.5 h-3.5" /> 4 of 4 claims linked to cited evidence
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const ScoreRing: React.FC<{ value: number }> = ({ value }) => {
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 84 84" className="w-24 h-24 -rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <motion.circle
          cx="42" cy="42" r={R} fill="none" stroke="url(#heroGrad)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - value / 100) }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#77854A" /><stop offset="100%" stopColor="#B9975B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>/ 100</span>
      </div>
    </div>
  );
};

/* ── 2 · The problem: messy docs → structured profile ────────────── */
const TheProblem: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const snap = useTransform(scrollYProgress, [0, 0.55], [0, 1]);
  const reveal = useTransform(scrollYProgress, [0.55, 0.9], [0, 1]);

  return (
    <section ref={ref} className="relative h-[300vh] bg-[#0B0D0A]">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <span className={sectionLabel + ' !text-brass-light'}>The problem</span>
        <h2
          className="font-display font-semibold text-cream-100 text-center mt-4 mb-10 max-w-4xl"
          style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.1 }}
        >
          Onboarding starts with a pile of PDFs.<br />
          <span className="text-cream-100/50">Someone reads all of it. Usually badly.</span>
        </h2>

        {/* scattered documents */}
        <div className="relative w-full max-w-3xl h-64">
          {DEMO_DOCS.map((doc, i) => {
            const scatterX = (i - 2) * 130;
            return (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 w-40"
                style={{ x: '-50%', y: '-50%' }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  initial={{ x: scatterX, y: (i % 2 ? 90 : -90), rotate: (i - 2) * 9, scale: 1 }}
                  style={{ opacity: useTransform(snap, [0, 0.5], [1, 0.15]) }}
                  animate={{}}
                >
                  <ScrollSnapItem progress={snap} index={i} scatterX={scatterX} scatterY={i % 2 ? 90 : -90} scatterR={(i - 2) * 9}>
                    <div className="glass-light rounded-xl p-3.5 flex items-center gap-2.5 shadow-lifted">
                      <doc.icon className="w-4 h-4" style={{ color: doc.tint }} />
                      <span className="text-xs font-semibold text-espresso">{doc.label}</span>
                    </div>
                  </ScrollSnapItem>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* structured profile emerges */}
        <motion.div
          style={{ opacity: reveal, scale: useTransform(reveal, [0, 1], [0.92, 1]) }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,620px)] card-premium !rounded-3xl p-7"
        >
          <span className={sectionLabel}>Structured supplier profile</span>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['GSTIN · valid checksum', 'PAN · embedded match', 'Bank · holder verified', 'ISO · valid 400d', 'Directors · 2 on file', 'Invoices · no anomalies'].map(t => (
              <div key={t} className="flex items-center gap-2 text-xs font-medium p-2.5 rounded-lg bg-[var(--surface-2)]">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-deep shrink-0" /> {t}
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>
            Synthetic demo profile — the workspace produces this from real uploads.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const ScrollSnapItem: React.FC<{
  progress: any; index: number; scatterX: number; scatterY: number; scatterR: number; children: React.ReactNode;
}> = ({ progress, index, scatterX, scatterY, scatterR, children }) => {
  const x = useTransform(progress, [0, 0.5], [scatterX, (index - 2) * 10]);
  const y = useTransform(progress, [0, 0.5], [scatterY, -140]);
  const rotate = useTransform(progress, [0, 0.5], [scatterR, 0]);
  return <motion.div style={{ x, y, rotate }}>{children}</motion.div>;
};

/* ── 3 · Verify the Evidence ─────────────────────────────────────── */
const VerifyEvidence: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', v => {
    setActive(Math.min(DEMO_FIELDS.length - 1, Math.max(0, Math.floor(v * DEMO_FIELDS.length * 1.15))));
  });

  const field = DEMO_FIELDS[active];

  return (
    <section ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden px-6">
        <div className="max-w-[1200px] mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className={sectionLabel}>Verify the evidence</span>
            <h2
              className="font-display font-semibold mt-4"
              style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.08 }}
            >
              Extracted fields<br />with their <span className="italic text-olive-700 dark:text-olive-300">receipts</span>.
            </h2>
            <p className="mt-5 max-w-[46ch] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Every value carries the page it came from, the snippet around it, and a
              confidence score. Click through, doubt it, check it.
            </p>

            <div className="mt-8 space-y-2.5">
              {DEMO_FIELDS.map((f, i) => (
                <div
                  key={f.label}
                  className={`p-3.5 rounded-xl border transition-all duration-300 ${
                    i === active ? 'border-brass bg-[var(--surface-1)] shadow-brass' : 'border-[var(--border-subtle)] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">{f.label}</span>
                    <span className="badge-success !text-[10px]">{Math.round(f.confidence * 100)}%</span>
                  </div>
                  <div className="font-mono text-sm mt-1">{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* source receipt panel */}
          <div className="card-premium !rounded-3xl p-7">
            <span className={sectionLabel}>Source receipt</span>
            <div className="mt-5 font-mono text-[13px] leading-relaxed p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={field.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  …{field.snippet}…
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Synthetic demo document · p.1</span>
              <motion.span
                key={`c-${active}`}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="font-mono font-bold text-olive-700 dark:text-olive-300"
              >
                {(field.confidence * 100).toFixed(0)}% confidence
              </motion.span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// tiny helper — framer-motion event subscription as a hook-compatible call
function useMotionValueEvent(value: any, event: string, handler: (v: number) => void) {
  useEffect(() => value.on(event, handler), [value, event, handler]);
}

/* ── 4 · Verify the AI — signature moment ────────────────────────── */
const VerifyAI: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useRef(false);
  const [idx, setIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    const id = setInterval(() => {
      if (!inView.current) return;
      setDrawerOpen(false);
      setIdx(i => (i + 1) % CLAIM_STATES.length);
      setTimeout(() => inView.current && setDrawerOpen(true), 900);
    }, 3200);
    return () => { clearInterval(id); io.disconnect(); };
  }, []);

  const state = CLAIM_STATES[idx];

  return (
    <section id="verify-ai" ref={ref} className="relative py-40 bg-[#0B0D0A] overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(40rem 24rem at 80% 20%, rgba(119,133,74,0.25), transparent 60%)' }} />
      <div className="max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center relative">
        <div>
          <span className={sectionLabel + ' !text-brass-light'}>Verify the AI</span>
          <h2
            className="font-display font-semibold text-cream-100 mt-4"
            style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.08 }}
          >
            The AI checks<br /><span className="italic text-brass-light">itself</span> before you read it.
          </h2>
          <p className="mt-5 max-w-[48ch] leading-relaxed text-cream-100/65">
            Every sentence the analyst writes is deconstructed into atomic claims and tested
            against stored evidence. Three outcomes exist — and "I don't know" is one of them.
          </p>
          <div className="mt-7 flex items-center gap-2 flex-wrap">
            {CLAIM_STATES.map((s, i) => (
              <span key={s.label} className={`badge ${i === idx ? '' : 'opacity-40'} ${s.chip}`}>
                <s.icon className="w-3 h-3" /> {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* cycling claim card + evidence drawer */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 26, rotateX: 5 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -22 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              className="card-premium !rounded-3xl p-7"
            >
              <div className="flex items-center justify-between">
                <span className={`badge ${state.chip}`}>
                  <state.icon className="w-3.5 h-3.5" /> {state.label}
                </span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  confidence {state.confidence.toFixed(2)}
                </span>
              </div>
              <p className="font-display text-xl leading-snug mt-5">“{state.claim}”</p>
              <motion.div
                animate={{ height: drawerOpen ? 'auto' : 0, opacity: drawerOpen ? 1 : 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-5 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-[12px] leading-relaxed">
                  {state.evidence}
                </div>
              </motion.div>
              <div className="mt-4 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <motion.div
                  key={`bar-${idx}`}
                  className="h-full rounded-full"
                  style={{ background: state.tone }}
                  initial={{ width: '0%' }} animate={{ width: '100%' }}
                  transition={{ duration: 3.0, ease: 'linear' }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

/* ── 5 · See the network ─────────────────────────────────────────── */
const NetworkSection: React.FC = () => {
  const demoPayload = {
    supplier_id: 'demo',
    nodes: [
      { id: 'sup', label: 'Veridian Packaging', node_type: 'SUPPLIER', color: '#77854A', size: 30 },
      { id: 'd1', label: 'R. Kumar', node_type: 'DIRECTOR', color: '#C7A97B', size: 22 },
      { id: 'e1', label: 'Apex Boxpack Ltd', node_type: 'RELATED_ENTITY', color: '#B9975B', size: 22 },
      { id: 'e2', label: 'Global Polyfilms', node_type: 'RELATED_ENTITY', color: '#B9975B', size: 22 },
      { id: 'b1', label: 'HDFC ••123', node_type: 'BANK_ACCOUNT', color: '#8C8371', size: 22 },
    ],
    edges: [
      { source: 'sup', target: 'd1', relation: 'HAS_DIRECTOR' },
      { source: 'sup', target: 'b1', relation: 'USES_BANK' },
      { source: 'd1', target: 'e1', relation: 'SHARED_DIRECTOR' },
      { source: 'd1', target: 'e2', relation: 'SHARED_DIRECTOR' },
    ],
    summary: { total_nodes: 5, total_edges: 4, related_entities_count: 2, network_signals: [] },
  };

  return (
    <section className="relative py-36 bg-[#0B0D0A] border-t border-white/[0.05]">
      <div className="max-w-[1200px] mx-auto px-6">
        <span className={sectionLabel + ' !text-brass-light'}>See the network</span>
        <h2
          className="font-display font-semibold text-cream-100 mt-4 max-w-3xl"
          style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.08 }}
        >
          Shared attributes,<br />surfaced <span className="italic text-brass-light">honestly</span>.
        </h2>
        <p className="mt-5 max-w-[56ch] text-cream-100/65 leading-relaxed">
          Directors, sister entities and bank accounts map onto one graph. A shared
          attribute is exactly that — a review recommendation, never an accusation.
        </p>

        <div className="mt-10 h-[440px] rounded-3xl overflow-hidden border border-white/[0.07] bg-gradient-to-b from-[#10140d] to-[#0B0D0A] relative">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <Crest className="w-16 h-16 opacity-40" />
            </div>
          }>
            <Network3D
              payload={demoPayload as any}
              selectedId={null}
              onSelectNode={() => {}}
              className="w-full h-full"
            />
          </Suspense>
          <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] tracking-[0.2em] uppercase text-cream-100/35">
            Interactive · drag to orbit · synthetic topology
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── 6 · Spec grid ────────────────────────────────────────────────── */
const SpecGrid: React.FC = () => (
  <section className="py-36">
    <div className="max-w-[1200px] mx-auto px-6">
      <span className={sectionLabel}>Under the hood</span>
      <h2
        className="font-display font-semibold mt-4"
        style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.08 }}
      >
        Seven checks. Run on<br />every single document.
      </h2>

      <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {SPEC_CHECKS.map((c, i) => (
          <motion.div
            key={c.n}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -5 }}
            className="card-premium card-hover !rounded-2xl p-6 group cursor-default"
          >
            <div className="font-display text-4xl font-semibold text-olive-700 dark:text-olive-300">{c.n}</div>
            <p className="text-[12px] leading-relaxed mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: 'var(--text-secondary)' }}>
              {c.d}
            </p>
            <p className="text-[11px] mt-3 group-hover:hidden" style={{ color: 'var(--text-tertiary)' }}>hover for detail</p>
          </motion.div>
        ))}
        {/* large-number tiles */}
        {[
          { n: '3', d: 'claim labels: Supported, Contradicted, Insufficient evidence — nothing ships unlabelled.' },
          { n: '0', d: 'unsupported claims shipped: below the 0.80 confidence threshold, claims route to human review.' },
          { n: '6', d: 'risk vectors, computed only when evidence exists — otherwise honestly marked insufficient.' },
          { n: '2', d: 'sources cited on every cross-document conflict, with page and snippet.' },
        ].map((t, i) => (
          <motion.div
            key={t.n + t.d.slice(0, 8)}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: (i + 7) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -5 }}
            className="card-premium card-hover !rounded-2xl p-6 bg-gradient-to-b from-transparent to-olive-50/40 cursor-default"
          >
            <div className="font-display text-6xl font-semibold text-brass-deep" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.n}</div>
            <p className="text-[12px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>{t.d}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ── 7 · Trust & limits ───────────────────────────────────────────── */
const TrustAndLimits: React.FC = () => (
  <section className="py-32 bg-[#0B0D0A] border-y border-white/[0.05]">
    <div className="max-w-[900px] mx-auto px-6 text-center">
      <span className={sectionLabel + ' !text-brass-light justify-center'}>Trust & limits</span>
      <h2
        className="font-display font-semibold text-cream-100 mt-4"
        style={{ fontSize: 'var(--text-h2)', letterSpacing: 'var(--track-display)' }}
      >
        What VendorGuard is <span className="italic text-brass-light">not</span>.
      </h2>
      <div className="mt-10 grid sm:grid-cols-3 gap-4 text-left">
        {[
          { icon: XCircle, t: 'Not a legal verdict', d: 'Outputs are decision-support indicators with evidence coverage — never a fraud probability or a court finding.' },
          { icon: Eye, t: 'Not autonomous', d: 'Every material claim routes past a human reviewer. The engine ranks and explains; people decide.' },
          { icon: Lock, t: 'Not live registry data', d: 'No government-connector claims. If a source was not actually checked, the result says "not checked".' },
        ].map(item => (
          <motion.div
            key={item.t}
            initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
          >
            <item.icon className="w-5 h-5 text-brass-light" />
            <h3 className="font-display text-lg font-semibold text-cream-100 mt-3.5">{item.t}</h3>
            <p className="text-[13px] leading-relaxed text-cream-100/60 mt-2">{item.d}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ── 8 · Final CTA ────────────────────────────────────────────────── */
const FinalCTA: React.FC<{ onEnter: () => void }> = ({ onEnter }) => (
  <section className="py-40 bg-[#0B0D0A] relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none"
      style={{ backgroundImage: 'radial-gradient(36rem 20rem at 50% 110%, rgba(119,133,74,0.28), transparent 65%)' }} />
    <div className="max-w-[760px] mx-auto px-6 text-center relative">
      <motion.h2
        initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-display font-semibold text-cream-100"
        style={{ fontSize: 'var(--text-h1)', letterSpacing: 'var(--track-display)', lineHeight: 1.06 }}
      >
        Verify the Supplier.<br />Verify the Evidence.<br />
        <span className="italic text-brass-light">Verify the AI.</span>
      </motion.h2>
      <motion.button
        onClick={onEnter}
        initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        className="btn-brass !px-9 !py-4 !text-base !rounded-full mt-11"
      >
        Start verifying <ArrowRight className="w-4 h-4" />
      </motion.button>
    </div>
  </section>
);
