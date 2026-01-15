import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Globe, Brain, Zap, MessageCircle, Search, Sparkles, Shield, Mic, Languages, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PhoenixLogo from '@/components/PhoenixLogo';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { scrollY } = useScroll();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Parallax transforms
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const bgY = useTransform(scrollY, [0, 500], [0, -50]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3]);

  // Debounced mouse tracking for better performance
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Only update every 100ms via requestAnimationFrame
    requestAnimationFrame(() => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 15,
        y: (e.clientY / window.innerHeight - 0.5) * 15,
      });
    });
  }, []);

  useEffect(() => {
    let throttleTimeout: number | null = null;
    const throttledHandler = (e: MouseEvent) => {
      if (throttleTimeout) return;
      throttleTimeout = window.setTimeout(() => {
        handleMouseMove(e);
        throttleTimeout = null;
      }, 100);
    };
    
    window.addEventListener('mousemove', throttledHandler, { passive: true });
    return () => {
      window.removeEventListener('mousemove', throttledHandler);
      if (throttleTimeout) window.clearTimeout(throttleTimeout);
    };
  }, [handleMouseMove]);

  const features = useMemo(() => [
    { icon: Brain, title: 'Intelligent AI', description: 'Powered by advanced AI that learns your preferences' },
    { icon: Search, title: 'Live Web Search', description: 'Real-time access to current information via Tavily' },
    { icon: Globe, title: 'Multi-Language', description: 'Communicate in 10+ languages seamlessly' },
    { icon: Zap, title: 'Lightning Fast', description: 'Streaming responses in real-time' },
    { icon: Mic, title: 'Voice Enabled', description: 'Speak naturally with voice input & output' },
    { icon: MessageSquare, title: 'WhatsApp Ready', description: 'Connect via WhatsApp for on-the-go AI' },
  ], []);

  const stats = useMemo(() => [
    { value: '10+', label: 'Languages' },
    { value: '24/7', label: 'Availability' },
    { value: 'Real-time', label: 'Web Search' },
    { value: '∞', label: 'Possibilities' },
  ], []);

  // Memoized particles - reduced from 20 to 6 for performance
  const particles = useMemo(() => 
    [...Array(6)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 5 + Math.random() * 3,
      delay: Math.random() * 2,
    })), []);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Optimized animated background */}
      <motion.div 
        style={{ y: bgY }}
        className="absolute inset-0 overflow-hidden pointer-events-none will-change-transform"
      >
        {/* Reduced floating particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full bg-primary/20"
            style={{ left: particle.left, top: particle.top }}
            animate={{
              y: [-15, 15, -15],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Simplified background blurs - removed mouse tracking for large elements */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-32 w-[400px] h-[400px] bg-primary/15 rounded-full blur-3xl will-change-transform"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.08, 1],
            opacity: [0.3, 0.45, 0.3],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-orange-500/15 rounded-full blur-3xl will-change-transform"
        />
      </motion.div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 p-4 md:p-6 flex items-center justify-between"
      >
        <PhoenixLogo size="sm" />
        <Button 
          onClick={onGetStarted} 
          variant="outline" 
          className="gap-2 hover:bg-primary hover:text-primary-foreground transition-all btn-ripple hover-lift"
        >
          Sign In
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.header>

      {/* Hero Section with Parallax */}
      <motion.main 
        style={{ y: heroY, opacity }}
        className="flex-1 flex flex-col items-center justify-center px-4 relative z-10"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Floating Phoenix with glow */}
          <motion.div
            animate={{ 
              y: [-15, 15, -15],
              rotateY: [0, 5, 0, -5, 0],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="mb-8"
          >
            <div className="relative inline-block">
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1],
                }}
                transition={{ 
                  rotate: { duration: 25, repeat: Infinity, ease: "linear" },
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute inset-0 bg-gradient-to-r from-primary via-orange-500 to-amber-500 rounded-full blur-2xl opacity-60"
                style={{ width: '140%', height: '140%', left: '-20%', top: '-20%' }}
              />
              <PhoenixLogo size="lg" showText={false} animate />
            </div>
          </motion.div>

          {/* Headline with staggered animation */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold font-['Poppins'] mb-6 leading-tight"
          >
            <motion.span 
              className="text-gradient-animated inline-block"
              whileHover={{ scale: 1.05 }}
            >
              Rising
            </motion.span>{' '}
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

          {/* CTA Buttons with ripple effect */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button
              onClick={onGetStarted}
              size="lg"
              className="gradient-phoenix text-primary-foreground px-8 py-6 text-lg gap-2 hover:scale-105 transition-transform shadow-lg shadow-primary/25 btn-ripple animate-pulse-glow"
            >
              <Sparkles className="h-5 w-5" />
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 py-6 text-lg gap-2 hover:bg-accent transition-all hover-lift"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <MessageCircle className="h-5 w-5" />
              Learn More
            </Button>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto mb-16"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                className="text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Features Grid */}
          <motion.div
            id="features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                whileHover={{ 
                  scale: 1.05, 
                  y: -8,
                  boxShadow: "0 20px 40px -20px hsl(var(--phoenix-orange) / 0.3)"
                }}
                className="glass-card p-6 rounded-2xl text-center group cursor-default animate-border-glow"
              >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 mx-auto mb-4 rounded-xl gradient-phoenix flex items-center justify-center shadow-lg"
                >
                  <feature.icon className="h-7 w-7 text-primary-foreground" />
                </motion.div>
                <h3 className="font-semibold mb-2 text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="relative z-10 p-6 text-center text-sm text-muted-foreground"
      >
        <div className="flex items-center justify-center gap-6 mb-3 flex-wrap">
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="flex items-center gap-1.5"
          >
            <Shield className="h-4 w-4 text-green-500" />
            <span>Secure & Private</span>
          </motion.div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground hidden sm:block" />
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="flex items-center gap-1.5"
          >
            <Languages className="h-4 w-4 text-primary" />
            <span>10+ Languages</span>
          </motion.div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground hidden sm:block" />
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="flex items-center gap-1.5"
          >
            <MessageSquare className="h-4 w-4 text-green-600" />
            <span>WhatsApp Ready</span>
          </motion.div>
        </div>
        <p>© 2026 Phoenix AI. All rights reserved.</p>
      </motion.footer>
    </div>
  );
};

export default LandingPage;
