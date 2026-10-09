#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
asset_dir="$project_dir/app/src/main/assets/tessdata"
revision="87416418657359cb625c412a48b6e1d6d41c29bd"
mkdir -p "$asset_dir"

for language in eng rus; do
  case "$language" in
    eng) expected="bbef4675053b5b468cdb477053e28b1c698ba08e" ;;
    rus) expected="b146cb2263acbc6383f8e92ea0ce759537687bb8" ;;
  esac
  output="$asset_dir/$language.traineddata"
  if [[ -f "$output" && "$(git hash-object -- "$output")" == "$expected" ]]; then
    continue
  fi
  curl --fail --location --retry 3 --output "$output.tmp" \
    "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/$revision/$language.traineddata"
  actual="$(git hash-object -- "$output.tmp")"
  if [[ "$actual" != "$expected" ]]; then
    rm -f "$output.tmp"
    echo "Unexpected checksum for $language OCR model" >&2
    exit 1
  fi
  mv "$output.tmp" "$output"
done
