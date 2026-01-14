import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, Brain, Zap, MessageCircle, Search, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PhoenixLogo from '@/components/PhoenixLogo';
import type { Transition, Easing } from 'framer-motion';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const features = [
    { icon: Brain, title: 'Intelligent AI', description: 'Powered by advanced AI that learns your preferences' },
    { icon: Search, title: 'Live Web Search', description: 'Real-time access to current information' },
    { icon: Globe, title: 'Multi-Language', description: 'Communicate in 10+ languages' },
    { icon: Zap, title: 'Lightning Fast', description: 'Streaming responses in real-time' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" as const }}
          className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" as const, delay: 1 }}
          className="absolute bottom-1/4 -right-32 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" as const, delay: 2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 p-4 md:p-6 flex items-center justify-between"
      >
        <PhoenixLogo size="sm" />
        <Button onClick={onGetStarted} variant="outline" className="gap-2 hover:bg-primary hover:text-primary-foreground transition-all">
          Sign In
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, staggerChildren: 0.15 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Floating Phoenix */}
          <motion.div
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" as const }}
            className="mb-8"
          >
            <div className="relative inline-block">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" as const }}
                className="absolute inset-0 bg-gradient-to-r from-primary via-orange-500 to-amber-500 rounded-full blur-xl opacity-50"
                style={{ width: '120%', height: '120%', left: '-10%', top: '-10%' }}
              />
              <PhoenixLogo size="lg" showText={false} />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold font-['Poppins'] mb-6 leading-tight"
          >
            <span className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Rising
            </span>{' '}
            to Every Question,
            <br />
            <span className="text-foreground">In Real Time</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4"
          >
            Your intelligent AI assistant with live web search, voice interaction, 
            and multi-language support. Built to learn your preferences and help you achieve more.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm text-muted-foreground mb-8"
          >
            Created by <span className="text-primary font-medium">IYANU</span> & the Phoenix Team
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button
              onClick={onGetStarted}
              size="lg"
              className="gradient-phoenix text-primary-foreground px-8 py-6 text-lg gap-2 hover:scale-105 transition-transform shadow-lg shadow-primary/25"
            >
              <Sparkles className="h-5 w-5" />
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-6 text-lg gap-2 hover:bg-accent transition-all"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <MessageCircle className="h-5 w-5" />
              Learn More
            </Button>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            id="features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="glass-card p-6 rounded-2xl text-center group cursor-default"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl gradient-phoenix flex items-center justify-center group-hover:animate-bounce">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="relative z-10 p-6 text-center text-sm text-muted-foreground"
      >
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4 text-green-500" />
            <span>Secure & Private</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4 text-primary" />
            <span>10+ Languages</span>
          </div>
        </div>
        <p>© 2025 Phoenix AI. All rights reserved.</p>
      </motion.footer>
    </div>
  );
};

export default LandingPage;
