# JARVIS Capability Brain

JARVIS does not use one fixed global provider order.

For each request it:
1. classifies the task into a capability profile,
2. ranks connected providers for that capability,
3. combines task fit with observed health, latency and recent quota/rate-limit failures,
4. calls the best available provider first,
5. falls back to the next best provider for that capability when needed,
6. records results so later routing adapts.

Current profiles include chat, reporting, research, coding, social strategy, video creation,
ECU diagnostics, ECU file analysis, vehicle coding, service procedures and calibration analysis.

Autonomous repository development uses Codex first and can fall back through configured
Anthropic, DeepSeek, Mistral, Gemini, xAI, OpenRouter and Groq credentials. Provider changes
are accepted only after repository checks pass.

Social/video workflows use the shared routing architecture plus the existing Meta publication
queue and video-provider pool (Higgsfield, Replicate, Runway and fal.ai).
