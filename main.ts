import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "npm:@whiskeysockets/baileys@6.4.0"

const OWNER_NAME = "Rehan"
const OWNER_NUMBER = "947xxxxxxxx@s.whatsapp.net"
const BOT_NAME = "CR_MINI_BOT"
const PREFIX = "."

let sock: any = null

const pairHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CR_MINI_BOT</title><style>body{background:#0f0f0f;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh} .box{background:#1a1a1a;padding:40px;border-radius:20px;text-align:center} h1{color:#ff006e} input,button{width:100%;padding:15px;margin:10px 0;border-radius:10px;border:none} button{background:#ff006e;color:white;cursor:pointer} #code{display:none;margin-top:20px;font-size:24px;color:#ff006e}</style></head><body><div class="box"><h1>⚡ CR_MINI_BOT</h1><input id="num" placeholder="947xxxxxxxx"><button onclick="pair()">Get Code</button><div id="code"></div></div><script>async function pair(){const n=document.getElementById('num').value;const r=await fetch('/pair',{method:'POST',body:JSON.stringify({number:n})});const d=await r.json();if(d.code){document.getElementById('code').style.display='block';document.getElementById('code').innerText=d.code}}</script></body></html>`

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session")
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop")
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log(`${BOT_NAME} Connected!`)
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const cmd = body.startsWith(PREFIX)? body.slice(1).split(" ")[0].toLowerCase() : ""

        if (cmd === "alive") {
            await sock.sendMessage(from, { text: `*${BOT_NAME} Alive!*\n*Owner:* ${OWNER_NAME}` }, { quoted: m })
        }
        if (cmd === "ping") {
            await sock.sendMessage(from, { text: `*Pong!* ${BOT_NAME}` }, { quoted: m })
        }
    })
}

serve(async (req) => {
    const url = new URL(req.url)
    if (url.pathname === "/" && req.method === "GET") {
        return new Response(pairHTML, { headers: { "content-type": "text/html" } })
    }
    if (url.pathname === "/pair" && req.method === "POST") {
        const { number } = await req.json()
        if (!sock) return new Response(JSON.stringify({ error: "Bot not ready" }), { status: 500 })
        try {
            if (!sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(number)
                return new Response(JSON.stringify({ code }))
            }
            return new Response(JSON.stringify({ error: "Already paired" }))
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }))
        }
    }
    return new Response("CR_MINI_BOT Running")
}, { port: 8000 })

startBot()
