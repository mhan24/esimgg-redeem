import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 独立部署输出 (Docker 多阶段构建, 规格 §52)
  output: "standalone",
  // Prisma 查询引擎不作为 bundle 处理
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
