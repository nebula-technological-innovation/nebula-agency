import React from 'react';
import { motion } from 'framer-motion';

const services = [
  {
    name: 'AI & Automation Consulting',
    description: 'Strategy, architecture, workflow automation, deployment planning, and production-readiness assessments.',
    href: 'https://book.stripe.com/8x2cN6bJV5aQfVM77vbMQ0c',
  },
  {
    name: 'Engineering & Automation',
    description: 'API integrations, MCP systems, CI/CD, business automation, cloud operations, and codebase modernization.',
    href: 'https://book.stripe.com/00w9AU9BNeLqeRI77vbMQ0d',
  },
  {
    name: 'Technical & Business Documentation',
    description: 'Architecture documents, implementation runbooks, SOPs, technical specifications, and operating documentation.',
    href: 'https://book.stripe.com/5kQ4gAeW7gTycJAbnLbMQ0e',
  },
  {
    name: 'Data & Integration Assessment',
    description: 'Data cleanup, migration, reporting, analytics, RAG preparation, and systems-integration planning.',
    href: 'https://book.stripe.com/cNi4gAg0b5aQaBsdvTbMQ0j',
  },
  {
    name: 'Defensive Security Assessment',
    description: 'Authorized code and security review, dependency/SBOM analysis, secret-pattern review, and remediation planning.',
    href: 'https://book.stripe.com/8x23cw15h0UAfVMcrPbMQ0k',
  },
  {
    name: 'B2B Revenue Operations Sprint',
    description: 'ICP and offer positioning, CRM workflow design, lifecycle messaging, sales enablement, SEO/content systems, and funnel instrumentation.',
    href: 'https://book.stripe.com/3cI7sM9BNcDi24W77vbMQ0l',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="fixed w-full z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-cyan-400">Nebula</div>
          <div className="flex gap-6 text-sm sm:text-base">
            <a href="#services" className="text-slate-300 hover:text-white transition">Services</a>
            <a href="#process" className="text-slate-300 hover:text-white transition">Process</a>
            <a href="mailto:christianroe@roeacquisitions.net" className="text-slate-300 hover:text-white transition">Contact</a>
          </div>
        </div>
      </nav>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-32 pb-20 px-4"
      >
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-cyan-300 font-semibold mb-4">Nebula Technological Innovation</p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Production services you can engage today.
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            AI strategy, engineering, automation, documentation, data integration, defensive security, and B2B revenue operations delivered as scoped professional engagements.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="#services" className="px-8 py-3 bg-cyan-500 text-slate-950 rounded-lg font-bold hover:bg-cyan-400 transition">Choose a service</a>
            <a href="mailto:christianroe@roeacquisitions.net?subject=Nebula%20enterprise%20engagement" className="px-8 py-3 border border-cyan-400 text-cyan-300 rounded-lg font-semibold hover:bg-cyan-400/10 transition">Discuss enterprise scope</a>
          </div>
        </div>
      </motion.section>

      <section id="services" className="py-20 px-4 bg-slate-900/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-3">Live service offers</h2>
            <p className="text-slate-400">Secure hosted checkout through Stripe. Each purchase includes intake information so fulfillment starts from a defined scope.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <motion.article key={service.name} whileHover={{ y: -4 }} className="bg-slate-800/70 border border-slate-700 rounded-2xl p-7 flex flex-col">
                <h3 className="text-xl font-bold text-cyan-300 mb-3">{service.name}</h3>
                <p className="text-slate-300 leading-relaxed flex-1">{service.description}</p>
                <a href={service.href} target="_blank" rel="noreferrer" className="mt-6 inline-flex justify-center px-5 py-3 bg-white text-slate-950 rounded-lg font-bold hover:bg-slate-200 transition">Start engagement</a>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="process" className="py-20 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            ['1. Pay & submit scope', 'Use the hosted checkout and provide the requested company, scope, system, or outcome information.'],
            ['2. Confirm fulfillment', 'Nebula verifies the purchased scope, authorization, delivery plan, support path, and success criteria before work begins.'],
            ['3. Deliver & validate', 'Work is delivered against the agreed scope with a customer-success check and documented next action.'],
          ].map(([title, body]) => (
            <div key={title} className="border border-slate-700 rounded-2xl p-6 bg-slate-900/40">
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-slate-400">{body}</p>
            </div>
          ))}
        </div>
        <p className="max-w-4xl mx-auto mt-10 text-center text-slate-500 text-sm">
          Self-serve Aether software, APIs, cloud, mobile, telecom, finance, and other regulated or entitlement-dependent products are not sold here until their production activation gates pass.
        </p>
      </section>

      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-500">
          <p>&copy; 2026 Nebula Technological Innovation. Professional services subject to confirmed scope and authorization.</p>
        </div>
      </footer>
    </div>
  );
}
