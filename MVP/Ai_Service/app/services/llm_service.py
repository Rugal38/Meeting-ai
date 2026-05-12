import re
import logging

from app.services.groq_client import call_mistral

logger = logging.getLogger(__name__)


async def analyze_text(text: str, language: str = "fr") -> dict:
    is_french = language.lower().startswith("fr")

    if is_french:
        instructions = (
            "RÉPONDS UNIQUEMENT EN FRANÇAIS. En te basant sur la transcription, "
            "fournis les sections suivantes EXACTEMENT dans ce format :\n\n"
            "SUMMARY: (Rédige un résumé détaillé de 3 à 5 paragraphes. "
            "Couvre : le contexte général de la réunion, les principaux sujets abordés, "
            "les débats ou points de tension, et les décisions importantes prises. "
            "Sois précis et complet.)\n\n"
            "POINTS:\n"
            "- (point clé 1)\n"
            "- (point clé 2)\n"
            "- ... (liste entre 8 et 12 points clés distincts et précis tirés de la transcription)\n\n"
            "CONCLUSIONS:\n"
            "- (conclusion 1)\n"
            "- ... (liste entre 5 et 8 conclusions ou actions à retenir)"
        )
        context_label = "CONTEXTE: TRANSCRIPTION DE RÉUNION"
        lang_reminder = "IMPORTANT: Réponds en FRANÇAIS."
    else:
        instructions = (
            "Based on the transcript, provide the following sections EXACTLY:\n\n"
            "SUMMARY: (Write a detailed summary of 3 to 5 paragraphs. "
            "Cover: the general context of the meeting, the main topics discussed, "
            "any debates or points of contention, and the key decisions made. "
            "Be thorough and precise.)\n\n"
            "POINTS:\n"
            "- (key point 1)\n"
            "- (key point 2)\n"
            "- ... (list between 8 and 12 distinct, specific key points from the transcript)\n\n"
            "CONCLUSIONS:\n"
            "- (conclusion 1)\n"
            "- ... (list between 5 and 8 conclusions or action items)"
        )
        context_label = "CONTEXT: MEETING TRANSCRIPT"
        lang_reminder = "IMPORTANT: Respond in ENGLISH."

    prompt = (
        f"{context_label}\n{lang_reminder}\n\n"
        f"Transcript:\n{text}\n\n{instructions}"
    )

    response = call_mistral(prompt, max_tokens=2500)
    return _parse_response(response)


async def translate_text(text: str, target_language: str) -> str:
    lang_names = {"en": "English", "fr": "French", "ar": "Arabic (Modern Standard Arabic)"}
    lang_name = lang_names.get(target_language, "English")

    prompt = (
        f"Translate the following text to {lang_name}. "
        "Preserve paragraph structure and formatting. "
        "Output ONLY the translation — no explanations, no preamble.\n\n"
        f"Text:\n{text}"
    )
    return call_mistral(prompt, max_tokens=3000)


def _parse_response(response: str) -> dict:
    summary = ""
    points: list[str] = []
    conclusions: list[str] = []

    try:
        parts = re.split(r"(SUMMARY:|POINTS:|CONCLUSIONS:)", response)
        for i, part in enumerate(parts):
            if part == "SUMMARY:" and i + 1 < len(parts):
                summary = parts[i + 1].strip()
            elif part == "POINTS:" and i + 1 < len(parts):
                raw = parts[i + 1].strip()
                points = [p.lstrip("- ").strip() for p in raw.splitlines() if p.strip()]
            elif part == "CONCLUSIONS:" and i + 1 < len(parts):
                raw = parts[i + 1].strip()
                conclusions = [c.lstrip("- ").strip() for c in raw.splitlines() if c.strip()]
    except Exception:
        logger.exception("Failed to parse LLM response; returning raw text as summary.")
        summary = response

    return {
        "resume": summary,
        "pointsCles": points[:15],
        "conclusions": conclusions[:10],
    }
