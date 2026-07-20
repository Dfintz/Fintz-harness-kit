#!/bin/sh
set -e
BACKEND="${BACKEND_UPSTREAM:-https://api.fringecore.space}"
sed -i "s|__BACKEND_UPSTREAM__|${BACKEND}|g" /etc/nginx/conf.d/default.conf
echo "Configured backend upstream: ${BACKEND}"

# Substitute Azure Front Door ID for origin restriction
if [ -n "${AZURE_FRONT_DOOR_ID}" ]; then
  sed -i "s|AZURE_FD_ID_PLACEHOLDER|${AZURE_FRONT_DOOR_ID}|g" /etc/nginx/conf.d/default.conf
  echo "Configured Front Door restriction: ${AZURE_FRONT_DOOR_ID}"
else
  # No Front Door ID — disable restriction entirely
  sed -i 's|default                    1;|default 0;|g' /etc/nginx/conf.d/default.conf
  echo "No AZURE_FRONT_DOOR_ID set — allowing all traffic"
fi
