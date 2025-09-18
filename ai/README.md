# Local FAQ assistant

This service answers **168 fictional VynixHR policy FAQs across 14 categories**.
It fits a TF-IDF vocabulary and document weights locally, combines word, phrase,
and spelling features with query-word recall, then returns a reviewed answer
verbatim with its source. It is a retrieval model, **not a generative LLM**.
It needs Python 3.10 or later and has no third-party packages or external API.

All policy values are demo examples. Review and replace them with the actual
company handbook before organizational use. The assistant cannot access
employee records, approve requests, change policies, or provide personal
legal, tax, or medical advice.

## Run

From the repository root:

```sh
python ai/train.py
python ai/serve.py --host 127.0.0.1 --port 5001
```

The repository's launcher also starts this service. Keep it on loopback;
the authenticated backend proxies chat requests. For a container network,
bind to `0.0.0.0` only inside the private network and do not publish this port.
The service itself is deliberately a small internal API without user login.

Training creates ignored `ai/model/faq_model.json` and
`ai/model/evaluation_metrics.json` and `ai/model/holdout_metrics.json`.
The model JSON contains its vocabulary,
fitted IDF weights, vectors, data checksum, and exact source answers so it can
be inspected. Identical source data yields byte-identical model files.

## API

- `GET /health` reports model readiness, FAQ count, and the data checksum.
- `POST /chat` accepts JSON such as `{"message":"How do I request annual leave?"}`.
- Messages must be non-empty strings of at most 2,000 characters; HTTP bodies
  are limited to 16 KiB and must use `Content-Type: application/json`.

Successful HTTP responses use this shape even when no FAQ can be selected:

```json
{
  "answer": "The reviewed FAQ answer, or an explanation to contact HR.",
  "confidence": 0.81,
  "matched": true,
  "source": {
    "id": "leave-01",
    "question": "How do I request annual leave?",
    "category": "Leave"
  },
  "suggestions": ["How far in advance should I request planned leave?"]
}
```

`confidence` is a similarity-and-coverage score, not a calibrated probability.
A fallback has `matched: false` and `source: null`; suggestions can help the
employee clarify their question. Invalid requests return `{ "error": "..." }`
with an appropriate HTTP status.

## Update policies and verify

1. Edit reviewed questions, answers, and keywords in `ai/data/faqs.json`.
2. Keep IDs stable and unique. Optional `aliases` add editorial paraphrases.
3. Run `python ai/train.py`, then restart the service to load the new model.
4. Run `python -m unittest discover -s ai/tests -v`.

The server checks the data checksum at startup and rejects stale models. It
holds one model in memory for a consistent process lifetime; restart after
retraining. Training never uses the evaluation file as fitting input.

The 42 cases in `ai/data/evaluation.json` are separate paraphrase and safety
acceptance examples used during development, including out-of-scope questions,
private-record requests, and instruction overrides. Their report is a small
development check, not an independent benchmark or a production accuracy
claim. The additional 24 questions in `ai/data/holdout.json` were written after
the implementation and development tuning, and are also excluded from fitting.
Their separately saved result is a small holdout check with the same limits.
Tests additionally check every canonical FAQ's grounding, deterministic
training, policy changes, input bounds, and the HTTP contract.

The local model has limited semantic understanding. Unfamiliar wording and
multi-part questions may be declined, and a lexical match can still be wrong.
Always display the source and demo-policy label, and provide an HR fallback.
The service logs request method/path/status without logging question bodies.
