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
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const PANEL_CHANNEL_ID = (process.env.PANEL_CHANNEL_ID || "").trim();
const SELECT_ROLES_CHANNEL_ID = "1558413533300006952";
const SELECT_ROLES_MARKER = "SwiftRBX • select roles • v1";
const LIVE_STOCK_CHANNEL_ID = (process.env.LIVE_STOCK_CHANNEL_ID || "1481253146209681478").trim();
const LIVE_STOCK_MARKER = "SwiftRBX • المخزون المباشر";
const LIVE_STOCK_REFRESH_MS = 2 * 60_000;
const SITE_URL = (process.env.SITE_URL || "https://www.swiftrbx.site").trim().replace(/\/+$/, "");
const SUPPORT_ROLE_ID = (process.env.SUPPORT_ROLE_ID || "").trim();
const SALER_ROLE_ID = (process.env.SALER_ROLE_ID || process.env.SALES_ROLE_ID || "").trim();
const TICKETS_CATEGORY_ID = (process.env.TICKETS_CATEGORY_ID || "").trim();
const TICKET_TIMEOUT_MS = 30 * 60 * 1000;
const PENDING_ORDER_TIMEOUT_MS = 15 * 60 * 1000;

if (!DISCORD_TOKEN) {
  throw new Error("لم يتم العثور على DISCORD_TOKEN في متغيرات البيئة.");
}
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("يلزم ضبط SUPABASE_URL وSUPABASE_SECRET_KEY لتفعيل طلبات الروبكس.");
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
        "لطلب الروبكس، اربط حساب ديسكورد بحسابك في الموقع أولاً.",
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
  usernameLabel: "يوزرنيم روبلوكس (3-20 إنجليزي/رقم/_)",
  quantityLabel: "الكمية المطلوبة (1000 أو ١٠٠٠)",
  invalidUsername: "❌ اكتب يوزرنيم روبلوكس صحيحاً: من 3 إلى 20 حرفاً إنجليزياً أو رقماً أو _. لا تكتب اسم العرض.",
  invalidQuantity: "❌ اكتب الكمية كرقم صحيح أكبر من صفر، مثل 1000 أو ١٠٠٠.",
    pickSeller: "اختر البائع:",
    sellerOption: (rate, qty, minimum, maximum) => `${rate} ريال/1000 • متوفر ${qty} • ${minimum}-${maximum}`,
    offerUpdated: "تغيّرت بيانات العرض من الموقع. حدّثت السعر والكمية والحدود؛ راجعها ثم أكّد من جديد.",
    offerNoLongerAvailable: "لم يعد هذا العرض يطابق الكمية أو الحدود الحالية. اطلب من المشتري اختيار بائع آخر.",
    ticketCreated: (channelMention) => `✅ تم فتح تذكرتك: ${channelMention}`,
    linkedAccountRequired: (siteUrl) => `❌ حساب ديسكورد غير مربوط بالموقع. سجّل الدخول إلى ${siteUrl} باستخدام Discord ثم أعد المحاولة.`,
    accountDisabled: "⛔ حسابك بالموقع موقوف. تواصل مع الدعم.",
    sellerUnlinked: "⚠️ البائع المختار لم يربط حساب ديسكورد. اختر بائعاً آخر.",
    noSellers: (quantity, delivery) => `😔 لا يوجد بائع آخر متاح لكمية **${quantity}** بطريقة **${DELIVERY_LABELS[delivery].ar}** حالياً.`,
    ownOfferOnly: (name, rate, stock, minimum, maximum) => `✅ يوجد عرضك في الموقع: **${name}** — السعر **${rate} ريال/1,000**، المتاح **${stock}** والحدود **${minimum}–${maximum}**. لم أظهره كبائع لأن حساب Discord هذا هو صاحب العرض ولا يمكن شراء عرضك بنفسك. سيظهر للمشترين الآخرين عند اختيار الكمية ونوع التسليم المطابقين.`,
    onlyBuyerCanConfirm: "⚠️ تأكيد تفاصيل الطلب أو إلغاؤه متاح لصاحب الطلب فقط.",
    onlySellerCanConfirm: "⚠️ تأكيد بيانات البائع متاح للبائع المختار فقط.",
    alreadyConfirmed: "تم تأكيد الطلب بالكامل ولا يمكن تعديله.",
    cancelled: "❌ ألغى المشتري الطلب. سيتم إغلاق التذكرة.",
    pickNewSeller: "اختر البائع الجديد:",
    noSellersForChange: "😔 لا يوجد بائع آخر متاح لنفس الكمية وطريقة التسليم.",
    sellerChanged: "✅ تم تغيير البائع. على المشتري والبائع الجديد تأكيد التفاصيل.",
    expired: "⏰ انتهت مهلة التأكيد (30 دقيقة)، وتم إغلاق التذكرة.",
    orderEmbedTitle: "📦 تفاصيل الطلب",
    sellerEmbedTitle: "🧑‍💼 بيانات البائع",
    confirmButton: "تأكيد",
    cancelButton: "❌ إلغاء",
    changeSellerButton: "🔄 تغيير البائع",
    confirmed: "✅ تم التأكيد",
    pleaseConfirm: "⚠️ يرجى تأكيد البيانات أعلاه قبل إرسال رسائل بالتذكرة.",
    bothConfirmedNext: "✅ أكد الطرفان التفاصيل. تواصل مع فريق الدعم لاستكمال الدفع والتسليم.",
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
    onlyTicketStaff: "يمكن لصاحب التذكرة أو فريق الدعم إغلاق��ا.",
    ticketAlreadyOpen: "لديك تذكرة مفتوحة من هذا النوع بالفعل.",
  },
  en: {
    pickLang: "Choose language:",
    pickDelivery: "Choose delivery type:",
    deliveryPlaceholder: "Delivery type",
    modalTitle: "Robux Order Details",
  usernameLabel: "Roblox username (3-20 letters, digits, or _)",
  quantityLabel: "Quantity (1000 or ١٠٠٠)",
  invalidUsername: "❌ Enter a valid Roblox username: 3-20 letters, digits, or _. Display names are not accepted.",
  invalidQuantity: "❌ Enter a whole number greater than zero, such as 1000.",
    pickSeller: "Choose a seller:",
    sellerOption: (rate, qty, minimum, maximum) => `${rate} SAR/1,000 • stock ${qty} • ${minimum}-${maximum}`,
    offerUpdated: "This offer changed on the website. Current price, stock, and limits are updated; review and confirm again.",
    offerNoLongerAvailable: "This offer no longer matches the current quantity or limits. Ask the buyer to choose another seller.",
    ticketCreated: (channelMention) => `✅ Your ticket is open: ${channelMention}`,
    linkedAccountRequired: (siteUrl) => `❌ Your Discord account is not linked. Sign in at ${siteUrl} with Discord, then try again.`,
    accountDisabled: "⛔ Your site account is disabled. Contact support.",
    sellerUnlinked: "⚠️ The selected seller has not linked Discord. Choose another seller.",
    noSellers: (quantity, delivery) => `😔 No other seller is currently available for **${quantity}** via **${DELIVERY_LABELS[delivery].en}**.`,
    ownOfferOnly: (name, rate, stock, minimum, maximum) => `✅ Your website offer is active: **${name}** — price **${rate} SAR/1,000**, stock **${stock}**, limits **${minimum}–${maximum}**. It is not listed as a seller because this Discord account owns the offer; you cannot buy from yourself. Other buyers will see it when their quantity and delivery type match.`,
    onlyBuyerCanConfirm: "⚠️ Only the buyer can confirm order details or cancel the order.",
    onlySellerCanConfirm: "⚠️ Only the selected seller can confirm seller details.",
    alreadyConfirmed: "Both parties have confirmed this order; it can no longer be changed.",
    cancelled: "❌ The buyer cancelled the order. This ticket will close.",
    pickNewSeller: "Choose a new seller:",
    noSellersForChange: "😔 No other seller is available for the same quantity and delivery type.",
    sellerChanged: "✅ Seller changed. The buyer and new seller must confirm the details.",
    expired: "⏰ The 30-minute confirmation window expired. This ticket has been closed.",
    orderEmbedTitle: "📦 Order Details",
    sellerEmbedTitle: "🧑‍💼 Seller Info",
    confirmButton: "Confirm",
    cancelButton: "❌ Cancel",
    changeSellerButton: "🔄 Change Seller",
    confirmed: "✅ Confirmed",
    pleaseConfirm: "⚠️ Please confirm the info above before sending messages in this ticket.",
    bothConfirmedNext: "✅ Both parties confirmed the details. Contact support to continue with payment and delivery.",
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
    buyerProfileId: ticket.buyerProfileId || null,
    sellerDiscordId: ticket.sellerDiscordId || null,
    sellerProfileId: ticket.sellerProfileId || null,
    offerId: ticket.offerId || null,
    sellerName: ticket.sellerName || null,
    orderMessageId: ticket.orderMessageId || null,
    sellerMessageId: ticket.sellerMessageId || null,
    username: ticket.username || null,
    quantity: ticket.quantity || null,
    deliveryType: ticket.deliveryType || null,
    rate: ticket.rate ?? null,
    available: ticket.available ?? null,
    minAmount: ticket.minAmount ?? null,
    maxAmount: ticket.maxAmount ?? null,
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
    if (!ticket.id || !ticket.buyerId || !Number.isFinite(Number(ticket.createdAt)) || !["ar", "en"].includes(ticket.lang) || !["robux", "limiteds", "items", "accounts", "support"].includes(ticket.kind)) return null;
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
const confirmationReminderAt = new Map();
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

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    cache: "no-store",
    ...options,
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed with status ${response.status}`);
  return response.json();
}

async function getProfileByDiscordId(discordId) {
  const rows = await supabaseRequest("rpc/get_profile_by_discord_id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_discord_id: discordId }),
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getDiscordIdByProfileId(profileId) {
  const discordId = await supabaseRequest("rpc/get_discord_id_by_profile_id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: profileId }),
  });
  return typeof discordId === "string" && /^\d{17,20}$/.test(discordId) ? discordId : null;
}

async function getActiveOffers() {
  const offers = await supabaseRequest("rpc/active_offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return Array.isArray(offers) ? offers : [];
}

function offerMatchesOrder(offer, deliveryType, quantity, buyerProfileId, includeBuyerOffer = false) {
  const available = Number(offer.available);
  const minimum = Number(offer.min_amount);
  const maximum = Number(offer.max_amount);
  const rate = Number(offer.rate);
  return (
    (includeBuyerOffer || offer.seller_id !== buyerProfileId) &&
    Array.isArray(offer.delivery) &&
    offer.delivery.includes(deliveryType) &&
    Number.isFinite(available) && available >= quantity &&
    Number.isFinite(minimum) && minimum <= quantity &&
    Number.isFinite(maximum) && maximum >= quantity &&
    Number.isFinite(rate) && rate > 0
  );
}

async function searchOffers(deliveryType, quantity, buyerProfileId, includeBuyerOffer = false) {
  return (await getActiveOffers())
    .filter((offer) => offerMatchesOrder(offer, deliveryType, quantity, buyerProfileId, includeBuyerOffer))
    .sort((left, right) => Number(left.rate) - Number(right.rate) || Number(right.rating) - Number(left.rating))
    .slice(0, 25);
}

function hasOfferSnapshotChanged(ticket, offer) {
  return (
    Number(ticket.rate) !== Number(offer.rate) ||
    Number(ticket.available) !== Number(offer.available) ||
    Number(ticket.minAmount) !== Number(offer.min_amount) ||
    Number(ticket.maxAmount) !== Number(offer.max_amount) ||
    ticket.sellerName !== (offer.username || "Seller")
  );
}

function updateTicketOfferSnapshot(ticket, offer) {
  ticket.sellerName = offer.username || "Seller";
  ticket.rate = Number(offer.rate);
  ticket.available = Number(offer.available);
  ticket.minAmount = Number(offer.min_amount);
  ticket.maxAmount = Number(offer.max_amount);
}

function buildSellerSelectMenu(offers, lang, customId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(T[lang].pickSeller)
    .addOptions(offers.map((offer) => {
      const sellerName = offer.username || "Seller";
      const description = T[lang].sellerOption(
        Number(offer.rate).toLocaleString("en-US"),
        Number(offer.available).toLocaleString("en-US"),
        Number(offer.min_amount).toLocaleString("en-US"),
        Number(offer.max_amount).toLocaleString("en-US")
      ).slice(0, 100);
      return {
        label: sellerName.slice(0, 100),
        description,
        value: offer.id,
      };
    }));
  return new ActionRowBuilder().addComponents(menu);
}

function buildRobuxTicketEmbeds(ticket) {
  const lang = ticket.lang;
  const orderEmbed = new EmbedBuilder()
    .setColor(ticket.orderConfirmed ? 0x22c55e : 0x2b2d31)
    .setTitle(T[lang].orderEmbedTitle)
    .addFields(
      { name: lang === "ar" ? "يوزرنيم روبلوكس" : "Roblox username", value: ticket.username, inline: true },
      { name: lang === "ar" ? "الكمية" : "Quantity", value: Number(ticket.quantity).toLocaleString("en-US"), inline: true },
      { name: lang === "ar" ? "نوع التسليم" : "Delivery", value: DELIVERY_LABELS[ticket.deliveryType][lang], inline: true }
    );
  if (ticket.orderConfirmed) orderEmbed.addFields({ name: "\u200b", value: T[lang].confirmed });

  const rate = Number(ticket.rate);
  const sellerFields = [
    { name: lang === "ar" ? "البائع" : "Seller", value: `<@${ticket.sellerDiscordId}>`, inline: true },
    { name: lang === "ar" ? "السعر لكل 1,000" : "Rate per 1,000", value: `${rate.toLocaleString("en-US")} ${lang === "ar" ? "ريال" : "SAR"}`, inline: true },
    { name: lang === "ar" ? "الإجمالي" : "Order total", value: `${((Number(ticket.quantity) / 1000) * rate).toFixed(2)} ${lang === "ar" ? "ريال" : "SAR"}`, inline: true },
  ];
  if (ticket.available != null) {
    sellerFields.push({ name: lang === "ar" ? "المتاح الآن" : "Current stock", value: Number(ticket.available).toLocaleString("en-US"), inline: true });
  }
  if (ticket.minAmount != null) {
    sellerFields.push({ name: lang === "ar" ? "الحد الأدنى" : "Minimum", value: Number(ticket.minAmount).toLocaleString("en-US"), inline: true });
  }
  if (ticket.maxAmount != null) {
    sellerFields.push({ name: lang === "ar" ? "الحد الأعلى" : "Maximum", value: Number(ticket.maxAmount).toLocaleString("en-US"), inline: true });
  }
  const sellerEmbed = new EmbedBuilder()
    .setColor(ticket.sellerConfirmed ? 0x22c55e : 0x2b2d31)
    .setTitle(T[lang].sellerEmbedTitle)
    .addFields(sellerFields);
  if (ticket.sellerConfirmed) sellerEmbed.addFields({ name: "\u200b", value: T[lang].confirmed });
  return { orderEmbed, sellerEmbed };
}

async function refreshRobuxTicketMessages(channel, ticket) {
  const { orderEmbed, sellerEmbed } = buildRobuxTicketEmbeds(ticket);
  if (ticket.orderMessageId) {
    const orderMessage = await channel.messages.fetch(ticket.orderMessageId).catch(() => null);
    if (orderMessage) {
      const components = ticket.orderConfirmed ? [] : [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm:order:${ticket.id}`).setLabel(T[ticket.lang].confirmButton).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`cancel:order:${ticket.id}`).setLabel(T[ticket.lang].cancelButton).setStyle(ButtonStyle.Danger)
        ),
      ];
      await orderMessage.edit({ embeds: [orderEmbed], components });
    }
  }
  if (ticket.sellerMessageId) {
    const sellerMessage = await channel.messages.fetch(ticket.sellerMessageId).catch(() => null);
    if (sellerMessage) {
      const components = ticket.sellerConfirmed ? [] : [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm:seller:${ticket.id}`).setLabel(T[ticket.lang].confirmButton).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`changeseller:seller:${ticket.id}`).setLabel(T[ticket.lang].changeSellerButton).setStyle(ButtonStyle.Secondary)
        ),
      ];
      await sellerMessage.edit({ content: `<@${ticket.sellerDiscordId}>`, embeds: [sellerEmbed], components });
    }
  }
}

async function createRobuxTicket(interaction, data) {
  const { lang, buyerId, sellerDiscordId, sellerProfileId, sellerName, offerId, username, quantity, deliveryType, rate, available, minAmount, maxAmount } = data;
  const guild = interaction.guild;
  const ticketId = generateTicketId();
  const participantPermissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: buyerId, type: OverwriteType.Member, allow: participantPermissions },
    { id: sellerDiscordId, type: OverwriteType.Member, allow: participantPermissions },
    {
      id: interaction.client.user.id,
      type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  for (const roleId of [...new Set([SUPPORT_ROLE_ID, SALER_ROLE_ID].filter(Boolean))]) {
    permissionOverwrites.push({ id: roleId, type: OverwriteType.Role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
  }

  let channel;
  const ticket = {
    id: ticketId,
    kind: "robux",
    lang,
    buyerId,
    buyerProfileId: data.buyerProfileId,
    sellerDiscordId,
    sellerProfileId,
    sellerName,
    offerId,
    username,
    quantity,
    deliveryType,
    rate,
    available,
    minAmount,
    maxAmount,
    guildId: guild.id,
    orderConfirmed: false,
    sellerConfirmed: false,
    createdAt: Date.now(),
  };

  try {
    channel = await guild.channels.create({
      name: `${lang === "ar" ? "طلب" : "order"}-${ticketId}`,
      type: ChannelType.GuildText,
      parent: TICKETS_CATEGORY_ID || undefined,
      permissionOverwrites,
    });
    ticket.channelId = channel.id;
    const { orderEmbed, sellerEmbed } = buildRobuxTicketEmbeds(ticket);
    const orderMessage = await channel.send({ content: `<@${buyerId}>`, embeds: [orderEmbed], allowedMentions: { users: [buyerId] } });
    const sellerMessage = await channel.send({ content: `<@${sellerDiscordId}>`, embeds: [sellerEmbed], allowedMentions: { users: [sellerDiscordId] } });
    ticket.orderMessageId = orderMessage.id;
    ticket.sellerMessageId = sellerMessage.id;
    await channel.send(T[lang].pleaseConfirm);
    await persistTicket(channel, ticket);
    activeTickets.set(channel.id, ticket);
    await refreshRobuxTicketMessages(channel, ticket);
    scheduleRobuxTicketTimeout(channel, ticket);
    await sendTicketOpenedDm(interaction.client, buyerId, ticketId, channel.id, guild.id, lang);
    await sendTicketOpenedDm(interaction.client, sellerDiscordId, ticketId, channel.id, guild.id, lang);
    return channel;
  } catch (error) {
    if (channel) await channel.delete().catch(() => {});
    activeTickets.delete(channel?.id);
    throw error;
  }
}

async function expireRobuxTicket(channel, ticket) {
  if (activeTickets.get(channel.id) !== ticket || (ticket.orderConfirmed && ticket.sellerConfirmed)) return;
  await channel.send(T[ticket.lang].expired).catch(() => {});
  await closeTicketChannel(channel, ticket);
}

function scheduleRobuxTicketTimeout(channel, ticket) {
  if (ticket.kind !== "robux" || (ticket.orderConfirmed && ticket.sellerConfirmed)) return;
  if (ticket.timeout) clearTimeout(ticket.timeout);
  const elapsed = Math.max(0, Date.now() - Number(ticket.createdAt || Date.now()));
  const remaining = Math.max(0, TICKET_TIMEOUT_MS - elapsed);
  if (!remaining) {
    void expireRobuxTicket(channel, ticket);
    return;
  }
  ticket.timeout = setTimeout(() => void expireRobuxTicket(channel, ticket), remaining);
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
      if (ticket.kind === "robux" && ticket.sellerDiscordId) {
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
          ticket.orderMessageId ||= messages.find((message) => message.embeds[0]?.title === T[ticket.lang].orderEmbedTitle)?.id;
          ticket.sellerMessageId ||= messages.find((message) => message.embeds[0]?.title === T[ticket.lang].sellerEmbedTitle)?.id;
        }
        scheduleRobuxTicketTimeout(channel, ticket);
      }
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
  confirmationReminderAt.delete(channel.id);
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

const LIVE_STOCK_DELIVERIES = [
  { key: "gift", label: "بائعين روبكس In-Game Gifting" },
  { key: "gamepass", label: "بائعين روبكس Gamepass" },
  { key: "group", label: "بائعين روبكس Group Payouts" },
  { key: "plus", label: "بائعين روبكس Plus Transfer" },
];

const LIVE_STOCK_CATEGORIES = [
  { key: "account", label: "بائع حسابات Roblox Accounts", path: "/market/accounts" },
  { key: "limited", label: "بائع أغراض ليمتد Limited", path: "/market/limiteds" },
  { key: "map_item", label: "بائع أغراض مابات", path: "/market/map-items" },
];

let liveStockMessageId = "";
let liveStockRefreshing = false;

async function getActiveCatalogSellerNames() {
  const items = await supabaseRequest(
    "marketplace_catalog_items?select=seller_id,category&active=eq.true&limit=10000"
  );
  const sellerIds = [...new Set((Array.isArray(items) ? items : []).map((item) => item.seller_id))]
    .filter((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const sellers = [];

  for (let index = 0; index < sellerIds.length; index += 100) {
    const batch = sellerIds.slice(index, index + 100);
    const profiles = await supabaseRequest(
      `profiles?select=id,username,display_name&active=eq.true&id=in.(${batch.join(",")})`
    );
    if (Array.isArray(profiles)) sellers.push(...profiles);
  }

  const sellerNames = new Map(
    sellers.map((seller) => [seller.id, (seller.display_name || seller.username || "بائع").trim()])
  );
  const byCategory = new Map(LIVE_STOCK_CATEGORIES.map(({ key }) => [key, new Set()]));

  for (const item of Array.isArray(items) ? items : []) {
    const categorySellers = byCategory.get(item.category);
    const sellerName = sellerNames.get(item.seller_id);
    if (categorySellers && sellerName) categorySellers.add(sellerName);
  }

  return byCategory;
}

async function addRobuxSellerDisplayNames(offers) {
  const sellerIds = [...new Set((Array.isArray(offers) ? offers : []).map((offer) => offer.seller_id))]
    .filter((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const profiles = [];

  for (let index = 0; index < sellerIds.length; index += 100) {
    const batch = sellerIds.slice(index, index + 100);
    const rows = await supabaseRequest(
      `profiles?select=id,username,display_name&active=eq.true&id=in.(${batch.join(",")})`
    );
    if (Array.isArray(rows)) profiles.push(...rows);
  }

  const displayNames = new Map(
    profiles.map((profile) => [profile.id, (profile.display_name || profile.username || "بائع").trim()])
  );
  return (Array.isArray(offers) ? offers : []).map((offer) => ({
    ...offer,
    username: displayNames.get(offer.seller_id) || offer.username || "بائع",
  }));
}

function escapeStockName(value) {
  return String(value).replace(/[\\*_~|]/g, "\\$&").slice(0, 80);
}

function stockFieldValue(lines) {
  if (!lines.length) return "لا يوجد بائعون متاحون حاليًا.";

  const visible = [];
  let length = 0;
  for (const line of lines) {
    if (length + line.length + (visible.length ? 1 : 0) > 750) break;
    visible.push(line);
    length += line.length + (visible.length > 1 ? 1 : 0);
  }

  const remaining = lines.length - visible.length;
  if (remaining > 0) visible.push(`و${remaining} بائعين آخرين`);
  return visible.join("\n");
}

function buildLiveStockEmbed(offers, catalogSellers) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("المخزون المباشر | SwiftRBX")
    .setDescription(`الأسعار والكميات والحدود من عروض المتجر المنشورة. تتم المزامنة تلقائيًا كل ${LIVE_STOCK_REFRESH_MS / 1000} ثانية.`)
    .setFooter({ text: LIVE_STOCK_MARKER })
    .setTimestamp();

  for (const delivery of LIVE_STOCK_DELIVERIES) {
    const lines = (Array.isArray(offers) ? offers : [])
      .filter((offer) => Array.isArray(offer.delivery) && offer.delivery.includes(delivery.key))
      .map((offer) => {
        const available = Number(offer.available);
        const minimum = Number(offer.min_amount);
        const listedMaximum = Number(offer.max_amount);
        const rate = Number(offer.rate);
        const maximum = Math.min(listedMaximum, available);
        return { offer, available, minimum, maximum, rate };
      })
      .filter(({ available, minimum, maximum, rate }) =>
        Number.isFinite(available) && available > 0 &&
        Number.isFinite(minimum) && minimum > 0 &&
        Number.isFinite(maximum) && maximum >= minimum &&
        Number.isFinite(rate) && rate > 0
      )
      .sort((left, right) =>
        left.rate - right.rate || String(left.offer.username || "").localeCompare(String(right.offer.username || ""))
      )
      .map(({ offer, available, minimum, maximum, rate }) => {
        const formattedRate = rate.toLocaleString("en-US", { maximumFractionDigits: 2 });
        const formattedMinimum = Math.floor(minimum).toLocaleString("en-US");
        const formattedMaximum = Math.floor(maximum).toLocaleString("en-US");
        const formattedAvailable = Math.floor(available).toLocaleString("en-US");
        return `**${escapeStockName(offer.username || "بائع")}** — (1k / ${formattedRate} ريال) — الحد ${formattedMinimum}–${formattedMaximum} — المتاح ${formattedAvailable}`;
      });

    embed.addFields({ name: delivery.label, value: stockFieldValue(lines) });
  }

  for (const category of LIVE_STOCK_CATEGORIES) {
    const sellers = [...(catalogSellers.get(category.key) || [])].sort((left, right) => left.localeCompare(right, "ar"));
    const value = sellers.length
      ? stockFieldValue(sellers.map((seller) => `• ${escapeStockName(seller)}`))
      : "لا يوجد بائعون لديهم منشورات نشطة حاليًا.";
    embed.addFields({
      name: `[${category.label}](${SITE_URL}${category.path})`,
      value,
    });
  }

  return embed;
}

function liveStockEmbedsMatch(current, next) {
  const comparable = (embed) => {
    const json = embed.toJSON();
    return JSON.stringify({
      title: json.title,
      description: json.description,
      color: json.color,
      fields: json.fields,
      footer: json.footer,
    });
  };
  return current && comparable(current) === comparable(next);
}

async function refreshLiveStock(client) {
  if (liveStockRefreshing) return;
  liveStockRefreshing = true;

  try {
    const [activeOffers, catalogSellers] = await Promise.all([
      getActiveOffers(),
      getActiveCatalogSellerNames(),
    ]);
    const offers = await addRobuxSellerDisplayNames(activeOffers);
    const channel = await client.channels.fetch(LIVE_STOCK_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !channel.messages) {
      throw new Error("قناة المخزون المباشر غير صالحة أو لا تدعم الرسائل.");
    }

    let message = null;
    if (liveStockMessageId) {
      try {
        message = await channel.messages.fetch(liveStockMessageId);
      } catch (error) {
        if (error.code !== 10008 && error.status !== 404) throw error;
        liveStockMessageId = "";
      }
    }

    if (!message) {
      const recent = await channel.messages.fetch({ limit: 100 });
      message = recent.find(
        (candidate) => candidate.author.id === client.user.id && candidate.embeds[0]?.footer?.text === LIVE_STOCK_MARKER
      ) || null;
    }

    const embed = buildLiveStockEmbed(offers, catalogSellers);
    if (!message) {
      message = await channel.send({ embeds: [embed] });
      console.log("تم نشر رسالة المخزون المباشر في Discord.");
    } else if (!liveStockEmbedsMatch(message.embeds[0], embed)) {
      await message.edit({ embeds: [embed] });
      console.log("تم تحديث رسالة المخزون المباشر في Discord.");
    }

    liveStockMessageId = message.id;
  } catch (error) {
    console.error("تعذّر تحديث المخزون المباشر:", error.message);
  } finally {
    liveStockRefreshing = false;
  }
}

const NOTIFICATION_ROLES = [
  { id: "1432719590240157818", name: "News", description: "إشعار بالإعلانات." },
  { id: "1432719653192470648", name: "Giveaways", description: "إشعار بالسحوبات." },
  { id: "1433104934936514630", name: "Events", description: "إشعار بالفعاليات والمسابقات." },
  { id: "1437100449353433232", name: "discounts", description: "إشعار بالعروض والخصومات." },
  { id: "1432719713586249789", name: "Robux Stock alert", description: "إشعار بتوفر كميات روبكس جديدة." },
  { id: "1558416839170596988", name: "Account Alert", description: "إشعار بإضافة حسابات جديدة." },
  { id: "1558416938529726464", name: "Limiteds Alert", description: "إشعار بإضافة أغراض ليمتد جديدة." },
  { id: "1558416980204195870", name: "Games Alert", description: "إشعار بإضافة أغراض مابات جديدة." },
];

function buildSelectRolesPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("إعداد إشعارات SwiftRBX")
    .setDescription(
      [
        "اختر الرتب التي تريد استقبال إشعاراتها في قنواتها المخصصة.",
        "اختر رتبة من القائمة لإضافتها، واخترها مرة أخرى لإزالتها.",
      ].join("\n")
    )
    .addFields(
      {
        name: "الأخبار والمجتمع",
        value: NOTIFICATION_ROLES.slice(0, 4).map(({ name, description }) => `**${name}** — ${description}`).join("\n"),
      },
      {
        name: "تنبيهات المخزون",
        value: NOTIFICATION_ROLES.slice(4).map(({ name, description }) => `**${name}** — ${description}`).join("\n"),
      }
    )
    .setFooter({ text: SELECT_ROLES_MARKER });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("notification-role-toggle")
    .setPlaceholder("اختر رتبة لإضافة الإشعار أو إزالته")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      NOTIFICATION_ROLES.map(({ id, name }) => ({
        label: name,
        value: id,
      }))
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

async function ensureSelectRolesPanel(client) {
  try {
    const channel = await client.channels.fetch(SELECT_ROLES_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !channel.messages) {
      throw new Error("قناة اختيار الرتب غير صالحة أو لا تدعم الرسائل.");
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const panel = messages.find(
      (message) => message.author.id === client.user.id && message.embeds[0]?.footer?.text === SELECT_ROLES_MARKER
    );
    const payload = buildSelectRolesPanel();

    if (panel) {
      await panel.edit(payload);
      console.log("تم التحقق من رسالة اختيار الرتب في Discord.");
    } else {
      await channel.send(payload);
      console.log("تم نشر رسالة اختيار الرتب في Discord.");
    }
  } catch (error) {
    console.error("تعذّر تجهيز رسالة اختيار الرتب:", error.message);
  }
}

const notificationRoleToggles = new Set();

async function toggleNotificationRole(interaction, roleId) {
  if (!interaction.guild) {
    await interaction.reply({ content: "اختر الرتب من داخل السيرفر.", flags: MessageFlags.Ephemeral });
    return;
  }

  const lockKey = `${interaction.guildId}:${interaction.user.id}:${roleId}`;
  if (notificationRoleToggles.has(lockKey)) {
    await interaction.reply({ content: "جارٍ تنفيذ طلبك السابق؛ حاول مجددًا بعد لحظة.", flags: MessageFlags.Ephemeral });
    return;
  }

  notificationRoleToggles.add(lockKey);
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const roleDefinition = NOTIFICATION_ROLES.find((role) => role.id === roleId);
    const [role, member, botMember] = await Promise.all([
      interaction.guild.roles.fetch(roleId),
      interaction.guild.members.fetch(interaction.user.id),
      interaction.guild.members.me || interaction.guild.members.fetch(client.user.id),
    ]);

    if (!roleDefinition || !role) {
      await interaction.editReply("هذه الرتبة غير متاحة حاليًا.");
      return;
    }
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !role.editable) {
      await interaction.editReply("تعذّر تعديل الرتبة. يحتاج البوت إلى صلاحية إدارة الرتب وأن تكون الرتبة أسفل أعلى رتبة له.");
      return;
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role, "إلغاء الاشتراك في إشعار اختاره المستخدم");
      await interaction.editReply(`تم إلغاء رتبة **${roleDefinition.name}** وإيقاف إشعاراتها.`);
    } else {
      await member.roles.add(role, "اشتراك المستخدم في إشعار اختاره");
      await interaction.editReply(`تمت إضافة رتبة **${roleDefinition.name}** وستصلك إشعاراتها.`);
    }
  } catch (error) {
    console.error("تعذّر تبديل رتبة الإشعار:", error.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("تعذّر تحديث الرتبة الآن. تأكد من صلاحيات البوت وحاول مجددًا.").catch(() => {});
    } else {
      await interaction.reply({ content: "تعذّر تحديث الرتبة الآن. حاول مجددًا.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  } finally {
    notificationRoleToggles.delete(lockKey);
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
  await ensureSelectRolesPanel(c);
  await refreshLiveStock(c);
  setInterval(() => refreshLiveStock(c), LIVE_STOCK_REFRESH_MS);
});



client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "notification-role-toggle") {
      const roleId = interaction.values[0];
      if (!NOTIFICATION_ROLES.some((role) => role.id === roleId)) {
        await interaction.reply({ content: "هذا الخيار غير صالح.", flags: MessageFlags.Ephemeral });
        return;
      }
      await toggleNotificationRole(interaction, roleId);
      return;
    }

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
        const profile = await getProfileByDiscordId(interaction.user.id);
        if (!profile) {
          await interaction.editReply(T[lang].linkedAccountRequired(SITE_URL));
          return;
        }
        if (profile.active === false) {
          await interaction.editReply(T[lang].accountDisabled);
          return;
        }
        pendingOrders.set(interaction.user.id, {
          guildId: interaction.guildId,
          buyerProfileId: profile.id,
          createdAt: Date.now(),
        });
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
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > PENDING_ORDER_TIMEOUT_MS) {
        pendingOrders.delete(interaction.user.id);
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
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > PENDING_ORDER_TIMEOUT_MS || !DELIVERY_LABELS[deliveryType]) {
        pendingOrders.delete(interaction.user.id);
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
        .setMaxLength(20);
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
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > PENDING_ORDER_TIMEOUT_MS || !state.buyerProfileId || !DELIVERY_LABELS[state.deliveryType]) {
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply("انتهت صلاحية الطلب، ابدأ من جديد.");
        return;
      }

      const username = interaction.fields.getTextInputValue("username").trim();
      const quantityRaw = interaction.fields.getTextInputValue("quantity").trim()
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
        .replace(/[٬,]/g, "");
      if (!isValidRobloxUsername(username)) {
        await interaction.editReply(T[lang].invalidUsername);
        return;
      }
      if (!/^\d{1,10}$/.test(quantityRaw)) {
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
        const offers = await searchOffers(state.deliveryType, quantity, state.buyerProfileId);
        if (!offers.length) {
          const ownOffers = await searchOffers(state.deliveryType, quantity, state.buyerProfileId, true);
          const ownOffer = ownOffers.find((offer) => offer.seller_id === state.buyerProfileId);
          pendingOrders.delete(interaction.user.id);
          if (ownOffer) {
            await interaction.editReply(T[lang].ownOfferOnly(
              ownOffer.username || "Seller",
              Number(ownOffer.rate).toLocaleString("en-US"),
              Number(ownOffer.available).toLocaleString("en-US"),
              Number(ownOffer.min_amount).toLocaleString("en-US"),
              Number(ownOffer.max_amount).toLocaleString("en-US")
            ));
          } else {
            await interaction.editReply(T[lang].noSellers(quantity.toLocaleString("en-US"), state.deliveryType));
          }
          return;
        }
        state.username = username;
        state.quantity = quantity;
        state.offers = offers;
        pendingOrders.set(interaction.user.id, state);
        await interaction.editReply({
          content: T[lang].pickSeller,
          components: [buildSellerSelectMenu(offers, lang, "order:seller")],
        });
      } catch (error) {
        console.error("تعذّر البحث عن عروض الروبكس:", error.message);
        await interaction.editReply("تعذّر البحث عن البائعين حالياً. حاول مرة أخرى بعد قليل.");
      } finally {
        openingTickets.delete(openingKey);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "order:seller") {
      const state = pendingOrders.get(interaction.user.id);
      const lang = state?.lang || "ar";
      if (!state || state.guildId !== interaction.guildId || Date.now() - state.createdAt > PENDING_ORDER_TIMEOUT_MS || !state.buyerProfileId || !state.offers?.length || !state.username || !state.quantity || !DELIVERY_LABELS[state.deliveryType]) {
        pendingOrders.delete(interaction.user.id);
        await interaction.update({ content: "انتهت صلاحية الطلب، ابدأ من جديد.", components: [] });
        return;
      }

      await interaction.deferUpdate();
      const openTickets = [...activeTickets.values()].filter((ticket) => ticket.guildId === interaction.guildId && ticket.buyerId === interaction.user.id);
      if (openTickets.length >= MAX_OPEN_TICKETS_PER_USER || openTickets.some((ticket) => ticket.kind === "robux")) {
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply({ content: ticketLimitMessage(lang), components: [] });
        return;
      }
      const offerId = interaction.values[0];
      const openingKey = `${interaction.guildId}:${interaction.user.id}`;
      if (openingTickets.has(openingKey)) {
        await interaction.editReply({ content: ticketLimitMessage(lang), components: [] });
        return;
      }
      openingTickets.add(openingKey);
      try {
        const offers = await searchOffers(state.deliveryType, state.quantity, state.buyerProfileId);
        const offer = offers.find((candidate) => candidate.id === offerId);
        if (!offer) {
          await interaction.editReply({ content: T[lang].noSellers(state.quantity.toLocaleString("en-US"), state.deliveryType), components: [] });
          return;
        }
        const sellerDiscordId = await getDiscordIdByProfileId(offer.seller_id);
        if (!sellerDiscordId || sellerDiscordId === interaction.user.id) {
          await interaction.editReply({ content: T[lang].sellerUnlinked, components: [] });
          return;
        }

        const channel = await createRobuxTicket(interaction, {
          lang,
          buyerId: interaction.user.id,
          buyerProfileId: state.buyerProfileId,
          sellerDiscordId,
          sellerProfileId: offer.seller_id,
          sellerName: offer.username || "Seller",
          offerId: offer.id,
          username: state.username,
          quantity: state.quantity,
          deliveryType: state.deliveryType,
          rate: Number(offer.rate),
          available: Number(offer.available),
          minAmount: Number(offer.min_amount),
          maxAmount: Number(offer.max_amount),
        });
        pendingOrders.delete(interaction.user.id);
        await interaction.editReply({ content: T[lang].ticketCreated(channel.toString()), components: [] });
      } catch (error) {
        console.error("فشل فتح تذكرة الروبكس:", error.message);
        await interaction.editReply({ content: "تعذّر فتح التذكرة. حاول مجدداً أو تواصل مع الدعم.", components: [] });
      } finally {
        openingTickets.delete(openingKey);
      }
      return;
    }


    if (interaction.isButton() && interaction.customId.startsWith("confirm:")) {
      const [, part, ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.kind !== "robux" || ticket.id !== ticketId || !ticket.sellerDiscordId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.reply({ content: T[ticket.lang].alreadyConfirmed, flags: MessageFlags.Ephemeral });
        return;
      }
      if (part === "order" && interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[ticket.lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }
      if (part === "seller" && interaction.user.id !== ticket.sellerDiscordId) {
        await interaction.reply({ content: T[ticket.lang].onlySellerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }
      if (part !== "order" && part !== "seller") return;

      await interaction.deferUpdate();
      const activeOffers = await getActiveOffers();
      const currentOffer = activeOffers.find((offer) => offer.id === ticket.offerId && offer.seller_id === ticket.sellerProfileId);
      if (!currentOffer) {
        await interaction.followUp({ content: T[ticket.lang].offerNoLongerAvailable, flags: MessageFlags.Ephemeral });
        return;
      }
      const snapshotChanged = hasOfferSnapshotChanged(ticket, currentOffer);
      const stillAvailable = offerMatchesOrder(currentOffer, ticket.deliveryType, ticket.quantity, ticket.buyerProfileId);
      if (snapshotChanged) {
        updateTicketOfferSnapshot(ticket, currentOffer);
        ticket.orderConfirmed = false;
        ticket.sellerConfirmed = false;
        await persistTicket(interaction.channel, ticket);
        await refreshRobuxTicketMessages(interaction.channel, ticket);
        const message = stillAvailable ? T[ticket.lang].offerUpdated : T[ticket.lang].offerNoLongerAvailable;
        await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
        return;
      }
      if (!stillAvailable) {
        await interaction.followUp({ content: T[ticket.lang].offerNoLongerAvailable, flags: MessageFlags.Ephemeral });
        return;
      }
      if (part === "order") ticket.orderConfirmed = true;
      else ticket.sellerConfirmed = true;
      await persistTicket(interaction.channel, ticket);
      await refreshRobuxTicketMessages(interaction.channel, ticket);

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        if (ticket.timeout) clearTimeout(ticket.timeout);
        await interaction.channel.setName(`${ticket.lang === "ar" ? "مؤكد" : "confirmed"}-${ticket.id}`.slice(0, 90)).catch(() => {});
        await interaction.channel.send(T[ticket.lang].bothConfirmedNext);
        await persistTicket(interaction.channel, ticket);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("cancel:")) {
      const ticketId = interaction.customId.split(":")[2];
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.kind !== "robux" || ticket.id !== ticketId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.reply({ content: T[ticket.lang].alreadyConfirmed, flags: MessageFlags.Ephemeral });
        return;
      }
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[ticket.lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferUpdate();
      await interaction.channel.send(T[ticket.lang].cancelled);
      await closeTicketChannel(interaction.channel, ticket);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("changeseller:")) {
      const ticketId = interaction.customId.split(":")[2];
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.kind !== "robux" || ticket.id !== ticketId || !ticket.buyerProfileId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.reply({ content: T[ticket.lang].alreadyConfirmed, flags: MessageFlags.Ephemeral });
        return;
      }
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[ticket.lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const offers = (await searchOffers(ticket.deliveryType, ticket.quantity, ticket.buyerProfileId))
        .filter((offer) => offer.seller_id !== ticket.sellerProfileId);
      if (!offers.length) {
        await interaction.editReply(T[ticket.lang].noSellersForChange);
        return;
      }
      ticket.pendingOffers = offers;
      ticket.pendingOffersAt = Date.now();
      await interaction.editReply({
        content: T[ticket.lang].pickNewSeller,
        components: [buildSellerSelectMenu(offers, ticket.lang, `changesellersel:${ticket.id}`)],
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("changesellersel:")) {
      const ticketId = interaction.customId.split(":")[1];
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.kind !== "robux" || ticket.id !== ticketId || !ticket.pendingOffers || Date.now() - ticket.pendingOffersAt > PENDING_ORDER_TIMEOUT_MS) {
        await interaction.update({ content: "انتهت صلاحية هذا الاختيار.", components: [] });
        return;
      }
      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.update({ content: T[ticket.lang].alreadyConfirmed, components: [] });
        return;
      }
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.update({ content: T[ticket.lang].onlyBuyerCanConfirm, components: [] });
        return;
      }

      const offerId = interaction.values[0];
      const selectedOffer = ticket.pendingOffers.find((offer) => offer.id === offerId);
      delete ticket.pendingOffers;
      if (!selectedOffer) {
        await interaction.update({ content: "صار خطأ تقني، حاول مرة ثانية.", components: [] });
        return;
      }
      await interaction.deferUpdate();

      const currentOffers = await searchOffers(ticket.deliveryType, ticket.quantity, ticket.buyerProfileId);
      const offer = currentOffers.find((candidate) => candidate.id === offerId && candidate.seller_id !== ticket.sellerProfileId);
      if (!offer) {
        await interaction.editReply({ content: T[ticket.lang].noSellersForChange, components: [] });
        return;
      }
      const newSellerDiscordId = await getDiscordIdByProfileId(offer.seller_id);
      if (!newSellerDiscordId || newSellerDiscordId === ticket.buyerId) {
        await interaction.editReply({ content: T[ticket.lang].sellerUnlinked, components: [] });
        return;
      }

      const previousSellerDiscordId = ticket.sellerDiscordId;
      const previousSellerState = {
        sellerDiscordId: ticket.sellerDiscordId,
        sellerProfileId: ticket.sellerProfileId,
        sellerName: ticket.sellerName,
        offerId: ticket.offerId,
        rate: ticket.rate,
        available: ticket.available,
        minAmount: ticket.minAmount,
        maxAmount: ticket.maxAmount,
        sellerConfirmed: ticket.sellerConfirmed,
        createdAt: ticket.createdAt,
      };
      await interaction.channel.permissionOverwrites.edit(newSellerDiscordId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
      ticket.sellerDiscordId = newSellerDiscordId;
      ticket.sellerProfileId = offer.seller_id;
      ticket.offerId = offer.id;
      updateTicketOfferSnapshot(ticket, offer);
      ticket.sellerConfirmed = false;

      ticket.createdAt = Date.now();
      try {
        await persistTicket(interaction.channel, ticket);
      } catch (error) {
        Object.assign(ticket, previousSellerState);
        if (previousSellerDiscordId !== newSellerDiscordId) {
          await interaction.channel.permissionOverwrites.delete(newSellerDiscordId).catch(() => {});
        }
        throw error;
      }
      if (previousSellerDiscordId !== newSellerDiscordId) {
        await interaction.channel.permissionOverwrites.delete(previousSellerDiscordId).catch((error) => {
          console.error("تعذّر إزالة صلاحية البائع السابق:", error.message);
        });
      }
      scheduleRobuxTicketTimeout(interaction.channel, ticket);
      await refreshRobuxTicketMessages(interaction.channel, ticket);
      await interaction.channel.send({ content: `<@${newSellerDiscordId}>`, allowedMentions: { users: [newSellerDiscordId] } });
      await interaction.channel.send(T[ticket.lang].sellerChanged);
      await sendTicketOpenedDm(interaction.client, newSellerDiscordId, ticket.id, interaction.channelId, interaction.guildId, ticket.lang);
      await interaction.editReply({ content: T[ticket.lang].sellerChanged, components: [] });
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

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const ticket = activeTickets.get(message.channel.id);
  if (!ticket || ticket.kind !== "robux" || (ticket.orderConfirmed && ticket.sellerConfirmed)) return;
  if (message.author.id !== ticket.buyerId && message.author.id !== ticket.sellerDiscordId) return;

  const lastReminder = confirmationReminderAt.get(message.channel.id) || 0;
  if (Date.now() - lastReminder < 15_000) return;
  confirmationReminderAt.set(message.channel.id, Date.now());
  await message.reply({ content: T[ticket.lang].pleaseConfirm, allowedMentions: { repliedUser: false } }).catch(() => {});
});

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

client.login(DISCORD_TOKEN).catch((error) => {
  console.error("فشل تسجيل دخول البوت إلى Discord:", error.message);
  process.exitCode = 1;
});
