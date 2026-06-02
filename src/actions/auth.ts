"use server";

import { sendWelcomeEmail } from "@/lib/email/send";

export async function sendRegistrationWelcomeEmail(email: string, username?: string) {
  const name = username?.trim() || email.split("@")[0] || "there";
  void sendWelcomeEmail({ email, username: name });
}
