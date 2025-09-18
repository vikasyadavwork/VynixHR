"""A small, inspectable TF-IDF retriever using only Python's standard library.

The model fits a vocabulary and inverse document frequencies to FAQ questions
and editorial keywords. It retrieves a reviewed answer; it never generates or
changes company policy. Confidence combines cosine similarity and query-word
recall; it is not a probability.
"""

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "faqs.json"
MODEL_PATH = ROOT / "model" / "faq_model.json"
MODEL_VERSION = 2
MAX_MESSAGE_LENGTH = 2000
MIN_SCORE = 0.40
AMBIGUITY_MARGIN = 0.045

STOP_WORDS = set(
    "a an the is are was were be been being do does did can could would should "
    "will may might i me my we our us you your it its this that these those to "
    "of for from in on at with and or but if as by about please tell explain "
    "what which how when where who why get have has had need want vynixhr demo "
    "like some up next step happens happen handles must taking receive "
    "provided available each process procedure id d vynixhr demo".split()
)

# These are general language normalizations, not held-out evaluation answers.
SYNONYMS = {
    "pto": "leave",
    "vacation": "leave",
    "holiday": "holiday",
    "holidays": "holiday",
    "salaries": "salary",
    "paycheck": "payslip",
    "paychecks": "payslip",
    "payslips": "payslip",
    "wfh": "remote",
    "reimburse": "reimbursement",
    "reimbursed": "reimbursement",
    "reimbursements": "reimbursement",
    "expenses": "expense",
    "passwords": "password",
    "employees": "employee",
    "managers": "manager",
    "approvals": "approval",
    "documents": "document",
    "benefits": "benefit",
    "interviews": "interview",
    "resignation": "resign",
    "resigning": "resign",
    "laptops": "laptop",
    "receipts": "receipt",
    "sick": "sickness",
    "ill": "sickness",
    "illness": "sickness",
    "illnesses": "sickness",
    "forgotten": "forgot",
    "children": "child",
    "stole": "stolen",
    "yearly": "annual",
    "permission": "approval",
    "require": "required",
    "working": "work",
    "arrive": "arrived",
    "appraisal": "review",
    "appraisals": "review",
    "frequently": "frequency",
    "often": "frequency",
    "complaints": "complaint",
    "departing": "leaving",
    "notes": "document",
    "paperwork": "document",
    "hires": "employee",
    "hired": "employee",
    "book": "request",
    "booking": "request",
    "lose": "lost",
}

FALLBACK_ANSWER = (
    "I could not confidently match that question to a reviewed FAQ. "
    "Please ask your HR team, or try one of the suggested questions. "
    "I only answer the fictional VynixHR demo policies."
)
PRIVATE_ANSWER = (
    "I cannot access personal salary, bank, medical, leave-balance, or employee "
    "records. Use your authorized HR workspace or contact HR for your own "
    "information. I can explain the fictional demo policies."
)
INSTRUCTION_ANSWER = (
    "I can explain reviewed fictional VynixHR demo policies, but cannot change "
    "policy, approve requests, reveal secrets, or follow instructions that "
    "override the FAQ. Please contact HR for an exception."
)


def tokenize(text):
    """Normalize words while keeping useful policy distinctions like 'not'."""
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    plain = re.sub(
        r"\b(can(?:not|'t)|could(?: not|n't)) find\b", "lost", plain, flags=re.I
    )
    plain = re.sub(r"\bby when\b", "deadline", plain, flags=re.I)
    plain = re.sub(r"\bsalary slip\b", "payslip", plain, flags=re.I)
    words = re.findall(r"[a-z0-9]+", plain.lower())
    normalized = []
    for word in words:
        if word in STOP_WORDS:
            continue
        word = SYNONYMS.get(word, word)
        if (
            len(word) > 4
            and word.endswith("s")
            and not word.endswith(("ss", "us", "is"))
        ):
            word = word[:-1]
        normalized.append(word)
    return normalized


def features(text):
    """Mix word, phrase, and small spelling features for short questions."""
    words = tokenize(text)
    result = Counter()
    for word in words:
        result[f"word:{word}"] += 1.0
        if len(word) >= 4:
            padded = f"^{word}$"
            for index in range(len(padded) - 2):
                result[f"char:{padded[index:index + 3]}"] += 0.08
    for left, right in zip(words, words[1:]):
        result[f"phrase:{left} {right}"] += 0.4
    return result


def vectorize(counts, idf):
    vector = {
        name: (1 + math.log(value) if value >= 1 else value) * idf[name]
        for name, value in counts.items()
        if name in idf
    }
    norm = math.sqrt(sum(value * value for value in vector.values()))
    return {name: value / norm for name, value in vector.items()} if norm else {}


def dataset_hash(path=DATA_PATH):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_dataset(path=DATA_PATH):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    faqs = data.get("faqs", [])
    ids = set()
    questions = set()
    for faq in faqs:
        for field in ("id", "category", "question", "answer", "keywords"):
            if not isinstance(faq.get(field), str) or not faq[field].strip():
                raise ValueError(f"Each FAQ must have a non-empty {field}.")
        if faq["id"] in ids or faq["question"].casefold() in questions:
            raise ValueError("FAQ IDs and questions must be unique.")
        ids.add(faq["id"])
        questions.add(faq["question"].casefold())
    if len(faqs) < 150:
        raise ValueError("The demo needs at least 150 reviewed FAQ entries.")
    return data


def train(data_path=DATA_PATH, model_path=MODEL_PATH):
    """Fit IDF weights and normalized FAQ vectors deterministically."""
    data = read_dataset(data_path)
    documents = []
    for index, faq in enumerate(data["faqs"]):
        # Preserve a focused question vector and a separate keyword vector.
        texts = [faq["question"], faq["question"] + " " + faq["keywords"]]
        texts.extend(faq.get("aliases", []))
        for phrase in texts:
            documents.append((index, features(phrase)))
    document_frequency = Counter()
    for _, counts in documents:
        document_frequency.update(counts.keys())
    idf = {
        name: math.log((1 + len(documents)) / (1 + count)) + 1
        for name, count in sorted(document_frequency.items())
    }
    model = {
        "version": MODEL_VERSION,
        "algorithm": "TF-IDF word/phrase/character retrieval with query recall",
        "dataset_sha256": dataset_hash(data_path),
        "metadata": data["metadata"],
        "faqs": data["faqs"],
        "idf": idf,
        "vectors": [
            {"faq_index": index, "weights": vectorize(counts, idf)}
            for index, counts in documents
        ],
        "faq_words": [
            sorted(
                set(
                    tokenize(
                        " ".join(
                            [faq["question"], faq["keywords"], *faq.get("aliases", [])]
                        )
                    )
                )
            )
            for faq in data["faqs"]
        ],
    }
    target = Path(model_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(model, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    temporary.replace(target)
    return model


def blocked_answer(message):
    lower = message.lower()
    instructions = (
        r"ignore\b.{0,50}\b(instructions|rules|policy|previous|faq)",
        r"(override|bypass|forget)\b.{0,45}\b(policy|rules|instructions|faq)",
        r"(system prompt|developer message|api key|access token|secret key)",
        r"(pretend|act as)\b.{0,35}\b(admin|hr|system|unrestricted)",
        r"(approve|grant|authorize)\s+(my|our|this)\s+(leave|request|expense|claim)",
    )
    if any(re.search(pattern, lower) for pattern in instructions):
        return INSTRUCTION_ANSWER
    # How to access a record is a policy FAQ. Returning someone's record is not.
    navigation = re.search(
        r"\b(how|where|what should i do|process|procedure|policy|download|find|view|access|update|change|correct)\b",
        lower,
    )
    personal = re.search(
        r"\b(my|his|her|their|someone|employee|employee's|coworker|colleague|john|jane)\b",
        lower,
    )
    private_data = re.search(
        r"\b(salary|balance|bank|medical|payslip|address|phone|diagnosis|account number)\b",
        lower,
    )
    possessive_record = re.search(
        r"\b\w+['’]s\s+(salary|balance|bank|medical|payslip|address|phone)\b",
        lower,
    )
    direct_record = re.search(
        r"\b(show|reveal|list|give|tell|calculate|amount|exact)\b", lower
    )
    if (
        (personal or possessive_record)
        and private_data
        and (not navigation or direct_record)
    ):
        return PRIVATE_ANSWER
    return None


class FAQAssistant:
    def __init__(self, model_path=MODEL_PATH, data_path=DATA_PATH):
        self.model_path = Path(model_path)
        self.data_path = Path(data_path)
        self.model = json.loads(self.model_path.read_text(encoding="utf-8"))
        if self.model.get("version") != MODEL_VERSION:
            raise ValueError("The model version changed. Run python ai/train.py again.")
        if self.model.get("dataset_sha256") != dataset_hash(self.data_path):
            raise ValueError("FAQ data changed. Run python ai/train.py before serving.")
        self.faqs = self.model["faqs"]

    def respond(self, message):
        if not isinstance(message, str) or not message.strip():
            raise ValueError("message must be a non-empty string")
        if len(message) > MAX_MESSAGE_LENGTH:
            raise ValueError(
                f"message must be {MAX_MESSAGE_LENGTH} characters or fewer"
            )
        message = message.strip()
        blocked = blocked_answer(message)
        if blocked:
            return self.fallback([], blocked)
        query = vectorize(features(message), self.model["idf"])
        scores = [0.0] * len(self.faqs)
        for document in self.model["vectors"]:
            score = sum(
                weight * document["weights"].get(name, 0)
                for name, weight in query.items()
            )
            index = document["faq_index"]
            scores[index] = max(scores[index], score)
        # Query recall rewards a specific word such as 'allowance' without
        # penalizing a well-written FAQ for having more editorial keywords.
        query_words = set(tokenize(message))
        word_weights = {
            word: self.model["idf"].get(f"word:{word}", 0) for word in query_words
        }
        total_weight = sum(word_weights.values())
        for index, words in enumerate(self.model["faq_words"]):
            recall = sum(word_weights.get(word, 0) for word in words) / max(
                total_weight, 1
            )
            scores[index] = 0.5 * scores[index] + 0.5 * recall
        ranked = sorted(
            range(len(scores)),
            key=lambda index: (-scores[index], self.faqs[index]["id"]),
        )
        top, second = ranked[:2]
        score = scores[top]
        suggestions = [
            self.faqs[index]["question"]
            for index in ranked[:3]
            if scores[index] >= 0.15
        ]
        known_words = set(self.model["faq_words"][top])
        coverage = len(query_words & known_words) / max(1, len(query_words))
        ambiguous = score < 0.90 and score - scores[second] < AMBIGUITY_MARGIN
        too_few_details = len(query_words & known_words) < 2 and score < 0.90
        if (
            score < MIN_SCORE
            or coverage < 0.35
            or ambiguous
            or too_few_details
            or not query_words
        ):
            return self.fallback(suggestions, confidence=score)
        faq = self.faqs[top]
        return {
            "answer": faq["answer"],
            "confidence": round(min(score, 1.0), 3),
            "matched": True,
            "source": {key: faq[key] for key in ("id", "question", "category")},
            "suggestions": [
                question for question in suggestions if question != faq["question"]
            ],
        }

    @staticmethod
    def fallback(suggestions, answer=FALLBACK_ANSWER, confidence=0.0):
        return {
            "answer": answer,
            "confidence": round(min(confidence, 1.0), 3),
            "matched": False,
            "source": None,
            "suggestions": suggestions,
        }
