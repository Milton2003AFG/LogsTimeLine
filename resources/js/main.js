const appState = {
    events: [],
    loadedFiles: [],
    currentFilter: '',
    currentSort: 'asc',
    currentLevel: 'tod'
};

// Inicializar la aplicación
async function init() {
    try {
        if (typeof Neutralino === 'undefined') {
            console.error('Neutralino no está cargado. Asegúrate de ejecutar "neu update" primero.');
            return;
        }
        await Neutralino.init();
        setupEventListeners();
        updateStats();
    } catch (error) {
        console.error('Error al inicializar:', error);
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
        loadBtn.addEventListener('click', openFileDialog);
    }
    if (clearBtn) { clearBtn.addEventListener('click', clearAll); }
    
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
    try {
        if (!Neutralino || !Neutralino.os) {
            throw new Error('Neutralino.os no está disponible');
        }
        const selection = await Neutralino.os.showOpenDialog('Selecciona uno o más archivos de log', {
            multiSelections: true,
            filters: [
                { name: 'Archivos de Log', extensions: ['txt', 'log', 'xml', 'json', 'evtx'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        if (selection && selection.length > 0) {
            appState.currentFilter = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) { searchInput.value = ''; }

            for (const filePath of selection) {
                await loadFile(filePath);
            }
        }
    } catch (error) {
        console.error('Error al abrir el diálogo:', error);
    }
}

// Cargar y procesar archivo
async function loadFile(filePath) {
    const fileName = filePath.split(/[\\/]/).pop();

    if (appState.loadedFiles.includes(fileName)) {
        console.warn(`El archivo ${fileName} ya está cargado. Omitiendo.`);
        return;
    }

    showLoading(true);
    try {
        const content = await Neutralino.filesystem.readFile(filePath);
        const extension = fileName.split('.').pop().toLowerCase();

        // parseLogContent se encuentra en parsers.js
        const events = parseLogContent(content, extension, fileName);

        if (events.length === 0) {
            console.warn('No se encontraron eventos con fechas válidas en el archivo.');
        }
        
        appState.events.push(...events);
        appState.loadedFiles.push(fileName);
        
        renderTimeline();
        updateStats();
    } catch (error) {
        console.error('Error al cargar el archivo:', error);
    } finally {
        showLoading(false);
    }
}

// Renderizar timeline
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    const filteredEvents = appState.events.filter(event => {
        // Filtrado por texto (búsqueda)
        if (appState.currentFilter) {
            if (!event.message.toLowerCase().includes(appState.currentFilter.toLowerCase())) {
                return false;
            }
        }
        // Filtrado por nivel de log
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

// Crea la tarjeta de evento (resumen y detalle plegable)
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

    // Badge de Nivel
    const levelBadge = document.createElement('span');
    levelBadge.className = `log-level ${event.level || 'log-level-none'}`;
    levelBadge.textContent = event.level || '';
    if (!event.level) { 
        levelBadge.innerHTML = '&nbsp;';
        levelBadge.style.visibility = "hidden";
    }
    summaryView.appendChild(levelBadge);

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


// Formatea la fecha para la UI
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

// Escapa el texto para evitar XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Actualiza los contadores y el rango de fechas en la UI
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

// Activa el filtro de búsqueda por texto
function triggerSearch() {
    const searchInput = document.getElementById('searchInput');
    appState.currentFilter = searchInput.value;
    renderTimeline();
}

// Maneja el cambio de orden (asc/desc)
function handleSort(e) {
    appState.currentSort = e.target.value; 
    renderTimeline();
}

// Maneja el filtro por nivel de log
function handleLevelFilter(e) {
    appState.currentLevel = e.target.value;
    renderTimeline();
}

// Muestra el modal de confirmación antes de borrar
function clearAll() {
    if (appState.events.length === 0) return;
    
    showConfirmationModal('¿Estás seguro de que deseas borrar todos los eventos y archivos?', () => {
        performClearAll(); 
    });
}

// Ejecuta el borrado real del estado
function performClearAll() {
    appState.events = [];
    appState.loadedFiles = [];
    appState.currentFilter = '';
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').value = '';
    }
    renderTimeline();
    updateStats();
}

// Oculta el modal de confirmación
function hideConfirmationModal() {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Muestra el modal de confirmación
function showConfirmationModal(message, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    const msgElement = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmBtnYes');
    const noBtn = document.getElementById('confirmBtnNo');

    if (!overlay || !msgElement || !yesBtn || !noBtn) {
        console.error('Elementos del modal de confirmación no encontrados.');
        onConfirm();
        return;
    }

    msgElement.textContent = message;
    overlay.classList.remove('hidden');

    // Clonar para eliminar listeners antiguos
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    // Añadir nuevos listeners
    newYesBtn.addEventListener('click', () => {
        hideConfirmationModal();
        onConfirm();
    });

    newNoBtn.addEventListener('click', () => {
        hideConfirmationModal();
    });
}


// Inicializar la aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}