// Patrones de expresión regular para detectar fechas
const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\b/,
    /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/,
    /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2})/i,
    /\b(\d{1,2}\s+[a-z]{3,4}\.?\s+\d{4},?\s+\d{2}:\d{2}:\d{2})\b/i
];

// Patrones para detectar niveles de log
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

    return null; // Nivel no detectado
}

// Parsear contenido del log
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
            // Fallback a texto plano si falla el parseo de JSON/XML
            events.push(...parseText(content, fileName));
        }
    }
    return events;
}

// Parsear JSON
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
                    events.push({
                        date: date,
                        message: message,
                        source: fileName,
                        level: level
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

// Parsear XML (Ignora prólogo y epílogo)
function parseXML(content, fileName) {
    const events = [];
    
    const eventRegex = /<Event([\s\S]*?)<\/Event>/gis;
    
    let match;
    
    // Iterar sobre todas las coincidencias que encuentre
    while ((match = eventRegex.exec(content)) !== null) {
        
        // match[0] es el bloque completo <Event>...</Event>
        const eventContent = match[0];
        
        const dateMatch = findDateInText(eventContent);
        
        if (dateMatch) {
            // Limpiar el contenido para el mensaje
            let message = eventContent.replace(dateMatch.matchString, '');
            
            // Quitar el tag de apertura <Event ...>
            const tagEndIndex = message.indexOf('>');
            if (tagEndIndex > -1) {
                message = message.substring(tagEndIndex + 1);
            }
            
            // Quitar todos los tags internos y el tag de cierre
            message = message.replace(/<[^>]+>/g, ' ');
            message = message.replace(/\s+/g, ' ').trim();

            events.push({
                date: dateMatch.date,
                message: message,
                source: fileName,
                level: detectLogLevel(eventContent) // Detectar nivel del bloque
            });
        }
    }
    
    console.log(`parseXML (Modo Regex Simple) encontró ${events.length} eventos.`);
    return events;
}

// Parsear texto plano
function parseText(content, fileName) {
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;

    // Regex Estricto: Nivel + \t (Tab)
    const levelRegex = /^(Información|Information|Advertencia|Warning|Error|Crítico|Critical|Detallado|Detailed)\t/i;

    // Empezamos en 1 para saltar la cabecera
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (!line || line.trim().length === 0) continue; 
        
        const levelMatch = line.match(levelRegex);
        const dateMatch = findDateInText(line);

        // Es un nuevo evento SÓLO SI tiene Nivel+Tab Y Fecha.
        if (levelMatch && dateMatch) { 
            
            if (currentEvent) {
                currentEvent.message = currentEvent.message.trim();
                events.push(currentEvent);
            }

            const levelWord = levelMatch[1];
            
            // El mensaje es todo lo que está DESPUÉS de la fecha
            const messageStartIndex = dateMatch.index + dateMatch.matchString.length;
            let message = line.substring(messageStartIndex);
            
            const normalizedLevel = detectLogLevel(levelWord); 
            
            currentEvent = {
                date: dateMatch.date,
                message: message.trim(),
                source: fileName,
                level: normalizedLevel 
            };

        } else if (currentEvent) {
            // Asumir que es una continuación del evento anterior.
            currentEvent.message += '\n' + line.trim();
        }
    }

    // Guardar el último evento
    if (currentEvent) {
        currentEvent.message = currentEvent.message.trim();
        events.push(currentEvent);
    }

    console.log(`parseText (MODO ÍNDICE ESTRICTO) encontró ${events.length} eventos.`);
    return events;
}


// Buscar fecha en texto
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

// Parsear fecha de diferentes formatos
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

    // 1. Intentar formato D/M/YYYY HH:MM:SS (o MM/DD/YYYY)
    let match = dateInput.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\b/);
    if (match) {
        let [, day, month, year, hour, minute, second] = match.map(Number);
        
        if (year > 1970 && year < 2050) {
            // Intentar DD/MM (Formato ES/LATAM)
            if (month >= 1 && month <= 12) {
                const d = new Date(year, month - 1, day, hour, minute, second);
                if (!isNaN(d.getTime()) && d.getDate() === day) {
                    return d;
                }
            }
            // Intentar MM/DD (Formato US) (si DD/MM falló)
            if (day >= 1 && day <= 12) {
                const d = new Date(year, day - 1, month, hour, minute, second);
                if (!isNaN(d.getTime()) && d.getDate() === month) {
                    return d;
                }
            }
        }
    }

    // 2. Intentar formato ISO
    match = dateInput.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/);
    if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2050) {
            return d;
        }
    }
    
    // 3. Intentar formato YYYY-MM-DD HH:MM:SS
    match = dateInput.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (match) {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2050) {
            return d;
        }
    }

    // 4. Intentar formato "17 oct 2025, 15:03:51" (coma opcional)
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
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
    }

    return null; // No se pudo parsear
}