#!/bin/bash
# clean-project-commands.sh — 清除子專案本地的 skill 副本
# 全域 skills 已安裝到 ~/.claude/commands/，子專案不需要本地副本
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
  dev-plan product-diagnosis pre-deploy project-kickoff sprint-proposal
  knowledge-feedback
)

PROJECT_DIR="${1:-$(pwd)}"
COMMANDS_DIR="$PROJECT_DIR/.claude/commands"

if [ ! -d "$COMMANDS_DIR" ]; then
  echo "找不到 $COMMANDS_DIR，跳過"
  exit 0
fi

echo "=== 清理子專案本地 Skills ==="
echo "專案：$PROJECT_DIR"
echo ""

REMOVED=0
UPDATED=0

for skill in "${GLOBAL_SKILLS[@]}"; do
  LOCAL="$COMMANDS_DIR/$skill.md"
  TEMPLATE="$TEMPLATE_DIR/$skill/SKILL.md"

  if [ ! -f "$LOCAL" ]; then
    continue
  fi

  # 如果本地有 disable-model-invocation，直接用模板覆蓋
  if grep -q "disable-model-invocation" "$LOCAL" 2>/dev/null; then
    if [ -f "$TEMPLATE" ]; then
      cp "$TEMPLATE" "$LOCAL"
      echo "↻  更新（移除 disable-model-invocation）：$skill"
      ((UPDATED++))
    else
      rm "$LOCAL"
      echo "✕  移除（無對應模板）：$skill"
      ((REMOVED++))
    fi
  fi
done

echo ""
echo "=== 完成 ==="
echo "更新：$UPDATED  移除：$REMOVED"
echo ""
echo "子專案現在將優先使用本地更新版本，全域 ~/.claude/commands/ 作為備援。"
