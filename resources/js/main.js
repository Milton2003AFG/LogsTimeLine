// Estado de la aplicación
const appState = {
    events: [],
    loadedFiles: [],
    currentFilter: '',
    currentSort: 'asc',
    currentLevel: 'tod'
};

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


// Inicializar la aplicación
async function init() {
    try {
        if (typeof Neutralino === 'undefined') {
            console.error('Neutralino no está cargado. Asegúrate de ejecutar "neu update" primero.');
            return;
        }
        await Neutralino.init();
        console.log('Neutralino inicializado correctamente');
        setupEventListeners();
        updateStats();
    } catch (error) {
        console.error('Error al inicializar:', error);
        console.error('Error al inicializar la aplicación: ' + error.message);
    }
}

// Configurar event listeners
function setupEventListeners() {
    const loadBtn = document.getElementById('loadFileBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const sortOrder = document.getElementById('sortOrder');
    const levelSelect = document.getElementById('sortLevel');

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            console.log('Botón de cargar presionado');
            await openFileDialog();
        });
    }
    if (clearBtn) { clearBtn.addEventListener('click', clearAll); }
    
    // Lógica de búsqueda (Click y Enter)
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', triggerSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
            }
        });
    }

    if (sortOrder) { sortOrder.addEventListener('change', handleSort); }
    if (levelSelect) { levelSelect.addEventListener('change', handleLevelFilter); }

    try {
        Neutralino.events.on('windowClose', () => {
            Neutralino.app.exit();
        });
    } catch (error) {
        console.error('Error al configurar eventos de Neutralino:', error);
    }
}

// Abrir diálogo de selección de archivo
async function openFileDialog() {
    console.log('Abriendo diálogo de archivo...');
    try {
        if (!Neutralino || !Neutralino.os) {
            throw new Error('Neutralino.os no está disponible');
        }
        const selection = await Neutralino.os.showOpenDialog('Selecciona un archivo de log', {
            filters: [
                { name: 'Archivos de Log', extensions: ['txt', 'log', 'xml', 'json', 'evtx'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });
        if (selection && selection.length > 0) {
            await loadFile(selection[0]);
        } else {
            console.log('No se seleccionó ningún archivo');
        }
    } catch (error) {
        console.error('Error al abrir el diálogo:', error);
        console.error('Error al seleccionar el archivo:\n\n' + error.message);
    }
}

// Cargar y procesar archivo
async function loadFile(filePath) {
    showLoading(true);
    try {
        const content = await Neutralino.filesystem.readFile(filePath);
        const fileName = filePath.split(/[\\/]/).pop();
        const extension = fileName.split('.').pop().toLowerCase();

        // Limpiar estado antes de cargar nuevo archivo
        appState.events = [];
        appState.loadedFiles = [];
        appState.currentFilter = '';
        if (document.getElementById('searchInput')) {
             document.getElementById('searchInput').value = '';
        }

        const events = parseLogContent(content, extension, fileName);

        if (events.length === 0) {
            console.warn('No se encontraron eventos con fechas válidas en el archivo.');
        }
        
        appState.events.push(...events);
        appState.loadedFiles.push(fileName);
        
        renderTimeline();
        updateStats();
        console.log(`Cargados ${events.length} eventos desde ${fileName}.`);
    } catch (error) {
        console.error('Error al cargar el archivo:', error);
        console.error('Error al cargar el archivo: ' + error.message);
    } finally {
        showLoading(false);
    }
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
    
    // --- CORRECCIÓN ---
    // Volvemos a la Regex anterior (la simple, que daba 4596).
    // Es mejor que capture 2 de más a que descarte 4000.
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


// Renderizar timeline
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    const filteredEvents = appState.events.filter(event => {
        if (appState.currentFilter) {
            if (!event.message.toLowerCase().includes(appState.currentFilter.toLowerCase())) {
                return false;
            }
        }
        if (appState.currentLevel && appState.currentLevel !== 'tod') {
            const levelMap = {
                adv: 'warning', cri: 'critical', err: 'error',
                inf: 'info', det: 'detailed' 
            };
            const mapped = levelMap[appState.currentLevel];

            if (appState.currentLevel === 'det') {
                if (event.level !== 'detailed' && event.level !== null) {
                    return false;
                }
            } else if (mapped) {
                 if (event.level !== mapped) return false;
            }
        }
        return true;
    });

    if (filteredEvents.length === 0) {
        timeline.classList.remove('visible');
        emptyState.classList.remove('hidden');
        document.getElementById('eventsCount').textContent = 0;
        return;
    }

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        if (dateA === 0 && dateB !== 0) return 1; 
        if (dateA !== 0 && dateB === 0) return -1;
        return appState.currentSort === 'asc' ? dateA - dateB : dateB - dateA;
    });

    timeline.innerHTML = '';
    sortedEvents.forEach(event => {
        const eventElement = createEventElement(event);
        timeline.appendChild(eventElement);
    });

    document.getElementById('eventsCount').textContent = sortedEvents.length;
    timeline.classList.add('visible');
    emptyState.classList.add('hidden');
}

// Crear elemento de evento
function createEventElement(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'timeline-event';

    const timeSpan = document.createElement('div');
    timeSpan.className = 'event-time';
    timeSpan.textContent = formatDate(event.date); 

    const card = document.createElement('div');
    card.className = `event-card event-card-collapsible ${event.level ? 'event-level-' + event.level : 'event-level-default'}`;

    const summaryView = document.createElement('div');
    summaryView.className = 'event-summary';

    if (event.level) {
        const levelBadge = document.createElement('span');
        levelBadge.className = `log-level ${event.level}`;
        levelBadge.textContent = event.level;
        summaryView.appendChild(levelBadge);
    } else {
        const levelBadge = document.createElement('span');
        levelBadge.className = `log-level log-level-none`;
        levelBadge.innerHTML = '&nbsp;';
        levelBadge.style.visibility = "hidden";
        summaryView.appendChild(levelBadge);
    }

    const summaryMessage = document.createElement('span');
    summaryMessage.className = 'event-summary-message';
    
    const maxLen = 150;
    let messageText = event.message.split('\n')[0];
    
    if (messageText.length > maxLen) {
        messageText = messageText.substring(0, maxLen) + '...';
    }
    if (messageText.length === 0) {
        messageText = '(Mensaje vacío, haga clic para ver detalles)';
    }
    summaryMessage.textContent = messageText;
    summaryView.appendChild(summaryMessage);
    
    const detailView = document.createElement('div');
    detailView.className = 'event-detail hidden'; 

    const source = document.createElement('div');
    source.className = 'event-source';
    source.innerHTML = `📄 <strong>Archivo:</strong> ${escapeHtml(event.source)}`;
    detailView.appendChild(source);

    const message = document.createElement('div');
    message.className = 'event-message-detail';
    message.innerHTML = '<strong>Mensaje Completo:</strong>';
    
    const preMessage = document.createElement('pre');
    preMessage.textContent = event.message;
    message.appendChild(preMessage);
    
    detailView.appendChild(message);

    card.appendChild(summaryView);
    card.appendChild(detailView);

    card.addEventListener('click', () => {
        detailView.classList.toggle('hidden');
        card.classList.toggle('is-open');
    });

    eventDiv.appendChild(timeSpan);
    eventDiv.appendChild(card);

    return eventDiv;
}


// Formatear fecha
function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return "Fecha Desconocida"; 
    }
    const options = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    return date.toLocaleString('es-ES', options);
}

// Escapar HTML
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Actualizar estadísticas
function updateStats() {
    document.getElementById('filesCount').textContent = appState.loadedFiles.length;
    document.getElementById('eventsCount').textContent = appState.events.length;

    if (appState.events.length > 0) {
        const validDates = appState.events
            .map(e => e.date)
            .filter(d => d && !isNaN(d.getTime())) 
            .map(d => d.getTime());

        if (validDates.length > 0) {
            const minDate = new Date(Math.min(...validDates));
            const maxDate = new Date(Math.max(...validDates));
            const dateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;
            document.getElementById('dateRange').textContent = dateRange;
        } else {
            document.getElementById('dateRange').textContent = 'Rango no disponible';
        }
    } else {
        document.getElementById('dateRange').textContent = '-';
    }
}

// Manejar búsqueda
function triggerSearch() {
    const searchInput = document.getElementById('searchInput');
    appState.currentFilter = searchInput.value;
    renderTimeline();
}

// Manejar ordenamiento
function handleSort(e) {
    appState.currentSort = e.target.value;
    renderTimeline();
}

// Manejar filtro por nivel
function handleLevelFilter(e) {
    appState.currentLevel = e.target.value;
    renderTimeline();
}

// Limpiar todo
function clearAll() {
    if (appState.events.length === 0) return;
    
    appState.events = [];
    appState.loadedFiles = [];
    appState.currentFilter = '';
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').value = '';
    }
    renderTimeline();
    updateStats();
}

// Mostrar/ocultar loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Iniciar la aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}