const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys")
const express = require("express")
const pino = require("pino")
const fs = require("fs")
const path = require("path")
const moment = require("moment-timezone")

const app = express()
const PORT = process.env.PORT || 3000
app.use(express.static("public"))
app.use(express.json())

// ============ BOT CONFIG ============
const OWNER_NAME = "Rehan" // ඔයාගේ නම
const OWNER_NUMBER = "947xxxxxxxx@s.whatsapp.net" // ඔයාගේ number 94xxxxx@s.whatsapp.net
const BOT_NAME = "CR_MINI_BOT" // Bot name
const PREFIX = "."
const VERSION = "2.0.0"

let sock = null
let pairCode = null

// ============ PAIR SITE ============
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pair.html"))
})

app.post("/pair", async (req, res) => {
    const { number } = req.body
    if (!sock) return res.status(500).json({ error: "Bot not ready" })
    try {
        if (!sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(number)
            pairCode = code
            res.json({ code: code })
        } else {
            res.json({ error: "Already paired" })
        }
    } catch (e) {
        res.json({ error: e.message })
    }
})

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session")

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: true
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            console.log("Disconnected, reconnecting...")
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log(`${BOT_NAME} Connected!`)
            await sock.sendMessage(OWNER_NUMBER, { 
                text: `*${BOT_NAME} Online ✅*\n\n*Version:* ${VERSION}\n*Time:* ${moment().tz("Asia/Colombo").format("HH:mm:ss")}\n*Date:* ${moment().tz("Asia/Colombo").format("DD/MM/YYYY")}\n\nBot is ready!` 
            })
        }
    })

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type!== "notify") return
        const m = messages[0]
        if (!m.message || m.key.fromMe) return

        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const command = body.startsWith(PREFIX)? body.slice(1).trim().split(" ")[0].toLowerCase() : ""
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const sender = m.key.participant || from
        const pushname = m.pushName || "User"
        const isGroup = from.endsWith("@g.us")

        if (!command) return

        // ============ COMMANDS ============
        switch (command) {
            case "alive":
                await sock.sendMessage(from, {
                    text: `*╭───「 ${BOT_NAME} 」───*\n*│*\n*├ 🧑‍💻 Owner:* ${OWNER_NAME}\n*├ ⚡ Version:* ${VERSION}\n*├ 📍 Prefix:* ${PREFIX}\n*├ 🕐 Time:* ${moment().tz("Asia/Colombo").format("HH:mm:ss")}\n*├ 📅 Date:* ${moment().tz("Asia/Colombo").format("DD/MM/YYYY")}\n*├ ⏱️ Uptime:* ${runtime(process.uptime())}\n*├ 🌐 Mode:* Public\n*│*\n*╰───「 ACTIVE 」───*\n\n_Type ${PREFIX}menu for commands_`
                }, { quoted: m })
                break

            case "menu":
            case "help":
                const menuText = `*╭───「 ${BOT_NAME} 」───*
*│*
*├ 🧑‍💻 Owner:* ${OWNER_NAME}
*├ ⚡ Version:* ${VERSION}
*├ 📍 Prefix:* ${PREFIX}
*├ 🕐 Time:* ${moment().tz("Asia/Colombo").format("HH:mm:ss")}
*├ 👤 User:* ${pushname}
*│*
*├─「 CORE 」*
*│.alive - Bot status*
*│.ping - Speed test*
*│.owner - Owner info*
*│.menu - Command list*
*│.info - Bot details*
*│*
*├─「 FUN 」*
*│.chatu - Random chatu*
*│.joke - Sinhala jokes*
*│.quote - Motivation*
*│.fact - Sinhala facts*
*│.meme - Random meme*
*│*
*├─「 TOOLS 」*
*│.calc - Calculator*
*│.time - SL time*
*│.weather - Weather*
*│.translate - Translate*
*│*
*├─「 DOWNLOAD 」*
*│.ytmp3 - YT audio*
*│.ytmp4 - YT video*
*│.tiktok - TikTok dl*
*│.fb - FB video dl*
*│*
*╰───「 200+ CMD 」───*

*${BOT_NAME} by ${OWNER_NAME}*`
                await sock.sendMessage(from, { text: menuText }, { quoted: m })
                break

            case "ping":
                const start = Date.now()
                const msg = await sock.sendMessage(from, { text: "*Testing speed...*" }, { quoted: m })
                const end = Date.now()
                await sock.sendMessage(from, { text: `*🏓 Pong!*\n\n*Response:* ${end - start}ms\n*Status:* Fast ✅\n\n*${BOT_NAME}*` }, { quoted: msg })
                break

            case "owner":
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${OWNER_NAME}\nORG:${BOT_NAME};\nTEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER.split("@")[0]}:+${OWNER_NUMBER.split("@")[0]}\nEND:VCARD`
                await sock.sendMessage(from, {
                    contacts: { displayName: OWNER_NAME, contacts: [{ vcard }] }
                }, { quoted: m })
                await sock.sendMessage(from, { 
                    text: `*╭───「 OWNER INFO 」───*\n*│*\n*├ Name:* ${OWNER_NAME}\n*├ Bot:* ${BOT_NAME}\n*├ Contact:* wa.me/${OWNER_NUMBER.split("@")[0]}\n*│*\n*╰───「 ${BOT_NAME} 」───*` 
                })
                break

            case "info":
                await sock.sendMessage(from, {
                    text: `*╭───「 ${BOT_NAME} 」───*\n*│*\n*├ Name:* ${BOT_NAME}\n*├ Version:* ${VERSION}\n*├ Owner:* ${OWNER_NAME}\n*├ Runtime:* Node.js\n*├ Library:* Baileys MD\n*├ Prefix:* ${PREFIX}\n*├ Platform:* Linux\n*├ Uptime:* ${runtime(process.uptime())}\n*│*\n*╰───「 MINI BOT 」───*`
                }, { quoted: m })
                break

            case "chatu":
                const chatu = [
                    `${BOT_NAME} ඉන්නකම් පාලුවක් නෑ නේ 😏`,
                    "මොකෝ බන්? ${BOT_NAME} එක්ක chat කරන්න ආසද? 😂",
                    `${OWNER_NAME} මාව හැදුවේ උබලට හිනා වෙන්න 🤣`,
                    "පාන් කෑවද? ${BOT_NAME} අහනවා 🍞",
                    "CR කියන්නේ Crazy Rehan නෙවේ හොඳේ 😎",
                    "${BOT_NAME} - Chat + Run Mini Bot 🤖",
                    "Mini කිව්වට මම පොඩි නෑ හොඳේ 😤",
                    "${OWNER_NAME}ට කියලා update එකක් දාන්න කියපන් 😭"
                ]
                await sock.sendMessage(from, { text: chatu[Math.floor(Math.random() * chatu.length)] }, { quoted: m })
                break

            case "joke":
                const jokes = [
                    "ගුරුවරයා: ${BOT_NAME} කියන්නේ මොකක්ද?\nළමයා: Chat කරන Robot\nගුරුවරයා: හරියට හරි! 😂",
                    "${OWNER_NAME}: මම bot කෙනෙක් හැදුවා\nයාලුවා: නම මොකක්ද?\n${OWNER_NAME}: ${BOT_NAME}\nයාලුවා: නම මරුවට තියෙනවා 😂",
                    "Patient: Doctor මට ${BOT_NAME} addiction\nDoctor: ඒකට බේතක් නෑ, enjoy කරන්න 😭"
                ]
                await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] }, { quoted: m })
                break

            case "quote":
                const quotes = [
                    "${BOT_NAME} වගේ fast වෙන්න, life එකේ slow වෙන්න එපා.",
                    "${OWNER_NAME} වගේ හීන දකින්න, ${BOT_NAME} වගේ ඒවා හැබෑ කරගන්න.",
                    "Code ලියනවා වගේ නෙවේ life එක, bug එකක් ආවම restart කරන්න බෑ.",
                    "${BOT_NAME} - නිකන් bot කෙනෙක් නෙවේ, emotions තියෙන machine එකක් 🔥"
                ]
                await sock.sendMessage(from, { text: `*💬 ${BOT_NAME} Quote:*\n\n_${quotes[Math.floor(Math.random() * quotes.length)]}_` }, { quoted: m })
                break

            default:
                break
        }
    })
}

function runtime(seconds) {
    seconds = Number(seconds)
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor(seconds % (3600 * 24) / 3600)
    const m = Math.floor(seconds % 3600 / 60)
    const s = Math.floor(seconds % 60)
    return `${d}d ${h}h ${m}m ${s}s`
}

app.listen(PORT, () => {
    console.log(`${BOT_NAME} Server running on ${PORT}`)
    startBot()
})