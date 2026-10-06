import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, FileSearch, ShieldCheck, Network, Gavel, LineChart, Radio } from 'lucide-react';
import { Crest3D } from '../components/three/Crest3D';
import { Crest } from '../components/Brand';

interface LandingPageProps {
  onEnter: () => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-cream-100 text-espresso overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50 bg-espresso/95 backdrop-blur-md border-b border-brown-800/80"
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crest className="w-9 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold text-cream-100 tracking-tight">VendorGuard</span>
                <span className="text-[9px] font-bold tracking-[0.22em] px-2 py-0.5 rounded-full border border-brass/60 text-brass-light">AI</span>
              </div>
            </div>
          </div>
          <button onClick={onEnter} className="btn-primary !py-1.5">
            Enter Workspace <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-6 pt-14 pb-20 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 badge-success mb-6 !text-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Evidence-grounded supplier intelligence
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[2.9rem] leading-[1.08] font-semibold tracking-tight"
            >
              Procurement decisions<br />
              built on <span className="italic text-olive-700">evidence</span>,<br />
              not <span className="text-brass-deep line-through decoration-terracotta/60 decoration-[3px]">guesswork</span>.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 text-[15px] leading-relaxed text-brown-700 max-w-lg"
            >
              VendorGuard AI reads your suppliers' GST, PAN, incorporation, bank and ISO
              documents, cross-checks every identifier, maps hidden networks, scores six
              risk vectors — and then verifies its own report claim-by-claim. Every
              statement links to its evidence, or says it cannot verify.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex items-center gap-3 flex-wrap"
            >
              <button onClick={onEnter} className="btn-primary !px-6 !py-3 !text-[15px]">
                Launch the workspace <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#capabilities" className="btn-ghost !px-6 !py-3 !text-[15px]">Explore capabilities</a>
            </motion.div>

            {/* Stats strip */}
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.56, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 grid grid-cols-3 max-w-md divide-x divide-cream-300"
            >
              {[
                { k: '6', v: 'risk vectors scored' },
                { k: '3-way', v: 'claim verification' },
                { k: '100%', v: 'decisions audited' },
              ].map((s, i) => (
                <div key={i} className="px-5 first:pl-0">
                  <div className="font-display text-2xl font-semibold text-olive-700">{s.k}</div>
                  <div className="text-[11px] text-stonewarm tracking-wide mt-0.5">{s.v}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* 3D Crest */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[420px] lg:h-[520px]"
          >
            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-espresso to-brown-900 shadow-lifted overflow-hidden">
              <Crest3D className="w-full h-full" />
              <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] tracking-[0.22em] uppercase text-cream-300/60">
                Drag to orbit · Rendered live
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────── */}
      <section id="capabilities" className="relative py-20 bg-cream-200/60 border-y border-cream-300">
        <div className="max-w-7xl mx-auto px-6">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="section-label justify-center !justify-start"
          >
            What runs inside
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl font-semibold mt-3 mb-10"
          >
            A due-diligence engine, not a chatbot wrapper.
          </motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: FileSearch, title: 'Document intelligence', body: 'PDF/image intake with OCR, entity extraction and page-level provenance — unreadable scans are flagged, never scored as healthy.' },
              { icon: ShieldCheck, title: 'Cross-document checks', body: 'GSTIN-PAN embedding, bank-holder vs legal name, certificate expiry and conflicting values across files — both sources cited.' },
              { icon: Network, title: '3D network intelligence', body: 'Directors, sister entities and accounts mapped in an interactive 3D graph with fraud-ring signals.' },
              { icon: Radio, title: 'Live analysis pipeline', body: 'Watch consistency, graph, risk and claim-verification stages stream in real time as the engine works.' },
              { icon: Gavel, title: 'Tender award engine', body: 'Rank supplier bids by price, delivery and live risk score — every recommendation explained and audited.' },
              { icon: LineChart, title: 'Command center', body: 'Portfolio KPIs, expiry watchlist, claim-health and trend analytics computed from your real data.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="card-premium card-hover p-6"
              >
                <span className="w-10 h-10 rounded-xl bg-gradient-to-b from-olive-500 to-olive-700 border border-olive-800/50 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <f.icon className="w-5 h-5 text-cream-50" />
                </span>
                <h3 className="font-display text-lg font-semibold mt-4">{f.title}</h3>
                <p className="text-[13px] text-brown-600 leading-relaxed mt-2">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto px-6"
        >
          <div className="panel-dark relative overflow-hidden p-10 text-center">
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, #B9975B 0%, transparent 45%), radial-gradient(circle at 80% 80%, #77854A 0%, transparent 40%)' }} />
            <h2 className="font-display text-3xl font-semibold text-cream-100 relative">
              Verify the Supplier. Verify the Evidence. <span className="italic text-brass-light">Verify the AI.</span>
            </h2>
            <p className="text-cream-300/70 text-sm mt-3 relative">
              Sign in and run your first evidence-backed supplier review in under a minute.
            </p>
            <button onClick={onEnter} className="btn-brass !px-8 !py-3 !text-[15px] mt-8 relative">
              Enter the workspace <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-cream-300 bg-cream-200/60 py-6 text-center text-xs text-brown-600">
        VendorGuard AI — Major Project 2026–2027 · GLA University ·{' '}
        <span className="font-mono text-olive-700">adityayadav161003/VendorGuardAI</span>
      </footer>
    </div>
  );
};
