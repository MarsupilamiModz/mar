type GraphTokenResponse = {
  access_token: string;
  expires_in: number;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getMicrosoftGraphToken(config: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft auth failed: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as GraphTokenResponse;
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export async function sendViaMicrosoftGraph(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const token = await getMicrosoftGraphToken({
    tenantId: params.tenantId,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
  });

  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(params.senderEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: "HTML", content: params.html },
          toRecipients: recipients.map((address) => ({
            emailAddress: { address },
          })),
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph send failed: ${text.slice(0, 300)}`);
  }
  return true;
}

export async function testMicrosoftGraphConnection(config: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
}) {
  await getMicrosoftGraphToken(config);
  return true;
}
