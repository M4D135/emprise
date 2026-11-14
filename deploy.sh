#!/usr/bin/env bash
# Publication manuelle. Aucun accès au dépôt privé n'est installé sur le VPS.
set -euo pipefail
repo=$(cd "$(dirname "$0")" && pwd)
host=${RADE_HOST:-amiga}
remote=/home/ddd/apps/rade
vhost=/home/ddd/apps/caddy-shared/vhosts.d/gta.estrasse.fr.Caddyfile
cd "$repo"
[ -z "$(git status --porcelain -- src assets tools build.py VERSION.json dist SIZE.json deployment deploy.sh)" ] || { echo 'Commiter les sources et le build avant publication.' >&2; exit 1; }
python3 build.py
[ -z "$(git status --porcelain -- dist SIZE.json)" ] || { echo 'Le build diffère du commit.' >&2; exit 1; }
commit=$(git rev-parse HEAD)
sha=$(shasum -a 256 dist/index.html | cut -d' ' -f1)
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$host" "install -d -m 755 $remote/releases/$commit"
scp -q -o BatchMode=yes dist/index.html "$host:$remote/releases/$commit/index.html.new"
ssh -o BatchMode=yes "$host" bash -s -- "$remote" "$commit" "$sha" <<'REMOTE'
set -euo pipefail
root=$1 version=$2 hash=$3
printf '%s  %s\n' "$hash" "$root/releases/$version/index.html.new" | sha256sum -c --quiet -
chmod 644 "$root/releases/$version/index.html.new"
mv "$root/releases/$version/index.html.new" "$root/releases/$version/index.html"
ln -sfn "releases/$version" "$root/current.new"
mv -T "$root/current.new" "$root/current"
REMOTE
if ! ssh -o BatchMode=yes "$host" "cmp -s - $vhost" < deployment/gta.estrasse.fr.Caddyfile; then
    scp -q -o BatchMode=yes deployment/gta.estrasse.fr.Caddyfile "$host:$remote/vhost.new"
    ssh -o BatchMode=yes "$host" "install -m 644 $remote/vhost.new $vhost && systemctl --user start caddy-shared-apply"
fi
for attempt in {1..20}; do
    served=$(curl -fsS --max-time 10 https://gta.estrasse.fr/ 2>/dev/null | shasum -a 256 | cut -d' ' -f1 || true)
    if [ "$served" = "$sha" ]; then echo "En ligne : https://gta.estrasse.fr — $commit — sha256 $sha"; exit 0; fi
    sleep 2
done
echo 'La version publique ne correspond pas encore au build.' >&2
exit 1
