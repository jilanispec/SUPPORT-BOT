import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.BOT_TOKEN;

const OWNER_ID = Number(
  process.env.OWNER_ID || "2079655933"
);

const ADMIN_IDS = (process.env.ADMIN_IDS || "2079655933,7598304720")
  .split(",")
  .map((id) => Number(id.trim()))
  .filter(Boolean);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing");
}

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing");
}

if (!SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_SECRET_KEY is missing");
}

/*
 * SERVER-ONLY Supabase client.
 * Never expose SUPABASE_SECRET_KEY to users/browser.
 */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

const TELEGRAM_API =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

/* =====================================================
   ADMIN NAMES
===================================================== */

const ADMIN_NAMES = {
  2079655933: "JILAN",
  7598304720: "ADMIN"
};

function getAdminName(adminId) {
  return ADMIN_NAMES[Number(adminId)] || "ADMIN";
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

/* =====================================================
   TELEGRAM API
===================================================== */

async function telegram(method, body = {}) {
  const response = await fetch(
    `${TELEGRAM_API}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.error(
      `Telegram ${method} failed:`,
      data
    );
  }

  return data;
}

/* =====================================================
   SUPABASE - USERS
===================================================== */

async function saveUser(user) {
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        user_id: Number(user.id),
        first_name: user.first_name || "",
        username: user.username || null,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id"
      }
    );

  if (error) {
    console.error("saveUser:", error);
  }
}

async function userExists(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", Number(userId))
    .limit(1);

  if (error) {
    console.error("userExists:", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function getUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, username")
    .order("user_id");

  if (error) {
    console.error("getUsers:", error);
    return [];
  }

  return data || [];
}

/* =====================================================
   SUPABASE - GROUPS
===================================================== */

async function saveGroup(chat) {
  const { error } = await supabase
    .from("groups")
    .upsert(
      {
        group_id: Number(chat.id),
        title: chat.title || "",
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "group_id"
      }
    );

  if (error) {
    console.error("saveGroup:", error);
  }
}

async function getGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("group_id, title")
    .order("group_id");

  if (error) {
    console.error("getGroups:", error);
    return [];
  }

  return data || [];
}

/* =====================================================
   SUPABASE - MESSAGE MAPPING
===================================================== */

async function saveMessageMapping({
  adminId,
  forwardedMessageId,
  metadataMessageId,
  userId
}) {
  const { error } = await supabase
    .from("message_map")
    .upsert(
      {
        admin_id: Number(adminId),
        forwarded_message_id: Number(
          forwardedMessageId
        ),
        metadata_message_id: metadataMessageId
          ? Number(metadataMessageId)
          : null,
        user_id: Number(userId)
      },
      {
        onConflict:
          "admin_id,forwarded_message_id"
      }
    );

  if (error) {
    console.error(
      "saveMessageMapping:",
      error
    );
  }
}

async function findUserFromReply(
  adminId,
  replyMessageId
) {
  /*
   * Normally the admin replies to the actual
   * forwarded message.
   *
   * Metadata message is also accepted as a fallback.
   */
  const { data, error } = await supabase
    .from("message_map")
    .select("user_id")
    .eq("admin_id", Number(adminId))
    .or(
      `forwarded_message_id.eq.${Number(
        replyMessageId
      )},metadata_message_id.eq.${Number(
        replyMessageId
      )}`
    )
    .limit(1);

  if (error) {
    console.error(
      "findUserFromReply:",
      error
    );
    return null;
  }

  if (!data || !data.length) {
    return null;
  }

  return Number(data[0].user_id);
}

/* =====================================================
   SUPABASE - STATS
===================================================== */

async function incrementStat(column) {
  const allowed = [
    "messages_received",
    "admin_replies",
    "broadcasts",
    "broadcast_messages_sent",
    "broadcast_failures"
  ];

  if (!allowed.includes(column)) {
    return;
  }

  /*
   * Use RPC if available.
   * If RPC isn't configured, we perform a read/update.
   */
  const { data, error } = await supabase
    .from("bot_stats")
    .select(column)
    .eq("id", 1)
    .single();

  if (error) {
    console.error("stats read:", error);
    return;
  }

  const current = Number(data[column] || 0);

  const { error: updateError } = await supabase
    .from("bot_stats")
    .update({
      [column]: current + 1
    })
    .eq("id", 1);

  if (updateError) {
    console.error(
      "stats update:",
      updateError
    );
  }
}

async function getStats() {
  const { data, error } = await supabase
    .from("bot_stats")
    .select(
      `
      messages_received,
      admin_replies,
      broadcasts,
      broadcast_messages_sent,
      broadcast_failures
      `
    )
    .eq("id", 1)
    .single();

  if (error) {
    console.error("getStats:", error);

    return {
      messages_received: 0,
      admin_replies: 0,
      broadcasts: 0,
      broadcast_messages_sent: 0,
      broadcast_failures: 0
    };
  }

  return data;
}

/* =====================================================
   USER PROFILE BUTTON
===================================================== */

function getProfileButton(user) {
  if (user.username) {
    return {
      inline_keyboard: [
        [
          {
            text: "👤 User Profile",
            url:
              `https://t.me/${user.username}`
          }
        ]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        {
          text: "👤 User Profile",
          url:
            `tg://user?id=${user.id}`
        }
      ]
    ]
  };
}

/* =====================================================
   /START
===================================================== */

const FIRST_START = (firstName) => `
🌍 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐉𝐈𝐋𝐀𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 𝐁𝐎𝐓

👋 𝐇𝐞𝐥𝐥𝐨, ${firstName}

📩 𝐍𝐞𝐞𝐝 𝐡𝐞𝐥𝐩? 𝐒𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐜𝐨𝐦𝐩𝐥𝐞𝐭𝐞 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐫𝐞𝐪𝐮𝐞𝐬𝐭 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

📝 𝐏𝐥𝐞𝐚𝐬𝐞 𝐢𝐧𝐜𝐥𝐮𝐝𝐞 𝐚𝐥𝐥 𝐢𝐦𝐩𝐨𝐫𝐭𝐚𝐧𝐭 𝐝𝐞𝐭𝐚𝐢𝐥𝐬 𝐢𝐧 𝐨𝐧𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐬𝐨 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐜𝐚𝐧 𝐮𝐧𝐝𝐞𝐫𝐬𝐭𝐚𝐧𝐝 𝐚𝐧𝐝 𝐡𝐞𝐥𝐩 𝐲𝐨𝐮 𝐟𝐚𝐬𝐭𝐞𝐫.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.

━━━━━━━━━━━━━━━━━━
🛡️ 𝐘𝐨𝐮𝐫 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐢𝐬 𝐡𝐚𝐧𝐝𝐥𝐞𝐝 𝐛𝐲 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦.
`.trim();

const EXISTING_START = `
👋 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐚𝐧 𝐞𝐱𝐢𝐬𝐭𝐢𝐧𝐠 𝐮𝐬𝐞𝐫.

📩 𝐏𝐥𝐞𝐚𝐬𝐞 𝐬𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐪𝐮𝐞𝐫𝐲 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.
`.trim();

async function handleStart(message) {
  const user = message.from;

  const exists = await userExists(user.id);

  await saveUser(user);

  await telegram("sendMessage", {
    chat_id: user.id,
    text: exists
      ? EXISTING_START
      : FIRST_START(
          user.first_name || "there"
        )
  });
}

/* =====================================================
   TEMPORARY "MESSAGE SENT"
===================================================== */

async function sendMessageSent(chatId) {
  const result = await telegram(
    "sendMessage",
    {
      chat_id: chatId,
      text: "Message sent"
    }
  );

  if (
    !result.ok ||
    !result.result?.message_id
  ) {
    return;
  }

  const confirmationId =
    result.result.message_id;

  /*
   * Attempt deletion after 30 seconds.
   *
   * Note: Vercel serverless functions can terminate
   * after the request finishes, so this is best-effort.
   */
  setTimeout(async () => {
    try {
      await telegram(
        "deleteMessage",
        {
          chat_id: chatId,
          message_id: confirmationId
        }
      );
    } catch (error) {
      console.error(
        "Delete confirmation:",
        error
      );
    }
  }, 30000);
}

/* =====================================================
   USER -> ADMINS
===================================================== */

async function forwardUserMessage(message) {
  const user = message.from;

  await saveUser(user);
  await incrementStat(
    "messages_received"
  );

  /*
   * IMPORTANT:
   *
   * Native forwardMessage is used here.
   * This preserves Telegram custom emojis,
   * entities, media and original message format.
   */
  for (const adminId of ADMIN_IDS) {
    try {
      const forwarded =
        await telegram(
          "forwardMessage",
          {
            chat_id: adminId,
            from_chat_id: user.id,
            message_id:
              message.message_id
          }
        );

      if (
        !forwarded.ok ||
        !forwarded.result
      ) {
        continue;
      }

      const forwardedMessageId =
        forwarded.result.message_id;

      /*
       * FIRST NAME ONLY.
       *
       * Username is deliberately NOT used here.
       */
      const firstName =
        user.first_name || "User";

      const metadataText =
        `👆 Message sent by ${firstName} ` +
        `[${user.id}] #id${user.id}\n` +
        `👉 To answer, reply to this message.`;

      /*
       * Metadata is a separate message attached
       * underneath the actual forwarded message.
       */
      const metadata =
        await telegram(
          "sendMessage",
          {
            chat_id: adminId,
            text: metadataText,
            reply_to_message_id:
              forwardedMessageId,
            reply_markup:
              getProfileButton(user)
          }
        );

      const metadataMessageId =
        metadata.ok
          ? metadata.result.message_id
          : null;

      /*
       * CRITICAL:
       *
       * forwarded message ID -> exact user ID
       *
       * This prevents bulk/multiple users from
       * getting mixed up.
       */
      await saveMessageMapping({
        adminId,
        forwardedMessageId,
        metadataMessageId,
        userId: user.id
      });

    } catch (error) {
      console.error(
        "Forward user message:",
        error
      );
    }
  }

  await sendMessageSent(user.id);
}

/* =====================================================
   ADMIN -> USER
===================================================== */

async function handleAdminReply(message) {
  const adminId =
    Number(message.from.id);

  if (!isAdmin(adminId)) {
    return false;
  }

  if (!message.reply_to_message) {
    return false;
  }

  const repliedMessageId =
    message.reply_to_message.message_id;

  /*
   * Find EXACT user associated with
   * the message the admin replied to.
   */
  const userId =
    await findUserFromReply(
      adminId,
      repliedMessageId
    );

  if (!userId) {
    return false;
  }

  /*
   * Send ONLY the admin's actual message
   * to the user.
   *
   * copyMessage supports text, media,
   * formatting and Telegram entities.
   */
  const copied =
    await telegram(
      "copyMessage",
      {
        chat_id: userId,
        from_chat_id: adminId,
        message_id:
          message.message_id
      }
    );

  if (!copied.ok) {
    return true;
  }

  await incrementStat(
    "admin_replies"
  );

  /*
   * Separate admin marker.
   */
  const marker =
    `👨‍💻 Replied by ` +
    `${getAdminName(adminId)} ` +
    `[${adminId}]`;

  for (const targetAdmin of ADMIN_IDS) {
    try {
      await telegram(
        "sendMessage",
        {
          chat_id: targetAdmin,
          text: marker
        }
      );
    } catch (error) {
      console.error(
        "Reply marker:",
        error
      );
    }
  }

  return true;
}

/* =====================================================
   BROADCAST
===================================================== */

async function sendBroadcastText(
  text
) {
  const users = await getUsers();
  const groups = await getGroups();

  let userSent = 0;
  let groupSent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result =
        await telegram(
          "sendMessage",
          {
            chat_id:
              Number(user.user_id),
            text
          }
        );

      if (result.ok) {
        userSent++;
        await incrementStat(
          "broadcast_messages_sent"
        );
      } else {
        failed++;
        await incrementStat(
          "broadcast_failures"
        );
      }
    } catch {
      failed++;
      await incrementStat(
        "broadcast_failures"
      );
    }
  }

  for (const group of groups) {
    try {
      const result =
        await telegram(
          "sendMessage",
          {
            chat_id:
              Number(group.group_id),
            text
          }
        );

      if (result.ok) {
        groupSent++;
        await incrementStat(
          "broadcast_messages_sent"
        );
      } else {
        failed++;
        await incrementStat(
          "broadcast_failures"
        );
      }
    } catch {
      failed++;
      await incrementStat(
        "broadcast_failures"
      );
    }
  }

  await incrementStat(
    "broadcasts"
  );

  return {
    userSent,
    groupSent,
    failed
  };
}

async function forwardBroadcast(
  adminId,
  sourceMessageId
) {
  const users = await getUsers();
  const groups = await getGroups();

  let userSent = 0;
  let groupSent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result =
        await telegram(
          "forwardMessage",
          {
            chat_id:
              Number(user.user_id),
            from_chat_id:
              adminId,
            message_id:
              sourceMessageId
          }
        );

      if (result.ok) {
        userSent++;
        await incrementStat(
          "broadcast_messages_sent"
        );
      } else {
        failed++;
        await incrementStat(
          "broadcast_failures"
        );
      }
    } catch {
      failed++;
      await incrementStat(
        "broadcast_failures"
      );
    }
  }

  for (const group of groups) {
    try {
      const result =
        await telegram(
          "forwardMessage",
          {
            chat_id:
              Number(group.group_id),
            from_chat_id:
              adminId,
            message_id:
              sourceMessageId
          }
        );

      if (result.ok) {
        groupSent++;
        await incrementStat(
          "broadcast_messages_sent"
        );
      } else {
        failed++;
        await incrementStat(
          "broadcast_failures"
        );
      }
    } catch {
      failed++;
      await incrementStat(
        "broadcast_failures"
      );
    }
  }

  await incrementStat(
    "broadcasts"
  );

  return {
    userSent,
    groupSent,
    failed
  };
}

async function handleBroadcast(
  message
) {
  const adminId =
    Number(message.from.id);

  if (!isAdmin(adminId)) {
    await telegram(
      "sendMessage",
      {
        chat_id: adminId,
        text:
          "❌ You are not the owner of this bot."
      }
    );

    return;
  }

  /*
   * MODE A:
   *
   * Admin replies to a message and types
   * /broadcast
   */
  if (message.reply_to_message) {
    const result =
      await forwardBroadcast(
        adminId,
        message.reply_to_message.message_id
      );

    await telegram(
      "sendMessage",
      {
        chat_id: adminId,
        text:
          `📢 Broadcast Completed\n\n` +
          `👤 Users : ${result.userSent}\n` +
          `👥 Groups : ${result.groupSent}\n` +
          `❌ Failed : ${result.failed}`
      }
    );

    return;
  }

  /*
   * MODE B:
   *
   * /broadcast Hello everyone
   */
  const text =
    (message.text || "")
      .replace(
        /^\/broadcast(?:@\w+)?\s*/i,
        ""
      )
      .trim();

  if (!text) {
    await telegram(
      "sendMessage",
      {
        chat_id: adminId,
        text:
          "Usage:\n\n" +
          "/broadcast Your message\n\n" +
          "or reply to a message with /broadcast"
      }
    );

    return;
  }

  const result =
    await sendBroadcastText(text);

  await telegram(
    "sendMessage",
    {
      chat_id: adminId,
      text:
        `📢 Broadcast Completed\n\n` +
        `👤 Users : ${result.userSent}\n` +
        `👥 Groups : ${result.groupSent}\n` +
        `❌ Failed : ${result.failed}`
    }
  );
}

/* =====================================================
   /BOTSTATS
===================================================== */

async function handleBotStats(
  message
) {
  const adminId =
    Number(message.from.id);

  if (!isAdmin(adminId)) {
    await telegram(
      "sendMessage",
      {
        chat_id: adminId,
        text:
          "❌ You are not the owner of this bot."
      }
    );

    return;
  }

  const { count: userCount } =
    await supabase
      .from("users")
      .select(
        "user_id",
        {
          count: "exact",
          head: true
        }
      );

  const { count: groupCount } =
    await supabase
      .from("groups")
      .select(
        "group_id",
        {
          count: "exact",
          head: true
        }
      );

  const stats =
    await getStats();

  const text =
    `📊 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐒\n\n` +
    `👤 Users: ${userCount || 0}\n` +
    `👥 Groups: ${groupCount || 0}\n\n` +
    `📨 Messages received: ${stats.messages_received}\n` +
    `💬 Admin replies: ${stats.admin_replies}\n\n` +
    `📢 Broadcasts: ${stats.broadcasts}\n` +
    `📤 Broadcast messages sent: ${stats.broadcast_messages_sent}\n` +
    `❌ Broadcast failures: ${stats.broadcast_failures}\n\n` +
    `👨‍💻 Admins: ${ADMIN_IDS.length}`;

  await telegram(
    "sendMessage",
    {
      chat_id: adminId,
      text
    }
  );
}

/* =====================================================
   PROCESS UPDATE
===================================================== */

async function processUpdate(update) {
  if (!update?.message) {
    return;
  }

  const message = update.message;
  const chat = message.chat;

  /*
   * GROUPS / SUPERGROUPS
   *
   * Register them for /broadcast,
   * but NEVER forward their messages
   * to support admins.
   */
  if (
    chat.type === "group" ||
    chat.type === "supergroup"
  ) {
    await saveGroup(chat);
    return;
  }

  /*
   * CHANNELS
   *
   * Completely ignore.
   */
  if (chat.type === "channel") {
    return;
  }

  /*
   * SUPPORT ONLY WORKS IN PRIVATE CHATS.
   */
  if (chat.type !== "private") {
    return;
  }

  const senderId = Number(message.from.id);

  /* ===================================================
     /start
  =================================================== */

  if (
    message.text &&
    /^\/start(?:@\w+)?$/i.test(
      message.text.trim()
    )
  ) {
    await handleStart(message);
    return;
  }

  /* ===================================================
     /botstats
  =================================================== */

  if (
    message.text &&
    /^\/botstats(?:@\w+)?$/i.test(
      message.text.trim()
    )
  ) {
    await handleBotStats(message);
    return;
  }

  /* ===================================================
     /broadcast
  =================================================== */

  if (
    message.text &&
    /^\/broadcast(?:@\w+)?(?:\s|$)/i.test(
      message.text
    )
  ) {
    await handleBroadcast(message);
    return;
  }

  /* ===================================================
     ADMIN REPLY TO USER MESSAGE
  =================================================== */

  /*
   * Admin must reply to the actual forwarded
   * user message.
   *
   * The database finds:
   *
   * forwarded_message_id
   *          ↓
   *       user_id
   *
   * Therefore multiple users/messages cannot
   * get mixed together.
   */
  if (
    isAdmin(senderId) &&
    message.reply_to_message
  ) {
    const handled =
      await handleAdminReply(message);

    if (handled) {
      return;
    }
  }

  /* ===================================================
     ADMIN NORMAL MESSAGE
  =================================================== */

  /*
   * Don't treat an admin's ordinary private
   * message as a support request.
   */
  if (isAdmin(senderId)) {
    return;
  }

  /* ===================================================
     USER MESSAGE
  =================================================== */

  /*
   * Every private user message is forwarded
   * individually to every admin.
   *
   * Native forwardMessage is used inside
   * forwardUserMessage(), preserving custom
   * emojis and Telegram entities.
   */
  await forwardUserMessage(message);
}


/* =====================================================
   VERCEL WEBHOOK HANDLER
===================================================== */

export default async function handler(req, res) {
  try {

    /*
     * GET
     *
     * Used to test whether the webhook endpoint
     * is alive.
     */
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true
      });
    }

    /*
     * Telegram uses POST requests.
     */
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true
      });
    }

    /*
     * Process Telegram update.
     */
    await processUpdate(req.body);

    /*
     * Telegram expects a successful response.
     */
    return res.status(200).json({
      ok: true
    });

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );

    /*
     * Return HTTP 200 so Telegram does not
     * repeatedly retry the same update.
     */
    return res.status(200).json({
      ok: true
    });
  }
}
