import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza um JID removendo sufixo de dispositivo (:0, :1, etc.)
 */
function normalizeJid(jid: string): string {
    if (!jid) return '';
    let normalized = jid.split(':')[0].trim().toLowerCase();
    normalized = normalized.replace('@c.us', '@s.whatsapp.net');
    return normalized;
}

/**
 * Converte messageTimestamp para ms
 */
function toTimestampMs(ts: any): number {
    if (!ts) return 0;
    if (typeof ts === 'object' && ts !== null) {
        const val = ts.low !== undefined ? ts.low : (ts.seconds || 0);
        return Number(val) * 1000;
    }
    return Number(ts) * 1000;
}

/**
 * Extrai texto de mensagens brutas do WhatsApp
 */
function extractTextFromWhatsAppMessage(msg: any): string {
    if (!msg || typeof msg !== 'object') return "";
    let messageContent = msg.message || msg;
    
    // Desembrulhar mensagens aninhadas
    if (messageContent.ephemeralMessage) messageContent = messageContent.ephemeralMessage.message;
    if (messageContent.viewOnceMessage) messageContent = messageContent.viewOnceMessage.message;
    if (messageContent.viewOnceMessageV2) messageContent = messageContent.viewOnceMessageV2.message;
    if (messageContent.documentWithCaptionMessage) messageContent = messageContent.documentWithCaptionMessage.message;

    let text = messageContent?.conversation ||
           messageContent?.extendedTextMessage?.text ||
           messageContent?.imageMessage?.caption ||
           messageContent?.videoMessage?.caption ||
           messageContent?.documentMessage?.caption || "";

    if (!text) {
        if (messageContent?.imageMessage) return 'Foto';
        if (messageContent?.videoMessage) return 'Vídeo';
        if (messageContent?.audioMessage) return 'Áudio';
        if (messageContent?.documentMessage) return '📄 Documento';
        if (messageContent?.stickerMessage) return '🏷️ Figurinha';
        if (messageContent?.locationMessage) return '📍 Localização';
        if (messageContent?.contactMessage || messageContent?.contactsArrayMessage) return '👤 Contato';
        if (messageContent?.pollCreationMessage) return '📊 Enquete';
    }
    
    return text || "";
}

/**
 * Extrai array de mensagens de qualquer formato de resposta da Evolution API
 */
function extractMessages(data: any): any[] {
    if (!data) return [];
    if (data?.records && Array.isArray(data.records))                    return data.records;
    if (data?.messages?.records && Array.isArray(data.messages.records)) return data.messages.records;
    if (Array.isArray(data))                                             return data;
    if (data?.messages && Array.isArray(data.messages))                  return data.messages;
    return [];
}

/**
 * Mapeia mensagens brutas da Evolution API para o formato ProxyMessage do frontend
 */
function mapMessages(rawMessages: any[]): any[] {
    return rawMessages
        .filter((m: any) => m.key && m.key.remoteJid)
        .map((m: any) => {
            const isImage    = !!m.message?.imageMessage;
            const isAudio    = !!m.message?.audioMessage;
            const isSticker  = !!m.message?.stickerMessage;
            const isDocument = !!m.message?.documentMessage;
            const isVideo    = !!m.message?.videoMessage;
            const isMedia    = isImage || isAudio || isSticker || isDocument || isVideo;

            const msgContent = m.message || {};
            const inner =
                msgContent.ephemeralMessage?.message ||
                msgContent.viewOnceMessage?.message ||
                msgContent.viewOnceMessageV2?.message ||
                msgContent.documentWithCaptionMessage?.message ||
                msgContent;

            const text = extractTextFromWhatsAppMessage(m);

            const filename = 
                inner.documentMessage?.fileName || 
                inner.audioMessage?.fileName || 
                inner.videoMessage?.fileName || 
                inner.imageMessage?.fileName || '';

            const mimetype = 
                inner.imageMessage?.mimetype ||
                inner.videoMessage?.mimetype ||
                inner.audioMessage?.mimetype ||
                inner.stickerMessage?.mimetype ||
                inner.documentMessage?.mimetype || '';

            const type: string = isImage    ? 'image'
                               : isAudio    ? 'audio'
                               : isSticker  ? 'sticker'
                               : isDocument ? 'document'
                               : isVideo    ? 'video'
                               : 'text';

            return {
                id:        m.key?.id || m.id,
                text:      text || '',
                direction: (m.key?.fromMe ?? m.fromMe) ? 'outbound' : 'inbound',
                timestamp: toTimestampMs(m.messageTimestamp || m.timestamp),
                status:    'read',
                type,
                duration:  inner.audioMessage?.seconds || inner.videoMessage?.seconds,
                sender:    m.key?.participant || m.key?.remoteJid,
                remoteJid: m.key?.remoteJid,
                filename:  filename,
                mimetype:  mimetype,
                mediaUrl:  isMedia,
                quoted:    msgContent.extendedTextMessage?.contextInfo?.quotedMessage
                           ? {
                               text: extractTextFromWhatsAppMessage({ message: msgContent.extendedTextMessage.contextInfo.quotedMessage }),
                               sender: msgContent.extendedTextMessage.contextInfo.participant
                             }
                           : undefined,
                raw: m
            };
        })
        .filter((m: any) => m.text || m.mediaUrl);
}

// ─── Classe de Serviço ───────────────────────────────────────────────────────

export class EvolutionService {
    private static messageCache: Map<string, { data: any[]; ts: number }> = new Map();
    private static readonly CACHE_TTL_MS = 60 * 1000;

    static async getInstanceStatus(instance: string) {
        try {
            const response = await axios.get(
                `${EVOLUTION_API_URL}/instance/connectionState/${instance}`,
                { headers: { 'apiKey': EVOLUTION_API_KEY } }
            );
            return response.data;
        } catch (error: any) {
            console.error(`[Evolution] Error status (${instance}):`, error.response?.data || error.message);
            if (error.response?.status === 404) return { instance: { state: 'not_found' } };
            return { instance: { state: 'disconnected' } };
        }
    }

    static async createInstance(instance: string) {
        try {
            const response = await axios.post(
                `${EVOLUTION_API_URL}/instance/create`,
                {
                    instanceName: instance,
                    token: EVOLUTION_API_KEY,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS',
                    webhook: {
                        enabled: true,
                        url: "http://host.docker.internal:3000/api/chat/webhook",
                        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "CHATS_UPSERT", "CONTACTS_UPSERT", "CONNECTION_UPDATE"]
                    },
                    // Opções recomendadas para v2 - força a sincronização de nomes e fotos
                    syncFullHistory: true,
                    syncContacts: true,
                    syncLid: true
                },
                { headers: { 'apiKey': EVOLUTION_API_KEY } }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Evolution] Error creating instance:', error.response?.data || error.message);
            throw error;
        }
    }

    static async connectInstance(instance: string) {
        try {
            const response = await axios.get(
                `${EVOLUTION_API_URL}/instance/connect/${instance}`,
                { headers: { 'apiKey': EVOLUTION_API_KEY } }
            );
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    static async logout(instance: string) {
        try {
            await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${instance}`, { headers: { 'apiKey': EVOLUTION_API_KEY } });
            await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${instance}`, { headers: { 'apiKey': EVOLUTION_API_KEY } });
            return { success: true };
        } catch (error: any) {
            throw error;
        }
    }

    static async sendMessage(remoteJid: string, text: string, instance: string) {
        try {
            const response = await axios.post(
                `${EVOLUTION_API_URL}/message/sendText/${instance}`,
                { number: remoteJid, text, linkPreview: false },
                { headers: { 'apiKey': EVOLUTION_API_KEY } }
            );
            EvolutionService.invalidateCache(instance, remoteJid);
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    static async sendMedia(remoteJid: string, buffer: Buffer, mimetype: string, filename: string, instance: string, caption?: string) {
        try {
            const base64 = buffer.toString('base64');
            const type = mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : mimetype.startsWith('audio/') ? 'audio' : 'document';
            const response = await axios.post(
                `${EVOLUTION_API_URL}/message/sendMedia/${instance}`,
                { number: remoteJid, media: base64, mediatype: type, mimetype, caption, fileName: filename },
                { headers: { 'apiKey': EVOLUTION_API_KEY } }
            );
            EvolutionService.invalidateCache(instance, remoteJid);
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    static async fetchHistory(instance: string, jid: string) {
        const cacheKey = `${instance}:${jid}`;
        const targetNorm = normalizeJid(jid);

        const cached = EvolutionService.messageCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < EvolutionService.CACHE_TTL_MS) {
            return cached.data;
        }

        try {
            let rawMessages: any[] = [];
            const queryFormats = [
                { where: { key: { remoteJid: targetNorm } }, limit: 100 },
                { where: { remoteJid: targetNorm }, limit: 100 },
                { remoteJid: targetNorm, count: 100, page: 1 },
                { remoteJid: targetNorm },
            ];

            for (const query of queryFormats) {
                try {
                    const res = await axios.post(
                        `${EVOLUTION_API_URL}/chat/findMessages/${instance}`,
                        query,
                        { headers: { 'apiKey': EVOLUTION_API_KEY } }
                    );
                    const msgs = extractMessages(res.data);
                    if (msgs.length > 0) {
                        const filtered = msgs.filter((m: any) => normalizeJid(m.key?.remoteJid || '') === targetNorm);
                        if (filtered.length > 0) {
                            rawMessages = filtered;
                            break;
                        }
                    }
                } catch (err) {}
            }

            const result = mapMessages(rawMessages);
            EvolutionService.messageCache.set(cacheKey, { data: result, ts: Date.now() });
            return result;
        } catch (error: any) {
            console.error(`[Evolution] Erro histórico:`, error.message);
            return [];
        }
    }

    static invalidateCache(instance: string, jid: string) {
        EvolutionService.messageCache.delete(`${instance}:${jid}`);
    }

    static clearCache() {
        EvolutionService.messageCache.clear();
    }

    public static metadataCache: Map<string, { name: string, avatar: string, ts: number }> = new Map();
    private static readonly METADATA_TTL_MS = 30 * 60 * 1000; // 30 minutos

    /**
     * Formata um número de JID para um formato legível (DDD + Telefone)
     * Lida com números brasileiros, o 9 extra e limpa identificadores internos (LIDs)
     */
    private static formatPhoneNumber(jid: string, contact?: any): string {
        try {
            // Se o contato tem um número real (fora o JID interno), usamos ele
            let number = contact?.number || contact?.phoneNumber || jid.split('@')[0];
            
            // Remove qualquer caractere não numérico se houver
            number = number.replace(/\D/g, '');

            // Se for um identificador muito longo (LID), não tentamos formatar como telefone se não tivermos o real
            if (number.length > 15 && (!contact?.number && !contact?.phoneNumber)) {
                return ''; 
            }

            // Tratamento para números brasileiros (55...)
            if (number.startsWith('55')) {
                const ddd = number.slice(2, 4);
                const rest = number.slice(4);
                if (rest.length === 9) {
                    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
                } else if (rest.length === 8) {
                    return `(${ddd}) 9${rest.slice(0, 4)}-${rest.slice(4)}`; // Adiciona o 9 se faltar
                }
                return `(${ddd}) ${rest}`;
            }

            return number;
        } catch (e) {
            return jid.split('@')[0];
        }
    }

    static async fetchChats(instance: string) {
        try {
            const [chatsRes, contactsRes] = await Promise.all([
                axios.post(`${EVOLUTION_API_URL}/chat/findChats/${instance}`, {}, { headers: { 'apiKey': EVOLUTION_API_KEY } }),
                axios.post(`${EVOLUTION_API_URL}/chat/findContacts/${instance}`, {}, { headers: { 'apiKey': EVOLUTION_API_KEY } })
            ]);

            const chats = Array.isArray(chatsRes.data) ? chatsRes.data : [];
            const contacts = Array.isArray(contactsRes.data) ? contactsRes.data : [];
            
            // Cria dois mapas: um por JID e outro por Nome para cruzamento fallback
            const contactByJid = new Map();
            const contactByName = new Map();
            
            contacts.forEach((c: any) => {
                const jid = c.remoteJid || c.id;
                if (jid) contactByJid.set(jid, c);
                // Se tem um nome real, mapeia por ele também (ajuda com LIDs)
                if (c.name && !/^\d+$/.test(c.name)) contactByName.set(c.name.toLowerCase(), c);
                if (c.pushName && !/^\d+$/.test(c.pushName)) contactByName.set(c.pushName.toLowerCase(), c);
            });

            const enrichedChats = await Promise.all(chats.map(async (c: any) => {
                const jid = c.remoteJid || c.id;
                const isGroup = jid.endsWith('@g.us');
                
                // Tenta cruzamento por JID primeiro, depois por Nome
                const contact = contactByJid.get(jid) || contactByName.get((c.name || c.pushName || '').toLowerCase());
                
                // Tenta do cache
                const cached = EvolutionService.metadataCache.get(jid);
                if (cached && Date.now() - cached.ts < EvolutionService.METADATA_TTL_MS) {
                    return {
                        id:              jid,
                        name:            cached.name,
                        phoneNumber:     EvolutionService.formatPhoneNumber(jid, contact),
                        avatar:          cached.avatar,
                        lastMessage:     extractTextFromWhatsAppMessage(c.lastMessage),
                        lastMessageTime: toTimestampMs(c.lastMessage?.messageTimestamp || c.conversationTimestamp),
                        unreadCount:     c.unreadCount || 0,
                        type:            isGroup ? 'group' : 'individual'
                    };
                }

                // Hierarquia de nomes: Nome Agenda -> Nome Grupo -> Nome Chat -> Push Name -> Telefone Formatado
                let name = contact?.name || contact?.pushName || c.subject || c.name || c.pushName;
                let avatar = c.profilePicUrl || contact?.profilePicUrl || null;

                const formattedNum = EvolutionService.formatPhoneNumber(jid, contact);

                // Busca reforçada para grupos (timeout maior para garantir 100%)
                if (isGroup && (!name || /^\d+$/.test(name))) {
                    try {
                        const meta = await axios.get(`${EVOLUTION_API_URL}/group/findGroupInfos/${instance}?groupJid=${jid}`, { headers: { 'apiKey': EVOLUTION_API_KEY }, timeout: 3500 });
                        if (meta.data?.subject) name = meta.data.subject;
                    } catch (e) {
                        try {
                            const meta2 = await axios.get(`${EVOLUTION_API_URL}/group/findMetadata/${instance}/${jid}`, { headers: { 'apiKey': EVOLUTION_API_KEY }, timeout: 3500 });
                            if (meta2.data?.subject) name = meta2.data.subject;
                        } catch (e2) {}
                    }
                }

                // Busca forçada de avatar (se o contato tiver, usamos; senão, pedimos)
                if (!avatar) {
                    try {
                        const pic = await axios.get(`${EVOLUTION_API_URL}/chat/fetchProfilePicture/${instance}?number=${jid}`, { headers: { 'apiKey': EVOLUTION_API_KEY }, timeout: 3000 });
                        if (pic.data?.profilePictureUrl) avatar = pic.data.profilePictureUrl;
                    } catch (e) {}
                }

                let finalName = name;
                // Se ainda for um ID numérico ou nulo, aplica o fallback visual
                if (!finalName || /^\d{10,}$/.test(finalName)) {
                    finalName = isGroup ? `Grupo (${jid.split('@')[0].slice(-4)})` : (formattedNum || jid.split('@')[0]);
                }

                const finalAvatar = avatar;
                EvolutionService.metadataCache.set(jid, { name: finalName, avatar: finalAvatar || '', ts: Date.now() });

                return {
                    id:              jid,
                    name:            finalName,
                    phoneNumber:     formattedNum,
                    avatar:          finalAvatar,
                    lastMessage:     extractTextFromWhatsAppMessage(c.lastMessage),
                    lastMessageTime: toTimestampMs(c.lastMessage?.messageTimestamp || c.conversationTimestamp),
                    unreadCount:     c.unreadCount || 0,
                    type:            isGroup ? 'group' : 'individual'
                };
            }));

            return enrichedChats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        } catch (error: any) {
            console.error('[Evolution] Error fetching enriched chats:', error.message);
            return [];
        }
    }
}
