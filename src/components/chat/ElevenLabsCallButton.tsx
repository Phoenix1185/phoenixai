import { useCallback, useMemo, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ElevenLabsCallButtonProps = {
  disabled?: boolean;
  className?: string;
  agentId?: string;
};

const DEFAULT_AGENT_ID = "agent_7201kf096j8re2qt50hs3yjxphhg";

export default function ElevenLabsCallButton({
  disabled,
  className,
  agentId = DEFAULT_AGENT_ID,
}: ElevenLabsCallButtonProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onError: (err) => {
      console.error("ElevenLabs conversation error:", err);
      toast({
        variant: "destructive",
        title: "Voice connection failed",
        description: "Couldn't connect to voice. Please try again.",
      });
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
    } catch (e) {
      console.error(e);
    }
  }, [conversation, disabled, isDisconnected]);

  return (
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
            !isDisconnected && "bg-primary/20 text-primary",
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
  );
}
