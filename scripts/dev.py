"""
Monetize360 Unified Development Launcher.
Starts both the FastAPI backend (port 8000) and Next.js frontend (port 3000)
and manages clean shutdown on Ctrl+C.
"""

import os
import sys
import subprocess
import signal
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB_DIR = os.path.join(PROJECT_ROOT, "apps", "web")

processes = []


def cleanup(signum=None, frame=None):
    print("\n[Monetize360] Shutting down application servers gracefully...")
    for p in processes:
        try:
            if sys.platform == "win32":
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                p.terminate()
        except Exception:
            pass
    print("[Monetize360] Shutdown complete.")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("=" * 60)
    print("  MONETIZE360 UNIVERSAL DYNAMIC PRICING ENGINE")
    print("  Starting Integrated Development Server")
    print("  Application URL: http://localhost:3000")
    print("=" * 60)

    # 1. Start FastAPI Backend internally on port 8000
    print("[Backend] Starting FastAPI on internal port 8000...")
    api_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "apps.api.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--log-level",
        "warning",
    ]
    api_proc = subprocess.Popen(api_cmd, cwd=PROJECT_ROOT)
    processes.append(api_proc)

    # Wait 1.5 seconds for backend to initialize
    time.sleep(1.5)

    # 2. Start Next.js Frontend on port 3000
    print("[Frontend] Starting Next.js App Router on port 3000...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    web_cmd = [npm_cmd, "run", "dev"]
    web_proc = subprocess.Popen(web_cmd, cwd=WEB_DIR)
    processes.append(web_proc)

    print("\n[Monetize360] Application is ready at: http://localhost:3000")
    print("[Monetize360] Press Ctrl+C to stop both servers.\n")

    try:
        while True:
            time.sleep(1)
            # If any process terminated prematurely, exit
            if api_proc.poll() is not None or web_proc.poll() is not None:
                break
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
