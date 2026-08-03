#!/usr/bin/env bash
# =============================================================================
# Fintz Harness Kit — Ubuntu Setup & Discovery Script
#
# Discovers your hardware and installed services, then recommends the right
# Ollama models and configuration for your system.
#
# Usage:
#   bash scripts/setup-ubuntu.sh              # discovery + recommendations only
#   bash scripts/setup-ubuntu.sh --install    # also install missing dependencies
#   bash scripts/setup-ubuntu.sh --json       # machine-readable JSON output
#   bash scripts/setup-ubuntu.sh --quiet      # minimal output (for scripts)
#
# Requires: bash 4+, running on Ubuntu/Debian Linux
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
WHITE='\033[37m'

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

# Disable colour when not a TTY or --json
if [ ! -t 1 ] || [ "$JSON_OUTPUT" = true ]; then
  RESET=''; BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; WHITE=''
fi

h1() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════════════════${RESET}"; \
       echo -e "${BOLD}${CYAN}  $1${RESET}"; \
       echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════${RESET}"; }
h2() { echo -e "\n${BOLD}${YELLOW}  ▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  $1"; }
info() { echo -e "  ${DIM}$1${RESET}"; }
cmd_()  { echo -e "  ${BLUE}\$${RESET} $1"; }

# ---------------------------------------------------------------------------
# Hardware detection
# ---------------------------------------------------------------------------
detect_hardware() {
  # RAM
  TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_RAM_GB=$(( TOTAL_RAM_KB / 1024 / 1024 ))

  # CPU
  CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
  CPU_CORES=$(nproc)
  CPU_VENDOR=$(grep "vendor_id" /proc/cpuinfo | head -1 | awk '{print $3}')

  # GPU
  GPU_PRESENT=false
  GPU_MODEL="none"
  GPU_VRAM_GB=0
  if command -v lspci &>/dev/null; then
    NVIDIA_GPU=$(lspci 2>/dev/null | grep -i 'nvidia\|geforce\|quadro\|tesla' | head -1 || true)
    AMD_GPU=$(lspci 2>/dev/null | grep -i 'amd\|radeon' | grep -iv 'audio\|usb' | head -1 || true)
    if [ -n "$NVIDIA_GPU" ]; then
      GPU_PRESENT=true
      GPU_MODEL="NVIDIA: $NVIDIA_GPU"
      # Try to get VRAM via nvidia-smi
      if command -v nvidia-smi &>/dev/null; then
        GPU_VRAM_MIB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
        GPU_VRAM_GB=$(( ${GPU_VRAM_MIB:-0} / 1024 ))
      fi
    elif [ -n "$AMD_GPU" ]; then
      GPU_PRESENT=true
      GPU_MODEL="AMD: $AMD_GPU"
    fi
  fi

  # Disk free (for models)
  DISK_FREE_GB=$(df -BG / 2>/dev/null | awk 'NR==2{print $4}' | tr -d G || echo "0")

  # Architecture
  ARCH=$(uname -m)
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
    [ "${MAJOR:-0}" -ge 20 ] && NODE_OK=true
  fi

  # npm
  NPM_VERSION="not installed"
  if command -v npm &>/dev/null; then
    NPM_VERSION=$(npm --version 2>/dev/null)
  fi

  # git
  GIT_VERSION="not installed"
  GIT_OK=false
  if command -v git &>/dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    GIT_OK=true
  fi

  # Docker
  DOCKER_OK=false
  DOCKER_VERSION="not installed"
  if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')
    DOCKER_OK=true
  fi
  DOCKER_RUNNING=false
  if docker info &>/dev/null 2>&1; then
    DOCKER_RUNNING=true
  fi

  # Ollama
  OLLAMA_OK=false
  OLLAMA_VERSION="not installed"
  if command -v ollama &>/dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null | awk '{print $NF}' || echo "installed")
    OLLAMA_OK=true
  fi
  OLLAMA_RUNNING=false
  if curl -sf http://localhost:11434/api/version &>/dev/null; then
    OLLAMA_RUNNING=true
  fi

  # Ollama models
  OLLAMA_MODELS=()
  if $OLLAMA_RUNNING; then
    while IFS= read -r line; do
      OLLAMA_MODELS+=("$line")
    done < <(ollama list 2>/dev/null | awk 'NR>1{print $1}' || true)
  fi

  # Python3
  PYTHON_OK=false
  PYTHON_VERSION="not installed"
  if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version 2>/dev/null | awk '{print $2}')
    PYTHON_OK=true
  fi

  # Python packages
  HAS_DOCX=false; HAS_OPENPYXL=false; HAS_FITZ=false
  if $PYTHON_OK; then
    python3 -c "import docx" 2>/dev/null && HAS_DOCX=true
    python3 -c "import openpyxl" 2>/dev/null && HAS_OPENPYXL=true
    python3 -c "import fitz" 2>/dev/null && HAS_FITZ=true
  fi

  # System tools
  HAS_PDFTOTEXT=false
  command -v pdftotext &>/dev/null && HAS_PDFTOTEXT=true
  HAS_LIBREOFFICE=false
  command -v libreoffice &>/dev/null && HAS_LIBREOFFICE=true
  HAS_UNZIP=false
  command -v unzip &>/dev/null && HAS_UNZIP=true
}

# ---------------------------------------------------------------------------
# Service detection — Open WebUI, harness proxy, dashboard, MCP
# ---------------------------------------------------------------------------
detect_services() {
  # Helper: check if a local TCP port is listening
  port_open() { curl -sf --connect-timeout 1 "http://localhost:$1/" &>/dev/null 2>&1 || \
                ss -tlnp 2>/dev/null | grep -q ":$1 " || \
                nc -z localhost "$1" 2>/dev/null; }

  # Open WebUI — check Docker container first, then bare port
  WEBUI_RUNNING=false
  WEBUI_PORT=""
  WEBUI_VIA=""
  if $DOCKER_RUNNING; then
    WEBUI_CONTAINER=$(docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Image}}' 2>/dev/null \
      | grep -i 'open-webui\|openwebui' | head -1 || true)
    if [ -n "$WEBUI_CONTAINER" ]; then
      WEBUI_RUNNING=true
      WEBUI_VIA="docker"
      # Extract host port from mapping like "0.0.0.0:3000->8080/tcp"
      WEBUI_PORT=$(echo "$WEBUI_CONTAINER" | grep -oP ':\K\d+(?=->)' | head -1 || echo "3000")
    fi
  fi
  # Fallback: check default ports 3000 then 8080
  if ! $WEBUI_RUNNING; then
    for p in 3000 8080; do
      if port_open "$p"; then
        # Confirm it looks like Open WebUI by checking title or health
        if curl -sf --connect-timeout 2 "http://localhost:$p/" 2>/dev/null | grep -qi 'open.webui\|ollama\|webui'; then
          WEBUI_RUNNING=true
          WEBUI_PORT="$p"
          WEBUI_VIA="native"
          break
        fi
      fi
    done
  fi

  # Harness proxy (default 11435)
  PROXY_PORT="${HARNESS_PROXY_PORT:-11435}"
  PROXY_RUNNING=false
  if port_open "$PROXY_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${PROXY_PORT}/healthz" 2>/dev/null || true)
    [ "$RESP" = "ok" ] && PROXY_RUNNING=true
  fi

  # Harness dashboard (default 8099)
  DASHBOARD_PORT="${HARNESS_DASHBOARD_PORT:-8099}"
  DASHBOARD_RUNNING=false
  if port_open "$DASHBOARD_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${DASHBOARD_PORT}/healthz" 2>/dev/null || true)
    [ "$RESP" = "ok" ] && DASHBOARD_RUNNING=true
  fi

  # HTTP adapter (default 8100)
  HTTP_ADAPTER_PORT="${HARNESS_HTTP_PORT:-8100}"
  HTTP_ADAPTER_RUNNING=false
  if port_open "$HTTP_ADAPTER_PORT"; then
    RESP=$(curl -sf --connect-timeout 2 "http://localhost:${HTTP_ADAPTER_PORT}/healthz" 2>/dev/null || true)
    echo "$RESP" | grep -q '"status"' 2>/dev/null && HTTP_ADAPTER_RUNNING=true
  fi

  # Ollama port (confirm 11434)
  OLLAMA_PORT=11434

  # Port conflict detection
  PORT_CONFLICTS=()
  declare -A PORT_MAP
  PORT_MAP[$OLLAMA_PORT]="Ollama"
  PORT_MAP[$PROXY_PORT]="harness-proxy"
  PORT_MAP[$DASHBOARD_PORT]="harness-dashboard"
  PORT_MAP[$HTTP_ADAPTER_PORT]="http-adapter"
  [ -n "$WEBUI_PORT" ] && PORT_MAP[$WEBUI_PORT]="open-webui"
  # Detect duplicate port assignments
  for p in "${!PORT_MAP[@]}"; do
    for q in "${!PORT_MAP[@]}"; do
      if [ "$p" = "$q" ] && [ "${PORT_MAP[$p]}" != "${PORT_MAP[$q]}" ]; then
        PORT_CONFLICTS+=("Port $p used by both ${PORT_MAP[$p]} and ${PORT_MAP[$q]}")
      fi
    done
  done

  # Docker compose detection — check if harness compose is running
  HARNESS_COMPOSE_RUNNING=false
  if $DOCKER_RUNNING; then
    COMPOSE_SERVICES=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c 'harness' || echo "0")
    [ "${COMPOSE_SERVICES:-0}" -gt 0 ] && HARNESS_COMPOSE_RUNNING=true
  fi
}

# ---------------------------------------------------------------------------
# Model recommendations based on hardware
# ---------------------------------------------------------------------------
recommend_models() {
  EMBED_MODEL="nomic-embed-text"
  EMBED_MODEL_NOTE="768-dim, fast, 274 MB"
  GEN_MODELS=()
  ASSISTANT_MODEL=""
  DEV_MODEL=""
  FULL_MODEL=""
  NOTES=()

  if $GPU_PRESENT && [ "$GPU_VRAM_GB" -ge 16 ]; then
    # GPU path
    GEN_MODELS+=("qwen2.5:32b   — GPU ≥ 16 GB VRAM — excellent quality")
    GEN_MODELS+=("qwen2.5:14b   — GPU ≥ 8 GB VRAM — good balance")
    GEN_MODELS+=("llama3.1:8b   — GPU ≥ 6 GB VRAM — fastest")
    ASSISTANT_MODEL="llama3.1:8b"
    DEV_MODEL="qwen2.5-coder:14b"
    FULL_MODEL="qwen2.5:32b"
    NOTES+=("GPU detected — models will run much faster with GPU acceleration")
  elif [ "$TOTAL_RAM_GB" -ge 48 ]; then
    # High RAM CPU server (50 GB class)
    GEN_MODELS+=("qwen2.5:32b   — ~20 GB Q4 — best quality for analysis")
    GEN_MODELS+=("qwen2.5-coder:14b — ~9 GB Q4 — best for code")
    GEN_MODELS+=("llama3.1:8b   — ~5 GB Q4 — fastest responses")
    GEN_MODELS+=("llama3.3:70b  — ~43 GB Q4 — max quality (leaves ~7 GB headroom)")
    ASSISTANT_MODEL="llama3.1:8b"
    DEV_MODEL="qwen2.5-coder:14b"
    FULL_MODEL="qwen2.5:32b"
    NOTES+=("50 GB RAM server — set OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1")
    NOTES+=("For 70b model: ensure SWAP is disabled and no other apps use RAM")
  elif [ "$TOTAL_RAM_GB" -ge 24 ]; then
    GEN_MODELS+=("qwen2.5:14b   — ~9 GB Q4 — recommended")
    GEN_MODELS+=("llama3.1:8b   — ~5 GB Q4 — faster alternative")
    GEN_MODELS+=("qwen2.5-coder:14b — ~9 GB Q4 — coding tasks")
    ASSISTANT_MODEL="llama3.1:8b"
    DEV_MODEL="qwen2.5-coder:14b"
    FULL_MODEL="qwen2.5:14b"
    NOTES+=("With 24+ GB RAM you can run 14b models comfortably")
  elif [ "$TOTAL_RAM_GB" -ge 12 ]; then
    GEN_MODELS+=("llama3.1:8b   — ~5 GB Q4 — good balance")
    GEN_MODELS+=("qwen2.5:7b    — ~4 GB Q4 — compact alternative")
    ASSISTANT_MODEL="llama3.1:8b"
    DEV_MODEL="llama3.1:8b"
    FULL_MODEL="llama3.1:8b"
    NOTES+=("With 12-24 GB RAM, stick to 7-8b models for smooth operation")
  else
    GEN_MODELS+=("phi3:mini      — ~2 GB Q4 — minimal footprint")
    ASSISTANT_MODEL="phi3:mini"
    DEV_MODEL="phi3:mini"
    FULL_MODEL="phi3:mini"
    NOTES+=("Less than 12 GB RAM — local LLM performance will be limited")
    NOTES+=("Consider using GitHub Copilot or cloud models instead")
  fi
}

# ---------------------------------------------------------------------------
# Ollama systemd configuration
# ---------------------------------------------------------------------------
ollama_systemd_config() {
  echo "[Service]"
  echo "Environment=\"OLLAMA_NUM_PARALLEL=1\""
  echo "Environment=\"OLLAMA_MAX_LOADED_MODELS=1\""
  echo "Environment=\"OLLAMA_KEEP_ALIVE=30m\""
  echo "Environment=\"OLLAMA_HOST=0.0.0.0:11434\""
}

# ---------------------------------------------------------------------------
# Install missing components
# ---------------------------------------------------------------------------
do_install() {
  h2 "Installing missing components"

  if ! $NODE_OK; then
    warn "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  if ! $GIT_OK; then
    warn "Installing git..."
    sudo apt-get install -y git
  fi

  if ! $OLLAMA_OK; then
    warn "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  if ! $DOCKER_OK; then
    warn "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    warn "Docker installed — log out and back in (or run: newgrp docker) for group changes"
  fi

  if $DOCKER_OK && ! $DOCKER_RUNNING; then
    warn "Starting Docker daemon..."
    sudo systemctl start docker
    sudo systemctl enable docker
  fi

  # Python packages for document ingestion
  if ! $HAS_DOCX; then
    warn "Installing python3-docx..."
    pip3 install python-docx
  fi
  if ! $HAS_OPENPYXL; then
    warn "Installing openpyxl..."
    pip3 install openpyxl
  fi

  # System tools for PDF/document extraction
  if ! $HAS_PDFTOTEXT; then
    warn "Installing poppler-utils (pdftotext)..."
    sudo apt-get install -y poppler-utils
  fi
  if ! $HAS_LIBREOFFICE; then
    warn "Installing libreoffice-common (for DOCX/XLSX fallback)..."
    sudo apt-get install -y libreoffice-common
  fi

  ok "Install complete"
}

# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------
print_json() {
  local models_json=""
  for m in "${GEN_MODELS[@]}"; do
    models_json+="\"$(echo "$m" | awk '{print $1}')\","
  done
  models_json="${models_json%,}"

  local ollama_models_json=""
  for m in "${OLLAMA_MODELS[@]}"; do
    ollama_models_json+="\"$m\","
  done
  ollama_models_json="${ollama_models_json%,}"

  cat <<EOF
{
  "hardware": {
    "ram_gb": $TOTAL_RAM_GB,
    "cpu_model": "$(echo "$CPU_MODEL" | sed 's/"/\\"/g')",
    "cpu_cores": $CPU_CORES,
    "gpu_present": $GPU_PRESENT,
    "gpu_model": "$(echo "$GPU_MODEL" | sed 's/"/\\"/g')",
    "gpu_vram_gb": $GPU_VRAM_GB,
    "disk_free_gb": $DISK_FREE_GB,
    "arch": "$ARCH"
  },
  "software": {
    "node_version": "$NODE_VERSION",
    "node_ok": $NODE_OK,
    "git_ok": $GIT_OK,
    "docker_ok": $DOCKER_OK,
    "docker_running": $DOCKER_RUNNING,
    "ollama_ok": $OLLAMA_OK,
    "ollama_running": $OLLAMA_RUNNING,
    "python_ok": $PYTHON_OK,
    "has_pdftotext": $HAS_PDFTOTEXT,
    "has_libreoffice": $HAS_LIBREOFFICE,
    "has_python_docx": $HAS_DOCX,
    "has_openpyxl": $HAS_OPENPYXL,
    "ollama_models": [$ollama_models_json]
  },
  "services": {
    "ollama": { "running": $OLLAMA_RUNNING, "port": $OLLAMA_PORT, "url": "http://localhost:$OLLAMA_PORT" },
    "harness_proxy": { "running": $PROXY_RUNNING, "port": $PROXY_PORT, "url": "http://localhost:$PROXY_PORT" },
    "open_webui": { "running": $WEBUI_RUNNING, "port": "${WEBUI_PORT:-}", "via": "${WEBUI_VIA:-}", "url": "http://localhost:${WEBUI_PORT:-3000}" },
    "dashboard": { "running": $DASHBOARD_RUNNING, "port": $DASHBOARD_PORT, "url": "http://localhost:$DASHBOARD_PORT", "control_panel": "http://localhost:$DASHBOARD_PORT/control" },
    "http_adapter": { "running": $HTTP_ADAPTER_RUNNING, "port": $HTTP_ADAPTER_PORT, "url": "http://localhost:$HTTP_ADAPTER_PORT" },
    "harness_compose_running": $HARNESS_COMPOSE_RUNNING
  },
  "recommendations": {
    "embed_model": "$EMBED_MODEL",
    "assistant_model": "$ASSISTANT_MODEL",
    "dev_model": "$DEV_MODEL",
    "full_model": "$FULL_MODEL",
    "generation_models": [$models_json],
    "notes": [$(printf '"%s",' "${NOTES[@]:-}" | sed 's/,$//')]
  }
}
EOF
}

# ---------------------------------------------------------------------------
# Human-readable report
# ---------------------------------------------------------------------------
print_report() {
  $QUIET || h1 "🔍 Harness Kit — System Discovery"

  h2 "Hardware"
  info "  RAM:  ${TOTAL_RAM_GB} GB"
  info "  CPU:  ${CPU_MODEL} (${CPU_CORES} cores)"
  if $GPU_PRESENT; then
    info "  GPU:  ${GPU_MODEL} (${GPU_VRAM_GB} GB VRAM)"
  else
    info "  GPU:  none detected — CPU-only inference"
  fi
  info "  Disk: ${DISK_FREE_GB} GB free on /"
  info "  Arch: ${ARCH}"

  h2 "Software"
  $NODE_OK && ok "Node.js ${NODE_VERSION}" || fail "Node.js not installed or < 20 (found: ${NODE_VERSION})"
  $GIT_OK  && ok "git ${GIT_VERSION}" || fail "git not installed"
  if $DOCKER_OK; then
    $DOCKER_RUNNING && ok "Docker ${DOCKER_VERSION} (running)" || warn "Docker ${DOCKER_VERSION} (installed but not running)"
  else
    warn "Docker not installed (optional — needed for Open WebUI)"
  fi
  if $OLLAMA_OK; then
    $OLLAMA_RUNNING && ok "Ollama ${OLLAMA_VERSION} (running)" || warn "Ollama ${OLLAMA_VERSION} (installed but not running — start with: systemctl start ollama)"
  else
    warn "Ollama not installed (required for local LLM)"
    info "  Install: curl -fsSL https://ollama.com/install.sh | sh"
  fi
  $PYTHON_OK && ok "Python ${PYTHON_VERSION}" || warn "Python3 not installed (needed for DOCX/XLSX extraction)"

  h2 "Document extractors"
  $HAS_PDFTOTEXT   && ok "pdftotext (poppler-utils)"  || warn "pdftotext missing — install: sudo apt install poppler-utils"
  $HAS_LIBREOFFICE && ok "libreoffice"                || warn "libreoffice missing — install: sudo apt install libreoffice-common"
  $HAS_DOCX        && ok "python3-docx"               || warn "python-docx missing — install: pip3 install python-docx"
  $HAS_OPENPYXL    && ok "openpyxl"                   || warn "openpyxl missing — install: pip3 install openpyxl"
  $HAS_FITZ        && ok "PyMuPDF (fitz)"             || info "PyMuPDF optional — install: pip3 install pymupdf"

  if $OLLAMA_RUNNING && [ ${#OLLAMA_MODELS[@]} -gt 0 ]; then
    h2 "Ollama models (installed)"
    for m in "${OLLAMA_MODELS[@]}"; do
      ok "$m"
    done
  fi

  h2 "Running services"
  # Ollama
  $OLLAMA_RUNNING && ok "Ollama        http://localhost:${OLLAMA_PORT}" \
                  || warn "Ollama        not running on :${OLLAMA_PORT} (start: systemctl start ollama)"

  # Harness proxy
  if $PROXY_RUNNING; then
    ok "Harness proxy http://localhost:${PROXY_PORT}  (intercepts chat → injects stage plan)"
  else
    info "  Harness proxy not running on :${PROXY_PORT}"
    info "  Start: npm run harness:proxy"
  fi

  # Open WebUI
  if $WEBUI_RUNNING; then
    ok "Open WebUI    http://localhost:${WEBUI_PORT}  (via ${WEBUI_VIA})"
  else
    warn "Open WebUI    not running"
    if $DOCKER_RUNNING; then
      info "  Start: npm run harness:webui:full    (Docker — starts proxy + Open WebUI)"
    else
      info "  Install Docker first, then: npm run harness:webui:full"
    fi
  fi

  # Harness dashboard
  if $DASHBOARD_RUNNING; then
    ok "Dashboard     http://localhost:${DASHBOARD_PORT}         (metrics + control panel)"
    ok "Control panel http://localhost:${DASHBOARD_PORT}/control"
  else
    info "  Dashboard not running on :${DASHBOARD_PORT}"
    info "  Start: npm run harness:dashboard"
  fi

  # HTTP adapter
  if $HTTP_ADAPTER_RUNNING; then
    ok "HTTP adapter  http://localhost:${HTTP_ADAPTER_PORT}        (REST API for all 24 MCP tools)"
  else
    info "  HTTP adapter not running on :${HTTP_ADAPTER_PORT}"
    info "  Start: npm run harness:http"
  fi

  # Docker compose status
  if $HARNESS_COMPOSE_RUNNING; then
    ok "Harness Docker compose services are running"
  fi

  # Port conflicts
  if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
    for conflict in "${PORT_CONFLICTS[@]}"; do
      fail "Port conflict: $conflict"
    done
  fi

  h2 "Service ports reference"
  echo -e "  ${DIM}Service             Port   Start command${RESET}"
  echo -e "  ${DIM}─────────────────── ─────  ─────────────────────────────────${RESET}"
  echo -e "  Ollama              ${CYAN}11434${RESET}  systemctl start ollama"
  echo -e "  Harness proxy       ${CYAN}${PROXY_PORT}${RESET}  npm run harness:proxy"
  echo -e "  Open WebUI          ${CYAN}3000${RESET}   npm run harness:webui:full (Docker)"
  echo -e "  Dashboard           ${CYAN}${DASHBOARD_PORT}${RESET}   npm run harness:dashboard"
  echo -e "  Control panel       ${CYAN}${DASHBOARD_PORT}${RESET}   (served at /control path)"
  echo -e "  HTTP adapter        ${CYAN}${HTTP_ADAPTER_PORT}${RESET}   npm run harness:http"
  echo -e "  MCP stdio server    ${DIM}stdio${RESET}  npm run harness:mcp:server"
  echo ""

  h2 "Recommended models for your hardware (${TOTAL_RAM_GB} GB RAM)"
  info ""
  for m in "${GEN_MODELS[@]}"; do
    info "  • ${m}"
  done
  info ""

  if [ ${#NOTES[@]} -gt 0 ]; then
    for n in "${NOTES[@]}"; do
      warn "$n"
    done
  fi

  h2 "Suggested configuration"
  info ""
  echo -e "  ${CYAN}# .env or shell profile${RESET}"
  echo -e "  ${BLUE}export HARNESS_LLM_PROVIDER=ollama${RESET}"
  echo -e "  ${BLUE}export HARNESS_LLM_MODEL=${DEV_MODEL}${RESET}"
  echo -e "  ${BLUE}export HARNESS_LLM_HOST=http://localhost:11434${RESET}"
  echo -e "  ${BLUE}export HARNESS_EMBED_MODEL=${EMBED_MODEL}${RESET}"
  echo -e "  ${BLUE}export HARNESS_EMBED_TIMEOUT_MS=120000${RESET}"
  echo -e "  ${BLUE}export UNDERSTAND_PLUGIN_ROOT=/opt/understand-anything-plugin${RESET}"
  info ""

  if [ "$TOTAL_RAM_GB" -ge 16 ]; then
    echo -e "  ${CYAN}# Ollama systemd tuning — /etc/systemd/system/ollama.service.d/cpu-tuning.conf${RESET}"
    ollama_systemd_config | while IFS= read -r line; do
      echo -e "  ${BLUE}${line}${RESET}"
    done
    info ""
  fi

  h2 "Next steps"
  info ""

  if ! $OLLAMA_OK; then
    cmd_ "curl -fsSL https://ollama.com/install.sh | sh"
  fi
  if $OLLAMA_OK && ! $OLLAMA_RUNNING; then
    cmd_ "sudo systemctl start ollama"
    cmd_ "sudo systemctl enable ollama"
  fi

  cmd_ "ollama pull ${EMBED_MODEL}     # required for semantic search"
  cmd_ "ollama pull ${ASSISTANT_MODEL}  # assistant mode"
  if [ "${DEV_MODEL}" != "${ASSISTANT_MODEL}" ]; then
    cmd_ "ollama pull ${DEV_MODEL}       # dev/coder mode"
  fi
  if [ "${FULL_MODEL}" != "${DEV_MODEL}" ]; then
    cmd_ "ollama pull ${FULL_MODEL}      # full feature mode"
  fi
  info ""
  cmd_ "npm install                     # install harness"
  cmd_ "npm run harness:health -- --fast  # verify setup"
  cmd_ "npm run harness:webui:full       # start Open WebUI + proxy"
  info ""

  if $DO_INSTALL; then
    do_install
  else
    info "  Run with --install to automatically install missing components"
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
detect_hardware
detect_software
detect_services
recommend_models

if $JSON_OUTPUT; then
  print_json
else
  print_report
fi
