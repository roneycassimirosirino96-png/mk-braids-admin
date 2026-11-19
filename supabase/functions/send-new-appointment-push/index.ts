import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const receivedSecret = request.headers.get("x-push-webhook-secret");
  if (!receivedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: { schema?: string; table?: string; type?: string };
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (event.schema !== "public" || event.table !== "agendamentos" || event.type !== "INSERT") {
    return Response.json({ error: "Unsupported database event" }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Push sender is missing its Supabase server configuration");
    return Response.json({ error: "Push sender is not configured" }, { status: 500 });
  }

  const database = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await database.rpc("get_push_server_config");
  if (configError) {
    console.error("Could not load push server configuration:", configError.message);
    return Response.json({ error: "Push sender is not configured" }, { status: 500 });
  }
  const webhookSecret = config?.push_webhook_secret;
  if (!webhookSecret || receivedSecret !== webhookSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = config?.vapid_public_key;
  const vapidPrivateKey = config?.vapid_private_key;
  const vapidSubject = config?.vapid_subject;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("Push sender is missing VAPID configuration in Supabase Vault");
    return Response.json({ error: "Push sender is not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: subscriptions, error } = await database
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) {
    console.error("Could not load push subscriptions:", error.message);
    return Response.json({ error: "Could not load subscriptions" }, { status: 500 });
  }

  const payload = JSON.stringify({
    title: "Novo pedido de agendamento",
    body: "Uma cliente enviou um novo pedido para a MK Braids.",
    url: "/mk-braids-admin/",
  });
  let sent = 0;
  let expired = 0;

  await Promise.all((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload);
      sent += 1;
    } catch (sendError) {
      const statusCode = sendError?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await database
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        if (deleteError) console.error("Could not remove expired push subscription:", deleteError.message);
        else expired += 1;
      } else {
        console.error("Push delivery failed:", statusCode || "unknown status");
      }
    }
  }));

  return Response.json({ sent, expired });
});
