import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FeedbackOption {
  id: string;
  label: string;
  icon: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { id: 'incorrect', label: 'Incorrect information', icon: '❌' },
  { id: 'unhelpful', label: 'Unhelpful response', icon: '😕' },
  { id: 'too_long', label: 'Too long', icon: '📜' },
  { id: 'too_short', label: 'Too short', icon: '📝' },
  { id: 'off_topic', label: 'Off topic', icon: '🎯' },
  { id: 'other', label: 'Other', icon: '💬' },
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedbackType: string, feedbackText: string) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOption) return;
    
    setIsSubmitting(true);
    const feedbackText = selectedOption === 'other' 
      ? otherText 
      : FEEDBACK_OPTIONS.find(o => o.id === selectedOption)?.label || selectedOption;
    
    await onSubmit(selectedOption, feedbackText);
    setIsSubmitting(false);
    setSelectedOption(null);
    setOtherText('');
    onClose();
  };

  const handleClose = () => {
    setSelectedOption(null);
    setOtherText('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="glass-card rounded-2xl p-6 mx-4 shadow-2xl border border-border/50">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">What went wrong?</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Your feedback helps Phoenix learn and improve.
              </p>
              
              {/* Options */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {FEEDBACK_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedOption(option.id)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border transition-all text-left text-sm',
                      selectedOption === option.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    )}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Other text input */}
              <AnimatePresence>
                {selectedOption === 'other' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <Textarea
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder="Please describe what went wrong..."
                      className="min-h-[80px] resize-none"
                      autoFocus
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Submit button */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedOption || (selectedOption === 'other' && !otherText.trim()) || isSubmitting}
                className="w-full gradient-phoenix text-primary-foreground"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Submitting...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeedbackModal;
