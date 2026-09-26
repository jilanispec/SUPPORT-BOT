const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID || 2079655933);

const ADMIN_IDS = (process.env.ADMIN_IDS || "2079655933,7598304720")
  .split(",")
  .map(x => Number(x.trim()))
  .filter(Boolean);

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

globalThis.supportBotState ??= {
  users: new Map(),
  groups: new Map(),
  messages: 0,
  adminReplies: 0,
  broadcasts: 0,
  broadcastSent: 0,
  broadcastFailed: 0,
  userMessageMap: new Map()
};

const state = globalThis.supportBotState;

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await r.json();

  if (!json.ok) {
    console.error(`Telegram ${method} failed:`, json);
  }

  return json;
}

function isAdmin(id) {
  return ADMIN_IDS.includes(Number(id));
}

function userName(user) {
  return (
    user?.username ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    String(user?.id || "Unknown")
  );
}

function adminDisplay(user) {
  return (
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    String(user?.id || "Admin")
  );
}

function rememberUser(user) {
  if (!user?.id) return;
  state.users.set(Number(user.id), {
    user_id: Number(user.id),
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null
  });
}

function rememberChat(chat) {
  if (!chat || !["group", "supergroup"].includes(chat.type)) return;
  state.groups.set(Number(chat.id), {
    chat_id: Number(chat.id),
    type: chat.type,
    title: chat.title || ""
  });
}

async function sendWelcome(message) {
  const userId = Number(message.from.id);
  const firstName = message.from.first_name || "there";
  const existing = state.users.has(userId);

  if (!existing) {
    rememberUser(message.from);

    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text:
`🌍 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐉𝐈𝐋𝐀𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 𝐁𝐎𝐓

👋 𝐇𝐞𝐥𝐥𝐨, ${firstName}

📩 𝐍𝐞𝐞𝐝 𝐡𝐞𝐥𝐩? 𝐒𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐜𝐨𝐦𝐩𝐥𝐞𝐭𝐞 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐫𝐞𝐪𝐮𝐞𝐬𝐭 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

📝 𝐏𝐥𝐞𝐚𝐬𝐞 𝐢𝐧𝐜𝐥𝐮𝐝𝐞 𝐚𝐥𝐥 𝐢𝐦𝐩𝐨𝐫𝐭𝐚𝐧𝐭 𝐝𝐞𝐭𝐚𝐢𝐥𝐬 𝐢𝐧 𝐨𝐧𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐬𝐨 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐜𝐚𝐧 𝐮𝐧𝐝𝐞𝐫𝐬𝐭𝐚𝐧𝐝 𝐚𝐧𝐝 𝐡𝐞𝐥𝐩 𝐲𝐨𝐮 𝐟𝐚𝐬𝐭𝐞𝐫.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.

━━━━━━━━━━━━━━━━━━
🛡️ 𝐘𝐨𝐮𝐫 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐢𝐬 𝐡𝐚𝐧𝐝𝐥𝐞𝐝 𝐛𝐲 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦.`
    });
  } else {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text:
`👋 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐚𝐧 𝐞𝐱𝐢𝐬𝐭𝐢𝐧𝐠 𝐮𝐬𝐞𝐫.

📩 𝐏𝐥𝐞𝐚𝐬𝐞 𝐬𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐪𝐮𝐞𝐫𝐲 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.`
    });
  }
}

async function sendSupportHeader(adminId, user) {
  const profileUrl = user.username
    ? `https://t.me/${user.username}`
    : `tg://user?id=${user.id}`;

  return telegram("sendMessage", {
    chat_id: adminId,
    text:
`👆 Message sent by ${userName(user)} [${user.id}] #id${user.id}
👉 To answer, reply to this message.`,
    reply_markup: {
      inline_keyboard: [[
        { text: "👤 User Profile", url: profileUrl }
      ]]
    }
  });
}

async function forwardUserMessage(message) {
  for (const adminId of ADMIN_IDS) {
    try {
      // The actual user message is sent first.
      const forwarded = await telegram("forwardMessage", {
        chat_id: adminId,
        from_chat_id: message.chat.id,
        message_id: message.message_id
      });

      // Then the support header is sent after it and replies to the
      // forwarded user message, so the admin replies directly to the
      // actual message.
      if (forwarded.ok) {
        await telegram("sendMessage", {
          chat_id: adminId,
          text:
`👆 Message sent by ${userName(message.from)} [${message.from.id}] #id${message.from.id}
👉 To answer, reply to this message.`,
          reply_to_message_id: forwarded.result.message_id,
          reply_markup: {
            inline_keyboard: [[
              {
                text: "👤 User Profile",
                url: message.from.username
                  ? `https://t.me/${message.from.username}`
                  : `tg://user?id=${message.from.id}`
              }
            ]]
          }
        });

        state.userMessageMap.set(
          `${adminId}:${forwarded.result.message_id}`,
          Number(message.from.id)
        );
      }
    } catch (e) {
      console.error("User forward error:", e);
    }
  }
}

async function handleAdminReply(message) {
  const replied = message.reply_to_message;
  if (!replied) return false;

  const key = `${message.chat.id}:${replied.message_id}`;
  let userId = state.userMessageMap.get(key);

  // Fallback for forwarded messages delivered by Telegram.
  if (!userId) {
    const origin = replied.forward_origin;
    if (origin?.type === "user" && origin.sender_user?.id) {
      userId = Number(origin.sender_user.id);
    }
  }

  if (!userId) return false;

  const result = await telegram("copyMessage", {
    chat_id: userId,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  });

  if (!result.ok) return false;

  state.adminReplies++;

  // Tell every other admin who responded.
  for (const adminId of ADMIN_IDS) {
    try {
      await telegram("sendMessage", {
        chat_id: adminId,
        text:
`👨‍💻 Replied by ${adminDisplay(message.from)} [${message.from.id}]`
      });
    } catch (e) {
      console.error("Reply notification error:", e);
    }
  }

  return true;
}

async function sendBotStats(message) {
  if (!isAdmin(message.from.id)) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "❌ You are not authorized to use this command."
    });
    return;
  }

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text:
`📊 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐒

👤 Users: ${state.users.size}
👥 Groups: ${state.groups.size}

📨 Messages received: ${state.messages}
💬 Admin replies: ${state.adminReplies}

📢 Broadcasts: ${state.broadcasts}
📤 Broadcast messages sent: ${state.broadcastSent}
❌ Broadcast failures: ${state.broadcastFailed}

👨‍💻 Admins: ${ADMIN_IDS.length}`
  });
}

async function broadcast(message) {
  if (!isAdmin(message.from.id)) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "❌ You are not the owner of this bot."
    });
    return;
  }

  let success = 0;
  let failed = 0;
  let groupSent = 0;

  const reply = message.reply_to_message;

  // Reply broadcast
  if (reply) {
    for (const user of state.users.values()) {
      try {
        const r = await telegram("forwardMessage", {
          chat_id: user.user_id,
          from_chat_id: reply.chat.id,
          message_id: reply.message_id
        });
        if (r.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    for (const chat of state.groups.values()) {
      try {
        const r = await telegram("forwardMessage", {
          chat_id: chat.chat_id,
          from_chat_id: reply.chat.id,
          message_id: reply.message_id
        });
        if (r.ok) groupSent++;
        else failed++;
      } catch {
        failed++;
      }
    }
  } else {
    const args = (message.text || "").split(/\s+/).slice(1).join(" ").trim();

    if (!args) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text:
`Usage:

/broadcast Message

OR

Reply to any message with /broadcast`
      });
      return;
    }

    for (const user of state.users.values()) {
      try {
        const r = await telegram("sendMessage", {
          chat_id: user.user_id,
          text: args
        });
        if (r.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    for (const chat of state.groups.values()) {
      try {
        const r = await telegram("sendMessage", {
          chat_id: chat.chat_id,
          text: args
        });
        if (r.ok) groupSent++;
        else failed++;
      } catch {
        failed++;
      }
    }
  }

  state.broadcasts++;
  state.broadcastSent += success + groupSent;
  state.broadcastFailed += failed;

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text:
`📢 𝐁𝐫𝐨𝐚𝐝𝐜𝐚𝐬𝐭 𝐂𝐨𝐦𝐩𝐥𝐞𝐭𝐞𝐝

👤 Users : ${success}
👥 Groups : ${groupSent}
❌ Failed : ${failed}`
  });
}

async function processUpdate(update) {
  // Register group chats for broadcasts, but NEVER process their messages.
  if (update.message?.chat) {
    rememberChat(update.message.chat);

    if (["group", "supergroup"].includes(update.message.chat.type)) {
      return;
    }
  }

  const message = update.message;
  if (!message || message.chat.type !== "private" || !message.from) return;

  const userId = Number(message.from.id);

  // Admin commands/replies
  if (isAdmin(userId)) {
    if (message.text === "/start") {
      await sendWelcome(message);
      return;
    }

    if (message.text === "/botstats") {
      await sendBotStats(message);
      return;
    }

    if (message.text === "/broadcast" || message.text?.startsWith("/broadcast ")) {
      await broadcast(message);
      return;
    }

    if (message.reply_to_message) {
      const replied = await handleAdminReply(message);
      if (replied) return;
    }

    return;
  }

  // Normal user
  const isNew = !state.users.has(userId);
  rememberUser(message.from);

  if (message.text === "/start") {
    // sendWelcome needs to know if it was new; because we remembered above,
    // handle it here explicitly.
    if (isNew) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text:
`🌍 𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐉𝐈𝐋𝐀𝐍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 𝐁𝐎𝐓

👋 𝐇𝐞𝐥𝐥𝐨, ${message.from.first_name || "there"}

📩 𝐍𝐞𝐞𝐝 𝐡𝐞𝐥𝐩? 𝐒𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐜𝐨𝐦𝐩𝐥𝐞𝐭𝐞 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐫𝐞𝐪𝐮𝐞𝐬𝐭 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

📝 𝐏𝐥𝐞𝐚𝐬𝐞 𝐢𝐧𝐜𝐥𝐮𝐝𝐞 𝐚𝐥𝐥 𝐢𝐦𝐩𝐨𝐫𝐭𝐚𝐧𝐭 𝐝𝐞𝐭𝐚𝐢𝐥𝐬 𝐢𝐧 𝐨𝐧𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐬𝐨 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐜𝐚𝐧 𝐮𝐧𝐝𝐞𝐫𝐬𝐭𝐚𝐧𝐝 𝐚𝐧𝐝 𝐡𝐞𝐥𝐩 𝐲𝐨𝐮 𝐟𝐚𝐬𝐭𝐞𝐫.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.

━━━━━━━━━━━━━━━━━━
🛡️ 𝐘𝐨𝐮𝐫 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐢𝐬 𝐡𝐚𝐧𝐝𝐥𝐞𝐝 𝐛𝐲 𝐨𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦.`
      });
    } else {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text:
`👋 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐚𝐧 𝐞𝐱𝐢𝐬𝐭𝐢𝐧𝐠 𝐮𝐬𝐞𝐫.

📩 𝐏𝐥𝐞𝐚𝐬𝐞 𝐬𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐪𝐮𝐞𝐫𝐲 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.`
      });
    }
    return;
  }

  state.messages++;

  // Every private DM is forwarded, including multiple separate messages.
  await forwardUserMessage(message);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "Support bot webhook is running."
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
    }

    await processUpdate(req.body);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    return res.status(200).json({ ok: false });
  }
}
