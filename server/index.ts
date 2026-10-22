import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const { app } = await createApp(config);
const address = await app.listen({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
});
console.log(`Game server: ${address}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
