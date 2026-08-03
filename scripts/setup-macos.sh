#!/usr/bin/env bash
# =============================================================================
# Fintz Harness Kit — macOS Setup & Discovery Script
#
# Discovers your Apple Silicon hardware and installed services, then recommends
# the right LM Studio models and configuration for your system.
#
# Usage:
#   bash scripts/setup-macos.sh              # discovery + recommendations only
#   bash scripts/setup-macos.sh --install    # also install missing dependencies
#   bash scripts/setup-macos.sh --json       # machine-readable JSON output
#   bash scripts/setup-macos.sh --quiet      # minimal output (for scripts)
#
# Requires: bash 3.2+, macOS 12+, Apple Silicon recommended
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'

DO_INSTALL=false
JSON_OUTPUT=false
QUIET=false

for arg in "$@"; do
  case "$arg" in
    --install) DO_INSTALL=true ;;
    --json)    JSON_OUTPUT=true ;;
    --quiet)   QUIET=true ;;
  esac
done

if [ ! -t 1 ] || [ "$JSON_OUTPUT" = true ]; then
  RESET=''; BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''
fi

h1() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════${RESET}"
       echo -e "${BOLD}${CYAN}  $1${RESET}"
       echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${RESET}"; }
h2()   { echo -e "\n${BOLD}${YELLOW}  ▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  $1"; }
info() { echo -e "  ${DIM}$1${RESET}"; }
cmd_() { echo -e "  ${BLUE}\$${RESET} $1"; }

# ---------------------------------------------------------------------------
# OS guard
# ---------------------------------------------------------------------------
if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: this script is for macOS only. Use scripts/setup-ubuntu.sh on Linux." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Hardware detection
# ---------------------------------------------------------------------------
detect_hardware() {
  # Chip / architecture
  ARCH=$(uname -m)   # arm64 on Apple Silicon, x86_64 on Intel Mac
  CHIP=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
  IS_APPLE_SILICON=false
  [[ "$ARCH" == "arm64" ]] && IS_APPLE_SILICON=true

  # M-chip generation (M1/M2/M3/M4) from chip string
  CHIP_GEN="unknown"
  if $IS_APPLE_SILICON; then
    if echo "$CHIP" | grep -q "M4"; then CHIP_GEN="M4"
    elif echo "$CHIP" | grep -q "M3"; then CHIP_GEN="M3"
    elif echo "$CHIP" | grep -q "M2"; then CHIP_GEN="M2"
    elif echo "$CHIP" | grep -q "M1"; then CHIP_GEN="M1"
    fi
  fi

  # Unified RAM (Apple Silicon) or system RAM
  TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
  TOTAL_RAM_GB=$(( TOTAL_RAM_BYTES / 1024 / 1024 / 1024 ))

  # CPU cores (performance + efficiency)
  CPU_CORES=$(sysctl -n hw.logicalcpu 2>/dev/null || nproc 2>/dev/null || echo "0")
  PERF_CORES=$(sysctl -n hw.perflevel0.logicalcpu 2>/dev/null || echo "$CPU_CORES")

  # Disk free (in the user home partition)
  DISK_FREE_GB=$(df -g "$HOME" 2>/dev/null | awk 'NR==2{print $4}' || echo "0")

  # macOS version
  MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
}

# ---------------------------------------------------------------------------
# Software detection
# ---------------------------------------------------------------------------
detect_software() {
  # Node.js
  NODE_VERSION="not installed"
  NODE_OK=false
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null | tr -d 'v')
    MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    [[ "${MAJOR:-0}" -ge 20 ]] && NODE_OK=true
  fi

  # npm
  NPM_VERSION="not installed"
  command -v npm &>/dev/null && NPM_VERSION=$(npm --version 2>/dev/null)

  # git
  GIT_VERSION="not installed"
  GIT_OK=false
  if command -v git &>/dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    GIT_OK=true
  fi

  # Homebrew
  BREW_OK=false
  BREW_VERSION="not installed"
  if command -v brew &>/dev/null; then
    BREW_VERSION=$(brew --version 2>/dev/null | head -1 | awk '{print $2}')
    BREW_OK=true
  fi

  # LM Studio — check server on default port 1234
  LMSTUDIO_RUNNING=false
  LMSTUDIO_MODELS=()
  if curl -sf --connect-timeout 2 http://localhost:1234/v1/models &>/dev/null; then
    LMSTUDIO_RUNNING=true
    # Parse loaded model names from /v1/models JSON
    MODELS_JSON=$(curl -sf --connect-timeout 2 http://localhost:1234/v1/models 2>/dev/null || echo '{}')
    while IFS= read -r m; do
      [[ -n "$m" ]] && LMSTUDIO_MODELS+=("$m")
    done < <(echo "$MODELS_JSON" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); [print(x['id']) for x in d.get('data',[])]" 2>/dev/null || true)
  fi
  # Check if LM Studio app is installed (application bundle)
  LMSTUDIO_INSTALLED=false
  [[ -d "/Applications/LM Studio.app" ]] && LMSTUDIO_INSTALLED=true

  # Ollama (optional alternative on macOS)
  OLLAMA_OK=false
  OLLAMA_VERSION="not installed"
  if command -v ollama &>/dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null | awk '{print $NF}' || echo "installed")
    OLLAMA_OK=true
  fi
  OLLAMA_RUNNING=false
  curl -sf --connect-timeout 1 http://localhost:11434/api/version &>/dev/null && OLLAMA_RUNNING=true

  # Docker (optional)
  DOCKER_OK=false
  DOCKER_VERSION="not installed"
  if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')
    DOCKER_OK=true
  fi
  DOCKER_RUNNING=false
  docker info &>/dev/null 2>&1 && DOCKER_RUNNING=true

  # Python3
  PYTHON_OK=false
  PYTHON_VERSION="not installed"
  if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version 2>/dev/null | awk '{print $2}')
    PYTHON_OK=true
  fi

  HAS_DOCX=false; HAS_OPENPYXL=false
  if $PYTHON_OK; then
    python3 -c "import docx"    2>/dev/null && HAS_DOCX=true
    python3 -c "import openpyxl" 2>/dev/null && HAS_OPENPYXL=true
  fi

  HAS_PDFTOTEXT=false
  command -v pdftotext &>/dev/null && HAS_PDFTOTEXT=true
}

# ---------------------------------------------------------------------------
# Service detection — harness proxy, dashboard, HTTP adapter
# ---------------------------------------------------------------------------
detect_services() {
  port_open() {
    curl -sf --connect-timeout 1 "http://localhost:$1/" &>/dev/null 2>&1 ||
    nc -z localhost "$1" 2>/dev/null
  }

  PROXY_PORT="${HARNESS_PROXY_PORT:-11435}"
  PROXY_RUNNING=false
  if port_open "$PROXY_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${PROXY_PORT}/healthz" 2>/dev/null || true)
    [[ "$RESP" == "ok" ]] && PROXY_RUNNING=true
  fi

  DASHBOARD_PORT="${HARNESS_DASHBOARD_PORT:-8099}"
  DASHBOARD_RUNNING=false
  if port_open "$DASHBOARD_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${DASHBOARD_PORT}/healthz" 2>/dev/null || true)
    [[ "$RESP" == "ok" ]] && DASHBOARD_RUNNING=true
  fi

  HTTP_ADAPTER_PORT="${HARNESS_HTTP_PORT:-8100}"
  HTTP_ADAPTER_RUNNING=false
  if port_open "$HTTP_ADAPTER_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${HTTP_ADAPTER_PORT}/healthz" 2>/dev/null || true)
    echo "$RESP" | grep -q '"status"' 2>/dev/null && HTTP_ADAPTER_RUNNING=true
  fi
}

# ---------------------------------------------------------------------------
# Memory pressure check
# ---------------------------------------------------------------------------
check_memory_pressure() {
  MEM_PRESSURE="unknown"
  if command -v vm_stat &>/dev/null; then
    PAGES_SWAPPED=$(vm_stat 2>/dev/null | awk '/Pages swapped out/{print $NF}' | tr -d '.' || echo "0")
    WIRED=$(vm_stat 2>/dev/null | awk '/Pages wired down/{print $NF}' | tr -d '.' || echo "0")
    PAGE_SIZE=$(vm_stat 2>/dev/null | awk '/page size of/{print $(NF-1)}' || echo "4096")
    WIRED_GB=$(( ${WIRED:-0} * ${PAGE_SIZE:-4096} / 1024 / 1024 / 1024 ))
    if [[ "${PAGES_SWAPPED:-0}" -gt 0 ]]; then
      MEM_PRESSURE="high — swap in use (${PAGES_SWAPPED} pages). Close other apps."
    elif [[ "$WIRED_GB" -ge $(( TOTAL_RAM_GB / 2 )) ]]; then
      MEM_PRESSURE="moderate — wired memory ${WIRED_GB} GB. Model may be tight."
    else
      MEM_PRESSURE="ok"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Model recommendations based on unified RAM
# ---------------------------------------------------------------------------
recommend_models() {
  PROVIDER="lmstudio"
  EMBED_MODEL="nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q8_0.gguf"
  EMBED_MODEL_NOTE="768-dim, 274 MB, fast on Metal"
  GEN_MODELS=()
  ASSISTANT_MODEL=""
  DEV_MODEL=""
  FULL_MODEL=""
  NOTES=()

  # All Apple Silicon unified memory — same pool for CPU + GPU
  if [[ "$TOTAL_RAM_GB" -ge 32 ]]; then
    GEN_MODELS+=("lmstudio-community/Qwen2.5-Coder-14B-Instruct-GGUF  Q4_K_M ~8.8 GB — excellent coder")
    GEN_MODELS+=("lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF  Q4_K_M ~5.0 GB — fastest")
    GEN_MODELS+=("lmstudio-community/Qwen2.5-32B-Instruct-GGUF        Q4_K_M ~20 GB  — max quality")
    ASSISTANT_MODEL="lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
    DEV_MODEL="lmstudio-community/Qwen2.5-Coder-14B-Instruct-GGUF/Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf"
    FULL_MODEL="lmstudio-community/Qwen2.5-32B-Instruct-GGUF/Qwen2.5-32B-Instruct-Q4_K_M.gguf"
    NOTES+=("32 GB unified RAM — 14b and 32b models fit comfortably")
  elif [[ "$TOTAL_RAM_GB" -ge 16 ]]; then
    GEN_MODELS+=("lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF   Q4_K_M ~4.3 GB — recommended coder")
    GEN_MODELS+=("lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF  Q4_K_M ~5.0 GB — general tasks")
    GEN_MODELS+=("lmstudio-community/Qwen2.5-14B-Instruct-GGUF        Q4_K_M ~8.8 GB — leaves ~7 GB headroom")
    ASSISTANT_MODEL="lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
    DEV_MODEL="lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
    FULL_MODEL="lmstudio-community/Qwen2.5-14B-Instruct-GGUF/Qwen2.5-14B-Instruct-Q4_K_M.gguf"
    NOTES+=("16 GB unified RAM — 14b fits; keep ctx ≤ 4096 for headroom")
  elif [[ "$TOTAL_RAM_GB" -ge 8 ]]; then
    # The primary target: M1/M2 8 GB
    GEN_MODELS+=("lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF   Q4_K_M ~4.3 GB — RECOMMENDED")
    GEN_MODELS+=("lmstudio-community/Phi-4-Mini-Instruct-GGUF          Q4_K_M ~2.3 GB — fastest loops")
    GEN_MODELS+=("lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF  Q4_K_M ~5.0 GB — marginal fit")
    ASSISTANT_MODEL="lmstudio-community/Phi-4-Mini-Instruct-GGUF/Phi-4-Mini-Instruct-Q4_K_M.gguf"
    DEV_MODEL="lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
    FULL_MODEL="lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
    NOTES+=("8 GB unified RAM — macOS reserves ~2-3 GB; model ceiling is ~5 GB")
    NOTES+=("Set Context Length ≤ 2048 in LM Studio to prevent memory pressure")
    NOTES+=("Only one model can be loaded at a time — embed model must be unloaded first")
    NOTES+=("Check memory pressure: vm_stat | grep 'Pages swapped out'")
  else
    GEN_MODELS+=("lmstudio-community/Phi-4-Mini-Instruct-GGUF  Q4_K_M ~2.3 GB — only safe option")
    ASSISTANT_MODEL="lmstudio-community/Phi-4-Mini-Instruct-GGUF/Phi-4-Mini-Instruct-Q4_K_M.gguf"
    DEV_MODEL="$ASSISTANT_MODEL"
    FULL_MODEL="$ASSISTANT_MODEL"
    NOTES+=("Less than 8 GB — only 3b-class models are safe. Consider upgrading RAM.")
  fi
}

# ---------------------------------------------------------------------------
# Install missing components (--install flag)
# ---------------------------------------------------------------------------
do_install() {
  h2 "Installing missing components"

  if ! $BREW_OK; then
    warn "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add Homebrew to PATH for Apple Silicon
    if $IS_APPLE_SILICON; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    BREW_OK=true
  fi

  if ! $NODE_OK; then
    warn "Installing Node.js 20 via Homebrew..."
    brew install node@20
    brew link node@20 --force
  fi

  if ! $GIT_OK; then
    warn "Installing git via Homebrew..."
    brew install git
  fi

  if ! $LMSTUDIO_INSTALLED; then
    warn "LM Studio not found in /Applications."
    info "  Download from: https://lmstudio.ai"
    info "  After installing, open LM Studio → Local Server → Start Server"
  fi

  if ! $HAS_PDFTOTEXT; then
    warn "Installing poppler (pdftotext) via Homebrew..."
    brew install poppler
  fi

  if $PYTHON_OK && ! $HAS_DOCX; then
    warn "Installing python-docx..."
    pip3 install python-docx
  fi

  if $PYTHON_OK && ! $HAS_OPENPYXL; then
    warn "Installing openpyxl..."
    pip3 install openpyxl
  fi

  ok "Install step complete"
}

# ---------------------------------------------------------------------------
# Print recommended shell env block
# ---------------------------------------------------------------------------
print_env_block() {
  cat <<ENV

# ── Harness Kit — macOS / LM Studio env block ──────────────────────────────
# Copy model identifiers from LM Studio → My Models → hover → Copy Identifier
export HARNESS_LLM_PROVIDER=lmstudio
export HARNESS_LLM_HOST=http://localhost:1234
export HARNESS_LLM_MODEL="${DEV_MODEL}"
export HARNESS_EMBED_MODEL="${EMBED_MODEL}"
export HARNESS_EMBED_TIMEOUT_MS=60000
export HARNESS_FS_CHUNK_SIZE=2000
export HARNESS_FS_CHUNK_OVERLAP=200
export HARNESS_FS_MAX_FILE_BYTES=524288
# ───────────────────────────────────────────────────────────────────────────
ENV
}

# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------
print_json() {
  local gen_json=""
  for m in "${GEN_MODELS[@]}"; do
    name=$(echo "$m" | awk '{print $1}')
    gen_json+="\"${name}\","
  done
  gen_json="${gen_json%,}"

  local loaded_json=""
  for m in "${LMSTUDIO_MODELS[@]}"; do
    loaded_json+="\"$m\","
  done
  loaded_json="${loaded_json%,}"

  local notes_json=""
  for n in "${NOTES[@]:-}"; do
    notes_json+="\"$(echo "$n" | sed 's/"/\\"/g')\","
  done
  notes_json="${notes_json%,}"

  cat <<EOF
{
  "hardware": {
    "arch": "$ARCH",
    "chip": "$(echo "$CHIP" | sed 's/"/\\"/g')",
    "chip_gen": "$CHIP_GEN",
    "is_apple_silicon": $IS_APPLE_SILICON,
    "ram_gb": $TOTAL_RAM_GB,
    "cpu_cores": $CPU_CORES,
    "perf_cores": $PERF_CORES,
    "disk_free_gb": $DISK_FREE_GB,
    "macos_version": "$MACOS_VERSION",
    "memory_pressure": "$(echo "${MEM_PRESSURE:-unknown}" | sed 's/"/\\"/g')"
  },
  "software": {
    "node_version": "$NODE_VERSION",
    "node_ok": $NODE_OK,
    "git_ok": $GIT_OK,
    "brew_ok": $BREW_OK,
    "lmstudio_installed": $LMSTUDIO_INSTALLED,
    "lmstudio_running": $LMSTUDIO_RUNNING,
    "lmstudio_loaded_models": [$loaded_json],
    "ollama_ok": $OLLAMA_OK,
    "ollama_running": $OLLAMA_RUNNING,
    "docker_ok": $DOCKER_OK,
    "python_ok": $PYTHON_OK,
    "has_pdftotext": $HAS_PDFTOTEXT,
    "has_python_docx": $HAS_DOCX,
    "has_openpyxl": $HAS_OPENPYXL
  },
  "services": {
    "lmstudio": { "running": $LMSTUDIO_RUNNING, "port": 1234, "url": "http://localhost:1234" },
    "harness_proxy": { "running": $PROXY_RUNNING, "port": $PROXY_PORT, "url": "http://localhost:$PROXY_PORT" },
    "dashboard": { "running": $DASHBOARD_RUNNING, "port": $DASHBOARD_PORT, "url": "http://localhost:$DASHBOARD_PORT" },
    "http_adapter": { "running": $HTTP_ADAPTER_RUNNING, "port": $HTTP_ADAPTER_PORT, "url": "http://localhost:$HTTP_ADAPTER_PORT" }
  },
  "recommendations": {
    "provider": "$PROVIDER",
    "embed_model": "$EMBED_MODEL",
    "assistant_model": "$ASSISTANT_MODEL",
    "dev_model": "$DEV_MODEL",
    "full_model": "$FULL_MODEL",
    "generation_models": [$gen_json],
    "notes": [$notes_json]
  }
}
EOF
}

# ---------------------------------------------------------------------------
# Human-readable report
# ---------------------------------------------------------------------------
print_report() {
  $QUIET || h1 "🍎 Harness Kit — macOS System Discovery"

  h2 "Hardware"
  info "  Chip:  ${CHIP}"
  info "  Arch:  ${ARCH} (Apple Silicon: ${IS_APPLE_SILICON})"
  info "  RAM:   ${TOTAL_RAM_GB} GB unified memory"
  info "  Cores: ${CPU_CORES} logical (${PERF_CORES} performance)"
  info "  Disk:  ${DISK_FREE_GB} GB free (${HOME})"
  info "  macOS: ${MACOS_VERSION}"
  info "  Mem pressure: ${MEM_PRESSURE:-unknown}"

  h2 "Software"
  $NODE_OK && ok "Node.js ${NODE_VERSION}" || fail "Node.js not installed or < 20 (found: ${NODE_VERSION})"
  $GIT_OK  && ok "git ${GIT_VERSION}"      || fail "git not installed"
  $BREW_OK && ok "Homebrew ${BREW_VERSION}" || warn "Homebrew not installed — install from https://brew.sh"

  h2 "LM Studio"
  if $LMSTUDIO_INSTALLED; then
    ok "LM Studio installed (/Applications/LM Studio.app)"
  else
    warn "LM Studio not found — download from https://lmstudio.ai"
  fi
  if $LMSTUDIO_RUNNING; then
    ok "LM Studio local server running on :1234"
    if [[ ${#LMSTUDIO_MODELS[@]} -gt 0 ]]; then
      for m in "${LMSTUDIO_MODELS[@]}"; do
        info "    loaded: $m"
      done
    else
      warn "  No model currently loaded in LM Studio"
    fi
  else
    warn "LM Studio server not running — open LM Studio → Local Server → Start Server"
  fi

  h2 "Ollama (optional alternative)"
  if $OLLAMA_OK; then
    $OLLAMA_RUNNING && ok "Ollama ${OLLAMA_VERSION} (running)" \
                    || warn "Ollama ${OLLAMA_VERSION} (installed but not running)"
  else
    info "  Ollama not installed (optional — LM Studio is the recommended provider on macOS)"
  fi

  h2 "Docker (optional)"
  if $DOCKER_OK; then
    $DOCKER_RUNNING && ok "Docker ${DOCKER_VERSION} (running)" \
                    || warn "Docker ${DOCKER_VERSION} (installed but not running)"
  else
    info "  Docker not installed (optional — needed for Open WebUI container)"
  fi

  h2 "Harness services"
  $PROXY_RUNNING      && ok "harness-proxy   :${PROXY_PORT}"      || info "  harness-proxy   not running (npm run harness:proxy)"
  $DASHBOARD_RUNNING  && ok "dashboard       :${DASHBOARD_PORT}"  || info "  dashboard       not running (npm run harness:dashboard)"
  $HTTP_ADAPTER_RUNNING && ok "http-adapter  :${HTTP_ADAPTER_PORT}" || info "  http-adapter    not running (npm run harness:http)"

  h2 "Document extractors"
  $HAS_PDFTOTEXT  && ok "pdftotext"       || warn "pdftotext missing — brew install poppler"
  $HAS_DOCX       && ok "python-docx"     || warn "python-docx missing — pip3 install python-docx"
  $HAS_OPENPYXL   && ok "openpyxl"        || warn "openpyxl missing — pip3 install openpyxl"

  h2 "Model recommendations for ${TOTAL_RAM_GB} GB unified RAM"
  info "  Provider: lmstudio (Metal GPU, port 1234)"
  for m in "${GEN_MODELS[@]}"; do
    info "    $m"
  done
  info ""
  info "  Embed model: ${EMBED_MODEL}"
  info "    ${EMBED_MODEL_NOTE}"

  if [[ ${#NOTES[@]} -gt 0 ]]; then
    h2 "Notes"
    for n in "${NOTES[@]}"; do
      warn "$n"
    done
  fi

  h2 "Recommended harness env"
  print_env_block

  h2 "Next steps"
  if ! $NODE_OK; then
    cmd_ "brew install node@20 && brew link node@20 --force"
  fi
  if ! $LMSTUDIO_INSTALLED; then
    cmd_ "open https://lmstudio.ai   # download and install LM Studio"
  fi
  if ! $LMSTUDIO_RUNNING; then
    info "  Open LM Studio → Local Server tab → Start Server"
    info "  Then load a model from My Models"
  fi
  if $NODE_OK; then
    cmd_ "npm install                        # install harness dependencies"
    cmd_ "npm run harness:health -- --fast   # verify setup"
  fi
  if $DO_INSTALL; then
    do_install
  else
    info ""
    info "  Re-run with --install to auto-install missing dependencies:"
    cmd_ "bash scripts/setup-macos.sh --install"
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
detect_hardware
detect_software
detect_services
check_memory_pressure
recommend_models

if $JSON_OUTPUT; then
  print_json
else
  print_report
fi
