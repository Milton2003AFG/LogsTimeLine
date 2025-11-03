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
    // ISO 8601: 2024-01-15T10:30:45.123Z
    /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
    // Formato común: 2024-01-15 10:30:45
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
    // Formato con milisegundos: 2024-01-15 10:30:45.123
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/,
    // Formato DD/MM/YYYY HH:MM:SS
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
    // Formato MM/DD/YYYY HH:MM:SS
    /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
    // Formato con nombre de mes: Jan 15 2024 10:30:45
    /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2})/i,
    // Timestamp Unix (10 dígitos)
    /\b(\d{10})\b/
];

// Patrones para detectar niveles de log
const logLevelPatterns = {
    error: /^Error\b/,
    critical: /^Crítico\b|^Critical\b/,
    detailed: /^Detallado\b|^Detailed\b/,
    warning: /^Advertencia\b|^Warning\b/,
    info: /^Información\b|^Information\b/,
    success: /^success\b|^ok\b|^complete\b|^done\b/
};

// Inicializar la aplicación
async function init() {
    try {
        // Verificar que Neutralino esté disponible
        if (typeof Neutralino === 'undefined') {
            console.error('Neutralino no está cargado. Asegúrate de ejecutar "neu update" primero.');
            alert('Error: La biblioteca de Neutralino no está cargada.\n\nPor favor ejecuta:\nneu update\n\nEn la carpeta de tu proyecto.');
            return;
        }

        await Neutralino.init();
        console.log('Neutralino inicializado correctamente');
        
        setupEventListeners();
        updateStats();
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al inicializar la aplicación: ' + error.message);
    }
}

// Configurar event listeners
function setupEventListeners() {
    const loadBtn = document.getElementById('loadFileBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const searchInput = document.getElementById('searchInput');
    const sortOrder = document.getElementById('sortOrder');
    const levelSelect = document.getElementById('sortLevel');

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            console.log('Botón de cargar presionado');
            await openFileDialog();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAll);
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    if (sortOrder) {
        sortOrder.addEventListener('change', handleSort);
    }

    if (levelSelect) {
        levelSelect.addEventListener('change', handleLevelFilter);
    }

    // Eventos de Neutralino
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
        // Verificar que Neutralino.os esté disponible
        if (!Neutralino || !Neutralino.os) {
            throw new Error('Neutralino.os no está disponible');
        }

        const selection = await Neutralino.os.showOpenDialog('Selecciona un archivo de log', {
            filters: [
                { name: 'Archivos de Log', extensions: ['txt', 'log', 'xml', 'json'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        console.log('Archivo seleccionado:', selection);

        if (selection && selection.length > 0) {
            const filePath = selection[0];
            await loadFile(filePath);
        } else {
            console.log('No se seleccionó ningún archivo');
        }
    } catch (error) {
        console.error('Error al abrir el diálogo:', error);
        alert('Error al seleccionar el archivo:\n\n' + error.message + '\n\nAsegúrate de que:\n1. Ejecutaste "neu update"\n2. La aplicación se inició con "neu run"');
    }
}

// Cargar y procesar archivo
async function loadFile(filePath) {
    showLoading(true);

    try {
        // Leer el contenido del archivo
        const content = await Neutralino.filesystem.readFile(filePath);
        
        // Obtener nombre del archivo
        const fileName = filePath.split(/[\\/]/).pop();
        
        // Parsear el contenido según el tipo de archivo
        const extension = fileName.split('.').pop().toLowerCase();
        const events = parseLogContent(content, extension, fileName);

        if (events.length === 0) {
            alert('No se encontraron eventos con fechas válidas en el archivo.');
            showLoading(false);
            return;
        }

        // Agregar eventos al estado
        appState.events.push(...events);
        appState.loadedFiles.push(fileName);

        // Actualizar la interfaz
        renderTimeline();
        updateStats();
        
        console.log(`Cargados ${events.length} eventos desde ${fileName}`);
    } catch (error) {
        console.error('Error al cargar el archivo:', error);
        alert('Error al cargar el archivo: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Parsear contenido del log
function parseLogContent(content, extension, fileName) {
    const events = [];

    try {
        if (extension === 'json') {
            // Intentar parsear como JSON
            const jsonData = JSON.parse(content);
            events.push(...parseJSON(jsonData, fileName));
        } else if (extension === 'xml') {
            // Parsear XML (simple)
            events.push(...parseXML(content, fileName));
        } else {
            // Parsear como texto plano (txt, log)
            events.push(...parseText(content, fileName));
        }
    } catch (error) {
        console.error('Error al parsear el contenido:', error);
        // Si falla el parseo específico, intentar como texto
        if (extension !== 'txt' && extension !== 'log') {
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
            // Buscar campos de fecha comunes
            const dateFields = ['timestamp', 'time', 'date', 'datetime', 'created', 'occurred'];
            let dateValue = null;
            let dateField = null;

            for (const field of dateFields) {
                if (obj[field]) {
                    dateValue = obj[field];
                    dateField = field;
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

            // Recursivamente buscar en propiedades anidadas
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

// Parsear XML
function parseXML(content, fileName) {
    const events = [];
    const lines = content.split('\n');

    let currentEvent = null;
    let dateBuffer = null;

    for (const line of lines) {
        // Buscar fechas en líneas XML
        const dateMatch = findDateInText(line);
        if (dateMatch) {
            if (currentEvent) {
                events.push(currentEvent);
            }
            dateBuffer = dateMatch;
            currentEvent = {
                date: dateMatch,
                message: line.trim(),
                source: fileName,
                level: detectLogLevel(line)
            };
        } else if (currentEvent) {
            currentEvent.message += '\n' + line.trim();
        }
    }

    if (currentEvent) {
        events.push(currentEvent);
    }

    return events;
}

// Parsear texto plano
function parseText(content, fileName) {
    const events = [];
    const lines = content.split('\n');

    let currentEvent = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const dateMatch = findDateInText(trimmedLine);

        if (dateMatch) {
            // Si encontramos una fecha, guardar el evento anterior si existe
            if (currentEvent) {
                events.push(currentEvent);
            }

            // Crear nuevo evento
            const message = trimmedLine;
            const level = detectLogLevel(message);

            currentEvent = {
                date: dateMatch,
                message: message,
                source: fileName,
                level: level
            };
        } else if (currentEvent) {
            // Agregar línea al mensaje del evento actual
            currentEvent.message += '\n' + trimmedLine;
        }
    }

    // Agregar el último evento si existe
    if (currentEvent) {
        events.push(currentEvent);
    }

    return events;
}

// Buscar fecha en texto
function findDateInText(text) {
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            const date = parseDate(match[1]);
            if (date) return date;
        }
    }
    return null;
}

// Parsear fecha de diferentes formatos
function parseDate(dateString) {
    // Intentar parsear como timestamp Unix
    if (/^\d{10}$/.test(dateString)) {
        const timestamp = parseInt(dateString) * 1000;
        return new Date(timestamp);
    }

    // Intentar parsear como fecha ISO o estándar
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // Intentar formato DD/MM/YYYY
    const ddmmyyyy = dateString.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (ddmmyyyy) {
        const [, day, month, year, hour, minute, second] = ddmmyyyy;
        return new Date(year, month - 1, day, hour, minute, second);
    }

    return null;
}

// Detectar nivel de log
function detectLogLevel(message) {
    for (const [level, pattern] of Object.entries(logLevelPatterns)) {
        if (pattern.test(message)) {
            return level;
        }
    }
    return null;
}

// Renderizar timeline
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    // Filtrar eventos (por texto y por nivel)
    const filteredEvents = appState.events.filter(event => {
        // Filtro por texto
        if (appState.currentFilter) {
            if (!event.message.toLowerCase().includes(appState.currentFilter.toLowerCase())) {
                return false;
            }
        }

        // Filtro por nivel
        // Valores del select: 'tod' (todos), 'adv' (advertencia), 'cri' (crítico),
        // 'err' (error), 'det' (detallado -> sin nivel detectado), 'inf' (info)
        if (appState.currentLevel && appState.currentLevel !== 'tod') {
            const levelMap = {
                adv: 'warning',
                cri: 'critical',
                err: 'error',
                inf: 'info',
                det: 'detailed'
            };

            if (appState.currentLevel === 'tod') {
                // 'Detallado' = eventos sin nivel detectado
                if (event.level !== null && event.level !== undefined) return false;
            } else {
                const mapped = levelMap[appState.currentLevel];
                if (!mapped) return true; // valor no mapeado: no filtrar
                if (event.level !== mapped) return false;
            }
        }

        return true;
    });

    if (filteredEvents.length === 0) {
        timeline.classList.remove('visible');
        emptyState.classList.remove('hidden');
        return;
    }

    // Ordenar eventos
    const sortedEvents = [...filteredEvents].sort((a, b) => {
        return appState.currentSort === 'asc' 
            ? a.date - b.date 
            : b.date - a.date;
    });

    // Limpiar timeline
    timeline.innerHTML = '';

    // Renderizar eventos
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
    card.className = 'event-card';

    const source = document.createElement('div');
    source.className = 'event-source';
    source.innerHTML = `📄 ${escapeHtml(event.source)}`;

    if (event.level) {
        const levelBadge = document.createElement('span');
        levelBadge.className = `log-level ${event.level}`;
        levelBadge.textContent = event.level;
        source.appendChild(levelBadge);
    }

    const message = document.createElement('div');
    message.className = 'event-message';
    message.textContent = event.message;

    card.appendChild(source);
    card.appendChild(message);
    eventDiv.appendChild(timeSpan);
    eventDiv.appendChild(card);

    return eventDiv;
}

// Formatear fecha
function formatDate(date) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    return date.toLocaleString('es-ES', options);
}

// Escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Actualizar estadísticas
function updateStats() {
    document.getElementById('filesCount').textContent = appState.loadedFiles.length;
    document.getElementById('eventsCount').textContent = appState.events.length;

    if (appState.events.length > 0) {
        const dates = appState.events.map(e => e.date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        const dateRange = `${formatDate(minDate)} - ${formatDate(maxDate)}`;
        document.getElementById('dateRange').textContent = dateRange;
    } else {
        document.getElementById('dateRange').textContent = '-';
    }
}

// Manejar búsqueda
function handleSearch(e) {
    appState.currentFilter = e.target.value;
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

    if (confirm('¿Estás seguro de que quieres eliminar todos los eventos cargados?')) {
        appState.events = [];
        appState.loadedFiles = [];
        appState.currentFilter = '';
        document.getElementById('searchInput').value = '';
        renderTimeline();
        updateStats();
    }
}

// Mostrar/ocultar loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
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