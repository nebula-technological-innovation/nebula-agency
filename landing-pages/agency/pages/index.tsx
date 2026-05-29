import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Home() {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-2xl font-bold text-blue-400">Nebula</div>
            <div className="hidden md:flex gap-8">
              <a href="#services" className="text-slate-300 hover:text-white transition">Services</a>
              <a href="#audit" className="text-slate-300 hover:text-white transition">Audit</a>
              <a href="#contact" className="text-slate-300 hover:text-white transition">Contact</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-32 pb-20 px-4"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Automate Your Business Operations & Secure Your Infrastructure
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            AI-powered workflow automation, operational infrastructure, and security systems for modern businesses.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="#" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
              Book Free Automation Audit
            </a>
            <a href="#" className="px-8 py-3 border border-blue-400 text-blue-400 rounded-lg font-semibold hover:bg-blue-400/10 transition">
              Get Security Review
            </a>
          </div>
        </div>
      </motion.section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Our Services</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-blue-400 mb-4">Workflow Automation</h3>
              <p className="text-slate-300 mb-4">Automate repetitive business operations:</p>
              <ul className="text-slate-300 space-y-2">
                <li>✓ Customer intake</li>
                <li>✓ Scheduling & reminders</li>
                <li>✓ Lead routing & follow-up</li>
                <li>✓ CRM synchronization</li>
                <li>✓ Reporting & invoicing</li>
              </ul>
              <p className="text-slate-400 mt-6 text-sm">Starting at $500</p>
            </motion.div>

            {/* Service 2 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-blue-400 mb-4">AI Infrastructure</h3>
              <p className="text-slate-300 mb-4">Deploy internal AI systems:</p>
              <ul className="text-slate-300 space-y-2">
                <li>✓ AI assistants & chatbots</li>
                <li>✓ Support systems</li>
                <li>✓ AI knowledge bases</li>
                <li>✓ Automated workflows</li>
                <li>✓ Operational dashboards</li>
              </ul>
              <p className="text-slate-400 mt-6 text-sm">Starting at $1,000</p>
            </motion.div>

            {/* Service 3 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-blue-400 mb-4">Security Hardening</h3>
              <p className="text-slate-300 mb-4">Reduce operational risk:</p>
              <ul className="text-slate-300 space-y-2">
                <li>✓ GitHub security audit</li>
                <li>✓ MFA rollout & enforcement</li>
                <li>✓ Secrets management</li>
                <li>✓ Access control review</li>
                <li>✓ CI/CD security hardening</li>
              </ul>
              <p className="text-slate-400 mt-6 text-sm">Starting at $1,000</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Free Audit CTA */}
      <section id="audit" className="py-20 px-4">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Get a Free 15-Minute Automation & Security Audit
          </h2>
          <p className="text-slate-300 mb-6">
            We'll identify repetitive workflows, automation opportunities, infrastructure inefficiencies, and security risks.
          </p>
          <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
            Schedule Your Free Audit
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-400">
          <p>&copy; 2026 Nebula AI Infrastructure. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
