# 6006 PERFORMANCE — AI Chat + Live Takeover + Notifications

## Goal
Turn the automotive diagnostics website into a German lead/support surface where AI starts the conversation, captures vehicle/fault context, notifies the owner, and hands the same conversation to the owner in real time.

## Public flow
- Chat launcher on all public pages in the charcoal/ivory/gold visual system.
- Fault pages seed the chat with current DTC context.
- Vehicle context uses Marke → Modell → Baureihe/Karosserie → Baujahr → Motor.
- Chat may capture DTC, symptoms, name, phone, email and preferred callback channel.
- Meaningful engagement triggers owner push; email is fallback.

## Live takeover
Notification deep-links to `/admin/chat/:conversationId`. Owner can press `Chat übernehmen`; AI replies stop immediately. Owner replies from admin. `AI wieder aktivieren` can explicitly resume AI.

## Persistent data
`chat_conversations`: id, timestamps, status (`ai_active|human_active|waiting|closed`), page_path, fault_code, vehicle_profile_key, raw_vehicle_text, visitor_session_id, visitor contact fields, preferred_contact, assigned_to_owner, ai_resume_enabled.

`chat_messages`: id, conversation_id, sender (`visitor|ai|owner|system`), body, created_at.

Optional notification milestone table prevents duplicate alerts.

## Transport
HTTP endpoints + short polling first; model remains realtime-upgradeable.

## AI rules
Use page + vehicle context, ask concise questions, avoid definitive repair verdicts, explain that exact diagnosis depends on measurements, and stop instantly during human takeover.

## Admin
Authenticated `/admin`: active chats first, unread count, contact/vehicle/fault context and status. Conversation page has message stream, sticky context, takeover/release, reply box, close action.

## Notifications
Push title `Neue Kundenanfrage`, include vehicle summary/fault if known and deep link. Email fallback once per new qualified lead. WhatsApp Business adapter deferred.

## Privacy
German-only public UI. Explain use of contact details before submission. No implied marketing consent. Chat works without forcing phone/email. Admin data is authenticated.

## Akzeptanzkriterien
- Launcher on homepage + fault pages.
- Fault/vehicle context attached automatically.
- Conversation survives refresh.
- Owner receives push; email fallback exists.
- `/admin` authenticated.
- Human takeover immediately stops AI.
- Owner replies are visible to visitor.
- Vehicle/fault context is visible in admin.
- Existing site remains intact.
