// Estado de la aplicación
const appState = {
    events: [],
    loadedFiles: [],
    selectedFiles: [],
    currentFilter: '',
    currentSort: 'asc',
    currentLevel: 'tod',
    currentId: '',
    searchCommand: {
        type: null,
        value: ''
    }
};

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
    const exportBtn = document.getElementById('exportJsonBtn');
    const helpBtn = document.getElementById('helpBtn');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const sortOrder = document.getElementById('sortOrder');
    const levelSelect = document.getElementById('sortLevel');
    const sortId = document.getElementById('sortId');
    const selectAllFilesBtn = document.getElementById('selectAllFilesBtn');
    const deselectAllFilesBtn = document.getElementById('deselectAllFilesBtn');

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            console.log('Botón de cargar presionado');
            await openFileDialog();
        });
    }
    
    if (clearBtn) { 
        clearBtn.addEventListener('click', clearAll); 
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportToJson);
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', showHelpModal);
    }
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', triggerSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
            }
        });
    }

    if (sortOrder) { 
        sortOrder.addEventListener('change', handleSort); 
    }
    
    if (levelSelect) { 
        levelSelect.addEventListener('change', handleLevelFilter); 
    }
    
    if (sortId) { 
        sortId.addEventListener('change', handleSortId); 
    }

    if (selectAllFilesBtn) {
        selectAllFilesBtn.addEventListener('click', selectAllFiles);
    }

    if (deselectAllFilesBtn) {
        deselectAllFilesBtn.addEventListener('click', deselectAllFiles);
    }

    const helpBtnClose = document.getElementById('helpBtnClose');
    if (helpBtnClose) {
        helpBtnClose.addEventListener('click', hideHelpModal);
    }

    try {
        Neutralino.events.on('windowClose', () => {
            Neutralino.app.exit();
        });
    } catch (error) {
        console.error('Error al configurar eventos de Neutralino:', error);
    }
}

// Parsear comando de búsqueda
function parseSearchCommand(searchText) {
    const trimmed = searchText.trim();
    
    const idMatch = trimmed.match(/^ID:\s*(\d+)/i);
    if (idMatch) {
        return { type: 'ID', value: idMatch[1] };
    }
    
    const msgMatch = trimmed.match(/^MSG:\s*(.+)/i);
    if (msgMatch) {
        return { type: 'MSG', value: msgMatch[1].trim() };
    }
    
    const nivelMatch = trimmed.match(/^NIVEL:\s*(\w+)/i);
    if (nivelMatch) {
        return { type: 'NIVEL', value: nivelMatch[1].toLowerCase() };
    }
    
    return { type: null, value: trimmed };
}

// Función auxiliar para obtener eventos filtrados
function getFilteredEvents() {
    return appState.events.filter(event => {
        // Filtro por archivos seleccionados
        // IMPORTANTE: Si hay archivos cargados pero ninguno seleccionado, no mostrar nada
        if (appState.loadedFiles.length > 0) {
            if (appState.selectedFiles.length === 0) {
                return false; // No hay archivos seleccionados = no mostrar eventos
            }
            if (!appState.selectedFiles.includes(event.source)) {
                return false; // Este archivo no está seleccionado
            }
        }

        // Filtro por comando de búsqueda
        if (appState.searchCommand.value) {
            switch (appState.searchCommand.type) {
                case 'ID':
                    if (!event.eventId || !event.eventId.toString().includes(appState.searchCommand.value)) {
                        return false;
                    }
                    break;
                
                case 'MSG':
                    if (!event.message.toLowerCase().includes(appState.searchCommand.value.toLowerCase())) {
                        return false;
                    }
                    break;
                
                case 'NIVEL':
                    const nivelMap = {
                        'error': 'error',
                        'warning': 'warning',
                        'advertencia': 'warning',
                        'info': 'info',
                        'información': 'info',
                        'informacion': 'info',
                        'critical': 'critical',
                        'crítico': 'critical',
                        'critico': 'critical',
                        'detailed': 'detailed',
                        'detallado': 'detailed'
                    };
                    const targetLevel = nivelMap[appState.searchCommand.value];
                    if (!targetLevel || event.level !== targetLevel) {
                        return false;
                    }
                    break;
                
                default:
                    if (!event.message.toLowerCase().includes(appState.searchCommand.value.toLowerCase())) {
                        return false;
                    }
                    break;
            }
        }
        
        // Filtro por nivel (del select)
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
}

// Abrir diálogo de selección de archivo
async function openFileDialog() {
    console.log('Abriendo diálogo de archivo...');
    try {
        if (!Neutralino || !Neutralino.os) {
            throw new Error('Neutralino.os no está disponible');
        }
        const selection = await Neutralino.os.showOpenDialog('Selecciona uno o más archivos de log', {
            multiSelections: true,
            filters: [
                { name: 'txt, log, xml, json', extensions: ['txt', 'log', 'xml', 'json'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        console.log('Archivos seleccionados:', selection);

        if (selection && selection.length > 0) {
            appState.searchCommand = { type: null, value: '' };
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }

            for (const filePath of selection) {
                await loadFile(filePath);
            }
            
            updateFilesPanel();
        } else {
            console.log('No se seleccionó ningún archivo');
        }
    } catch (error) {
        console.error('Error al abrir el diálogo:', error);
        console.error('Error al seleccionar el archivo:\n\n' + error.message);
    }
}

// Cargar y procesar archivo - OPTIMIZADO
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

        // Parseo optimizado
        const events = parseLogContent(content, extension, fileName);

        if (events.length === 0) {
            console.warn('No se encontraron eventos con fechas válidas en el archivo.');
        }
        
        appState.events.push(...events);
        appState.loadedFiles.push(fileName);
        appState.selectedFiles.push(fileName);
        
        // Renderizado optimizado con requestAnimationFrame
        requestAnimationFrame(() => {
            renderTimeline();
            updateStats();
        });
        
        console.log(`Cargados ${events.length} eventos desde ${fileName}.`);
    } catch (error) {
        console.error('Error al cargar el archivo:', error);
        console.error('Error al cargar el archivo: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Actualizar panel de archivos - OPTIMIZADO
function updateFilesPanel() {
    const filesSidebar = document.getElementById('filesSidebar');
    const filesList = document.getElementById('filesList');

    if (!filesSidebar || !filesList) return;

    if (appState.loadedFiles.length === 0) {
        filesSidebar.classList.add('hidden');
        return;
    }

    filesSidebar.classList.remove('hidden');
    
    // Usar DocumentFragment para evitar reflows múltiples
    const fragment = document.createDocumentFragment();

    appState.loadedFiles.forEach(fileName => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `file-${fileName}`;
        checkbox.className = 'file-checkbox';
        checkbox.checked = appState.selectedFiles.includes(fileName);
        
        checkbox.addEventListener('change', (e) => {
            handleFileCheckboxChange(fileName, e.target.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = `file-${fileName}`;
        label.className = 'file-label';
        
        const eventCount = appState.events.filter(e => e.source === fileName).length;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = fileName;
        
        const countSpan = document.createElement('span');
        countSpan.className = 'file-count';
        countSpan.textContent = `${eventCount}`;

        label.appendChild(nameSpan);
        label.appendChild(countSpan);
        
        fileItem.appendChild(checkbox);
        fileItem.appendChild(label);
        fragment.appendChild(fileItem);
    });

    filesList.innerHTML = '';
    filesList.appendChild(fragment);
}

// Manejar cambio en checkbox de archivo
function handleFileCheckboxChange(fileName, isChecked) {
    if (isChecked) {
        if (!appState.selectedFiles.includes(fileName)) {
            appState.selectedFiles.push(fileName);
        }
    } else {
        appState.selectedFiles = appState.selectedFiles.filter(f => f !== fileName);
    }
    
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

// Seleccionar todos los archivos
function selectAllFiles() {
    appState.selectedFiles = [...appState.loadedFiles];
    updateFilesPanel();
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

// Deseleccionar todos los archivos
function deselectAllFiles() {
    appState.selectedFiles = [];
    updateFilesPanel();
    requestAnimationFrame(() => {
        renderTimeline();
        updateStats();
    });
}

// Renderizar timeline - OPTIMIZADO con Virtual Scrolling concept
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const emptyState = document.getElementById('emptyState');

    const filteredEvents = getFilteredEvents();

    if (filteredEvents.length === 0) {
        timeline.classList.remove('visible');
        emptyState.classList.remove('hidden');
        document.getElementById('eventsCount').textContent = 0;
        document.getElementById('visibleEventsCount').textContent = 0;
        return;
    }

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        if (appState.currentId !== '') {
            const idA = a.id !== null && a.id !== undefined ? a.id : -1;
            const idB = b.id !== null && b.id !== undefined ? b.id : -1;
            
            if (idA === -1 && idB !== -1) return 1;
            if (idA !== -1 && idB === -1) return -1;
            
            if (appState.currentId === 'asc') {
                return idA - idB;
            } else {
                return idB - idA;
            }
        }
        
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        if (dateA === 0 && dateB !== 0) return 1;
        if (dateA !== 0 && dateB === 0) return -1;
        return appState.currentSort === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Usar DocumentFragment para batch DOM updates
    const fragment = document.createDocumentFragment();
    
    sortedEvents.forEach(event => {
        const eventElement = createEventElement(event);
        fragment.appendChild(eventElement);
    });

    timeline.innerHTML = '';
    timeline.appendChild(fragment);

    document.getElementById('visibleEventsCount').textContent = sortedEvents.length;
    timeline.classList.add('visible');
    emptyState.classList.add('hidden');
}

// Crear elemento de evento - Optimizado
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

    if (event.eventId) {
        const eventIdDiv = document.createElement('div');
        eventIdDiv.className = 'event-source';
        eventIdDiv.innerHTML = `🔢 <strong>Event ID:</strong> ${escapeHtml(event.eventId.toString())}`;
        detailView.appendChild(eventIdDiv);
    }

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

// Exportar a JSON
async function exportToJson() {
    if (appState.events.length === 0) {
        showNotificationModal('No hay eventos para exportar. Carga archivos primero.');
        return;
    }

    try {
        showLoading(true);

        const filteredEvents = getFilteredEvents();

        if (filteredEvents.length === 0) {
            showLoading(false);
            showNotificationModal('No hay eventos que coincidan con los filtros actuales.');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            totalEvents: filteredEvents.length,
            filters: {
                searchCommand: appState.searchCommand.type ? 
                    `${appState.searchCommand.type}:${appState.searchCommand.value}` : 
                    appState.searchCommand.value || 'ninguno',
                selectedFiles: appState.selectedFiles.length > 0 ? appState.selectedFiles : 'todos',
                level: appState.currentLevel !== 'tod' ? appState.currentLevel : 'todos',
                sortOrder: appState.currentSort,
                sortId: appState.currentId || 'ninguno'
            },
            sourceFiles: appState.loadedFiles,
            events: filteredEvents.map(event => ({
                date: event.date ? event.date.toISOString() : null,
                dateFormatted: formatDate(event.date),
                message: event.message,
                source: event.source,
                level: event.level || 'sin nivel',
                eventId: event.eventId || 'sin ID',
                id: event.id || 'sin ID'
            }))
        };

        const jsonContent = JSON.stringify(exportData, null, 2);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const defaultFileName = `timeline-export-${timestamp}.json`;

        const savePath = await Neutralino.os.showSaveDialog('Guardar línea de tiempo como JSON', {
            defaultPath: defaultFileName,
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'Todos los archivos', extensions: ['*'] }
            ]
        });

        if (savePath) {
            const finalPath = savePath.toLowerCase().endsWith('.json') ? savePath : savePath + '.json';
            await Neutralino.filesystem.writeFile(finalPath, jsonContent);
            
            showLoading(false);
            console.log(`Exportación exitosa: ${filteredEvents.length} eventos guardados en ${finalPath}`);
            
            showNotificationModal(
                `✅ Exportación exitosa!\n\n${filteredEvents.length} eventos guardados en:\n${finalPath}`
            );

        } else {
            showLoading(false);
            console.log('Exportación cancelada por el usuario');
        }

    } catch (error) {
        showLoading(false);
        console.error('Error al exportar:', error);
        showNotificationModal(`❌ Error al exportar:\n\n${error.message}`);
    }
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
    
    const filteredEvents = getFilteredEvents();
    document.getElementById('visibleEventsCount').textContent = filteredEvents.length;

    if (filteredEvents.length > 0) {
        const validDates = filteredEvents
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

// Manejar búsqueda unificada
function triggerSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value;
    
    appState.searchCommand = parseSearchCommand(searchText);
    
    console.log('Comando parseado:', appState.searchCommand);
    requestAnimationFrame(() => renderTimeline());
}

// Manejar ordenamiento por fecha
function handleSort(e) {
    appState.currentSort = e.target.value; 
    requestAnimationFrame(() => renderTimeline());
}

// Manejar filtro por nivel
function handleLevelFilter(e) {
    appState.currentLevel = e.target.value;
    requestAnimationFrame(() => renderTimeline());
}

// Manejar filtro por ID
function handleSortId(e) {
    appState.currentId = e.target.value;
    requestAnimationFrame(() => renderTimeline());
}

// Limpiar todo
function clearAll() {
    if (appState.events.length === 0) return;
    
    showConfirmationModal('¿Estás seguro de que deseas borrar todos los eventos y archivos?', () => {
        performClearAll();
    });
}

// Lógica de borrado real
function performClearAll() {
    appState.events = [];
    appState.loadedFiles = [];
    appState.selectedFiles = [];
    appState.searchCommand = { type: null, value: '' };
    appState.currentId = '';
    
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').value = '';
    }
    
    updateFilesPanel();
    renderTimeline();
    updateStats();
}

// Mostrar modal de ayuda
function showHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

// Ocultar modal de ayuda
function hideHelpModal() {
    const overlay = document.getElementById('helpOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Mostrar modal de notificación
function showNotificationModal(message) {
    const overlay = document.getElementById('notificationOverlay');
    const msgElement = document.getElementById('notificationMessage');
    const okBtn = document.getElementById('notificationBtnOk');

    if (!overlay || !msgElement || !okBtn) {
        console.error('Elementos del modal de notificación no encontrados.');
        alert(message);
        return;
    }

    msgElement.textContent = message;
    overlay.classList.remove('hidden');

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
    });
}

// Mostrar modal de confirmación
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

    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    newYesBtn.addEventListener('click', () => {
        hideConfirmationModal();
        onConfirm();
    });

    newNoBtn.addEventListener('click', () => {
        hideConfirmationModal();
    });
}

// Ocultar modal de confirmación
function hideConfirmationModal() {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Mostrar o ocultar loading
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