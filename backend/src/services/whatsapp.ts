import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    AuthenticationCreds,
    WAConnectionState,
    BufferJSON,
    proto,
    initAuthCreds
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import fs from 'fs';

const logger = pino({ level: 'info' });

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class WhatsAppService {
    private static instance: WhatsAppService;
    private socket: any = null;
    private connectionState: WAConnectionState = 'close';
    private qrCode: string | null = null;
    private io: any = null;
    private isInitializing = false;
    private isPaired = false;
    private historyCache: { chats: any[], messages: any[], contacts: any[] } = { chats: [], messages: [], contacts: [] };
    private cacheInterval: any = null;

    private constructor() {
        try {
            if (fs.existsSync('./whatsapp_proxy_cache.json')) {
                const data = fs.readFileSync('./whatsapp_proxy_cache.json', 'utf8');
                this.historyCache = JSON.parse(data);
                console.log(`[WhatsApp Proxy] Cache de memória carregado do disco (${this.historyCache.chats.length} conversas).`);
            }
        } catch (e) {
            console.log('[WhatsApp Proxy] Cache de disco não encontrado, começando limpo.');
        }
        this.startCacheInterval();
    }

    public startCacheInterval() {
        if (this.cacheInterval) return;
        this.cacheInterval = setInterval(() => {
            if (this.historyCache.chats.length > 0) {
                try {
                    fs.writeFileSync('./whatsapp_proxy_cache.json', JSON.stringify(this.historyCache));
                } catch (e) {}
            }
        }, 15000);
    }

    public static getInstance(): WhatsAppService {
        if (!WhatsAppService.instance) {
            WhatsAppService.instance = new WhatsAppService();
        }
        return WhatsAppService.instance;
    }

    public setIO(io: any) {
        this.io = io;
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

        const removeData = async (id: string) => {
            await supabase
                .from('whatsapp_auth')
                .delete()
                .eq('id', `${sessionId}_${id}`);
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

                        const chunkSize = 100;
                        if (upserts.length > 0) {
                            for (let i = 0; i < upserts.length; i += chunkSize) {
                                try {
                                    await supabase.from('whatsapp_auth').upsert(upserts.slice(i, i + chunkSize));
                                } catch (e) {}
                            }
                        }
                        if (deletes.length > 0) {
                            for (let i = 0; i < deletes.length; i += chunkSize) {
                                try {
                                    await supabase.from('whatsapp_auth').delete().in('id', deletes.slice(i, i + chunkSize));
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

            this.socket.ev.on('creds.update', async (update: any) => {
                await saveCreds();
                if (this.socket?.creds?.me) {
                    this.isPaired = true;
                }
            });

            this.socket.ev.process(async (events: any) => {
                // Remove the noisy logs
            });

            // Sincronização Web de Chats (Grupos, Indivíduos, Comunidades)
            this.socket.ev.on('messaging-history.set', async ({ chats, messages, contacts, isLatest }: any) => {
                console.log(`[WhatsApp] Sincronizando ${chats?.length || 0} conversas e contatos (Proxy Real-Time)...`);
                
                if (chats) this.historyCache.chats.push(...chats);
                if (messages) this.historyCache.messages.push(...messages);
                if (contacts) this.historyCache.contacts.push(...contacts);

                if (this.io) {
                    this.io.emit('whatsapp-history', this.getHistoryCache());
                }
                console.log('[WhatsApp] Sincronização proxy enviada para o frontend! ✅');
            });

            this.socket.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (connection) {
                    this.connectionState = connection;
                }

                if (qr) {
                    this.qrCode = await QRCode.toDataURL(qr);
                    console.log('[WhatsApp] 📱 Novo QR Code gerado para Espelhamento Total');
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    this.socket = null;
                    this.qrCode = null;
                    this.isInitializing = false;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        await clearSession();
                        this.historyCache = { chats: [], messages: [], contacts: [] };
                        try { fs.unlinkSync('./whatsapp_proxy_cache.json'); } catch(e){}
                        setTimeout(() => this.initialize(), 1000);
                    } else {
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    console.log('[WhatsApp] Espelhamento Captu Web Ativo! 🔥');
                    this.qrCode = null;
                    this.isPaired = true;
                    this.isInitializing = false;
                }

                if (this.io) {
                    this.io.emit('whatsapp-connection-update', { 
                        connection: this.connectionState,
                        qr: this.isPaired ? null : this.qrCode,
                        isPaired: this.isPaired
                    });
                }
            });

            this.socket.ev.on('chats.upsert', (chats: any[]) => {
                this.historyCache.chats.push(...chats);
                if (this.io) {
                    this.io.emit('whatsapp-history', this.getHistoryCache());
                }
            });

            this.socket.ev.on('chats.update', (chats: any[]) => {
                for (const updated of chats) {
                    const idx = this.historyCache.chats.findIndex((c: any) => c.id === updated.id);
                    if (idx !== -1) {
                        this.historyCache.chats[idx] = { ...this.historyCache.chats[idx], ...updated };
                    }
                }
                if (this.io) {
                    this.io.emit('whatsapp-history', this.getHistoryCache());
                }
            });

            this.socket.ev.on('messages.upsert', async (m: any) => {
                if (m.type === 'notify') {
                    for (const msg of m.messages) {
                        this.historyCache.messages.push(msg);
                        this.handleIncomingMessage(msg, false);
                    }
                }
            });

            this.socket.ev.on('contacts.upsert', (contacts: any[]) => {
                this.historyCache.contacts.push(...contacts);
                if (this.io) {
                    this.io.emit('whatsapp-contacts-upsert', contacts);
                }
            });

            this.socket.ev.on('contacts.update', (contacts: any[]) => {
                for (const updated of contacts) {
                    const idx = this.historyCache.contacts.findIndex((c: any) => c.id === updated.id);
                    if (idx !== -1) {
                        this.historyCache.contacts[idx] = { ...this.historyCache.contacts[idx], ...updated };
                    }
                }
                if (this.io) {
                    this.io.emit('whatsapp-contacts-update', contacts);
                }
            });

        } catch (err) {
            console.error('[WhatsApp] Erro na inicialização:', err);
            this.isInitializing = false;
        }
    }

    private handleIncomingMessage(msg: proto.IWebMessageInfo, isBulk = false) {
        try {
            if (!msg.key || !msg.key.remoteJid) return;
            
            // Enviar a mensagem crua para o Frontend Processar
            if (this.io) {
                this.io.emit('whatsapp-message', msg);
            }
        } catch (err) {}
    }

    public async getProfilePicture(jid: string): Promise<string | null> {
        try {
            if (!this.socket) return null;
            const url = await this.socket.profilePictureUrl(jid, 'image');
            return url;
        } catch (err) {
            return null;
        }
    }

    public async sendMessage(chatId: string, message: string) {
        if (!this.socket || this.connectionState !== 'open') throw new Error('WhatsApp não está conectado');
        const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
        await this.socket.sendMessage(jid, { text: message });
    }

    public async disconnect() {
        try {
            console.log('[WhatsApp] 🔌 Solicitando desconexão...');
            if (this.socket) {
                try {
                    await this.socket.logout();
                } catch (e) {
                    console.log('[WhatsApp] Socket já estava fechado ou erro no logout');
                }
                this.socket = null;
            }
            
            await supabase
                .from('whatsapp_auth')
                .delete()
                .like('id', `main_%`);

            this.connectionState = 'close';
            this.qrCode = null;
            this.isPaired = false;
            this.isInitializing = false;
            
            // Limpa o cache
            this.historyCache = { chats: [], messages: [], contacts: [] };
            try { fs.unlinkSync('./whatsapp_proxy_cache.json'); } catch(e){}
            
            if (this.io) {
                this.io.emit('whatsapp-connection-update', { 
                    connection: 'close',
                    qr: null,
                    isPaired: false
                });
            }

            console.log('[WhatsApp] ✅ Sessão limpa. Reiniciando para novo QR Code...');
            setTimeout(() => this.initialize(), 1000);
        } catch (err) {
            console.error('[WhatsApp] Erro ao desconectar:', err);
        }
    }

    public getStatus() {
        return { 
            connection: this.connectionState, 
            qr: this.isPaired ? null : this.qrCode,
            isPaired: this.isPaired
        };
    }

    public getHistoryCache() {
        return this.historyCache;
    }
}
