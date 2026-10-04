import os
import re
from functools import lru_cache

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from gramformer import Gramformer

app = FastAPI(title="Grammar Lens Gramformer Service", version="1.0.0")
SERVICE_TOKEN = os.getenv("GRAMFORMER_SERVICE_TOKEN", "").strip()

class AnalyzeRequest(BaseModel):
    text: str
    max_candidates: int = 1

@lru_cache(maxsize=1)
def get_model():
    return Gramformer(models=1, use_gpu=False)

def split_sentences(text: str):
    parts = re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", text, flags=re.S)
    result, cursor = [], 0
    for part in parts:
        start = text.find(part, cursor)
        if start < 0:
            start = cursor
        result.append((start, part))
        cursor = start + len(part)
    return result

def token_char_span(sentence: str, start_token: int, end_token: int):
    tokens = list(re.finditer(r"\S+", sentence))
    if start_token < 0 or start_token >= len(tokens):
        return None
    end_token = max(start_token + 1, min(end_token, len(tokens)))
    return tokens[start_token].start(), tokens[end_token - 1].end()

def edit_to_issue(sentence: str, sentence_offset: int, edit):
    edit_type, original, o_start, o_end, corrected, c_start, c_end = edit
    span = token_char_span(sentence, o_start, o_end)
    if span is None:
        return None

    start, end = span
    original_text = sentence[start:end]

    if original == "":
        category = "Punctuation" if edit_type == "PUNCT" else "Grammar"
    elif edit_type == "SPELL":
        category = "Spelling"
    elif edit_type == "PUNCT":
        category = "Punctuation"
    else:
        category = "Grammar"

    replacement = corrected.strip()
    return {
        "category": category,
        "severity": "error",
        "originalText": original_text,
        "suggestions": [replacement] if replacement and replacement != original_text else [],
        "shortTitle": edit_type.replace("_", " ").title() or "Grammar issue",
        "explanation": f"Gramformer detected a {category.lower()} issue and suggested: {replacement}.",
        "startIndex": sentence_offset + start,
        "endIndex": sentence_offset + end,
        "editType": edit_type,
    }

@app.get("/health")
def health():
    return {"ok": True, "engine": "gramformer"}

@app.post("/analyze")
def analyze(request: AnalyzeRequest, authorization: str | None = Header(default=None)):
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    if len(text) > 20000:
        raise HTTPException(status_code=413, detail="Text is too long for Gramformer service.")

    gf = get_model()
    mistakes = []

    for sentence_offset, sentence in split_sentences(text):
        clean_sentence = sentence.strip()
        if not clean_sentence:
            continue

        leading = len(sentence) - len(sentence.lstrip())
        actual_offset = sentence_offset + leading

        try:
            candidates = gf.correct(
                clean_sentence,
                max_candidates=max(1, min(request.max_candidates, 3)),
            )
            if not candidates:
                continue

            corrected = next(iter(candidates))
            if corrected.strip() == clean_sentence.strip():
                continue

            for edit in gf.get_edits(clean_sentence, corrected):
                issue = edit_to_issue(clean_sentence, actual_offset, edit)
                if issue:
                    mistakes.append(issue)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Gramformer failed on a sentence: {exc}",
            ) from exc

    return {"mistakes": mistakes}
