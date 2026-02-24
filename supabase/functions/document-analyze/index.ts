import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, fileType, prompt, userId, conversationId, userName } = await req.json();

    if (!fileContent || !fileName) {
      return new Response(
        JSON.stringify({ error: 'File content and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    // For text-based files, the content is already text
    // For base64 files (PDF etc.), we extract text on the client side
    const isTextFile = /\.(txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp|go|rs|rb|php|sql|yaml|yml|toml|ini|log|sh|bat)$/i.test(fileName);

    let extractedText = '';
    
    if (isTextFile) {
      // Text content passed directly
      extractedText = fileContent;
    } else {
      // For PDFs and other binary docs, we use AI vision to "read" the document
      // The client sends the file as base64 data URI
      console.log(`📄 Processing document: ${fileName} (${fileType})`);
      
      // Use Gemini to read the document content from base64
      const readResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: 'Extract ALL text content from this document. Preserve the structure, headings, lists, and formatting as much as possible. Return the full extracted text.' 
                },
                { 
                  type: 'image_url', 
                  image_url: { url: fileContent } 
                },
              ],
            },
          ],
          max_tokens: 8192,
        }),
      });

      if (readResponse.ok) {
        const readData = await readResponse.json();
        extractedText = readData.choices?.[0]?.message?.content || '';
        console.log(`📄 Extracted ${extractedText.length} chars from document`);
      } else {
        console.error('Document extraction failed:', readResponse.status);
        extractedText = '[Could not extract text from this document format]';
      }
    }

    if (!extractedText || extractedText.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Could not extract text from this document. Try a different format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate if extremely long
    const maxChars = 30000;
    const truncated = extractedText.length > maxChars;
    const docText = truncated ? extractedText.slice(0, maxChars) + '\n\n[... document truncated ...]' : extractedText;

    // Now analyze with AI
    const userPrompt = prompt || 'Please analyze this document and provide a comprehensive summary.';
    
    const systemPrompt = `You are Phoenix AI, an intelligent document analyst. The user has uploaded a document titled "${fileName}".

DOCUMENT CONTENT:
---
${docText}
---

Analyze this document based on the user's request. Be thorough, accurate, and well-organized in your response. If the document is lengthy, provide key points and structured analysis. Always reference specific sections when relevant.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        max_tokens: 8192,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to analyze document');
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: unknown) {
    console.error('Error in document-analyze:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
