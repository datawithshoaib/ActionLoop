#!/usr/bin/env python3
"""
ActionLoop Application Launcher
-------------------------------
Starts both the FastAPI backend and Next.js frontend servers concurrently.
Handles log formatting, automatic virtualenv detection, graceful shutdown (Ctrl+C),
and optional automatic browser opening.

Usage:
    python run.py                   # Start both backend and frontend
    python run.py --backend-only    # Start only the FastAPI backend
    python run.py --frontend-only   # Start only the Next.js frontend
    python run.py --open            # Start both and open browser to frontend
    python run.py --port 8000       # Custom backend port
    python run.py --frontend-port 3000 # Custom frontend port
    python run.py --help            # View all available options
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

# Ensure UTF-8 output where possible on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Base directories
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

# ANSI color codes
CYAN = "\033[96m"
MAGENTA = "\033[95m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def enable_windows_ansi() -> None:
    """Enables ANSI escape sequence processing on Windows command prompt."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE = -11
            mode = ctypes.c_ulong()
            if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                kernel32.SetConsoleMode(handle, mode.value | 0x0004)  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
        except Exception:
            pass


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Checks if a TCP port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def find_python_executable() -> str:
    """
    Locates the best Python executable for running backend services.
    Checks backend/venv, backend/.venv, root/venv, root/.venv, or falls back to sys.executable.
    """
    candidates = [
        BACKEND_DIR / "venv",
        BACKEND_DIR / ".venv",
        ROOT_DIR / "venv",
        ROOT_DIR / ".venv",
    ]
    for venv_path in candidates:
        if sys.platform == "win32":
            py_bin = venv_path / "Scripts" / "python.exe"
        else:
            py_bin = venv_path / "bin" / "python"
        if py_bin.is_file():
            return str(py_bin)

    return sys.executable


def check_backend_dependencies(python_bin: str) -> bool:
    """Verifies that FastAPI and Uvicorn can be imported by the chosen Python executable."""
    try:
        res = subprocess.run(
            [python_bin, "-c", "import fastapi, uvicorn"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=BACKEND_DIR,
            check=False,
        )
        return res.returncode == 0
    except Exception:
        return False


def find_npm_executable() -> str | None:
    """Locates the npm executable (handling .cmd on Windows)."""
    if sys.platform == "win32":
        npm_path = shutil.which("npm.cmd")
        if npm_path:
            return npm_path
    return shutil.which("npm")


def stream_logs(pipe, prefix: str, color: str, use_prefix: bool = True) -> None:
    """Reads lines from a subprocess pipe and prints them with a colored tag."""
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            if use_prefix:
                clean_line = line.rstrip("\r\n")
                print(f"{color}[{prefix}]{RESET} {clean_line}", flush=True)
            else:
                print(line, end="", flush=True)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def terminate_process(proc: subprocess.Popen | None, name: str = "Process") -> None:
    """Gracefully terminates a subprocess and all its children."""
    if proc is None or proc.poll() is not None:
        return

    try:
        if sys.platform == "win32":
            # Force kill the entire process tree on Windows (kills child node.exe/python.exe)
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def check_groq_status() -> None:
    """Checks backend/.env for Groq API key configuration and prints a status notice."""
    env_file = BACKEND_DIR / ".env"
    has_groq = False
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GROQ_API_KEY=") and len(line.split("=", 1)[1].strip()) > 0:
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val and val not in ("your_api_key_here", "your_groq_api_key_here"):
                            has_groq = True
                            break
        except Exception:
            pass

    if has_groq:
        print(f"  {GREEN}[OK]{RESET} GROQ_API_KEY configured in backend/.env")
    else:
        print(
            f"  {YELLOW}[!]{RESET} GROQ_API_KEY is not set in backend/.env\n"
            f"      {DIM}ActionLoop will use built-in heuristic/sample fallback mode.{RESET}\n"
            f"      {DIM}Add your Groq API key to backend/.env for full AI extraction.{RESET}"
        )


def wait_and_open_browser(url: str, port: int, timeout: float = 20.0) -> None:
    """Waits for the service port to become ready, then opens the URL in the browser."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_in_use(port):
            time.sleep(1.0)  # Brief buffer for dev server route compilation
            try:
                webbrowser.open(url)
            except Exception:
                pass
            return
        time.sleep(0.5)
    # If timeout reached, try opening anyway
    try:
        webbrowser.open(url)
    except Exception:
        pass


def install_dependencies(python_bin: str, npm_bin: str | None, install_backend: bool, install_frontend: bool) -> bool:
    """Installs dependencies for backend and/or frontend."""
    success = True
    if install_backend:
        req_file = BACKEND_DIR / "requirements.txt"
        if req_file.exists():
            print(f"{CYAN}[ActionLoop] Installing backend dependencies...{RESET}")
            res = subprocess.run([python_bin, "-m", "pip", "install", "-r", str(req_file)], cwd=BACKEND_DIR)
            if res.returncode != 0:
                print(f"{RED}[ActionLoop] Failed to install backend dependencies.{RESET}")
                success = False

    if install_frontend and npm_bin:
        print(f"{MAGENTA}[ActionLoop] Installing frontend dependencies...{RESET}")
        res = subprocess.run([npm_bin, "install"], cwd=FRONTEND_DIR)
        if res.returncode != 0:
            print(f"{RED}[ActionLoop] Failed to install frontend dependencies.{RESET}")
            success = False

    return success


def main() -> int:
    enable_windows_ansi()

    parser = argparse.ArgumentParser(
        description="ActionLoop: Starts the backend and frontend application servers.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py                   Start both backend and frontend
  python run.py --backend-only    Start only the FastAPI backend
  python run.py --frontend-only   Start only the Next.js frontend
  python run.py --open            Start both and open the app in default browser
  python run.py --port 8080       Start backend on port 8080
        """,
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "-b",
        "--backend-only",
        action="store_true",
        help="Run only the FastAPI backend server",
    )
    group.add_argument(
        "-f",
        "--frontend-only",
        action="store_true",
        help="Run only the Next.js frontend server",
    )

    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "127.0.0.1"),
        help="Host address to bind the backend server (default: 127.0.0.1)",
    )
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=int(os.getenv("PORT", 8000)),
        help="Port for the backend server (default: 8000)",
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=int(os.getenv("FRONTEND_PORT", 3000)),
        help="Port for the frontend server (default: 3000)",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable auto-reload on backend code changes",
    )
    parser.add_argument(
        "-o",
        "--open",
        action="store_true",
        help="Open the application in default web browser once started",
    )
    parser.add_argument(
        "--no-prefix",
        action="store_true",
        help="Disable tagged log prefixes [Backend] and [Frontend]",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Install/update dependencies before starting",
    )

    args = parser.parse_args()

    run_backend = not args.frontend_only
    run_frontend = not args.backend_only

    python_bin = find_python_executable()
    npm_bin = find_npm_executable()

    if args.install:
        if not install_dependencies(python_bin, npm_bin, run_backend, run_frontend):
            return 1

    # Pre-flight checks
    if run_backend:
        if not check_backend_dependencies(python_bin):
            print(
                f"{RED}[ActionLoop] Error: FastAPI or Uvicorn not found in Python environment:{RESET}\n"
                f"  {python_bin}\n\n"
                f"Please install dependencies with:\n"
                f"  {CYAN}pip install -r backend/requirements.txt{RESET}  (or run: {CYAN}python run.py --install{RESET})\n"
            )
            return 1

        if is_port_in_use(args.port, args.host):
            print(
                f"{YELLOW}[ActionLoop] Warning: Port {args.port} is already in use by another process.{RESET}\n"
                f"Use {CYAN}--port <port>{RESET} to specify an alternative port.\n"
            )

    if run_frontend:
        if not npm_bin:
            print(
                f"{RED}[ActionLoop] Error: npm was not found on your system PATH.{RESET}\n"
                f"Please ensure Node.js and npm are installed to run the frontend.\n"
            )
            return 1

        if not (FRONTEND_DIR / "node_modules").is_dir():
            print(
                f"{YELLOW}[ActionLoop] Error: frontend/node_modules directory is missing.{RESET}\n"
                f"Please install dependencies with:\n"
                f"  {MAGENTA}cd frontend && npm install{RESET}  (or run: {MAGENTA}python run.py --install{RESET})\n"
            )
            return 1

        if is_port_in_use(args.frontend_port):
            print(
                f"{YELLOW}[ActionLoop] Warning: Port {args.frontend_port} is already in use by another process.{RESET}\n"
                f"Use {MAGENTA}--frontend-port <port>{RESET} to specify an alternative port.\n"
            )

    # Print startup banner
    border = "=" * 68
    print()
    print(f"{BOLD}{border}{RESET}")
    print(f"{BOLD}                 ActionLoop Application Launcher{RESET}")
    print(f"{BOLD}{border}{RESET}")
    print()

    if run_backend:
        print(f"  {CYAN}* Backend API:{RESET}     http://{args.host}:{args.port}")
        print(f"  {CYAN}* API Docs:{RESET}        http://{args.host}:{args.port}/docs")
    if run_frontend:
        print(f"  {MAGENTA}* Frontend App:{RESET}    http://localhost:{args.frontend_port}")

    print(f"  {DIM}* Python Binary:{RESET}   {python_bin}")
    print()

    if run_backend:
        check_groq_status()
        print()

    print(f"  {BOLD}Press Ctrl+C to shut down all running services.{RESET}")
    print("-" * 68)
    print()

    running_procs: list[tuple[subprocess.Popen, str]] = []
    threads: list[threading.Thread] = []

    try:
        # Start Backend Server
        if run_backend:
            backend_cmd = [
                python_bin,
                "-u",
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                args.host,
                "--port",
                str(args.port),
            ]
            if not args.no_reload:
                backend_cmd.append("--reload")

            proc_backend = subprocess.Popen(
                backend_cmd,
                cwd=BACKEND_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                errors="replace",
            )
            running_procs.append((proc_backend, "Backend"))

            t_backend = threading.Thread(
                target=stream_logs,
                args=(proc_backend.stdout, "Backend", CYAN, not args.no_prefix),
                daemon=True,
            )
            t_backend.start()
            threads.append(t_backend)

        # Start Frontend Server
        if run_frontend:
            frontend_cmd = [npm_bin, "run", "dev", "--", "-p", str(args.frontend_port)]

            proc_frontend = subprocess.Popen(
                frontend_cmd,
                cwd=FRONTEND_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                errors="replace",
            )
            running_procs.append((proc_frontend, "Frontend"))

            t_frontend = threading.Thread(
                target=stream_logs,
                args=(proc_frontend.stdout, "Frontend", MAGENTA, not args.no_prefix),
                daemon=True,
            )
            t_frontend.start()
            threads.append(t_frontend)

        # Browser auto-open handler
        if args.open:
            if run_frontend:
                target_url = f"http://localhost:{args.frontend_port}"
                target_port = args.frontend_port
            else:
                target_url = f"http://{args.host}:{args.port}/docs"
                target_port = args.port

            t_browser = threading.Thread(
                target=wait_and_open_browser,
                args=(target_url, target_port),
                daemon=True,
            )
            t_browser.start()

        # Keep running and monitor process states
        while True:
            for proc, name in running_procs:
                exit_code = proc.poll()
                if exit_code is not None:
                    print(
                        f"\n{RED}[ActionLoop] {name} process terminated with exit code {exit_code}.{RESET}"
                    )
                    return exit_code
            time.sleep(0.5)

    except KeyboardInterrupt:
        print(f"\n{YELLOW}[ActionLoop] Shutdown requested (Ctrl+C). Terminating services...{RESET}")
        return 0

    finally:
        for proc, name in running_procs:
            terminate_process(proc, name)
        print(f"{GREEN}[ActionLoop] All services stopped cleanly.{RESET}\n")


if __name__ == "__main__":
    sys.exit(main())
