import { createApp } from "./app.js";

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "当前是本地原型，尚未实现房主账号与持久化，请勿作为正式公网服务启动。",
  );
}
const { app } = await createApp();
const address = await app.listen({
  host: "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
});
console.log(`Game server: ${address}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
