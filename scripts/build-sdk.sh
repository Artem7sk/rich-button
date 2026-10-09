#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17}"
: "${ANDROID_HOME:?Set ANDROID_HOME to Android SDK}"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew --no-daemon lintDebug assembleDebug
