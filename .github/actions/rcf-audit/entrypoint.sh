#!/bin/sh -l

LICENSE_KEY=$1
AUDIT_PATH=$2

echo "Running RCF Audit on $AUDIT_PATH..."
rcf-cli audit "$AUDIT_PATH" --license-key "$LICENSE_KEY"

if [ $? -eq 0 ]; then
  echo "Audit successful."
else
  echo "Audit failed."
  exit 1
fi
