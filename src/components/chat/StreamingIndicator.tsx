import React from 'react';
import { motion } from 'framer-motion';

interface StreamingIndicatorProps {
  text?: string;
}

const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({ 
  text = "Phoenix is typing" 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -4, 0],
              opacity: [0.4, 1, 0.4]
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut"
            }}
            className="w-1.5 h-1.5 rounded-full bg-primary"
          />
        ))}
      </div>
      <motion.span
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
};

export default StreamingIndicator;
