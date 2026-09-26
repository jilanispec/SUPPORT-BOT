const BOT_TOKEN = process.env.BOT_TOKEN;

const ADMIN_IDS = [
  2079655933,
  7598304720
];

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

globalThis.supportBotState ??= {
  users: new Set(),
  messages: 0,
  replies: 0
};

const state = globalThis.supportBotState;

async function telegram(method, data = {}) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return await response.json();
}

function isAdmin(id) {
  return ADMIN_IDS.includes(Number(id));
}

function nameOf(user) {
  return (
    user.username ||
    [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Unknown"
  );
}

async function sendUserHeader(adminId, user) {
  const profileUrl = user.username
    ? `https://t.me/${user.username}`
    : `tg://user?id=${user.id}`;

  return telegram("sendMessage", {
    chat_id: adminId,
    text:
      `👆 Message sent by ${nameOf(user)} [${user.id}] #id${user.id}\n` +
      `👉 To answer, reply to the forwarded message.`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "👤 User Profile",
            url: profileUrl
          }
        ]
      ]
    }
  });
}

async function forwardUserMessage(message) {
  for (const adminId of ADMIN_IDS) {
    await sendUserHeader(adminId, message.from);

    await telegram("forwardMessage", {
      chat_id: adminId,
      from_chat_id: message.chat.id,
      message_id: message.message_id
    });
  }
}

async function sendAdminReply(message) {
  const replied = message.reply_to_message;

  if (!replied) {
    return false;
  }

  const origin = replied.forward_origin;

  if (
    !origin ||
    origin.type !== "user" ||
    !origin.sender_user
  ) {
    return false;
  }

  const userId = origin.sender_user.id;

  const result = await telegram("copyMessage", {
    chat_id: userId,
    from_chat_id: message.chat.id,
    message_id: message.message_id
  });

  if (!result.ok) {
    console.error("copyMessage failed:", result);
    return false;
  }

  state.replies++;

  // Tell the other admins who replied.
  for (const adminId of ADMIN_IDS) {
    if (Number(adminId) === Number(message.from.id)) {
      continue;
    }

    await telegram("sendMessage", {
      chat_id: adminId,
      text:
        `👨‍💻 Admin responded\n\n` +
        `Admin: ${nameOf(message.from)} [${message.from.id}]\n` +
        `User: #id${userId}`
    });
  }

  return true;
}

async function botStats(message) {
  if (!isAdmin(message.from.id)) {
    return;
  }

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text:
      `📊 Bot Stats\n\n` +
      `👥 Users: ${state.users.size}\n` +
      `📨 Messages: ${state.messages}\n` +
      `💬 Replies: ${state.replies}\n` +
      `👨‍💻 Admins: ${ADMIN_IDS.length}`
  });
}

async function broadcast(message) {
  if (!isAdmin(message.from.id)) {
    return;
  }

  if (!message.reply_to_message) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text:
        `📢 Broadcast\n\n` +
        `Reply to the message you want to broadcast, then send /broadcast.`
    });

    return;
  }

  let sent = 0;
  let failed = 0;

  for (const userId of state.users) {
    const result = await telegram("copyMessage", {
      chat_id: userId,
      from_chat_id: message.chat.id,
      message_id: message.reply_to_message.message_id
    });

    if (result.ok) {
      sent++;
    } else {
      failed++;
    }
  }

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text:
      `📢 Broadcast complete\n\n` +
      `✅ Sent: ${sent}\n` +
      `❌ Failed: ${failed}`
  });
}

async function processUpdate(update) {
  const message = update.message;

  if (!message) {
    return;
  }

  // IMPORTANT:
  // Only private DM messages are processed.
  // Groups/supergroups/channels are ignored.
  if (message.chat.type !== "private") {
    return;
  }

  if (!message.from) {
    return;
  }

  const userId = Number(message.from.id);

  // ADMIN
  if (isAdmin(userId)) {
    if (message.text === "/botstats") {
      await botStats(message);
      return;
    }

    if (message.text === "/broadcast") {
      await broadcast(message);
      return;
    }

    if (message.reply_to_message) {
      await sendAdminReply(message);
    }

    return;
  }

  // USER
  state.users.add(userId);
  state.messages++;

  if (message.text?.startsWith("/")) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "👋 Please send your support message."
    });

    return;
  }

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
      return res.status(405).json({
        ok: false,
        error: "Method not allowed"
      });
    }

    const update = req.body;

    console.log(
      "Telegram update received:",
      JSON.stringify(update)
    );

    await processUpdate(update);

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
    }
