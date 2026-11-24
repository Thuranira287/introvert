'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdUnit } from '@/components/ads/AdUnit';
import { AD_SLOTS } from '@/components/ads/ad-slots';
import { Handshake, MessageCircle, Target, PenLine, Lock, Users, Smartphone } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Header />
      
      <main className="w-full">
        <section className="bg-gradient-to-b from-indigo-50 to-white py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Your Safe Space for Connection
                </h1>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Introvert Corner is a social platform designed specifically for introverts.
                  Find like-minded people, share your thoughts, chat with our AI assistant,
                  and build meaningful connections at your own pace.
                </p>
                <div className="flex gap-4">
                  <Button size="lg" asChild>
                    <Link href="/register">Get Started Free</Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              </div>

              <div className="bg-indigo-100 rounded-xl h-96 flex items-center justify-center text-indigo-600">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center">
                    <Handshake size={32} strokeWidth={1.75} />
                  </div>
                  <p className="text-lg font-medium">Authentic Connections</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Why Introvert Corner?</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <MessageCircle size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Assistant</h3>
                <p className="text-gray-600">
                  Chat with our compassionate AI assistant trained to support and guide introverts
                  through social challenges with empathy and understanding.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <Target size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Authentic Community</h3>
                <p className="text-gray-600">
                  Connect with genuine people who understand introversion. Share experiences,
                  build friendships, and support each other.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <PenLine size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Share & Learn</h3>
                <p className="text-gray-600">
                  Write blogs, share your thoughts, and learn from others. Build confidence
                  at your own pace.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <Lock size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Your Privacy Matters</h3>
                <p className="text-gray-600">
                  We respect your privacy. Anonymous messaging and optional profile visibility
                  let you control your presence.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <Users size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Communities</h3>
                <p className="text-gray-600">
                  Join interest-based communities and events tailored for introverts who want
                  to grow at their own speed.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                  <Smartphone size={24} className="text-indigo-600" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Mobile Ready</h3>
                <p className="text-gray-600">
                  Access Introvert Corner anytime, anywhere. Our app is designed for seamless
                  mobile experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-indigo-600 to-indigo-700 py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to Join?</h2>
            <p className="text-indigo-100 text-lg mb-8">
              Create your account today and find your community of like-minded introverts.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">Start Free Trial</Link>
            </Button>
          </div>
        </section>

        {/* Ad banner — placed after the CTA, never above the fold, so it never competes with sign-up conversion */}
        <section className="py-8 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 text-center">Advertisement</p>
            <AdUnit slot={AD_SLOTS.landingBanner} style={{ minHeight: 90 }} />
          </div>
        </section>

        <footer className="bg-gray-900 text-gray-400 py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-bold text-white mb-4">Introvert Corner</h4>
                <p className="text-sm">Your safe space for authentic connection.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-4">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="#" className="hover:text-white">Features</Link></li>
                  <li><Link href="#" className="hover:text-white">Pricing</Link></li>
                  <li><Link href="#" className="hover:text-white">Blog</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-white mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="#" className="hover:text-white">About</Link></li>
                  <li><Link href="#" className="hover:text-white">Contact</Link></li>
                  <li><Link href="#" className="hover:text-white">Careers</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-white mb-4">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                  <li><Link href="#" className="hover:text-white">Terms</Link></li>
                  <li><Link href="#" className="hover:text-white">Security</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 text-center text-sm">
              <p>&copy; 2026 Introvert Corner. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
