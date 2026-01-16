import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();
    
    console.log('🧹 Starting cache cleanup job...');
    
    // Step 1: Mark expired entries
    const { data: markedExpired, error: markError } = await supabase
      .from('knowledge_base')
      .update({ is_expired: true })
      .lt('expires_at', now)
      .eq('is_expired', false)
      .not('expires_at', 'is', null)
      .select('id');
    
    if (markError) {
      console.error('Error marking expired entries:', markError);
    } else {
      console.log(`📌 Marked ${markedExpired?.length || 0} entries as expired`);
    }
    
    // Step 2: Delete very old expired entries (> 30 days past expiration)
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: deleted, error: deleteError } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('is_expired', true)
      .lt('expires_at', cutoffDate)
      .select('id');
    
    if (deleteError) {
      console.error('Error deleting old expired entries:', deleteError);
    } else {
      console.log(`🗑️ Deleted ${deleted?.length || 0} old expired entries`);
    }
    
    // Step 3: Cleanup orphaned learning patterns with zero usage (older than 90 days)
    const patternCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: deletedPatterns, error: patternError } = await supabase
      .from('learning_patterns')
      .delete()
      .eq('usage_count', 0)
      .lt('created_at', patternCutoff)
      .select('id');
    
    if (patternError) {
      console.error('Error cleaning learning patterns:', patternError);
    } else {
      console.log(`🧠 Cleaned ${deletedPatterns?.length || 0} unused learning patterns`);
    }
    
    // Step 4: Update statistics
    const { count: totalEntries } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });
    
    const { count: expiredEntries } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('is_expired', true);
    
    const { count: learningPatterns } = await supabase
      .from('learning_patterns')
      .select('*', { count: 'exact', head: true });
    
    const summary = {
      timestamp: now,
      markedExpired: markedExpired?.length || 0,
      deletedOldEntries: deleted?.length || 0,
      deletedPatterns: deletedPatterns?.length || 0,
      totalKnowledgeEntries: totalEntries || 0,
      expiredKnowledgeEntries: expiredEntries || 0,
      totalLearningPatterns: learningPatterns || 0,
    };
    
    console.log('✅ Cache cleanup completed:', JSON.stringify(summary));
    
    return new Response(JSON.stringify({ 
      success: true, 
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Cache cleanup error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
