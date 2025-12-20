# Verification notes

The repository includes repeatable checks through `python scripts/check.py` and a Windows/Linux GitHub Actions workflow. The complete integration can be checked with `python start.py --skip-install --smoke-test` after setup.

## Automated coverage

- Backend integration tests use isolated in-memory SQLite databases. They cover authentication, administrator and employee permissions, employee CRUD/archive, validation, leave overlap and review state, attendance, recruitment, announcements, settings, seed preservation, task ownership, deleted sessions, upcoming events, and the AI proxy.
- AI tests cover all 168 exact FAQ questions, source grounding, deterministic training, retraining changed policies, stale model rejection, unknown questions, personal-record restrictions, input bounds, and HTTP responses.
- Frontend checks run ESLint, Prettier, TypeScript, and the Vite production build.
- The launch smoke test starts all three services, signs in through the frontend API proxy, reads seeded employees and dashboard data, obtains a sourced FAQ answer, checks an unrelated-question fallback, and shuts the services down.

The launcher also refuses occupied ports without terminating unrelated processes. Runtime settings, databases, and generated model artifacts are excluded from source control.

## FAQ evaluation

| Check | Result |
| --- | --- |
| Canonical FAQ grounding | 168/168 return their exact source answer |
| Development paraphrase and safety examples | 40/42 (95.2%) |
| Additional post-tuning holdout examples | 19/24 (79.2%) |

The development set informed tuning; it is not an independent accuracy benchmark. The additional holdout was written after tuning and was excluded from fitting. Of its five misses, four returned an HR fallback and one retrieved the wrong FAQ. These small English-language examples are not evidence of production reliability. The app displays sources and identifies its answers as fictional demo policies.

This implementation does not train a generative language model. It fits a local text-retrieval model, and semantic generalization is limited. Employee records are not inputs to FAQ training or chat inference.
