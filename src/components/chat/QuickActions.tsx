import React from 'react';
import { motion } from 'framer-motion';
import { 
  Image, 
  FileText, 
  Code, 
  Lightbulb, 
  PenLine, 
  Sparkles, 
  Search, 
  MessageSquare,
  BarChart3,
  ListChecks,
  Brain,
  Languages
} from 'lucide-react';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  color: string;
}

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
}

const actions: QuickAction[] = [
  {
    icon: <Image className="w-5 h-5" />,
    label: "Create image",
    prompt: "Create an image of ",
    color: "from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30"
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: "Summarize text",
    prompt: "Summarize the following text: ",
    color: "from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30"
  },
  {
    icon: <Code className="w-5 h-5" />,
    label: "Code",
    prompt: "Help me write code for ",
    color: "from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30"
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    label: "Get advice",
    prompt: "I need advice on ",
    color: "from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30"
  },
  {
    icon: <PenLine className="w-5 h-5" />,
    label: "Help me write",
    prompt: "Help me write ",
    color: "from-purple-500/20 to-violet-500/20 hover:from-purple-500/30 hover:to-violet-500/30"
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    label: "Surprise me",
    prompt: "Tell me something interesting and surprising that I probably don't know",
    color: "from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30"
  },
  {
    icon: <Search className="w-5 h-5" />,
    label: "Search the web",
    prompt: "Search the web for the latest news about ",
    color: "from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30"
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: "Analyze data",
    prompt: "Analyze this data and give me insights: ",
    color: "from-teal-500/20 to-cyan-500/20 hover:from-teal-500/30 hover:to-cyan-500/30"
  },
  {
    icon: <ListChecks className="w-5 h-5" />,
    label: "Make a plan",
    prompt: "Help me create a plan for ",
    color: "from-lime-500/20 to-green-500/20 hover:from-lime-500/30 hover:to-green-500/30"
  },
  {
    icon: <Brain className="w-5 h-5" />,
    label: "Brainstorm",
    prompt: "Brainstorm ideas for ",
    color: "from-fuchsia-500/20 to-pink-500/20 hover:from-fuchsia-500/30 hover:to-pink-500/30"
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    label: "Analyze images",
    prompt: "I'll share an image for you to analyze. ",
    color: "from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30"
  },
  {
    icon: <Languages className="w-5 h-5" />,
    label: "Translate",
    prompt: "Translate the following text to ",
    color: "from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30"
  }
];

const QuickActions: React.FC<QuickActionsProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-2xl w-full">
      {actions.map((action, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(action.prompt)}
          className={`flex items-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-br ${action.color} border border-border/50 backdrop-blur-sm transition-all duration-200 group`}
        >
          <div className="text-primary group-hover:scale-110 transition-transform">
            {action.icon}
          </div>
          <span className="text-sm font-medium truncate">{action.label}</span>
        </motion.button>
      ))}
    </div>
  );
};

export default QuickActions;
