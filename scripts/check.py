"""Run the same project checks locally and in GitHub Actions."""

from pathlib import Path
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def main() -> int:
    if not PYTHON.exists():
        print("Run python start.py --setup-only before running checks.")
        return 1
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        print("Node.js and npm are required.")
        return 1
    checks = [
        (
            [str(PYTHON), "-m", "unittest", "discover", "-s", "tests", "-v"],
            ROOT / "backend",
        ),
        ([str(PYTHON), "-m", "unittest", "discover", "-s", "ai/tests", "-v"], ROOT),
        ([npm, "run", "lint"], ROOT / "frontend"),
        ([npm, "run", "format:check"], ROOT / "frontend"),
        ([npm, "run", "build"], ROOT / "frontend"),
    ]
    for command, directory in checks:
        print(f"\nChecking {directory.name}: {' '.join(command[1:])}", flush=True)
        result = subprocess.run(command, cwd=directory, check=False)
        if result.returncode:
            return result.returncode
    print("\nAll project checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
