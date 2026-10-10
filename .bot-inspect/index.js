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
const { deflateRawSync, inflateRawSync } = require("node:zlib");

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
const TRANSCRIPTS_CHANNEL_ID = "1426198826724888577";
const TRANSFER_CONFIRMATIONS_CHANNEL_ID = "1558441717743751169";
const TICKET_TIMEOUT_MS = 30 * 60 * 1000;
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000;
const PAYMENT_RECEIPT_POLL_MS = 15_000;
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
    onlySellerCanConfirm: "⚠️ تأكيد بيانات الطلب والبائع متاح لصاحب الطلب فقط.",
    alreadyConfirmed: "تم تأكيد الطلب بالكامل ولا يمكن تعديله.",
    cancelled: "❌ ألغى المشتري الطلب. سيتم إغلاق التذكرة.",
    pickNewSeller: "اختر البائع الجديد:",
    noSellersForChange: "😔 لا يوجد بائع آخر متاح لنفس الكمية وطريقة التسليم.",
    sellerChanged: "✅ تم تغيير البائع. على المشتري تأكيد تفاصيل الطلب وبيانات البائع من جديد.",
    expired: "⏰ انتهت مهلة التأكيد (30 دقيقة)، وتم إغلاق التذكرة.",
    orderEmbedTitle: "📦 تفاصيل الطلب",
    sellerEmbedTitle: "🧑‍💼 بيانات البائع",
    confirmButton: "تأكيد تفاصيل الطلب",
    confirmSellerButton: "تأكيد بيانات البائع",
    paymentRetryButton: "إعادة تجهيز رابط الدفع",
    cancelButton: "❌ إلغاء",
    changeSellerButton: "🔄 تغيير البائع",
    confirmed: "✅ تم التأكيد",
    pleaseConfirm: "⚠️ يرجى تأكيد البيانات أعلاه قبل إرسال رسائل بالتذكرة.",
    bothConfirmedNext: "✅ تم تأكيد بيانات الطلب والبائع بواسطة المشتري. استخدم رابط الدفع أدناه خلال ساعة؛ بعدها تُلغى التذكرة تلقائيًا.",
    paymentLinkTitle: "💳 تأكيد الطلب ورابط الدفع",
    paymentLinkDescription: (amount) => `تم اعتماد بيانات الطلب. حوّل **${amount} ريال** عبر الموقع وأرسل الإيصال خلال ساعة. الرابط مخصص للمشتري ويُستخدم مرة واحدة.`,
    paymentExpired: "⏰ انتهت مهلة الدفع (ساعة)، وأُلغيت التذكرة.",
    paymentSubmitted: "✅ وصل إيصال التحويل إلى الإدارة للمراجعة. ستبقى التذكرة مفتوحة حتى متابعة التسليم.",
    paymentReceiptTitle: "🧾 إيصال تحويل طلب Discord",
    paymentReceiptDm: "✅ استلمنا إيصال التحويل وأرسلناه إلى الإدارة للمراجعة.",
    paymentReviewButton: "مراجعة الطلب",
    receiptButton: "عرض الإيصال",
    ticketCreatedTranscript: "بدأ سجل التذكرة.",
    ticketClosedTranscript: "أُغلقت التذكرة.",
    ticketDeletedTranscript: "حُذفت قناة التذكرة.",
    dmConfirmedTitle: "✅ تم تأكيد التذكرة",
    dmConfirmedBody: (id, url) => `تم تأكيد الطلب والبائع بواسطة المشتري. رقم التذكرة: **${id}**\n[فتح التذكرة](${url})`,
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
    onlySellerCanConfirm: "⚠️ Only the buyer can confirm the order and seller details.",
    alreadyConfirmed: "The order is fully confirmed and can no longer be changed.",
    cancelled: "❌ The buyer cancelled the order. This ticket will close.",
    pickNewSeller: "Choose a new seller:",
    noSellersForChange: "😔 No other seller is available for the same quantity and delivery type.",
    sellerChanged: "✅ Seller changed. The buyer must confirm the order and seller details again.",
    expired: "⏰ The 30-minute confirmation window expired. This ticket has been closed.",
    orderEmbedTitle: "📦 Order Details",
    sellerEmbedTitle: "🧑‍💼 Seller Info",
    confirmButton: "Confirm order details",
    confirmSellerButton: "Confirm seller details",
    paymentRetryButton: "Retry payment link",
    cancelButton: "❌ Cancel",
    changeSellerButton: "🔄 Change Seller",
    confirmed: "✅ Confirmed",
    pleaseConfirm: "⚠️ Please confirm the info above before sending messages in this ticket.",
    bothConfirmedNext: "✅ The buyer confirmed the order and seller details. Use the payment link below within one hour; the ticket will be cancelled after that.",
    paymentLinkTitle: "💳 Confirmed order and payment link",
    paymentLinkDescription: (amount) => `The order details are confirmed. Transfer **${amount} SAR** on the website and submit the receipt within one hour. This buyer-only link can be used once.`,
    paymentExpired: "⏰ The one-hour payment window expired and the ticket was cancelled.",
    paymentSubmitted: "✅ The transfer receipt reached the team for review. This ticket will remain open for delivery follow-up.",
    paymentReceiptTitle: "🧾 Discord order transfer receipt",
    paymentReceiptDm: "✅ Your transfer receipt was received and sent to the team for review.",
    paymentReviewButton: "Review order",
    receiptButton: "View receipt",
    ticketCreatedTranscript: "Ticket transcript started.",
    ticketClosedTranscript: "Ticket closed.",
    ticketDeletedTranscript: "Ticket channel deleted.",
    dmConfirmedTitle: "✅ Ticket confirmed",
    dmConfirmedBody: (id, url) => `The buyer confirmed the order and seller details. Ticket: **${id}**\n[Open ticket](${url})`,
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

const TICKET_TOPIC_MARKER = "swiftrbx-ticket-v2:";
const LEGACY_TICKET_TOPIC_MARKER = "swiftrbx-ticket-v1:";
const CLOSED_TICKET_TOPIC_MARKER = "swiftrbx-closed-v2:";

function encodeClosedTicketTopic(ticket) {
  return [
    CLOSED_TICKET_TOPIC_MARKER,
    ticket.lang,
    ticket.id,
    ticket.buyerId,
    ticket.sellerDiscordId || "",
    ticket.transcriptThreadId || "",
    ticket.guildId || "",
  ].join(":");
}

function decodeClosedTicketTopic(topic, channelId) {
  if (!topic?.startsWith(CLOSED_TICKET_TOPIC_MARKER)) return null;
  const [, lang, id, buyerId, sellerDiscordId, transcriptThreadId, guildId] = topic.split(":");
  if (!id || !buyerId || !["ar", "en"].includes(lang)) return null;
  return { id, kind: "closed", lang, buyerId, sellerDiscordId: sellerDiscordId || null, transcriptThreadId: transcriptThreadId || null, guildId, channelId };
}

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
    paymentToken: ticket.paymentToken || null,
    paymentExpiresAt: ticket.paymentExpiresAt || null,
    paymentStatus: ticket.paymentStatus || null,
    paymentMessageId: ticket.paymentMessageId || null,
    paymentConfirmDmsSent: !!ticket.paymentConfirmDmsSent,
    paymentConfirmDmsSentTo: Array.isArray(ticket.paymentConfirmDmsSentTo) ? ticket.paymentConfirmDmsSentTo : [],
    transcriptThreadId: ticket.transcriptThreadId || null,
    createdAt: ticket.createdAt,
  };
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(persisted)), { level: 9 }).toString("base64url");
  const topic = `${TICKET_TOPIC_MARKER}${compressed}`;
  if (topic.length > 1024) throw new Error(`Compressed ticket metadata exceeds Discord topic limit (${topic.length} characters)`);
  return topic;
}

function decodeTicketTopic(topic) {
  if (!topic?.startsWith(TICKET_TOPIC_MARKER) && !topic?.startsWith(LEGACY_TICKET_TOPIC_MARKER)) return null;
  try {
    const isCompressed = topic.startsWith(TICKET_TOPIC_MARKER);
    const marker = isCompressed ? TICKET_TOPIC_MARKER : LEGACY_TICKET_TOPIC_MARKER;
    const payload = Buffer.from(topic.slice(marker.length), "base64url");
    const json = isCompressed ? inflateRawSync(payload).toString("utf8") : payload.toString("utf8");
    const ticket = JSON.parse(json);
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

async function getTranscriptThread(client, ticket) {
  if (ticket.transcriptThreadId) {
    const existing = await client.channels.fetch(ticket.transcriptThreadId).catch(() => null);
    if (existing?.isThread?.()) {
      if (existing.archived) await existing.setArchived(false).catch(() => {});
      return existing;
    }
  }

  const archive = await client.channels.fetch(TRANSCRIPTS_CHANNEL_ID);
  if (!archive?.isTextBased?.() || !archive.threads) throw new Error("قناة transcripts غير صالحة أو لا تدعم سلاسل المحادثات.");
  const thread = await archive.threads.create({
    name: `ticket-${ticket.id}`.slice(0, 100),
    autoArchiveDuration: 1440,
    reason: `Transcript for ticket ${ticket.id}`,
  });
  ticket.transcriptThreadId = thread.id;
  const source = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (source && "setTopic" in source) await persistTicket(source, ticket);
  return thread;
}

async function recordTicketLifecycle(client, ticket, key, description) {
  try {
    const thread = await getTranscriptThread(client, ticket);
    const title = ticket.lang === "ar" ? `سجل التذكرة • ${ticket.id}` : `Ticket transcript • ${ticket.id}`;
    const embed = new EmbedBuilder()
      .setColor(key === "created" ? 0x22c55e : key === "deleted" ? 0xed4245 : 0x5865f2)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: ticket.lang === "ar" ? "المشتري" : "Buyer", value: `<@${ticket.buyerId}>`, inline: true },
        ...(ticket.sellerDiscordId ? [{ name: ticket.lang === "ar" ? "البائع" : "Seller", value: `<@${ticket.sellerDiscordId}>`, inline: true }] : []),
        { name: ticket.lang === "ar" ? "القناة" : "Channel", value: `<#${ticket.channelId}>`, inline: true }
      )
      .setTimestamp();
    await thread.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("تعذّر حفظ transcript للتذكرة:", ticket.id, error.message);
  }
}

async function mirrorTicketMessage(message, ticket) {
  if (message.author?.bot) return;
  try {
    const thread = await getTranscriptThread(message.client, ticket);
    const parts = [message.content?.trim()].filter(Boolean);
    for (const attachment of message.attachments.values()) parts.push(`[مرفق: ${attachment.url}]`);
    for (const embed of message.embeds) {
      const text = [embed.title, embed.description].filter(Boolean).join("\n");
      if (text) parts.push(`[Embed]\n${text}`);
    }
    const body = parts.join("\n").slice(0, 6000) || "[رسالة بدون نص]";
    await thread.send({
      content: `**${message.author.tag}** • <t:${Math.floor(message.createdTimestamp / 1000)}:f>\n${body}`.slice(0, 2000),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error("تعذّر نسخ رسالة إلى transcript:", message.id, error.message);
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

function robuxTicketTotal(ticket) {
  return +((Number(ticket.quantity) / 1000) * Number(ticket.rate)).toFixed(2);
}

async function sendTicketConfirmationDms(client, channel, ticket) {
  const recipients = [ticket.buyerId, ticket.sellerDiscordId].filter(Boolean);
  const sentTo = new Set(
    Array.isArray(ticket.paymentConfirmDmsSentTo)
      ? ticket.paymentConfirmDmsSentTo.length || !ticket.paymentConfirmDmsSent
        ? ticket.paymentConfirmDmsSentTo
        : recipients
      : ticket.paymentConfirmDmsSent ? recipients : []
  );
  const url = `https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`;
  for (const discordId of recipients) {
    if (sentTo.has(discordId)) continue;
    try {
      const user = await client.users.fetch(discordId);
      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(T[ticket.lang].dmConfirmedTitle)
        .setDescription(T[ticket.lang].dmConfirmedBody(ticket.id, url));
      await user.send({ embeds: [embed] });
      sentTo.add(discordId);
      ticket.paymentConfirmDmsSentTo = [...sentTo];
      await persistTicket(channel, ticket);
    } catch (error) {
      console.log(`تعذّر إرسال تأكيد التذكرة في الخاص لـ ${discordId}: ${error.message}`);
    }
  }
  ticket.paymentConfirmDmsSent = recipients.every((discordId) => sentTo.has(discordId));
  ticket.paymentConfirmDmsSentTo = [...sentTo];
  await persistTicket(channel, ticket);
}

const paymentIssuancePromises = new Map();

async function issueTicketPayment(client, channel, ticket) {
  const pendingIssuance = paymentIssuancePromises.get(ticket.id);
  if (pendingIssuance) return pendingIssuance;

  const issuance = issueTicketPaymentOnce(client, channel, ticket);
  paymentIssuancePromises.set(ticket.id, issuance);
  try {
    return await issuance;
  } finally {
    if (paymentIssuancePromises.get(ticket.id) === issuance) paymentIssuancePromises.delete(ticket.id);
  }
}

async function issueTicketPaymentOnce(client, channel, ticket) {
  if (ticket.paymentStatus === "submitted") return;
  if (!ticket.paymentToken) ticket.paymentToken = crypto.randomBytes(32).toString("base64url");
  if (!ticket.paymentExpiresAt) ticket.paymentExpiresAt = Date.now() + PAYMENT_TIMEOUT_MS;
  ticket.paymentStatus = "issued";
  await persistTicket(channel, ticket);
  scheduleRobuxTicketTimeout(channel, ticket);

  const total = robuxTicketTotal(ticket);
  const payload = {
    ticket_id: ticket.id,
    guild_id: ticket.guildId,
    channel_id: ticket.channelId,
    buyer_discord_id: ticket.buyerId,
    seller_discord_id: ticket.sellerDiscordId,
    buyer_id: ticket.buyerProfileId,
    seller_id: ticket.sellerProfileId,
    offer_id: ticket.offerId,
    roblox_username: ticket.username,
    robux_amount: Number(ticket.quantity),
    delivery_method: ticket.deliveryType,
    seller_name: ticket.sellerName,
    unit_rate: Number(ticket.rate),
    total_sar: total,
    token_hash: crypto.createHash("sha256").update(ticket.paymentToken).digest("hex"),
    expires_at: new Date(ticket.paymentExpiresAt).toISOString(),
    status: "issued",
  };
  await supabaseRequest("discord_ticket_payments?on_conflict=ticket_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });

  const paymentUrl = `${SITE_URL}/checkout?discordTicketPayment=${encodeURIComponent(ticket.paymentToken)}`;
  let paymentMessage = ticket.paymentMessageId
    ? await channel.messages.fetch(ticket.paymentMessageId).catch(() => null)
    : null;
  if (!paymentMessage) {
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    paymentMessage = recent?.find((message) => message.embeds[0]?.footer?.text === `SwiftRBX • one-time payment • ${ticket.id}`) || null;
  }

  if (!paymentMessage) {
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle(T[ticket.lang].paymentLinkTitle)
      .setDescription(T[ticket.lang].paymentLinkDescription(total.toFixed(2)))
      .addFields(
        { name: ticket.lang === "ar" ? "رقم الطلب" : "Ticket", value: ticket.id, inline: true },
        { name: ticket.lang === "ar" ? "حساب روبلوكس" : "Roblox username", value: ticket.username, inline: true },
        { name: ticket.lang === "ar" ? "الكمية" : "Quantity", value: `${Number(ticket.quantity).toLocaleString("en-US")} R$`, inline: true },
        { name: ticket.lang === "ar" ? "البائع" : "Seller", value: `<@${ticket.sellerDiscordId}> (${ticket.sellerName})`, inline: true },
        { name: ticket.lang === "ar" ? "نوع التسليم" : "Delivery", value: DELIVERY_LABELS[ticket.deliveryType][ticket.lang], inline: true },
        { name: ticket.lang === "ar" ? "الإجمالي" : "Total", value: `${total.toFixed(2)} ${ticket.lang === "ar" ? "ريال" : "SAR"}`, inline: true },
        { name: ticket.lang === "ar" ? "المهلة" : "Payment deadline", value: `<t:${Math.floor(ticket.paymentExpiresAt / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `SwiftRBX • one-time payment • ${ticket.id}` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(ticket.lang === "ar" ? "الدفع في الموقع" : "Pay on website").setStyle(ButtonStyle.Link).setURL(paymentUrl)
    );
    paymentMessage = await channel.send({
      content: `<@${ticket.buyerId}> <@${ticket.sellerDiscordId}>`,
      embeds: [embed],
      components: [row],
      allowedMentions: { users: [ticket.buyerId, ticket.sellerDiscordId] },
    });
  }

  ticket.paymentMessageId = paymentMessage.id;
  await sendTicketConfirmationDms(client, channel, ticket);
  await persistTicket(channel, ticket);
  scheduleRobuxTicketTimeout(channel, ticket);
}

let syncingDiscordPaymentReceipts = false;

async function syncSubmittedDiscordPayments(client) {
  if (syncingDiscordPaymentReceipts) return;
  syncingDiscordPaymentReceipts = true;
  try {
    const rows = await supabaseRequest(
      "discord_ticket_payments?status=eq.submitted&discord_notified_at=is.null&select=id,ticket_id,guild_id,channel_id,buyer_discord_id,seller_discord_id,roblox_username,robux_amount,delivery_method,seller_name,total_sar,bank_name,bank_account,bank_iban,bank_holder,receipt_url,sender_name,order_id,discord_message_id&order=created_at.asc&limit=50"
    );
    for (const payment of rows) {
      const archive = await client.channels.fetch(TRANSFER_CONFIRMATIONS_CHANNEL_ID).catch(() => null);
      if (!archive?.isTextBased?.() || !archive.messages) {
        console.error("قناة تأكيد التحويلات غير صالحة أو لا تدعم الرسائل.");
        return;
      }

      let sentMessage = payment.discord_message_id
        ? await archive.messages.fetch(payment.discord_message_id).catch(() => null)
        : null;
      const marker = `SwiftRBX • receipt • ${payment.id}`;
      if (!sentMessage) {
        const recent = await archive.messages.fetch({ limit: 100 }).catch(() => null);
        sentMessage = recent?.find((message) => message.embeds[0]?.footer?.text === marker) || null;
      }

      if (!sentMessage) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(T.ar.paymentReceiptTitle)
          .setDescription(`طلب Discord **${payment.ticket_id}** • رقم الطلب **${String(payment.order_id || "").slice(0, 8)}**`)
          .addFields(
            { name: "المشتري", value: `<@${payment.buyer_discord_id}>`, inline: true },
            { name: "البائع", value: `<@${payment.seller_discord_id}> (${payment.seller_name})`, inline: true },
            { name: "حساب روبلوكس", value: payment.roblox_username, inline: true },
            { name: "الكمية", value: `${Number(payment.robux_amount).toLocaleString("en-US")} R$`, inline: true },
            { name: "نوع التسليم", value: DELIVERY_LABELS[payment.delivery_method]?.ar || payment.delivery_method, inline: true },
            { name: "قيمة الحوالة", value: `${Number(payment.total_sar).toFixed(2)} ريال`, inline: true },
            { name: "البنك المحوّل له", value: payment.bank_name || payment.bank_key || "—", inline: true },
            { name: "الحساب / IBAN", value: [payment.bank_account, payment.bank_iban].filter(Boolean).join("\n") || "—", inline: true },
            { name: "اسم المحوّل", value: payment.sender_name || "—", inline: true }
          )
          .setFooter({ text: marker })
          .setTimestamp();
        const buttons = [];
        if (payment.receipt_url) buttons.push(new ButtonBuilder().setLabel(T.ar.receiptButton).setStyle(ButtonStyle.Link).setURL(payment.receipt_url));
        buttons.push(new ButtonBuilder().setLabel(T.ar.paymentReviewButton).setStyle(ButtonStyle.Link).setURL(`${SITE_URL}/dashboard`));
        sentMessage = await archive.send({
          content: `<@${payment.buyer_discord_id}> <@${payment.seller_discord_id}>`,
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(buttons)],
          allowedMentions: { users: [payment.buyer_discord_id, payment.seller_discord_id] },
        });
      }

      const ticket = activeTickets.get(payment.channel_id);
      if (ticket?.id === payment.ticket_id && ticket.paymentStatus !== "submitted") {
        ticket.paymentStatus = "submitted";
        ticket.paymentToken = null;
        if (ticket.timeout) clearTimeout(ticket.timeout);
        ticket.timeout = null;
        await persistTicket(await client.channels.fetch(payment.channel_id), ticket).catch(() => {});
        if (ticket.paymentMessageId) {
          const paymentMessage = await client.channels.fetch(payment.channel_id)
            .then((channel) => channel.messages.fetch(ticket.paymentMessageId))
            .catch(() => null);
          if (paymentMessage) await paymentMessage.edit({ components: [] }).catch(() => {});
        }
        const ticketChannel = await client.channels.fetch(payment.channel_id).catch(() => null);
        if (ticketChannel?.isTextBased?.()) await ticketChannel.send(T[ticket.lang].paymentSubmitted).catch(() => {});
        await recordTicketLifecycle(client, ticket, "payment", T[ticket.lang].paymentSubmitted);
        for (const discordId of [ticket.buyerId, ticket.sellerDiscordId].filter(Boolean)) {
          try {
            const user = await client.users.fetch(discordId);
            await user.send(T[ticket.lang].paymentReceiptDm);
          } catch (error) {
            console.log(`تعذّر إرسال تأكيد الإيصال في الخاص لـ ${discordId}: ${error.message}`);
          }
        }
      }

      await supabaseRequest(`discord_ticket_payments?id=eq.${encodeURIComponent(payment.id)}&discord_notified_at=is.null`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ discord_message_id: sentMessage.id, discord_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    }
  } catch (error) {
    console.error("تعذّر إرسال إيصال تحويل Discord:", error.message);
  } finally {
    syncingDiscordPaymentReceipts = false;
  }
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
      let components = [];
      if (ticket.orderConfirmed && ticket.sellerConfirmed && !ticket.paymentMessageId && ticket.paymentStatus !== "submitted") {
        components = [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm:payment:${ticket.id}`).setLabel(T[ticket.lang].paymentRetryButton).setStyle(ButtonStyle.Primary)
        )];
      } else if (!ticket.orderConfirmed) {
        components = [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm:order:${ticket.id}`).setLabel(T[ticket.lang].confirmButton).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`cancel:order:${ticket.id}`).setLabel(T[ticket.lang].cancelButton).setStyle(ButtonStyle.Danger)
        )];
      }
      await orderMessage.edit({ embeds: [orderEmbed], components });
    }
  }
  if (ticket.sellerMessageId) {
    const sellerMessage = await channel.messages.fetch(ticket.sellerMessageId).catch(() => null);
    if (sellerMessage) {
      const components = ticket.sellerConfirmed ? [] : [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm:seller:${ticket.id}`).setLabel(T[ticket.lang].confirmSellerButton).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`changeseller:seller:${ticket.id}`).setLabel(T[ticket.lang].changeSellerButton).setStyle(ButtonStyle.Secondary)
        ),
      ];
      await sellerMessage.edit({ content: `<@${ticket.buyerId}>`, embeds: [sellerEmbed], components });
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
    const sellerMessage = await channel.send({ content: `<@${buyerId}>`, embeds: [sellerEmbed], allowedMentions: { users: [buyerId] } });
    ticket.orderMessageId = orderMessage.id;
    ticket.sellerMessageId = sellerMessage.id;
    await channel.send(T[lang].pleaseConfirm);
    await persistTicket(channel, ticket);
    activeTickets.set(channel.id, ticket);
    await recordTicketLifecycle(interaction.client, ticket, "created", T[lang].ticketCreatedTranscript);
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
  if (activeTickets.get(channel.id) !== ticket) return;
  if (ticket.orderConfirmed && ticket.sellerConfirmed) {
    try {
      const sessions = await supabaseRequest(`discord_ticket_payments?ticket_id=eq.${encodeURIComponent(ticket.id)}&select=id,status`);
      const payment = sessions[0];
      if (payment?.status === "submitted") {
        ticket.paymentStatus = "submitted";
        ticket.paymentToken = null;
        await persistTicket(channel, ticket);
        if (ticket.paymentMessageId) {
          const message = await channel.messages.fetch(ticket.paymentMessageId).catch(() => null);
          if (message) await message.edit({ components: [] }).catch(() => {});
        }
        return;
      }
      if (payment?.status === "issued") {
        await supabaseRequest(`discord_ticket_payments?id=eq.${encodeURIComponent(payment.id)}&status=eq.issued`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
        });
      }
      ticket.paymentStatus = "expired";
      ticket.paymentToken = null;
      await persistTicket(channel, ticket);
      await channel.send(T[ticket.lang].paymentExpired).catch(() => {});
    } catch (error) {
      console.error("تعذّر التحقق من حالة الدفع قبل إغلاق التذكرة:", ticket.id, error.message);
      ticket.timeout = setTimeout(() => void expireRobuxTicket(channel, ticket), 60_000);
      return;
    }
  } else {
    await channel.send(T[ticket.lang].expired).catch(() => {});
  }
  await closeTicketChannel(channel, ticket);
}

function scheduleRobuxTicketTimeout(channel, ticket) {
  if (ticket.kind !== "robux") return;
  if (ticket.timeout) clearTimeout(ticket.timeout);
  const paymentStarted = ticket.orderConfirmed && ticket.sellerConfirmed;
  const deadline = paymentStarted
    ? Number(ticket.paymentExpiresAt || (Number(ticket.createdAt || Date.now()) + PAYMENT_TIMEOUT_MS))
    : Number(ticket.createdAt || Date.now()) + TICKET_TIMEOUT_MS;
  const remaining = Math.max(0, deadline - Date.now());
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
  await recordTicketLifecycle(interaction.client, ticket, "created", T[lang].ticketCreatedTranscript);

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
  if (ticket.kind === "robux" && ticket.paymentStatus === "issued") {
    await supabaseRequest(`discord_ticket_payments?ticket_id=eq.${encodeURIComponent(ticket.id)}&status=eq.issued`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
    }).catch((error) => console.error("تعذّر إلغاء رابط الدفع عند إغلاق التذكرة:", error.message));
  }
  await recordTicketLifecycle(client, ticket, "closed", T[ticket.lang].ticketClosedTranscript);
  activeTickets.delete(channel.id);
  confirmationReminderAt.delete(channel.id);
  const closedName = `${ticket.lang === "ar" ? "مغلق" : "closed"}-${ticket.id}`.slice(0, 90);
  await channel.setName(closedName).catch(() => {});
  await channel.setTopic(encodeClosedTicketTopic(ticket)).catch(() => {});
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
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ تم تسجيل الدخول باسم: ${c.user.tag}`);
  await restoreTickets(c);
  await ensurePanel(c);
  await ensureSelectRolesPanel(c);
  await refreshLiveStock(c);
  await syncSubmittedDiscordPayments(c);
  setInterval(() => refreshLiveStock(c), LIVE_STOCK_REFRESH_MS);
  setInterval(() => syncSubmittedDiscordPayments(c), PAYMENT_RECEIPT_POLL_MS);
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
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[ticket.lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      if (part === "payment") {
        if (!ticket.orderConfirmed || !ticket.sellerConfirmed) {
          await interaction.reply({ content: T[ticket.lang].pleaseConfirm, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferUpdate();
        try {
          await issueTicketPayment(interaction.client, interaction.channel, ticket);
          await refreshRobuxTicketMessages(interaction.channel, ticket);
        } catch (error) {
          console.error("تعذّر تجهيز رابط الدفع:", ticket.id, error.message);
          await interaction.followUp({ content: "تعذّر تجهيز رابط الدفع. أعد المحاولة من زر إعادة تجهيز رابط الدفع.", flags: MessageFlags.Ephemeral });
          await refreshRobuxTicketMessages(interaction.channel, ticket);
        }
        return;
      }

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        await interaction.reply({ content: T[ticket.lang].alreadyConfirmed, flags: MessageFlags.Ephemeral });
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

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        if (ticket.timeout) clearTimeout(ticket.timeout);
        await interaction.channel.setName(`${ticket.lang === "ar" ? "مؤكد" : "confirmed"}-${ticket.id}`.slice(0, 90)).catch(() => {});
        await interaction.channel.send(T[ticket.lang].bothConfirmedNext);
        try {
          await issueTicketPayment(interaction.client, interaction.channel, ticket);
        } catch (error) {
          console.error("تعذّر تجهيز رابط الدفع:", ticket.id, error.message);
          await interaction.followUp({ content: "تعذّر تجهيز رابط الدفع. أعد المحاولة من زر إعادة تجهيز رابط الدفع.", flags: MessageFlags.Ephemeral });
        }
      }
      await refreshRobuxTicketMessages(interaction.channel, ticket);
      await persistTicket(interaction.channel, ticket);
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
  if (!ticket) return;
  await mirrorTicketMessage(message, ticket);
  if (ticket.kind !== "robux" || (ticket.orderConfirmed && ticket.sellerConfirmed)) return;
  if (message.author.id !== ticket.buyerId && message.author.id !== ticket.sellerDiscordId) return;

  const lastReminder = confirmationReminderAt.get(message.channel.id) || 0;
  if (Date.now() - lastReminder < 15_000) return;
  confirmationReminderAt.set(message.channel.id, Date.now());
  await message.reply({ content: T[ticket.lang].pleaseConfirm, allowedMentions: { repliedUser: false } }).catch(() => {});
});

client.on(Events.ChannelDelete, (channel) => {
  const ticket = activeTickets.get(channel.id) || decodeClosedTicketTopic(channel.topic, channel.id);
  if (!ticket) return;
  if (ticket.timeout) clearTimeout(ticket.timeout);
  activeTickets.delete(channel.id);
  confirmationReminderAt.delete(channel.id);
  void recordTicketLifecycle(client, ticket, "deleted", T[ticket.lang].ticketDeletedTranscript);
});

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

client.login(DISCORD_TOKEN).catch((error) => {
  console.error("فشل تسجيل دخول البوت إلى Discord:", error.message);
  process.exitCode = 1;
});
