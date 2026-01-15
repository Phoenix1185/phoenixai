import { useCallback, useMemo, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type ElevenLabsCallButtonProps = {
  disabled?: boolean;
  className?: string;
  agentId?: string;
};

type TranscriptEntry = {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
};

const DEFAULT_AGENT_ID = "agent_7201kf096j8re2qt50hs3yjxphhg";

export default function ElevenLabsCallButton({
  disabled,
  className,
  agentId = DEFAULT_AGENT_ID,
}: ElevenLabsCallButtonProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);

  const conversation = useConversation({
    onError: (err) => {
      console.error("ElevenLabs conversation error:", err);
      toast({
        variant: "destructive",
        title: "Voice connection failed",
        description: "Couldn't connect to voice. Please try again.",
      });
    },
    onMessage: (message) => {
      // Handle incoming transcription events
      console.log("ElevenLabs message:", message);
      
      if (message.source === 'user' && message.message) {
        setTranscripts(prev => [...prev, {
          role: 'user',
          text: message.message,
          timestamp: Date.now(),
        }]);
      } else if (message.source === 'ai' && message.message) {
        setTranscripts(prev => [...prev, {
          role: 'agent',
          text: message.message,
          timestamp: Date.now(),
        }]);
      }
    },
  });

  const isDisconnected = conversation.status === "disconnected";

  const tooltipLabel = useMemo(() => {
    if (!isDisconnected) return "End voice call";
    return "Start voice call";
  }, [isDisconnected]);

  const start = useCallback(async () => {
    if (disabled || !isDisconnected) return;

    setIsConnecting(true);
    setTranscripts([]); // Clear previous transcripts
    
    try {
      // Ask mic permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agentId } }
      );

      if (error) {
        throw error;
      }

      if (!data?.token) {
        throw new Error("No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Microphone / connection error",
        description:
          "Please allow microphone access and try again. If it persists, reload the page.",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, conversation, disabled, isDisconnected, toast]);

  const stop = useCallback(async () => {
    if (disabled || isDisconnected) return;
    try {
      await conversation.endSession();
      
      // Optional: Show summary toast
      if (transcripts.length > 0) {
        toast({
          title: "Call ended",
          description: `${transcripts.length} messages exchanged`,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [conversation, disabled, isDisconnected, transcripts.length, toast]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isConnecting}
            onClick={isDisconnected ? start : stop}
            className={cn(
              "h-10 w-10 rounded-xl transition-all",
              !isDisconnected && "bg-primary/20 text-primary animate-pulse",
              className
            )}
            aria-label={tooltipLabel}
          >
            {isConnecting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isDisconnected ? (
              <Phone className="h-5 w-5" />
            ) : (
              <PhoneOff className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipLabel}</p>
        </TooltipContent>
      </Tooltip>

      {/* Live Transcription Overlay */}
      <AnimatePresence>
        {!isDisconnected && showTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
          >
            <div className="glass-card rounded-2xl p-4 shadow-2xl border border-primary/20">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-red-500"
                  />
                  <span className="text-sm font-medium text-foreground">Live Call</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowTranscript(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Transcript Area */}
              <div className="max-h-40 overflow-y-auto space-y-2">
                {transcripts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Listening... Speak to see transcription
                  </p>
                ) : (
                  transcripts.slice(-5).map((entry, i) => (
                    <motion.div
                      key={`${entry.timestamp}-${i}`}
                      initial={{ opacity: 0, x: entry.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "text-sm p-2 rounded-lg",
                        entry.role === 'user' 
                          ? "bg-primary/20 text-primary-foreground ml-8" 
                          : "bg-muted mr-8"
                      )}
                    >
                      <span className="text-xs font-medium opacity-70 block mb-1">
                        {entry.role === 'user' ? 'You' : 'Phoenix'}
                      </span>
                      {entry.text}
                    </motion.div>
                  ))
                )}
              </div>

              {/* Speaking indicator */}
              {conversation.isSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center justify-center gap-1"
                >
                  <span className="text-xs text-muted-foreground">Phoenix is speaking</span>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized indicator when transcript is hidden */}
      <AnimatePresence>
        {!isDisconnected && !showTranscript && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setShowTranscript(true)}
            className="fixed bottom-24 right-4 z-50 p-3 rounded-full bg-primary/20 border border-primary/30 text-primary shadow-lg"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-red-500"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
