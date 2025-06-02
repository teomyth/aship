#!/bin/bash

# Simple aship demonstration script
# Shows the two core playbooks in the getting-started example

set -e

echo "🚀 Aship Getting Started Demo"
echo "============================"
echo
echo "This example includes two playbooks:"
echo "1. demo - Complete feature demonstration"
echo "2. setup-ssh - SSH key management"
echo

# Check if we're in the right directory
if [ ! -f "aship.yml" ]; then
    echo "❌ Error: Please run this script from the getting-started directory"
    echo "Usage: cd examples/getting-started && ./demo.sh"
    exit 1
fi

# Function to check if aship CLI is available
check_aship_cli() {
    if command -v aship >/dev/null 2>&1; then
        ASHIP_CMD="aship"
        return 0
    elif [ -x "../../packages/cli/bin/run" ]; then
        ASHIP_CMD="../../packages/cli/bin/run"
        return 0
    elif [ -f "../../packages/cli/dist/index.js" ]; then
        ASHIP_CMD="node ../../packages/cli/dist/index.js"
        return 0
    else
        echo "❌ Error: aship CLI not found or not built."
        echo "Please run one of the following:"
        echo "  1. Build the project: cd ../.. && pnpm build"
        echo "  2. Install globally: cd ../.. && pnpm cli:link"
        echo "  3. Use pnpm exec: pnpm exec aship"
        exit 1
    fi
}

check_aship_cli
echo "✅ Using aship CLI: $ASHIP_CMD"
echo

echo "📋 Available commands to try:"
echo
echo "Basic usage:"
echo "  $ASHIP_CMD demo              # Run demo playbook (interactive)"
echo "  $ASHIP_CMD setup-ssh         # Run SSH setup playbook"
echo
echo "Advanced options:"
echo "  $ASHIP_CMD demo -y           # Use defaults, skip prompts"
echo "  $ASHIP_CMD demo --tags info  # Run only info tasks"
echo "  $ASHIP_CMD cache list        # View cached variables"
echo
echo "Try running one of these commands to see aship in action!"
echo
echo "💡 Tip: Start with '$ASHIP_CMD demo' for the full experience."
