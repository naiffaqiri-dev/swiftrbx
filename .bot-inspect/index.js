/**
 * SwiftRBX System Bot - المرحلة 1
 * - ينشر لوحة التذاكر (4 أزرار) بالقناة المحددة.
 * - عند ضغط أي زر يتحقق هل حساب ديسكورد مربوط بحساب بالموقع.
 *   (فتح التذاكر الفعلي يجي بالمرحلة القادمة)
 */

require("dotenv").config();

const path = require("node:path");

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
      ].join("\n")
    )
    .setImage(`attachment://${PANEL_BANNER_FILENAME}`)
    .setFooter({ text: PANEL_MARKER });

  const row = new ActionRowBuilder().addComponents(
    Object.entries(TICKET_TYPES).map(([key, type]) =>
      new ButtonBuilder()
        .setCustomId(`ticket:${key}`)
        .setLabel(type.label)
        .setEmoji(type.emoji)
        .setStyle(type.style)
    )
  );

  const banner = new AttachmentBuilder(PANEL_BANNER_PATH, { name: PANEL_BANNER_FILENAME });

  return { embeds: [embed], components: [row], files: [banner] };
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
  },
};

function generateTicketId() {
  return crypto.randomBytes(5).toString("base64url").slice(0, 7);
}

// حالة التذاكر المفتوحة بالذاكرة: channelId -> { ... }
const activeTickets = new Map();

// حالة مؤقتة بالذاكرة لكل عضو أثناء تعبئة نموذج الطلب (تُمسح بعد إعادة تشغيل البوت)
const pendingOrders = new Map();

async function searchOffers(deliveryType, quantity) {
  const url = `${SUPABASE_URL}/rest/v1/offers`;
  const params = new URLSearchParams({
    select: "id,seller_id,rate,available,min_amount,max_amount,profiles(username,display_name)",
    delivery_type: `eq.${deliveryType}`,
    active: "eq.true",
    available: `gte.${quantity}`,
    min_amount: `lte.${quantity}`,
    max_amount: `gte.${quantity}`,
    order: "rate.asc",
    limit: "25",
  });
  const res = await fetch(`${url}?${params.toString()}`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

async function getDiscordIdByProfileId(profileId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_discord_id_by_profile_id`, {
    method: "POST",
    headers: { apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user_id: profileId }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
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
  const viewOnly = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];

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
    permissionOverwrites.push({ id: SUPPORT_ROLE_ID, type: OverwriteType.Role, allow: viewOnly });
  }
  if (SALER_ROLE_ID) {
    permissionOverwrites.push({ id: SALER_ROLE_ID, type: OverwriteType.Role, allow: viewOnly });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKETS_CATEGORY_ID || undefined,
    permissionOverwrites,
  });

  const ticket = {
    id: ticketId,
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
    orderConfirmed: false,
    sellerConfirmed: false,
    createdAt: Date.now(),
  };

  const { orderEmbed, sellerEmbed } = buildTicketEmbeds(ticket);
  const orderMsg = await channel.send({ content: `<@${buyerId}>`, embeds: [orderEmbed] });
  const sellerMsg = await channel.send({ content: `<@${sellerDiscordId}>`, embeds: [sellerEmbed] });
  await channel.send(T[lang].pleaseConfirm);

  ticket.orderMessageId = orderMsg.id;
  ticket.sellerMessageId = sellerMsg.id;
  activeTickets.set(channel.id, ticket);
  await refreshTicketConfirmMessage(channel, ticket);

  ticket.timeout = setTimeout(async () => {
    const t = activeTickets.get(channel.id);
    if (!t || (t.orderConfirmed && t.sellerConfirmed)) return;
    activeTickets.delete(channel.id);
    await channel.send(T[lang].expired).catch(() => {});
    setTimeout(() => channel.delete().catch(() => {}), 10_000);
  }, TICKET_TIMEOUT_MS);

  await sendTicketOpenedDm(interaction.client, buyerId, ticketId, channel.id, guild.id, lang);
  await sendTicketOpenedDm(interaction.client, sellerDiscordId, ticketId, channel.id, guild.id, lang);

  return channel;
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text}`);
  }

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
    // 1) زر من اللوحة الرئيسية
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
      const typeKey = interaction.customId.split(":")[1];
      const type = TICKET_TYPES[typeKey];
      if (!type) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const profile = await requireLinkedProfile(interaction);
      if (!profile) return;

      if (typeKey === "robux") {
        pendingOrders.set(interaction.user.id, {});
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("order:lang:ar").setLabel("العربية").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("order:lang:en").setLabel("English").setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ content: "اختر اللغة / Choose language:", components: [row] });
        return;
      }

      const name = profile.display_name || profile.username;
      await interaction.editReply(
        `✅ حسابك مربوط باسم **${name}**.\n` +
          `طلب **${type.label}**: فتح التذكرة بيتفعّل بالتحديث القادم.`
      );
      return;
    }

    // ------------------------------------------------------------------
    // 2) اختيار اللغة -> عرض نوع التسليم
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("order:lang:")) {
      const lang = interaction.customId.split(":")[2] === "en" ? "en" : "ar";
      pendingOrders.set(interaction.user.id, { lang });

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
      const state = pendingOrders.get(interaction.user.id) || { lang: "ar" };
      const deliveryType = interaction.values[0];
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
    // 4) إرسال Modal -> البحث عن بائعين مطابقين
    // ------------------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === "order:detailsmodal") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const state = pendingOrders.get(interaction.user.id) || { lang: "ar" };
      const lang = state.lang || "ar";
      const username = interaction.fields.getTextInputValue("username").trim();
      const quantityRaw = interaction.fields.getTextInputValue("quantity").trim();
      const quantity = Number.parseInt(quantityRaw, 10);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        await interaction.editReply(T[lang].invalidQuantity);
        return;
      }

      state.username = username;
      state.quantity = quantity;
      pendingOrders.set(interaction.user.id, state);

      const offers = await searchOffers(state.deliveryType, quantity);
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
      if (!state || !state.offers) {
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

      const sellerDiscordId = await getDiscordIdByProfileId(offer.seller_id);
      if (!sellerDiscordId) {
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
        console.error("فشل إنشاء التذكرة:", e);
        await interaction.followUp({
          content: "صار خطأ أثناء فتح التذكرة، حاول مرة ثانية أو تواصل مع الدعم.",
          flags: MessageFlags.Ephemeral,
        });
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

      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      if (part === "order") ticket.orderConfirmed = true;
      else if (part === "seller") ticket.sellerConfirmed = true;
      else return;

      await interaction.deferUpdate();
      await refreshTicketConfirmMessage(interaction.channel, ticket, part);

      if (ticket.orderConfirmed && ticket.sellerConfirmed) {
        if (ticket.timeout) clearTimeout(ticket.timeout);
        const newName = lang === "ar" ? `تم-التأكيد-${ticket.id}` : `confirmed-${ticket.id}`;
        await interaction.channel.setName(newName).catch(() => {});
        await interaction.channel.send(T[lang].bothConfirmedNext);
      }
      return;
    }

    // ------------------------------------------------------------------
    // 7) زر إلغاء الطلب (المشتري بس)
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("cancel:")) {
      const [, , ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lang = ticket.lang;
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      if (ticket.timeout) clearTimeout(ticket.timeout);
      activeTickets.delete(interaction.channelId);
      await interaction.deferUpdate();
      await interaction.channel.send(T[lang].cancelled);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 8_000);
      return;
    }

    // ------------------------------------------------------------------
    // 8) زر تغيير البائع (المشتري بس) -> قائمة بائعين جدد
    // ------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("changeseller:")) {
      const [, , ticketId] = interaction.customId.split(":");
      const ticket = activeTickets.get(interaction.channelId);
      if (!ticket || ticket.id !== ticketId) {
        await interaction.reply({ content: "هذه التذكرة غير نشطة.", flags: MessageFlags.Ephemeral });
        return;
      }
      const lang = ticket.lang;
      if (interaction.user.id !== ticket.buyerId) {
        await interaction.reply({ content: T[lang].onlyBuyerCanConfirm, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const offers = (await searchOffers(ticket.deliveryType, ticket.quantity)).filter(
        (o) => o.seller_id !== ticket.sellerProfileId
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
      if (!newSellerDiscordId) {
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