import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveDocumentToHistory, generateDocumentSummary } from "../_shared/phoenix-core.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DocumentInput {
  content: string;
  name: string;
  type: string;
}

async function extractText(doc: DocumentInput, lovableApiKey: string): Promise<string> {
  const isTextFile = /\.(txt|md|csv|json|xml|html|css|js|ts|py|java|c|cpp|go|rs|rb|php|sql|yaml|yml|toml|ini|log|sh|bat)$/i.test(doc.name);

  if (isTextFile) return doc.content;

  console.log(`📄 Processing document: ${doc.name} (${doc.type})`);
  const readResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract ALL text content from this document. Preserve the structure, headings, lists, and formatting as much as possible. Return the full extracted text.' },
          { type: 'image_url', image_url: { url: doc.content } },
        ],
      }],
      max_tokens: 8192,
    }),
  });

  if (readResponse.ok) {
    const readData = await readResponse.json();
    const text = readData.choices?.[0]?.message?.content || '';
    console.log(`📄 Extracted ${text.length} chars from ${doc.name}`);
    return text;
  }
  console.error('Document extraction failed:', readResponse.status);
  return '[Could not extract text from this document format]';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    // Support both single doc (legacy) and multi-doc
    let documents: DocumentInput[] = [];

    if (body.documents && Array.isArray(body.documents)) {
      documents = body.documents;
    } else if (body.fileContent && body.fileName) {
      documents = [{ content: body.fileContent, name: body.fileName, type: body.fileType || 'text' }];
    }

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one document is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract text from all documents in parallel
    const extractedTexts = await Promise.all(
      documents.map(doc => extractText(doc, lovableApiKey))
    );

    const maxCharsPerDoc = documents.length > 1 ? Math.floor(30000 / documents.length) : 30000;

    let docSections = '';
    for (let i = 0; i < documents.length; i++) {
      let text = extractedTexts[i];
      if (!text || text.length < 10) text = '[Could not extract text]';
      if (text.length > maxCharsPerDoc) text = text.slice(0, maxCharsPerDoc) + '\n\n[... truncated ...]';
      docSections += `\n\n=== DOCUMENT ${i + 1}: "${documents[i].name}" ===\n${text}\n=== END DOCUMENT ${i + 1} ===\n`;
    }

    const isComparison = documents.length > 1;
    const userPrompt = body.prompt || (isComparison
      ? 'Compare these documents and highlight key similarities and differences.'
      : 'Analyze this document and provide a comprehensive summary.');

    const systemPrompt = isComparison
      ? `You are Phoenix AI, an intelligent document analyst. The user has uploaded ${documents.length} documents for comparison and analysis.

${docSections}

Compare and analyze these documents based on the user's request. Highlight:
- Key similarities and differences
- Unique content in each document
- Structural and thematic comparisons
- A synthesized summary

Be thorough, accurate, and well-organized. Reference specific documents by name.`
      : `You are Phoenix AI, an intelligent document analyst. The user has uploaded a document titled "${documents[0].name}".

DOCUMENT CONTENT:
---
${extractedTexts[0]?.length > 30000 ? extractedTexts[0].slice(0, 30000) + '\n\n[... truncated ...]' : extractedTexts[0]}
---

Analyze this document based on the user's request. Be thorough, accurate, and well-organized in your response.`;

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
