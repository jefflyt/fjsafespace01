#!/bin/bash
# Statusline: folder | git branch | model | context % with progress bar

# 1. Project folder name
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FOLDER=$(basename "$PROJECT_DIR")

# 2. Git branch
BRANCH=$(git -C "$PROJECT_DIR" symbolic-ref --short HEAD 2>/dev/null || echo "no-git")
BRANCH=$(echo "$BRANCH" | head -c 20)

# 3. Model name (shortened)
MODEL="${ANTHROPIC_MODEL:-${CLAUDE_MODEL:-unknown}}"
MODEL=$(echo "$MODEL" | sed 's/claude-//g; s/-[0-9].*//g' | head -c 12)

# 4. Context usage % (from CLAUDE_CODE_CONTEXT_PERCENT if available)
CONTEXT_PCT="${CLAUDE_CODE_CONTEXT_PERCENT:-0}"
if [ "$CONTEXT_PCT" -gt 100 ] 2>/dev/null; then CONTEXT_PCT=100; fi

# Build progress bar (20 chars wide)
TOTAL=20
FILLED=$(( CONTEXT_PCT * TOTAL / 100 ))
EMPTY=$(( TOTAL - FILLED ))
BAR=$(printf '%0.s█' $(seq 1 $FILLED 2>/dev/null) 2>/dev/null || true)
BAR_EMPTY=$(printf '%0.s░' $(seq 1 $EMPTY 2>/dev/null) 2>/dev/null || true)
if [ "$FILLED" -eq 0 ] 2>/dev/null; then
  BAR=""
  BAR_EMPTY=$(printf '%0.s░' $(seq 1 $TOTAL 2>/dev/null) 2>/dev/null || true)
fi

printf "%s | %s | %s | [%s%s] %d%%" "$FOLDER" "$BRANCH" "$MODEL" "$BAR" "$BAR_EMPTY" "$CONTEXT_PCT"
