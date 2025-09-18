"""Fit the local FAQ model and report separate development and holdout checks."""

import argparse
import json
from pathlib import Path

from retriever import DATA_PATH, MODEL_PATH, FAQAssistant, train


def evaluate(assistant, path):
    cases = json.loads(Path(path).read_text(encoding="utf-8"))["cases"]
    results = []
    for case in cases:
        result = assistant.respond(case["message"])
        actual = result["source"]["id"] if result["matched"] else None
        results.append(
            {
                "message": case["message"],
                "expected": case["expected_id"],
                "actual": actual,
                "correct": actual == case["expected_id"],
                "confidence": result["confidence"],
            }
        )
    correct = sum(result["correct"] for result in results)
    return {
        "cases": len(results),
        "correct": correct,
        "accuracy": round(correct / len(results), 4),
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_PATH)
    parser.add_argument("--output", type=Path, default=MODEL_PATH)
    parser.add_argument("--skip-evaluation", action="store_true")
    args = parser.parse_args()
    model = train(args.data, args.output)
    print(
        f"Trained {len(model['faqs'])} FAQs with {len(model['idf'])} locally fitted features."
    )
    print(f"Model: {args.output.resolve()}")
    if not args.skip_evaluation:
        assistant = FAQAssistant(args.output, args.data)
        report = evaluate(assistant, DATA_PATH.parent / "evaluation.json")
        report_path = args.output.parent / "evaluation_metrics.json"
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(
            f"Development evaluation: {report['correct']}/{report['cases']} ({report['accuracy']:.1%})."
        )
        holdout = evaluate(assistant, DATA_PATH.parent / "holdout.json")
        holdout_path = args.output.parent / "holdout_metrics.json"
        holdout_path.write_text(json.dumps(holdout, indent=2) + "\n", encoding="utf-8")
        print(
            f"Additional holdout: {holdout['correct']}/{holdout['cases']} ({holdout['accuracy']:.1%})."
        )
        print(
            "Confidence blends retrieval similarity and query recall, not a calibrated probability."
        )


if __name__ == "__main__":
    main()
