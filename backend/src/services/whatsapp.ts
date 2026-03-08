import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    AuthenticationCreds,
    WAConnectionState,
    BufferJSON,
    proto,
    initAuthCreds,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import fs from 'fs';

const logger = pino({ level: 'info' }, {
    write: (msg: string) => {
        try {
            process.stdout.write(msg);
            // GATILHO MESTRE: Intercepta o sinal de exaustão da fila (timeout técnico)
            const logStr = msg.toString();
            if (logStr.includes('"msg":"timed out waiting for message"') || logStr.includes('timed out waiting for message')) {
                const service = (global as any).whatsappServiceInstance;
                if (service) service.handleSyncTimeoutLog();
            }
        } catch (e) {
            process.stdout.write(msg);
        }
    }
});

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class WhatsAppService {
    private static instance: WhatsAppService;
    private socket: any = null;
    private syncPercentage: number = 0;
    private syncIsFinalizing: boolean = false;
    private syncTimeout: any = null;
    private isFirstSync: boolean = true;
    private lastPacketTime: number = 0;
    private connectionState: WAConnectionState | 'syncing' = 'close';
    private qrCode: string | null = null;
    private io: any = null;
    private isInitializing = false;
    private isPaired = false;
    private historyCache: { chats: any[], messages: Record<string, any[]>, contacts: any[] } = { chats: [], messages: {}, contacts: [] };
    private cacheInterval: any = null;

    private constructor() {
        try {
            const cachePath = process.env.VERCEL ? '/tmp/whatsapp_proxy_cache.json' : './whatsapp_proxy_cache.json';
            if (fs.existsSync(cachePath)) {
                const data = fs.readFileSync(cachePath, 'utf8');
                const parsed = JSON.parse(data);
                // Cache persistente maior para suportar sincronização completa
                this.historyCache = {
                    chats: (parsed.chats || []).slice(0, 500),
                    messages: parsed.messages || {},
                    contacts: (parsed.contacts || []).slice(0, 1000)
                };
                console.log(`[WhatsApp Proxy] Cache carregado: ${this.historyCache.chats.length} chats.`);
            }
        } catch (e) {
            console.log('[WhatsApp Proxy] Erro ao carregar cache.');
        }
        this.startCacheInterval();
    }

    public startCacheInterval() {
        if (this.cacheInterval) return;
        this.cacheInterval = setInterval(() => {
            if (this.historyCache.chats.length > 0) {
                try {
                    const cachePath = process.env.VERCEL ? '/tmp/whatsapp_proxy_cache.json' : './whatsapp_proxy_cache.json';
                    fs.writeFileSync(cachePath, JSON.stringify(this.historyCache));
                } catch (e) {}
            }
        }, 30000); // Intervalo maior para evitar I/O excessivo com cache maior
    }

    public static getInstance(): WhatsAppService {
        if (!WhatsAppService.instance) {
            WhatsAppService.instance = new WhatsAppService();
            (global as any).whatsappServiceInstance = WhatsAppService.instance;
        }
        return WhatsAppService.instance;
    }

    public setIO(io: any) {
        this.io = io;
    }

    private broadcastChannel: any = null;
    private channelSubscribed = false;
    private pendingBroadcasts: any[] = [];

    private async broadcastEvent(event: string, payload: any) {
        try {
            if (!this.broadcastChannel) {
                this.broadcastChannel = supabase.channel('whatsapp-events');
                this.broadcastChannel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        this.channelSubscribed = true;
                        // Envia pendentes
                        while (this.pendingBroadcasts.length > 0) {
                            const msg = this.pendingBroadcasts.shift();
                            this.broadcastChannel.send(msg);
                        }
                    }
                });
            }
            
            const message = { type: 'broadcast', event: event, payload: payload };
            
            if (this.channelSubscribed) {
                this.broadcastChannel.send(message);
            } else {
                this.pendingBroadcasts.push(message);
            }
        } catch (err) {
            console.error('[WhatsApp Realtime] Erro ao transmitir:', err);
        }
    }

    private async useSupabaseAuthState(sessionId: string) {
        const writeData = async (data: any, id: string) => {
            try {
                const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
                await supabase
                    .from('whatsapp_auth')
                    .upsert({ 
                        id: `${sessionId}_${id}`, 
                        data: serialized,
                        updated_at: new Date().toISOString()
                    });
            } catch (err) {}
        };

        const readData = async (id: string) => {
            try {
                const { data, error } = await supabase
                    .from('whatsapp_auth')
                    .select('data')
                    .eq('id', `${sessionId}_${id}`)
                    .single();
                
                if (error || !data) return null;
                return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
            } catch (err) {
                return null;
            }
        };

        const removeAllSessionData = async () => {
            console.log(`[WhatsApp] 🧹 Limpando dados de sessão corrompidos para: ${sessionId}`);
            await supabase
                .from('whatsapp_auth')
                .delete()
                .like('id', `${sessionId}_%`);
        };

        const savedCreds = await readData('creds');
        const creds: AuthenticationCreds = savedCreds || initAuthCreds();

        return {
            state: {
                creds,
                keys: {
                    get: async (type: string, ids: string[]) => {
                        const data: { [id: string]: any } = {};
                        await Promise.all(
                            ids.map(async id => {
                                let value = await readData(`${type}-${id}`);
                                data[id] = value;
                            })
                        );
                        return data;
                    },
                    set: async (data: any) => {
                        // Otimização: Não salvamos tudo no Supabase para não estourar plano free/limites
                        // Chaves essenciais: app-state-sync-key, session, pre-key
                        const upserts: any[] = [];
                        const deletes: string[] = [];

                        for (const type in data) {
                            for (const id in data[type]) {
                                const value = data[type][id];
                                if (value) {
                                    const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
                                    upserts.push({
                                        id: `${sessionId}_${type}-${id}`,
                                        data: serialized,
                                        updated_at: new Date().toISOString()
                                    });
                                } else {
                                    deletes.push(`${sessionId}_${type}-${id}`);
                                }
                            }
                        }

                        const chunkSize = 50;
                        if (upserts.length > 0) {
                            for (let i = 0; i < upserts.length; i += chunkSize) {
                                try {
                                    await supabase.from('whatsapp_auth').upsert(upserts.slice(i, i + chunkSize));
                                } catch (e) {}
                            }
                        }
                    }
                }
            },
            saveCreds: () => writeData(creds, 'creds'),
            clearSession: removeAllSessionData
        };
    }


    public async initialize() {
        if (this.isInitializing) return;
        
        this.isInitializing = true;
        this.qrCode = null;
        console.log('[WhatsApp] 🚀 Iniciando motor Captu Web...');

        try {
            const { state, saveCreds, clearSession } = await this.useSupabaseAuthState('main');
            this.isPaired = !!state.creds?.me;
            this.isFirstSync = !this.isPaired; // Se já está pareado, não é o primeiro sync do zero
            
            const { version } = await fetchLatestBaileysVersion();

            this.socket = makeWASocket({
                version,
                logger,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                printQRInTerminal: false,
                browser: ['Mac OS', 'Desktop', '14.4.1'],
                syncFullHistory: true,
                connectTimeoutMs: 60000,
                generateHighQualityLinkPreview: true
            });

            // Inicializa canal de broadcast IMEDIATAMENTE para ouvir comandos do front
            if (!this.broadcastChannel) {
                this.broadcastChannel = supabase.channel('whatsapp-events');
                this.broadcastChannel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') this.channelSubscribed = true;
                });
            }

            this.socket.ev.on('creds.update', async (update: any) => {
                await saveCreds();
                if (this.socket?.creds?.me) {
                    this.isPaired = true;
                }
            });

            // Sincronização Atômica 6.0 (Rastreamento por Porcentagem e Log)
            this.socket.ev.on('messaging-history.set', async (payload: any) => {
                const { chats, messages, contacts, progress, syncType } = payload;
                this.lastPacketTime = Date.now();
                
                if (this.connectionState !== 'open') {
                    this.connectionState = 'syncing';
                }

                if (chats) this.mergeChats(chats);
                if (messages) this.mergeMessages(messages);
                if (contacts) {
                    contacts.forEach((c: any) => {
                        const existingIdx = this.historyCache.contacts.findIndex((hc: any) => hc.id === c.id);
                        if (existingIdx === -1) {
                            this.historyCache.contacts.push({
                                id: c.id,
                                lid: c.lid, // PRESERVAR LID PARA RESOLUÇÃO NO FRONT
                                name: c.name || c.notify || c.verifiedName || c.id.split('@')[0],
                                pushName: c.notify,
                                imgUrl: null
                            });
                        } else {
                            const existing = this.historyCache.contacts[existingIdx];
                            this.historyCache.contacts[existingIdx] = {
                                ...existing,
                                lid: c.lid || existing.lid,
                                name: c.name || c.verifiedName || existing.name,
                                pushName: c.notify || existing.pushName
                            };
                        }
                    });
                }

                // CORREÇÃO ATÔMICA 8.0: Mapeamento de Enums (2 = FULL, 3 = RECENT)
                // CORREÇÃO ATÔMICA 10.0: Bloqueio de Regressão
                if (this.syncIsFinalizing) return;

                const isFull = syncType === 'FULL' || syncType === 2;
                const isRecent = syncType === 'RECENT' || syncType === 3;

                // CÁLCULO DE PORCENTAGEM (10% a 95%) - Estritamente Crescente
                let basePercent = isFull ? 45 : 10;
                let scale = isFull ? 0.5 : 0.35; 
                const newPercent = Math.min(95, Math.floor(basePercent + ((progress || 0) * scale)));
                this.syncPercentage = Math.max(this.syncPercentage, newPercent);
                
                console.log(`[WhatsApp] 🔄 Pacote [${syncType}] | Progresso: ${this.syncPercentage}% | Chats: ${this.historyCache.chats.length}`);

                this.broadcastEvent('sync-progress', { 
                    percentage: this.syncPercentage,
                    chatsCount: this.historyCache.chats.length,
                    stage: isFull ? 'OTIMIZANDO HISTÓRICO' : 'CARREGANDO RECENTES'
                });

                // Gatilho Proativo: Se chegamos a 100% no pacote FULL, forçamos a finalização técnica IMEDIATA
                if (isFull && progress === 100) {
                    console.log(`[WhatsApp] 🚀 Pacote FULL finalizado progressivamente. Liberando agora...`);
                    this.handleSyncTimeoutLog();
                }

                // Tira fotos proativas
                const topChats = this.historyCache.chats.slice(0, 30);
                for (const chat of topChats) {
                    const contactIdx = this.historyCache.contacts.findIndex((c: any) => c.id === chat.id);
                    if (contactIdx > -1 && !this.historyCache.contacts[contactIdx].imgUrl) {
                        try {
                            const formattedJid = chat.id.includes('@') ? chat.id : `${chat.id}@s.whatsapp.net`;
                            const url = await this.socket!.profilePictureUrl(formattedJid, 'image').catch(() => null);
                            if (url) (this.historyCache.contacts[contactIdx] as any).imgUrl = url;
                        } catch (e) {}
                    }
                }

                // WATCHDOG DE SILÊNCIO (Gatilho de Segurança 3)
                if (this.isFirstSync && this.historyCache.chats.length > 0) {
                    if (this.syncTimeout) clearTimeout(this.syncTimeout);
                    this.syncTimeout = setTimeout(() => {
                        console.log(`[WhatsApp] 🕒 Watchdog de Silêncio: Carga de dados estabilizada após 5s.`);
                        this.handleSyncTimeoutLog();
                    }, 5000);
                }
            });

            this.socket.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
                
                // GATILHO NATIVO (Gatilho de Segurança 2)
                if (receivedPendingNotifications && (this.isFirstSync || this.connectionState === 'syncing')) {
                    console.log(`[WhatsApp] 🔔 Sinal Nativo: Notificações pendentes recebidas.`);
                    this.handleSyncTimeoutLog();
                }

                if (connection) {
                    if (connection === 'close') {
                        this.connectionState = 'close';
                    } else if (connection === 'open') {
                        if (this.isFirstSync) {
                            this.connectionState = 'syncing';
                        } else {
                            this.connectionState = 'open';
                        }
                    } else {
                        this.connectionState = connection;
                    }
                }

                if (qr) {
                    this.qrCode = await QRCode.toDataURL(qr);
                    console.log('[WhatsApp] 📱 Novo QR Code gerado');
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    this.socket = null;
                    this.qrCode = null;
                    this.isInitializing = false;
                    this.isFirstSync = true; // Reseta para o próximo login

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        await clearSession();
                        this.historyCache = { chats: [], messages: {}, contacts: [] };
                        try { 
                            const cachePath = process.env.VERCEL ? '/tmp/whatsapp_proxy_cache.json' : './whatsapp_proxy_cache.json';
                            if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); 
                        } catch(e){}
                        setTimeout(() => this.initialize(), 1000);
                    } else {
                        setTimeout(() => this.initialize(), 5000);
                    }
                    this.broadcastEvent('connection-update', { connection: 'close', qr: null, isPaired: false });
                    return;
                } else if (connection === 'open') {
                    console.log('[WhatsApp] Rede Estabelecida! 🌐 (Iniciando carga atômica...)');
                    this.qrCode = null;
                    this.isPaired = true;
                    this.isInitializing = false;
                    
                    if (this.isFirstSync) {
                        this.connectionState = 'syncing';
                        this.broadcastEvent('sync-progress', { percentage: 5, chatsCount: 0, stage: 'INICIANDO PROTOCOLO' });
                    } else {
                        this.broadcastEvent('connection-update', { connection: 'open', qr: null, isPaired: true });
                        setTimeout(() => this.broadcastEvent('history', this.getHistoryCache()), 1000);
                    }
                }

                // Broadcast genérico de atualização de estado (Sempre respeitando o bloqueio do isFirstSync)
                this.broadcastEvent('connection-update', { 
                    connection: this.connectionState,
                    qr: this.isPaired ? null : this.qrCode,
                    isPaired: this.isPaired
                });
            });

            this.socket.ev.on('chats.upsert', (chats: any[]) => {
                this.mergeChats(chats);
                this.saveCache();
            });

            this.socket.ev.on('messages.upsert', async (m: any) => {
                if (m.type === 'notify') {
                    this.mergeMessages(m.messages);
                    for (const msg of m.messages) {
                        this.broadcastEvent('new-message', msg);
                        // Se for mensagem de grupo, tenta forçar sincronização de participantes
                        if (msg.key.remoteJid?.endsWith('@g.us')) {
                            this.syncGroupMetadata(msg.key.remoteJid);
                        }
                    }
                    this.saveCache();
                }
            });

            this.socket.ev.on('contacts.upsert', (contacts: any[]) => {
                contacts.forEach(c => {
                    const idx = this.historyCache.contacts.findIndex(hc => hc.id === c.id);
                    if (idx > -1) {
                        this.historyCache.contacts[idx] = { ...this.historyCache.contacts[idx], ...c };
                    } else {
                        this.historyCache.contacts.push(c);
                    }
                });
                this.broadcastEvent('contacts-upsert', contacts);
            });

            this.socket.ev.on('contacts.update', (updates: any[]) => {
                updates.forEach(u => {
                    const idx = this.historyCache.contacts.findIndex(hc => hc.id === u.id);
                    if (idx > -1) {
                        this.historyCache.contacts[idx] = { ...this.historyCache.contacts[idx], ...u };
                    }
                });
                this.broadcastEvent('contacts-upsert', updates);
            });

            // GATILHO EXTERNO: Permite que o frontend peça sincronização de um grupo específico
            if (this.broadcastChannel) {
                this.broadcastChannel.on('broadcast', { event: 'request-group-sync' }, ({ payload }: any) => {
                    if (payload?.jid) {
                        this.syncGroupMetadata(payload.jid);
                    }
                });
            }

        } catch (err) {
            console.error('[WhatsApp] Erro na inicialização:', err);
            this.isInitializing = false;
        }
    }

    public async getProfilePicture(jid: string): Promise<string | null> {
        try {
            if (!this.socket) return null;
            
            // Decodificar JID caso venha com caracteres especiais da URL
            const decodedJid = decodeURIComponent(jid);
            
            // Normalizar JID: se não tiver @, assume que é usuário individual
            const formattedJid = decodedJid.includes('@') ? decodedJid : `${decodedJid}@s.whatsapp.net`;
            
            console.log(`[WhatsApp] Buscando foto para: ${formattedJid}`);
            
            // Tenta buscar a URL da imagem. Se falhar, retorna null em vez de estourar erro
            const url = await this.socket.profilePictureUrl(formattedJid, 'image').catch((err: any) => {
                console.log(`[WhatsApp] Foto não encontrada para ${formattedJid}`);
                return null;
            });
            
            return url;
        } catch (err) {
            return null;
        }
    }

    public async downloadMedia(jid: string, msgId: string): Promise<Buffer | null> {
        try {
            if (!this.socket) return null;
            
            const chatMsgs = this.historyCache.messages[jid] || [];
            const msg = chatMsgs.find(m => m.key.id === msgId);
            
            if (!msg || (!msg.message?.imageMessage && !msg.message?.videoMessage && !msg.message?.audioMessage && !msg.message?.stickerMessage)) return null;
            
            const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { 
                    logger,
                    reuploadRequest: this.socket.updateMediaMessage
                }
            );
            
            return buffer as Buffer;
        } catch (err) {
            console.error('[WhatsApp] Erro ao baixar mídia:', err);
            return null;
        }
    }

    public getMessages(jid: string) {
        return this.historyCache.messages[jid] || [];
    }

    public async sendMessage(chatId: string, message: string) {
        if (!this.socket || this.connectionState !== 'open') throw new Error('WhatsApp não está conectado');
        const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
        await this.socket.sendMessage(jid, { text: message });
    }

    public async disconnect() {
        try {
            if (this.socket) {
                try { await this.socket.logout(); } catch (e) {}
                this.socket = null;
            }
            
            await supabase.from('whatsapp_auth').delete().like('id', `main_%`);

            this.connectionState = 'close';
            this.qrCode = null;
            this.isPaired = false;
            this.isInitializing = false;
            this.historyCache = { chats: [], messages: {}, contacts: [] };
            
            try { 
                const cachePath = process.env.VERCEL ? '/tmp/whatsapp_proxy_cache.json' : './whatsapp_proxy_cache.json';
                fs.unlinkSync(cachePath); 
            } catch(e){}
            
            this.broadcastEvent('connection-update', { connection: 'close', qr: null, isPaired: false });
            setTimeout(() => this.initialize(), 1000);
        } catch (err) {
            console.error('[WhatsApp] Erro ao desconectar:', err);
        }
    }

    private mergeChats(chats: any[]) {
        const existingChats = this.historyCache.chats;
        const chatMap = new Map();
        
        // Primeiro, adicionamos os existentes no mapa
        existingChats.forEach(c => chatMap.set(c.id, c));
        
        // Sobrescrevemos com os novos (que têm dados mais frescos do celular)
        chats.forEach(c => {
            const existing = chatMap.get(c.id);
            chatMap.set(c.id, {
                ...existing,
                ...c,
                // Garante que o timestamp seja preservado se o novo vier zerado
                conversationTimestamp: c.conversationTimestamp || existing?.conversationTimestamp || 0
            });
        });

        const merged = Array.from(chatMap.values());
        
        this.historyCache.chats = merged.sort((a: any, b: any) => {
            const tA = Number(a.conversationTimestamp?.low || a.conversationTimestamp || 0);
            const tB = Number(b.conversationTimestamp?.low || b.conversationTimestamp || 0);
            
            // Prioriza Pinned
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            
            return tB - tA;
        }).slice(0, 500);
    }

    private mergeMessages(messages: any[]) {
        messages.forEach(m => {
            if (!m.key || !m.key.remoteJid) return;
            const jid = m.key.remoteJid;
            
            if (!this.historyCache.messages[jid]) {
                this.historyCache.messages[jid] = [];
            }

            const chatMsgs = this.historyCache.messages[jid];
            const existingIdx = chatMsgs.findIndex(em => em.key.id === m.key.id);
            
            if (existingIdx > -1) {
                chatMsgs[existingIdx] = { ...chatMsgs[existingIdx], ...m };
            } else {
                chatMsgs.push(m);
            }

            // Ordena e limita a 100 mensagens por chat para performance profissional
            this.historyCache.messages[jid] = chatMsgs.sort((a: any, b: any) => {
                const tA = Number(a.messageTimestamp?.low || a.messageTimestamp || 0);
                const tB = Number(b.messageTimestamp?.low || b.messageTimestamp || 0);
                return tA - tB; // Ordem cronológica
            }).slice(-100);
        });
    }

    private saveCache() {
        try {
            const cachePath = process.env.VERCEL ? '/tmp/whatsapp_proxy_cache.json' : './whatsapp_proxy_cache.json';
            fs.writeFileSync(cachePath, JSON.stringify(this.historyCache, null, 2));
        } catch (e) {
            console.error('[WhatsApp] Erro ao salvar cache:', e);
        }
    }

    public getStatus() {
        return { 
            connection: this.connectionState, 
            qr: this.isPaired ? null : this.qrCode,
            isPaired: this.isPaired,
            syncPercentage: this.syncPercentage
        };
    }

    public getHistoryCache() {
        return this.historyCache;
    }

    private groupSyncTokens = new Set<string>();

    public async syncGroupMetadata(groupJid: string) {
        if (!this.socket || !groupJid.endsWith('@g.us')) return;
        
        // Evita chamadas duplicadas excessivas
        if (this.groupSyncTokens.has(groupJid)) return;
        this.groupSyncTokens.add(groupJid);
        setTimeout(() => this.groupSyncTokens.delete(groupJid), 15000); // Cooldown reduzido para 15s

        try {
            console.log(`[WhatsApp] 🔍 Sincronizando metadados do grupo: ${groupJid}`);
            const metadata = await this.socket.groupMetadata(groupJid);
            if (metadata && metadata.participants) {
                const mappedContacts: any[] = [];
                metadata.participants.forEach((p: any) => {
                    const jid = p.id;
                    const lid = p.lid;
                    
                    if (lid && jid) {
                        console.log(`[WhatsApp] 🔗 Mapeando Identidade: ${lid} -> ${jid} (${p.notify || 'Sem Nome'})`);
                        mappedContacts.push({
                            id: jid,
                            lid: lid,
                            notify: p.notify || null,
                            name: p.name || null
                        });
                        
                        // Atualiza cache local de contatos
                        const idx = this.historyCache.contacts.findIndex(hc => hc.id === jid);
                        const contactPayload = { 
                            id: jid, 
                            lid: lid, 
                            pushName: p.notify, 
                            name: p.name || p.notify || jid.split('@')[0] 
                        };

                        if (idx > -1) {
                            this.historyCache.contacts[idx] = { ...this.historyCache.contacts[idx], ...contactPayload };
                        } else {
                            this.historyCache.contacts.push(contactPayload);
                        }
                    }
                });
                
                if (mappedContacts.length > 0) {
                    console.log(`[WhatsApp] ✅ Resolvidos ${mappedContacts.length} participantes para o grupo: ${groupJid}`);
                    // Transmitir para o frontend atualizar o lidMap e contatos
                    this.broadcastEvent('contacts-upsert', mappedContacts);
                }
            }
        } catch (err) {
            console.error(`[WhatsApp] ❌ Erro ao sincronizar grupo ${groupJid}:`, err);
        }
    }

    public async handleSyncTimeoutLog() {
        if (this.syncIsFinalizing) return;
        
        // CORREÇÃO ATÔMICA 11.0: Remove o guarda restritivo de connectionState
        // Se chamamos este método, queremos finalizar, ponto.
        const shouldFinalize = this.syncPercentage < 100 || this.connectionState !== 'open';
        
        if (shouldFinalize) {
            console.log(`[WhatsApp] 🏁 Gatilho Técnico Ativado: Forçando 100% (Estado Atual: ${this.connectionState}, Progresso: ${this.syncPercentage}%)`);
            
            this.syncIsFinalizing = true;
            if (this.syncTimeout) {
                clearTimeout(this.syncTimeout);
                this.syncTimeout = null;
            }

            // 1. Força os 100% no visual imediatamente
            this.syncPercentage = 100;
            this.broadcastEvent('sync-progress', { 
                percentage: 100, 
                chatsCount: this.historyCache.chats.length, 
                stage: 'CONCLUÍDO' 
            });
            
            // 2. Transição ultra-rápida para o card de sucesso
            setTimeout(() => {
                this.saveCache();
                this.connectionState = 'open';
                this.isPaired = true;
                this.isFirstSync = false;
                
                // 3. Libera o estado final
                this.broadcastEvent('connection-update', { connection: 'open', qr: null, isPaired: true });
                this.broadcastEvent('sync-ready', { chatsCount: this.historyCache.chats.length });
                console.log(`[WhatsApp] ✅ Sincronização Atômica 11.0 Concluída!`);
                
                // GATILHO EXTRA: Sincroniza metadados dos 5 chats mais recentes se forem grupos
                this.historyCache.chats.slice(0, 5).forEach(chat => {
                    if (chat.id.endsWith('@g.us')) {
                        this.syncGroupMetadata(chat.id);
                    }
                });

                this.syncIsFinalizing = false;
            }, 300);
        }
    }
}
