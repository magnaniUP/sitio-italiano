import time
import os
import shutil

BASE_DIR = "/home/tiagobarreto/Downloads/website-IT"
bak_path = os.path.join(BASE_DIR, "index.html.bak")
target_path = os.path.join(BASE_DIR, "index.html")

while True:
    try:
        if os.path.exists(bak_path) and os.path.exists(target_path):
            with open(target_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "site-footer" not in content or "Offerte Salute" not in content:
                print("Watchdog: footer ausente em index.html! Restaurando automaticamente...")
                shutil.copyfile(bak_path, target_path)
    except Exception as e:
        print("Watchdog error:", e)
    time.sleep(1)
