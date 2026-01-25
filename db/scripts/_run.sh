#!/bin/bash

SCRIPTS_DIR="./db/scripts"

if [ ! -d "$SCRIPTS_DIR" ]; then
  echo "Error: Scripts directory '$SCRIPTS_DIR' does not exist."
  exit 1
fi

scripts=($(find "$SCRIPTS_DIR" -maxdepth 1 -name "*.ts" -not -name "_*" | sort))

if [ ${#scripts[@]} -eq 0 ]; then
  echo "No scripts found in $SCRIPTS_DIR."
  exit 1
fi

echo "Available scripts:"
for i in "${!scripts[@]}"; do
  script_name=$(basename "${scripts[$i]}" .ts)
  echo "  $((i + 1)). $script_name"
done

echo ""
read -p "Select a script to run (1-${#scripts[@]}): " selection

if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#scripts[@]} ]; then
  echo "Invalid selection."
  exit 1
fi

selected_script="${scripts[$((selection - 1))]}"
script_name=$(basename "$selected_script")

echo ""
echo "Running $script_name..."
echo ""

bun --env-file=.env "$selected_script"
