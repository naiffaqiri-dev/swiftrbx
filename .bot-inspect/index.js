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
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const PANEL_CHANNEL_ID = (process.env.PANEL_CHANNEL_ID || "").trim();
const SUPPORT_ROLE_ID = (process.env.SUPPORT_ROLE_ID || "").trim();
const SALER_ROLE_ID = (process.env.SALER_ROLE_ID || process.env.SALES_ROLE_ID || "").trim();
const TICKETS_CATEGORY_ID = (process.env.TICKETS_CATEGORY_ID || "").trim();

if (!DISCORD_TOKEN) {
  throw new Error("لم يتم العثور على DISCORD_TOKEN في متغيرات البيئة.");
}
if (!PANEL_CHANNEL_ID) {
  throw new Error("لم يتم العثور على PANEL_CHANNEL_ID في متغيرات البيئة.");
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
        "اختر نوع طلبك لفتح قناة خاصة بك وفريق المتجر.",
        "",
        "💰 **شراء روبكس**",
        "💎 **ليميتد**",
        "🎮 **أغراض المابات**",
        "🛡️ **حسابات روبلوكس**",
        "🆘 **الدعم والاستفسارات** (أي سؤال عام أو مشكلة)",
        "",
        "⚠️ لا ترسل كلمات المرور أو رموز التحقق داخل التذكرة.",
        "تواصل مع فريق الدعم لتأكيد تفاصيل الطلب.",
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
// Text for bilingual Robux ticket flow
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
      `ما قدرنا نطابق طلب **${q}** حالياً بطريقة **${DELIVERY_LABELS[d].ar}**. جرّب لاحقاً أو تواصل مع الدعم.`,
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
      `We could not match **${q}** via **${DELIVERY_LABELS[d].en}** right now. Try again later or contact support.`,
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
    if (ticket.kind === "robux" && (!ticket.quantity || !DELIVERY_LABELS[ticket.deliveryType])) return null;
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
    }
  }
}

async function createServiceTicket(interaction, data) {
  const { kind, details, username, lang } = data;
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
    quantity: data.quantity || null,
    deliveryType: data.deliveryType || null,
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
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ تم تسجيل الدخول باسم: ${c.user.tag}`);
  await restoreTickets(c);
  await ensurePanel(c);
});



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
        pendingOrders.set(interaction.user.id, { guildId: interaction.guildId, createdAt: Date.now() });
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
        content: lang === "ar" ? "أكمل النموذج لفتح تذكرة خاصة مع فريق المتجر." : "Complete the form to open a private ticket with the store team.",
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
        const channel = await createServiceTicket(interaction, { kind: typeKey, details, username, lang });
        await interaction.editReply(T[lang].ticketCreatedStandard(channel.toString()));
      } finally {
        openingTickets.delete(openingKey);
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "order:detailsmodal") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = pendingOrders.get(interaction.user.id);
      const lang = state?.lang || "ar";
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > 15 * 60 * 1000 || !DELIVERY_LABELS[state.deliveryType]) {
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply("انتهت صلاحية الطلب، ابدأ من جديد.");
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

      const openTickets = [...activeTickets.values()].filter((ticket) => ticket.guildId === interaction.guildId && ticket.buyerId === interaction.user.id);
      if (openTickets.length >= MAX_OPEN_TICKETS_PER_USER || openTickets.some((ticket) => ticket.kind === "robux")) {
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply(ticketLimitMessage(lang));
        return;
      }

      const openingKey = `${interaction.guildId}:${interaction.user.id}`;
      if (openingTickets.has(openingKey)) {
        await interaction.editReply(ticketLimitMessage(lang));
        return;
      }
      openingTickets.add(openingKey);
      try {
        const details = [
          lang === "ar" ? `يوزرنيم Roblox: ${username}` : `Roblox username: ${username}`,
          lang === "ar" ? `الكمية: ${quantity.toLocaleString("en-US")}` : `Quantity: ${quantity.toLocaleString("en-US")}`,
          lang === "ar" ? `طريقة التسليم: ${DELIVERY_LABELS[state.deliveryType].ar}` : `Delivery method: ${DELIVERY_LABELS[state.deliveryType].en}`,
        ].join("\n");
        const channel = await createServiceTicket(interaction, {
          kind: "robux",
          details,
          username,
          quantity,
          deliveryType: state.deliveryType,
          lang,
        });
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply({ content: T[lang].ticketCreated(channel.toString()), components: [] });
      } catch (error) {
        console.error("فشل فتح تذكرة الروبكس:", error.message);
        await interaction.editReply("تعذّر فتح التذكرة. حاول مجددًا أو تواصل مع الدعم.");
      } finally {
        openingTickets.delete(openingKey);
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
      const allowed = hasSupportAccess(interaction) || interaction.user.id === ticket.buyerId;
      if (!allowed) {
        await interaction.reply({ content: T[ticket.lang].onlyTicketStaff, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferUpdate();
      await closeTicketChannel(interaction.channel, ticket);
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

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

client.login(DISCORD_TOKEN).catch((error) => {
  console.error("فشل تسجيل دخول البوت إلى Discord:", error.message);
  process.exitCode = 1;
});
