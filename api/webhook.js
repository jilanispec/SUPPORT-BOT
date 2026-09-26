const BOT_TOKEN = process.env.BOT_TOKEN;

const OWNER_ID = Number(process.env.OWNER_ID || 2079655933);

const ADMIN_IDS = (process.env.ADMIN_IDS || "2079655933,7598304720")
  .split(",")
  .map(id => Number(id.trim()))
  .filter(Boolean);

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;


// ======================================================
// TEMPORARY STORAGE
// ======================================================
// NOTE:
// Vercel can restart serverless instances, so this data
// can reset. After testing everything, we can connect a
// persistent database without changing the bot's UI.
// ======================================================

globalThis.supportBotState ??= {
  users: new Map(),
  groups: new Map(),

  messages: 0,
  adminReplies: 0,

  broadcasts: 0,
  broadcastSent: 0,
  broadcastFailed: 0,

  // adminChatId:forwardedMessageId -> original user ID
  messageMap: new Map()
};

const state = globalThis.supportBotState;


// ======================================================
// TELEGRAM API
// ======================================================

async function telegram(method, data = {}) {

  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN environment variable is missing");
  }

  const response = await fetch(`${API}/${method}`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!result.ok) {
    console.error(`Telegram ${method} error:`, result);
  }

  return result;
}


// ======================================================
// HELPERS
// ======================================================

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}


function getUserName(user) {

  if (user?.username) {
    return user.username;
  }

  const fullName = [
    user?.first_name,
    user?.last_name
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || String(user?.id || "Unknown");
}


function getAdminName(user) {

  const fullName = [
    user?.first_name,
    user?.last_name
  ]
    .filter(Boolean)
    .join(" ");

  return (
    fullName ||
    user?.username ||
    String(user?.id || "Admin")
  );
}


function saveUser(user) {

  if (!user?.id) {
    return;
  }

  state.users.set(Number(user.id), {
    user_id: Number(user.id),

    username:
      user.username || null,

    first_name:
      user.first_name || null,

    last_name:
      user.last_name || null
  });
}


function saveGroup(chat) {

  if (!chat) {
    return;
  }

  if (
    chat.type !== "group" &&
    chat.type !== "supergroup"
  ) {
    return;
  }

  state.groups.set(Number(chat.id), {
    chat_id: Number(chat.id),

    type: chat.type,

    title:
      chat.title || ""
  });
}


// ======================================================
// /START
// ======================================================

async function handleStart(message, isNewUser) {

  const firstName =
    message.from.first_name || "there";


  // ==============================
  // NEW USER
  // ==============================

  if (isNewUser) {

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

    return;
  }


  // ==============================
  // EXISTING USER
  // ==============================

  await telegram("sendMessage", {

    chat_id: message.chat.id,

    text:
`👋 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐚𝐥𝐫𝐞𝐚𝐝𝐲 𝐚𝐧 𝐞𝐱𝐢𝐬𝐭𝐢𝐧𝐠 𝐮𝐬𝐞𝐫.

📩 𝐏𝐥𝐞𝐚𝐬𝐞 𝐬𝐞𝐧𝐝 𝐲𝐨𝐮𝐫 𝐪𝐮𝐞𝐫𝐲 𝐢𝐧 𝐚 𝐬𝐢𝐧𝐠𝐥𝐞 𝐦𝐞𝐬𝐬𝐚𝐠𝐞.

⏳ 𝐎𝐮𝐫 𝐬𝐮𝐩𝐩𝐨𝐫𝐭 𝐭𝐞𝐚𝐦 𝐰𝐢𝐥𝐥 𝐫𝐞𝐩𝐥𝐲 𝐡𝐞𝐫𝐞.`
  });
}


// ======================================================
// USER MESSAGE -> ALL ADMINS
// ======================================================

async function forwardUserMessage(message) {

  const user = message.from;


  for (const adminId of ADMIN_IDS) {

    try {

      // ==========================================
      // FIRST:
      // Send/forward the actual user's message
      // ==========================================

      const forwarded =
        await telegram("forwardMessage", {

          chat_id: adminId,

          from_chat_id:
            message.chat.id,

          message_id:
            message.message_id
        });


      if (!forwarded.ok) {
        continue;
      }


      const forwardedMessageId =
        forwarded.result.message_id;


      // ==========================================
      // Save mapping for admin replies
      // ==========================================

      state.messageMap.set(
        `${adminId}:${forwardedMessageId}`,
        Number(user.id)
      );


      // ==========================================
      // PROFILE URL
      // ==========================================

      const profileUrl =
        user.username
          ? `https://t.me/${user.username}`
          : `tg://user?id=${user.id}`;


      // ==========================================
      // SECOND:
      // Send support information UNDER the
      // actual forwarded message.
      //
      // It replies to the forwarded message,
      // visually connecting them.
      // ==========================================

      await telegram("sendMessage", {

        chat_id: adminId,

        reply_to_message_id:
          forwardedMessageId,

        text:
`👆 Message sent by ${getUserName(user)} [${user.id}] #id${user.id}
👉 To answer, reply to this message.`,

        reply_markup: {

          inline_keyboard: [

            [
              {
                text:
                  "👤 User Profile",

                url:
                  profileUrl
              }
            ]

          ]
        }
      });

    }

    catch (error) {

      console.error(
        "FORWARD ERROR:",
        error
      );

    }
  }
}


// ======================================================
// ADMIN REPLY -> USER
// ======================================================

async function handleAdminReply(message) {

  const repliedMessage =
    message.reply_to_message;


  if (!repliedMessage) {
    return false;
  }


  // ==========================================
  // TRY OUR SAVED MAPPING FIRST
  // ==========================================

  const mapKey =
    `${message.chat.id}:${repliedMessage.message_id}`;


  let userId =
    state.messageMap.get(mapKey);


  // ==========================================
  // FALLBACK:
  // Telegram forwarded origin
  // ==========================================

  if (!userId) {

    const origin =
      repliedMessage.forward_origin;


    if (
      origin?.type === "user" &&
      origin?.sender_user?.id
    ) {

      userId =
        Number(
          origin.sender_user.id
        );
    }
  }


  if (!userId) {
    return false;
  }


  // ==========================================
  // SEND ADMIN'S ACTUAL REPLY TO USER
  // ==========================================

  const result =
    await telegram("copyMessage", {

      chat_id: userId,

      from_chat_id:
        message.chat.id,

      message_id:
        message.message_id
    });


  if (!result.ok) {
    return false;
  }


  state.adminReplies++;


  // ==========================================
  // SHOW ALL ADMINS WHO REPLIED
  // ==========================================

  const repliedBy =
    `👨‍💻 Replied by ${getAdminName(message.from)} [${message.from.id}]`;


  for (const adminId of ADMIN_IDS) {

    try {

      await telegram("sendMessage", {

        chat_id: adminId,

        text:
          repliedBy
      });

    }

    catch (error) {

      console.error(
        "ADMIN RESPONSE NOTIFICATION ERROR:",
        error
      );

    }
  }


  return true;
}


// ======================================================
// /BOTSTATS
// ======================================================

async function handleBotStats(message) {

  // ==============================
  // ADMIN ONLY
  // ==============================

  if (!isAdmin(message.from.id)) {

    await telegram("sendMessage", {

      chat_id:
        message.chat.id,

      text:
        "❌ You are not authorized to use this command."
    });

    return;
  }


  await telegram("sendMessage", {

    chat_id:
      message.chat.id,

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


// ======================================================
// /BROADCAST
// ======================================================

async function handleBroadcast(message) {

  // ==============================
  // ADMIN ONLY
  // ==============================

  if (!isAdmin(message.from.id)) {

    await telegram("sendMessage", {

      chat_id:
        message.chat.id,

      text:
        "❌ You are not the owner of this bot."
    });

    return;
  }


  let success = 0;

  let failed = 0;

  let groupSent = 0;


  // ==================================================
  // REPLY BROADCAST
  // ==================================================

  if (message.reply_to_message) {

    const source =
      message.reply_to_message;


    // ==============================
    // USERS
    // ==============================

    for (
      const user
      of state.users.values()
    ) {

      try {

        const result =
          await telegram(
            "forwardMessage",
            {

              chat_id:
                user.user_id,

              from_chat_id:
                source.chat.id,

              message_id:
                source.message_id
            }
          );


        if (result.ok) {

          success++;

        } else {

          failed++;

        }

      }

      catch (error) {

        console.error(
          "USER BROADCAST ERROR:",
          error
        );

        failed++;
      }
    }


    // ==============================
    // GROUPS
    // ==============================

    for (
      const chat
      of state.groups.values()
    ) {

      try {

        const result =
          await telegram(
            "forwardMessage",
            {

              chat_id:
                chat.chat_id,

              from_chat_id:
                source.chat.id,

              message_id:
                source.message_id
            }
          );


        if (result.ok) {

          groupSent++;

        } else {

          failed++;

        }

      }

      catch (error) {

        console.error(
          "GROUP BROADCAST ERROR:",
          error
        );

        failed++;
      }
    }

  }


  // ==================================================
  // TEXT BROADCAST
  // ==================================================

  else {

    const text =
      (message.text || "")
        .split(/\s+/)
        .slice(1)
        .join(" ")
        .trim();


    if (!text) {

      await telegram(
        "sendMessage",
        {

          chat_id:
            message.chat.id,

          text:
`Usage:

/broadcast Message

OR

Reply to any message with /broadcast`
        }
      );

      return;
    }


    // ==============================
    // USERS
    // ==============================

    for (
      const user
      of state.users.values()
    ) {

      try {

        const result =
          await telegram(
            "sendMessage",
            {

              chat_id:
                user.user_id,

              text:
                text
            }
          );


        if (result.ok) {

          success++;

        } else {

          failed++;

        }

      }

      catch (error) {

        console.error(
          "USER BROADCAST ERROR:",
          error
        );

        failed++;
      }
    }


    // ==============================
    // GROUPS
    // ==============================

    for (
      const chat
      of state.groups.values()
    ) {

      try {

        const result =
          await telegram(
            "sendMessage",
            {

              chat_id:
                chat.chat_id,

              text:
                text
            }
          );


        if (result.ok) {

          groupSent++;

        } else {

          failed++;

        }

      }

      catch (error) {

        console.error(
          "GROUP BROADCAST ERROR:",
          error
        );

        failed++;
      }
    }
  }


  // ==================================================
  // SAVE BROADCAST STATS
  // ==================================================

  state.broadcasts++;

  state.broadcastSent +=
    success + groupSent;

  state.broadcastFailed +=
    failed;


  // ==================================================
  // RESULT
  // ==================================================

  await telegram(
    "sendMessage",
    {

      chat_id:
        message.chat.id,

      text:
`📢 𝐁𝐫𝐨𝐚𝐝𝐜𝐚𝐬𝐭 𝐂𝐨𝐦𝐩𝐥𝐞𝐭𝐞𝐝

👤 Users : ${success}
👥 Groups : ${groupSent}
❌ Failed : ${failed}`
    }
  );
}


// ======================================================
// PROCESS TELEGRAM UPDATE
// ======================================================

async function processUpdate(update) {

  const message =
    update.message;


  if (!message) {
    return;
  }


  // ==================================================
  // GROUP / SUPERGROUP
  // ==================================================
  //
  // Save group for broadcasts.
  //
  // IMPORTANT:
  // NOTHING FROM GROUPS IS FORWARDED TO ADMINS.
  //
  // ==================================================

  if (
    message.chat.type === "group" ||
    message.chat.type === "supergroup"
  ) {

    saveGroup(
      message.chat
    );

    return;
  }


  // ==================================================
  // CHANNELS / OTHER TYPES
  // ==================================================

  if (
    message.chat.type !== "private"
  ) {

    return;
  }


  if (!message.from) {
    return;
  }


  const userId =
    Number(message.from.id);


  // ==================================================
  // ADMIN
  // ==================================================

  if (isAdmin(userId)) {


    // ==============================
    // /START
    // ==============================

    if (
      message.text === "/start"
    ) {

      const isNew =
        !state.users.has(userId);

      saveUser(
        message.from
      );

      await handleStart(
        message,
        isNew
      );

      return;
    }


    // ==============================
    // /BOTSTATS
    // ==============================

    if (
      message.text === "/botstats"
    ) {

      await handleBotStats(
        message
      );

      return;
    }


    // ==============================
    // /BROADCAST
    // ==============================

    if (
      message.text === "/broadcast" ||
      message.text?.startsWith(
        "/broadcast "
      )
    ) {

      await handleBroadcast(
        message
      );

      return;
    }


    // ==============================
    // ADMIN REPLY
    // ==============================

    if (
      message.reply_to_message
    ) {

      const handled =
        await handleAdminReply(
          message
        );


      if (handled) {
        return;
      }
    }


    // Other admin messages ignored.

    return;
  }


  // ==================================================
  // NORMAL USER
  // ==================================================

  const isNewUser =
    !state.users.has(userId);


  saveUser(
    message.from
  );


  // ==============================
  // /START
  // ==============================

  if (
    message.text === "/start"
  ) {

    await handleStart(
      message,
      isNewUser
    );

    return;
  }


  // ==================================================
  // USER SUPPORT MESSAGE
  // ==================================================
  //
  // Every DM is forwarded individually.
  //
  // ==================================================

  state.messages++;


  await forwardUserMessage(
    message
  );
}


// ======================================================
// VERCEL WEBHOOK
// ======================================================

export default async function handler(
  req,
  res
) {

  try {


    // ==================================================
    // BROWSER TEST
    // ==================================================

    if (
      req.method === "GET"
    ) {

      return res
        .status(200)
        .json({

          ok: true,

          message:
            "Support bot webhook is running."
        });
    }


    // ==================================================
    // TELEGRAM ONLY USES POST
    // ==================================================

    if (
      req.method !== "POST"
    ) {

      return res
        .status(405)
        .json({

          ok: false,

          error:
            "Method not allowed"
        });
    }


    // ==================================================
    // PROCESS UPDATE
    // ==================================================

    await processUpdate(
      req.body
    );


    return res
      .status(200)
      .json({

        ok: true
      });

  }

  catch (error) {

    console.error(
      "WEBHOOK ERROR:",
      error
    );


    // Return 200 so Telegram doesn't repeatedly
    // resend a broken update forever.

    return res
      .status(200)
      .json({

        ok: false,

        error:
          error.message
      });
  }
                        }
