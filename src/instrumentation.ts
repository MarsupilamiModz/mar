export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("uncaughtException", (error) => {
    console.error("[platform] uncaughtException:", error);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[platform] unhandledRejection:", reason);
  });
}
