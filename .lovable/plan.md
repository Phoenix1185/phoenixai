

# Fix WhatsApp Group Chat Mention Detection

## Problem
When someone tags/mentions the bot in a WhatsApp group, the bot doesn't respond. The code has group chat logic (lines 741-750) but it silently fails because:

1. **Bot's own ID (`botWid`) is often empty** -- GreenAPI doesn't always include `instanceData.wid` in webhook payloads, so the bot can't identify itself
2. **No fallback mechanism** -- when `botWid` is blank, `isBotMentioned()` always returns `false`, causing every group message to be ignored
3. **Mention cleaning is too aggressive** -- `@\d+` regex strips all number-based mentions from the message text, which can break the actual user message

## Solution

### 1. Fetch Bot WID from GreenAPI Settings (Reliable Fallback)

Add a function that calls GreenAPI's `getSettings` endpoint to retrieve the bot's own phone number/WID when `instanceData.wid` is missing:

```text
async function getBotWid(idInstance, apiToken):
  1. Call GET https://api.greenapi.com/waInstance{id}/getSettings/{token}
  2. Extract wid from response
  3. Cache in memory for the request lifetime
  4. Return wid string (e.g., "2341234567890@c.us")
```

### 2. Update Group Chat Detection Flow

In the main handler (around line 731), change:
```text
BEFORE: const botWid = webhook.instanceData?.wid || '';
AFTER:  let botWid = webhook.instanceData?.wid || '';
        if (isGroupChat(chatId) && !botWid) {
          botWid = await getBotWid(idInstance, apiToken);
        }
```

### 3. Improve `isBotMentioned()` Function

- Add a safety check: if `botWid` is still empty after fallback, log a warning and return `true` (respond rather than silently ignore)
- Add detection for `@senderData.sender` format (some GreenAPI versions use this)
- Check `webhook.messageData?.textMessageData` in addition to `extendedTextMessageData` for mentions

### 4. Fix Mention Stripping

Change the aggressive regex from:
```text
messageText.replace(/@\d+/g, '')
```
To only strip the bot's own number:
```text
messageText.replace(new RegExp(`@${normalizeWid(botWid)}`, 'g'), '')
```

Also strip `@phoenix` and `@Phoenix AI` text mentions cleanly.

### 5. Add Debug Logging

Add more detailed logging throughout the group chat flow so issues can be diagnosed from logs:
- Log the raw `botWid` value
- Log the full webhook payload for group messages (truncated)
- Log each check in `isBotMentioned` with pass/fail

---

## Technical Changes

| File | Change |
|------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Add `getBotWid()` function, update bot WID resolution, fix `isBotMentioned()`, fix mention stripping regex |

### No database changes needed -- this is purely edge function logic.

