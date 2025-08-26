const axios = require('axios')
const User = require('../models/User')

const BOT = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID

const api = axios.create({ baseURL: `https://api.telegram.org/bot${BOT}` })

async function send(chatId, text) {
  if (!BOT || !chatId) return
  try {
    await api.post('/sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  } catch (e) {
    console.error('[Telegram] send failed:', e?.response?.data || e.message)
  }
}

async function notifyAdmin(text) {
  return send(ADMIN_CHAT_ID, text)
}

async function notifyChefs(text, kitchenId = null) {
  const filter = {
    role: 'CHEF',
    isActive: true,
    telegramChatId: { $exists: true, $ne: null }
  }
  if (kitchenId) filter.kitchenId = kitchenId
  const chefs = await User.find(filter).select('telegramChatId').lean()
  await Promise.all(chefs.map(c => send(c.telegramChatId, text)))
}

module.exports = { send, notifyAdmin, notifyChefs }
