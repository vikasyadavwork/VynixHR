"""Set up and run the complete local VynixHR workspace with one command."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener
import webbrowser

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / ".runtime"
VENV = ROOT / ".venv"
IS_WINDOWS = os.name == "nt"
PYTHON = VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
SERVICES = (("AI", 5001), ("Backend", 5000), ("Frontend", 5173))
LOCAL_HTTP = build_opener(ProxyHandler({}))


def say(message: str) -> None:
    print(f"[VynixHR] {message}", flush=True)


def run(command: list[str], cwd: Path = ROOT, env: dict | None = None) -> None:
    subprocess.run(command, cwd=cwd, env=env, check=True)


def fingerprint(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.read_bytes())
    return digest.hexdigest()


def install_dependencies(skip_install: bool) -> None:
    npm = shutil.which("npm.cmd" if IS_WINDOWS else "npm")
    node = shutil.which("node")
    if not npm or not node:
        raise RuntimeError(
            "Install Node.js 20.19+ (including npm), then run this script again."
        )
    version = (
        subprocess.check_output([node, "--version"], text=True).strip().lstrip("v")
    )
    major, minor = (int(value) for value in version.split(".")[:2])
    if major < 20 or (major == 20 and minor < 19):
        raise RuntimeError("Node.js 20.19+ is required.")
    if not PYTHON.exists():
        if skip_install:
            raise RuntimeError(
                "Virtual environment missing. Run without --skip-install first."
            )
        say("Creating an isolated Python environment...")
        run([sys.executable, "-m", "venv", str(VENV)])

    requirements = ROOT / "backend" / "requirements.txt"
    python_stamp = VENV / ".vynixhr-dependencies.sha256"
    expected = fingerprint([requirements])
    if not skip_install and (
        not python_stamp.exists() or python_stamp.read_text() != expected
    ):
        say("Installing backend dependencies...")
        run(
            [
                str(PYTHON),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "-r",
                str(requirements),
            ]
        )
        python_stamp.write_text(expected)

    frontend = ROOT / "frontend"
    expected = fingerprint([frontend / "package.json", frontend / "package-lock.json"])
    node_stamp = RUNTIME / "node-dependencies.sha256"
    installed = (frontend / "node_modules" / "vite" / "bin" / "vite.js").exists()
    if skip_install and not installed:
        raise RuntimeError(
            "Frontend dependencies missing. Run without --skip-install first."
        )
    if not skip_install and (
        not installed or not node_stamp.exists() or node_stamp.read_text() != expected
    ):
        say("Installing frontend dependencies from the lockfile...")
        run([npm, "ci", "--no-fund", "--no-audit"], cwd=frontend)
        node_stamp.write_text(expected)


def configure_environment() -> dict[str, str]:
    backend = ROOT / "backend"
    instance = backend / "instance"
    instance.mkdir(parents=True, exist_ok=True)
    env_path = backend / ".env"
    if not env_path.exists():
        database = (instance / "vynixhr.db").as_posix()
        env_path.write_text(
            "# Generated local settings. Never commit this file.\n"
            f"JWT_SECRET_KEY={secrets.token_hex(32)}\n"
            f"DATABASE_URL=sqlite:///{database}\n"
            "AI_SERVICE_URL=http://127.0.0.1:5001\n",
            encoding="utf-8",
        )
        say("Created local settings with a unique session secret.")
    environment = os.environ.copy()
    environment["PYTHONUNBUFFERED"] = "1"
    environment["FLASK_DEBUG"] = "0"
    return environment


def check_ports() -> None:
    for name, port in SERVICES:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            try:
                connection.bind(("127.0.0.1", port))
            except OSError as error:
                raise RuntimeError(
                    f"{name} port {port} is already in use. Stop that service before starting VynixHR."
                ) from error


def start_service(name: str, command: list[str], cwd: Path, environment: dict) -> tuple:
    log_path = RUNTIME / f"{name.lower()}.log"
    log = log_path.open("w", encoding="utf-8")
    options = (
        {
            "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP
            | subprocess.CREATE_NO_WINDOW
        }
        if IS_WINDOWS
        else {"start_new_session": True}
    )
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env=environment,
            stdout=log,
            stderr=subprocess.STDOUT,
            **options,
        )
    except OSError:
        log.close()
        raise
    return name, process, log, log_path


def wait_for_service(service: tuple, url: str, timeout: int = 60) -> None:
    name, process, _, log_path = service
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{name} exited unexpectedly. See {log_path}")
        try:
            with LOCAL_HTTP.open(url, timeout=2) as response:
                if response.status == 200:
                    say(f"{name} is ready.")
                    return
        except (URLError, TimeoutError, OSError):
            time.sleep(0.25)
    raise RuntimeError(f"{name} did not become ready. See {log_path}")


def stop_services(services: list[tuple]) -> None:
    for name, process, log, _ in reversed(services):
        if process.poll() is None:
            if IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        log.close()
        say(f"{name} stopped.")


def check_integration() -> None:
    """Exercise the browser proxy, authentication, database, and trained model."""
    base = "http://127.0.0.1:5173/api/v1"

    def request(path: str, payload: dict | None = None, token: str = "") -> dict:
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        body = json.dumps(payload).encode() if payload is not None else None
        with LOCAL_HTTP.open(
            Request(base + path, data=body, headers=headers), timeout=15
        ) as response:
            return json.load(response)

    session = request(
        "/auth/sign-in", {"email": "admin@vynixhr.local", "password": "Welcome@123"}
    )
    token = session.get("token", "")
    if not token:
        raise RuntimeError("Integration check: demo sign-in did not return a session.")
    employees = request("/hr/employees", token=token).get("employees", [])
    if not employees:
        raise RuntimeError("Integration check: the employee database is empty.")
    request("/hr/overview", token=token)
    reply = request("/ai/chat", {"message": "How do I apply for annual leave?"}, token)
    if not reply.get("matched") or not reply.get("source") or not reply.get("answer"):
        raise RuntimeError(
            "Integration check: the assistant did not return a sourced HR answer."
        )
    unrelated = request(
        "/ai/chat", {"message": "What is the population of Jupiter?"}, token
    )
    if unrelated.get("matched"):
        raise RuntimeError(
            "Integration check: the assistant answered an unrelated question."
        )
    say(
        f"Integration checks passed: sign-in, {len(employees)} employees, dashboard, and sourced AI replies."
    )


def request_shutdown(_signal_number, _frame) -> None:
    raise KeyboardInterrupt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-browser", action="store_true", help="Do not open a browser tab."
    )
    parser.add_argument(
        "--skip-install", action="store_true", help="Reuse installed dependencies."
    )
    parser.add_argument(
        "--setup-only",
        action="store_true",
        help="Install, seed, and train without starting servers.",
    )
    parser.add_argument(
        "--smoke-test",
        action="store_true",
        help="Start and check every service, then shut down.",
    )
    args = parser.parse_args()
    signal.signal(signal.SIGTERM, request_shutdown)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, request_shutdown)
    services: list[tuple] = []
    try:
        if sys.version_info < (3, 11):
            raise RuntimeError("Python 3.11 or newer is required.")
        RUNTIME.mkdir(exist_ok=True)
        if not args.setup_only:
            check_ports()
        install_dependencies(args.skip_install)
        environment = configure_environment()
        say("Preparing SQLite and sample employee data...")
        run([str(PYTHON), "seed.py"], cwd=ROOT / "backend", env=environment)
        say("Training the local FAQ assistant...")
        run([str(PYTHON), "ai/train.py"], env=environment)
        if args.setup_only:
            say("Setup complete. Run python start.py to open the workspace.")
            return 0

        commands = [
            (
                "AI",
                [str(PYTHON), "ai/serve.py", "--host", "127.0.0.1", "--port", "5001"],
                ROOT,
                "http://127.0.0.1:5001/health",
            ),
            (
                "Backend",
                [
                    str(PYTHON),
                    "-m",
                    "flask",
                    "--app",
                    "application:app",
                    "run",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "5000",
                    "--no-reload",
                ],
                ROOT / "backend",
                "http://127.0.0.1:5000/api/v1/health",
            ),
            (
                "Frontend",
                [
                    shutil.which("node"),
                    "node_modules/vite/bin/vite.js",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "5173",
                    "--strictPort",
                ],
                ROOT / "frontend",
                "http://127.0.0.1:5173",
            ),
        ]
        for name, command, cwd, url in commands:
            service = start_service(name, command, cwd, environment)
            services.append(service)
            wait_for_service(service, url)

        say("All services are ready at http://127.0.0.1:5173")
        say("Demo sign-in: admin@vynixhr.local / Welcome@123")
        say("SQLite runs inside the backend; it does not need another server.")
        say("Service logs are in .runtime/. Press Ctrl+C to stop everything.")
        if args.smoke_test:
            check_integration()
            say(
                "Smoke test passed: database, backend, frontend, and local AI started successfully."
            )
            return 0
        if not args.no_browser:
            webbrowser.open("http://127.0.0.1:5173")
        while True:
            for name, process, _, log_path in services:
                if process.poll() is not None:
                    raise RuntimeError(f"{name} stopped. See {log_path}")
            time.sleep(0.5)
    except KeyboardInterrupt:
        say("Shutting down...")
        return 0
    except (RuntimeError, OSError, subprocess.CalledProcessError, ValueError) as error:
        say(f"Startup failed: {error}")
        return 1
    finally:
        stop_services(services)


if __name__ == "__main__":
    sys.exit(main())
