// Patrones de expresión regular para detectar fechas (ordenados por especificidad)
const datePatterns = [
    // DD/MM/YYYY HH:MM:SS (o MM/DD/YYYY)
    /\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\b/,
    // ISO 8601: YYYY-MM-DDTHH:MM:SS.sssZ
    /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
    // YYYY-MM-DD HH:MM:SS
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
    // YYYY-MM-DD HH:MM:SS.sss
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/,
    // Month Day YYYY HH:MM:SS (Jan 15 2024...)
    /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2})/i,
    // Day Month YYYY HH:MM:SS (17 Oct. 2025...)
    /\b(\d{1,2}\s+[a-z]{3,4}\.?\s+\d{4},?\s+\d{2}:\d{2}:\d{2})\b/i
];

// Patrones para detectar niveles de log (anclados al inicio o en etiquetas XML)
const logLevelPatterns = {
    critical: /^Crítico\b|^Critical\b|<Level>(1|Crítico|Critical)<\/Level>/i,
    error: /^Error\b|<Level>(2|Error)<\/Level>/i,
    warning: /^(Advertencia|Warning)\b|<Level>(3|Advertencia|Warning)<\/Level>/i,
    info: /^(Información|Information)\b|<Level>(4|Información|Information)<\/Level>/i,
    detailed: /^(Detallado|Detailed)\b|<Level>(5|Detallado|Detailed)<\/Level>/i,
    success: /success\b|ok\b|complete\b|done\b/i
};

/**
 * Detecta el nivel de log, priorizando el inicio de la línea.
 */
function detectLogLevel(message) {
    const anchoredPatterns = {
        critical: /^Crítico\b|^Critical\b/i,
        error: /^Error\b/i,
        warning: /^(Advertencia|Warning)\b/i,
        info: /^(Información|Information)\b/i,
        detailed: /^(Detallado|Detailed)\b/i
    };

    for (const [level, pattern] of Object.entries(anchoredPatterns)) {
        if (pattern.test(message)) {
            return level;
        }
    }

    const fallbackPatterns = {
        critical: /<Level>(1|Crítico|Critical)<\/Level>/i,
        error: /<Level>(2|Error)<\/Level>/i,
        warning: /<Level>(3|Advertencia|Warning)<\/Level>/i,
        info: /<Level>(4|Información|Information)<\/Level>/i,
        detailed: /<Level>(5|Detallado|Detailed)<\/Level>/i,
        success: /success\b|ok\b|complete\b|done\b/i
    };
    
    for (const [level, pattern] of Object.entries(fallbackPatterns)) {
        if (pattern.test(message)) {
            return level;
        }
    }

    return null;
}

/**
 * Extrae el Event ID del mensaje
 * Busca patrones como: "Service 1531 Ninguno", "EventID: 4624", etc.
 */
function extractEventId(message) {
    // Patrón 1: Microsoft-Windows-XXX 1234 (el número después del nombre del servicio)
    let match = message.match(/Microsoft-Windows-[^\s]+\s+(\d{3,5})\s+/i);
    if (match) return match[1];
    
    // Patrón 2: Service XXX 1234
    match = message.match(/Service\s+[^\s]+\s+(\d{3,5})\s+/i);
    if (match) return match[1];
    
    // Patrón 3: EventID: 1234 o Event ID: 1234
    match = message.match(/Event\s*ID[:\s]+(\d{3,5})\b/i);
    if (match) return match[1];
    
    // Patrón 4: ID: 1234
    match = message.match(/\bID[:\s]+(\d{3,5})\b/i);
    if (match) return match[1];
    
    // Patrón 5: En XML <EventID>1234</EventID>
    match = message.match(/<EventID>(\d{3,5})<\/EventID>/i);
    if (match) return match[1];
    
    // Patrón 6: Cualquier secuencia de 3-5 dígitos después de un espacio
    // (menos agresivo, solo si no hay otros patrones)
    match = message.match(/\s(\d{4})\s/);
    if (match) return match[1];
    
    return null;
}

// Función principal para dirigir el parseo
function parseLogContent(content, extension, fileName) {
    const events = [];
    try {
        if (extension === 'json') {
            const jsonData = JSON.parse(content);
            events.push(...parseJSON(jsonData, fileName));
        } else if (extension === 'xml') {
            events.push(...parseXML(content, fileName));
        } else {
            events.push(...parseText(content, fileName));
        }
    } catch (error) {
        console.error('Error al parsear el contenido:', error);
        if (extension !== 'txt' && extension !== 'log') {
            events.push(...parseText(content, fileName));
        }
    }
    return events;
}

// Parseo de objetos JSON 
function parseJSON(data, fileName) {
    const events = [];
    const extractFromObject = (obj, path = '') => {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => extractFromObject(item, `${path}[${index}]`));
        } else if (typeof obj === 'object' && obj !== null) {
            const dateFields = ['timestamp', 'time', 'date', 'datetime', 'created', 'occurred'];
            let dateValue = null;
            for (const field of dateFields) {
                if (obj[field]) {
                    dateValue = obj[field];
                    break;
                }
            }
            if (dateValue) {
                const date = parseDate(dateValue); 
                if (date) {
                    const message = obj.message || obj.msg || obj.description || obj.text || JSON.stringify(obj);
                    const level = detectLogLevel(message);
                    
                    // Extraer eventId de múltiples fuentes posibles
                    const eventId = obj.eventId || obj.EventId || obj.event_id || obj.id || extractEventId(message);
                    
                    events.push({
                        date: date,
                        message: message,
                        source: fileName,
                        level: level,
                        eventId: eventId
                    });
                }
            }
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    extractFromObject(obj[key], path ? `${path}.${key}` : key);
                }
            }
        }
    };
    extractFromObject(data);
    return events;
}

// Parseo de XML 
function parseXML(content, fileName) {
    const events = [];
    const eventRegex = /<Event([\s\S]*?)<\/Event>/gis;
    
    let match;
    while ((match = eventRegex.exec(content)) !== null) {
        const eventContent = match[0];
        const dateMatch = findDateInText(eventContent);
        
        if (dateMatch) {
            let message = eventContent.replace(dateMatch.matchString, '');
            const tagEndIndex = message.indexOf('>');
            if (tagEndIndex > -1) {
                message = message.substring(tagEndIndex + 1);
            }
            message = message.replace(/<[^>]+>/g, ' ');
            message = message.replace(/\s+/g, ' ').trim();

            // Extraer EventID del XML o del mensaje procesado
            const eventId = extractEventId(eventContent) || extractEventId(message);

            events.push({
                date: dateMatch.date,
                message: message,
                source: fileName,
                level: detectLogLevel(eventContent),
                eventId: eventId
            });
        }
    }
    
    return events;
}

// Parseo de Texto Plano (maneja logs multilínea)
function parseText(content, fileName) {
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;

    const levelRegex = /^(Información|Information|Advertencia|Warning|Error|Crítico|Critical|Detallado|Detailed)\t/i;

    // La iteración comienza en 1 para ignorar líneas de encabezado comunes.
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (!line || line.trim().length === 0) continue; 
        
        const levelMatch = line.match(levelRegex);
        const dateMatch = findDateInText(line);

        if (levelMatch && dateMatch) { 
            
            if (currentEvent) {
                currentEvent.message = currentEvent.message.trim();
                // Extraer eventId antes de guardar el evento
                if (!currentEvent.eventId) {
                    currentEvent.eventId = extractEventId(currentEvent.message);
                }
                events.push(currentEvent);
            }

            const levelWord = levelMatch[1];
            
            // El mensaje comienza después de la fecha
            const messageStartIndex = dateMatch.index + dateMatch.matchString.length;
            let message = line.substring(messageStartIndex);
            
            const normalizedLevel = detectLogLevel(levelWord);
            const eventId = extractEventId(line);
            
            currentEvent = {
                date: dateMatch.date,
                message: message.trim(),
                source: fileName,
                level: normalizedLevel,
                eventId: eventId
            };

        } else if (currentEvent) {
            // Continuación del evento anterior
            currentEvent.message += '\n' + line.trim();
            
            // Si aún no tenemos eventId, intentar extraerlo de esta línea
            if (!currentEvent.eventId) {
                const eventId = extractEventId(line);
                if (eventId) {
                    currentEvent.eventId = eventId;
                }
            }
        }
    }

    if (currentEvent) {
        currentEvent.message = currentEvent.message.trim();
        // Extraer eventId antes de guardar el último evento
        if (!currentEvent.eventId) {
            currentEvent.eventId = extractEventId(currentEvent.message);
        }
        events.push(currentEvent);
    }

    return events;
}

// Busca la primera fecha válida en un texto
function findDateInText(text) {
    let earliestMatch = null;
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            const dateString = match[1] || match[0];
            const date = parseDate(dateString); 
            
            if (date) { 
                const matchIndex = match.index;
                if (earliestMatch === null || matchIndex < earliestMatch.index) {
                    earliestMatch = { 
                        date: date,
                        index: matchIndex, 
                        matchString: dateString 
                    };
                }
            }
        }
    }
    return earliestMatch;
}

// Convierte una cadena de fecha en un objeto Date
function parseDate(dateInput) {
    
    if (typeof dateInput === 'number') {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2050) {
            return d;
        }
        return null;
    }

    if (typeof dateInput !== 'string') {
        return null;
    }

    // 1. D/M/YYYY HH:MM:SS (o MM/DD/YYYY)
    let match = dateInput.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\b/);
    if (match) {
        let [, day, month, year, hour, minute, second] = match.map(Number);
        
        if (year > 1970 && year < 2050) {
            if (month >= 1 && month <= 12) {
                const d = new Date(year, month - 1, day, hour, minute, second);
                if (!isNaN(d.getTime()) && d.getDate() === day) { return d; }
            }
            if (day >= 1 && day <= 12) {
                const d = new Date(year, day - 1, month, hour, minute, second);
                if (!isNaN(d.getTime()) && d.getDate() === month) { return d; }
            }
        }
    }

    // 2. Formato ISO o YYYY-MM-DD HH:MM:SS
    match = dateInput.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/) ||
            dateInput.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2050) { return d; }
    }

    // 3. Formato Day Month Year HH:MM:SS
    match = dateInput.match(/\b(\d{1,2})\s+([a-z]{3,4})\.?\s+(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})\b/i);
    if (match) {
        let [, day, monthStr, year, hour, minute, second] = match;
        monthStr = monthStr.toLowerCase();
        
        const monthMap = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const cleanMonthStr = monthStr.substring(0, 3); 
        const month = monthMap[cleanMonthStr];

        if (month !== undefined && year > 1970 && year < 2050) {
            const d = new Date(year, month, day, hour, minute, second);
            if (!isNaN(d.getTime())) { return d; }
        }
    }

    return null; 
}