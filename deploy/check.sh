#!/usr/bin/env bash
set -u
id
uname -m
docker --version
docker compose version
free -h
df -h /
docker ps --format 'table {{.Names}}\t{{.Networks}}\t{{.Ports}}'
curl -I --max-time 10 https://github.com/L1ke40oz/pixel-boss-party
ss -lnt '( sport = :3030 )'
