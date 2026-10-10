#!/bin/sh
# Run on the deployment host only after the new application is healthy.
# Keeps one rollback image and one source/database snapshot. Never prunes volumes.
set -eu
cd /home/esimgg
curl -fsS http://127.0.0.1:3100/api/health | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status") == "ok"'
echo 'Disk before cleanup:'
df -h / | tail -1

docker image ls --format '{{.Repository}}:{{.Tag}}' \
  | awk '/^esimgg-app:backup-[0-9]+-/ {print}' | sort -r | awk 'NR > 1' \
  | while IFS= read -r old_image; do docker image rm "$old_image"; done
docker image prune -f
docker builder prune -af

python3 - <<'PY'
from pathlib import Path
import json, re, shutil, subprocess
project = Path('/home/esimgg')
mounts = json.loads(subprocess.check_output(['docker', 'inspect', 'esimgg-app']))[0]['Mounts']
for name in ('node_modules', '.next'):
    target = project / name
    # Never remove a directory used by the running container.
    sources = [Path(m['Source']).resolve() for m in mounts if m.get('Type') == 'bind']
    if any(source == target or source in target.parents or target in source.parents for source in sources):
        print('Skipped mounted directory:', target)
        continue
    if target.is_dir() and not target.is_symlink():
        shutil.rmtree(target)
        print('Removed obsolete host build:', target)
root = Path('/home/esimgg-backups')
backups = sorted((p for p in root.glob('*') if p.is_dir() and not p.is_symlink() and re.fullmatch(r'\d{8}-\d{6}', p.name)), reverse=True)
for old in backups[1:]:
    shutil.rmtree(old)
    print('Removed old snapshot:', old.name)
for name in ('/tmp/esimgg-update.tar.gz', '/tmp/esimgg-image.tar.gz', '/tmp/esimgg-build.log'):
    Path(name).unlink(missing_ok=True)
PY
echo 'Disk after cleanup:'
df -h / | tail -1
docker system df
