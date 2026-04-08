#!/bin/bash
# clean-project-commands.sh — 將子專案本地 Skills 強制同步到最新模板版本
# 用法：bash scripts/clean-project-commands.sh <專案路徑>
#   例：bash scripts/clean-project-commands.sh C:/projects/AgentGame

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/.knowledge/company/skill-templates"

# 全域 Skills 清單（與 install-skills.sh 保持一致）
GLOBAL_SKILLS=(
  sop-plan sop-execute sop-review sop-deploy
  task-start task-done task-dispatch task-delegation task-approve task-status
  review pm-review gate-record spec-update
  pitfall-record pitfall-resolve sprint-proposal sprint-retro harness-audit
  dev-plan product-diagnosis pre-deploy project-kickoff
  sprint-close
)

PROJECT_DIR="${1:-$(pwd)}"
COMMANDS_DIR="$PROJECT_DIR/.claude/commands"

if [ ! -d "$COMMANDS_DIR" ]; then
  echo "找不到 $COMMANDS_DIR，跳過"
  exit 0
fi

echo "=== 同步子專案本地 Skills → 最新模板 ==="
echo "專案：$PROJECT_DIR"
echo ""

UPDATED=0
SKIPPED=0
ADDED=0

for skill in "${GLOBAL_SKILLS[@]}"; do
  LOCAL="$COMMANDS_DIR/$skill.md"
  TEMPLATE="$TEMPLATE_DIR/$skill/SKILL.md"

  if [ ! -f "$TEMPLATE" ]; then
    echo "⚠️  跳過 $skill（模板不存在）"
    ((SKIPPED++))
    continue
  fi

  if [ ! -f "$LOCAL" ]; then
    # 新增：模板有但專案沒有，補進去
    cp "$TEMPLATE" "$LOCAL"
    echo "✓  新增：$skill"
    ((ADDED++))
    continue
  fi

  # 更新：本地有但內容不同
  if cmp -s "$LOCAL" "$TEMPLATE"; then
    ((SKIPPED++))
  else
    cp "$TEMPLATE" "$LOCAL"
    echo "↻  同步：$skill"
    ((UPDATED++))
  fi
done

echo ""
echo "=== 完成 ==="
echo "新增：$ADDED  同步：$UPDATED  已是最新：$SKIPPED"
