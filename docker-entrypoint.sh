#!/bin/sh
# esim.gg 兑换系统容器入口 (规格 §54/§55)
# 1. 执行 Prisma 迁移  2. 初始化管理员/设置  3. 启动 Next.js
set -e

echo "[entrypoint] 等待数据库就绪..."
npx prisma migrate deploy

echo "[entrypoint] 初始化管理员与系统设置..."
npx tsx prisma/seed.ts

echo "[entrypoint] 启动应用..."
exec node server.js
