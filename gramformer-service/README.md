# Grammar Lens — Real Gramformer Service

This folder runs the real Gramformer Python model used by Grammar Lens.

It uses the upstream Gramformer API:
- Gramformer(models=1, use_gpu=False)
- gf.correct(...)
- gf.get_edits(...)

Upstream Gramformer is sentence-oriented and notes that it was trained around 64-token sentences, so this service splits submitted text into sentences before analysis.

## Run locally

    cd gramformer-service
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8000

Health check:

    curl http://localhost:8000/health

Test:

    curl -X POST http://localhost:8000/analyze -H 'Content-Type: application/json' -d '{"text":"He are moving here."}'

## Docker

    docker build -t grammar-lens-gramformer .
    docker run --rm -p 8000:8000 grammar-lens-gramformer

Optional protection:

    docker run --rm -p 8000:8000 -e GRAMFORMER_SERVICE_TOKEN='change-me' grammar-lens-gramformer

Cloudflare Pages should use:
- GRAMFORMER_API_URL = the public base URL of this service
- GRAMFORMER_SERVICE_TOKEN = the same token, if enabled
