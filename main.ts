
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { BufferJSON, initAuthCreds, makeWASocket, DisconnectReason, Browsers } from "npm:@whiskeysockets/baileys@6.7.8"

// ============ CONFIG ============
const OWNER_NAME = "Rehan"
const OWNER_NUMBER = "947xxxxxxxx@s.whatsapp.net"
const BOT_NAME = "CR_MINI_BOT"
const PREFIX = "."
const VERSION = "2.0.0-DENO"

let sock: any = null
const kv = await Deno.openKv()

// ============ DENO KV AUTH STATE ============
async function useDenoKVAuthState() {
    const creds = await kv.get(["creds"])
    const credsData = creds.value? JSON.parse(creds.value as string, BufferJSON.reviver) : initAuthCreds()

    return {
        state: {
            creds: credsData,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const data: any = {}
                    for (const id of ids) {
                        const res = await kv.get([type, id])
                        if (res.value) data[id] = JSON.parse(res.value as string, BufferJSON.reviver)
                    }
                    return data
                },
                set: async (data: any) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            await kv.set([category, id], JSON.stringify(data[category][id], BufferJSON.replacer))
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await kv.set(["creds"], JSON.stringify(credsData, BufferJSON.replacer))
        }
    }
}

// ============ PAIR HTML ============
const pairHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CR_MINI_BOT - Pair</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#0f0f0f;background-image:radial-gradient(circle at 20% 50%,#ff006e 0%,transparent 50%),radial-gradient(circle at 80% 80%,#8338ec 0%,transparent 50%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
.container{background:rgba(20,20,20,0.9);padding:40px;border-radius:20px;box-shadow:0 20px 60px rgba(255,0,110,0.3);max-width:450px;width:100%;border:1px solid rgba(255,255,255,0.1)}
h1{color:#ff006e;text-align:center;margin-bottom:10px;font-size:36px;text-shadow:0 0 20px rgba(255,0,110,0.5)}
.subtitle{text-align:center;color:#aaa;margin-bottom:30px;font-size:14px}
input{width:100%;padding:15px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,0,110,0.3);border-radius:10px;font-size:16px;margin-bottom:20px;color:white}
button{width:100%;padding:15px;background:linear-gradient(135deg,#ff006e 0%,#8338ec 100%);color:white;border:none;border-radius:10px;font-size:18px;cursor:pointer;font-weight:bold}
#code{margin-top:20px;padding:20px;background:linear-gradient(135deg,#ff006e 0%,#8338ec 100%);border-radius:10px;text-align:center;font-size:32px;font-weight:bold;color:white;display:none;letter-spacing:8px}
</style></head><body>
<div class="container"><h1>⚡ CR_MINI_BOT</h1><p class="subtitle">Deno Deploy v2.0</p>
<input type="text" id="number" placeholder="947xxxxxxxx" /><button onclick="getCode()">Generate Pair Code</button><div id="code"></div></div>
<script>
async function getCode(){
const number=document.getElementById('number').value
if(!number)return alert('Number එක දාන්න!')
const btn=document.querySelector('button')
btn.innerText='Connecting...'
btn.disabled=true
const res=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number})})
const data=await res.json()
btn.innerText='Generate Pair Code'
btn.disabled=false
if(data.code){document.getElementById('code').style.display='block'
document.getElementById('code').innerText=data.code}else{alert(data.error||'Error!')}}
</script></body></html>`

// ============ BOT ============
async function startBot() {
    const { state, saveCreds } = await useDenoKVAuthState()

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop"),
        syncFullHistory: false,
        // Deno fix: disable cache
        cachedGroupMetadata: async () => undefined,
        getMessage: async () => undefined
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) setTimeout(startBot, 3000)
        } else if (connection === "open") {
            console.log(`${BOT_NAME} Connected!`)
        }
    })

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type!== "notify") return
        const m = messages[0]
        if (!m.message || m.key.fromMe) return

        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const command = body.startsWith(PREFIX)? body.slice(1).trim().split(" ")[0].toLowerCase() : ""

        if (!command) return

        switch (command) {
            case "alive":
                await sock.sendMessage(from, {
                    text: `*╭───「 ${BOT_NAME} 」───*\n*│*\n*├ Owner:* ${OWNER_NAME}\n*├ Platform:* Deno Deploy ⚡\n*├ Version:* ${VERSION}\n*├ Prefix:* ${PREFIX}\n*│*\n*╰───「 ACTIVE 」───*`
                }, { quoted: m })
                break

            case "ping":
                const start = Date.now()
                await sock.sendMessage(from, { text: `*Pong!* ${Date.now() - start}ms\n*${BOT_NAME}*` }, { quoted: m })
                break

            case "owner":
                await sock.sendMessage(from, {
                    text: `*Owner:* ${OWNER_NAME}\n*Bot:* ${BOT_NAME}\n*Contact:* wa.me/${OWNER_NUMBER.split("@")[0]}`
                }, { quoted: m })
                break

            case "menu":
                await sock.sendMessage(from, {
                    text: `*${BOT_NAME} MENU*\n\n*.alive* - Status\n*.ping* - Speed\n*.owner* - Owner\n*.chatu* - Chat\n*.menu* - This menu\n\n*By:* ${OWNER_NAME}`
                }, { quoted: m })
                break

            case "chatu":
                await sock.sendMessage(from, { text: `${BOT_NAME} Deno එකේ ඉන්නවා බන් 😏` }, { quoted: m })
                break
        }
    })
}

// ============ HTTP SERVER ============
serve(async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === "/" && req.method === "GET") {
        return new Response(pairHTML, { headers: { "content-type": "text/html" } })
    }

    if (url.pathname === "/pair" && req.method === "POST") {
        const { number } = await req.json()
        if (!sock) return Response.json({ error: "Bot starting..." }, { status: 500 })

        try {
            if (!sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(number)
                return Response.json({ code })
            } else {
                return Response.json({ error: "Already paired" })
            }
        } catch (e) {
            return Response.json({ error: e.message })
        }
    }

    return new Response("CR_MINI_BOT Running")
}, { port: 8000 })

startBot()
