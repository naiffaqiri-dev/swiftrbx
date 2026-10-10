/**
 * SwiftRBX Discord ticket bot.
 * Handles linked-account checks, Robux offer selection, private ticket channels,
 * service tickets, participant confirmations, ticket closure, and restart recovery.
 */

require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType,
} = require("discord.js");
const crypto = require("node:crypto");

// صورة بانر اللوحة - لازم يكون ملف banner.jpg موجود بنفس مجلد index.js
const PANEL_BANNER_PATH = path.join(__dirname, "banner.jpg");
const PANEL_BANNER_FILENAME = "banner.jpg";

// ----------------------------------------------------------------------
// الإعدادات من ملف .env
// ----------------------------------------------------------------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const PANEL_CHANNEL_ID = (process.env.PANEL_CHANNEL_ID || "").trim();
const SITE_URL = (process.env.SITE_URL || "https://www.swiftrbx.site").replace(/\/+$/, "");
const SUPPORT_ROLE_ID = (process.env.SUPPORT_ROLE_ID || "").trim();
const SALER_ROLE_ID = (process.env.SALER_ROLE_ID || "").trim();
const TICKETS_CATEGORY_ID = (process.env.TICKETS_CATEGORY_ID || "").trim();
const TICKET_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة لتأكيد الطلب والبائع

for (const [name, value] of Object.entries({ DISCORD_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY })) {
  if (!value) {
    throw new Error(`لم يتم العثور على ${name} في ملف .env`);
  }
}

// ----------------------------------------------------------------------
// أنواع التذاكر (أزرار اللوحة)
// ----------------------------------------------------------------------
const PANEL_MARKER = "swiftrbx-panel-v1";

const TICKET_TYPES = {
  robux: { label: "شراء روبكس", emoji: "💰", style: ButtonStyle.Success },
  limiteds: { label: "ليميتد", emoji: "💎", style: ButtonStyle.Primary },
  items: { label: "أغراض المابات", emoji: "🎮", style: ButtonStyle.Primary },
  accounts: { label: "حسابات", emoji: "🛡️", style: ButtonStyle.Primary },
  support: { label: "الدعم والاستفسارات", emoji: "🆘", style: ButtonStyle.Secondary },
};

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🎫 مركز طلبات SwiftRBX")
    .setDescription(
      [
        "اختر نوع طلبك من الأزرار بالأسفل، وتنفتح لك تذكرة خاصة فيك أنت والبائع والدعم.",
        "",
        "💰 **شراء روبكس**",
        "💎 **ليميتد**",
        "🎮 **أغراض المابات**",
        "🛡️ **حسابات روبلوكس**",
        "🆘 **الدعم والاستفسارات** (أي سؤال عام أو مشكلة)",
        "",
        "⚠️ لازم تكون مسجل بالموقع بحساب ديسكورد عشان نربط طلبك بحسابك.",
        "🔒 لا ترسل كلمات المرور أو رموز التحقق داخل التذكرة.",
      ].join("\n")
    )
    .setFooter({ text: PANEL_MARKER });

  if (fs.existsSync(PANEL_BANNER_PATH)) embed.setImage(`attachment://${PANEL_BANNER_FILENAME}`);

  const row = new ActionRowBuilder().addComponents(
    Object.entries(TICKET_TYPES).map(([key, type]) =>
      new ButtonBuilder()
        .setCustomId(`ticket:${key}`)
        .setLabel(type.label)
        .setEmoji(type.emoji)
        .setStyle(type.style)
    )
  );

  const files = fs.existsSync(PANEL_BANNER_PATH)
    ? [new AttachmentBuilder(PANEL_BANNER_PATH, { name: PANEL_BANNER_FILENAME })]
    : [];

  return { embeds: [embed], components: [row], files };
}

// ----------------------------------------------------------------------
// البحث عن حساب الموقع من رقم ديسكورد (عبر الدالة اللي أنشأناها بقاعدة البيانات)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// نصوص ثنائية اللغة لتدفق طلب شراء الروبكس
// ----------------------------------------------------------------------
const DELIVERY_LABELS = {
  gift: { ar: "داخل اللعبة (In-Game Gifting)", en: "In-Game Gifting" },
  gamepass: { ar: "قيم باس (Gamepass)", en: "Gamepass" },
  group: { ar: "قروب (Group Payout)", en: "Group Payout" },
  plus: { ar: "بلس (Plus Transfer)", en: "Plus Transfer" },
};

const T = {
  ar: {
    pickLang: "اختر اللغة:",
    pickDelivery: "اختر نوع التسليم:",
    deliveryPlaceholder: "نوع التسليم",
    modalTitle: "تفاصيل طلب الروبكس",
    usernameLabel: "يوزرنيم روبلوكس",
    quantityLabel: "الكمية المطلوبة (رقم)",
    invalidQuantity: "❌ الكمية لازم تكون رقم صحيح أكبر من صفر.",
    noSellers: (q, d) =>
      `😔 ما لقينا بائع متوفر حالياً لكمية **${q}** بطريقة **${DELIVERY_LABELS[d].ar}**.\nجرّب كمية أو نوع تسليم ثاني، أو راجع صفحة السوق بالموقع.`,
    pickSeller: "اختر البائع:",
    sellerOption: (name, rate, qty) => `${name} — ${rate} ريال/1000 — متوفر: ${qty}`,
    summary: (username, qty, delivery, seller) =>
      `✅ تم اختيار الطلب:\n` +
      `👤 اليوزرنيم: **${username}**\n` +
      `🔢 الكمية: **${qty}**\n` +
      `🚚 نوع التسليم: **${DELIVERY_LABELS[delivery].ar}**\n` +
      `🧑‍💼 البائع: **${seller}**`,
    ticketCreated: (channelMention) => `✅ تم فتح تذكرتك: ${channelMention}`,
    orderEmbedTitle: "📦 تفاصيل الطلب",
    sellerEmbedTitle: "🧑‍💼 بيانات البائع",
    confirmButton: "تأكيد",
    cancelButton: "❌ إلغاء",
    changeSellerButton: "🔄 تغيير البائع",
    confirmed: "✅ تم التأكيد",
    pleaseConfirm: "⚠️ يرجى تأكيد البيانات أعلاه قبل إرسال رسائل بالتذكرة.",
    bothConfirmedNext: "✅ تم تأكيد الطلب. الخطوة الجاية (الدفع) قادمة بالتحديث القادم.",
    onlyBuyerCanConfirm: "⚠️ بس صاحب الطلب يقدر يأكد/يلغي/يغيّر هذا الجزء.",
    cancelled: "❌ تم إلغاء الطلب من طرف المشتري. بتُغلق التذكرة خلال ثواني.",
    pickNewSeller: "اختر البائع الجديد:",
    noSellersForChange: "😔 ما لقينا بائعين ثانيين متوفرين حالياً لنفس الكمية ونوع التسليم.",
    sellerChanged: "✅ تم تغيير البائع، يرجى تأكيد بيانات البائع الجديد.",
    expired: "⏰ انتهت مهلة الـ30 دقيقة بدون تأكيد الطرفين. تم إغلاق التذكرة تلقائياً.",
    dmOpenedTitle: "🎫 تم فتح تذكرة جديدة",
    dmOpenedBody: (id) => `رقم التذكرة: **${id}**\nاضغط الزر بالأسفل للانتقال للتذكرة.`,
    viewTicket: "عرض التذكرة",
    formTitle: (type) => `تذكرة ${TICKET_TYPES[type].label}`,
    detailsLabel: "اشرح طلبك أو المشكلة",
    usernameOptionalLabel: "يوزرنيم روبلوكس (اختياري)",
    submitTicket: "فتح التذكرة",
    ticketCreatedStandard: (channelMention) => `✅ تم فتح تذكرتك: ${channelMention}`,
    ticketEmbedTitle: (type) => `🎫 ${TICKET_TYPES[type].label}`,
    ticketOwner: "صاحب التذكرة",
    closeTicket: "إغلاق التذكرة",
    ticketClosed: "تم إغلاق التذكرة مع الاحتفاظ بسجل المحادثة.",
    onlyTicketStaff: "يمكن لصاحب التذكرة أو فريق الدعم إغلاقها.",
    ticketAlreadyOpen: "لديك تذكرة مفتوحة من هذا النوع بالفعل.",
    onlyPartyCanConfirm: "تأكيد الطلب للمشتري، وتأكيد بيانات البائع للبائع فقط.",
  },
  en: {
    pickLang: "Choose language:",
    pickDelivery: "Choose delivery type:",
    deliveryPlaceholder: "Delivery type",
    modalTitle: "Robux Order Details",
    usernameLabel: "Roblox Username",
    quantityLabel: "Quantity (number)",
    invalidQuantity: "❌ Quantity must be a whole number greater than zero.",
    noSellers: (q, d) =>
      `😔 No seller currently available for **${q}** via **${DELIVERY_LABELS[d].en}**.\nTry a different quantity or delivery type, or check the market page.`,
    pickSeller: "Choose a seller:",
    sellerOption: (name, rate, qty) => `${name} — ${rate} SAR/1000 — available: ${qty}`,
    summary: (username, qty, delivery, seller) =>
      `✅ Order selected:\n` +
      `👤 Username: **${username}**\n` +
      `🔢 Quantity: **${qty}**\n` +
      `🚚 Delivery: **${DELIVERY_LABELS[delivery].en}**\n` +
      `🧑‍💼 Seller: **${seller}**`,
    ticketCreated: (channelMention) => `✅ Your ticket is open: ${channelMention}`,
    orderEmbedTitle: "📦 Order Details",
    sellerEmbedTitle: "🧑‍💼 Seller Info",
    confirmButton: "Confirm",
    cancelButton: "❌ Cancel",
    changeSellerButton: "🔄 Change Seller",
    confirmed: "✅ Confirmed",
    pleaseConfirm: "⚠️ Please confirm the info above before sending messages in this ticket.",
    bothConfirmedNext: "✅ Order confirmed. Payment step is coming in the next update.",
    onlyBuyerCanConfirm: "⚠️ Only the buyer can confirm/cancel/change this part.",
    cancelled: "❌ Order cancelled by the buyer. This ticket will close in a few seconds.",
    pickNewSeller: "Choose a new seller:",
    noSellersForChange: "😔 No other sellers currently available for the same quantity and delivery type.",
    sellerChanged: "✅ Seller changed, please confirm the new seller's info.",
    expired: "⏰ The 30-minute window expired without both confirmations. Ticket closed automatically.",
    dmOpenedTitle: "🎫 New ticket opened",
    dmOpenedBody: (id) => `Ticket ID: **${id}**\nClick the button below to jump to the ticket.`,
    viewTicket: "View Ticket",
    formTitle: (type) => `${TICKET_TYPES[type].label} ticket`,
    detailsLabel: "Describe your request or issue",
    usernameOptionalLabel: "Roblox username (optional)",
    submitTicket: "Open ticket",
    ticketCreatedStandard: (channelMention) => `✅ Your ticket is open: ${channelMention}`,
    ticketEmbedTitle: (type) => `🎫 ${TICKET_TYPES[type].label}`,
    ticketOwner: "Ticket owner",
    closeTicket: "Close ticket",
    ticketClosed: "The ticket is closed and the conversation is preserved.",
    onlyTicketStaff: "Only the ticket owner or support staff can close it.",
    ticketAlreadyOpen: "You already have an open ticket of this type.",
    onlyPartyCanConfirm: "The buyer confirms the order, and the seller confirms their details.",
  },
};

function generateTicketId() {
  return crypto.randomBytes(5).toString("base64url").slice(0, 7);
}

const TICKET_TOPIC_MARKER = "swiftrbx-ticket-v1:";

function encodeTicketTopic(ticket) {
  const persisted = {
    id: ticket.id,
    kind: ticket.kind,
    lang: ticket.lang,
    buyerId: ticket.buyerId,
    sellerDiscordId: ticket.sellerDiscordId || null,
    sellerProfileId: ticket.sellerProfileId || null,
    offerId: ticket.offerId || null,
    username: ticket.username || null,
    quantity: ticket.quantity || null,
    deliveryType: ticket.deliveryType || null,
    rate: ticket.rate || null,
    orderConfirmed: !!ticket.orderConfirmed,
    sellerConfirmed: !!ticket.sellerConfirmed,
    createdAt: ticket.createdAt,
  };
  const topic = `${TICKET_TOPIC_MARKER}${Buffer.from(JSON.stringify(persisted)).toString("base64url")}`;
  if (topic.length > 1024) throw new Error("Ticket metadata exceeds Discord topic limit");
  return topic;
}

function decodeTicketTopic(topic) {
  if (!topic?.startsWith(TICKET_TOPIC_MARKER)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(topic.slice(TICKET_TOPIC_MARKER.length), "base64url").toString("utf8"));
    if (!ticket.id || !ticket.buyerId || !["robux", "limiteds", "items", "accounts", "support"].includes(ticket.kind)) return null;
    if (ticket.kind === "robux" && (!ticket.sellerDiscordId || !DELIVERY_LABELS[ticket.deliveryType])) return null;
    return ticket;
  } catch {
    return null;
  }
}

async function persistTicket(channel, ticket) {
  await channel.setTopic(encodeTicketTopic(ticket));
}

// حالة التذاكر المفتوحة بالذاكرة: channelId -> { ... }
const activeTickets = new Map();
const pendingOrders = new Map();
const openingTickets = new Set();
const MAX_ORDER_QUANTITY = 9_999_999_999;
const MAX_OPEN_TICKETS_PER_USER = 3;

function isValidRobloxUsername(value) {
  return /^[A-Za-z0-9_]{3,20}$/.test(value);
}

function hasSupportAccess(interaction) {
  const memberRoles = interaction.member?.roles;
  const hasRole = (roleId) => !!(
    roleId && (memberRoles?.cache?.has(roleId) || memberRoles?.includes?.(roleId))
  );
  return !!(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    hasRole(SUPPORT_ROLE_ID) ||
    hasRole(SALER_ROLE_ID)
  );
}

function ticketLimitMessage(lang) {
  return lang === "ar"
    ? `لديك بالفعل ${MAX_OPEN_TICKETS_PER_USER} تذاكر مفتوحة كحد أقصى.`
    : `You can have up to ${MAX_OPEN_TICKETS_PER_USER} open tickets at a time.`;
}

async function searchOffers(deliveryType, quantity, excludeProfileId) {
  const url = `${SUPABASE_URL}/rest/v1/offers`;
  const params = new URLSearchParams({
    select: "id,seller_id,rate,available,min_amount,max_amount,profiles(username,display_name,active)",
    delivery_type: `eq.${deliveryType}`,
    active: "eq.true",
    available: `gte.${quantity}`,
    min_amount: `lte.${quantity}`,
    max_amount: `gte.${quantity}`,
    order: "rate.asc",
    limit: "25",
  });
  if (excludeProfileId) params.set("seller_id", `neq.${excludeProfileId}`);
  const res = await fetch(`${url}?${params.toString()}`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase request failed (${res.status})`);
  const offers = await res.json();
  return Array.isArray(offers) ? offers.filter((offer) => offer.profiles && offer.profiles.active !== false) : [];
}

async function getDiscordIdByProfileId(profileId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_discord_id_by_profile_id`, {
    method: "POST",
    headers: { apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: profileId }),
  });
  if (!res.ok) throw new Error(`Supabase request failed (${res.status})`);
  const result = await res.json();
  return result || null;
}

function buildTicketEmbeds(ticket) {
  const lang = ticket.lang;
  const orderEmbed = new EmbedBuilder()
    .setColor(ticket.orderConfirmed ? 0x22c55e : 0x2b2d31)
    .setTitle(T[lang].orderEmbedTitle)
    .addFields(
      { name: lang === "ar" ? "اليوزرنيم" : "Username", value: ticket.username, inline: true },
      { name: lang === "ar" ? "الكمية" : "Quantity", value: String(ticket.quantity), inline: true },
      { name: lang === "ar" ? "نوع التسليم" : "Delivery", value: DELIVERY_LABELS[ticket.deliveryType][lang], inline: true }
    );
  if (ticket.orderConfirmed) orderEmbed.addFields({ name: "\u200b", value: T[lang].confirmed });

  const sellerEmbed = new EmbedBuilder()
    .setColor(ticket.sellerConfirmed ? 0x22c55e : 0x2b2d31)
    .setTitle(T[lang].sellerEmbedTitle)
    .addFields(
      { name: lang === "ar" ? "البائع" : "Seller", value: `<@${ticket.sellerDiscordId}>`, inline: true },
      { name: lang === "ar" ? "السعر" : "Rate", value: `${ticket.rate} ${lang === "ar" ? "ريال/1000" : "SAR/1000"}`, inline: true }
    );
  if (ticket.sellerConfirmed) sellerEmbed.addFields({ name: "\u200b", value: T[lang].confirmed });

  return { orderEmbed, sellerEmbed };
}

async function refreshTicketConfirmMessage(channel, ticket, which) {
  const { orderEmbed, sellerEmbed } = buildTicketEmbeds(ticket);
  const lang = ticket.lang;

  if ((which === "order" || !which) && ticket.orderMessageId) {
    const msg = await channel.messages.fetch(ticket.orderMessageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [orderEmbed],
        components: ticket.orderConfirmed
          ? []
          : [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`confirm:order:${ticket.id}`)
                  .setLabel(T[lang].confirmButton)
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId(`cancel:order:${ticket.id}`)
                  .setLabel(T[lang].cancelButton)
                  .setStyle(ButtonStyle.Secondary)
              ),
            ],
      });
    }
  }

  if ((which === "seller" || !which) && ticket.sellerMessageId) {
    const msg = await channel.messages.fetch(ticket.sellerMessageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [sellerEmbed],
        components: ticket.sellerConfirmed
          ? []
          : [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`confirm:seller:${ticket.id}`)
                  .setLabel(T[lang].confirmButton)
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId(`changeseller:seller:${ticket.id}`)
                  .setLabel(T[lang].changeSellerButton)
                  .setStyle(ButtonStyle.Secondary)
              ),
            ],
      });
    }
  }
}

async function sendTicketOpenedDm(client, discordUserId, ticketId, channelId, guildId, lang) {
  try {
    const user = await client.users.fetch(discordUserId);
    const url = `https://discord.com/channels/${guildId}/${channelId}`;
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle(T[lang].dmOpenedTitle).setDescription(T[lang].dmOpenedBody(ticketId));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(T[lang].viewTicket).setStyle(ButtonStyle.Link).setURL(url)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.log(`تعذّر إرسال DM لـ ${discordUserId}: ${e.message}`);
  }
}

function scheduleOrderExpiry(channel, ticket) {
  if (ticket.timeout) clearTimeout(ticket.timeout);
  if (ticket.orderConfirmed && ticket.sellerConfirmed) return;
  const remaining = Math.max(0, TICKET_TIMEOUT_MS - (Date.now() - ticket.createdAt));
  ticket.timeout = setTimeout(async () => {
    const current = activeTickets.get(channel.id);
    if (!current || (current.orderConfirmed && current.sellerConfirmed)) return;
    activeTickets.delete(channel.id);
    await channel.setTopic(`swiftrbx-closed-v1:${ticket.id}`).catch(() => {});
    await channel.send(T[ticket.lang].expired).catch(() => {});
    setTimeout(() => channel.delete().catch(() => {}), 10_000);
  }, remaining);
}

async function restoreTickets(client) {
  for (const guild of client.guilds.cache.values()) {
    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) continue;
    for (const channel of channels.values()) {
      if (!channel?.isTextBased?.() || !("topic" in channel)) continue;
      const ticket = decodeTicketTopic(channel.topic);
      if (!ticket) continue;
      ticket.channelId = channel.id;
      ticket.guildId = guild.id;
      activeTickets.set(channel.id, ticket);
      if (ticket.kind === "robux" && !(ticket.orderConfirmed && ticket.sellerConfirmed)) {
        const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        for (const message of messages?.values?.() || []) {
          if (message.embeds[0]?.title === T[ticket.lang].orderEmbedTitle) ticket.orderMessageId = message.id;
          if (message.embeds[0]?.title === T[ticket.lang].sellerEmbedTitle) ticket.sellerMessageId = message.id;
        }
        scheduleOrderExpiry(channel, ticket);
      }
    }
  }
}

async function createOrderTicket(interaction, data) {
  const { lang, buyerId, sellerDiscordId, username, quantity, deliveryType, rate } = data;
  const guild = interaction.guild;
  const ticketId = generateTicketId();
  const channelName = lang === "ar" ? `طلب-${ticketId}` : `order-${ticketId}`;

  const memberAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const staffAccess = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: buyerId, type: OverwriteType.Member, allow: memberAllow },
    { id: sellerDiscordId, type: OverwriteType.Member, allow: memberAllow },
    {
      id: interaction.client.user.id,
      type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  if (SUPPORT_ROLE_ID) {
    permissionOverwrites.push({ id: SUPPORT_ROLE_ID, type: OverwriteType.Role, allow: staffAccess });
  }
  if (SALER_ROLE_ID) {
    permissionOverwrites.push({ id: SALER_ROLE_ID, type: OverwriteType.Role, allow: staffAccess });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKETS_CATEGORY_ID || undefined,
    permissionOverwrites,
  });

  const ticket = {
    id: ticketId,
    kind: "robux",
    lang,
    buyerId,
    sellerDiscordId,
    sellerProfileId: data.sellerProfileId,
    offerId: data.offerId,
    username,
    quantity,
    deliveryType,
    rate,
    channelId: channel.id,
    guildId: guild.id,
    orderConfirmed: false,
    sellerConfirmed: false,
    createdAt: Date.now(),
  };
  await persistTicket(channel, ticket);

  const { orderEmbed, sellerEmbed } = buildTicketEmbeds(ticket);
  const orderMsg = await channel.send({ content: `<@${buyerId}>`, embeds: [orderEmbed] });
  const sellerMsg = await channel.send({ content: `<@${sellerDiscordId}>`, embeds: [sellerEmbed] });
  await channel.send(T[lang].pleaseConfirm);

  ticket.orderMessageId = orderMsg.id;
  ticket.sellerMessageId = sellerMsg.id;
  activeTickets.set(channel.id, ticket);
  await persistTicket(channel, ticket);
  await refreshTicketConfirmMessage(channel, ticket);
  scheduleOrderExpiry(channel, ticket);

  await sendTicketOpenedDm(interaction.client, buyerId, ticketId, channel.id, guild.id, lang);
  await sendTicketOpenedDm(interaction.client, sellerDiscordId, ticketId, channel.id, guild.id, lang);

  return channel;
}

async function createServiceTicket(interaction, data) {
  const { kind, profile, details, username, lang } = data;
  const guild = interaction.guild;
  const ticketId = generateTicketId();
  const memberPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, type: OverwriteType.Member, allow: memberPermissions },
    {
      id: interaction.client.user.id,
      type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  const staffRoleIds = [...new Set([SUPPORT_ROLE_ID, SALER_ROLE_ID].filter(Boolean))];
  for (const roleId of staffRoleIds) {
    permissionOverwrites.push({ id: roleId, type: OverwriteType.Role, allow: memberPermissions });
  }

  const channel = await guild.channels.create({
    name: `${lang === "ar" ? "تذكرة" : "ticket"}-${kind}-${ticketId}`.toLowerCase().slice(0, 90),
    type: ChannelType.GuildText,
    parent: TICKETS_CATEGORY_ID || undefined,
    permissionOverwrites,
  });
  const ticket = {
    id: ticketId,
    kind,
    lang,
    buyerId: interaction.user.id,
    guildId: guild.id,
    channelId: channel.id,
    orderConfirmed: true,
    sellerConfirmed: true,
    createdAt: Date.now(),
  };
  activeTickets.set(channel.id, ticket);
  await persistTicket(channel, ticket);

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(T[lang].ticketEmbedTitle(kind))
    .setDescription(details.slice(0, 1000))
    .addFields({ name: T[lang].ticketOwner, value: `<@${interaction.user.id}>`, inline: true });
  if (username) embed.addFields({ name: lang === "ar" ? "يوزرنيم روبلوكس" : "Roblox username", value: username, inline: true });
  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`close:${ticketId}`).setLabel(T[lang].closeTicket).setStyle(ButtonStyle.Secondary)
  );
  await channel.send({
    content: `<@${interaction.user.id}>${staffRoleIds.map((roleId) => ` <@&${roleId}>`).join("")}`,
    embeds: [embed],
    components: [closeRow],
    allowedMentions: { users: [interaction.user.id], roles: staffRoleIds },
  });
  await sendTicketOpenedDm(interaction.client, interaction.user.id, ticketId, channel.id, guild.id, lang);
  return channel;
}

async function closeTicketChannel(channel, ticket) {
  if (ticket.timeout) clearTimeout(ticket.timeout);
  activeTickets.delete(channel.id);
  const closedName = `${ticket.lang === "ar" ? "مغلق" : "closed"}-${ticket.id}`.slice(0, 90);
  await channel.setName(closedName).catch(() => {});
  await channel.setTopic(`swiftrbx-closed-v1:${ticket.id}`).catch(() => {});
  for (const userId of [ticket.buyerId, ticket.sellerDiscordId].filter(Boolean)) {
    await channel.permissionOverwrites.edit(userId, { SendMessages: false, AddReactions: false }).catch(() => {});
  }
  for (const roleId of [...new Set([SUPPORT_ROLE_ID, SALER_ROLE_ID].filter(Boolean))]) {
    await channel.permissionOverwrites.edit(roleId, { SendMessages: false, AddReactions: false }).catch(() => {});
  }
  await channel.send(T[ticket.lang].ticketClosed).catch(() => {});
}

async function getProfileByDiscordId(discordId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_profile_by_discord_id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_discord_id: discordId }),
  });

  if (!res.ok) throw new Error(`Supabase request failed (${res.status})`);

  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// ----------------------------------------------------------------------
// نشر أو تحديث اللوحة بالقناة
// ----------------------------------------------------------------------
async function ensurePanel(client) {
  if (!PANEL_CHANNEL_ID) {
    console.log("ℹ️ PANEL_CHANNEL_ID غير محدد - ما راح تنشر اللوحة.");
    return;
  }

  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.log("⚠️ القناة المحددة غير صالحة أو مو قناة نصية.");
      return;
    }

    const recent = await channel.messages.fetch({ limit: 25 });
    const existing = recent.find(
      (m) => m.author.id === client.user.id && m.embeds[0]?.footer?.text === PANEL_MARKER
    );

    const payload = buildPanel();
    if (existing) {
      await existing.edit(payload);
      console.log("✅ تم تحديث اللوحة.");
    } else {
      await channel.send(payload);
      console.log("✅ تم نشر اللوحة.");
    }
  } catch (e) {
    console.error("⚠️ تعذّر نشر اللوحة (تأكد من صلاحيات البوت بالقناة):", e.message);
  }
}

// ----------------------------------------------------------------------
// Discord
// ----------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ تم تسجيل الدخول باسم: ${c.user.tag}`);
  await restoreTickets(c);
  await ensurePanel(c);
});


async function requireLinkedProfile(interaction) {
  const profile = await getProfileByDiscordId(interaction.user.id);
  if (!profile) {
    await interaction.editReply(
      "❌ حسابك بديسكورد غير مربوط بالموقع.\n\n" +
        `1) افتح ${SITE_URL}\n` +
        "2) سجّل دخول عن طريق **Discord** بنفس حساب ديسكورد اللي تستخدمه الحين\n" +
        "3) ارجع هنا واضغط الزر مرة ثانية"
    );
    return null;
  }
  if (profile.active === false) {
    await interaction.editReply("⛔ حسابك بالموقع موقوف. تواصل مع الدعم.");
    return null;
  }
  return profile;
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ------------------------------------------------------------------
    // 1) نموذج تذاكر الدعم والليميتد والأغراض والحسابات
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("ticket:form:")) {
      const typeKey = interaction.customId.split(":")[2];
      if (!TICKET_TYPES[typeKey] || typeKey === "robux") return;
      const lang = interaction.locale?.toLowerCase().startsWith("en") ? "en" : "ar";
      const modal = new ModalBuilder()
        .setCustomId(`ticket:details:${typeKey}`)
        .setTitle(T[lang].formTitle(typeKey).slice(0, 45));
      const usernameInput = new TextInputBuilder()
        .setCustomId("username")
        .setLabel(T[lang].usernameOptionalLabel)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(20);
      const detailsInput = new TextInputBuilder()
        .setCustomId("details")
        .setLabel(T[lang].detailsLabel)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder().addComponents(usernameInput), new ActionRowBuilder().addComponents(detailsInput));
      await interaction.showModal(modal);
      return;
    }

    // ------------------------------------------------------------------
    // 2) زر من اللوحة الرئيسية
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
      const typeKey = interaction.customId.split(":")[1];
      const type = TICKET_TYPES[typeKey];
      if (!type) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const profile = await requireLinkedProfile(interaction);
      if (!profile) return;

      const lang = interaction.locale?.toLowerCase().startsWith("en") ? "en" : "ar";
      const openTickets = [...activeTickets.values()].filter((ticket) => ticket.guildId === interaction.guildId && ticket.buyerId === interaction.user.id);
      if (openTickets.length >= MAX_OPEN_TICKETS_PER_USER) {
        await interaction.editReply(ticketLimitMessage(lang));
        return;
      }
      if (openTickets.some((ticket) => ticket.kind === typeKey)) {
        await interaction.editReply(T[lang].ticketAlreadyOpen);
        return;
      }

      if (typeKey === "robux") {
        pendingOrders.set(interaction.user.id, { buyerProfileId: profile.id, guildId: interaction.guildId, createdAt: Date.now() });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("order:lang:ar").setLabel("العربية").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("order:lang:en").setLabel("English").setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ content: "اختر اللغة / Choose language:", components: [row] });
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:form:${typeKey}`)
          .setLabel(T[lang].submitTicket)
          .setStyle(ButtonStyle.Primary)
      );
      await interaction.editReply({
        content: lang === "ar" ? `حسابك مربوط باسم **${profile.display_name || profile.username}**. أكمل النموذج لفتح التذكرة.` : `Your account is linked as **${profile.display_name || profile.username}**. Complete the form to open a ticket.`,
        components: [row],
      });
      return;
    }

    // ------------------------------------------------------------------
    // 2) اختيار اللغة -> عرض نوع التسليم
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("order:lang:")) {
      const lang = interaction.customId.split(":")[2] === "en" ? "en" : "ar";
      const state = pendingOrders.get(interaction.user.id);
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > 15 * 60 * 1000) {
        await interaction.update({ content: "انتهت صلاحية الطلب، ابدأ من جديد.", components: [] });
        return;
      }
      state.lang = lang;

      const menu = new StringSelectMenuBuilder()
        .setCustomId("order:delivery")
        .setPlaceholder(T[lang].deliveryPlaceholder)
        .addOptions(
          Object.entries(DELIVERY_LABELS).map(([key, label]) => ({
            label: label[lang],
            value: key,
          }))
        );
      await interaction.update({ content: T[lang].pickDelivery, components: [new ActionRowBuilder().addComponents(menu)] });
      return;
    }

    // ------------------------------------------------------------------
    // 3) اختيار نوع التسليم -> فتح Modal (يوزرنيم + كمية)
    // ------------------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "order:delivery") {
      const state = pendingOrders.get(interaction.user.id);
      const deliveryType = interaction.values[0];
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > 15 * 60 * 1000 || !DELIVERY_LABELS[deliveryType]) {
        await interaction.update({ content: "انتهت صلاحية الطلب، ابدأ من جديد.", components: [] });
        return;
      }
      state.deliveryType = deliveryType;
      pendingOrders.set(interaction.user.id, state);
      const lang = state.lang || "ar";

      const modal = new ModalBuilder().setCustomId("order:detailsmodal").setTitle(T[lang].modalTitle);
      const usernameInput = new TextInputBuilder()
        .setCustomId("username")
        .setLabel(T[lang].usernameLabel)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32);
      const quantityInput = new TextInputBuilder()
        .setCustomId("quantity")
        .setLabel(T[lang].quantityLabel)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder().addComponents(usernameInput),
        new ActionRowBuilder().addComponents(quantityInput)
      );
      await interaction.showModal(modal);
      return;
    }

    // ------------------------------------------------------------------
    // 4) حفظ تذكرة الخدمة بعد التحقق من الحساب والمدخلات
    // ------------------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket:details:")) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const typeKey = interaction.customId.split(":")[2];
      if (!TICKET_TYPES[typeKey] || typeKey === "robux") {
        await interaction.editReply("Invalid ticket type.");
        return;
      }
      const profile = await requireLinkedProfile(interaction);
      if (!profile) return;
      const lang = interaction.locale?.toLowerCase().startsWith("en") ? "en" : "ar";
      const details = interaction.fields.getTextInputValue("details").trim();
      const username = interaction.fields.getTextInputValue("username").trim();
      if (details.length < 5 || (username && !isValidRobloxUsername(username))) {
        await interaction.editReply(lang === "ar" ? "تحقق من التفاصيل ويوزرنيم روبلوكس." : "Check the details and Roblox username.");
        return;
      }
      const openTickets = [...activeTickets.values()].filter((ticket) => ticket.guildId === interaction.guildId && ticket.buyerId === interaction.user.id);
      if (openTickets.length >= MAX_OPEN_TICKETS_PER_USER) {
        await interaction.editReply(ticketLimitMessage(lang));
        return;
      }
      if (openTickets.some((ticket) => ticket.kind === typeKey)) {
        await interaction.editReply(T[lang].ticketAlreadyOpen);
        return;
      }
      const openingKey = `${interaction.guildId}:${interaction.user.id}`;
      if (openingTickets.has(openingKey)) {
        await interaction.editReply(ticketLimitMessage(lang));
        return;
      }
      openingTickets.add(openingKey);
      try {
        const channel = await createServiceTicket(interaction, { kind: typeKey, profile, details, username, lang });
        await interaction.editReply(T[lang].ticketCreatedStandard(channel.toString()));
      } finally {
        openingTickets.delete(openingKey);
      }
      return;
    }

    // ------------------------------------------------------------------
    // 5) إرسال Modal -> البحث عن بائعين مطابقين
    // ------------------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "order:detailsmodal") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = pendingOrders.get(interaction.user.id);
      const lang = state?.lang || "ar";
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > 15 * 60 * 1000 || !DELIVERY_LABELS[state.deliveryType]) {
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply("انتهت صلاحية الطلب، ابدأ من جديد.");
        return;
      }
      const profile = await requireLinkedProfile(interaction);
      if (!profile || profile.id !== state.buyerProfileId) {
        pendingOrders.delete(interaction.user.id);
        return;
      }
      const username = interaction.fields.getTextInputValue("username").trim();
      const quantityRaw = interaction.fields.getTextInputValue("quantity").trim();
      if (!isValidRobloxUsername(username) || !/^\d{1,10}$/.test(quantityRaw)) {
        await interaction.editReply(T[lang].invalidQuantity);
        return;
      }
      const quantity = Number(quantityRaw);
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_ORDER_QUANTITY) {
        await interaction.editReply(T[lang].invalidQuantity);
        return;
      }

      state.username = username;
      state.quantity = quantity;
      pendingOrders.set(interaction.user.id, state);

      const offers = await searchOffers(state.deliveryType, quantity, profile.id);
      if (!offers.length) {
        await interaction.editReply(T[lang].noSellers(quantity, state.deliveryType));
        pendingOrders.delete(interaction.user.id);
        return;
      }

      state.offers = offers;
      pendingOrders.set(interaction.user.id, state);

      const menu = new StringSelectMenuBuilder()
        .setCustomId("order:seller")
        .setPlaceholder(T[lang].pickSeller)
        .addOptions(
          offers.map((offer) => ({
            label: (offer.profiles?.display_name || offer.profiles?.username || "Seller").slice(0, 100),
            description: T[lang].sellerOption("", offer.rate, offer.available).slice(0, 100),
            value: offer.id,
          }))
        );
      await interaction.editReply({ content: T[lang].pickSeller, components: [new ActionRowBuilder().addComponents(menu)] });
      return;
    }

    // ------------------------------------------------------------------
    // 5) اختيار البائع -> إنشاء قناة التذكرة فعلياً
    // ------------------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "order:seller") {
      await interaction.deferUpdate();
      const state = pendingOrders.get(interaction.user.id);
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > 15 * 60 * 1000 || !state.offers) {
        await interaction.editReply({ content: "انتهت صلاحية الطلب، ابدأ من جديد.", components: [] });
        return;
      }
      const lang = state.lang || "ar";
      const offerId = interaction.values[0];
      const offer = state.offers.find((o) => o.id === offerId);
      pendingOrders.delete(interaction.user.id);

      if (!offer || !offer.profiles) {
        await interaction.editReply({ content: "صار خطأ تقني، حاول مرة ثانية.", components: [] });
        return;
      }

      const buyerProfile = await getProfileByDiscordId(interaction.user.id);
      if (!buyerProfile || buyerProfile.active === false || buyerProfile.id !== state.buyerProfileId) {
        await interaction.editReply({ content: "تعذر التحقق من ارتباط حسابك، ابدأ من جديد.", components: [] });
        return;
      }
      const openTickets = [...activeTickets.values()].filter((ticket) => ticket.guildId === interaction.guildId && ticket.buyerId === interaction.user.id);
      if (openTickets.length >= MAX_OPEN_TICKETS_PER_USER || openTickets.some((ticket) => ticket.kind === "robux")) {
        await interaction.editReply({ content: ticketLimitMessage(lang), components: [] });
        return;
      }

      const sellerDiscordId = await getDiscordIdByProfileId(offer.seller_id);
      if (!sellerDiscordId || sellerDiscordId === interaction.user.id || offer.seller_id === buyerProfile.id || offer.profiles.active === false) {
        await interaction.editReply({
          content:
            lang === "ar"
              ? "⚠️ البائع المختار حسابه بديسكورد غير مربوط حالياً، اختر بائع ثاني."
              : "⚠️ The selected seller's Discord account isn't linked. Please pick another seller.",
          components: [],
        });
        return;
      }

      await interaction.editReply({
        content: T[lang].summary(state.username, state.quantity, state.deliveryType, offer.profiles.display_name || offer.profiles.username),
        components: [],
      });

      const openingKey = `${interaction.guildId}:${interaction.user.id}`;
      if (openingTickets.has(openingKey)) {
        await interaction.followUp({ content: ticketLimitMessage(lang), flags: MessageFlags.Ephemeral });
        return;
      }
      openingTickets.add(openingKey);
      try {
        await createOrderTicket(interaction, {
          lang,
          buyerId: interaction.user.id,
          sellerDiscordId,
          sellerProfileId: offer.seller_id,
          sellerName: offer.profiles.display_name || offer.profiles.username,
          username: state.username,
          quantity: state.quantity,
          deliveryType: state.deliveryType,
          rate: offer.rate,
          offerId: offer.id,
        });
      } catch (e) {
        console.error("فشل إنشاء التذكرة:", e.message);
        await interaction.followUp({
          content: "صار خطأ أثناء فتح التذكرة، حاول مرة ثانية أو تواصل مع الدعم.",
          flags: MessageFlags.Ephemeral,
        });
      } finally {
        openingTickets.delete(openingKey);
      }
      return;
    }

    // ------------------------------------------------------------------
    // 6) أزرار تأكيد الطلب/البائع داخل التذكرة (كلها بس للمشتري)
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("confirm:")) {
      const [, part, ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lang = ticket.lang;

      if (ticket.kind !== "robux" || !["order", "seller"].includes(part)) return;
      const expectedUserId = part === "order" ? ticket.buyerId : ticket.sellerDiscordId;
      if (interaction.user.id !== expectedUserId) {
        await interaction.reply({ content: T[lang].onlyPartyCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }
      if ((part === "order" && ticket.orderConfirmed) || (part === "seller" && ticket.sellerConfirmed)) {
        await interaction.reply({ content: T[lang].confirmed, flags: MessageFlags.Ephemeral });
        return;
      }

      if (part === "order") ticket.orderConfirmed = true;
      else ticket.sellerConfirmed = true;

      await interaction.deferUpdate();
      await persistTicket(interaction.channel, ticket);
      await refreshTicketConfirmMessage(interaction.channel, ticket, part);

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        if (ticket.timeout) clearTimeout(ticket.timeout);
        const newName = lang === "ar" ? `تم-التأكيد-${ticket.id}` : `confirmed-${ticket.id}`;
        await interaction.channel.setName(newName).catch(() => {});
        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`close:${ticket.id}`).setLabel(T[lang].closeTicket).setStyle(ButtonStyle.Secondary)
        );
        await interaction.channel.send({ content: T[lang].bothConfirmedNext, components: [closeRow] });
      }
      return;
    }

    // ------------------------------------------------------------------
    // إغلاق التذاكر بعد انتهاء الطلب أو الدعم
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("close:")) {
      const ticketId = interaction.customId.split(":")[1];
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const isParticipant = interaction.user.id === ticket.buyerId || interaction.user.id === ticket.sellerDiscordId;
      const allowed = hasSupportAccess(interaction) || (ticket.kind === "robux"
        ? isParticipant && ticket.orderConfirmed && ticket.sellerConfirmed
        : interaction.user.id === ticket.buyerId);
      if (!allowed) {
        await interaction.reply({ content: T[ticket.lang].onlyTicketStaff, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferUpdate();
      await closeTicketChannel(interaction.channel, ticket);
      return;
    }

    // ------------------------------------------------------------------
    // 8) زر إلغاء الطلب (المشتري بس)
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("cancel:")) {
      const [, , ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId || ticket.kind !== "robux") {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lang = ticket.lang;
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.reply({ content: T[lang].onlyTicketStaff, flags: MessageFlags.Ephemeral });
        return;
      }
      if (ticket.timeout) clearTimeout(ticket.timeout);
      activeTickets.delete(interaction.channelId);
      await interaction.deferUpdate();
      await interaction.channel.setTopic(`swiftrbx-closed-v1:${ticket.id}`).catch(() => {});
      await interaction.channel.send(T[lang].cancelled);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 8_000);
      return;
    }

    // ------------------------------------------------------------------
    // 9) زر تغيير البائع (للمشتري فقط) -> اختيار بائع بديل
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("changeseller:")) {
      const [, , ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId || ticket.kind !== "robux") {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lang = ticket.lang;
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const buyerProfile = await getProfileByDiscordId(ticket.buyerId);
      if (!buyerProfile || buyerProfile.active === false) {
        await interaction.editReply(T[lang].noSellersForChange);
        return;
      }
      const offers = (await searchOffers(ticket.deliveryType, ticket.quantity, buyerProfile.id)).filter(
        (offer) => offer.seller_id !== ticket.sellerProfileId
      );

      if (!offers.length) {
        await interaction.editReply(T[lang].noSellersForChange);
        return;
      }

      ticket.pendingOffers = offers;
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`changesellersel:${ticketId}`)
        .setPlaceholder(T[lang].pickNewSeller)
        .addOptions(
          offers.map((offer) => ({
            label: (offer.profiles?.display_name || offer.profiles?.username || "Seller").slice(0, 100),
            description: T[lang].sellerOption("", offer.rate, offer.available).slice(0, 100),
            value: offer.id,
          }))
        );
      await interaction.editReply({ content: T[lang].pickNewSeller, components: [new ActionRowBuilder().addComponents(menu)] });
      return;
    }

    // ------------------------------------------------------------------
    // 9) اختيار البائع الجديد -> تحديث التذكرة والصلاحيات
    // ------------------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("changesellersel:")) {
      const ticketId = interaction.customId.split(":")[1];
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId || !ticket.pendingOffers) {
        await interaction.update({ content: "انتهت صلاحية هذا الاختيار.", components: [] });
        return;
      }
      const lang = ticket.lang;
      const offerId = interaction.values[0];
      const offer = ticket.pendingOffers.find((o) => o.id === offerId);
      delete ticket.pendingOffers;
      if (!offer) {
        await interaction.update({ content: "صار خطأ تقني، حاول مرة ثانية.", components: [] });
        return;
      }

      const newSellerDiscordId = await getDiscordIdByProfileId(offer.seller_id);
      if (!newSellerDiscordId || newSellerDiscordId === ticket.buyerId || offer.seller_id === ticket.sellerProfileId || offer.profiles?.active === false) {
        await interaction.update({ content: T[lang].noSellersForChange, components: [] });
        return;
      }

      const oldSellerDiscordId = ticket.sellerDiscordId;
      await interaction.channel.permissionOverwrites.delete(oldSellerDiscordId).catch(() => {});
      await interaction.channel.permissionOverwrites.create(
        newSellerDiscordId,
        { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true },
        { type: OverwriteType.Member }
      );

      ticket.sellerDiscordId = newSellerDiscordId;
      ticket.sellerProfileId = offer.seller_id;
      ticket.offerId = offer.id;
      ticket.rate = offer.rate;
      ticket.sellerConfirmed = false;
      ticket.createdAt = Date.now();
      await persistTicket(interaction.channel, ticket);
      scheduleOrderExpiry(interaction.channel, ticket);

      await interaction.update({ content: T[lang].sellerChanged, components: [] });
      await refreshTicketConfirmMessage(interaction.channel, ticket, "seller");
      await interaction.channel.send(`<@${newSellerDiscordId}>`);
      await sendTicketOpenedDm(interaction.client, newSellerDiscordId, ticket.id, interaction.channelId, interaction.guildId, lang);
      return;
    }
  } catch (e) {
    console.error("خطأ أثناء معالجة التفاعل:", e);
    const msg = "صار خطأ تقني، حاول مرة ثانية بعد قليل.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// تنبيه لو كتب المشتري أو البائع رسالة بالتذكرة قبل ما يأكدوا
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const ticket = activeTickets.get(message.channel.id);
  if (!ticket) return;
  if (ticket.orderConfirmed && ticket.sellerConfirmed) return;
  if (message.author.id !== ticket.buyerId && message.author.id !== ticket.sellerDiscordId) return;

  await message.reply(T[ticket.lang].pleaseConfirm).catch(() => {});
});

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

client.login(DISCORD_TOKEN);
