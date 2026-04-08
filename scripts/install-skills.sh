#!/bin/bash
# install-skills.sh — 將公司級 Skills 安裝到全域 ~/.claude/commands/
# 首次 clone AgentHub 後執行此腳本，之後子專案無需個別部署 Skills

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/.knowledge/company/skill-templates"
TARGET_DIR="$HOME/.claude/commands"

# 全域 Skills（公司共用，適合安裝到 ~/.claude/commands/）
GLOBAL_SKILLS=(
  sop-plan
  sop-execute
  sop-review
  sop-deploy
  task-start
  task-done
  task-dispatch
  task-delegation
  task-approve
  task-status
  review
  pm-review
  gate-record
  spec-update
  pitfall-record
  pitfall-resolve
  sprint-proposal
  sprint-retro
  sprint-close
  project-kickoff
  dev-plan
  pre-deploy
  product-diagnosis
  harness-audit
)

echo "=== AgentHub Skill 安裝程式 ==="
echo "來源：$TEMPLATE_DIR"
echo "目標：$TARGET_DIR"
echo ""

mkdir -p "$TARGET_DIR"

INSTALLED=0
SKIPPED=0
UPDATED=0

for skill in "${GLOBAL_SKILLS[@]}"; do
  SRC="$TEMPLATE_DIR/$skill/SKILL.md"
  DST="$TARGET_DIR/$skill.md"

  if [ ! -f "$SRC" ]; then
    echo "⚠️  跳過 $skill（模板不存在）"
    ((SKIPPED++))
    continue
  fi

  if [ -f "$DST" ]; then
    # 比較內容，若相同則跳過（冪等性）
    if cmp -s "$SRC" "$DST"; then
      ((SKIPPED++))
      continue
    fi
    cp "$SRC" "$DST"
    echo "↻  更新 $skill"
    ((UPDATED++))
  else
    cp "$SRC" "$DST"
    echo "✓  安裝 $skill"
    ((INSTALLED++))
  fi
done

echo ""
echo "=== 完成 ==="
echo "新安裝：$INSTALLED  更新：$UPDATED  已是最新：$SKIPPED"
echo ""
echo "可用指令（Claude Code 輸入 /skill-name 即可使用）："
for skill in "${GLOBAL_SKILLS[@]}"; do
  echo "  /$skill"
done
