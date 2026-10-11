#!/bin/bash
# Studio Engine installer for Mac (also updates an existing install - just run it again).
# Run in Terminal:
#   curl -fsSL https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/engine/install.sh | bash
set -e
REPO="rpingclaw-cmd/PSM"; BRANCH="main"; DFN_TAG="v0.5.6"
HOME2="$HOME/Library/Application Support/StudioEngine"
APP="$HOME2/app"; BIN="$HOME2/bin"
say() { printf '\n==> %s\n' "$1"; }
ok()  { printf '    OK  %s\n' "$1"; }
mkdir -p "$HOME2" "$BIN"
echo "----------------------------------------------------------------"
echo " Studio Engine installer - this takes 5 to 15 minutes."
echo "----------------------------------------------------------------"

say "Step 1 of 5: Homebrew + ffmpeg"
if ! command -v brew >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/brew ] && [ ! -x /usr/local/bin/brew ]; then
  echo "Homebrew (the free Mac package manager) is needed for ffmpeg. It will ask for your Mac password."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg
ok "ffmpeg: $(command -v ffmpeg)"

say "Step 2 of 5: uv (Python manager)"
command -v uv >/dev/null 2>&1 || brew install uv
UV="$(command -v uv)"; ok "uv: $UV"

say "Step 3 of 5: Studio Engine program"
TMP="$(mktemp -d)"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar -xz -C "$TMP"
rm -rf "$APP"; cp -R "$TMP"/*/engine "$APP"; rm -rf "$TMP"
ok "installed in $APP"

say "Step 4 of 5: DeepFilterNet (voice isolation)"
if [ ! -x "$BIN/deep-filter" ]; then
  case "$(uname -m)" in arm64) T="aarch64-apple-darwin";; *) T="x86_64-apple-darwin";; esac
  curl -fsSL -o "$BIN/deep-filter" "https://github.com/Rikorose/DeepFilterNet/releases/download/$DFN_TAG/deep-filter-0.5.6-$T"
  chmod +x "$BIN/deep-filter"
fi
"$BIN/deep-filter" --version && ok "deep-filter ready" || echo "    !!  deep-filter could not start; voice isolation will be off."

say "Step 5 of 5: Python and libraries"
"$UV" sync --project "$APP" --frozen --no-dev
ok "libraries ready"

START="$HOME/Desktop/Start Studio Engine.command"
cat > "$START" <<EOF
#!/bin/bash
echo "Studio Engine - keep this window open while you work."
"$UV" run --project "$APP" --frozen --no-dev studio-engine
EOF
chmod +x "$START"
ok "Desktop file 'Start Studio Engine' created"
echo; echo "All done! Starting the Studio Engine now; the website will open."
echo "Next time just double-click 'Start Studio Engine' on your Desktop."
exec "$START"
